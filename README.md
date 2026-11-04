# Easy TikTok Video Downloader

Easy TikTok Video Downloader is an open source browser extension for saving supported TikTok videos and bulk-download surfaces in browsers supported by this repository.

> [!IMPORTANT]
> **Independent and unofficial.** This project is not affiliated with, endorsed by, sponsored by, or approved by TikTok, ByteDance, or any of their affiliates. TikTok and related marks belong to their respective owners. The name is used only to identify compatibility. See the full [Legal and Responsible Use Notice](LEGAL.md).

## Open Source

- This project is released under the MIT License. See [LICENSE](LICENSE).
- Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).
- Responsible-use and platform/trademark disclaimers live in [LEGAL.md](LEGAL.md).

## Install

- [Chrome Web Store: Chrome, Chromium, and Brave](https://chromewebstore.google.com/detail/easy-tiktok-video-downloa/fclobfmgolhdcfcmpbjahiiifilhamcg)
- [Mozilla Add-ons: Firefox](https://addons.mozilla.org/en-US/firefox/addon/tiktok-downloader-bulk/)

Use the stores for production installation and automatic updates. GitHub archives are for development and store submission. See [installation instructions](INSTALL.md) for temporary testing.

## Releases

- Release artifacts are published on the GitHub Releases page: https://github.com/datazinc/easy-tiktok-video-downloader/releases
- The automated release workflow on `main` publishes these zip assets:
- `easy-tiktok-video-downloader-v<version>-chromium.zip`
- `easy-tiktok-video-downloader-v<version>-chrome.zip`
- `easy-tiktok-video-downloader-v<version>-firefox.zip`
- `INSTALL.md` and `SHA256SUMS.txt`

Production installers are available through the stores linked above. GitHub releases do not publish self-distributed XPI/CRX installers or bypass store signing and approval.

Before publishing, the workflow runs the download regression suite and validates each browser package's manifest, popup entry point, runtime files, and copied assets. Chrome and Firefox use the same local `storage` permission as the Chromium build for extension settings and cooldowns; this does not add analytics or remote data collection.

## Local Development

### Prerequisites

- Node.js 20 or newer is recommended.
- npm is used for dependency management and build scripts.

### Setup

```bash
npm ci
npm run setup:hooks
```

### Build Commands

```bash
npm run build:prod
npm run buildff:prod
npm run verify:versions
npm run verify:recovery
```

After all three release directories have been assembled (`dist`, `distchrome`, and `distff`), run `npm run verify:packages` to validate their contents. The same guard runs in the release workflow before the zip assets are published.

## Batch Download Progress

The wide download button shows the current post or file, transfer percentage and bytes when available, and separate source-preparation, retry, recovery, muxing, and saving phases. Unknown transfer totals use an animated indicator rather than an estimated percentage. Photo posts include the current image index.

Experimental HD uses one continuous indicator for the current video, with status text for downloading, combining audio/video, saving, or switching to standard. It does not show a percentage that restarts at each stage. During HD batches, the overall bar advances by completed posts. Each post tries at most one genuine HD upgrade before standard fallback; lower-quality adaptive renditions are not extra HD attempts. A failed paired-stream request cancels its sibling, and an HD network transfer with no activity for 30 seconds is aborted.

For new users, Experimental HD is enabled and the main downloader opens by default. Existing saved choices are respected. Factory Reset clears those choices and restores HD enabled with the downloader open, including after a page reload.

While a list page is loading, the button shows **Loading posts** and the number already confirmed saved, without a guessed total. Once the current batch is queued, its counter uses only those confirmed posts. The configured maximum batch size is never presented as a discovered post count or a whole-list total.

Pause takes effect before the next file; an in-flight save is allowed to finish. Pause and Stop are hidden when the batch completes or stops. Resumed queues use the same progress display.

## Filename Templates

All eight filename presets use the same renderer as the template editor preview. The recommended preset retains the selected profile and list folders during progressive batches, while each filename identifies the actual post author. Collection folders are expanded only when the tab token occupies a directory segment, so flat templates remain flat.

File extensions follow the downloaded media type. Multi-image posts receive distinct image numbers even when the selected template omits the sequence token. Invalid/reserved filename characters and overlong UTF-8 path components are normalized safely; shortening preserves the end of the component for post IDs and quality labels. Existing downloaded files are not renamed.

## Account List Batches

The globe control in the floating toolbar or extension popup selects the interface language, including an explicit English override. Auto follows a supported TikTok language, then the browser language. See [localization coverage and contribution guide](LOCALIZATION.md) for supported locales, translation conventions, and remaining English-only advanced screens.

Profile tabs for **Videos, Reposts, Likes, and Favorites**, plus playlist/collection cards, have download controls. **Download All** downloads the accessible list; the optional **Max videos** control sets an overall limit, counting each post (including a photo post) once. A blank limit means All. **Advanced** contains the internal batch size, which defaults to 30 and can be adjusted from 1 to 100. Lists are fetched one page at a time; files are saved and checked by the browser before another page is requested. There is no full-list preload.

If TikTok refuses a direct profile-list request, the job can use TikTok's own selected tab and scroll only after saving the current visible batch. It verifies the account and selected grid before using posts. If no further page loads, it pauses with completed batches retained rather than guessing that the list is complete.

Profile-list dialogs check TikTok's selected tab before offering a download. Private or explicitly empty lists show an explanation and Close instead; they do not start a download or retry loop. A private Likes list does not prevent downloading the account's accessible Videos. Loading failures remain distinct from confirmed empty lists.

Opening a post author's profile from the home feed does not require a page reload before using its list controls. Account identity is resolved from matching feed metadata or the current profile, rather than assuming the initial page data still describes the account being viewed.

Completed post IDs and a bounded current-file checkpoint are stored per account/list in tab-local session storage. If a later request fails, earlier files remain downloaded. Reopen that list's download dialog and choose **Resume saved progress** to continue; an interrupted save is checked before retrying it. Checkpoints expire after 30 minutes without progress. Starting over is explicit and can download files again.

Resume dialogs separate confirmed saves, skipped posts, queued posts, unconfirmed saves, and known failures. The remaining whole-list count stays unknown until the list is finished. A resumed limit includes posts already saved, and the dialog shows how many additional posts are allowed.

Reaching the overall limit stops before more posts are downloaded and retains saved progress without claiming that the list is finished. Resume with a higher limit, or All, to continue without downloading confirmed posts again. Cancel and Close use a neutral secondary style, distinct from the main download action.

Pause and Stop apply to the whole progressive job. A navigation change stops it, and its single refresh-recovery allowance remains spent across later batches. Private or unavailable account lists still require TikTok access; these controls do not bypass restrictions. Browser-level save errors or unknown file outcomes pause the job rather than assuming success.

## Collection Downloads

Collection pages such as `/@username/collection/Collection-123` have a **Download collection** button beside the title. It opens the same bounded batch dialog, preserves collection order, and downloads video/photo posts incrementally. The scraper and automatic scrolling are not required.

Collection batches reuse the normal SD/experimental-HD preference, live progress, Pause/Stop controls, and one-refresh recovery budget. Recovery resolves missing metadata from the same collection. Deleted, inaccessible, prohibited, and source-less posts may be absent from the downloadable total; the native collection count can therefore be higher.

## Short Drama Episodes

On a short-drama episode page, a download icon beside **Episodes** opens a range dialog. The extension reads the series' paginated episode list, sorts by episode number, and offers only episodes with complete audio-and-video sources. Previews, highlights, prohibited posts, and entries without a usable source are omitted. Access restrictions are not bypassed.

Client-side navigation from the drama listing does not require a reload: episode requests are remembered independently of browser resource timings, with a direct same-origin lookup when no request was captured. A failed lookup can be retried in the dialog without refreshing or starting a download batch.

Episode batches reuse the normal SD/experimental-HD preference, live progress, Pause/Stop controls, and one-refresh recovery budget. The selected range and episode positions survive recovery, including episodes beyond the first page. Move or collapse the floating panel if it covers the native episode list.

Video overlays show a disabled **Loading** indicator until matching downloadable metadata is available. A playable `blob:` URL alone does not enable Save. Metadata lookup is targeted to the visible or hovered video; unavailable sources stay disabled instead of immediately opening a download-failure popup.

## Download Recovery

- Normal download attempts run first. After a source failure, recovery tries cached audio-and-video sources before requesting fresh metadata for that post.
- The failure dialog offers **Refresh and resume** when the current operation can be checkpointed safely. It preserves the captured queue, image indexes, filenames, settings, and confirmed completed files in tab-local session storage. Playback blobs and signed media URLs are not stored.
- Each operation can refresh **once**. The allowance is recorded before reloading and stays spent after restoration. Further failures pause for Retry Download, Skip This File, or Stop Batch.
- Pending or uncertain browser saves block refresh to avoid duplicate files. Checkpoints expire after 30 minutes and restore only on the originating page. Another interruption requires explicit confirmation to resume.
- Recovery continues the captured queue, not undiscovered posts. Automatic scrolling stays off after recovery. Complete any TikTok verification yourself before retrying; recovery does not bypass access restrictions.
- Console diagnostics include `fallback-fix-applied` (with `cached` or `hydrated` stage), `fallback-fix-metadata-unavailable`, `refresh-resume-checkpoint-saved`, and `refresh-resume-started`.

## Responsible Use

The extension's coffee, tip-jar, and Support buttons keep their familiar labels but reveal a local pay-it-forward message when clicked, instead of opening a payment page. Clicking grants the same 90-day break from review/tip prompts as a donation. This uses a local support-click timestamp, synchronized across the extension's pages; no click analytics or payment event is sent to a server.

Review prompts are considered only after a browser-confirmed completed save and once downloads, recovery, and automatic scrolling are idle. Single downloads, photo groups, and normally completed list jobs use one scheduler. Eligible milestone reviews take precedence over Morpheus; they cannot appear together. Both share rating/support cooldowns and the one-automatic-popup-per-day limit. Cancelling a delayed prompt does not consume that daily limit, and stopping a download cancels pending review selection.

- This project is maintained for educational, research, interoperability, archival, accessibility, and other lawful uses.
- The maintainers do not endorse misuse of the software, including copyright infringement, privacy violations, unauthorized copying, abusive automation, or attempts to evade platform restrictions.
- You are responsible for using this project ethically and in compliance with applicable law, creator rights, privacy obligations, and TikTok's Terms of Service and related policies.
- Use this tool only for content and accounts you are authorized to access and save.

## Independent Project And Trademark Notice

- This is an independent, unofficial open source project maintained by its contributors.
- It is not affiliated with, endorsed by, sponsored by, authorized by, or approved by TikTok, ByteDance, or any of their affiliates.
- TikTok and related names, logos, and brand features are trademarks or other property of their respective owners.
- References to TikTok are nominative and used only to identify compatibility and describe intended interoperability.
- TikTok and ByteDance do not provide support for this extension. Project questions and bug reports belong in this repository or the project support channels.

## Contributing

- Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.
- If your change affects user-facing behavior, permissions, data handling, release packaging, or platform compliance, update the relevant documentation in the same change.
