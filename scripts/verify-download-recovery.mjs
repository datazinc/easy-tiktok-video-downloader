import { readCatalogs } from "./localization-fixtures.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const moduleSource = await readFile(new URL("../src/modules/storage/downloadRecovery.js", import.meta.url), "utf8");
const { DownloadRecovery, RECOVERY_KEY, RECOVERY_TTL_MS } = await import(
  `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`
);
const utils = await readFile(new URL("../src/modules/utils/utils.js", import.meta.url), "utf8");
const background = await readFile(new URL("../src/background/background.js", import.meta.url), "utf8");
const uiSource = await readFile(new URL("../src/modules/downloader/ui.js", import.meta.url), "utf8");
const dramaSource = await readFile(new URL("../src/modules/utils/shortDrama.js", import.meta.url), "utf8");
const shortDrama = await import(`data:text/javascript;base64,${Buffer.from(dramaSource).toString("base64")}`);
const collectionSource = await readFile(new URL("../src/modules/utils/collection.js", import.meta.url), "utf8");
const collections = await import(`data:text/javascript;base64,${Buffer.from(collectionSource).toString("base64")}`);
const progressiveSource = await readFile(new URL("../src/modules/storage/progressiveBatch.js", import.meta.url), "utf8");
const { ProgressiveBatch } = await import(`data:text/javascript;base64,${Buffer.from(progressiveSource).toString("base64")}`);
const accountSource = await readFile(new URL("../src/modules/utils/accountLists.js", import.meta.url), "utf8");
const accountLists = await import(`data:text/javascript;base64,${Buffer.from(accountSource).toString("base64")}`);
const catalogs = await readCatalogs();
const coreSource = await readFile(new URL("../src/modules/i18n/core.js", import.meta.url), "utf8");
const { formatMessage } = await import(`data:text/javascript;base64,${Buffer.from(coreSource).toString("base64")}`);
const summarySource = await readFile(new URL("../src/modules/storage/resumeSummary.js", import.meta.url), "utf8");
const { summarizeResume } = await import(`data:text/javascript;base64,${Buffer.from(summarySource).toString("base64")}`);
const t = (key, values = {}) => formatMessage(catalogs, "en", key, values);
const bindText = (element, key, values = {}, attribute = null) => {
  const text = t(key, typeof values === "function" ? values() : values);
  if (attribute) element.setAttribute(attribute, text); else element.textContent = text;
  return element;
};

const constantsSource = await readFile(new URL("../src/modules/state/constants.js", import.meta.url), "utf8");
const { FILE_STORAGE_LOCATION_TEMPLATE_PRESETS, DOWNLOAD_FOLDER_DEFAULT, STORAGE_KEYS } = await import(`data:text/javascript;base64,${Buffer.from(constantsSource).toString("base64")}`);

test("first-run and factory-reset defaults enable HD and open the downloader while preserving explicit choices", async () => {
  const source = (await readFile(new URL("../src/modules/state/state.js", import.meta.url), "utf8"))
    .replace(/^import[\s\S]*?from "\.\/constants.js";\n/m, "")
    .replaceAll("export function ", "function ").replace("export default AppState;", "");
  const storage = new Map();
  const load = () => {
    const context = vm.createContext({
      STORAGE_KEYS, FILE_STORAGE_LOCATION_TEMPLATE_PRESETS, window: {},
      localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, String(value)),
        removeItem: key => storage.delete(key),
      },
      console: { log() {}, warn() {} },
    });
    vm.runInContext(source, context);
    return { context, state: vm.runInContext("AppState", context) };
  };
  const fresh = load();
  assert.equal(fresh.state.downloadPreferences.experimentalHd, true);
  assert.equal(fresh.state.ui.isDownloaderClosed, false);
  assert.equal(fresh.state.ui.downloaderPositionType, "bottom-left");
  storage.set(STORAGE_KEYS.EXPERIMENTAL_HD, "false");
  storage.set(STORAGE_KEYS.IS_DOWNLOADER_CLOSED, "true");
  storage.set(STORAGE_KEYS.DOWNLOADER_POSITION_TYPE, "top-right");
  storage.set(STORAGE_KEYS.DOWNLOADER_CUSTOM_POSITION, JSON.stringify({ left: 200, top: 100 }));
  storage.set(STORAGE_KEYS.SHOW_BUTTON_POSITION, JSON.stringify({ left: 400, top: 300 }));
  const existing = load();
  assert.equal(existing.state.downloadPreferences.experimentalHd, false);
  assert.equal(existing.state.ui.isDownloaderClosed, true);
  assert.equal(existing.state.ui.downloaderPositionType, "top-right");
  vm.runInContext("resetAppStateToDefaults()", existing.context);
  assert.equal(existing.state.downloadPreferences.experimentalHd, true);
  assert.equal(existing.state.ui.isDownloaderClosed, false);
  assert.equal(existing.state.ui.isScrapperBoxOpen, false);
  assert.equal(storage.has(STORAGE_KEYS.IS_DOWNLOADER_CLOSED), false);
  assert.equal(storage.has(STORAGE_KEYS.EXPERIMENTAL_HD), false);
  assert.equal(storage.has(STORAGE_KEYS.DOWNLOADER_POSITION_TYPE), false);
  assert.equal(storage.has(STORAGE_KEYS.DOWNLOADER_CUSTOM_POSITION), false);
  assert.equal(storage.has(STORAGE_KEYS.SHOW_BUTTON_POSITION), false);
  const reloaded = load();
  assert.equal(reloaded.state.downloadPreferences.experimentalHd, true);
  assert.equal(reloaded.state.ui.isDownloaderClosed, false);
  assert.equal(reloaded.state.ui.downloaderPositionType, "bottom-left");
});

test("Open button clicks do not save a location; real drags persist and stale saves are cancelled", () => {
  const setup = progressFixture();
  const button = setup.button;
  const storage = new Map(), documentListeners = new Map(), windowListeners = new Map(), timers = new Map();
  let nextTimer = 0;
  button.getBoundingClientRect = () => ({ left: parseFloat(button.style.left) || 20, top: parseFloat(button.style.top) || 700, width: 140, height: 40 });
  const document = { body: { style: {} }, addEventListener: (name, callback) => documentListeners.set(name, callback), removeEventListener: name => documentListeners.delete(name) };
  const window = { innerWidth: 1200, innerHeight: 800, addEventListener: (name, callback) => windowListeners.set(name, callback), removeEventListener: name => windowListeners.delete(name) };
  Object.assign(setup.context, {
    button, window, document, STORAGE_KEYS,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    setTimeout: callback => { const id = ++nextTimer; timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id),
  });
  const helper = uiSource.slice(uiSource.indexOf("function readStoredPosition("), uiSource.indexOf("function templateDisplayName("));
  const drag = uiSource.slice(uiSource.indexOf("function makeShowButtonDraggable("), uiSource.indexOf("// Function to reset show button position"));
  vm.runInContext(helper + drag + "makeShowButtonDraggable(button)", setup.context);
  button.listeners.get("mousedown")({ clientX: 30, clientY: 710 });
  documentListeners.get("mouseup")();
  assert.equal(storage.has(STORAGE_KEYS.SHOW_BUTTON_POSITION), false);
  button.listeners.get("mousedown")({ clientX: 30, clientY: 710 });
  documentListeners.get("mousemove")({ clientX: 300, clientY: 300 });
  documentListeners.get("mouseup")();
  assert.deepEqual(JSON.parse(storage.get(STORAGE_KEYS.SHOW_BUTTON_POSITION)), { left: 290, top: 290 });
  button.listeners.get("mousedown")({ clientX: 300, clientY: 300 });
  documentListeners.get("mousemove")({ clientX: 600, clientY: 400 });
  const saved = storage.get(STORAGE_KEYS.SHOW_BUTTON_POSITION);
  button._cleanupDraggable();
  for (const callback of [...timers.values()]) callback();
  assert.equal(storage.get(STORAGE_KEYS.SHOW_BUTTON_POSITION), saved, "Removed button must not overwrite saved position later");
  assert.equal(documentListeners.size, 0);
  assert.equal(windowListeners.size, 0);
});

test("panel positions change only during a real drag and all document handlers are removed on close", () => {
  const setup = progressFixture();
  const storage = new Map(), documentListeners = new Map(), windowListeners = new Map();
  const wrapper = setup.button;
  const handle = setup.context.document.createElement("div");
  wrapper.getBoundingClientRect = () => ({ left: parseFloat(wrapper.style.left) || 300, top: parseFloat(wrapper.style.top) || 150, width: 400, height: 200 });
  wrapper._setCornerValue = () => {};
  setup.state.ui = { isDragging: false, downloaderPositionType: "top-right", live_ETTPD_CUSTOM_POS: '{"left":5,"top":5}' };
  Object.assign(setup.context, {
    wrapper, handle, STORAGE_KEYS,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    window: { innerWidth: 1200, innerHeight: 800, addEventListener: (name, callback) => windowListeners.set(name, callback), removeEventListener: name => windowListeners.delete(name) },
    document: { body: { style: {} }, addEventListener: (name, callback) => documentListeners.set(name, callback), removeEventListener: name => documentListeners.delete(name) },
    constrainWrapperToViewport: () => ({ left: parseFloat(wrapper.style.left) || 300, top: parseFloat(wrapper.style.top) || 150 }),
    console: { log() {} },
  });
  const source = uiSource.slice(uiSource.indexOf("function makeElementDraggable("), uiSource.indexOf("function makeShowButtonDraggable("));
  vm.runInContext(source + "makeElementDraggable(wrapper,handle)", setup.context);
  documentListeners.get("mousemove")({ clientX: 500, clientY: 400 });
  documentListeners.get("mouseup")();
  assert.equal(storage.size, 0, "Ordinary page events must not overwrite pinned locations");
  assert.equal(setup.state.ui.downloaderPositionType, "top-right");
  handle.listeners.get("mousedown")({ clientX: 310, clientY: 160 });
  documentListeners.get("mouseup")();
  assert.equal(storage.size, 0, "Clicking the handle is not a custom drag");
  handle.listeners.get("mousedown")({ clientX: 310, clientY: 160 });
  documentListeners.get("mousemove")({ clientX: 510, clientY: 360 });
  documentListeners.get("mouseup")();
  assert.equal(storage.get(STORAGE_KEYS.DOWNLOADER_POSITION_TYPE), "custom");
  assert.deepEqual(JSON.parse(storage.get(STORAGE_KEYS.DOWNLOADER_CUSTOM_POSITION)), { left: 500, top: 350 });
  wrapper._cleanupDraggable();
  assert.equal(documentListeners.size, 0);
  assert.equal(windowListeners.size, 0);
});

test("saved positions reject malformed coordinates and reset Open to bottom-left", () => {
  const setup = progressFixture();
  const storage = new Map([[STORAGE_KEYS.SHOW_BUTTON_POSITION, '{"left":400,"top":300}']]);
  Object.assign(setup.context, { STORAGE_KEYS, button: setup.button, DOM_IDS: { SHOW_DOWNLOADER: "button" }, localStorage: { removeItem: key => storage.delete(key) }, document: { getElementById: () => setup.button } });
  const helper = uiSource.slice(uiSource.indexOf("function readStoredPosition("), uiSource.indexOf("function templateDisplayName("));
  const reset = uiSource.slice(uiSource.indexOf("export function resetShowButtonPosition()"), uiSource.indexOf("export function hideDownloader()"))
    .replace("export function ", "function ");
  vm.runInContext(helper + reset, setup.context);
  for (const value of ['not-json', 'null', '{"left":"400","top":300}', '{"left":20}', '{"left":null,"top":0}']) {
    setup.context.value = value;
    assert.equal(vm.runInContext("readStoredPosition(value)", setup.context), null);
  }
  vm.runInContext("resetShowButtonPosition()", setup.context);
  assert.equal(storage.has(STORAGE_KEYS.SHOW_BUTTON_POSITION), false);
  assert.equal(setup.button.style.left, "20px");
  assert.equal(setup.button.style.bottom, "50px");
  assert.equal(setup.button.style.right, "auto");
  assert.equal(setup.button.style.top, "auto");
});

test("factory reset feedback resolves and replaces stale downloader and closed-shortcut controls", async () => {
  const preferences = uiSource.slice(uiSource.indexOf("export function createPreferencesBox()"), uiSource.indexOf("export function createSettingsToggle("));
  const handler = preferences.slice(preferences.indexOf("resetBtn.onclick = async"), preferences.indexOf("  // 🧹 Clear List button"));
  const feedback = preferences.slice(preferences.indexOf("  function showFeedback(text)"), preferences.indexOf("  // Checkbox generator"));
  const timers = [];
  let renders = 0;
  let removed = 0;
  let cleaned = 0;
  let discoveries = 0;
  const state = { ui: { isDownloaderClosed: true, isPreferenceBoxOpen: true, isScrapperBoxOpen: true }, downloadPreferences: { experimentalHd: false } };
  const context = vm.createContext({
    AppState: state, resetBtn: {}, t,
    resetAppStateToDefaults: () => { state.ui.isDownloaderClosed = false; state.downloadPreferences.experimentalHd = true; },
    preferencesBox: { appendChild() {} }, feedbackContainer: { remove() {} },
    replaceElementHtml() {}, escapeHtml: value => value,
    setTimeout: callback => { timers.push(callback); },
    displayFoundUrls: () => { renders += 1; },
    pollInitialData: () => { discoveries += 1; },
    DOM_IDS: { DOWNLOADER_WRAPPER: "wrapper", SHOW_DOWNLOADER: "shortcut" },
    document: { getElementById: () => ({ remove: () => { removed += 1; }, _cleanupDraggable: () => { cleaned += 1; } }) },
  });
  vm.runInContext(feedback + handler, context);
  const reset = vm.runInContext("resetBtn.onclick({stopPropagation(){}})", context);
  assert.equal(removed, 0);
  timers.shift()();
  timers.shift()();
  await reset;
  assert.equal(removed, 2);
  assert.equal(cleaned, 2);
  assert.equal(discoveries, 1);
  assert.equal(renders, 2);
  assert.equal(state.ui.isDownloaderClosed, false);
  assert.equal(state.ui.isPreferenceBoxOpen, false);
  assert.equal(state.ui.isScrapperBoxOpen, false);
  assert.equal(state.downloadPreferences.experimentalHd, true);
});

function filenameFixture(preset = FILE_STORAGE_LOCATION_TEMPLATE_PRESETS[0]) {
  const state = {
    downloadPreferences: { fullPathTemplate: preset },
    scrapperDetails: { selectedTab: "liked", selectedCollectionName: "Summer of Sports", isAutoBatchDownloading: false },
    downloading: { accountBatch: { scope: "liked:profile-owner" } },
  };
  const context = vm.createContext({
    AppState: state, DOWNLOAD_FOLDER_DEFAULT, Date, TextEncoder,
    getDefaultPresetTemplate: () => FILE_STORAGE_LOCATION_TEMPLATE_PRESETS.find(preset => preset.isDefault),
    getCurrentPageUsername: () => "profile-owner",
    toTitleCase: value => String(value).replace(/\b\w/g, char => char.toUpperCase()),
    console: { error: error => { throw error; } },
  });
  const code = utils.slice(utils.indexOf("export function getDownloadFilePath("), utils.indexOf("function getHttpUrls("))
    .replaceAll("export function ", "function ").replaceAll("export const ", "const ");
  vm.runInContext(code, context);
  return { state, context, render: (media, options = {}) => {
    context.media = media; context.options = options;
    return vm.runInContext("getDownloadFilePath(media,options)", context);
  } };
}

const filenameMedia = {
  videoId: "7394627756635573022", authorId: "actual.author", authorNickname: "Actual Author",
  createTime: new Date(2025, 7, 14, 1, 10), desc: "A useful clip #fun", musicTitle: "Chill Vibes", musicAuthor: "DJ Flow",
  hashtags: [{ name: "fun" }, { name: "relax" }], qualityLabel: "HD", isImage: false, isAd: false,
};

test("every filename preset renders safe video paths and distinct photo filenames", () => {
  for (const preset of FILE_STORAGE_LOCATION_TEMPLATE_PRESETS) {
    const setup = filenameFixture(preset);
    const video = setup.render(filenameMedia);
    assert.ok(video.endsWith(".mp4"), preset.label);
    assert.doesNotMatch(video, /[{}<>:"\\|?*\x00-\x1F]/, preset.label);
    assert.ok(!video.startsWith("/") && !video.includes("//"), preset.label);
    const photos = [0, 1, 2].map(imageIndex => setup.render({ ...filenameMedia, isImage: true, imagePostImages: ["a", "b", "c"] }, { imageIndex }));
    assert.ok(photos.every(filename => filename.endsWith(".jpeg")), preset.label);
    assert.equal(new Set(photos).size, 3, `${preset.label}: photo names must not collide`);
  }
});

test("recommended paths preserve selected profile/list folders in progressive batches", () => {
  const setup = filenameFixture();
  for (const [tab, folder] of [["liked", "Liked"], ["reposts", "Reposts"], ["favorites", "Favorites"], ["collection", "Collections/Summer-of-Sports"]]) {
    setup.state.scrapperDetails.selectedTab = tab;
    const filename = setup.render(filenameMedia);
    assert.ok(filename.startsWith(`${DOWNLOAD_FOLDER_DEFAULT}/@profile-owner/${folder}/`), filename);
    assert.match(filename, /actual\.author.*3022-HD\.mp4$/);
  }
});

test("default, missing fields, dotted stems, reserved names, and Unicode paths remain valid", () => {
  const setup = filenameFixture();
  setup.state.downloadPreferences.fullPathTemplate = null;
  assert.ok(setup.render(filenameMedia).endsWith(".mp4"));
  for (const preset of FILE_STORAGE_LOCATION_TEMPLATE_PRESETS) {
    setup.state.downloadPreferences.fullPathTemplate = preset;
    const filename = setup.render({ videoId: "123" });
    assert.doesNotMatch(filename, /[{}<>:"\\|?*\x00-\x1F]|missing-|:profile:/, preset.label);
    const unicode = setup.render({ ...filenameMedia, desc: "測試".repeat(150), musicTitle: "音樂".repeat(100), musicAuthor: "CON" });
    for (const segment of unicode.split("/")) assert.ok(Buffer.byteLength(segment, "utf8") <= 255, `${preset.label}: oversized segment`);
  }
  setup.state.downloadPreferences.fullPathTemplate = { template: "files/post.v1.mp4" };
  assert.equal(setup.render(filenameMedia), "files/post.v1.mp4");
  setup.state.downloadPreferences.fullPathTemplate = { template: "CON.mp4" };
  assert.equal(setup.render(filenameMedia), "CON-file.mp4");
  setup.state.downloadPreferences.fullPathTemplate = FILE_STORAGE_LOCATION_TEMPLATE_PRESETS.find(preset => preset.isRecommended);
  assert.ok(setup.render({ authorId: "user" }).endsWith("no-id-SD.mp4"));
  const descriptive = FILE_STORAGE_LOCATION_TEMPLATE_PRESETS.find(preset => preset.template.startsWith("desc_clips/"));
  assert.ok(setup.render({ ...filenameMedia, desc: "測試".repeat(150) }, { options: { template: descriptive.template } }).endsWith(`${filenameMedia.videoId}.mp4`));
});

test("template previews and browser transport use the same path without mutating saved presets", () => {
  const setup = filenameFixture();
  const savedPreset = setup.state.downloadPreferences.fullPathTemplate;
  const bridgeStart = utils.indexOf("export function sendBasicBlobDownloadRequest(");
  const bridge = utils.slice(bridgeStart, utils.indexOf("\nexport ", bridgeStart + 1)).replace("export function ", "function ");
  let posted;
  setup.context.window = { postMessage: message => { posted = message; } };
  vm.runInContext(bridge, setup.context);
  for (const preset of FILE_STORAGE_LOCATION_TEMPLATE_PRESETS) {
    const filename = setup.render({ ...filenameMedia, desc: "測試-".repeat(150), musicTitle: "CON.txt" }, { options: { template: preset.template } });
    setup.context.filename = filename;
    assert.equal(vm.runInContext("sanitizeDownloadFilename(filename)", setup.context), filename, preset.label);
    vm.runInContext("sendBasicBlobDownloadRequest({filename})", setup.context);
    assert.equal(posted.payload.filename, filename, preset.label);
    assert.equal(setup.state.downloadPreferences.fullPathTemplate, savedPreset);
  }
  setup.state.scrapperDetails.selectedTab = "collection";
  const legacy = FILE_STORAGE_LOCATION_TEMPLATE_PRESETS.find(preset => preset.isDefault);
  assert.ok(!setup.render(filenameMedia, { options: { template: legacy.template } }).includes("/"));
  assert.equal(setup.render(filenameMedia, { options: { template: "files/post.v1" } }), "files/post.v1.mp4");
});

function fixture() {
  const values = new Map();
  let now = 1000;
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const create = () => new DownloadRecovery(() => storage, () => now);
  return {
    recovery: create(), create, values, storage,
    advance: amount => { now += amount; },
    context: {
      url: "https://www.tiktok.com/explore",
      preferences: { experimentalHd: false, fullPathTemplate: { template: "{videoId}.mp4" } },
      scrapperDetails: { selectedTab: "favorites", selectedCollectionName: "Saved", paused: false },
    },
  };
}

async function checkpoint(fixture, statuses = [{ id: 7, state: "complete" }]) {
  const { recovery, context } = fixture;
  await recovery.run([{ videoId: "123" }, { videoId: "456" }], { kind: "playlist" }, context, async () => {
    await recovery.file({ videoId: "123" }, {}, async () => {
      recovery.saveStarted("saved");
      recovery.saveResponded("saved", { success: true, downloadId: 7 });
      return true;
    });
    await recovery.file({ videoId: "456" }, {}, async () => {
      recovery.filename("remaining.mp4");
      await recovery.prepareRefresh(async () => statuses, false);
    });
  });
  return recovery.read(context.url);
}

test("checkpoint retains remaining queue, settings, filenames, and one spent refresh", async () => {
  const setup = fixture();
  const saved = await checkpoint(setup);
  assert.equal(saved.refreshCount, 1);
  assert.equal(saved.kind, "playlist");
  assert.equal(saved.queue[0].status, "complete");
  assert.equal(saved.queue[1].status, "pending");
  assert.equal(saved.queue[1].filename, "remaining.mp4");
  assert.deepEqual(saved.context, setup.context);
  const restored = setup.create();
  restored.adopt(saved);
  await restored.file({ videoId: "456" }, {}, async () => {
    assert.equal(restored.canRefresh(), false);
    await assert.rejects(restored.prepareRefresh(async () => [], false));
  });
});

test("pending and missing browser save records block refresh", async () => {
  for (const statuses of [[{ id: 7, state: "in_progress" }], []]) {
    const setup = fixture();
    await assert.rejects(checkpoint(setup, statuses), /still saving|unknown/);
    assert.equal(setup.values.has(RECOVERY_KEY), false);
  }
});

test("interrupted save is retried, never counted complete", async () => {
  const saved = await checkpoint(fixture(), [{ id: 7, state: "interrupted" }]);
  assert.equal(saved.queue[0].status, "pending");
});

test("partial photo posts checkpoint individual image indexes and omit media URLs", async () => {
  const setup = fixture();
  const media = { videoId: "123", isImage: true, imagePostImages: ["blob:one", "https://cdn/two?signature=secret"] };
  await setup.recovery.run([media], { kind: "images" }, setup.context, async () => {
    await setup.recovery.file(media, { imageIndex: 0 }, async () => {
      setup.recovery.saveStarted("photo");
      setup.recovery.saveResponded("photo", { success: true, downloadId: 9 });
      return true;
    });
    await setup.recovery.file(media, { imageIndex: 1 }, async () => {
      await setup.recovery.prepareRefresh(async () => [{ id: 9, state: "complete" }], true);
    });
  });
  const saved = setup.recovery.read(setup.context.url);
  assert.deepEqual(saved.queue.map(entry => [entry.imageIndex, entry.status]), [[0, "complete"], [1, "pending"]]);
  assert.equal(saved.paused, true);
  assert.doesNotMatch(setup.values.get(RECOVERY_KEY), /blob:|signature=|https:\/\/cdn/);
});

test("fresh checkpoint is not restored on unrelated pages and expires after 30 minutes", async () => {
  const setup = fixture();
  await checkpoint(setup);
  assert.equal(setup.recovery.read("https://www.tiktok.com/@other"), null);
  setup.advance(RECOVERY_TTL_MS + 1);
  assert.equal(setup.recovery.read(setup.context.url), null);
  assert.equal(setup.values.has(RECOVERY_KEY), false);
});

test("second reload retains newly saved files and requires explicit resume", async () => {
  const setup = fixture();
  const saved = await checkpoint(setup);
  const resumed = setup.create();
  resumed.adopt(saved);
  await resumed.file({ videoId: "456" }, {}, async () => {
    resumed.saveStarted("second");
    resumed.saveResponded("second", { success: true, downloadId: 8 });
    return true;
  });
  const next = setup.create();
  const pending = next.read(setup.context.url);
  assert.equal(pending.phase, "paused");
  assert.equal(pending.refreshCount, 1);
  next.adopt(pending);
  next.operation.queue = await next.confirmSaves(async () => [{ id: 8, state: "complete" }]);
  let called = false;
  await next.file({ videoId: "456" }, {}, async () => { called = true; });
  assert.equal(called, false);
});

test("uncertain native-save outcome blocks refresh", async () => {
  const setup = fixture();
  await setup.recovery.run([{ videoId: "123" }], {}, setup.context, async () => {
    await setup.recovery.file({ videoId: "123" }, {}, async () => {
      setup.recovery.saveStarted("timeout");
      setup.recovery.saveResponded("timeout", { success: false });
      assert.equal(setup.recovery.canRefresh(), false);
    });
  });
});

test("storage failures do not consume the in-memory budget or reload", async () => {
  const setup = fixture();
  setup.storage.setItem = () => { throw new Error("Quota exceeded"); };
  await setup.recovery.run([{ videoId: "123" }], {}, setup.context, async () => {
    await setup.recovery.file({ videoId: "123" }, {}, async () => {
      await assert.rejects(setup.recovery.prepareRefresh(async () => [], false), /Quota/);
      assert.equal(setup.recovery.operation.refreshCount, 0);
    });
  });
});

test("cached muxed sources are tried before hydration; unavailable metadata is logged", async () => {
  const code = utils.slice(utils.indexOf("const fallbackVideoHydrations"), utils.indexOf("export async function downloadSingleMedia("));
  for (const cached of [true, false]) {
    let hydrated = 0;
    const logs = [];
    const context = vm.createContext({
      AppState: { allItemsEverSeen: {}, allDirectLinks: cached ? [{ videoId: "123", videoSources: [
        { url: "https://cdn/silent", audioStatus: "video-only" },
        { url: "https://cdn/muxed", audioStatus: "muxed" },
      ] }] : [] },
      AbortSignal,
      hydrateTikTokVideoDetail: async () => { hydrated += 1; return null; },
      buildVideoLinkMeta: () => null,
      downloadURLToDisk: async url => assert.equal(url, "https://cdn/muxed"),
      console: { warn: message => logs.push(message) },
    });
    vm.runInContext(code, context);
    const result = await vm.runInContext('recoverFailedVideoDownload({videoId:"123"},{url:"blob:bad"},new Set(),"file.mp4",null,{code:"ERR_BLOB_FETCH"})', context);
    assert.equal(result, cached);
    assert.equal(hydrated, cached ? 0 : 1);
    assert.ok(logs.some(message => message.includes(cached ? "fallback-fix-applied" : "fallback-fix-metadata-unavailable")));
  }
});

test("resume skips confirmed files and pauses for explicit decisions when metadata still fails", async () => {
  const setup = fixture();
  const saved = await checkpoint(setup);
  const recovery = setup.create();
  recovery.adopt(saved);
  const source = utils.slice(utils.indexOf("async function resumeDownloadCheckpoint("), utils.indexOf("function escapeHtml("));
  const state = {
    downloadPreferences: {}, scrapperDetails: {}, ui: {}, downloading: {},
    allItemsEverSeen: {}, leaderboard: { newlyConfirmedMedia: [] }, displayedState: {},
  };
  let hydrationCount = 0;
  let dialogs = 0;
  let downloads = 0;
  const actions = ["retry-file", "skip-file"];
  const context = vm.createContext({
    AppState: state, downloadRecovery: recovery, AbortSignal,
    getDownloadStatuses: async () => [],
    displayFoundUrls() {}, isExtensionEnabledSync: () => true,
    document: { getElementById: () => ({}) }, DOM_IDS: { DOWNLOAD_ALL_BUTTON: "button" },
    hydrateTikTokVideoDetail: async () => { hydrationCount += 1; return null; },
    buildVideoLinkMeta: () => null,
    downloadSingleMedia: async () => { downloads += 1; },
    updateDownloadButtonLabel() {}, updateDownloadButtonLabelSimple() {},
    updateBatchDownloadProgress() {}, updateAllTimeDownloadsAndLeaderBoard() {},
    showDownloadFailureModal: async () => {
      dialogs += 1;
      assert.equal(state.downloading.pausedAll, true);
      assert.equal(recovery.canRefresh(), false);
      return actions.shift();
    },
    isStopBatchError: () => false,
    DOWNLOAD_ACTION_CODES: { skipFile: "ERR_SKIP_FILE", manualSave: "ERR_FALLBACK_MANUAL" },
    showAlertModal: async () => { assert.fail("Unexpected status alert"); },
    console: { warn() {} },
    checkpoint: saved,
  });
  vm.runInContext(source, context);
  await vm.runInContext("resumeDownloadCheckpoint(checkpoint)", context);
  assert.equal(hydrationCount, 2);
  assert.equal(dialogs, 2);
  assert.equal(downloads, 0);
  assert.equal(state.downloading.isDownloadingAll, false);
  assert.equal(setup.values.has(RECOVERY_KEY), false);
});

test("startup consumes automatic resume once, then requires explicit resume after interruption", async () => {
  const setup = fixture();
  const saved = await checkpoint(setup);
  const source = utils.slice(utils.indexOf("export function restoreDownloadRecovery("), utils.indexOf("async function resumeDownloadCheckpoint("))
    .replace("export function ", "function ");
  const scheduled = [];
  const context = vm.createContext({
    window: { location: { href: setup.context.url } },
    downloadRecovery: setup.create(),
    setTimeout: callback => scheduled.push(callback),
    resumeDownloadCheckpoint() {},
  });
  vm.runInContext(source, context);
  assert.equal(vm.runInContext("restoreDownloadRecovery()", context), true);
  assert.equal(scheduled.length, 1);
  const afterReload = setup.create().read(setup.context.url);
  assert.equal(afterReload.phase, "paused");
  assert.equal(afterReload.refreshCount, saved.refreshCount);
});

test("dismissal while statuses are being checked cancels checkpoint creation", async () => {
  const setup = fixture();
  await setup.recovery.run([{ videoId: "123" }], {}, setup.context, async () => {
    await setup.recovery.file({ videoId: "123" }, {}, async () => {
      await assert.rejects(setup.recovery.prepareRefresh(async () => [], false, () => true), /canceled/);
      assert.equal(setup.recovery.operation.refreshCount, 0);
      assert.equal(setup.values.has(RECOVERY_KEY), false);
    });
  });
});

test("overlapping downloads keep refresh unsafe until all files settle", async () => {
  const setup = fixture();
  let release;
  let second;
  await setup.recovery.run([{ videoId: "123" }, { videoId: "456" }], {}, setup.context, async () => {
    await setup.recovery.file({ videoId: "123" }, {}, async () => {
      second = setup.recovery.file({ videoId: "456" }, {}, () => new Promise(resolve => { release = resolve; }));
      assert.equal(setup.recovery.canRefresh(), false);
    });
  });
  assert.equal(setup.recovery.operation.unsafe, true);
  assert.equal(setup.recovery.runningFiles, 1);
  release();
  await second;
  assert.equal(setup.recovery.operation, null);
  assert.equal(setup.recovery.runningFiles, 0);
});

test("browser status bridge validates requests and hides other extensions' download status", async () => {
  const source = background.slice(background.indexOf('  if (action === "getDownloadStatuses")'), background.indexOf('  if (action === "openBraveDownloadSettings")'));
  for (const valid of [true, false]) {
    let finish;
    const result = new Promise(resolve => { finish = resolve; });
    let queries = 0;
    const context = vm.createContext({
      action: "getDownloadStatuses",
      message: { downloadIds: valid ? [1, 2, 1] : ["invalid"] },
      sender: { id: "extension" }, KEEP_ALIVE: true, finish,
      makeError: (code, error) => ({ success: false, code, error }),
      chrome: {
        runtime: { id: "extension" },
        downloads: { search: ({ id }, callback) => {
          queries += 1;
          callback([{ state: "complete", byExtensionId: id === 1 ? "extension" : "other" }]);
        } },
      },
    });
    vm.runInContext(`(() => {${source}})()`, context);
    const response = await result;
    assert.equal(response.success, valid);
    assert.equal(queries, valid ? 2 : 0);
    if (valid) assert.equal(response.statuses[1].state, "unknown");
  }
});

test("successful original downloads do not invoke recovery or show a dialog", async () => {
  const source = utils.slice(utils.indexOf("export async function downloadURLToDisk("), utils.indexOf("export function displayFoundUrls("))
    .replace("export async function ", "async function ");
  const events = [];
  const context = vm.createContext({
    downloadRecovery: { filename() {}, saveStarted() {}, saveResponded() {} },
    AppState: { ui: {}, debug: { active: false }, downloading: {}, downloadPreferences: {} },
    uuid: () => "request", detectBrowserType: () => "chrome", displayFoundUrls() {},
    fetch: async () => ({ ok: true, headers: { get: () => null }, blob: async () => ({ size: 8 }) }),
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
    postBlobDownloadRequest: () => events.push("save"),
    waitForBlobDownloadResponse: async () => ({ success: true, downloadId: 1 }),
    showDownloadFailureModal: () => assert.fail("Unexpected failure dialog"),
    options: { recoverAfterFailure: () => assert.fail("Unexpected fallback") },
    console: { warn() {}, error() {} },
  });
  vm.runInContext(source, context);
  assert.equal(await vm.runInContext('downloadURLToDisk("https://cdn/video","file.mp4",options)', context), true);
  assert.deepEqual(events, ["save"]);
  assert.deepEqual(Array.from(context.AppState.ui.reviewPendingDownloadIds), [1]);
  assert.equal(context.AppState.ui.reviewHasConfirmedDownload, undefined, "Accepted save requests are not completion evidence");
});

test("pending resumed files bypass old skip-downloaded history without changing the preference", async () => {
  const source = utils.slice(utils.indexOf("async function downloadSingleMediaAttempt("), utils.indexOf("async function prepareBatchMediaForDownload("));
  let saved = 0;
  const state = { scrapperDetails: { skipDownloaded: true }, downloading: { isDownloadingAll: true }, debug: {} };
  const context = vm.createContext({
    AppState: state,
    getCurrentPageUsername: () => "user", detectCurrentTabName: () => "videos",
    hasVideoId: async () => { assert.fail("Must not skip an interrupted checkpoint file"); },
    getDownloadFilePath: () => "file.mp4", appendVideoId: async () => {},
    downloadURLToDisk: async () => { saved += 1; },
    console: { log() {}, warn() {}, error() {} },
  });
  vm.runInContext(source, context);
  assert.equal(await vm.runInContext('downloadSingleMediaAttempt({videoId:"123",url:"https://cdn/video"},{recoveryResume:true})', context), true);
  assert.equal(saved, 1);
  assert.equal(state.scrapperDetails.skipDownloaded, true);
});

function progressFixture() {
  class Element {
    constructor() {
      this.children = [];
      this.style = {};
      this.dataset = {};
      this.attributes = new Map();
      this.className = "";
      this.listeners = new Map();
      this.isConnected = true;
      this.classList = {
        add: value => this.classList.toggle(value, true),
        remove: value => this.classList.toggle(value, false),
        toggle: (value, enabled) => {
          const classes = new Set(this.className.split(" ").filter(Boolean));
          if (enabled) classes.add(value); else classes.delete(value);
          this.className = [...classes].join(" ");
        },
      };
    }
    set textContent(value) { this.text = value; this.children = []; }
    get textContent() { return this.text || this.children.map(child => child.textContent).join(""); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    removeAttribute(name) { this.attributes.delete(name); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
    insertBefore(child, reference) { child.parentElement = this; const index = this.children.indexOf(reference); this.children.splice(index < 0 ? this.children.length : index, 0, child); return child; }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    replaceChildren(...children) { this.children = []; this.text = ""; children.forEach(child => this.appendChild(child)); }
    get firstElementChild() { return this.children[0]; }
    querySelector(selector) {
      for (const child of this.children) {
        if (selector.startsWith("#") ? child.id === selector.slice(1)
          : selector.startsWith(".") ? child.className.split(" ").includes(selector.slice(1))
            : child.tagName === selector.toUpperCase()) return child;
        const nested = child.querySelector(selector);
        if (nested) return nested;
      }
      return null;
    }
    closest(selector) { return this.parentElement?.id === selector.slice(1) ? this.parentElement : null; }
  }
  const container = new Element();
  container.id = "batch-container";
  const button = new Element();
  button.id = "batch";
  const pause = new Element();
  pause.id = "batch-pause";
  const stop = new Element();
  stop.id = "batch-stop";
  container.appendChild(button);
  container.appendChild(pause);
  container.appendChild(stop);
  const state = {
    debug: { active: false }, ui: {},
    downloading: { isDownloadingAll: true, pausedAll: false },
    allDirectLinks: Array.from({ length: 8 }, () => ({})), downloadedURLs: [],
    scrapperDetails: { scrappingStage: "completed", selectedTab: null },
  };
  const code = uiSource.slice(uiSource.indexOf("export function updateBatchDownloadProgress("), uiSource.indexOf("export function updateDownloadButtonLabelSimple("))
    .replaceAll("export function ", "function ");
  const context = vm.createContext({
    AppState: state, DOM_IDS: { DOWNLOAD_ALL_BUTTON: "batch" },
    t, bindText, clearText: element => { element.textContent = ""; }, getLocale: () => "en", summarizeResume, ProgressiveBatch,
    sessionStorage: fixture().storage,
    setLocalizedButton: (element, key, icon, values = {}) => { element.textContent = t(key, values); },
    document: { getElementById: () => button, createElement: tag => Object.assign(new Element(), { tagName: tag.toUpperCase() }) },
    setButtonWithIcon: (element, text) => { element.textContent = text; },
    getActiveDownloadBatchType: () => "all", schedulePlaylistHeaderSync() {},
  });
  vm.runInContext(code, context);
  vm.runInContext(uiSource.slice(uiSource.indexOf("function renderResumeSummary("), uiSource.indexOf("const CHROME_EXTENSION_REVIEW_URL")), context);
  return { state, button, pause, stop, context,
    update: status => {
      context.status = status;
      vm.runInContext("updateBatchDownloadProgress(status)", context);
    },
    finish: () => vm.runInContext('updateDownloadButtonLabel(null,"Downloaded 8 posts")', context),
  };
}

test("batch button reports bytes and phases, animates unknown totals, and removes stale controls on completion", () => {
  const test = progressFixture();
  test.update({ batchTotal: 8, batchIndex: 3, settled: 2, phase: "fetch", progress: null });
  assert.match(test.button.textContent, /Downloading 3 of 8/);
  assert.match(test.button.querySelector(".ettpd-batch-progress-fill").className, /is-indeterminate/);
  assert.equal(test.button.querySelector(".ettpd-batch-progress-track").getAttribute("aria-valuenow"), null);
  test.update({ phase: "fetch", progress: 0.5, loaded: 1048576, total: 2097152 });
  assert.match(test.button.textContent, /50%.*1.0 \/ 2.0 MB/);
  assert.equal(test.button.querySelector(".ettpd-batch-progress-track").getAttribute("aria-valuenow"), "31");
  test.update({ phase: "save", progress: 0 });
  assert.match(test.button.textContent, /Saving file/);
  assert.doesNotMatch(test.button.textContent, /MB/);
  test.update({ phase: "fetch", progress: 1 });
  const beforeMux = Number(test.button.querySelector(".ettpd-batch-progress-track").getAttribute("aria-valuenow"));
  test.update({ phase: "mux", progress: 0 });
  assert.ok(Number(test.button.querySelector(".ettpd-batch-progress-track").getAttribute("aria-valuenow")) >= beforeMux);
  test.state.downloading.pausedAll = true;
  test.update({});
  assert.match(test.button.textContent, /Pause requested/);
  assert.equal(test.pause.textContent, t("resume"));
  test.state.downloading.accountBatch = { paused: true };
  test.state.downloading.pausedAll = false;
  test.update({});
  assert.equal(test.pause.textContent, t("resume"));
  test.update({ phase: "paused", progress: null });
  assert.match(test.button.textContent, /Paused at 3 of 8/);
  assert.doesNotMatch(test.button.querySelector(".ettpd-batch-progress-fill").className, /is-indeterminate/);
  test.state.downloading.isDownloadingAll = false;
  test.finish();
  assert.equal(test.button.textContent, "Downloaded 8 posts");
  assert.equal(test.pause.style.display, "none");
  assert.equal(test.stop.style.display, "none");
  assert.equal(test.pause.disabled, true);
  assert.equal(test.stop.disabled, true);
  assert.doesNotMatch(test.button.className, /ettpd-batch-progress/);
  assert.equal(test.button.getAttribute("aria-busy"), null);
});

test("one HD indicator survives all phases and standard fallback without percentages or restarted bars", () => {
  const setup = progressFixture();
  const code = uiSource.slice(uiSource.indexOf("function updateExperimentalHdProgress("), uiSource.indexOf("async function runExperimentalHdDownload("));
  vm.runInContext(code, setup.context);
  setup.context.status = { phase: "prepare", progress: null, quality: "hd" };
  vm.runInContext("updateExperimentalHdProgress(document.getElementById('batch'),status)", setup.context);
  const track = setup.button.querySelector(".ettpd-hd-progress-track");
  const fill = track.firstElementChild;
  for (const status of [
    { phase: "fetch", progress: 0.3 }, { phase: "fetch", progress: 1 },
    { phase: "mux", progress: 0 }, { phase: "mux", progress: 1 },
    { phase: "fallback", progress: null, quality: "standard" },
    { phase: "fetch", progress: 0 }, { phase: "fetch", progress: 1 },
    { phase: "save", progress: 0 }, { phase: "save", progress: 1 },
  ]) {
    setup.context.status = status;
    vm.runInContext("updateExperimentalHdProgress(document.getElementById('batch'),status)", setup.context);
    assert.equal(setup.button.querySelector(".ettpd-hd-progress-track"), track);
    assert.equal(track.firstElementChild, fill);
    assert.match(fill.className, /is-indeterminate/);
    assert.doesNotMatch(setup.button.textContent, /\d+%/);
    assert.equal(track.getAttribute("aria-valuenow"), null);
  }
  assert.equal(setup.button.dataset.hdFallback, "true");
  assert.equal(setup.button.textContent, t("save"));
});

test("HD batch progress counts completed posts and never restarts across transfer phases", () => {
  const setup = progressFixture();
  setup.update({ batchTotal: 8, batchIndex: 3, settled: 2, phase: "prepare", progress: null, experimentalHd: true });
  const track = setup.button.querySelector(".ettpd-batch-progress-track");
  const width = track.firstElementChild.style.width;
  for (const [phase, progress] of [["fetch", 1], ["mux", 0], ["mux", 1], ["fallback", null], ["fetch", 0], ["fetch", 1], ["save", 0], ["save", 1]]) {
    setup.update({ phase, progress, experimentalHd: true });
    assert.equal(setup.button.querySelector(".ettpd-batch-progress-track"), track);
    assert.equal(track.firstElementChild.style.width, width);
    assert.doesNotMatch(setup.button.textContent, /\d+%/);
    assert.doesNotMatch(track.firstElementChild.className, /is-indeterminate/);
  }
  setup.update({ batchIndex: 4, settled: 3, phase: "prepare", progress: null });
  assert.ok(parseFloat(track.firstElementChild.style.width) > parseFloat(width));
  assert.equal(setup.state.downloading.batchProgress.experimentalHd, false);
});

test("experimental downloads try one genuine upgrade, never adaptive SD, then one standard fallback path", async () => {
  const selector = utils.slice(utils.indexOf("export function getPreferredExperimentalHdSource("), utils.indexOf("async function remuxAdaptiveVideoAndAudio("))
    .replace("export function ", "function ");
  const attempt = utils.slice(utils.indexOf("async function downloadSingleMediaAttempt("), utils.indexOf("async function prepareBatchMediaForDownload("));
  for (const outcome of ["hd", "fallback", "stop", "no-upgrade"]) {
    const calls = [];
    const progress = [];
    const standard = { url: "https://cdn/standard", qualityTier: "sd", qualityLabel: "SD", width: 720, height: 1280, audioStatus: "muxed" };
    const hd = { url: "https://cdn/hd", qualityTier: "hd", qualityLabel: "HD", width: 1080, height: 1920, experimentalOnly: true, deliveryMethod: "tiktok-gateway-muxed", audioStatus: "muxed" };
    const adaptiveSd = { ...hd, url: "https://cdn/adaptive-sd", qualityTier: "sd", width: 720, height: 1280 };
    const media = { videoId: "123", videoWidth: outcome === "no-upgrade" ? 1080 : 720, videoHeight: outcome === "no-upgrade" ? 1920 : 1280, url: standard.url, videoSources: [hd, adaptiveSd, { ...hd, url: "https://cdn/second-hd" }, standard] };
    const context = vm.createContext({
      AppState: { scrapperDetails: {}, downloading: { isDownloadingAll: true }, debug: { active: false } }, media,
      getDownloadFilePath: () => "123.mp4", getCurrentPageUsername: () => "😃", detectCurrentTabName: () => "videos",
      isStopBatchError: error => error.code === "ERR_STOP_BATCH",
      downloadExperimentalGatewaySource: async (source, filename, report) => {
        calls.push(source.url); report({ phase: "fetch", progress: 1 });
        if (outcome !== "hd") throw Object.assign(new Error(outcome), { code: outcome === "stop" ? "ERR_STOP_BATCH" : "ERR_EXPERIMENTAL_HD_MISMATCH" });
        report({ phase: "save", progress: 1 });
      },
      downloadURLToDisk: async (url, filename, options) => { calls.push(url); options.onProgress?.({ phase: "fetch", progress: 1 }); options.onProgress?.({ phase: "save", progress: 1 }); },
      console: { log() {}, warn() {}, error() {} }, onProgress: status => progress.push(status),
    });
    vm.runInContext(selector + attempt, context);
    const operation = vm.runInContext("downloadSingleMediaAttempt(media,{experimentalHd:true,onProgress})", context);
    if (outcome === "stop") await assert.rejects(operation, error => error.code === "ERR_STOP_BATCH");
    else assert.equal(await operation, true);
    assert.deepEqual(calls, outcome === "hd" || outcome === "stop" ? [hd.url] : outcome === "no-upgrade" ? [standard.url] : [hd.url, standard.url]);
    assert.equal(progress.filter(status => status.phase === "fallback").length, outcome === "fallback" ? 1 : 0);
    if (outcome === "hd") assert.ok(progress.every(status => status.quality === "hd"));
    if (outcome === "fallback") assert.ok(progress.filter(status => status.quality === "standard").every(status => status.experimentalHd));
  }
});

test("failed paired HD requests immediately cancel the other stream", async () => {
  const code = utils.slice(utils.indexOf("async function downloadExperimentalHdSource("), utils.indexOf("async function downloadExperimentalGatewaySource("));
  let cancelled = false;
  const context = vm.createContext({
    AbortController, source: { url: "video", audioUrl: "audio" },
    fetchBlobWithProgress: async (url, progress, { signal }) => {
      if (url === "audio") return { response: { ok: false, status: 403 }, blob: null };
      return new Promise((resolve, reject) => signal.addEventListener("abort", () => { cancelled = true; reject(signal.reason); }, { once: true }));
    },
  });
  vm.runInContext(code, context);
  await assert.rejects(vm.runInContext("downloadExperimentalHdSource(source,'123.mp4')", context), error => error.code === "ERR_EXPERIMENTAL_HD_FETCH");
  assert.equal(cancelled, true);
});

test("paired HD byte totals remain unknown until both streams are sized", async () => {
  const code = utils.slice(utils.indexOf("async function downloadExperimentalHdSource("), utils.indexOf("async function downloadExperimentalGatewaySource("));
  const progress = [];
  const context = vm.createContext({
    AbortController, source: { url: "video", audioUrl: "audio" }, progress: status => progress.push(status),
    fetchBlobWithProgress: async (url, report) => {
      const size = url === "video" ? 100 : 50;
      report(size, size);
      return { response: { ok: true }, blob: { size } };
    },
    remuxAdaptiveVideoAndAudio: async () => ({}), URL: { createObjectURL: () => "blob:muxed", revokeObjectURL() {} },
    downloadURLToDisk: async () => true,
  });
  vm.runInContext(code, context);
  await vm.runInContext("downloadExperimentalHdSource(source,'123.mp4',progress)", context);
  const fetching = progress.filter(status => status.phase === "fetch");
  assert.equal(fetching[0].progress, null);
  assert.equal(fetching[0].total, 0);
  assert.equal(fetching.at(-1).progress, 1);
  assert.equal(fetching.at(-1).loaded, 150);
});

test("HD network inactivity is bounded and aborts its request rather than leaving a permanent spinner", async () => {
  const code = utils.slice(utils.indexOf("async function fetchBlobWithProgress("), utils.indexOf("async function downloadExperimentalHdSource("));
  let timeout;
  let signal;
  const context = vm.createContext({
    AbortController,
    setTimeout: (callback, delay) => { assert.equal(delay, 30000); timeout = callback; return 1; }, clearTimeout() {},
    fetch: (url, options) => {
      signal = options.signal;
      return new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
    },
  });
  vm.runInContext(code, context);
  const operation = vm.runInContext("fetchBlobWithProgress('https://cdn/stalled')", context);
  timeout();
  await assert.rejects(operation, error => error.code === "ERR_EXPERIMENTAL_HD_TIMEOUT");
  assert.equal(signal.aborted, true);
});

test("list progress never substitutes the batch cap for an unconfirmed post count", () => {
  const setup = progressFixture();
  setup.update({ batchTotal: null, batchIndex: null, settled: 0, batchNumber: 1, savedPosts: 0, phase: "load", progress: null, unit: "posts" });
  assert.match(setup.button.textContent, /Batch 1.*Loading posts/);
  assert.doesNotMatch(setup.button.textContent, /Downloading|of \d+/);
  const track = setup.button.querySelector(".ettpd-batch-progress-track");
  assert.equal(track.getAttribute("aria-valuenow"), null);
  assert.equal(track.firstElementChild.style.width, "100%");
  setup.update({ batchTotal: 3, batchIndex: 3, settled: 2, phase: "fetch", progress: 0.5 });
  assert.ok(setup.button.textContent.includes(t("progress", { current: 3, total: 3 })));
  assert.doesNotMatch(setup.button.textContent, /of 30/);
  setup.update({ batchTotal: null, batchIndex: null, settled: 0, batchNumber: 2, savedPosts: 3, phase: "load", progress: null });
  assert.ok(setup.button.textContent.includes(t("savedCount", { count: 3 })));
  assert.doesNotMatch(setup.button.textContent, /of \d+/);
  assert.equal(track.getAttribute("aria-valuenow"), null);
  setup.state.downloading.accountBatch = { paused: true };
  setup.update({});
  assert.ok(setup.button.textContent.includes(t("paused")));
  assert.doesNotMatch(setup.button.textContent, /of \d+/);
  setup.state.downloading.accountBatch.paused = false;
  setup.update({});
  assert.match(setup.button.textContent, /Loading posts/);
});

test("photo batches expose image indexes and retain progress across images", () => {
  const test = progressFixture();
  test.update({ batchTotal: 8, batchIndex: 2, settled: 1, unit: "posts", imageIndex: 0, imageTotal: 3, phase: "save", progress: 1 });
  const previous = Number(test.button.querySelector(".ettpd-batch-progress-track").getAttribute("aria-valuenow"));
  test.update({ imageIndex: 1, phase: "fetch", progress: 0 });
  assert.match(test.button.textContent, /Photo 2 of 3/);
  assert.ok(Number(test.button.querySelector(".ettpd-batch-progress-track").getAttribute("aria-valuenow")) >= previous);
  test.update({ phase: "fallback", progress: null });
  assert.match(test.button.textContent, /Recovering source/);
  test.update({ phase: "retry", progress: null, attempt: 2, maxRetries: 3 });
  assert.match(test.button.textContent, /Retry 2 of 3/);
});

test("completed batch hides Pause/Stop and counts saved posts even if recovery changes URLs", async () => {
  const test = progressFixture();
  const links = [{ videoId: "123", url: "https://cdn/old-one" }, { videoId: "456", url: "https://cdn/old-two" }];
  test.state.allDirectLinks = links;
  test.state.downloadPreferences = {};
  test.state.leaderboard = { newlyConfirmedMedia: [] };
  test.state.displayedState = {};
  const phases = [];
  Object.assign(test.context, {
    console: { log() {}, warn() {}, error() {} },
    button: test.button, links,
    prepareBatchMediaForDownload: async media => media,
    downloadRecovery: { skip() {} },
    downloadSingleMedia: async media => {
      test.update({ phase: "fetch", progress: 0.5, loaded: 10, total: 20 });
      phases.push(test.button.textContent);
      media.url = `https://cdn/recovered-${media.videoId}`;
      return true;
    },
    updateAllTimeDownloadsAndLeaderBoard() {}, showCelebration() {}, showStatsSpan() {},
    getRandomDownloadSuccessMessage: () => "Saved",
    shouldShowRateDonatePopup: () => false,
    scheduleReviewPopup: () => false,
    rateDonatePopupTimer: null,
  });
  vm.runInContext("function updateDownloadButtonLabelSimple(){ updateDownloadAllButtonState(document.getElementById('batch'),AppState.allDirectLinks); }", test.context);
  const source = utils.slice(utils.indexOf("async function downloadAllLinksAttempt("), utils.indexOf("export function getSavedTemplates("));
  vm.runInContext(source, test.context);
  await vm.runInContext("downloadAllLinksAttempt(button,{links})", test.context);
  assert.match(phases[0], /Downloading 1 of 2.*50%/s);
  assert.match(phases[1], /Downloading 2 of 2.*50%/s);
  assert.equal(test.state.downloading.isDownloadingAll, false);
  assert.equal(test.state.downloading.batchProgress, null);
  assert.match(test.button.textContent, /Downloaded 2 Posts/);
  assert.equal(test.pause.style.display, "none");
  assert.equal(test.stop.style.display, "none");
});

test("photo carousel button mounts inside the photo player, not above it at the feed section", () => {
  const helper = uiSource.slice(uiSource.indexOf("export function getImageDivPlayerContainer("), uiSource.indexOf("export function getImageDivPlayerContainerDownward("))
    .replace("export function ", "function ");
  const handler = uiSource.slice(uiSource.indexOf("export function handleSwiper("), uiSource.indexOf("export function handleSingleImage("))
    .replace("export function ", "function ");
  const body = {};
  const section = { tagName: "SECTION", nodeName: "SECTION", className: "SectionMediaCardContainer", parentElement: body,
    getAttribute: () => "feed-video", querySelector: () => null };
  const player = { nodeName: "DIV", className: "BasePlayerContainer-DivPhotoPlayerContainer", parentElement: section };
  const image = { src: "https://cdn/photo.jpg" };
  const swiper = { nodeName: "DIV", className: "swiper", parentElement: player,
    querySelector: selector => selector === ".swiper-slide-active" ? { getAttribute: () => "1" } : image };
  let mounted;
  const context = vm.createContext({
    document: { body, querySelector: () => ({ getAttribute: () => "1" }) },
    window: { location: { href: "https://www.tiktok.com/@emily_reels_growth/photo/7685766702189137183" } },
    findAncestor: () => section,
    extractVideoIdFromURL: () => "7685766702189137183",
    extractAuthorFromURL: () => "emily_reels_growth",
    CSS: { escape: value => value },
    createDownloadButton: options => { mounted = options; },
    console: { log() {} }, swiper,
  });
  vm.runInContext(helper + handler, context);
  vm.runInContext("handleSwiper(swiper)", context);
  assert.equal(mounted.parentEl, player);
  assert.equal(mounted.isImage, true);
  assert.equal(mounted.photoIndex, 1);
  assert.equal(mounted.getVideoSrc(), image.src);
  for (const className of ["DivPlayerContainer", "DivVideoWrapper"]) {
    player.className = className;
    assert.equal(vm.runInContext("getImageDivPlayerContainer(swiper)", context), player);
  }
});

test("home-feed photo carousels resolve their own post and image index without a detail URL", () => {
  const helper = uiSource.slice(uiSource.indexOf("export function getImageDivPlayerContainer("), uiSource.indexOf("export function getImageDivPlayerContainerDownward("))
    .replace("export function ", "function ");
  const handler = uiSource.slice(uiSource.indexOf("export function handleSwiper("), uiSource.indexOf("export function handleSingleImage("))
    .replace("export function ", "function ");
  const body = {};
  const mounted = [];
  const state = { allItemsEverSeen: {} };
  let hydrated = 0;
  const context = vm.createContext({
    document: { body, querySelector: () => assert.fail("Slide index must be carousel-local") },
    window: { location: { href: "https://www.tiktok.com/" } }, AppState: state,
    findAncestor: swiper => swiper.parentElement.parentElement,
    extractVideoIdFromURL: () => assert.fail("Home feed has no post ID in its URL"),
    extractAuthorFromURL: () => assert.fail("Author must come from the matching item"),
    getReactFiberNode: article => ({ memoizedProps: { id: "one-column-item-0" }, return: { memoizedProps: { id: article.postId } } }),
    findFiberItemById: (article, id) => { assert.equal(id, article.postId); return { item: { id, author: { uniqueId: article.author }, imagePost: { images: [{}, {}, {}] } } }; },
    displayFoundUrls: () => { hydrated += 1; },
    CSS: { escape: value => value }, createDownloadButton: options => mounted.push(options), console: { log() {} },
  });
  vm.runInContext(helper + handler, context);
  for (const [id, author, imageIndex] of [["7700943030630567198", "firstauthor", 2], ["7700943030630567199", "secondauthor", 0]]) {
    const article = { postId: id, author };
    const section = { tagName: "SECTION", nodeName: "SECTION", parentElement: body, getAttribute: () => "feed-video", querySelector: () => null };
    const player = { nodeName: "DIV", className: "DivPhotoPlayerContainer", parentElement: section };
    const swiper = { nodeName: "DIV", className: "swiper", parentElement: player, closest: () => article,
      querySelector: selector => selector === ".swiper-slide-active" ? { getAttribute: () => String(imageIndex) } : { src: `https://cdn/${id}-${imageIndex}.jpg` } };
    context.swiper = swiper;
    vm.runInContext("handleSwiper(swiper)", context);
    assert.equal(mounted.at(-1).videoId, id);
    assert.equal(mounted.at(-1).author, author);
    assert.equal(mounted.at(-1).photoIndex, imageIndex);
    assert.equal(mounted.at(-1).parentEl, player);
    assert.equal(mounted.at(-1).getVideoSrc(), `https://cdn/${id}-${imageIndex}.jpg`);
  }
  assert.equal(mounted.length, 2);
  assert.equal(hydrated, 2);
});

test("photo Save reads the active image index at click time after the carousel advances", async () => {
  const setup = progressFixture();
  const media = { videoId: "123", authorId: "user", isImage: true, imagePostImages: ["https://cdn/first.jpg", "https://cdn/second.jpg"] };
  setup.state.allDirectLinks = [media];
  setup.state.allItemsEverSeen = { "123": media };
  const parent = setup.context.document.createElement("div");
  let activeIndex = 0;
  let saved;
  Object.assign(setup.context, {
    options: { wrapperId: "123", videoId: "123", author: "user", isImage: true, photoIndex: 0,
      parentEl: parent, getPhotoIndex: () => activeIndex, getVideoSrc: () => media.imagePostImages[activeIndex] },
    CSS: { escape: value => value },
    getDownloadActionLabel: () => "Save", getStandardDownloadTitle: () => "Save photo",
    replaceElementHtml: (element, html) => { element.textContent = html; },
    findFiberItemById: () => null, buildVideoLinkMeta: item => item || null, getSrcById: () => null,
    syncOverlayExperimentalHdButton() {},
    runStandardDownload: (button, item, options) => { saved = { item, options }; },
    console: { log() {} },
  });
  const code = uiSource.slice(uiSource.indexOf("function createDownloadButton({"), uiSource.indexOf("function syncOverlayExperimentalHdButton("));
  vm.runInContext(code, setup.context);
  vm.runInContext("createDownloadButton(options)", setup.context);
  activeIndex = 1;
  const button = parent.children[0].children[0];
  await button.listeners.get("click")({ preventDefault() {}, stopPropagation() {} });
  assert.equal(saved.options.imageIndex, 1);
  assert.deepEqual(saved.item.imagePostImages, ["https://cdn/first.jpg", "https://cdn/second.jpg"]);
});

test("readiness polling cannot overwrite an active overlay's progress or reenable Save", () => {
  const setup = progressFixture();
  const media = { videoId: "123", url: "https://cdn/video.mp4", videoSources: [{ url: "https://cdn/video.mp4", audioStatus: "muxed" }] };
  setup.state.allDirectLinks = [media];
  setup.state.allItemsEverSeen = {};
  const parent = setup.context.document.createElement("div");
  Object.assign(setup.context, {
    options: { videoId: "123", author: "user", parentEl: parent, isImage: false },
    CSS: { escape: value => value }, getDownloadActionLabel: () => "SD", getStandardDownloadTitle: () => "Save video",
    replaceElementHtml: (element, html) => { element.textContent = html; }, buildVideoLinkMeta: item => item || null,
    findFiberItemById: () => null,
    syncOverlayExperimentalHdButton() {}, console: { log() {} },
  });
  const code = uiSource.slice(uiSource.indexOf("export function getReadyVideoDownloadMedia("), uiSource.indexOf("function syncOverlayExperimentalHdButton("))
    .replace("export function ", "function ");
  vm.runInContext(code, setup.context);
  vm.runInContext("createDownloadButton(options)", setup.context);
  const button = parent.children[0].children[0];
  button.dataset.downloadActive = "true";
  button.disabled = true;
  button.textContent = "43%";
  button._refreshSourceReadiness();
  assert.equal(button.textContent, "43%");
  assert.equal(button.disabled, true);
});

test("video Save readiness rejects playback blobs, silent sources, and another post's metadata", () => {
  const source = uiSource.slice(uiSource.indexOf("export function getReadyVideoDownloadMedia("), uiSource.indexOf("function createDownloadButton({"))
    .replace("export function ", "function ");
  const context = vm.createContext({});
  vm.runInContext(source, context);
  for (const media of [
    { videoId: "123", url: "blob:playing" },
    { videoId: "123", videoSources: [{ url: "https://cdn/silent", audioStatus: "video-only" }] },
    { videoId: "456", videoSources: [{ url: "https://cdn/video", audioStatus: "muxed" }] },
    { videoId: "123", videoSources: [{ url: "https://cdn/hd", audioStatus: "muxed", experimentalOnly: true }] },
  ]) {
    context.media = media;
    assert.equal(vm.runInContext('getReadyVideoDownloadMedia("123",[media])', context), null);
  }
  context.media = { videoId: "123", videoSources: [{ url: "https://cdn/video", audioStatus: "muxed" }] };
  assert.equal(vm.runInContext('getReadyVideoDownloadMedia("123",[media]).url', context), "https://cdn/video");
});

test("early overlay clicks keep a loading state until matching metadata arrives", async () => {
  const fixture = progressFixture();
  const parent = fixture.button;
  parent.getBoundingClientRect = () => ({ top: 0, bottom: 300 });
  const originalQuery = parent.querySelector.bind(parent);
  const player = { paused: true };
  parent.querySelector = selector => selector === "video" ? player : originalQuery(selector);
  const readyMedia = { videoId: "123", id: "123", authorId: "user", videoSources: [{ url: "https://cdn/video", audioStatus: "muxed" }] };
  let release;
  let hydrations = 0;
  const saves = [];
  Object.assign(fixture.state, { allItemsEverSeen: {}, allDirectLinks: [] });
  Object.assign(fixture.context, {
    parent, AbortSignal, CSS: { escape: value => value },
    window: { innerHeight: 800 },
    getDownloadActionLabel: () => "SD", getStandardDownloadTitle: () => "Download with audio",
    buildVideoLinkMeta: item => item,
    findFiberItemById: () => null,
    hydrateTikTokVideoDetail: () => { hydrations += 1; return new Promise(resolve => { release = resolve; }); },
    handleFoundItems: items => { fixture.state.allDirectLinks = items; fixture.state.allItemsEverSeen["123"] = items[0]; },
    replaceElementHtml: (element, html) => { element.textContent = html; },
    syncOverlayExperimentalHdButton() {},
    runStandardDownload: async (button, media) => { saves.push(media.url); },
    console: { log() {}, warn() {} },
  });
  const source = uiSource.slice(uiSource.indexOf("export function getReadyVideoDownloadMedia("), uiSource.indexOf("function syncOverlayExperimentalHdButton("))
    .replace("export function ", "function ");
  vm.runInContext(source, fixture.context);
  vm.runInContext('createDownloadButton({parentEl:parent,videoId:"123",author:"user",getVideoSrc:()=>"blob:playback",isImage:false})', fixture.context);
  const container = parent.children.at(-1);
  const button = container.children[0];
  assert.equal(button.disabled, true);
  assert.equal(button.dataset.sourceState, "loading");
  assert.equal(button.textContent, t("prepare"));
  assert.equal(hydrations, 0);
  player.paused = false;
  button._refreshSourceReadiness();
  button._refreshSourceReadiness();
  const click = () => button.listeners.get("click")({ preventDefault() {}, stopPropagation() {} });
  await click();
  await click();
  assert.equal(hydrations, 1);
  assert.equal(saves.length, 0);
  release(readyMedia);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(button.disabled, false);
  assert.equal(button.dataset.sourceState, "ready");
  await click();
  assert.deepEqual(saves, ["https://cdn/video"]);
});

function retryReadinessFixture() {
  const setup = progressFixture();
  const parent = setup.button;
  const originalQuery = parent.querySelector.bind(parent);
  const player = { paused: true };
  const ready = { videoId: "123", id: "123", authorId: "user", videoSources: [{ url: "https://cdn/video", audioStatus: "muxed" }] };
  let now = 10000;
  let local = null;
  let result = null;
  let nextTimer = 0;
  const timers = new Map();
  const requests = [];
  const saves = [];
  parent.getBoundingClientRect = () => ({ top: 0, bottom: 300 });
  parent.querySelector = selector => selector === "video" ? player : originalQuery(selector);
  Object.assign(setup.state, { allItemsEverSeen: {}, allDirectLinks: [] });
  Object.assign(setup.context, {
    parent, AbortSignal, Date: { now: () => now }, CSS: { escape: value => value }, window: { innerHeight: 800 },
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
    getDownloadActionLabel: () => "SD", getStandardDownloadTitle: () => "Download with audio",
    buildVideoLinkMeta: item => item, findFiberItemById: () => local ? { item: local } : null,
    hydrateTikTokVideoDetail: async (id, author, options) => { requests.push({ id, author, options }); return result; },
    handleFoundItems: items => { setup.state.allDirectLinks = items; setup.state.allItemsEverSeen["123"] = items[0]; },
    replaceElementHtml: (element, html) => { element.textContent = html; }, syncOverlayExperimentalHdButton() {},
    runStandardDownload: async (button, media) => { saves.push(media.url); }, console: { log() {}, warn() {} },
  });
  const source = uiSource.slice(uiSource.indexOf("export function getReadyVideoDownloadMedia("), uiSource.indexOf("function syncOverlayExperimentalHdButton("))
    .replace("export function ", "function ");
  vm.runInContext(source, setup.context);
  vm.runInContext('createDownloadButton({parentEl:parent,videoId:"123",author:"user",getVideoSrc:()=>"blob:playback",isImage:false})', setup.context);
  const container = parent.children.at(-1);
  const button = container.children[0];
  return {
    setup, player, ready, requests, saves, button, container,
    advance: milliseconds => {
      now += milliseconds;
      for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
    },
    pendingTimers: () => timers.size,
    result: value => { result = value; }, local: value => { local = value; },
    click: () => button.listeners.get("click")({ preventDefault() {}, stopPropagation() {} }),
    settle: () => new Promise(resolve => setImmediate(resolve)),
  };
}

test("failed preparation retries with a cooldown, caps automatic requests, and permits manual recovery", async () => {
  const fixture = retryReadinessFixture();
  fixture.player.paused = false;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    fixture.button._refreshSourceReadiness();
    fixture.button._refreshSourceReadiness();
    assert.equal(fixture.requests.length, attempt);
    assert.equal(fixture.button.dataset.sourceState, "loading");
    assert.equal(fixture.button.disabled, true);
    await fixture.settle();
    assert.equal(fixture.button.dataset.sourceState, "loading");
    assert.equal(fixture.button.disabled, true);
    assert.equal(fixture.button.getAttribute("title"), t("sourcePreparing"));
    fixture.button._refreshSourceReadiness();
    await fixture.click();
    assert.equal(fixture.requests.length, attempt, "No request during cooldown");
    fixture.advance(3000);
  }
  fixture.button._refreshSourceReadiness();
  assert.equal(fixture.requests.length, 3, "No unbounded automatic retries");
  fixture.advance(11000);
  fixture.button._refreshSourceReadiness();
  assert.equal(fixture.button.dataset.sourceState, "unavailable");
  assert.equal(fixture.button.disabled, false);
  fixture.result(fixture.ready);
  await fixture.click();
  await fixture.settle();
  assert.equal(fixture.requests.length, 4);
  assert.equal(fixture.requests[0].options.refresh, false);
  assert.ok(fixture.requests.slice(1).every(request => request.options.refresh));
  assert.equal(fixture.button.dataset.sourceState, "ready");
  assert.equal(fixture.button.disabled, false);
  assert.deepEqual(fixture.saves, [], "Preparing must not start a download");
  await fixture.click();
  assert.deepEqual(fixture.saves, ["https://cdn/video"]);
});

test("unavailable buttons recover immediately from fresh matching local metadata without another request", async () => {
  const fixture = retryReadinessFixture();
  fixture.container.listeners.get("pointerenter")();
  await fixture.settle();
  assert.equal(fixture.requests.length, 1);
  fixture.advance(20000);
  fixture.button._refreshSourceReadiness();
  assert.equal(fixture.button.dataset.sourceState, "unavailable");
  fixture.local({ ...fixture.ready, videoId: "456", id: "456" });
  fixture.button._refreshSourceReadiness();
  assert.equal(fixture.button.dataset.sourceState, "unavailable");
  fixture.local(fixture.ready);
  fixture.button._refreshSourceReadiness();
  assert.equal(fixture.button.dataset.sourceState, "ready");
  assert.equal(fixture.button.disabled, false);
  assert.equal(fixture.requests.length, 1);
  await fixture.click();
  assert.deepEqual(fixture.saves, ["https://cdn/video"]);
});

test("brief metadata failures never flash unavailable before late metadata becomes ready", async () => {
  const fixture = retryReadinessFixture();
  fixture.advance(60000);
  fixture.button._refreshSourceReadiness();
  assert.equal(fixture.button.dataset.sourceState, "loading", "Idle time before preparation must not consume the window");
  fixture.container.listeners.get("pointerenter")();
  await fixture.settle();
  fixture.advance(1000);
  fixture.button._refreshSourceReadiness();
  assert.equal(fixture.button.dataset.sourceState, "loading");
  assert.equal(fixture.button.textContent, t("prepare"));
  fixture.advance(1000);
  fixture.local(fixture.ready);
  fixture.button._refreshSourceReadiness();
  assert.equal(fixture.button.dataset.sourceState, "ready");
  assert.equal(fixture.button.disabled, false);
  assert.equal(fixture.pendingTimers(), 0, "Ready sources cancel the timeout");
  fixture.advance(60000);
  fixture.button._refreshSourceReadiness();
  assert.equal(fixture.button.dataset.sourceState, "ready");
  assert.equal(fixture.requests.length, 1);
});

test("preparation timeout shows retry without another render and manual retry gets a fresh window", async () => {
  const fixture = retryReadinessFixture();
  fixture.container.listeners.get("pointerenter")();
  await fixture.settle();
  fixture.advance(19999);
  assert.equal(fixture.button.dataset.sourceState, "loading");
  fixture.advance(1);
  assert.equal(fixture.button.dataset.sourceState, "unavailable");
  assert.equal(fixture.button.disabled, false);
  assert.equal(fixture.button.getAttribute("title"), t("retry"));
  await fixture.click();
  await fixture.settle();
  assert.equal(fixture.button.dataset.sourceState, "loading");
  assert.equal(fixture.button.disabled, true);
  fixture.advance(2000);
  fixture.button._refreshSourceReadiness();
  assert.equal(fixture.button.dataset.sourceState, "loading");
  assert.equal(fixture.requests.length, 2);
});

test("transient metadata failures are not cached for posts, episodes or collections", async () => {
  const source = utils.slice(utils.indexOf("export function hydrateTikTokVideoDetail("), utils.indexOf("function getAdaptivePlaybackToken("))
    .replace("export function ", "function ");
  for (const kind of ["post", "episode", "collection"]) {
    let attempts = 0;
    let release;
    const item = { id: "123", video: {} };
    const request = () => {
      attempts += 1;
      if (attempts === 1) return Promise.reject(Object.assign(new Error("Temporary failure"), { name: "AbortError" }));
      return new Promise(resolve => { release = resolve; });
    };
    const context = vm.createContext({
      videoDetailHydrationPromises: new Map(), URL,
      window: { location: { origin: "https://www.tiktok.com", pathname: "/@user/video/123" } },
      AppState: { debug: { active: false } }, console: { warn() {} },
      getCollectionContext: () => kind === "collection" ? { id: "999" } : null,
      resolveCollectionRequest: () => "https://www.tiktok.com/api/collection/item_list/?collectionId=999",
      collectCollectionItems: request,
      getShortDramaId: () => kind === "episode" ? "999" : null,
      findShortDramaRequest: () => "https://www.tiktok.com/api/drama/episode/item_list/?dramaID=999",
      performance: { getEntriesByType: () => [] },
      fetch: request,
      DOMParser: class { parseFromString() { return { getElementById: () => ({ textContent: JSON.stringify({ __DEFAULT_SCOPE__: { "webapp.video-detail": { itemInfo: { itemStruct: item } } } }) }) }; } },
    });
    vm.runInContext(source, context);
    assert.equal(await vm.runInContext('hydrateTikTokVideoDetail("123", "user")', context), null, kind);
    assert.equal(vm.runInContext('videoDetailHydrationPromises.has("123")', context), false, kind);
    const retry = vm.runInContext('hydrateTikTokVideoDetail("123", "user")', context);
    const concurrent = vm.runInContext('hydrateTikTokVideoDetail("123", "user")', context);
    assert.equal(attempts, 2, `${kind}: concurrent callers must share the retry`);
    assert.equal(retry, concurrent, kind);
    release(kind === "collection" ? [item] : { ok: true, json: async () => ({ itemList: [item] }), text: async () => "document" });
    assert.equal((await retry).id, "123", kind);
    assert.equal((await concurrent).id, "123", kind);
    assert.equal((await vm.runInContext('hydrateTikTokVideoDetail("123", "user")', context)).id, "123", kind);
    assert.equal(attempts, 2, `${kind}: successful metadata can remain cached`);
  }
});

test("short-drama hydration uses only an observed same-origin episode list and exact episode ID", async () => {
  const source = utils.slice(utils.indexOf("export function hydrateTikTokVideoDetail("), utils.indexOf("function getAdaptivePlaybackToken("))
    .replace("export function ", "function ");
  for (const host of ["www.tiktok.com", "untrusted.example"]) {
    const calls = [];
    const context = vm.createContext({
      videoDetailHydrationPromises: new Map(), URL,
        getShortDramaId: shortDrama.getShortDramaId, findShortDramaRequest: shortDrama.findShortDramaRequest,
        getCollectionContext: collections.getCollectionContext,
      window: { location: { origin: "https://www.tiktok.com", pathname: "/shortdrama/episode/999/1" } },
      performance: { getEntriesByType: () => [{ name: `https://${host}/api/drama/episode/item_list/?drama_id=999` }] },
      fetch: async url => {
        calls.push(String(url));
        return { ok: true, json: async () => ({ itemList: [{ id: "123", video: {} }, { id: "456", video: {} }] }), text: async () => "" };
      },
      AppState: { debug: { active: false } }, console: { warn() {} },
    });
    vm.runInContext(source, context);
    const item = await vm.runInContext('hydrateTikTokVideoDetail("123", "_")', context);
    if (host === "www.tiktok.com") {
      assert.equal(item.id, "123");
      assert.match(calls[0], /\/api\/drama\/episode\/item_list/);
      assert.equal(await vm.runInContext('hydrateTikTokVideoDetail("789", "_")', context), null);
      assert.equal(vm.runInContext('videoDetailHydrationPromises.has("789")', context), false);
    } else {
      assert.equal(item, null);
      assert.equal(new URL(calls[0]).hostname, "www.tiktok.com");
    }
  }
});

function episode(id, number, overrides = {}) {
  return {
    id,
    dramaInfo: { dramaID: "999", dramaName: "Example series", numVideos: 69,
      DramaVideoData: { EpisodeNumber: number } },
    ...overrides,
  };
}

test("episode batches collect all pages in episode order and deduplicate IDs", async () => {
  const cursors = [];
  const pages = [
    { itemList: [episode("12", 2), episode("11", 1)], cursor: "2", hasMore: true, totalEpisodeCount: "3" },
    { itemList: [episode("12", 2), episode("13", 3)], cursor: "3", hasMore: false, totalEpisodeCount: "3" },
  ];
  const result = await shortDrama.collectShortDramaEpisodes({
    seriesId: "999", origin: "https://www.tiktok.com",
    requestUrl: "https://www.tiktok.com/api/drama/episode/item_list/?dramaID=999&cursor=24&count=24",
    fetchPage: async url => {
      cursors.push(new URL(url).searchParams.get("cursor"));
      return { ok: true, json: async () => pages.shift() };
    },
  });
  assert.deepEqual(cursors, ["0", "2"]);
  assert.deepEqual(result.episodes.map(item => item.id), ["11", "12", "13"]);
  assert.equal(result.title, "Example series");
});

test("episode collection excludes other series, previews, highlights, and prohibited posts", async () => {
  const preview = episode("13", 3);
  preview.dramaInfo.DramaVideoData.IsPreview = true;
  const highlight = episode("14", 4);
  highlight.dramaInfo.DramaVideoData.IsHighlight = true;
  const other = episode("15", 5);
  other.dramaInfo.dramaID = "other";
  const result = await shortDrama.collectShortDramaEpisodes({
    seriesId: "999", origin: "https://www.tiktok.com",
    requestUrl: "https://www.tiktok.com/api/drama/episode/item_list/?dramaID=999",
    fetchPage: async () => ({ ok: true, json: async () => ({
      itemList: [episode("11", 1), episode("12", 2, { isProhibited: true }), preview, highlight, other], hasMore: false,
    }) }),
  });
  assert.deepEqual(result.episodes.map(item => item.id), ["11"]);
  assert.equal(shortDrama.findShortDramaRequest("999", [{ name: "https://www.tiktok.com/api/drama/episode/item_list/?dramaID=other" }], "https://www.tiktok.com"), null);
});

test("episode collection rejects pagination loops and cancellation without starting downloads", async () => {
  const options = {
    seriesId: "999", origin: "https://www.tiktok.com",
    requestUrl: "https://www.tiktok.com/api/drama/episode/item_list/?dramaID=999",
    fetchPage: async () => ({ ok: true, json: async () => ({ itemList: [episode("11", 1)], cursor: "0", hasMore: true }) }),
  };
  await assert.rejects(shortDrama.collectShortDramaEpisodes(options), /repeated/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(shortDrama.collectShortDramaEpisodes({ ...options, signal: controller.signal }), { name: "AbortError" });
  await assert.rejects(shortDrama.collectShortDramaEpisodes({ ...options, requestUrl: "https://untrusted.example/api/drama/episode/item_list/?dramaID=999" }), /episode list/);
});

test("episode hydration uses the correct page for a resumed episode beyond the first 24", async () => {
  const source = utils.slice(utils.indexOf("export function hydrateTikTokVideoDetail("), utils.indexOf("function getAdaptivePlaybackToken("))
    .replace("export function ", "function ");
  let fetched;
  const context = vm.createContext({
    videoDetailHydrationPromises: new Map(), URL,
    getShortDramaId: shortDrama.getShortDramaId, findShortDramaRequest: shortDrama.findShortDramaRequest,
    getCollectionContext: collections.getCollectionContext,
    window: { location: { origin: "https://www.tiktok.com", pathname: "/shortdrama/episode/999/1" } },
    performance: { getEntriesByType: () => [{ name: "https://www.tiktok.com/api/drama/episode/item_list/?dramaID=999&count=24&cursor=0" }] },
    fetch: async url => {
      fetched = new URL(url);
      return { ok: true, json: async () => ({ itemList: [episode("150", 50)] }) };
    },
    AppState: { debug: {} }, console: { warn() {} },
  });
  vm.runInContext(source, context);
  const item = await vm.runInContext('hydrateTikTokVideoDetail("150","_",{episodeNumber:50})', context);
  assert.equal(item.id, "150");
  assert.equal(fetched.searchParams.get("cursor"), "48");
});

test("episode range dialog queues only the selected episodes and preserves HD sources", async () => {
  const setup = progressFixture();
  setup.state.downloading.isDownloadingAll = false;
  const document = setup.context.document;
  let modal;
  let queued;
  let failLookup = false;
  const entries = [1, 2, 3].map(number => ({
    ...episode(String(100 + number), number),
    videoId: String(100 + number),
    videoSources: [
      { url: `https://cdn/${number}`, audioStatus: "muxed" },
      { url: `https://cdn/hd-${number}`, audioStatus: "muxed", experimentalOnly: true },
    ],
  }));
  Object.assign(setup.state, { allItemsEverSeen: {} });
  document.getElementById = id => id === "batch" ? setup.button : null;
  Object.assign(setup.context, {
    AbortController, getShortDramaId: () => "999",
    resolveShortDramaRequest: () => "https://www.tiktok.com/api/drama/episode/item_list/?dramaID=999",
    collectShortDramaEpisodes: async () => {
      if (failLookup) throw new Error("Temporary lookup failure");
      return { seriesId: "999", title: "Example", total: 3, episodes: entries };
    },
    getEpisodeNumber: shortDrama.getEpisodeNumber,
    buildVideoLinkMeta: (item, index) => ({ ...item, index }),
    displayFoundUrls() {},
    downloadAllLinks: async (button, options) => { queued = options; },
    createModal: ({ children }) => {
      modal = document.createElement("div");
      modal.remove = () => {};
      const box = document.createElement("div");
      box.className = "ettpd-modal-box";
      children.forEach(child => box.appendChild(child));
      modal.appendChild(box);
      return modal;
    },
    trigger: { dataset: {}, disabled: false },
  });
  const ready = uiSource.slice(uiSource.indexOf("export function getReadyVideoDownloadMedia("), uiSource.indexOf("function createDownloadButton({"))
    .replace("export function ", "function ");
  const dialog = uiSource.slice(uiSource.indexOf("async function showShortDramaBatchDialog("), uiSource.indexOf("function refreshDownloadButtonQualityBadges("));
  vm.runInContext(ready + dialog, setup.context);
  await vm.runInContext('showShortDramaBatchDialog("999",trigger)', setup.context);
  const form = modal.querySelector("form");
  const range = form.children[0];
  range.children[0].children.at(-1).value = "1";
  range.children[1].children.at(-1).value = "2";
  form.onsubmit({ preventDefault() {} });
  assert.equal(queued.batchType, "episodes");
  assert.deepEqual(Array.from(queued.links, media => media.episodeNumber), [1, 2]);
  assert.deepEqual(Array.from(queued.links, media => media.index), [0, 1]);
  assert.equal(queued.links[0].videoSources[1].experimentalOnly, true);
  const previousQueue = queued;
  failLookup = true;
  await vm.runInContext('showShortDramaBatchDialog("999",trigger)', setup.context);
  const content = modal.querySelector(".ettpd-modal-box").children[0];
  const retry = content.children.find(child => child.textContent === "Retry episode lookup");
  assert.ok(retry);
  assert.equal(queued, previousQueue);
  failLookup = false;
  retry.onclick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(modal.querySelector("form").hidden, false);
  assert.equal(queued, previousQueue);
});

test("episode discovery works after client navigation with empty resource history", async () => {
  const origin = "https://www.tiktok.com";
  const seriesId = "880001";
  const requestUrl = shortDrama.resolveShortDramaRequest(seriesId, [], origin);
  const parsed = new URL(requestUrl);
  assert.equal(parsed.origin, origin);
  assert.equal(parsed.searchParams.get("dramaID"), seriesId);
  let requests = 0;
  const item = episode("881001", 1);
  item.dramaInfo.dramaID = seriesId;
  const result = await shortDrama.collectShortDramaEpisodes({
    seriesId, requestUrl, origin,
    fetchPage: async () => { requests += 1; return { ok: true, json: async () => ({ itemList: [item], hasMore: false }) }; },
  });
  assert.equal(requests, 1);
  assert.equal(result.episodes[0].id, item.id);
});

test("remembered episode request survives timing eviction without rejecting a different valid cursor", async () => {
  const origin = "https://www.tiktok.com";
  const seriesId = "880002";
  const remembered = `${origin}/api/drama/episode/item_list/?dramaID=${seriesId}&cursor=48&count=24`;
  assert.equal(shortDrama.rememberShortDramaRequest(remembered, origin), remembered);
  assert.equal(shortDrama.findShortDramaRequest(seriesId, [], origin), remembered);
  const item = episode("881002", 1);
  item.dramaInfo.dramaID = seriesId;
  const result = await shortDrama.collectShortDramaEpisodes({
    seriesId, origin, requestUrl: remembered.replace("cursor=48", "cursor=0"),
    fetchPage: async url => {
      assert.equal(new URL(url).searchParams.get("cursor"), "0");
      return { ok: true, json: async () => ({ itemList: [item], hasMore: false }) };
    },
  });
  assert.equal(result.episodes.length, 1);
  assert.equal(shortDrama.rememberShortDramaRequest(`https://untrusted.example/api/drama/episode/item_list/?dramaID=${seriesId}`, origin), null);
});

test("collection context and discovery preserve the scoped order across missing and duplicate posts", async () => {
  const context = collections.getCollectionContext("/@tiktok/collection/Summer%20of%20Sports-7394627756635573022");
  assert.equal(context.id, "7394627756635573022");
  assert.equal(context.name, "Summer of Sports");
  assert.equal(collections.getCollectionContext("/@tiktok/video/7394627756635573022"), null);
  const origin = "https://www.tiktok.com";
  const pages = [
    { itemList: [{ id: "12" }, { id: "11" }], cursor: "30", hasMore: true },
    { itemList: [], cursor: "60", hasMore: true },
    { itemList: [{ id: "11" }, { id: "13" }, { id: "14", isProhibited: true }], hasMore: false },
  ];
  const result = await collections.collectCollectionItems({
    collectionId: context.id, origin, requestUrl: collections.resolveCollectionRequest(context.id, [], origin),
    fetchPage: async () => ({ ok: true, json: async () => pages.shift() }),
  });
  assert.deepEqual(result.map(item => item.id), ["12", "11", "13"]);
});

test("collection pagination rejects loops and cross-collection requests and respects cancellation", async () => {
  const options = {
    collectionId: "123", origin: "https://www.tiktok.com",
    requestUrl: "https://www.tiktok.com/api/collection/item_list/?collectionId=123",
    fetchPage: async () => ({ ok: true, json: async () => ({ itemList: [{ id: "1" }], cursor: "0", hasMore: true }) }),
  };
  await assert.rejects(collections.collectCollectionItems(options), /repeated/);
  await assert.rejects(collections.collectCollectionItems({ ...options, requestUrl: options.requestUrl.replace("Id=123", "Id=456") }), /does not match/);
  await assert.rejects(collections.collectCollectionItems({ ...options, requestUrl: options.requestUrl.replace("www.tiktok.com", "other.example") }), /does not match/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(collections.collectCollectionItems({ ...options, signal: controller.signal }), { name: "AbortError" });
});

test("collection recovery stops pagination as soon as the requested post is found", async () => {
  let requests = 0;
  const result = await collections.collectCollectionItems({
    collectionId: "123", origin: "https://www.tiktok.com",
    requestUrl: "https://www.tiktok.com/api/collection/item_list/?collectionId=123",
    targetVideoId: "11",
    fetchPage: async () => {
      requests += 1;
      return { ok: true, json: async () => ({ itemList: [{ id: "11" }, { id: "12" }], cursor: "30", hasMore: true }) };
    },
  });
  assert.equal(requests, 1);
  assert.deepEqual(result.map(item => item.id), ["11"]);
});

test("collection dialog batches only confirmed collection posts, including photo posts", async () => {
  const setup = progressFixture();
  setup.state.downloading.isDownloadingAll = false;
  setup.state.downloadPreferences = {};
  setup.state.allItemsEverSeen = { "999": { id: "999" } };
  const collection = { id: "123", name: "Summer of Sports", author: "tiktok" };
  const entries = [
    { id: "101", videoId: "101", videoSources: [{ url: "https://cdn/video", audioStatus: "muxed" }] },
    { id: "102", videoId: "102", isImage: true, imagePostImages: ["https://cdn/photo.jpg"] },
    { id: "103", videoId: "103", url: "blob:not-downloadable" },
  ];
  const document = setup.context.document;
  document.getElementById = id => id === "batch" ? setup.button : null;
  let modal;
  let queued;
  Object.assign(setup.context, {
    AbortController, collection, trigger: { dataset: {}, disabled: false },
    getCollectionContext: () => collection,
    resolveCollectionRequest: () => "https://www.tiktok.com/api/collection/item_list/?collectionId=123",
    collectCollectionItems: async () => entries,
    buildVideoLinkMeta: (item, index) => ({ ...item, index }),
    displayFoundUrls() {},
    downloadAllLinks: async (button, options) => { queued = options; },
    createModal: ({ children }) => {
      modal = document.createElement("div");
      modal.remove = () => {};
      const box = document.createElement("div");
      box.className = "ettpd-modal-box";
      children.forEach(child => box.appendChild(child));
      modal.appendChild(box);
      return modal;
    },
  });
  const ready = uiSource.slice(uiSource.indexOf("export function getReadyVideoDownloadMedia("), uiSource.indexOf("function createDownloadButton({"))
    .replace("export function ", "function ");
  const dialog = uiSource.slice(uiSource.indexOf("async function showCollectionDownloadDialog("), uiSource.indexOf("function refreshDownloadButtonQualityBadges("));
  vm.runInContext(ready + dialog, setup.context);
  await vm.runInContext("showCollectionDownloadDialog(collection,trigger)", setup.context);
  const content = modal.querySelector(".ettpd-modal-box").children[0];
  const start = content.children.find(child => child.textContent === t("downloadCount", { count: 2 }));
  assert.ok(start);
  assert.equal(queued, undefined);
  start.onclick();
  assert.equal(queued.batchType, "collection");
  assert.deepEqual(Array.from(queued.links, media => media.videoId), ["101", "102"]);
  assert.equal(queued.links[1].isImage, true);
  assert.equal(setup.state.allItemsEverSeen["999"].id, "999");
});

test("overall download limits stop without another page and resume without duplicates", async () => {
  const store = new ProgressiveBatch(fixture().storage);
  const saved = [];
  let requests = 0;
  const options = {
    scope: "videos:limited", batchSize: 30, maxPosts: 3,
    fetchPage: async () => { requests += 1; return { items: ["1", "2", "3", "4", "5", "6"].map(id => ({ id })), cursor: "next", hasMore: true }; },
    downloadBatch: async items => { saved.push(...items.map(item => item.id)); return { completed: items.map(item => item.id) }; },
  };
  const limited = await store.run(options);
  assert.deepEqual(saved, ["1", "2", "3"]);
  assert.equal(limited.limitReached, true);
  assert.equal(limited.finished, false);
  assert.equal(limited.maxPosts, 3);
  assert.equal(requests, 1);
  await store.run({ ...options, resume: true, maxPosts: undefined });
  assert.equal(requests, 1);
  const resumed = await store.run({ ...options, resume: true, maxPosts: 5 });
  assert.deepEqual(saved, ["1", "2", "3", "4", "5"]);
  assert.equal(resumed.limitReached, true);
  assert.equal(requests, 2);
  for (const maxPosts of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(store.run({ ...options, maxPosts }), /positive whole-number/);
  }
});

test("download limits count confirmed posts rather than skipped entries", async () => {
  const store = new ProgressiveBatch(fixture().storage);
  const result = await store.run({
    scope: "videos:limited-skips", batchSize: 2, maxPosts: 3,
    fetchPage: async () => ({ items: ["1", "2", "3", "4", "5"].map(id => ({ id })), cursor: "end", hasMore: false }),
    downloadBatch: async items => ({
      completed: items.filter(item => Number(item.id) > 2).map(item => item.id),
      skipped: items.filter(item => Number(item.id) <= 2).map(item => item.id),
    }),
  });
  assert.deepEqual(result.completed, ["3", "4", "5"]);
  assert.deepEqual(result.skipped, ["1", "2"]);
  assert.equal(result.limitReached, true);
});

test("progressive batches save before loading later pages and never exceed the chosen size", async () => {
  const setup = fixture();
  const store = new ProgressiveBatch(setup.storage);
  const events = [];
  const result = await store.run({
    scope: "videos:first", batchSize: 2,
    fetchPage: async cursor => {
      events.push(`page:${cursor}`);
      return { items: cursor === "0" ? [{ id: "1" }, { id: "2" }, { id: "3" }] : [{ id: "4" }], cursor: "next", hasMore: cursor === "0" };
    },
    downloadBatch: async items => {
      assert.ok(items.length <= 2);
      events.push(`save:${items.map(item => item.id).join(",")}`);
      return { completed: items.map(item => item.id) };
    },
  });
  assert.deepEqual(events, ["page:0", "save:1,2", "save:3", "page:next", "save:4"]);
  assert.equal(result.finished, true);
  assert.equal(result.completed.length, 4);
});

test("failed later pages retain earlier batches and resume without redownloading them", async () => {
  const setup = fixture();
  const store = new ProgressiveBatch(setup.storage);
  await assert.rejects(store.run({
    scope: "liked:second", batchSize: 2,
    fetchPage: async cursor => {
      if (cursor === "next") throw new Error("Temporary API failure");
      return { items: [{ id: "1" }, { id: "2" }], cursor: "next", hasMore: true };
    },
    downloadBatch: async items => ({ completed: items.map(item => item.id) }),
  }), /Temporary/);
  assert.deepEqual(store.read("liked:second").completed, ["1", "2"]);
  const saved = [];
  const result = await store.run({
    scope: "liked:second", resume: true,
    fetchPage: async cursor => {
      assert.equal(cursor, "next");
      return { items: [{ id: "2" }, { id: "3" }], hasMore: false };
    },
    downloadBatch: async items => { saved.push(...items.map(item => item.id)); return { completed: saved }; },
  });
  assert.deepEqual(saved, ["3"]);
  assert.deepEqual(result.completed, ["1", "2", "3"]);
});

test("partial progressive batches pause before another page and isolate account-list checkpoints", async () => {
  const setup = fixture();
  const store = new ProgressiveBatch(setup.storage);
  let pages = 0;
  const paused = await store.run({
    scope: "videos:third", batchSize: 2,
    fetchPage: async () => { pages += 1; return { items: [{ id: "1" }, { id: "2" }], cursor: "next", hasMore: true }; },
    downloadBatch: async () => ({ completed: ["1"] }),
  });
  assert.equal(pages, 1);
  assert.equal(paused.finished, false);
  assert.deepEqual(paused.pending, ["2"]);
  await store.run({ scope: "favorites:third", fetchPage: async () => ({ items: [{ id: "9" }], hasMore: false }), downloadBatch: async () => ({ completed: ["9"] }) });
  assert.deepEqual(store.read("videos:third").completed, ["1"]);
  assert.deepEqual(store.read("favorites:third").completed, ["9"]);
});

test("all account/list kinds are independently scoped, bounded, and do not cache every page", async () => {
  const origin = "https://www.tiktok.com";
  for (const kind of ["videos", "liked", "reposts", "favorites", "collection", "playlist"]) {
    const source = accountLists.resolveAccountList({ kind, username: "batchuser", id: "123", origin, profile: { uniqueId: "batchuser", secUid: "verified-subject" } });
    const result = await accountLists.fetchAccountListPage(source, "0", 100, null, async url => {
      assert.equal(new URL(url).searchParams.get("count"), "30");
      assert.equal(new URL(url).searchParams.has("X-Bogus"), false);
      assert.equal(accountLists.isProgressiveListRequest(url, origin), true);
      assert.equal(accountLists.isProgressiveListRequest(`${url}&X-Bogus=updated-by-tiktok`, origin), true);
      return { ok: true, json: async () => ({ itemList: [{ id: "1" }], cursor: "30", hasMore: true }) };
    });
    assert.equal(result.items.length, 1);
    await assert.rejects(accountLists.fetchAccountListPage({ ...source, subject: "wrong" }, "0", 30), /does not match/);
  }
  assert.throws(() => accountLists.resolveAccountList({ kind: "videos", username: "differentuser", origin }), /details/);
});

test("progressive lists recover native request context after initial requests escape interception", async () => {
  const origin = "https://www.tiktok.com";
  for (const [kind, endpoint, identityKey] of [
    ["collection", "collection", "collectionId"], ["playlist", "mix", "mixId"],
    ["liked", "favorite", "secUid"], ["reposts", "repost", "secUid"],
    ["favorites", "user/collect", "secUid"], ["videos", "post", "secUid"],
  ]) {
    const subject = ["collection", "playlist"].includes(kind) ? "998877661122" : `initial-${kind}`;
    const native = `${origin}/api/${endpoint}/item_list/?${identityKey}=${subject}&native_context=ready&sourceType=113&count=30&cursor=0`;
    const source = accountLists.resolveAccountList({
      kind, id: subject, username: `initial-${kind}`, origin,
      profile: { uniqueId: `initial-${kind}`, secUid: subject },
      resources: [{ name: native }, { name: native.replace(subject, "other-subject") }, { name: native.replace(origin, "https://other.example") }],
    });
    assert.equal(new URL(source.url).searchParams.get("native_context"), "ready", kind);
    const order = [];
    const store = new ProgressiveBatch(fixture().storage);
    const result = await store.run({
      scope: source.scope, batchSize: 1,
      fetchPage: (cursor, count, signal) => accountLists.fetchAccountListPage(source, cursor, count, signal, async raw => {
        const url = new URL(raw);
        assert.equal(url.searchParams.get("native_context"), "ready", kind);
        assert.equal(url.searchParams.get(identityKey), subject, kind);
        assert.equal(url.searchParams.get("count"), "1", kind);
        order.push(`fetch:${cursor}`);
        return { ok: true, json: async () => ({ statusCode: 0, itemList: [{ id: cursor === "0" ? "99887701" : "99887702" }], cursor: cursor === "0" ? "1" : "2", hasMore: cursor === "0" }) };
      }),
      downloadBatch: async items => { order.push(`save:${items[0].id}`); return { completed: items.map(item => item.id) }; },
    });
    assert.deepEqual(order, ["fetch:0", "save:99887701", "fetch:1", "save:99887702"], kind);
    assert.equal(result.completed.length, 2, kind);
    assert.equal(result.finished, true, kind);
  }
});

test("a progressive job cannot regain its refresh allowance between chunks", async () => {
  const setup = fixture();
  const store = new ProgressiveBatch(setup.storage);
  const result = await store.run({
    scope: "reposts:fourth", batchSize: 1,
    fetchPage: async cursor => ({ items: [{ id: cursor === "0" ? "1" : "2" }], cursor: "next", hasMore: cursor === "0" }),
    downloadBatch: async (items, checkpoint) => {
      if (items[0].id === "1") {
        store.recordChunk({ context: { progressiveScope: checkpoint.scope }, refreshCount: 1, queue: [{ key: "1:video", videoId: "1", status: "saved" }] }, [{ key: "1:video", downloadId: 7 }]);
      } else assert.equal(checkpoint.refreshCount, 1);
      return { completed: items.map(item => item.id) };
    },
  });
  assert.equal(result.refreshCount, 1);
});

test("account job resumes browser-confirmed chunk files without downloading them again", async () => {
  const setup = fixture();
  const source = { scope: "videos:integration", kind: "videos", username: "user" };
  const store = new ProgressiveBatch(setup.storage);
  const recovery = new DownloadRecovery(() => setup.storage, () => Date.now(), (operation, saves) => store.recordChunk(operation, saves));
  const saved = [];
  const progress = [];
  const state = {
    downloading: {}, downloadPreferences: {}, scrapperDetails: { scrappingStage: "completed" },
    leaderboard: { newlyConfirmedMedia: [] }, ui: {},
  };
  let pending = true;
  let reviewScheduled = 0;
  const context = vm.createContext({
    activeAccountBatch: null, ProgressiveBatch, sessionStorage: setup.storage, AbortController,
    AppState: state, downloadRecovery: recovery, source,
    window: { location: { href: "https://www.tiktok.com/@user" } },
    document: { getElementById: () => ({}) }, DOM_IDS: { DOWNLOAD_ALL_BUTTON: "button" },
    isExtensionEnabledSync: () => true,
    setNativeProgressiveList() {},
    scheduleReviewPopup: () => {
      assert.equal(state.downloading.accountBatch, null);
      assert.equal(recovery.operation, null);
      reviewScheduled += 1;
      return true;
    },
    updateBatchDownloadProgress: status => progress.push(status), updateDownloadButtonLabelSimple() {},
    fetchAccountListPage: async (source, cursor) => ({
      items: cursor === "0" ? [{ id: "1" }, { id: "2" }] : [{ id: "3" }],
      cursor: "next", hasMore: cursor === "0",
    }),
    buildVideoLinkMeta: item => ({ ...item, videoId: item.id, url: `https://cdn/${item.id}`, videoSources: [{ url: `https://cdn/${item.id}`, audioStatus: "muxed" }] }),
    getDownloadStatuses: async (ids, wait) => {
      assert.equal(wait, true);
      return ids.map(id => ({ id, state: pending ? "in_progress" : "complete" }));
    },
    runRecoveryOperation: (links, options, callback) => recovery.run(links, options, {
      ...setup.context, progressiveScope: source.scope,
    }, callback),
    downloadAllLinksAttempt: async (button, { links }) => {
      for (const media of links) {
        await recovery.file(media, {}, async () => {
          saved.push(media.videoId);
          recovery.saveStarted(media.videoId);
          recovery.saveResponded(media.videoId, { success: true, downloadId: Number(media.videoId) });
          return true;
        });
      }
      return { stopped: false };
    },
  });
  const code = utils.slice(utils.indexOf("export function getProgressiveListCheckpoint("), utils.indexOf("export function restoreDownloadRecovery("))
    .replaceAll("export function ", "function ").replaceAll("export async function ", "async function ");
  vm.runInContext(code, context);
  await assert.rejects(vm.runInContext("downloadAccountListBatches(source,{batchSize:2})", context), /still saving|unknown/);
  assert.deepEqual(saved, ["1", "2"]);
  assert.equal(reviewScheduled, 0, "An incomplete save must not schedule a review");
  pending = false;
  const result = await vm.runInContext("downloadAccountListBatches(source,{batchSize:2,resume:true})", context);
  assert.equal(result.finished, true);
  assert.equal(reviewScheduled, 1, "Completed list jobs schedule after clearing active-job state");
  assert.deepEqual(saved, ["1", "2", "3"]);
  assert.deepEqual(result.completed, ["1", "2", "3"]);
  const loading = progress.filter(status => status.phase === "load");
  assert.ok(loading.length > 0);
  assert.ok(loading.every(status => status.batchTotal === null && status.batchIndex === null));
  assert.ok(loading.some(status => status.savedPosts === 2));
});

test("account video sorting uses independent resume scopes", () => {
  const origin = "https://www.tiktok.com";
  const profile = { uniqueId: "sortinguser", secUid: "sorting-subject" };
  accountLists.rememberAccountIdentity(profile);
  accountLists.rememberAccountListResponse({}, `${origin}/api/post/item_list/?secUid=sorting-subject&post_item_list_request_type=0`, origin);
  const latest = accountLists.resolveAccountList({ kind: "videos", username: profile.uniqueId, origin });
  accountLists.rememberAccountListResponse({}, `${origin}/api/post/item_list/?secUid=sorting-subject&post_item_list_request_type=1`, origin);
  const popular = accountLists.resolveAccountList({ kind: "videos", username: profile.uniqueId, origin });
  assert.notEqual(latest.scope, popular.scope);
});

test("download dialogs separate primary/cancel actions and pass overall limits independently of batches", async () => {
  for (const mode of ["all", "limited", "resume"]) {
    const setup = progressFixture();
    setup.state.downloading.isDownloadingAll = false;
    const document = setup.context.document;
    document.getElementById = () => null;
    const saved = mode === "resume" ? { batchSize: 2, maxPosts: 4, completed: ["1"], finished: false } : null;
    let modal;
    let started;
    Object.assign(setup.context, {
      DOM_IDS: { MODAL_CONTAINER: "modal" }, window: { location: { href: "https://www.tiktok.com/@user/collection/test-123" } },
      AbortController, DEFAULT_BATCH_SIZE: 30, resolveAccountList: () => ({ kind: "collection", scope: "collection:123" }),
      getProgressiveListCheckpoint: () => saved, displayFoundUrls() {}, showToast() {},
      downloadAccountListBatches: async (source, options) => { started = options; return { finished: false, limitReached: true, completed: ["1"] }; },
      createModal: ({ children }) => {
        modal = document.createElement("div"); modal.remove = () => {};
        const box = document.createElement("div"); box.className = "ettpd-modal-box";
        box.append(...children); modal.appendChild(box); return modal;
      },
    });
    const code = uiSource.slice(uiSource.indexOf("function notifyDownloadBusy("), uiSource.indexOf("function makeAccountDownloadControl("));
    vm.runInContext(code, setup.context);
    await vm.runInContext('showAccountBatchDialog({kind:"collection",id:"123",title:"Collection"})', setup.context);
    const content = modal.querySelector(".ettpd-modal-box").children[0];
    const form = content.children.find(child => child.tagName === "FORM");
    const limit = form.children[0].children.find(child => child.tagName === "INPUT");
    const advanced = form.children[1];
    const size = advanced.children[1].children.find(child => child.tagName === "INPUT");
    const submit = form.children.at(-1);
    const cancel = content.children.at(-1);
    assert.ok(cancel.className.includes("secondary"));
    assert.ok(!submit.className.includes("secondary"));
    assert.equal(advanced.tagName, "DETAILS");
    assert.equal(limit.getAttribute("placeholder"), t("all"));
    assert.equal(submit.textContent, mode === "resume" ? "Resume download" : "Download All");
    if (mode !== "all") {
      limit.value = "0";
      form.onsubmit({ preventDefault() {} });
      assert.equal(started, undefined);
      limit.value = mode === "resume" ? "6" : "3";
      limit.listeners.get("input")();
      assert.equal(submit.textContent, mode === "resume" ? "Resume download" : "Download");
    }
    form.onsubmit({ preventDefault() {} });
    assert.equal(started.maxPosts, mode === "all" ? null : mode === "resume" ? 6 : 3);
    assert.equal(started.batchSize, mode === "resume" ? 2 : 30);
    assert.equal(started.resume, mode === "resume");
    assert.equal(size.disabled, mode === "resume");
    await Promise.resolve();
  }
});

test("busy account-list clicks explain the block before opening another dialog", async () => {
  const code = uiSource.slice(uiSource.indexOf("function notifyDownloadBusy("), uiSource.indexOf("function makeAccountDownloadControl("));
  for (const downloading of [{ isActive: true }, { isDownloadingAll: true }, { accountBatch: { paused: true } }]) {
    const messages = [];
    const context = vm.createContext({
      AppState: { downloading }, t, showToast: (title, message) => messages.push({ title, message }),
      document: { getElementById: () => assert.fail("Busy click must not prepare a dialog") },
    });
    vm.runInContext(code, context);
    await vm.runInContext('showAccountBatchDialog({kind:"liked",title:"Likes"})', context);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].title, "Download already in progress");
    assert.match(messages[0].message, /finish.*stop/i);
  }
});

test("busy Download All remains clickable, shows a toast, and cannot start a second download", () => {
  const setup = progressFixture();
  const messages = [];
  let downloads = 0;
  Object.assign(setup.context, { showToast: (title, message) => messages.push(message), downloadAllLinks: () => { downloads += 1; } });
  const guard = uiSource.slice(uiSource.indexOf("function notifyDownloadBusy("), uiSource.indexOf("async function showAccountBatchDialog("));
  const create = uiSource.slice(uiSource.indexOf("function createDownloadAllButton("), uiSource.indexOf("function getDownloadItemUrls("));
  vm.runInContext(guard + create, setup.context);
  const container = vm.runInContext("createDownloadAllButton()", setup.context);
  const button = container.children[0];
  setup.context.testButton = button;
  setup.state.downloading.batchProgress = { batchTotal: 2, batchIndex: 1, phase: "fetch" };
  vm.runInContext("renderBatchDownloadProgress(testButton)", setup.context);
  assert.equal(button.disabled, false);
  assert.equal(button.getAttribute("aria-disabled"), "true");
  button.onclick({ stopPropagation() {} });
  assert.equal(downloads, 0);
  assert.equal(messages.length, 1);
  setup.state.downloading.isDownloadingAll = false;
  vm.runInContext("renderBatchDownloadProgress(testButton)", setup.context);
  assert.equal(button.getAttribute("aria-disabled"), null);
  button.onclick({ stopPropagation() {} });
  assert.equal(downloads, 1);
});

test("busy collection and episode headers explain clicks while loading still disables them", () => {
  const setup = progressFixture();
  const document = setup.context.document;
  const parent = document.createElement("div");
  const collectionHeading = document.createElement("h1");
  parent.appendChild(collectionHeading);
  const episodeHeading = document.createElement("h3");
  episodeHeading.textContent = "Episodes";
  parent.appendChild(episodeHeading);
  parent.contains = element => parent.children.includes(element);
  episodeHeading.contains = element => episodeHeading.children.includes(element);
  document.getElementById = id => [...parent.children, ...episodeHeading.children].find(element => element.id === id) || null;
  document.querySelector = () => collectionHeading;
  document.querySelectorAll = () => [episodeHeading];
  const messages = [];
  Object.assign(setup.context, {
    showToast: (title, message) => messages.push(message),
    getCollectionContext: () => ({ id: "123", name: "Summer of Sports" }), getShortDramaId: () => "456",
    createIcon: () => document.createElement("span"),
    showShortDramaBatchDialog: () => assert.fail("Busy click must not open episode dialog"),
  });
  const guard = uiSource.slice(uiSource.indexOf("function notifyDownloadBusy("), uiSource.indexOf("function makeAccountDownloadControl("));
  const collection = uiSource.slice(uiSource.indexOf("function syncCollectionDownloadButton("), uiSource.indexOf("async function showCollectionDownloadDialog("));
  const episodes = uiSource.slice(uiSource.indexOf("function syncShortDramaDownloadButton("), uiSource.indexOf("async function showShortDramaBatchDialog("));
  vm.runInContext(guard + collection + episodes, setup.context);
  vm.runInContext("syncCollectionDownloadButton(); syncShortDramaDownloadButton(); syncCollectionDownloadButton(); syncShortDramaDownloadButton();", setup.context);
  for (const id of ["ettpd-collection-download", "ettpd-episode-download"]) {
    const button = document.getElementById(id);
    assert.equal(button.disabled, false);
    button.onclick({ preventDefault() {}, stopPropagation() {} });
    button.dataset.loading = "true";
  }
  assert.equal(messages.length, 2);
  vm.runInContext("syncCollectionDownloadButton(); syncShortDramaDownloadButton();", setup.context);
  assert.equal(document.getElementById("ettpd-collection-download").disabled, true);
  assert.equal(document.getElementById("ettpd-episode-download").disabled, true);
});

function floatingControlFixture() {
  const setup = progressFixture();
  const document = setup.context.document;
  const containers = [];
  const timers = [];
  document.querySelectorAll = () => containers.filter(container => container.isConnected);
  Object.assign(setup.context, {
    window: { location: { pathname: "/" } }, CSS: { escape: value => value },
    activeProfileGridItem: null, activeSideGridItem: null, activeCreatorVideosSidebarCard: null,
    activeYouMayLikeGridCard: null, activeMainVideoSideGridCard: null, Element: setup.button.constructor,
    setTimeout: (callback, duration) => timers.push({ callback, duration }), console: { warn() {}, log() {} },
  });
  const code = uiSource.slice(uiSource.indexOf("\nexport function clearDownloadBtnContainers("), uiSource.indexOf("export function getReadyVideoDownloadMedia("))
    .replaceAll("export function ", "function ");
  const hoverCleanup = uiSource.slice(uiSource.indexOf("function removeInjectedDownloadButton("), uiSource.indexOf("function getProfileGridPostId("));
  const scannerCleanup = uiSource.slice(uiSource.indexOf("export function clearDownloadContainers("), uiSource.indexOf("// Helpers", uiSource.indexOf("export function clearDownloadContainers(")))
    .replace("export function ", "function ");
  vm.runInContext(code + hoverCleanup + scannerCleanup, setup.context);
  const addControl = (id, feed = false) => {
    const container = document.createElement("div");
    const button = document.createElement("button");
    button.postId = id;
    button.closest = () => container;
    container.appendChild(button);
    container.closest = selector => feed && selector === 'section[data-e2e="feed-video"]' ? {} : null;
    container.querySelector = selector => selector === '[data-download-active="true"]'
      ? container.children.find(child => child.dataset.downloadActive === "true") || null
      : selector === `button.download-btn.${id}` ? button : null;
    container.remove = () => { container.isConnected = false; };
    containers.push(container);
    return { container, button };
  };
  return { ...setup, addControl, timers };
}

test("Explore controls mount on the stable card instead of its collapsible preview player", () => {
  const preview = { querySelector: () => ({ src: "https://cdn/video.mp4" }) };
  const card = { style: {}, querySelector: selector => selector === ".xgplayer-container" ? preview : null };
  let mounted;
  const context = vm.createContext({
    card, getComputedStyle: () => ({ position: "static" }),
    getVideoUsernameFromAllDirectLinks: () => "user", expectSmallViewer: () => true,
    createDownloadButton: options => { mounted = options; },
  });
  const code = uiSource.slice(uiSource.indexOf("export function createExploreDownloadButton("), uiSource.indexOf("export function getImageDivPlayerContainer("))
    .replace("export function ", "function ");
  vm.runInContext(code, context);
  vm.runInContext('createExploreDownloadButton(card,"123")', context);
  assert.equal(mounted.parentEl, card);
  assert.notEqual(mounted.parentEl, preview);
  assert.equal(card.style.position, "relative");
  assert.equal(mounted.getVideoSrc(), "https://cdn/video.mp4");
});

test("Explore scanner and global cleanup retain active progress but keep idle controls hover-only", () => {
  const setup = floatingControlFixture();
  const control = setup.addControl("123");
  let hovered = true;
  let created = 0;
  const card = {
    matches: () => hovered,
    querySelectorAll: () => control.container.isConnected ? [control.container] : [],
    querySelector: selector => selector.startsWith("a[") ? { getAttribute: () => "/@user/video/123" }
      : control.container.isConnected ? control.button : null,
  };
  control.container.closest = selector => selector === '[data-e2e="explore-item"]' ? card : null;
  const globalQuery = setup.context.document.querySelectorAll;
  setup.context.document.querySelectorAll = selector => selector === 'div[data-e2e="explore-item"]' ? [card] : globalQuery(selector);
  setup.context.createExploreDownloadButton = () => { created += 1; };
  const code = uiSource.slice(uiSource.indexOf("function injectExploreDownloadButtons("), uiSource.indexOf("function getRelevantFeedWrappers("));
  vm.runInContext(code, setup.context);
  vm.runInContext("clearDownloadBtnContainers(); injectExploreDownloadButtons();", setup.context);
  assert.equal(control.container.isConnected, true);
  control.button.dataset.downloadActive = "true";
  hovered = false;
  for (let pass = 0; pass < 5; pass += 1) vm.runInContext("injectExploreDownloadButtons(); clearDownloadBtnContainers();", setup.context);
  assert.equal(control.container.isConnected, true);
  assert.equal(created, 0);
  delete control.button.dataset.downloadActive;
  vm.runInContext("injectExploreDownloadButtons(); clearDownloadBtnContainers();", setup.context);
  assert.equal(control.container.isConnected, false);
  assert.equal(created, 0);
});

test("repeated cleanup preserves feed/detail controls and removes only stale idle controls", () => {
  const setup = floatingControlFixture();
  const feed = setup.addControl("123", true);
  const stale = setup.addControl("999");
  for (let pass = 0; pass < 5; pass += 1) vm.runInContext("clearDownloadBtnContainers()", setup.context);
  assert.equal(feed.container.isConnected, true);
  assert.equal(stale.container.isConnected, false);
  const detail = setup.addControl("456");
  const oldDetail = setup.addControl("789");
  setup.context.window.location.pathname = "/@user/photo/456";
  for (let pass = 0; pass < 5; pass += 1) vm.runInContext("clearDownloadContainers()", setup.context);
  assert.equal(detail.container.isConnected, true);
  assert.equal(oldDetail.container.isConnected, false);
});

test("overlay cleanup waits for all active buttons and keeps idle controls while hovered", () => {
  const setup = floatingControlFixture();
  const control = setup.addControl("123");
  const hdButton = setup.context.document.createElement("button");
  control.container.appendChild(hdButton);
  control.button.dataset.downloadActive = "true";
  hdButton.dataset.downloadActive = "true";
  delete control.button.dataset.downloadActive;
  vm.runInContext("clearDownloadBtnContainers()", setup.context);
  assert.equal(control.container.isConnected, true);
  delete hdButton.dataset.downloadActive;
  const card = setup.context.document.createElement("div");
  let hovered = true;
  card.matches = () => hovered;
  card.contains = container => container === control.container;
  setup.context.activeProfileGridItem = card;
  vm.runInContext("clearDownloadBtnContainers()", setup.context);
  assert.equal(control.container.isConnected, true);
  hovered = false;
  vm.runInContext("clearDownloadBtnContainers()", setup.context);
  assert.equal(control.container.isConnected, false);
});

test("SD progress survives pointer exit and cleanup until completion feedback ends", async () => {
  for (const outcome of ["saved", "already", "failed"]) {
    const setup = floatingControlFixture();
    const control = setup.addControl("123");
    let settle;
    let progress;
    const pending = new Promise((resolve, reject) => { settle = () => outcome === "failed" ? reject(new Error("Save failed")) : resolve(outcome !== "already"); });
    Object.assign(setup.context, {
      button: control.button, item: { querySelectorAll: selector => selector.startsWith("button") ? [control.button] : [control.container] },
      downloadSingleMedia: (media, options) => { progress = options.onProgress; return pending; },
      updateStandardDownloadProgress: (button, media, status) => { button.textContent = `${status.progress * 100}%`; },
    });
    setup.context.document.createTextNode = text => ({ textContent: text });
    const code = uiSource.slice(uiSource.indexOf("async function runStandardDownload("), uiSource.indexOf("function getMediaQualityLabel("));
    const titles = uiSource.slice(uiSource.indexOf("function getResolutionDetails("), uiSource.indexOf("function getExperimentalHdSource("));
    vm.runInContext(titles + code, setup.context);
    const operation = vm.runInContext('runStandardDownload(button,{videoId:"123"},{reset(){button.textContent="Save";}})', setup.context);
    assert.equal(control.button.dataset.downloadActive, "true");
    progress({ phase: "fetch", progress: 0.5 });
    vm.runInContext('removeAllInjectedDownloadButtons(item); removeInjectedDownloadButton(item,"123"); clearDownloadBtnContainers();', setup.context);
    assert.equal(control.container.isConnected, true);
    assert.equal(control.button.textContent, "50%");
    settle();
    await operation;
    assert.equal(control.button.textContent, outcome === "saved" ? "Saved" : outcome === "already" ? "Already saved" : "Save failed");
    vm.runInContext("clearDownloadBtnContainers()", setup.context);
    assert.equal(control.container.isConnected, true);
    assert.equal(setup.timers[0].duration, 2000);
    setup.timers[0].callback();
    assert.equal(control.button.getAttribute("title"), t("standardTitle", { resolution: t("unknown") }));
    assert.equal(control.button.dataset.downloadActive, undefined);
    assert.equal(control.container.isConnected, false);
  }
});

test("HD progress and fallback feedback survive cleanup until the visual download ends", async () => {
  const setup = floatingControlFixture();
  const control = setup.addControl("123");
  let settle;
  let progress;
  const pending = new Promise(resolve => { settle = resolve; });
  Object.assign(setup.context, {
    button: control.button, item: { querySelectorAll: () => [control.container] },
    downloadSingleMedia: (media, options) => { progress = options.onProgress; return pending; },
    updateExperimentalHdProgress: (button, status) => { button.textContent = status.phase; },
    getExperimentalHdSource: () => null,
    setExperimentalHdIdleContent: button => { button.textContent = "HD"; },
  });
  setup.context.document.createTextNode = text => ({ textContent: text });
  const code = uiSource.slice(uiSource.indexOf("async function runExperimentalHdDownload("), uiSource.indexOf("function updateStandardDownloadProgress("));
  const titles = uiSource.slice(uiSource.indexOf("function getResolutionDetails("), uiSource.indexOf("function getExperimentalHdSource("));
  vm.runInContext(titles + code, setup.context);
  const operation = vm.runInContext('runExperimentalHdDownload(button,{videoId:"123"})', setup.context);
  progress({ phase: "fallback" });
  vm.runInContext("removeAllInjectedDownloadButtons(item); clearDownloadBtnContainers();", setup.context);
  assert.equal(control.container.isConnected, true);
  assert.equal(control.button.textContent, "fallback");
  settle();
  await operation;
  assert.equal(control.button.textContent, "Saved standard fallback");
  assert.equal(control.button.dataset.downloadActive, "true");
  assert.equal(setup.timers[0].duration, 2500);
  setup.timers[0].callback();
  assert.equal(control.button.getAttribute("title"), t("hdTitle", { resolution: t("unknown"), method: t("matchedStreams") }));
  assert.equal(control.container.isConnected, false);
});

test("native profile pagination is bounded and ignores confirmed completed IDs", async () => {
  const cards = ["1", "2", "3", "4"].map(id => ({
    getBoundingClientRect: () => ({ width: 100, height: 100 }),
    querySelector: () => ({ getAttribute: () => `/@user/video/${id}` }),
  }));
  const tab = { getAttribute: name => name === "aria-selected" ? "true" : null };
  const context = vm.createContext({
    AppState: { allItemsEverSeen: Object.fromEntries(["1", "2", "3", "4"].map(id => [id, { id, video: {} }])) },
    getAccountUsername: () => "user",
    getProgressiveListCheckpoint: () => ({ completed: ["1"], skipped: [] }),
    getTabSpans: async () => ({ videos: { closest: () => tab } }),
    document: { querySelectorAll: () => cards },
    signal: new AbortController().signal,
  });
  const code = uiSource.slice(uiSource.indexOf("function findAccountTab("), uiSource.indexOf("async function showAccountBatchDialog("));
  vm.runInContext(code, context);
  const result = await vm.runInContext('createNativeAccountPageLoader({kind:"videos",username:"user",scope:"videos:user"})("0",2,signal)', context);
  assert.deepEqual(Array.from(result.items, item => item.id), ["2", "3"]);
  assert.equal(result.cursor, "native:3");
});

test("native Likes, Favorites, and Reposts paginate their own grids instead of the Videos grid", async () => {
  for (const [kind, cardType] of [["liked", "user-liked-item"], ["favorites", "favorites-item"], ["reposts", "user-repost-item"]]) {
    const cards = ["1", "2", "3", "4"].map(id => ({
      getBoundingClientRect: () => ({ width: 100, height: 100 }),
      querySelector: () => ({ getAttribute: () => `/@user/video/${id}` }),
    }));
    const tab = { getAttribute: name => name === "aria-selected" ? "true" : null };
    const context = vm.createContext({
      AppState: { allItemsEverSeen: Object.fromEntries(["1", "2", "3", "4"].map(id => [id, { id, video: {} }])) },
      getAccountUsername: () => "user", getProgressiveListCheckpoint: () => ({ completed: ["1"], skipped: [] }),
      getTabSpans: async () => ({ [kind]: { closest: () => tab } }),
      document: { querySelectorAll: selector => {
        if (selector === '[class*="DivErrorContainer"], [class*="DivEmptyContainer"]') return [];
        assert.equal(selector, `div[data-e2e="${cardType}"]`); return cards;
      } },
      signal: new AbortController().signal, kind,
    });
    const code = uiSource.slice(uiSource.indexOf("function findAccountTab("), uiSource.indexOf("async function showAccountBatchDialog("));
    vm.runInContext(code, context);
    const result = await vm.runInContext('createNativeAccountPageLoader({kind,username:"user",scope:kind+":user"})("0",2,signal)', context);
    assert.deepEqual(Array.from(result.items, item => item.id), ["2", "3"], kind);
    assert.equal(result.cursor, "native:3", kind);
  }
});

test("zero-timeout tab discovery never waits for animation frames or observers", async () => {
  const context = vm.createContext({
    isOnProfileOrCollectionPage: () => ({}), getCurrentPageUsername: () => "user",
    window: { location: { pathname: "/@user" }, __UNIVERSAL_DATA_FOR_REHYDRATION__: { innerHTML: JSON.stringify({ __DEFAULT_SCOPE__: { "webapp.app-context": { user: { uniqueId: "user" } } } }) } },
    document: { querySelectorAll: () => [] },
    requestAnimationFrame: () => assert.fail("An immediate scan must not wait for a frame"),
    MutationObserver: class { constructor() { assert.fail("An immediate scan must not observe mutations"); } },
    setTimeout: () => assert.fail("An immediate scan must not start a timer"),
  });
  const code = utils.slice(utils.indexOf("export async function getTabSpans("), utils.indexOf("export function getRenderedPostsMetadata("))
    .replace("export async function ", "async function ");
  vm.runInContext(code, context);
  const result = await vm.runInContext("getTabSpans(0)", context);
  assert.equal(result.videos, null);
  assert.equal(result.liked, null);
});

test("Likes preparation completes with visible user-liked-item cards and no Videos grid", async () => {
  const tab = { getAttribute: name => name === "aria-selected" ? "true" : null };
  const cards = ["123", "456"].map(id => ({
    getBoundingClientRect: () => ({ width: 100, height: 150 }),
    querySelector: () => ({ getAttribute: () => `/@user/video/${id}` }),
  }));
  const context = vm.createContext({
    getTabSpans: async () => ({ liked: { closest: () => tab } }),
    document: { querySelectorAll: selector => {
      if (selector.includes("DivErrorContainer")) return [];
      assert.equal(selector, 'div[data-e2e="user-liked-item"]');
      return cards;
    } },
    signal: new AbortController().signal,
    MutationObserver: class { constructor() { assert.fail("Visible Likes should be ready immediately"); } },
  });
  const code = uiSource.slice(uiSource.indexOf("function findAccountTab("), uiSource.indexOf("function createNativeAccountPageLoader("));
  vm.runInContext(code, context);
  assert.equal(await vm.runInContext('inspectAccountList("liked",signal)', context), null);
});

test("private and empty lists are detected without reading stale posts or retrying", async () => {
  for (const [message, code] of [["This user's liked videos are private", "LIST_PRIVATE"], ["No videos yet", "LIST_EMPTY"]]) {
    let selected = false;
    const tab = { getAttribute: name => name === "aria-selected" ? String(selected) : null, click: () => { selected = true; } };
    const notice = { textContent: message, getBoundingClientRect: () => ({ width: 400, height: 100 }) };
    const context = vm.createContext({
      AppState: { allItemsEverSeen: {} }, getAccountUsername: () => "user",
      getTabSpans: async () => ({ liked: { closest: () => tab } }),
      getProgressiveListCheckpoint: () => null,
      document: { querySelectorAll: selector => selector.includes("DivErrorContainer") ? [notice] : [] },
      signal: new AbortController().signal,
      findFiberItemById: () => assert.fail("Private/empty lists must not read another tab's posts"),
    });
    const source = uiSource.slice(uiSource.indexOf("function findAccountTab("), uiSource.indexOf("function notifyDownloadBusy("));
    vm.runInContext(source, context);
    assert.equal((await vm.runInContext('inspectAccountList("liked",signal)', context)).code, code);
    if (code === "LIST_PRIVATE") {
      await assert.rejects(vm.runInContext('createNativeAccountPageLoader({kind:"liked",username:"user",scope:"liked:user"})("0",30,signal)', context), error => error.code === "LIST_PRIVATE");
    } else {
      const page = await vm.runInContext('createNativeAccountPageLoader({kind:"liked",username:"user",scope:"liked:user"})("0",30,signal)', context);
      assert.equal(page.items.length, 0);
      assert.equal(page.hasMore, false);
    }
  }
});

test("unselected or invisible private notices cannot block another list", () => {
  const notice = { textContent: "This user's liked videos are private", getBoundingClientRect: () => ({ width: 0, height: 0 }) };
  const context = vm.createContext({ document: { querySelectorAll: () => [notice] }, tab: { getAttribute: () => "true" } });
  const source = uiSource.slice(uiSource.indexOf("function getAccountListNotice("), uiSource.indexOf("function waitForAccountListChange("));
  vm.runInContext(source, context);
  assert.equal(vm.runInContext("getAccountListNotice(tab)", context), null);
  notice.getBoundingClientRect = () => ({ width: 400, height: 100 });
  context.tab = { getAttribute: () => "false" };
  assert.equal(vm.runInContext("getAccountListNotice(tab)", context), null);
});

test("private and empty list dialogs show Close without Start batches or a download job", async () => {
  for (const code of ["LIST_PRIVATE", "LIST_EMPTY"]) {
    const setup = progressFixture();
    setup.state.downloading.isDownloadingAll = false;
    const document = setup.context.document;
    document.getElementById = () => null;
    let modal;
    Object.assign(setup.context, {
      DOM_IDS: { MODAL_CONTAINER: "modal" }, window: { location: { href: "https://www.tiktok.com/@user" } },
      AbortController, DEFAULT_BATCH_SIZE: 30,
      inspectAccountList: async () => ({ code, message: code === "LIST_PRIVATE" ? "This list is private." : "This list has no posts to download." }),
      resolveAccountList: () => assert.fail("Blocked list must not resolve or fetch download pages"),
      createModal: ({ children }) => {
        modal = document.createElement("div");
        const box = document.createElement("div"); box.className = "ettpd-modal-box";
        box.append(...children); modal.appendChild(box); return modal;
      },
    });
    const source = uiSource.slice(uiSource.indexOf("function notifyDownloadBusy("), uiSource.indexOf("function makeAccountDownloadControl("));
    vm.runInContext(source, setup.context);
    await vm.runInContext('showAccountBatchDialog({kind:"liked",username:"user",title:"Likes"})', setup.context);
    const content = modal.querySelector(".ettpd-modal-box").children[0];
    assert.equal(content.children.find(child => child.tagName === "FORM").hidden, true);
    assert.equal(content.children.at(-1).textContent, "Close");
    assert.match(content.children[1].textContent, code === "LIST_PRIVATE" ? /private/ : /no posts/i);
    assert.equal(setup.state.downloading.accountBatch, undefined);
  }
});

test("Favorites uses matching signed-in identity after SPA navigation and handles empty detail responses", async () => {
  for (const ownContext of [true, false]) {
    const setup = progressFixture();
    setup.state.downloading.isDownloadingAll = false;
    const document = setup.context.document;
    const scope = { __DEFAULT_SCOPE__: {
      "webapp.user-detail": { userInfo: { user: { uniqueId: "previous-profile", secUid: "previous-subject" } } },
      "webapp.app-context": { user: { uniqueId: ownContext ? "current-user" : "different-user", secUid: "signed-in-subject" } },
    } };
    document.getElementById = id => id === "__UNIVERSAL_DATA_FOR_REHYDRATION__" ? { textContent: JSON.stringify(scope) } : null;
    const remembered = [];
    let fetched = 0;
    let modal;
    Object.assign(setup.context, {
      DOM_IDS: { MODAL_CONTAINER: "modal" }, window: { location: { href: "https://www.tiktok.com/@current-user" } },
      location: { origin: "https://www.tiktok.com" }, URL, URLSearchParams, AbortController, AbortSignal, DEFAULT_BATCH_SIZE: 30,
      inspectAccountList: async () => null,
      rememberAccountIdentity: profile => remembered.push(profile),
      resolveAccountList: () => {
        if (!remembered.length) throw new Error("Account details missing");
        return { kind: "favorites", scope: "favorites:signed-in-subject" };
      },
      getProgressiveListCheckpoint: () => null,
      fetch: async () => { fetched += 1; return { ok: true, json: async () => { throw new SyntaxError("Unexpected end of JSON input"); } }; },
      createModal: ({ children }) => {
        modal = document.createElement("div");
        const box = document.createElement("div"); box.className = "ettpd-modal-box";
        box.append(...children); modal.appendChild(box); return modal;
      },
    });
    const code = uiSource.slice(uiSource.indexOf("function notifyDownloadBusy("), uiSource.indexOf("function makeAccountDownloadControl("));
    vm.runInContext(code, setup.context);
    await vm.runInContext('showAccountBatchDialog({kind:"favorites",username:"current-user",title:"Favorites"})', setup.context);
    const content = modal.querySelector(".ettpd-modal-box").children[0];
    const form = content.children.find(child => child.tagName === "FORM");
    if (ownContext) {
      assert.equal(remembered.length, 1);
      assert.equal(remembered[0].uniqueId, "current-user");
      assert.equal(fetched, 0);
      assert.equal(form.hidden, false);
    } else {
      assert.equal(remembered.length, 0);
      assert.equal(fetched, 1);
      assert.equal(form.hidden, true);
      assert.equal(content.children[1].textContent, t("unavailable"));
      assert.doesNotMatch(content.children[1].textContent, /Unexpected end|Response|json/);
    }
  }
});

test("empty feed discovery recovers already-loaded detail metadata and forces the empty list to render", async () => {
  const source = await readFile(new URL("../src/modules/downloader/handlers.js", import.meta.url), "utf8");
  const item = { id: "123", video: { playAddr: "https://cdn/video" } };
  const state = { allItemsEverSeen: {}, debug: { active: false } };
  const renders = [];
  const context = vm.createContext({
    AppState: state, normId: item => String(item?.id || ""),
    isVisitedItemBetterOrNew: item => !state.allItemsEverSeen[item.id],
    isBetterCopy: (item, previous) => !previous,
    getUniversalDataScope: () => ({ "webapp.video-detail": { itemInfo: { itemStruct: item } } }),
    rememberAccountIdentity() {}, displayFoundUrls: options => renders.push(options),
  });
  const code = source.slice(source.indexOf("export function handleFoundItems("), source.indexOf('document.addEventListener("DOMContentLoaded"'))
    .replace("export function ", "function ");
  vm.runInContext(code, context);
  vm.runInContext("handleFoundItems([])", context);
  assert.equal(state.allItemsEverSeen["123"], item);
  assert.equal(renders.at(-1).forced, true);
  state.allItemsEverSeen = {};
  vm.runInContext("handleFoundItems([])", context);
  assert.equal(state.allItemsEverSeen["123"], item, "Reset must not require another network response");
  assert.equal(renders.at(-1).forced, true);
});

test("DOM polling lets the ingestion owner detect richer metadata and force a render", async () => {
  const handlers = await readFile(new URL("../src/modules/downloader/handlers.js", import.meta.url), "utf8");
  const polling = await readFile(new URL("../src/modules/polling/polling.js", import.meta.url), "utf8");
  const previous = { id: "123", video: { width: 720 } };
  const improved = { id: "123", video: { width: 1080 } };
  const state = { allItemsEverSeen: { "123": previous }, debug: { active: false } };
  const renders = [];
  const isBetter = (item, cached) => !cached || item.video.width > cached.video.width;
  const context = vm.createContext({
    AppState: state, isExtensionEnabled: () => true, window: {}, document: { getElementById: () => null },
    getCurrentPlayingArticle: () => ({}), getClosestPlayingVideoId: () => "123", findFiberItemById: () => null,
    getRenderedPostsMetadata: () => [improved], normId: item => String(item?.id || ""),
    isVisitedItemBetterOrNew: item => isBetter(item, state.allItemsEverSeen[item.id]), isBetterCopy: isBetter,
    getUniversalDataScope: () => ({}), rememberAccountIdentity() {}, displayFoundUrls: options => renders.push(options),
    console: { log() {}, warn() {}, error: error => { throw error; } },
  });
  const ingestion = handlers.slice(handlers.indexOf("export function handleFoundItems("), handlers.indexOf('document.addEventListener("DOMContentLoaded"'));
  const poll = polling.slice(polling.indexOf("export function pollInitialData()"), polling.indexOf("async function pollPlaylistData()"));
  vm.runInContext((ingestion + poll).replaceAll("export function ", "function "), context);
  vm.runInContext("pollInitialData()", context);
  assert.equal(state.allItemsEverSeen["123"], improved);
  assert.ok(renders.some(options => options.forced), "Identical post IDs with richer data must still force rendering");
});

test("the currently playing root prefers visible active media over offscreen blob players", () => {
  const source = utils.slice(utils.indexOf("export function getCurrentPlayingArticle()"), utils.indexOf("export function getUsernameFromPlayingArticle()"))
    .replace("export function ", "function ");
  const mainRoot = {}, previewRoot = {}, oldRoot = {};
  const video = (root, paused, top, width, height, article = true) => ({
    paused, ended: false, parentElement: root,
    getBoundingClientRect: () => ({ top, bottom: top + height, left: 0, right: width, width, height }),
    closest: selector => selector.startsWith("article") ? article ? root : null : root,
  });
  const offscreen = video(oldRoot, false, -1000, 400, 600);
  const preview = video(previewRoot, false, 0, 100, 100);
  const main = video(mainRoot, false, 0, 400, 600, false);
  const context = vm.createContext({
    window: { innerWidth: 1200, innerHeight: 800 }, AppState: { debug: { active: false } },
    document: { querySelectorAll: () => [offscreen, preview, main], querySelector: () => null },
  });
  vm.runInContext(source, context);
  assert.equal(vm.runInContext("getCurrentPlayingArticle()", context), mainRoot);
  main.paused = true;
  assert.equal(vm.runInContext("getCurrentPlayingArticle()", context), previewRoot);
  preview.paused = true;
  assert.equal(vm.runInContext("getCurrentPlayingArticle()", context), mainRoot);
});

test("detail-page discovery uses the exact route post ID rather than nearby sidebar IDs", () => {
  const code = utils.slice(utils.indexOf("export function getClosestPlayingVideoId()"), utils.indexOf("export function shouldShowRatePopupLegacy()"))
    .replace("export function ", "function ");
  const context = vm.createContext({
    window: { location: { pathname: "/@user/video/123456789" } },
    getCurrentPlayingArticle: () => ({}), getNearById: () => "unrelated-sidebar",
  });
  vm.runInContext(code, context);
  assert.equal(vm.runInContext("getClosestPlayingVideoId()", context), "123456789");
  context.window.location.pathname = "/@user/photo/987654321";
  assert.equal(vm.runInContext("getClosestPlayingVideoId()", context), "987654321");
});

test("player readiness requests immediate discovery while coalescing UI frames", async () => {
  const source = await readFile(new URL("../src/modules/polling/polling.js", import.meta.url), "utf8");
  const code = source.slice(source.indexOf("function scheduleUITasks("), source.indexOf("/**\n * Detects any new video data"));
  const frames = [];
  const task = { name: "initial-data", lastRun: 100 };
  let enabled = true;
  const context = vm.createContext({
    uiFrameHandle: null, uiTasks: [task], isExtensionEnabled: () => enabled,
    window: { innerWidth: 1200, innerHeight: 800, requestAnimationFrame: callback => { frames.push(callback); return frames.length; } },
    videoEvent: { target: { tagName: "VIDEO", getBoundingClientRect: () => ({ top: 0, bottom: 300, left: 0, right: 200, width: 200, height: 300 }) } },
    document: { addEventListener() {} }, runScheduledUITasks() {},
  });
  vm.runInContext(code, context);
  vm.runInContext("scheduleMediaDataDiscovery(videoEvent);scheduleMediaDataDiscovery(videoEvent)", context);
  assert.equal(task.lastRun, -Infinity);
  assert.equal(frames.length, 1);
  task.lastRun = 200;
  enabled = false;
  vm.runInContext("scheduleMediaDataDiscovery(videoEvent)", context);
  assert.equal(task.lastRun, 200);
  enabled = true;
  context.videoEvent.target.getBoundingClientRect = () => ({ top: -400, bottom: -100, left: 0, right: 200, width: 200, height: 300 });
  vm.runInContext("scheduleMediaDataDiscovery(videoEvent)", context);
  assert.equal(task.lastRun, 200, "Offscreen preloading must not invalidate discovery timing");
});

test("feed ingestion remembers post authors even when media copies do not improve", async () => {
  const source = await readFile(new URL("../src/modules/downloader/handlers.js", import.meta.url), "utf8");
  const scope = {
    "webapp.video-detail": { itemInfo: { itemStruct: { id: "902", author: { uniqueId: "ingested-detail-author", secUid: "detail-subject" } } } },
    "webapp.updated-items": [{ id: "903", author: { uniqueId: "ingested-update-author", secUid: "update-subject" } }],
  };
  const context = vm.createContext({
    AppState: { allItemsEverSeen: {}, debug: { active: false } },
    normId: item => String(item?.id || ""), isVisitedItemBetterOrNew: () => false, isBetterCopy: () => false,
    getUniversalDataScope: () => scope, rememberAccountIdentity: accountLists.rememberAccountIdentity, displayFoundUrls() {},
    items: [{ id: "901", author: { uniqueId: "ingested-feed-author", secUid: "feed-subject" } }],
  });
  const code = source.slice(source.indexOf("export function handleFoundItems("), source.indexOf('document.addEventListener("DOMContentLoaded"'))
    .replace("export function ", "function ");
  vm.runInContext(code, context);
  vm.runInContext("handleFoundItems(items)", context);
  for (const [username, subject] of [["ingested-feed-author", "feed-subject"], ["ingested-detail-author", "detail-subject"], ["ingested-update-author", "update-subject"]]) {
    const list = accountLists.resolveAccountList({ kind: "reposts", username, origin: "https://www.tiktok.com" });
    assert.equal(list.subject, subject);
  }
});

test("other-account Reposts dialogs recover exact feed, runtime, or live-header identity without detail requests", async () => {
  for (const identitySource of ["feed", "runtime", "header", "unrelated"]) {
    const setup = progressFixture();
    setup.state.downloading.isDownloadingAll = false;
    const username = `navigation-${identitySource}-author`;
    const author = { uniqueId: username, secUid: `navigation-${identitySource}-subject` };
    setup.state.allItemsEverSeen = {
      "901": { author: identitySource === "feed" ? author : identitySource === "header" ? username : { uniqueId: "unrelated-feed-author", secUid: "unrelated-subject" } },
    };
    const scope = { __DEFAULT_SCOPE__: {
      "webapp.user-detail": { userInfo: { user: { uniqueId: "old-profile", secUid: "old-subject" } } },
      "webapp.app-context": { user: { uniqueId: "signed-in-other-user", secUid: "signed-in-subject" } },
    } };
    const document = setup.context.document;
    document.getElementById = id => id === "__UNIVERSAL_DATA_FOR_REHYDRATION__" ? { textContent: JSON.stringify(scope) } : null;
    document.querySelector = () => identitySource === "header" ? {} : null;
    let fetched = 0;
    let modal;
    let resolved;
    Object.assign(setup.context, {
      DOM_IDS: { MODAL_CONTAINER: "modal" }, window: {
        location: { href: `https://www.tiktok.com/@${username}` },
        __$UNIVERSAL_DATA$__: { __DEFAULT_SCOPE__: { "webapp.user-detail": { userInfo: { user: identitySource === "runtime" ? author : null } } } },
      },
      location: { origin: "https://www.tiktok.com" }, URL, URLSearchParams, AbortController, AbortSignal, DEFAULT_BATCH_SIZE: 30,
      inspectAccountList: async () => null, rememberAccountIdentity: accountLists.rememberAccountIdentity,
      getReactFiberNode: () => ({ memoizedProps: { detailInfo: { user: author } } }),
      resolveAccountList: descriptor => { resolved = accountLists.resolveAccountList({ ...descriptor, origin: "https://www.tiktok.com" }); return resolved; },
      getProgressiveListCheckpoint: () => null,
      fetch: async () => { fetched += 1; return { ok: false, status: 403 }; },
      createModal: ({ children }) => {
        modal = document.createElement("div");
        const box = document.createElement("div"); box.className = "ettpd-modal-box";
        box.append(...children); modal.appendChild(box); return modal;
      }, username,
    });
    const code = uiSource.slice(uiSource.indexOf("function notifyDownloadBusy("), uiSource.indexOf("function makeAccountDownloadControl("));
    vm.runInContext(code, setup.context);
    await vm.runInContext('showAccountBatchDialog({kind:"reposts",username,title:"Reposts"})', setup.context);
    const content = modal.querySelector(".ettpd-modal-box").children[0];
    const form = content.children.find(child => child.tagName === "FORM");
    if (identitySource === "unrelated") {
      assert.equal(fetched, 1);
      assert.equal(form.hidden, true);
      assert.equal(resolved, undefined);
    } else {
      assert.equal(fetched, 0);
      assert.equal(form.hidden, false);
      assert.equal(resolved.subject, author.secUid);
    }
  }
});

test("live profile identity lookup is bounded and rejects unrelated accounts", () => {
  let profile = { uniqueId: "current-author", secUid: "current-subject" };
  let depth = 8;
  const context = vm.createContext({
    document: { querySelector: () => ({}) },
    getReactFiberNode: () => {
      let fiber = { memoizedProps: { detailInfo: { user: profile } } };
      for (let index = 0; index < depth; index += 1) fiber = { memoizedProps: {}, return: fiber };
      return fiber;
    },
  });
  const code = uiSource.slice(uiSource.indexOf("function getCurrentProfileIdentity("), uiSource.indexOf("async function showAccountBatchDialog("));
  vm.runInContext(code, context);
  assert.equal(vm.runInContext('getCurrentProfileIdentity("CURRENT-AUTHOR")', context), profile);
  assert.equal(vm.runInContext('getCurrentProfileIdentity("other-author")', context), null);
  depth = 24;
  assert.equal(vm.runInContext('getCurrentProfileIdentity("current-author")', context), null);
  depth = 8;
  profile = { uniqueId: "current-author" };
  assert.equal(vm.runInContext('getCurrentProfileIdentity("current-author")', context), null);
});

test("native Likes fallback rejects a stale Videos grid after the tab is clicked", async () => {
  let selected = false;
  const tab = { getAttribute: name => name === "aria-selected" ? String(selected) : null, click: () => { selected = true; } };
  const context = vm.createContext({
    AppState: { allItemsEverSeen: {} }, getAccountUsername: () => "user",
    getTabSpans: async () => ({ liked: { closest: () => tab } }),
    document: {
      documentElement: {},
      querySelectorAll: () => [{ getBoundingClientRect: () => ({ width: 100, height: 100 }), querySelector: () => ({ getAttribute: () => "/@user/video/1" }) }],
    },
    MutationObserver: class { observe() {} disconnect() {} },
    setTimeout: callback => setTimeout(callback, 0), clearTimeout,
    signal: new AbortController().signal,
    findFiberItemById: () => assert.fail("Must not read the previous tab's media"),
  });
  const code = uiSource.slice(uiSource.indexOf("function findAccountTab("), uiSource.indexOf("async function showAccountBatchDialog("));
  vm.runInContext(code, context);
  await assert.rejects(vm.runInContext('createNativeAccountPageLoader({kind:"liked",username:"user",scope:"liked:user"})("0",30,signal)', context), /not opened/);
});

test("native progressive response suppression remains scoped to its exact account/list", () => {
  const origin = "https://www.tiktok.com";
  const source = accountLists.resolveAccountList({ kind: "videos", username: "native-scope-user", origin, profile: { uniqueId: "native-scope-user", secUid: "native-only-subject" } });
  accountLists.setNativeProgressiveList(source);
  assert.equal(accountLists.isProgressiveListRequest(`${origin}/api/post/item_list/?secUid=native-only-subject&cursor=999&count=30`, origin), true);
  assert.equal(accountLists.isProgressiveListRequest(`${origin}/api/post/item_list/?secUid=another-account&cursor=999&count=30`, origin), false);
  accountLists.setNativeProgressiveList(null);
  assert.equal(accountLists.isProgressiveListRequest(`${origin}/api/post/item_list/?secUid=native-only-subject&cursor=999&count=30`, origin), false);
});

test("pay-it-forward dialog is local, accessible, deduplicated, and dismissible in both themes", async () => {
  const source = (await readFile(new URL("../src/modules/utils/payItForward.js", import.meta.url), "utf8"))
    .replace(/^import .*;\n/gm, "").replaceAll("export function ", "function ");
  for (const dark of [false, true]) {
    const setup = progressFixture();
    const document = setup.context.document;
    const create = document.createElement;
    let mounted;
    document.getElementById = id => mounted?.id === id ? mounted : null;
    document.body = { appendChild: element => { mounted = element; } };
    document.createElement = tag => {
      const element = create(tag);
      if (tag === "dialog") {
        element.showModal = () => { element.open = true; };
        element.focus = () => { element.focused = true; };
        element.remove = () => { mounted = null; };
        element.close = () => { element.open = false; element.listeners.get("close")(); };
      }
      return element;
    };
    setup.context.dark = dark;
    const supportStorage = new Map();
    const supportRequests = [];
    setup.context.localStorage = {
      getItem: key => supportStorage.get(key) ?? null,
      setItem: (key, value) => supportStorage.set(key, value),
    };
    setup.context.AppStateETTVD = { rateDonate: {} };
    setup.context.chrome = {
      runtime: { id: "extension", sendMessage: (request, callback) => { supportRequests.push(request); callback(); } },
    };
    vm.runInContext(source, setup.context);
    const dialog = vm.runInContext("showPayItForwardDialog({dark})", setup.context);
    assert.ok(Number(supportStorage.get("tik.tok::lastSupportedAt")) > 0);
    assert.equal(setup.context.AppStateETTVD.rateDonate.lastSupportedAt, Number(supportStorage.get("tik.tok::lastSupportedAt")));
    assert.equal(supportRequests[0].action, "recordSupportClick");
    assert.equal(setup.context.AppStateETTVD.rateDonate.lastDonatedAt, undefined);
    assert.equal(dialog.open, true);
    assert.equal(dialog.getAttribute("aria-labelledby"), "ettpd-pay-it-forward-title");
    assert.match(dialog.textContent, /No tip needed/);
    assert.match(dialog.textContent, /Small kindnesses count/);
    assert.doesNotMatch(dialog.textContent, /https?:|linktr/i);
    assert.equal(vm.runInContext("showPayItForwardDialog({dark})", setup.context), dialog);
    assert.equal(dialog.focused, true);
    dialog.children.at(-1).listeners.get("click")();
    assert.equal(mounted, null);
  }
  assert.doesNotMatch(uiSource, /linktr\.ee/i);
  assert.doesNotMatch(uiSource, /aimuhire/i);
  assert.ok(uiSource.includes('coffeeLink.textContent = "buy me a coffee ☕"'));
  assert.ok(uiSource.includes('coffeeBtn.textContent = "☕ Tip/Coffee Jar"'));
  assert.ok(uiSource.includes('redPill.textContent = "🔴 Support"'));
  assert.doesNotMatch(await readFile(new URL("../src/popup/popup.js", import.meta.url), "utf8"), /aimuhire/i);
  assert.doesNotMatch(await readFile(new URL("../src/popup/popup.html", import.meta.url), "utf8"), /aimuhire/i);
  assert.doesNotMatch(await readFile(new URL("../src/popup/popup.js", import.meta.url), "utf8"), /linktr\.ee/i);
  assert.doesNotMatch(await readFile(new URL("../src/popup/popup.html", import.meta.url), "utf8"), /linktr\.ee/i);
});

function reviewPromptFixture() {
  let now = 1800000000000;
  let sequence = 0;
  let statuses = [{ id: 1, state: "complete" }];
  const timers = new Map();
  const stored = new Map();
  const shown = [];
  const state = {
    ui: { reviewPendingDownloadIds: [1] }, downloading: {}, scrapperDetails: {},
    rateDonate: { lastRatedAt: null, lastSupportedAt: null, lastDonatedAt: null, lastShownAt: null, shownCount: 0 },
    leaderboard: { allTimeDownloadsCount: 1, weekDownloadsData: { count: 1, weekId: "2026-W44" } },
  };
  const document = { hidden: false, querySelector: () => null };
  const recovery = { runningFiles: 0, operation: null };
  const context = vm.createContext({
    AppState: state, downloadRecovery: recovery, document, activeAccountBatch: null, rateDonatePopupTimer: null,
    Date: class extends Date { static now() { return now; } },
    localStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) },
    STORAGE_KEYS: { LAST_AUTOMATIC_POPUP_AT: "automatic", RATE_DONATE_DATA: "review" },
    isExtensionEnabledSync: () => true,
    hasSupportCooldown: (donated, supported) => [donated, supported, Number(stored.get("support"))].some(value => value > 0 && now - value < 90 * 86400000),
    setTimeout: (callback, delay) => { const id = ++sequence; timers.set(id, { callback, delay }); return id; },
    getDownloadStatuses: async () => statuses,
    showRateUsPopUpLegacy: () => shown.push("regular"),
    hideDownloader() {}, showCelebration() {}, getExtensionReviewTarget: () => ({ url: "unused" }),
    createModalMorpheus: () => shown.push("morpheus"), console: { warn() {} },
  });
  const automatic = utils.slice(utils.indexOf("let lastAutomaticPopupAt ="), utils.indexOf("export function makeOverlay("));
  const eligibility = utils.slice(utils.indexOf("function reviewOperationIsIdle()"), utils.indexOf("export async function getTabSpans("));
  const legacy = utils.slice(utils.indexOf("export function shouldShowRatePopupLegacy()"), utils.indexOf("// 🧰 2)"));
  const morpheus = uiSource.slice(uiSource.indexOf("export function showMorpheusRateUsPage()"), uiSource.indexOf("export function createModalMorpheus("));
  vm.runInContext((automatic + eligibility + legacy + morpheus).replaceAll("export function ", "function "), context);
  return {
    state, context, stored, shown, timers, document, recovery,
    advance: milliseconds => { now += milliseconds; },
    statuses: value => { statuses = value; },
    schedule: () => vm.runInContext("scheduleReviewPopup()", context),
    eligible: () => vm.runInContext("shouldShowRateDonatePopup()", context),
    legacy: () => vm.runInContext("shouldShowRatePopupLegacy()", context),
    async fire() {
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      now += timer.delay;
      await timer.callback();
    },
  };
}

test("successful recovery-owned operations schedule reviews only after cleanup, never for skipped or stopped work", async () => {
  const code = utils.slice(utils.indexOf("async function runRecoveryOperation("), utils.indexOf("export function getProgressiveListCheckpoint("));
  for (const result of [true, 2, { stopped: false }, false, 0, { stopped: true }, "error"]) {
    const setup = fixture();
    let scheduled = 0;
    const context = vm.createContext({
      downloadRecovery: setup.recovery, activeAccountBatch: null,
      window: { location: { href: "https://www.tiktok.com/@user/video/123" } },
      AppState: { downloadPreferences: {}, scrapperDetails: {} },
      scheduleReviewPopup: () => { assert.equal(setup.recovery.operation, null); scheduled += 1; },
      callback: async () => { assert.ok(setup.recovery.operation); assert.equal(scheduled, 0); if (result === "error") throw new Error("failed"); return result; },
    });
    vm.runInContext(code, context);
    const operation = vm.runInContext('runRecoveryOperation([{videoId:"123"}],{},callback)', context);
    if (result === "error") await assert.rejects(operation, /failed/);
    else await operation;
    assert.equal(scheduled, result !== "error" && result !== false && result !== 0 && !result.stopped ? 1 : 0);
  }
});

test("review prompts require completed browser saves and share one delayed scheduler", async () => {
  const fixture = reviewPromptFixture();
  assert.equal(fixture.eligible(), false);
  assert.equal(fixture.schedule(), true);
  assert.equal(fixture.schedule(), false);
  assert.equal(fixture.timers.size, 1);
  await fixture.fire();
  assert.equal(fixture.state.ui.isRatePopupOpen, true);
  assert.equal(fixture.stored.has("automatic"), false, "Pending Morpheus must not consume daily cooldown");
  assert.deepEqual(fixture.shown, []);
  await fixture.fire();
  assert.deepEqual(fixture.shown, ["morpheus"]);
  assert.ok(Number(fixture.stored.get("automatic")) > 0);
  assert.equal(fixture.state.rateDonate.shownCount, 1);
});

test("interrupted, unknown and in-progress saves cannot trigger a review prompt", async () => {
  for (const state of ["interrupted", "in_progress", null]) {
    const fixture = reviewPromptFixture();
    fixture.statuses(state ? [{ id: 1, state }] : []);
    fixture.schedule();
    for (let attempts = 0; fixture.timers.size && attempts < 5; attempts += 1) await fixture.fire();
    assert.deepEqual(fixture.shown, [], String(state));
    assert.equal(fixture.timers.size, 0, "Status checks must be bounded");
    assert.equal(fixture.stored.has("automatic"), false);
  }
});

test("progressive and scraper jobs suppress reviews until their operations are idle", () => {
  const fixture = reviewPromptFixture();
  vm.runInContext("activeAccountBatch = {}", fixture.context);
  assert.equal(fixture.schedule(), false);
  vm.runInContext("activeAccountBatch = null", fixture.context);
  fixture.state.scrapperDetails.scrappingStage = "ongoing";
  assert.equal(fixture.schedule(), false);
  fixture.state.scrapperDetails.scrappingStage = "completed";
  fixture.recovery.runningFiles = 1;
  assert.equal(fixture.schedule(), false);
  fixture.recovery.runningFiles = 0;
  fixture.recovery.operation = {};
  assert.equal(fixture.schedule(), false);
  fixture.recovery.operation = null;
  assert.equal(fixture.schedule(), true);
});

test("cancelled delayed Morpheus does not record a display or consume shared cooldown", async () => {
  for (const reason of ["hidden", "download", "modal", "support", "rated", "stopped"]) {
    const fixture = reviewPromptFixture();
    fixture.schedule(); await fixture.fire();
    if (reason === "hidden") fixture.document.hidden = true;
    if (reason === "download") fixture.state.downloading.isActive = true;
    if (reason === "modal") fixture.document.querySelector = () => ({});
    if (reason === "support") fixture.state.rateDonate.lastSupportedAt = 1800000000000;
    if (reason === "rated") fixture.state.rateDonate.lastRatedAt = 1800000000000;
    if (reason === "stopped") fixture.state.ui.reviewStopCount = 1;
    await fixture.fire();
    assert.deepEqual(fixture.shown, [], reason);
    assert.equal(fixture.state.ui.isRatePopupOpen, false, reason);
    assert.equal(fixture.stored.has("automatic"), false, reason);
    assert.equal(fixture.state.rateDonate.shownCount, 0, reason);
  }
});

test("stopping while browser confirmation is pending cancels review selection", async () => {
  const fixture = reviewPromptFixture();
  let release;
  fixture.context.getDownloadStatuses = () => new Promise(resolve => { release = resolve; });
  fixture.schedule();
  const checking = fixture.fire();
  fixture.state.ui.reviewStopCount = 1;
  release([{ id: 1, state: "complete" }]);
  await checking;
  assert.deepEqual(fixture.shown, []);
  assert.equal(fixture.timers.size, 0);
  assert.equal(fixture.stored.has("automatic"), false);
});

test("regular milestone reviews use rateDonate cooldowns and exclude Morpheus selection", async () => {
  const fixture = reviewPromptFixture();
  fixture.state.ui.reviewHasConfirmedDownload = true;
  fixture.state.leaderboard.allTimeDownloadsCount = 25;
  let eligibleWeek;
  for (let week = 0; week < 100; week += 1) {
    fixture.state.leaderboard.weekDownloadsData.weekId = `week-${week}`;
    if (fixture.legacy()) { eligibleWeek = week; break; }
  }
  assert.notEqual(eligibleWeek, undefined);
  fixture.state.rateDonate.lastShownAt = 1800000000000 - 89 * 86400000;
  assert.equal(fixture.legacy(), false);
  fixture.state.rateDonate.lastShownAt = 1800000000000 - 90 * 86400000;
  assert.equal(fixture.legacy(), true);
  fixture.schedule(); await fixture.fire();
  assert.deepEqual(fixture.shown, ["regular"]);
  assert.equal(fixture.timers.size, 0);
});

test("the actual regular review popup records both its display and review click in shared state", () => {
  const fixture = reviewPromptFixture();
  fixture.state.ui.reviewHasConfirmedDownload = true;
  fixture.state.leaderboard.allTimeDownloadsCount = 25;
  for (let week = 0; week < 100; week += 1) {
    fixture.state.leaderboard.weekDownloadsData.weekId = `week-${week}`;
    if (fixture.legacy()) break;
  }
  assert.equal(fixture.legacy(), true);
  let mounted;
  const listeners = new Map();
  const anchor = { addEventListener: (name, callback) => listeners.set(name, callback) };
  fixture.document.createElement = () => ({ style: {}, appendChild() {}, querySelector: () => anchor, remove() {} });
  fixture.document.body = { appendChild: element => { mounted = element; } };
  fixture.context.replaceElementHtml = () => {};
  fixture.context.escapeHtml = value => value;
  const source = uiSource.slice(uiSource.indexOf("export function showRateUsPopUpLegacy()"), uiSource.indexOf("export function showStatsPopUp()"))
    .replace("export function ", "function ");
  vm.runInContext(source, fixture.context);
  assert.equal(vm.runInContext("showRateUsPopUpLegacy()", fixture.context), true);
  assert.equal(fixture.state.rateDonate.shownCount, 1);
  assert.ok(fixture.state.rateDonate.lastShownAt);
  assert.equal(fixture.state.ui.isRatePopupOpen, true);
  listeners.get("click")();
  mounted.onclick();
  assert.ok(fixture.state.rateDonate.lastRatedAt);
  assert.equal(JSON.parse(fixture.stored.get("review")).lastRatedAt, fixture.state.rateDonate.lastRatedAt);
  assert.equal(fixture.state.ui.isRatePopupOpen, false);
  fixture.advance(31 * 86400000);
  assert.equal(fixture.eligible(), false, "Review clicks enforce 90 days, not only dismissal backoff");
});

test("review cooldown backoff and shared 24-hour limit use the same eligibility for both prompts", () => {
  const fixture = reviewPromptFixture();
  fixture.state.ui.reviewHasConfirmedDownload = true;
  fixture.state.ui.reviewPendingDownloadIds = [];
  for (const [count, days] of [[1, 3], [2, 7], [3, 14], [4, 14], [5, 30]]) {
    fixture.state.rateDonate.shownCount = count;
    fixture.state.rateDonate.lastShownAt = 1800000000000 - days * 86400000 + 1;
    assert.equal(fixture.eligible(), false);
    fixture.state.rateDonate.lastShownAt -= 1;
    assert.equal(fixture.eligible(), true);
  }
  fixture.stored.set("automatic", String(1800000000000));
  assert.equal(fixture.eligible(), false);
  fixture.advance(86400000);
  assert.equal(fixture.eligible(), true);
});

test("support clicks grant the donation-equivalent 90-day cooldown even before the first prompt", async () => {
  const code = (await readFile(new URL("../src/modules/utils/payItForward.js", import.meta.url), "utf8")).replace(/^import .*;\n/gm, "").replaceAll("export function ", "function ");
  const now = 1800000000000;
  const storage = new Map([["tik.tok::lastSupportedAt", String(now)]]);
  const state = { ui: { reviewHasConfirmedDownload: true }, leaderboard: { newlyConfirmedMedia: [{}] }, rateDonate: { lastShownAt: null, shownCount: 0 } };
  const context = vm.createContext({
    Date: { now: () => now }, localStorage: { getItem: key => storage.get(key) ?? null },
    AppState: state, activeAccountBatch: null, canShowAutomaticPopup: () => true,
    reviewOperationIsIdle: () => true,
  });
  const eligibility = utils.slice(utils.indexOf("function shouldShowRateDonatePopup()"), utils.indexOf("export async function getTabSpans("));
  vm.runInContext(code + eligibility, context);
  assert.equal(vm.runInContext("shouldShowRateDonatePopup()", context), false);
  storage.set("tik.tok::lastSupportedAt", String(now - 90 * 86400000 + 1));
  assert.equal(vm.runInContext("hasSupportCooldown()", context), true);
  storage.set("tik.tok::lastSupportedAt", String(now - 90 * 86400000));
  assert.equal(vm.runInContext("hasSupportCooldown()", context), false);
  assert.equal(vm.runInContext("shouldShowRateDonatePopup()", context), true);
  state.rateDonate.lastDonatedAt = now;
  assert.equal(vm.runInContext("shouldShowRateDonatePopup()", context), false);
});

test("support click background action stores a local timestamp for every extension page", async () => {
  const code = background.slice(background.indexOf('  if (action === "recordSupportClick")'), background.indexOf('  if (action === "getDownloadStatuses")'));
  let result;
  let stored;
  const context = vm.createContext({
    action: "recordSupportClick", sender: { id: "extension" }, KEEP_ALIVE: true,
    Date: { now: () => 1800000000000 },
    finish: response => { result = response; },
    makeError: (code, error) => ({ code, error }),
    chrome: { runtime: { id: "extension" }, storage: { local: { set: (values, callback) => { stored = values; callback(); } } } },
  });
  vm.runInContext(`(() => { ${code} })()`, context);
  assert.equal(stored["tik.tok::lastSupportedAt"], 1800000000000);
  assert.equal(result.success, true);
  assert.equal(result.timestamp, 1800000000000);
});

test("Morpheus retains its original invitation, line breaks, emphasis and pill labels", () => {
  const prompt = uiSource.slice(uiSource.indexOf("export function showMorpheusRateUsPage()"), uiSource.indexOf("export function createModalMorpheus("));
  assert.ok(prompt.includes(`message: \`<div class="ettpd-morpheus-message">
  You've just seen how good this downloader is.<br>
  Now it's your turn to support the mission.<br><br>
  <strong>Take the red pill ☕ — fuel us.<br>
  Take the blue pill ⭐ — rate us.</strong>
</div>\``));
  assert.doesNotMatch(prompt, /reviewInvitation/);
  const modal = uiSource.slice(uiSource.indexOf("export function createModalMorpheus("), uiSource.indexOf("export function createFilenameTemplateModal("));
  assert.ok(modal.includes('bluePill.textContent = "🔵 Rate"'));
  assert.ok(modal.includes('redPill.textContent = "🔴 Support"'));
  assert.doesNotMatch(modal, /reviewInvitation/);
});

test("a support click prevents an already delayed Morpheus prompt from opening", () => {
  const code = uiSource.slice(uiSource.indexOf("export function showMorpheusRateUsPage()"), uiSource.indexOf("export function createModalMorpheus("))
    .replace("export function ", "function ");
  let supported = false;
  let callback;
  let shown = 0;
  const state = { ui: {}, rateDonate: {}, downloading: {} };
  const context = vm.createContext({
    AppState: state, hasSupportCooldown: () => supported, claimAutomaticPopup: () => true,
    shouldShowRateDonatePopup: () => !supported,
    getExtensionReviewTarget: () => ({ url: "unused" }), hideDownloader() {}, showCelebration() {},
    setTimeout: handler => { callback = handler; }, isExtensionEnabledSync: () => true,
    document: { hidden: false, querySelector: () => null }, createModalMorpheus: () => { shown += 1; },
  });
  vm.runInContext(code, context);
  vm.runInContext("showMorpheusRateUsPage()", context);
  assert.equal(state.ui.isRatePopupOpen, true);
  supported = true;
  callback();
  assert.equal(shown, 0);
  assert.equal(state.ui.isRatePopupOpen, false);
  callback = null;
  vm.runInContext("showMorpheusRateUsPage()", context);
  assert.equal(callback, null);
});

test("popup support timestamps reach open TikTok tabs and newly loaded pages", async () => {
  const helper = (await readFile(new URL("../src/modules/utils/payItForward.js", import.meta.url), "utf8")).replace(/^import .*;\n/gm, "").replaceAll("export function ", "function ");
  const content = await readFile(new URL("../src/content/content.js", import.meta.url), "utf8");
  const bridge = content.slice(content.indexOf('  const SUPPORT_CLICK_KEY ='), content.indexOf("  // -------- Browser detection"));
  const timestamp = 1800000000000;
  const storage = new Map();
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  let receive;
  let changed;
  const pageWindow = {
    location: { origin: "https://www.tiktok.com" },
    addEventListener: (name, callback) => { if (name === "message") receive = callback; },
    postMessage: data => receive({ source: pageWindow, data }),
  };
  const state = { rateDonate: {} };
  const page = vm.createContext({ window: pageWindow, localStorage, AppStateETTVD: state, Date: { now: () => timestamp } });
  vm.runInContext(helper, page);
  const isolated = vm.createContext({ window: pageWindow, localStorage, chrome: {
    storage: { local: { get: (key, callback) => callback({}) }, onChanged: { addListener: callback => { changed = callback; } } },
  } });
  vm.runInContext(bridge, isolated);
  changed({ "tik.tok::lastSupportedAt": { newValue: timestamp } }, "local");
  assert.equal(state.rateDonate.lastSupportedAt, timestamp);
  assert.equal(vm.runInContext("hasSupportCooldown()", page), true);
  const reloaded = vm.createContext({ localStorage, Date: { now: () => timestamp } });
  vm.runInContext(helper, reloaded);
  assert.equal(vm.runInContext("hasSupportCooldown()", reloaded), true);
  changed({ "tik.tok::lastSupportedAt": { newValue: timestamp - 1000 } }, "local");
  assert.equal(state.rateDonate.lastSupportedAt, timestamp);
});