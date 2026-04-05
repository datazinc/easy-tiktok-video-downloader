const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");

function readJson(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

const files = [
  "package.json",
  "manifest.json",
  "manifest.firefox.json",
  "manifest.json.chrome",
];

const versions = files.map((file) => {
  const json = readJson(file);
  return {
    file,
    version: String(json.version || "").trim(),
  };
});

const missing = versions.filter(({ version }) => !version);
if (missing.length) {
  console.error("Version check failed: missing version field in:");
  missing.forEach(({ file }) => console.error(`- ${file}`));
  process.exit(1);
}

const expectedVersion = versions[0].version;
const mismatches = versions.filter(
  ({ version }) => version !== expectedVersion,
);

if (mismatches.length) {
  console.error("Version check failed: version mismatch detected.");
  versions.forEach(({ file, version }) => {
    console.error(`- ${file}: ${version}`);
  });
  process.exit(1);
}

console.log(`Version check passed: ${expectedVersion}`);
