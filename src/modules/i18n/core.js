export const LANGUAGE_KEY = "tik.tok::language";
export const SUPPORTED_LOCALES = {
  en: "English", "zh-CN": "简体中文", "pt-BR": "Português (Brasil)",
  ru: "Русский", ko: "한국어", fr: "Français", es: "Español",
  tr: "Türkçe", vi: "Tiếng Việt", de: "Deutsch", id: "Bahasa Indonesia",
};

export function normalizeLocale(value) {
  if (typeof value !== "string") return null;
  let locale;
  try { locale = Intl.getCanonicalLocales(value.replaceAll("_", "-"))[0]; } catch { return null; }
  if (!locale) return null;
  if (locale === "zh" || /^zh-(?:CN|SG|Hans)(?:-|$)/i.test(locale)) return "zh-CN";
  if (/^zh-/i.test(locale)) return null;
  if (/^pt(?:-|$)/i.test(locale)) return "pt-BR";
  const language = locale.split("-")[0];
  return Object.hasOwn(SUPPORTED_LOCALES, language) ? language : null;
}

export function resolveLocale({ preference = "auto", siteLanguage, browserLanguages = [] } = {}) {
  if (preference !== "auto" && normalizeLocale(preference)) return normalizeLocale(preference);
  for (const candidate of [siteLanguage, ...browserLanguages]) {
    const locale = normalizeLocale(candidate);
    if (locale) return locale;
  }
  return "en";
}

export function formatMessage(catalogs, locale, key, values = {}) {
  const message = catalogs[locale]?.[key] ?? catalogs.en[key];
  if (typeof message !== "string") throw new Error(`Unknown message ID: ${key}`);
  return message.replace(/\{(\w+)\}/g, (_, name) => {
    if (!Object.hasOwn(values, name)) throw new Error(`Missing ${name} for ${key}`);
    return typeof values[name] === "number"
      ? new Intl.NumberFormat(locale).format(values[name]) : String(values[name]);
  });
}