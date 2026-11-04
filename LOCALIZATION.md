# Localization

## Language Selection

The globe control in the floating toolbar and extension popup opens a native language dialog. English is always listed first, using its own name. Auto uses a supported explicit TikTok document language (or its explicit app-context language), then browser language preferences, then English. US and UK English share one catalog. Simplified Chinese is selected for `zh`, mainland/Singapore Chinese, and Hans; Traditional Chinese is not silently relabelled Simplified Chinese. Portuguese variants currently use the Brazilian catalog.

An explicit choice overrides Auto and is stored locally under `tik.tok::language` in extension storage. The content script bridges only validated locale choices to the page; popup and page changes synchronize without a reload. No locale data is transmitted to an analytics or translation service. The extension never changes TikTok's document language, post content, usernames, filenames, or internal list identifiers.

## Catalogs and Tone

English, Simplified Chinese, Brazilian Portuguese, Russian, Korean, French, Spanish, Turkish, Vietnamese, German, and Indonesian each have a JSON catalog in `src/modules/i18n/locales/`. `catalogs.js` statically imports these bundled files; there are no runtime translation requests. Message IDs, not displayed English text, are used at call sites. Named placeholders let translators change word order; numbers use `Intl.NumberFormat`. Counts use labels or complete messages to avoid hard-coded English singular/plural suffixes. Missing translations fall back to English; unknown IDs and missing parameters fail validation.

Use natural everyday UI language. Common local terms such as Indonesian "download", Brazilian "posts", and German "Likes" are welcome when clearer than a formal translation. Do not force English borrowings where local wording is more familiar. Keep brief friendly lines warm, but keep errors, privacy restrictions, destructive actions, and save status precise. Avoid regional stereotypes, forced slang, sarcasm in failures, and jokes about lost files.

The catalogs are authored translations, not native-speaker-certified translations. Before a store release, native speakers should review terminology and register. The visible independence notice is translated; its authoritative linked `LEGAL.md` remains unchanged and legal translations should receive separate review. Optional success messages use a small, locally worded selection rather than literal translations of English jokes.

## Current Coverage

Catalog coverage includes the language picker; profile/list and episode dialogs; primary and HD download controls; batch and auto-scroll progress; scraper setup, help, and completion; Settings; filename-template help, fields, validation, and preset display labels; download recovery and browser setup; popup help, history, confirmations, and errors; statistics; sharing and review prompts; the kindness dialog; optional celebrations; and the visible independence notice.

Brand/platform names, usernames, post content, technical tokens, paths, and saved custom template names are not translated. Built-in templates keep stable internal labels and paths; their `messageKey` controls only their localized presentation. Original coffee/support button labels are intentionally preserved. Dormant legacy message arrays may remain in source but are not selected by the localized celebration functions.

`bindText` updates owned text or attributes safely; it never inserts translated HTML. `localizeMarkup` binds explicit `data-i18n` markers after the existing HTML sanitizer, not matched English text. Weak references prevent recycled feed elements from being retained by the localization registry. Do not bind text to a container that also owns interactive children; bind a dedicated label node instead. Use `clearText` when clearing a translated dynamic value so a later language change cannot restore stale text. Use `setLocalizedButton` for icon buttons so locale updates preserve icons and handlers. Active file progress and unsaved input must survive language changes.

## Resume Semantics

Saved and skipped counts come from the scoped checkpoint. Queued means discovered pending posts, not an inferred whole-list total. A save that has started but lacks browser confirmation is shown separately. A source error before any save attempt can be counted as failed; unconfirmed saves must never be guessed as failures. Unknown failure/remaining counts are explicitly labelled unknown. Reaching an overall limit does not mean the list has ended.

The limit field becomes **Total limit, including saved posts** when resuming. The displayed additional allowance subtracts confirmed saved posts; skipped entries do not consume the success limit. English and other locales show the same underlying numbers.

## Verification

Run `npm run verify:localization` and `npm run verify:recovery`. The release workflow runs both. Catalog tests check duplicate IDs, complete locale imports, matching keys/placeholders, source message references, preset display keys, authored success messages, language precedence, storage failures, live updates, and truthful resume counts.

For isolated real-browser layout checks, start a dedicated Chromium debug profile on loopback port 9223 and run `node scripts/verify-localization-browser.mjs` with a Node version providing the global WebSocket API. Set `ETTPD_BROWSER_URL` to use another dedicated endpoint. The matrix covers all locales at 320px and 1200px, mobile large text, Settings, templates, episodes, statistics, kindness, recovery, browser setup, scraper/help, resume summaries, and the popup. It checks clipping, explicit markup, live progress preservation, and unsaved template input. It uses fixture storage, starts no downloads, and writes screenshots only to the OS temporary directory. This is layout/integration coverage, not native-speaker review or Firefox runtime certification.