#!/usr/bin/env node
/**
 * One-time setup for the Reddit posting profile.
 *
 * The poster (post-reddit-queue.mjs) drives its own Chrome instance against
 * ~/.lucidrents/chrome-posting-profile so it never touches the interactive
 * browser or collides with the rent scrapers. That profile needs a signed-in
 * Reddit session exactly once; cookies then persist and refresh on use.
 *
 * Two ways to get the session in:
 *
 *   node scripts/setup-reddit-profile.mjs
 *     Opens the posting browser at reddit's login page and waits for you to
 *     sign in as the posting account. Close nothing; the script detects the
 *     session and exits on its own.
 *
 *   node scripts/setup-reddit-profile.mjs --clone-session
 *     Copies the cookie store from the interactive Chrome's Default profile
 *     into the posting profile. Works because both run the same Chrome binary
 *     on the same machine, so the cookie encryption key (Keychain item
 *     "Chrome Safe Storage") is shared. Only Cookies and the key wrapper in
 *     "Local State" are copied — no history, passwords or autofill. Use this
 *     when the interactive Chrome is already signed in as the posting account
 *     and you are not at the machine to type a login.
 *
 * Either way the script finishes by verifying who the profile is signed in
 * as and comparing it to REDDIT_USERNAME.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  launchPostingBrowser,
  loggedInUser,
  PROFILE_DIR,
} from "./post-reddit-queue.mjs";

const CLONE = process.argv.includes("--clone-session");
const REAL_CHROME_DIR = path.join(os.homedir(), "Library/Application Support/Google/Chrome");

const log = (...a) => console.log("[setup]", ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cloneSession() {
  const srcCookies = path.join(REAL_CHROME_DIR, "Default", "Cookies");
  const srcLocalState = path.join(REAL_CHROME_DIR, "Local State");
  if (!fs.existsSync(srcCookies) || !fs.existsSync(srcLocalState)) {
    throw new Error(`interactive Chrome profile not found under ${REAL_CHROME_DIR}`);
  }
  fs.mkdirSync(path.join(PROFILE_DIR, "Default"), { recursive: true });
  fs.copyFileSync(srcLocalState, path.join(PROFILE_DIR, "Local State"));
  fs.copyFileSync(srcCookies, path.join(PROFILE_DIR, "Default", "Cookies"));
  // Chrome keeps the cookie DB in WAL mode; carry the journal over if present
  // so a checkpoint that has not flushed yet is not lost.
  for (const suffix of ["-wal", "-shm", "-journal"]) {
    const j = srcCookies + suffix;
    if (fs.existsSync(j)) fs.copyFileSync(j, path.join(PROFILE_DIR, "Default", "Cookies" + suffix));
  }
  log("cookie store cloned from the interactive Chrome profile");
}

async function main() {
  if (CLONE) cloneSession();

  const browser = await launchPostingBrowser();
  const { page } = browser;
  try {
    await page.goto("https://old.reddit.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
    let user = await loggedInUser(page);

    if (!user && CLONE) {
      throw new Error(
        "cloned cookies did not produce a session — run without --clone-session and sign in manually"
      );
    }

    if (!user) {
      log("not signed in yet — opening the login page.");
      log("Sign in as the posting account in the window that just opened; I'll wait (up to 10 min).");
      await page.goto("https://old.reddit.com/login", { waitUntil: "domcontentloaded" });
      const deadline = Date.now() + 10 * 60 * 1000;
      while (Date.now() < deadline && !user) {
        await sleep(5000);
        try {
          if (!/old\.reddit\.com/.test(page.url())) continue;
          user = await loggedInUser(page);
          if (!user) {
            // login redirects to the front page on success; re-check from there
            const u = await page.evaluate(() => location.pathname);
            if (u === "/") user = await loggedInUser(page);
          }
        } catch {
          /* mid-navigation */
        }
      }
      if (!user) throw new Error("timed out waiting for a login");
    }

    const want = process.env.REDDIT_USERNAME;
    if (want && user.toLowerCase() !== want.toLowerCase()) {
      throw new Error(`profile is signed in as ${user}, but REDDIT_USERNAME is ${want}`);
    }
    log(`posting profile ready — signed in as ${user}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("[setup] FAILED:", err.message);
  process.exit(1);
});
