#!/usr/bin/env node
/**
 * Reddit queue poster.
 *
 * Runs ON THE MAC MINI via launchd, because posting goes through the user's
 * logged-in Chrome rather than an API token — a Vercel cron has no browser to
 * drive. The mini is always on, so it owns the whole posting loop.
 *
 * Chrome is driven with AppleScript (`osascript`) rather than Playwright or
 * Puppeteer: those launch their own browser with no Reddit session, and their
 * automation fingerprint is exactly what Reddit blocks. AppleScript talks to
 * the real Chrome the user is already signed into.
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
 *   1. Chrome > View > Developer > Allow JavaScript from Apple Events
 *   2. Sign in to Reddit in Chrome as the posting account
 *   3. .env.local needs CRON_SECRET and REDDIT_USERNAME
 *
 * Usage:
 *   node scripts/post-reddit-queue.mjs             # post one queued item
 *   node scripts/post-reddit-queue.mjs --dry-run   # show what it would post
 */

import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
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
// Chrome via AppleScript
// ---------------------------------------------------------------------------

/** Runs AppleScript and returns stdout. */
async function osa(script) {
  const { stdout } = await execFileAsync("osascript", ["-e", script], {
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.trim();
}

function esc(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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

class AppleEventsJSDisabled extends Error {
  constructor() {
    super(
      "Chrome refused to run JavaScript from Apple Events.\n" +
        "        Fix on the mini: Chrome menu > View > Developer > tick 'Allow JavaScript from Apple Events'.\n" +
        "        (If the Developer submenu is hidden, it appears once you open DevTools once.)"
    );
    this.name = "AppleEventsJSDisabled";
  }
}

/** Evaluates JS in the frontmost Chrome tab and returns the result as a string. */
async function evalInTab(js) {
  // The JS is wrapped so a thrown page error comes back as text rather than an
  // AppleScript failure with no detail.
  const wrapped = `(function(){try{return String(${js});}catch(e){return "ERR:"+e.message;}})()`;
  try {
    return await osa(
      `tell application "Google Chrome" to execute javascript "${esc(wrapped)}" in active tab of front window`
    );
  } catch (err) {
    // -1723 is Chrome's "Access not allowed" for Apple Events JS. It is the
    // single most likely setup failure, so name it rather than surfacing a
    // raw osascript stack trace.
    if (/-1723|Access not allowed/i.test(String(err?.message ?? err))) {
      throw new AppleEventsJSDisabled();
    }
    throw err;
  }
}

async function openUrl(url) {
  await osa(
    `tell application "Google Chrome"
       if (count of windows) = 0 then make new window
       set URL of active tab of front window to "${esc(url)}"
     end tell`
  );
}

/** Waits for document.readyState complete, up to timeoutMs. */
async function waitForLoad(timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(700);
    try {
      if ((await evalInTab("document.readyState")) === "complete") return true;
    } catch {
      // Chrome can be mid-navigation; keep waiting.
    }
  }
  return false;
}

async function currentUrl() {
  return osa(`tell application "Google Chrome" to return URL of active tab of front window`);
}

/** Confirms Chrome is reachable and Apple Events JS is enabled. */
async function preflight() {
  try {
    await osa(`tell application "Google Chrome" to return name`);
  } catch {
    throw new Error("Chrome is not running or not scriptable");
  }
  await openUrl("https://old.reddit.com/");
  await waitForLoad();

  const probe = await evalInTab("1+1");
  if (probe !== "2") {
    throw new Error(`Chrome returned an unexpected probe result: ${probe}`);
  }

  const user = await evalInTab(
    `(document.querySelector('#header-bottom-right .user a')||{}).textContent||""`
  );
  if (!user || /^ERR:/.test(user)) {
    throw new Error("Not signed in to Reddit in Chrome (old.reddit shows no user)");
  }

  // REDDIT_USERNAME does NOT choose the posting account — replies post as
  // whoever Chrome is signed in as, and REDDIT_USERNAME only builds the
  // self-post target r/u_<name>. If the two disagree, replies silently go out
  // under the wrong account and self-posts aim at a profile this session
  // cannot submit to. Refuse to post rather than guess which one is right.
  if (REDDIT_USERNAME && user.toLowerCase() !== REDDIT_USERNAME.toLowerCase()) {
    throw new Error(
      `Chrome is signed in as ${user} but REDDIT_USERNAME is ${REDDIT_USERNAME}.\n` +
        "        Sign Chrome in as the posting account, or correct REDDIT_USERNAME in .env.local."
    );
  }
  if (!REDDIT_USERNAME) {
    log(`WARNING: REDDIT_USERNAME is not set — cannot verify the posting account`);
  }

  log(`Chrome ready, signed in as ${user}`);
  return user;
}

// ---------------------------------------------------------------------------
// Posting
// ---------------------------------------------------------------------------

/** Posts a top-level comment on a thread. */
async function postReply(item) {
  const url = item.url.replace("www.reddit.com", "old.reddit.com");
  await openUrl(url);
  if (!(await waitForLoad())) throw new Error("thread page did not finish loading");

  // A thread can die between the scanner finding it and this run: the OP
  // deletes it, a mod removes it, or it locks/archives. Old Reddit still
  // renders a reply box on a deleted thread, so without this check the post
  // "succeeds" and leaves a promotional comment on a dead thread that nobody
  // can see. These never become postable, so they are retired rather than
  // retried forever.
  const state = await evalInTab(`(function(){
    var link = document.querySelector('#siteTable .thing.link');
    if(!link) return 'missing';
    if(document.querySelector('.archived-infobar')) return 'archived';
    if(document.querySelector('.locked-infobar')) return 'locked';
    if((link.className||'').indexOf('locked') !== -1) return 'locked';
    var author = link.querySelector('.author');
    if(!author || author.textContent.trim() === '[deleted]') return 'deleted';
    var body = link.querySelector('.usertext-body');
    var text = body ? body.textContent.trim() : '';
    if(text === '[deleted]' || text === '[removed]') return 'deleted';
    return 'ok';
  })()`);
  if (state !== "ok") {
    throw new PermanentSkip(`thread is ${state} — retiring it, nothing was posted`);
  }

  // The top-level reply box is the first .usertext form outside the comment tree.
  const filled = await evalInTab(`(function(){
    var f = document.querySelector('.commentarea > .usertext form, form.usertext');
    if(!f) return 'no-form';
    var ta = f.querySelector('textarea[name="text"]');
    if(!ta) return 'no-textarea';
    var setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;
    setter.call(ta, ${JSON.stringify(item.body)});
    ta.dispatchEvent(new Event('input',{bubbles:true}));
    return ta.value.length;
  })()`);

  if (filled === "no-form" || filled === "no-textarea" || /^ERR:/.test(filled)) {
    throw new Error(`could not find the reply box (${filled})`);
  }
  if (Number(filled) < 20) throw new Error(`reply box only took ${filled} chars`);

  const clicked = await evalInTab(`(function(){
    var f = document.querySelector('.commentarea > .usertext form, form.usertext');
    var b = f && f.querySelector('button[type="submit"], .save');
    if(!b) return 'no-button';
    b.click();
    return 'clicked';
  })()`);
  if (clicked !== "clicked") throw new Error(`could not submit (${clicked})`);

  // Reddit renders the new comment in place; wait for it to appear.
  await sleep(6000);
  const confirmed = await evalInTab(`(function(){
    var snippet = ${JSON.stringify(item.body.slice(0, 60))};
    return document.body.innerText.indexOf(snippet) !== -1 ? 'yes' : 'no';
  })()`);
  if (confirmed !== "yes") {
    throw new Error("submitted but the comment did not appear on the page");
  }

  return await currentUrl();
}

/** Submits a self-post to our own profile (r/u_<username> on old Reddit). */
async function postSelfPost(item) {
  if (!REDDIT_USERNAME) throw new Error("REDDIT_USERNAME not set");

  const submitUrl = `https://old.reddit.com/r/u_${encodeURIComponent(REDDIT_USERNAME)}/submit?selftext=true`;
  await openUrl(submitUrl);
  if (!(await waitForLoad())) throw new Error("submit page did not finish loading");

  const filled = await evalInTab(`(function(){
    var title = document.querySelector('textarea[name="title"], input[name="title"]');
    var text  = document.querySelector('textarea[name="text"]');
    if(!title) return 'no-title';
    if(!text) return 'no-text';
    function setVal(el,v){
      var proto = el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto,'value').set.call(el,v);
      el.dispatchEvent(new Event('input',{bubbles:true}));
    }
    setVal(title, ${JSON.stringify(item.title)});
    setVal(text, ${JSON.stringify(item.body)});
    return title.value.length + ':' + text.value.length;
  })()`);

  if (/^(no-title|no-text|ERR:)/.test(filled)) {
    throw new Error(`could not fill the submit form (${filled})`);
  }

  const clicked = await evalInTab(`(function(){
    var b = document.querySelector('#newlink button[type="submit"], button[name="submit"], .btn[type="submit"]');
    if(!b) return 'no-button';
    b.click();
    return 'clicked';
  })()`);
  if (clicked !== "clicked") throw new Error(`could not submit (${clicked})`);

  // A successful submit navigates to the new post's comments page.
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    await sleep(1500);
    const u = await currentUrl();
    if (/\/comments\//.test(u)) return u;
  }
  throw new Error("submitted but never landed on a post page");
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

async function fetchItem() {
  const res = await fetch(`${BASE_URL}/api/marketing/reddit/queue`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  if (!res.ok) throw new Error(`queue GET failed: HTTP ${res.status}`);
  return res.json();
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
  // --check verifies the Chrome side only: scriptable, Apple Events JS
  // enabled, and signed in. Run this on the mini before installing the job —
  // all three are silent failure modes that otherwise only surface as a
  // mysteriously unposted queue.
  if (process.argv.includes("--check")) {
    await preflight();
    log(`profile target: r/u_${REDDIT_USERNAME ?? "(REDDIT_USERNAME not set!)"}`);
    log("check passed — Chrome is ready to post");
    return;
  }

  if (!CRON_SECRET) {
    console.error("[poster] CRON_SECRET not set");
    process.exit(1);
  }

  const { item, reason, waitSeconds } = await fetchItem();
  if (!item) {
    log(`nothing to post — ${reason ?? "queue empty"}${waitSeconds ? ` (${waitSeconds}s)` : ""}`);
    return;
  }

  log(`next: ${item.type} ${item.id}${item.subreddit ? ` r/${item.subreddit}` : ""}`);

  if (DRY_RUN) {
    log(`title: ${item.title ?? "(reply)"}`);
    log(`body:\n${item.body}`);
    log("dry run — nothing posted");
    return;
  }

  await preflight();

  try {
    const url =
      item.type === "reply" ? await postReply(item) : await postSelfPost(item);
    log(`POSTED: ${url}`);
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
    process.exit(permanent ? 0 : 1);
  }
}

main().catch((err) => {
  console.error(`[poster] fatal: ${err.stack || err.message}`);
  process.exit(1);
});
