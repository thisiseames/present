// Runs on a schedule (GitHub Actions). Figures out the current piece from the clock
// and pushes it to every registered device. Idempotent: it records the last slot it
// sent and won't send the same one twice.

import { readFileSync, writeFileSync } from "node:fs";
import webpush from "web-push";
import { currentSlotIndex, pieceForIndex, inSlotHour } from "../selection.js";

const root = new URL("../", import.meta.url);
const subsPath = new URL("subscriptions.json", root);
const statePath = new URL("state.json", root);
const force = process.argv.includes("--force");

const now = new Date();
if (!inSlotHour(now) && !force) {
  console.log("Outside the 7am–midnight window. Nothing to send.");
  process.exit(0);
}

const index = currentSlotIndex(now);

let state = { lastIndex: null };
try {
  state = JSON.parse(readFileSync(statePath, "utf8"));
} catch {}
if (state.lastIndex === index && !force) {
  console.log(`Slot ${index} already sent.`);
  process.exit(0);
}

let subs = [];
try {
  subs = JSON.parse(readFileSync(subsPath, "utf8"));
} catch {}
if (!Array.isArray(subs) || subs.length === 0) {
  console.log("No subscriptions registered yet.");
  writeFileSync(statePath, JSON.stringify({ lastIndex: index, at: now.toISOString() }, null, 2) + "\n");
  process.exit(0);
}

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error("Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.");
  process.exit(1);
}
webpush.setVapidDetails(VAPID_SUBJECT || "mailto:present@localhost", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const payload = JSON.stringify({ body: pieceForIndex(index) });

let sent = 0;
const dead = new Set();
for (const sub of subs) {
  try {
    await webpush.sendNotification(sub, payload);
    sent++;
  } catch (err) {
    console.error(`push failed (${err?.statusCode ?? "?"})`);
    if (err?.statusCode === 404 || err?.statusCode === 410) dead.add(sub.endpoint);
  }
}
console.log(`Sent ${sent}/${subs.length} for slot ${index}.`);

if (dead.size) {
  writeFileSync(subsPath, JSON.stringify(subs.filter((s) => !dead.has(s.endpoint)), null, 2) + "\n");
}
writeFileSync(statePath, JSON.stringify({ lastIndex: index, at: now.toISOString() }, null, 2) + "\n");
