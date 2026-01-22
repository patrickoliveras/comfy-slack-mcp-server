# Changelog

All notable changes to this project will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- Tooling for long-term maintainability: ESLint + Prettier, lint-staged + Husky hooks, Dependabot, coverage thresholds, and contribution/security docs.
- New Slack tools for time-windowed history, pagination, search, and Canvas operations.
- Source-level maintainability upgrades:
  - Refactored the runtime into `src/` modules (client/server/transports/cli) while preserving the public API and CLI entrypoint.
  - Structured stderr logging (`LOG_LEVEL`) and rate-limit aware retries for idempotent Slack reads.
  - Generated TypeScript declaration files and added package `exports`/`types` metadata for better consumer experience.

## Update log

- 2026-01-22: Created `CHANGELOG.md` and documented the current Unreleased state.
- 2026-01-22: Documented refactor + logging/typing/packaging improvements.
