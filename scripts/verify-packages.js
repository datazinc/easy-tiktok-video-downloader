const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const readJson = filename => JSON.parse(fs.readFileSync(filename, "utf8"));
const version = readJson(path.join(root, "package.json")).version;
const directories = process.argv.slice(2);

function filesIn(directory, prefix = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = prefix + entry.name;
    return entry.isDirectory()
      ? filesIn(path.join(directory, entry.name), relative + "/")
      : [relative];
  });
}

const copied = new Map([
  ["popup/popup.html", "src/popup/popup.html"],
  ["popup/popup.css", "src/popup/popup.css"],
  ["js/confetti.browser.min.js", "src/js/confetti.browser.min.js"],
]);
for (const [source, destination] of [["icons", "icons"], ["src/styles", "styles"]]) {
  for (const filename of filesIn(path.join(root, source))) copied.set(`${destination}/${filename}`, `${source}/${filename}`);
}
const bundles = ["js/background.bundle.js", "js/content.bundle.js", "js/injex.js", "popup/popup.bundle.js"];
const expected = new Set(["manifest.json", ...bundles, ...copied.keys()]);
const variants = [
  { name: "Chromium", directory: directories[0] || "dist", manifest: "manifest.json" },
  { name: "Chrome", directory: directories[1] || "distchrome", manifest: "manifest.json.chrome" },
  { name: "Firefox", directory: directories[2] || "distff", manifest: "manifest.firefox.json" },
];

for (const variant of variants) {
  const directory = path.resolve(root, variant.directory);
  const manifest = readJson(path.join(directory, "manifest.json"));
  assert.deepEqual(manifest, readJson(path.join(root, variant.manifest)), `${variant.name}: wrong manifest`);
  assert.equal(manifest.version, version, `${variant.name}: wrong version`);
  assert.ok(manifest.permissions.includes("storage"), `${variant.name}: missing storage permission`);
  assert.deepEqual(new Set(filesIn(directory)), expected, `${variant.name}: missing or unexpected packaged files`);

  const references = [
    manifest.background?.service_worker,
    ...(manifest.background?.scripts || []),
    manifest.action?.default_popup,
    ...Object.values(manifest.icons || {}),
    ...(manifest.content_scripts || []).flatMap(script => [...(script.js || []), ...(script.css || [])]),
    ...(manifest.web_accessible_resources || []).flatMap(resource => resource.resources || []),
  ].filter(Boolean);
  for (const reference of references) {
    assert.ok(reference.endsWith("/*")
      ? [...expected].some(filename => filename.startsWith(reference.slice(0, -1)))
      : expected.has(reference), `${variant.name}: missing manifest reference ${reference}`);
  }
  for (const [destination, source] of copied) {
    if (destination.endsWith(".js")) continue;
    assert.ok(fs.readFileSync(path.join(directory, destination)).equals(fs.readFileSync(path.join(root, source))), `${variant.name}: stale ${destination}`);
  }
  const popup = fs.readFileSync(path.join(directory, "popup/popup.html"), "utf8");
  assert.ok(popup.includes('src="./popup.bundle.js"'), `${variant.name}: wrong popup script path`);
  assert.ok(popup.includes('href="./popup.css"'), `${variant.name}: wrong popup stylesheet path`);
  for (const filename of [...bundles, ...[...copied.keys()].filter(filename => filename.endsWith(".js"))]) {
    const code = fs.readFileSync(path.join(directory, filename), "utf8");
    assert.ok(code.length > 100, `${variant.name}: empty bundle ${filename}`);
    new vm.Script(code, { filename });
  }
  const injected = fs.readFileSync(path.join(directory, "js/injex.js"), "utf8");
  for (const marker of ["user-liked-item", "LIST_PRIVATE", "SUPPORT_CLICK_REQUEST", "tik.tok::progressiveBatch"]) {
    assert.ok(injected.includes(marker), `${variant.name}: missing release feature ${marker}`);
  }
  assert.ok(fs.readFileSync(path.join(directory, "js/background.bundle.js"), "utf8").includes("recordSupportClick"), `${variant.name}: missing support cooldown bridge`);
  console.log(`${variant.name} ${version}: manifest, ${expected.size} files, references, copied assets, and bundles verified`);
}