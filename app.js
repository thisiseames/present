import { currentPiece, currentSlotIndex } from "./selection.js";
import { VAPID_PUBLIC_KEY } from "./config.js";

const pieceEl = document.getElementById("piece");
const enableBtn = document.getElementById("enable");
const handoff = document.getElementById("handoff");
const handoffJson = document.getElementById("handoff-json");

// ---- the piece on screen -------------------------------------------------

let shownIndex = null;

function render(force = false) {
  const index = currentSlotIndex();
  if (index === shownIndex && !force) return;
  shownIndex = index;

  const text = currentPiece();
  if (pieceEl.textContent && !force) {
    pieceEl.classList.remove("in");
    setTimeout(() => {
      pieceEl.textContent = text;
      requestAnimationFrame(() => pieceEl.classList.add("in"));
    }, 500);
  } else {
    pieceEl.textContent = text;
    requestAnimationFrame(() => pieceEl.classList.add("in"));
  }
}

render(true);
setInterval(() => render(), 20_000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) render();
});

// ---- service worker + notifications ------------------------------------

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function initServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("./sw.js");
  } catch {
    return null;
  }
}

async function refreshEnableButton(reg) {
  if (!reg || !("PushManager" in window) || Notification.permission === "denied") {
    enableBtn.hidden = true;
    return;
  }
  const existing = await reg.pushManager.getSubscription();
  enableBtn.hidden = !!existing;
}

async function enable(reg) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  if (VAPID_PUBLIC_KEY.startsWith("REPLACE_")) {
    alert("Set VAPID_PUBLIC_KEY in config.js first (npm run vapid).");
    return;
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  handoffJson.value = JSON.stringify(sub.toJSON()) + ",";
  handoff.hidden = false;
  enableBtn.hidden = true;
}

(async () => {
  const reg = await initServiceWorker();
  await refreshEnableButton(reg);

  enableBtn.addEventListener("click", () => reg && enable(reg));

  document.getElementById("handoff-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(handoffJson.value);
      document.getElementById("handoff-copy").textContent = "Copied";
    } catch {
      handoffJson.select();
    }
  });
  document.getElementById("handoff-close").addEventListener("click", () => {
    handoff.hidden = true;
  });

  navigator.serviceWorker?.addEventListener("message", (e) => {
    if (e.data?.type === "notification-click") render();
  });
})();
