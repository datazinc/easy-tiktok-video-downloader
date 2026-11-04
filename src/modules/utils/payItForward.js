import { bindText } from "../i18n/index.js";

const SUPPORT_CLICK_KEY = "tik.tok::lastSupportedAt";

export function hasSupportCooldown(lastDonatedAt = 0, lastSupportedAt = 0) {
  let stored = 0;
  try { stored = Number(localStorage.getItem(SUPPORT_CLICK_KEY)) || 0; } catch {}
  const timestamps = [lastDonatedAt, lastSupportedAt, stored].map(Number).filter(value => Number.isFinite(value) && value > 0);
  const latest = timestamps.length ? Math.max(...timestamps) : 0;
  return latest > 0 && Date.now() - latest < 90 * 24 * 60 * 60 * 1000;
}

function rememberSupportClick() {
  const timestamp = Date.now();
  try { localStorage.setItem(SUPPORT_CLICK_KEY, String(timestamp)); } catch {}
  if (globalThis.AppStateETTVD?.rateDonate) globalThis.AppStateETTVD.rateDonate.lastSupportedAt = timestamp;
  try {
    if (globalThis.chrome?.runtime?.id && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: "recordSupportClick" }, () => { void chrome.runtime.lastError; });
    } else {
      window.postMessage({ type: "SUPPORT_CLICK_REQUEST" }, window.location.origin);
    }
  } catch {}
}

if (typeof window !== "undefined") window.addEventListener("message", event => {
  if (event.source !== window || event.data?.type !== "SUPPORT_CLICK_STATE") return;
  const timestamp = Number(event.data.timestamp);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return;
  try { localStorage.setItem(SUPPORT_CLICK_KEY, String(timestamp)); } catch {}
  if (globalThis.AppStateETTVD?.rateDonate) globalThis.AppStateETTVD.rateDonate.lastSupportedAt = timestamp;
});

export function showPayItForwardDialog({ dark = false } = {}) {
  const existing = document.getElementById("ettpd-pay-it-forward-dialog");
  if (existing) { existing.focus(); return existing; }
  const dialog = document.createElement("dialog");
  dialog.id = "ettpd-pay-it-forward-dialog";
  dialog.setAttribute("aria-labelledby", "ettpd-pay-it-forward-title");
  dialog.setAttribute("aria-describedby", "ettpd-pay-it-forward-message");
  Object.assign(dialog.style, {
    position: "fixed", inset: "0", margin: "auto", boxSizing: "border-box",
    width: "min(420px, calc(100vw - 32px))", maxHeight: "calc(100vh - 32px)",
    overflow: "auto", padding: "24px", borderRadius: "8px",
    border: dark ? "1px solid #444a53" : "1px solid #d5d9de",
    background: dark ? "#20242a" : "#ffffff", color: dark ? "#f2f4f6" : "#24282e",
    boxShadow: "0 12px 40px rgba(0,0,0,0.3)", fontFamily: "inherit",
  });
  const title = document.createElement("h2");
  title.id = "ettpd-pay-it-forward-title";
  bindText(title, "kindnessTitle");
  Object.assign(title.style, { fontSize: "20px", lineHeight: "1.3", margin: "0 0 16px" });
  const message = document.createElement("div");
  message.id = "ettpd-pay-it-forward-message";
  const introduction = document.createElement("p");
  bindText(introduction, "kindnessIntro");
  const invitation = document.createElement("p");
  bindText(invitation, "kindnessInvitation");
  for (const paragraph of [introduction, invitation]) {
    Object.assign(paragraph.style, { fontSize: "14px", lineHeight: "1.6", margin: "0 0 14px" });
    message.appendChild(paragraph);
  }
  const button = document.createElement("button");
  button.type = "button";
  bindText(button, "kindnessAccept");
  Object.assign(button.style, {
    padding: "9px 14px", borderRadius: "6px", border: "1px solid #54ddcc",
    background: "#54ddcc", color: "#102124", font: "inherit", fontSize: "14px",
    fontWeight: "600", cursor: "pointer",
  });
  button.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => dialog.remove());
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  dialog.append(title, message, button);
  document.body.appendChild(dialog);
  dialog.showModal();
  rememberSupportClick();
  return dialog;
}