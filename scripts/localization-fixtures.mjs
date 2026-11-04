import { readFile, readdir } from "node:fs/promises";

export const localeDirectory = new URL("../src/modules/i18n/locales/", import.meta.url);

export async function readCatalogs() {
  const files = (await readdir(localeDirectory)).filter(file => file.endsWith(".json")).sort();
  return Object.fromEntries(await Promise.all(files.map(async file => [
    file.slice(0, -5),
    JSON.parse(await readFile(new URL(file, localeDirectory), "utf8")),
  ])));
}