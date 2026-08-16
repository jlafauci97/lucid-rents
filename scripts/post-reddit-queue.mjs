#!/usr/bin/env node
/**
 * Reddit queue poster.
 *
 * Runs ON THE MAC MINI via launchd, because posting goes through a logged-in
 * browser session rather than an API token — a Vercel cron has no browser to
 * drive. The mini is always on, so it owns the whole posting loop.
 *
 * The poster drives ITS OWN Chrome instance (real /Applications Chrome, not
 * Playwright's bundled Chromium) against a dedicated profile in
 * ~/.lucidrents/chrome-posting-profile. It used to drive the user's
 * interactive Chrome over AppleScript, which failed two ways on the mini:
 *
 *   1. The rent scrapers launch Playwright copies of the same Chrome bundle,
 *      and `tell application "Google Chrome"` routes Apple Events to whichever
 *      instance macOS feels like — the poster would preflight against a
 *      headless scraper profile that is not signed in.
 *   2. launchd jobs running as /bin/bash never get the macOS Automation
 *      prompt (tccd silently denies platform binaries with -1723), so the
 *      scheduler could not get permission to script Chrome at all.
 *
 * Driving our own spawned instance over CDP has neither problem: Playwright
 * holds a pipe to the exact process it launched, and no Apple Events means no
 * TCC. The automation-fingerprint flags mirror what the rent scrapers already
 * use successfully against far more hostile targets.
 *
 * old.reddit.com is used throughout. New Reddit is a React app whose DOM shifts
 * constantly; old Reddit is plain forms and is far more stable to automate.
 * Profile posts live at r/u_<username> on old Reddit.
 *
 * Work comes from /api/marketing/reddit/queue (one item per run, already
 * rate-limited server-side) and the outcome is PATCHed back. Nothing is marked
 * posted unless the page actually confirms it.
 *
 * Setup on the mini:
 *   1. bash scripts/launchd/install-reddit-post.sh   (installs playwright-core)
 *   2. node scripts/setup-reddit-profile.mjs         (sign the profile in once)
 *   3. .env.local needs CRON_SECRET and REDDIT_USERNAME
 *
 * Usage:
 *   node scripts/post-reddit-queue.mjs             # post one queued item
 *   node scripts/post-reddit-queue.mjs --dry-run   # show what it would post
 *   node scripts/post-reddit-queue.mjs --check     # verify browser + session
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DRY_RUN = process.argv.includes("--dry-run");
const ROOT = path.resolve(import.meta.dirname, "..");

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const BASE_URL = process.env.SCANNER_TARGET_URL || "https://lucidrents.com";
const CRON_SECRET = process.env.CRON_SECRET;
const REDDIT_USERNAME = process.env.REDDIT_USERNAME;

const log = (...a) => console.log(`[poster]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Browser (Playwright driving the real Chrome, dedicated profile)
// ---------------------------------------------------------------------------

export const PROFILE_DIR = path.join(os.homedir(), ".lucidrents", "chrome-posting-profile");
export const CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/**
 * playwright-core is installed under ~/.lucidrents (by the installer), not in
 * the web app's node_modules — the site build has no reason to carry a browser
 * driver. The ~/.lucidrents copy is tried FIRST: the repo checkout lives on
 * iCloud Drive, and resolving a package out of an iCloud node_modules can
 * block for minutes while evicted files rehydrate.
 */
export async function loadPlaywright() {
  const local = path.join(os.homedir(), ".lucidrents", "node_modules", "playwright-core", "index.mjs");
  try {
    return await import(local);
  } catch {
    try {
      return await import("playwright-core");
    } catch {
      throw new Error(
        "playwright-core not found. Run: bash scripts/launchd/install-reddit-post.sh " +
          "(or: cd ~/.lucidrents && npm install playwright-core)"
      );
    }
  }
}

/** Launches the posting browser and returns { context, page, close }. */
export async function launchPostingBrowser({ headless = false } = {}) {
  const { chromium } = await loadPlaywright();
  if (!fs.existsSync(CHROME_BIN)) throw new Error(`Chrome not found at ${CHROME_BIN}`);
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  // A crashed run can leave Chrome's singleton lock behind and make the next
  // launch fail with "profile is in use".
  for (const f of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
    fs.rmSync(path.join(PROFILE_DIR, f), { force: true });
  }
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    executablePath: CHROME_BIN,
    headless,
    viewport: null,
    // Drop Playwright's --enable-automation (infobar + navigator.webdriver)
    // and its keychain bypass flags: cookies cloned from the interactive
    // Chrome are encrypted with the real "Chrome Safe Storage" keychain key,
    // which --use-mock-keychain would hide from this instance.
    ignoreDefaultArgs: ["--enable-automation", "--use-mock-keychain", "--password-store=basic"],
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-sync",
    ],
  });
  const page = context.pages()[0] ?? (await context.newPage());
  return {
    context,
    page,
    close: async () => {
      try {
        await context.close();
      } catch {
        /* already gone */
      }
    },
  };
}

async function goto(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
}

/**
 * A queue item that can never succeed, however many times it is retried —
 * the thread was deleted, removed, locked or archived. Distinct from an
 * ordinary failure, which is worth retrying on the next run.
 */
class PermanentSkip extends Error {
  constructor(message) {
    super(message);
    this.name = "PermanentSkip";
  }
}

/** Reads the logged-in old-reddit username off the current page ('' if none). */
export async function loggedInUser(page) {
  return page.evaluate(
    () => document.querySelector("#header-bottom-right .user a")?.textContent?.trim() ?? ""
  );
}

/** Confirms the posting profile has a live Reddit session as the right user. */
async function preflight(page) {
  await goto(page, "https://old.reddit.com/");
  const user = await loggedInUser(page);
  if (!user) {
    throw new Error(
      "Posting profile is not signed in to Reddit.\n" +
        "        Fix on the mini: node scripts/setup-reddit-profile.mjs"
    );
  }

  // REDDIT_USERNAME does NOT choose the posting account — replies post as
  // whoever the profile is signed in as, and REDDIT_USERNAME only builds the
  // self-post target r/u_<name>. If the two disagree, replies silently go out
  // under the wrong account and self-posts aim at a profile this session
  // cannot submit to. Refuse to post rather than guess which one is right.
  if (REDDIT_USERNAME && user.toLowerCase() !== REDDIT_USERNAME.toLowerCase()) {
    throw new Error(
      `Posting profile is signed in as ${user} but REDDIT_USERNAME is ${REDDIT_USERNAME}.\n` +
        "        Re-run scripts/setup-reddit-profile.mjs as the posting account, or fix .env.local."
    );
  }
  if (!REDDIT_USERNAME) {
    log(`WARNING: REDDIT_USERNAME is not set — cannot verify the posting account`);
  }

  log(`browser ready, signed in as ${user}`);
  return user;
}

// ---------------------------------------------------------------------------
// Posting
// ---------------------------------------------------------------------------

/** Posts a top-level comment on a thread. */
async function postReply(page, item) {
  const url = item.url.replace("www.reddit.com", "old.reddit.com");
  await goto(page, url);

  // A thread can die between the scanner finding it and this run: the OP
  // deletes it, a mod removes it, or it locks/archives. Old Reddit still
  // renders a reply box on a deleted thread, so without this check the post
  // "succeeds" and leaves a promotional comment on a dead thread that nobody
  // can see. These never become postable, so they are retired rather than
  // retried forever.
  const state = await page.evaluate(() => {
    // A logged-out session is bounced to /login, which has no #siteTable and
    // would otherwise read as 'missing'. Retiring a live thread because the
    // cookie lapsed is far worse than retrying, so this is reported separately.
    if (location.pathname.indexOf("/login") === 0) return "logged-out";
    const link = document.querySelector("#siteTable .thing.link");
    if (!link) return "missing";
    if (document.querySelector(".archived-infobar")) return "archived";
    if (document.querySelector(".locked-infobar")) return "locked";
    if ((link.className || "").indexOf("locked") !== -1) return "locked";
    const author = link.querySelector(".author");
    if (!author || author.textContent.trim() === "[deleted]") return "deleted";
    const body = link.querySelector(".usertext-body");
    const text = body ? body.textContent.trim() : "";
    if (text === "[deleted]" || text === "[removed]") return "deleted";
    return "ok";
  });
  if (state === "logged-out") {
    // Preflight confirmed a session moments ago, so this means it lapsed
    // mid-run. Retryable: the thread itself is fine.
    throw new Error("Reddit session lapsed mid-run (bounced to /login) — sign in again");
  }
  if (state !== "ok") {
    throw new PermanentSkip(`thread is ${state} — retiring it, nothing was posted`);
  }

  // The top-level reply box is the first .usertext form outside the comment tree.
  const filled = await page.evaluate((body) => {
    const f = document.querySelector(".commentarea > .usertext form, form.usertext");
    if (!f) return "no-form";
    const ta = f.querySelector('textarea[name="text"]');
    if (!ta) return "no-textarea";
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(ta, body);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    return String(ta.value.length);
  }, item.body);

  if (filled === "no-form" || filled === "no-textarea") {
    throw new Error(`could not find the reply box (${filled})`);
  }
  if (Number(filled) < 20) throw new Error(`reply box only took ${filled} chars`);

  const clicked = await page.evaluate(() => {
    const f = document.querySelector(".commentarea > .usertext form, form.usertext");
    const b = f && f.querySelector('button[type="submit"], .save');
    if (!b) return "no-button";
    b.click();
    return "clicked";
  });
  if (clicked !== "clicked") throw new Error(`could not submit (${clicked})`);

  // Reddit renders the new comment in place; wait for it to appear.
  await sleep(6000);
  const confirmed = await page.evaluate(
    (snippet) => document.body.innerText.indexOf(snippet) !== -1,
    item.body.slice(0, 60)
  );
  if (!confirmed) {
    throw new Error("submitted but the comment did not appear on the page");
  }

  return page.url();
}

/** Submits a self-post to our own profile (r/u_<username> on old Reddit). */
async function postSelfPost(page, item) {
  if (!REDDIT_USERNAME) throw new Error("REDDIT_USERNAME not set");

  const submitUrl = `https://old.reddit.com/r/u_${encodeURIComponent(REDDIT_USERNAME)}/submit?selftext=true`;
  await goto(page, submitUrl);

  const filled = await page.evaluate(
    ({ title, body }) => {
      const titleEl = document.querySelector('textarea[name="title"], input[name="title"]');
      const textEl = document.querySelector('textarea[name="text"]');
      if (!titleEl) return "no-title";
      if (!textEl) return "no-text";
      function setVal(el, v) {
        const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      setVal(titleEl, title);
      setVal(textEl, body);
      return titleEl.value.length + ":" + textEl.value.length;
    },
    { title: item.title, body: item.body }
  );

  if (/^(no-title|no-text)/.test(filled)) {
    throw new Error(`could not fill the submit form (${filled})`);
  }

  const clicked = await page.evaluate(() => {
    const b = document.querySelector(
      '#newlink button[type="submit"], button[name="submit"], .btn[type="submit"]'
    );
    if (!b) return "no-button";
    b.click();
    return "clicked";
  });
  if (clicked !== "clicked") throw new Error(`could not submit (${clicked})`);

  // A successful submit navigates to the new post's comments page.
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    await sleep(1500);
    if (/\/comments\//.test(page.url())) return page.url();
  }
  throw new Error("submitted but never landed on a post page");
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

/**
 * Thrown when the queue API is unreachable. The scrape VPN tearing down can
 * leave the network broken for a minute or two right when the runner's guard
 * lets a tick through; that is a "try again next tick" condition, not a
 * failure worth an exit 1 and a red log line.
 */
class NetworkUnavailable extends Error {
  constructor(cause) {
    super(`queue API unreachable: ${cause}`);
    this.name = "NetworkUnavailable";
  }
}

async function fetchItem() {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/api/marketing/reddit/queue`, {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      });
      if (!res.ok) throw new Error(`queue GET failed: HTTP ${res.status}`);
      return res.json();
    } catch (err) {
      lastError = err;
      // HTTP errors are the server answering; only connection-level failures
      // (fetch failed / DNS / reset) are worth retrying.
      if (!(err instanceof TypeError)) throw err;
      if (attempt < 3) {
        log(`queue fetch failed (attempt ${attempt}/3) — retrying in 20s`);
        await sleep(20000);
      }
    }
  }
  throw new NetworkUnavailable(lastError?.cause?.message ?? lastError?.message);
}

async function reportResult(type, id, ok, url, error, permanent = false) {
  const res = await fetch(`${BASE_URL}/api/marketing/reddit/queue`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CRON_SECRET}`,
    },
    body: JSON.stringify({ type, id, ok, url, error, permanent }),
  });
  if (!res.ok) log(`WARNING: could not record result: HTTP ${res.status}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // --check verifies the browser side only: Chrome launches against the
  // posting profile and the profile is signed in as the right account. Run
  // this on the mini after setup — both are silent failure modes that
  // otherwise only surface as a mysteriously unposted queue.
  if (process.argv.includes("--check")) {
    const browser = await launchPostingBrowser();
    try {
      await preflight(browser.page);
      log(`profile target: r/u_${REDDIT_USERNAME ?? "(REDDIT_USERNAME not set!)"}`);
      log("check passed — posting browser is ready");
    } finally {
      await browser.close();
    }
    return;
  }

  if (!CRON_SECRET) {
    console.error("[poster] CRON_SECRET not set");
    process.exit(1);
  }

  let queue;
  try {
    queue = await fetchItem();
  } catch (err) {
    if (err instanceof NetworkUnavailable) {
      log(`${err.message} — deferring to next tick`);
      return;
    }
    throw err;
  }
  const { item, reason, waitSeconds } = queue;
  if (!item) {
    log(`nothing to post — ${reason ?? "queue empty"}${waitSeconds ? ` (${waitSeconds}s)` : ""}`);
    return;
  }

  log(`next: ${item.type} ${item.id}${item.subreddit ? ` r/${item.subreddit}` : ""}`);

  // Local mirror of the server's self-post spacing (3h apart). The server
  // rule lives in the queue API and only exists after that deploy reaches
  // production; this stamp file keeps a draft backlog from draining at poll
  // speed in the meantime, and is a harmless double-check afterwards.
  const SELFPOST_STAMP = path.join(os.homedir(), ".lucidrents", "last-selfpost");
  if (item.type === "selfpost" && !DRY_RUN) {
    try {
      const last = fs.statSync(SELFPOST_STAMP).mtimeMs;
      const gapMs = 3 * 60 * 60 * 1000;
      if (Date.now() - last < gapMs) {
        const mins = Math.ceil((gapMs - (Date.now() - last)) / 60000);
        log(`self-post gap (3h) not elapsed locally — deferring ~${mins} min`);
        return;
      }
    } catch {
      /* no stamp yet — free to post */
    }
  }

  if (DRY_RUN) {
    log(`title: ${item.title ?? "(reply)"}`);
    log(`body:\n${item.body}`);
    log("dry run — nothing posted");
    return;
  }

  const browser = await launchPostingBrowser();
  try {
    await preflight(browser.page);
    try {
      const url =
        item.type === "reply"
          ? await postReply(browser.page, item)
          : await postSelfPost(browser.page, item);
      log(`POSTED: ${url}`);
      if (item.type === "selfpost") {
        fs.writeFileSync(path.join(os.homedir(), ".lucidrents", "last-selfpost"), url);
      }
      await reportResult(item.type, item.id, true, url);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const permanent = err instanceof PermanentSkip;
      if (permanent) {
        // Retired, not failed: a dead thread would otherwise be served again
        // every run forever, and replies are served ahead of self-posts, so one
        // dead thread starves the whole queue behind it.
        log(`SKIPPED: ${message}`);
      } else {
        log(`FAILED: ${message}`);
      }
      await reportResult(item.type, item.id, false, null, message, permanent);
      process.exitCode = permanent ? 0 : 1;
    }
  } finally {
    await browser.close();
  }
}

const isCli = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (isCli) {
  main().catch((err) => {
    console.error(`[poster] fatal: ${err.stack || err.message}`);
    process.exit(1);
  });
}
