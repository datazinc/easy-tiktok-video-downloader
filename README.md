# Easy TikTok Video Downloader

Easy TikTok Video Downloader is an open source browser extension for saving supported TikTok videos and bulk-download surfaces in browsers supported by this repository.

> [!IMPORTANT]
> **Independent and unofficial.** This project is not affiliated with, endorsed by, sponsored by, or approved by TikTok, ByteDance, or any of their affiliates. TikTok and related marks belong to their respective owners. The name is used only to identify compatibility. See the full [Legal and Responsible Use Notice](LEGAL.md).

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

## Independent Project And Trademark Notice

- This is an independent, unofficial open source project maintained by its contributors.
- It is not affiliated with, endorsed by, sponsored by, authorized by, or approved by TikTok, ByteDance, or any of their affiliates.
- TikTok and related names, logos, and brand features are trademarks or other property of their respective owners.
- References to TikTok are nominative and used only to identify compatibility and describe intended interoperability.
- TikTok and ByteDance do not provide support for this extension. Project questions and bug reports belong in this repository or the project support channels.

## Contributing

- Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.
- If your change affects user-facing behavior, permissions, data handling, release packaging, or platform compliance, update the relevant documentation in the same change.
