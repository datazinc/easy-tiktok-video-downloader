# Install the Extension

## Production Installation

- [Install from the Chrome Web Store](https://chromewebstore.google.com/detail/easy-tiktok-video-downloa/fclobfmgolhdcfcmpbjahiiifilhamcg) for Chrome and compatible Chromium browsers, including Brave.
- [Install from Mozilla Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tiktok-downloader-bulk/) for Firefox.

These store listings are the production installation and update channels. GitHub releases contain development and store-submission archives, not alternative production installers. A GitHub build may be newer than the approved version available in a store.

## Temporary Firefox Testing

Extract the Firefox zip, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select the manifest inside the extracted build. Firefox asks for a file here rather than an unpacked directory. The installation is removed when Firefox exits.

The Firefox zip is not a Mozilla-signed installer. Changing its extension to `.xpi` does not add a signature. For a permanent installation, use the Mozilla Add-ons link above; do not disable signing requirements in your normal browser profile.

## Chromium Developer Testing

Extract the appropriate zip, open `chrome://extensions` (or `brave://extensions`), enable **Developer mode**, choose **Load unpacked**, and select the extracted directory containing the manifest. Do not select the zip itself. For production installation, use the Chrome Web Store link above.

## Development Release Assets

The release workflow supplies Chromium, Chrome, and Firefox zip archives, this guide, and `SHA256SUMS.txt`. It does not generate or publish self-distributed production XPI/CRX installers and does not require signing keys.

To assemble assets locally, run both production builds, then `npm run release:assets`. To check them again, run `npm run verify:release-assets`. For temporary Firefox testing in a fresh profile, run `npm run firefox:test`. This does not publish to either store.

## Checksums

Verify downloaded assets against `SHA256SUMS.txt`. On macOS use `shasum -a 256 -c SHA256SUMS.txt`; on Linux use `sha256sum -c SHA256SUMS.txt` after downloading all listed assets into the same directory.