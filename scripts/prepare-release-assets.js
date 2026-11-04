const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "release-artifacts");
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const prefix = `easy-tiktok-video-downloader-v${version}`;
const asset = suffix => path.join(output, `${prefix}-${suffix}`);
const variants = [["chromium", "dist"], ["chrome", "distchrome"], ["firefox", "distff"]];

function filesIn(directory, prefix = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? filesIn(path.join(directory, entry.name), `${prefix}${entry.name}/`)
    : [`${prefix}${entry.name}`]);
}

function writeChecksums() {
  const lines = fs.readdirSync(output).filter(name => name !== "SHA256SUMS.txt").sort().map(name => {
    const digest = crypto.createHash("sha256").update(fs.readFileSync(path.join(output, name))).digest("hex");
    return `${digest}  ${name}`;
  });
  fs.writeFileSync(path.join(output, "SHA256SUMS.txt"), lines.join("\n") + "\n");
}

function verifyArchive(filename, directory) {
  execFileSync("unzip", ["-t", filename], { stdio: "pipe" });
  const entries = execFileSync("unzip", ["-Z1", filename], { encoding: "utf8" }).trim().split("\n").filter(name => !name.endsWith("/"));
  assert.ok(entries.every(name => !path.isAbsolute(name) && !name.split("/").includes("..")), "Unsafe archive path");
  assert.equal(new Set(entries).size, entries.length, "Duplicate archive entries");
  const runtime = entries;
  assert.deepEqual(new Set(runtime), new Set(filesIn(directory)), `Unexpected files in ${path.basename(filename)}`);
  for (const name of runtime) {
    const bytes = execFileSync("unzip", ["-p", filename, name], { maxBuffer: 16 * 1024 * 1024 });
    assert.ok(bytes.equals(fs.readFileSync(path.join(directory, name))), `Stale or changed ${name} in ${path.basename(filename)}`);
  }
}

function verifyAssets() {
  const allowed = new Set(["INSTALL.md", "SHA256SUMS.txt", ...variants.map(([name]) => `${prefix}-${name}.zip`)]);
  assert.deepEqual(new Set(fs.readdirSync(output)), allowed, "Unexpected or missing release asset; publication refused");
  for (const [name, directory] of variants) verifyArchive(asset(`${name}.zip`), path.join(root, directory));
  const names = fs.readdirSync(output).filter(name => name !== "SHA256SUMS.txt").sort();
  const expected = names.map(name => `${crypto.createHash("sha256").update(fs.readFileSync(path.join(output, name))).digest("hex")}  ${name}`).join("\n") + "\n";
  assert.equal(fs.readFileSync(path.join(output, "SHA256SUMS.txt"), "utf8"), expected, "Release checksums do not match");
  assert.ok(fs.readFileSync(path.join(output, "INSTALL.md")).equals(fs.readFileSync(path.join(root, "INSTALL.md"))), "Installation guide is stale");
  console.log(`Release ${version}: development/submission archives, installation guide, and checksums verified.`);
}

try {
  const args = process.argv.slice(2);
  if (args[0] === "--verify") {
    verifyAssets();
  } else {
    assert.equal(args.length, 0, "Unknown release asset arguments");
    fs.rmSync(output, { recursive: true, force: true });
    fs.mkdirSync(output, { recursive: true });
    fs.rmSync(path.join(root, "distchrome"), { recursive: true, force: true });
    fs.cpSync(path.join(root, "dist"), path.join(root, "distchrome"), { recursive: true });
    fs.copyFileSync(path.join(root, "manifest.json.chrome"), path.join(root, "distchrome/manifest.json"));
    fs.copyFileSync(path.join(root, "dist.zip"), asset("chromium.zip"));
    fs.copyFileSync(path.join(root, "distff.zip"), asset("firefox.zip"));
    execFileSync("zip", ["-qr", asset("chrome.zip"), ".", "-x", "__MACOSX/*", ".*", "*.zip"], { cwd: path.join(root, "distchrome") });
    fs.copyFileSync(path.join(root, "INSTALL.md"), path.join(output, "INSTALL.md"));
    writeChecksums();
    verifyAssets();
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}