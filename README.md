# Easy TikTok Video Downloader

Easy TikTok Video Downloader is an open source browser extension for saving supported TikTok videos and bulk-download surfaces in browsers supported by this repository.

## Open Source

- This project is released under the MIT License. See [LICENSE](LICENSE).
- Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).
- Responsible-use and platform/trademark disclaimers live in [LEGAL.md](LEGAL.md).

## Releases

- Release artifacts are published on the GitHub Releases page: https://github.com/datazinc/easy-tiktok-video-downloader/releases
- The automated release workflow on `main` publishes these zip assets:
- `easy-tiktok-video-downloader-v<version>-chromium.zip`
- `easy-tiktok-video-downloader-v<version>-chrome.zip`
- `easy-tiktok-video-downloader-v<version>-firefox.zip`

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
```

## Responsible Use

- This project is maintained for educational, research, interoperability, archival, accessibility, and other lawful uses.
- The maintainers do not endorse misuse of the software, including copyright infringement, privacy violations, unauthorized copying, abusive automation, or attempts to evade platform restrictions.
- You are responsible for using this project ethically and in compliance with applicable law, creator rights, privacy obligations, and TikTok's Terms of Service and related policies.
- Use this tool only for content and accounts you are authorized to access and save.

## Trademark Notice

- TikTok is a trademark of ByteDance Ltd. and/or its affiliates.
- This project is not affiliated with, endorsed by, sponsored by, or approved by TikTok or ByteDance.
- Any reference to TikTok is used only to describe compatibility and intended interoperability.

## Contributing

- Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.
- If your change affects user-facing behavior, permissions, data handling, release packaging, or platform compliance, update the relevant documentation in the same change.
