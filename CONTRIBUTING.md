# Contributing

Thanks for contributing to this open source project.

## Ground Rules

- Keep changes focused and easy to review.
- Prefer fixes at the root cause over one-off patches.
- Update documentation when behavior, permissions, release packaging, or compliance expectations change.
- Do not add features intended to facilitate misuse, policy evasion, infringement, unauthorized access, or abusive automation.
- Preserve the project's responsible-use, trademark, and platform-compliance language in [LEGAL.md](LEGAL.md) and [README.md](README.md).

## Development Setup

```bash
npm ci
npm run setup:hooks
```

## Validation

Run the checks relevant to your change before opening a pull request:

```bash
npm run build:prod
npm run buildff:prod
npm run verify:versions
```

If your change affects Firefox packaging or permissions, also validate the built Firefox artifact as needed.

## Pull Requests

- Use a short, descriptive title.
- Explain the behavior change, not just the code diff.
- Include screenshots or short recordings for UI changes when practical.
- Call out any manifest, permissions, or release-artifact changes explicitly.
- Note any follow-up work or known limitations.

## Release Notes And Artifacts

- Pushes to `main` trigger the GitHub release workflow in `.github/workflows/release-on-main.yml`.
- That workflow publishes Chromium, Chrome, and Firefox zip artifacts to the GitHub Releases page.
- If you change build scripts, manifests, or release packaging, confirm the workflow output remains consistent.

## Data Handling And Compliance

- Keep Firefox data-collection declarations accurate when Firefox manifest behavior changes.
- Do not introduce telemetry, data export, or third-party transmission behavior without updating documentation and any required consent or disclosure flow.
- Contributions should support lawful, ethical use and should not encourage violating TikTok Terms of Service or creator rights.

## Reporting Security Issues

- If you find a security issue, do not post exploit details in a public issue.
- Open a minimal issue requesting a private contact path, or contact the maintainer directly if you already have a trusted channel.
