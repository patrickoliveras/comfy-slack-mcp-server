# Contributing

Thanks for contributing! This repo is a small MCP server that wraps the Slack Web API.

## Development setup

- **Install**: `npm ci`
- **Build**: `npm run build`
- **Test**: `npm test`
- **Coverage**: `npm run test:coverage`
- **Lint**: `npm run lint` (or `npm run lint:fix`)
- **Format**: `npm run format` (or `npm run format:check`)

## Workflow expectations

- **Small, focused PRs**: Prefer changes that are easy to review and revert.
- **Tests**: Add/adjust tests for new tool behavior and edge cases.
- **Docs**: Update `README.md` when adding/changing tools or configuration.
- **Token modes**: Be explicit about whether a feature requires bot tokens (`xoxb-`) or user tokens (`xoxp-`).
- **Backward compatibility**: Prefer additive tool changes. If a breaking change is required, call it out in `CHANGELOG.md`.

## Coding conventions

- **TypeScript strict**: Avoid `any`. Use `unknown` + type guards or minimal response types.
- **Formatting**: Prettier is the source of truth.
- **Linting**: ESLint runs in CI; keep it green.
- **Logs**: Runtime logs go to **stderr** in structured form (set `LOG_LEVEL`), so stdout stays clean for MCP transports.

## Security & secrets

- Never commit tokens or `.env` files.
- Prefer documenting required scopes and token types over copying example secrets.

## Licensing

This project is licensed under **Apache-2.0** (see `LICENSE`). By contributing, you agree that your contributions are licensed under the project’s license and may be distributed as part of the project.

## Update log

- 2026-01-22: Added contributing guidelines and documented the dev workflow.
- 2026-01-22: Noted structured stderr logging and the `LOG_LEVEL` convention.
- 2026-01-22: Clarified contribution licensing expectations.
