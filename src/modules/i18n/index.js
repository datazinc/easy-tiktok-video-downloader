import { catalogs } from "./catalogs.js";
import { LANGUAGE_KEY, SUPPORTED_LOCALES, resolveLocale, formatMessage } from "./core.js";

let preference = "auto";
let initialized = false;
const bindings = new Set();
const elementBindings = new WeakMap();
const collectedBindings = new FinalizationRegistry(binding => bindings.delete(binding));
const subscribers = new Set();

function siteLanguage() {
  if (!/(^|\.)tiktok\.com$/.test(globalThis.location?.hostname || "")) return null;
  return document.documentElement.lang || window.__$UNIVERSAL_DATA$__?.__DEFAULT_SCOPE__?.["webapp.app-context"]?.language;
}

export function getLocale() {
  return resolveLocale({ preference, siteLanguage: siteLanguage(), browserLanguages: globalThis.navigator?.languages || [globalThis.navigator?.language] });
}

export function t(key, values = {}) {
  return formatMessage(catalogs, getLocale(), key, values);
}

export function bindText(element, key, values = {}, attribute = null) {
  const owned = elementBindings.get(element) || new Map();
  const previous = owned.get(attribute);
  if (previous) { bindings.delete(previous); collectedBindings.unregister(previous); }
  const binding = { element: new WeakRef(element), key, values, attribute };
  owned.set(attribute, binding); elementBindings.set(element, owned);
  bindings.add(binding);
  collectedBindings.register(element, binding, binding);
  renderBinding(binding);
  return element;
}

export function clearText(element) {
  const owned = elementBindings.get(element);
  const binding = owned?.get(null);
  if (binding) {
    bindings.delete(binding);
    collectedBindings.unregister(binding);
    owned.delete(null);
  }
  element.textContent = "";
}

function renderBinding({ element: reference, key, values, attribute }) {
  const element = reference.deref();
  if (!element) return;
  const text = t(key, typeof values === "function" ? values() : values);
  if (attribute) element.setAttribute(attribute, text);
  else element.textContent = text;
  element.lang = getLocale();
}

function refresh() {
  for (const binding of bindings) {
    if (!binding.element.deref()?.isConnected) { bindings.delete(binding); collectedBindings.unregister(binding); }
    else renderBinding(binding);
  }
  for (const callback of subscribers) callback();
}

export function onLanguageChange(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

function adopt(value) {
  if (value !== "auto" && !Object.hasOwn(SUPPORTED_LOCALES, value)) return;
  preference = value;
  try { localStorage.setItem(LANGUAGE_KEY, value); } catch {}
  refresh();
}

function storageRequest(value) {
  if (globalThis.chrome?.runtime?.id) {
    return new Promise((resolve, reject) => {
      const done = result => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(value === undefined ? result?.[LANGUAGE_KEY] || "auto" : value);
      };
      if (value === undefined) chrome.storage.local.get(LANGUAGE_KEY, done);
      else chrome.storage.local.set({ [LANGUAGE_KEY]: value }, done);
    });
  }
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const finish = event => {
      if (event.source !== window || event.data?.type !== "ETTPD_LANGUAGE_RESPONSE" || event.data.id !== id) return;
      clearTimeout(timer); window.removeEventListener("message", finish);
      if (event.data.success) resolve(event.data.value);
      else reject(new Error("Language storage unavailable"));
    };
    const timer = setTimeout(() => { window.removeEventListener("message", finish); reject(new Error("Language storage timeout")); }, 5000);
    window.addEventListener("message", finish);
    window.postMessage({ type: "ETTPD_LANGUAGE_REQUEST", id, value }, location.origin);
  });
}

export async function setLanguage(value) {
  if (value !== "auto" && !Object.hasOwn(SUPPORTED_LOCALES, value)) throw new Error("Unsupported locale");
  const stored = await storageRequest(value);
  adopt(stored);
}

export function initializeI18n() {
  if (initialized) return;
  initialized = true;
  try { adopt(localStorage.getItem(LANGUAGE_KEY) || "auto"); } catch {}
  window.addEventListener("message", event => {
    if (event.source === window && event.data?.type === "ETTPD_LANGUAGE_STATE") adopt(event.data.value);
  });
  if (globalThis.chrome?.runtime?.id) chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[LANGUAGE_KEY]) adopt(changes[LANGUAGE_KEY].newValue || "auto");
  });
  window.addEventListener("languagechange", refresh);
  new MutationObserver(() => { if (preference === "auto") refresh(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  void storageRequest().then(adopt).catch(() => {});
}

export function localizeMarkup(root = document) {
  for (const element of root.querySelectorAll("[data-i18n]")) bindText(element, element.dataset.i18n);
  for (const attribute of ["placeholder", "title", "aria-label"]) {
    for (const element of root.querySelectorAll(`[data-i18n-${attribute}]`)) bindText(element, element.getAttribute(`data-i18n-${attribute}`), {}, attribute);
  }
}

export function createLanguageControl(className = "", { getTheme = () => document.documentElement.classList.contains("theme-dark") ? "dark" : "classic" } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `${className} ettpd-language-button`;
  button.textContent = "🌐";
  button.setAttribute("aria-haspopup", "dialog");
  bindText(button, "language", {}, "title");
  bindText(button, "language", {}, "aria-label");
  button.addEventListener("click", event => {
    event.preventDefault(); event.stopPropagation();
    const existing = document.getElementById("ettpd-language-dialog");
    if (existing) { existing.focus(); return; }
    const dialog = document.createElement("dialog");
    dialog.id = "ettpd-language-dialog";
    dialog.className = `ettpd-modal-overlay ettpd-language-dialog ${getTheme() === "dark" ? "ettpd-theme-dark" : "ettpd-theme-classic"}`;
    const container = document.createElement("div");
    container.className = "ettpd-modal-box-container";
    const box = document.createElement("div");
    box.className = "ettpd-modal-box";
    const heading = document.createElement("h3");
    heading.id = "ettpd-language-heading";
    heading.className = "ettpd-modal-title";
    bindText(heading, "language");
    dialog.setAttribute("aria-labelledby", heading.id);
    const select = document.createElement("select");
    select.className = "ettpd-select";
    bindText(select, "language", {}, "aria-label");
    const auto = document.createElement("option"); auto.value = "auto"; bindText(auto, "auto"); select.append(auto);
    for (const [code, name] of Object.entries(SUPPORTED_LOCALES)) {
      const option = document.createElement("option"); option.value = code; option.textContent = name; option.lang = code; select.append(option);
    }
    select.value = preference;
    const unsubscribe = onLanguageChange(() => { select.value = preference; dialog.lang = getLocale(); });
    dialog.lang = getLocale();
    const status = document.createElement("p"); status.setAttribute("role", "status");
    status.className = "ettpd-modal-message";
    status.hidden = true;
    select.onchange = async () => {
      select.disabled = true;
      try { await setLanguage(select.value); clearText(status); status.hidden = true; }
      catch { select.value = preference; bindText(status, "storageError"); status.hidden = false; }
      finally { select.disabled = false; }
    };
    const close = document.createElement("button"); close.type = "button"; bindText(close, "close");
    close.className = "ettpd-modal-button secondary";
    close.onclick = () => dialog.close();
    const actions = document.createElement("div");
    actions.className = "ettpd-modal-actions";
    actions.append(close);
    box.append(heading, select, status, actions);
    container.append(box);
    dialog.append(container);
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => { unsubscribe(); dialog.remove(); button.focus(); });
    document.body.append(dialog); dialog.showModal(); select.focus();
  });
  return button;
}