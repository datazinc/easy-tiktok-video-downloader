import { readCatalogs, localeDirectory } from "./localization-fixtures.mjs";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import babel from "@babel/core";

const moduleAt = async relative => import(`data:text/javascript;base64,${Buffer.from(await readFile(new URL(relative, import.meta.url), "utf8")).toString("base64")}`);
const core = await moduleAt("../src/modules/i18n/core.js");
const catalogs = await readCatalogs();
const { summarizeResume } = await moduleAt("../src/modules/storage/resumeSummary.js");
const { DownloadRecovery } = await moduleAt("../src/modules/storage/downloadRecovery.js");
const runtimeSource = (await readFile(new URL("../src/modules/i18n/index.js", import.meta.url), "utf8"))
  .replace(/^import .*;\n/gm, "").replaceAll("export async function ", "async function ").replaceAll("export function ", "function ");

test("all requested catalogs are complete with identical, safe placeholders", () => {
  assert.deepEqual(Object.keys(catalogs).sort(), Object.keys(core.SUPPORTED_LOCALES).sort());
  const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [locale, messages] of Object.entries(catalogs)) {
    assert.deepEqual(Object.keys(messages).sort(), Object.keys(catalogs.en).sort(), locale);
    for (const [key, text] of Object.entries(messages)) {
      assert.equal(typeof text, "string", `${locale}.${key}`);
      assert.ok(text.trim().length, `${locale}.${key}`);
      assert.doesNotMatch(text, /<\/?(?:script|iframe|img)\b/i);
      assert.deepEqual(placeholders(text), placeholders(catalogs.en[key]), `${locale}.${key}`);
    }
  }
});

test("locale JSON has no duplicate IDs and production imports every supported catalog", async () => {
  for (const locale of Object.keys(catalogs)) {
    const source = await readFile(new URL(`${locale}.json`, localeDirectory), "utf8");
    const ast = babel.parseSync(`(${source})`, { configFile: false, babelrc: false });
    const properties = ast.program.body[0].expression.properties;
    const keys = properties.map(property => property.key.value);
    assert.equal(new Set(keys).size, keys.length, locale);
  }
  const source = await readFile(new URL("../src/modules/i18n/catalogs.js", import.meta.url), "utf8");
  const ast = babel.parseSync(source, { sourceType: "module", configFile: false, babelrc: false });
  const imported = ast.program.body.filter(statement => statement.type === "ImportDeclaration").map(statement => statement.source.value.split("/").at(-1).slice(0, -5));
  assert.deepEqual(imported.sort(), Object.keys(core.SUPPORTED_LOCALES).sort());
});

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.filter(entry => entry.name !== "js").map(async entry => {
    const file = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    return entry.isDirectory() ? sourceFiles(file) : entry.name.endsWith(".js") || entry.name.endsWith(".html") ? [file] : [];
  }))).flat();
}

test("all explicit UI message IDs and template-field help exist in the catalogs", async () => {
  const referenced = new Set();
  for (const file of await sourceFiles(new URL("../src/", import.meta.url))) {
    const source = await readFile(file, "utf8");
    if (file.pathname.endsWith(".js")) {
      const ast = babel.parseSync(source, { sourceType: "module", configFile: false, babelrc: false });
      babel.traverse(ast, { CallExpression(path) {
        const name = path.node.callee.name;
        const argument = name === "t" ? path.node.arguments[0] : ["bindText", "setLocalizedButton"].includes(name) ? path.node.arguments[1] : null;
        if (argument?.type === "StringLiteral") referenced.add(argument.value);
      } });
    }
    for (const match of source.matchAll(/data-i18n(?:-(?:title|aria-label|placeholder))?=["']([\w.-]+)["']/g)) referenced.add(match[1]);
  }
  for (const key of referenced) assert.ok(Object.hasOwn(catalogs.en, key), `Missing source message: ${key}`);
  const constants = await moduleAt("../src/modules/state/constants.js");
  for (const preset of constants.FILE_STORAGE_LOCATION_TEMPLATE_PRESETS) {
    assert.ok(Object.hasOwn(catalogs.en, preset.messageKey));
    assert.equal(typeof preset.label, "string");
    assert.ok(preset.template.includes("{"));
  }
  assert.ok(referenced.size > 150, "Source audit must cover the real UI");
});

test("every optional success message is authored per locale without English plural construction", async () => {
  const source = await readFile(new URL("../src/modules/utils/utils.js", import.meta.url), "utf8");
  const code = source.slice(source.indexOf("export function getRandomDownloadSuccessMessage("), source.indexOf("function shouldShowRateDonatePopup("))
    .replaceAll("export function ", "function ");
  for (const locale of Object.keys(catalogs)) {
    const context = vm.createContext({ t: (key, values) => core.formatMessage(catalogs, locale, key, values) });
    vm.runInContext(code, context);
    const message = vm.runInContext('getRandomDownloadSuccessMessage("image", 2)', context);
    assert.ok([1, 2, 3, 4].some(index => message === catalogs[locale][`jokeSaved${index}`]));
  }
});

test("explicit English wins; auto uses supported TikTok language then browser then English", () => {
  assert.equal(core.resolveLocale({ preference: "en", siteLanguage: "pt-BR", browserLanguages: ["ru"] }), "en");
  assert.equal(core.resolveLocale({ siteLanguage: "zh-Hans-CN", browserLanguages: ["en-US"] }), "zh-CN");
  for (const [language, expected] of [["en-GB", "en"], ["en-US", "en"], ["pt_BR", "pt-BR"], ["id-ID", "id"], ["de-DE", "de"], ["zh-TW", "en"]]) {
    assert.equal(core.resolveLocale({ browserLanguages: [language] }), expected);
  }
  assert.equal(core.resolveLocale({ siteLanguage: "unsupported", browserLanguages: ["zz", "fr-FR"] }), "fr");
  assert.equal(core.resolveLocale({ preference: "__proto__", siteLanguage: "es" }), "es");
});

test("formatter handles local numbers, word order, English fallback and missing parameters", () => {
  assert.equal(core.formatMessage(catalogs, "id", "downloadAll"), "Download semua");
  assert.equal(core.formatMessage(catalogs, "de", "number", { count: 1200 }), "1.200");
  assert.equal(core.formatMessage(catalogs, "ko", "progress", { current: 2, total: 8 }), "8개 중 2개 다운로드 중");
  assert.equal(core.formatMessage({ en: { value: "Saved: {count}" }, fr: {} }, "fr", "value", { count: 2 }), "Saved: 2");
  assert.throws(() => core.formatMessage(catalogs, "en", "progress", { current: 2 }), /Missing total/);
  assert.throws(() => core.formatMessage(catalogs, "en", "unknown-key"), /Unknown message/);
});

function runtimeFixture(extension = true) {
  const values = new Map();
  const callbacks = new Map();
  const listeners = { get: name => event => { for (const callback of [...(callbacks.get(name) || [])]) callback(event); } };
  let storageChanged;
  let observed;
  const root = { lang: "pt-BR" };
  const window = {
    addEventListener: (name, callback) => { if (!callbacks.has(name)) callbacks.set(name, new Set()); callbacks.get(name).add(callback); },
    removeEventListener: (name, callback) => callbacks.get(name)?.delete(callback),
  };
  const chrome = extension ? {
    runtime: { id: "extension" },
    storage: {
      local: { get: (key, callback) => callback({ [key]: values.get(key) }), set: (data, callback) => { for (const [key, value] of Object.entries(data)) values.set(key, value); callback(); } },
      onChanged: { addListener: callback => { storageChanged = callback; } },
    },
  } : undefined;
  const context = vm.createContext({
    ...core, catalogs, window, chrome, location: { hostname: extension ? "extension" : "www.tiktok.com", origin: "https://www.tiktok.com" },
    navigator: { languages: ["fr-FR"] }, document: { documentElement: root },
    localStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
    MutationObserver: class { constructor(callback) { observed = callback; } observe() {} },
    crypto: { randomUUID: () => "request-1" }, setTimeout, clearTimeout,
  });
  vm.runInContext(runtimeSource, context);
  return { context, root, chrome, values, window, listeners, change: value => storageChanged({ [core.LANGUAGE_KEY]: { newValue: value } }, "local"), siteChanged: () => observed() };
}

test("popup preference persists, broadcasts update labels, failed writes preserve previous choice", async () => {
  const setup = runtimeFixture();
  vm.runInContext("initializeI18n()", setup.context);
  await Promise.resolve();
  const element = { isConnected: true, textContent: "", setAttribute() {} };
  setup.context.element = element;
  vm.runInContext('bindText(element,"downloadAll")', setup.context);
  assert.equal(element.textContent, catalogs.fr.downloadAll);
  await vm.runInContext('setLanguage("en")', setup.context);
  assert.equal(element.textContent, "Download All");
  assert.equal(setup.values.get(core.LANGUAGE_KEY), "en");
  setup.change("id");
  assert.equal(element.textContent, "Download semua");
  setup.chrome.storage.local.set = (data, callback) => { setup.chrome.runtime.lastError = { message: "denied" }; callback(); delete setup.chrome.runtime.lastError; };
  await assert.rejects(vm.runInContext('setLanguage("ru")', setup.context), /denied/);
  assert.equal(element.textContent, "Download semua");
  await assert.rejects(vm.runInContext('setLanguage("bogus")', setup.context), /Unsupported/);
});

test("page bridge applies stored English and ignores messages from other windows", async () => {
  const setup = runtimeFixture(false);
  setup.window.postMessage = data => {
    const value = data.value ?? "en";
    setup.listeners.get("message")?.({ source: setup.window, data: { type: "ETTPD_LANGUAGE_RESPONSE", id: data.id, success: true, value } });
  };
  vm.runInContext("initializeI18n()", setup.context);
  await Promise.resolve();
  assert.equal(vm.runInContext("getLocale()", setup.context), "en");
  setup.listeners.get("message")({ source: {}, data: { type: "ETTPD_LANGUAGE_STATE", value: "ru" } });
  assert.equal(vm.runInContext("getLocale()", setup.context), "en");
  setup.listeners.get("message")({ source: setup.window, data: { type: "ETTPD_LANGUAGE_STATE", value: "de" } });
  assert.equal(vm.runInContext("getLocale()", setup.context), "de");
  await vm.runInContext('setLanguage("auto")', setup.context);
  assert.equal(vm.runInContext("getLocale()", setup.context), "pt-BR");
  setup.root.lang = "ko"; setup.siteChanged();
  assert.equal(vm.runInContext("getLocale()", setup.context), "ko");
});

test("cleared dynamic text stays empty after language changes without removing translated attributes", async () => {
  const setup = runtimeFixture();
  vm.runInContext("initializeI18n()", setup.context);
  await Promise.resolve();
  const attributes = new Map();
  setup.context.element = { isConnected: true, textContent: "", setAttribute: (key, value) => attributes.set(key, value) };
  vm.runInContext('bindText(element, "templatePreviewEmpty"); bindText(element, "templateTitle", {}, "title"); clearText(element)', setup.context);
  await vm.runInContext('setLanguage("id")', setup.context);
  assert.equal(setup.context.element.textContent, "");
  assert.equal(attributes.get("title"), catalogs.id.templateTitle);
  vm.runInContext('bindText(element, "templatePreview", {path:"@creator/123.mp4"})', setup.context);
  assert.equal(setup.context.element.textContent, core.formatMessage(catalogs, "id", "templatePreview", { path: "@creator/123.mp4" }));
});

test("resume summaries separate saved, skipped, failed, queued and uncertain saves", () => {
  const checkpoint = { completed: ["1"], skipped: ["2"], pending: ["3", "4", "5"], maxPosts: 10, finished: false };
  const chunk = { queue: [{ videoId: "3", key: "3:v", lastFailure: true, status: "pending" }, { videoId: "4", key: "4:v", status: "saved" }], saves: [{ key: "4:v", downloadId: 1 }] };
  assert.deepEqual(summarizeResume(checkpoint, chunk), { saved: 1, skipped: 1, pending: 1, failed: 1, unconfirmed: 1, remaining: null, maxPosts: 10, remainingLimit: 9 });
  assert.equal(summarizeResume({ ...checkpoint, maxPosts: null }).remainingLimit, null);
  assert.equal(summarizeResume({ ...checkpoint, finished: true }).remaining, 0);
  chunk.saves.push({ key: "3:v", downloadId: null });
  const uncertain = summarizeResume(checkpoint, chunk);
  assert.equal(uncertain.unconfirmed, 2);
  assert.equal(uncertain.failed, null);
});

test("only pre-save errors are counted as definite failures", async () => {
  for (const saveStarted of [false, true]) {
    const values = new Map();
    const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
    const recovery = new DownloadRecovery(() => storage);
    const media = { videoId: "123", authorId: "user", isImage: false, url: "https://example.org/video" };
    recovery.operation = { queue: [{ key: recovery.key(media, 0), videoId: "123", status: "pending" }], context: {}, refreshCount: 0 };
    await assert.rejects(recovery.file(media, {}, async () => { if (saveStarted) recovery.saveStarted("save"); throw new Error("failed"); }), /failed/);
    assert.equal(recovery.operation.queue[0].lastFailure, !saveStarted);
  }
});