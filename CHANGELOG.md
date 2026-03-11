# Changelog

All notable changes to this project will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- Tooling for long-term maintainability: ESLint + Prettier, lint-staged + Husky hooks, Dependabot, coverage thresholds, and contribution/security docs.
- New Slack tools for time-windowed history, pagination, search, and Canvas operations.
- `slack_get_file_info` tool to inspect file metadata by file ID.
- `slack_download_file` tool to download Slack-hosted files to the local filesystem via `url_private_download` with Bearer auth and retry/rate-limit handling.

## Update log

- 2026-03-10: Added file download tools (`slack_get_file_info`, `slack_download_file`).
- 2026-01-22: Created `CHANGELOG.md` and documented the current Unreleased state.
