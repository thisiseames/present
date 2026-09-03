// The current piece is a pure function of the clock.
// Nothing is stored; nothing "decides." The browser and the notifier both call this
// and get the same answer.

import { PIECES } from "./pieces.js";

// Local timezone the schedule is anchored to.
export const TZ = "America/Toronto";

// A new piece appears at the top of each of these local hours. 7am through 11pm.
export const SLOT_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

const EPOCH = Date.UTC(2025, 0, 1);

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic shuffle of [0..n-1] for a given cycle number.
function orderForCycle(n, cycle) {
  const rnd = mulberry32(cycle + 1);
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function localParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, hour: +p.hour };
}

function dayNumber({ y, m, d }) {
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000);
}

// Which global slot are we in right now? Before the first slot of the day, this is
// yesterday's last slot — so there is always a current piece.
export function currentSlotIndex(now = new Date()) {
  const lp = localParts(now);
  const passed = SLOT_HOURS.filter((h) => h <= lp.hour).length;
  let day = dayNumber(lp);
  let slotOfDay;
  if (passed === 0) {
    day -= 1;
    slotOfDay = SLOT_HOURS.length - 1;
  } else {
    slotOfDay = passed - 1;
  }
  return day * SLOT_HOURS.length + slotOfDay;
}

export function pieceForIndex(index) {
  const n = PIECES.length;
  const cycle = Math.floor(index / n);
  const pos = ((index % n) + n) % n;
  return PIECES[orderForCycle(n, cycle)[pos]];
}

export function currentPiece(now = new Date()) {
  return pieceForIndex(currentSlotIndex(now));
}

// True during any slot hour — the notifier uses this to decide whether to send.
export function inSlotHour(now = new Date()) {
  return SLOT_HOURS.includes(localParts(now).hour);
}
