# Slack message search (`search.messages`)

This repo’s `slack_search_messages` tool is a wrapper around Slack’s Web API method `search.messages`. The query syntax is the same as Slack’s in-app search.

## Requirements

- Use a **user token** (`SLACK_USER_TOKEN`, `xoxp-…`) with the `search:read` scope.
- Slack search does **not** work with bot tokens.

## Query syntax (same as Slack UI)

Common modifiers include:

- `in:#channel`
- `from:@user` (or `from:<@U123…>`)
- `has::eyes:` (reaction)
- `has:pin`, `is:saved`, `is:thread`
- `before:YYYY-MM-DD`, `after:YYYY-MM-DD`, `on:YYYY-MM-DD`, `during:august`

Example queries:

- `"payment failed" in:#billing after:2026-01-01`
- `deploy from:@renato in:#ops has:pin`
- `incident OR outage in:#prod -in:#random`

## Pagination

Slack search supports cursor-style pagination via `response_metadata.next_cursor`.

- **First request**: omit `cursor` or use `cursor="*"` (Slack’s “start” cursor)
- **Next requests**: pass the previous response’s `response_metadata.next_cursor`

This MCP tool exposes that as the `cursor` input parameter.

## Notes

- Slack search `count` is capped at 100 (the tool enforces this max).
- Search results may be affected by the user’s Slack search filters/preferences set in the Slack UI.

## Update log

- 2026-01-22: Reformatted and aligned with the `slack_search_messages` tool inputs (`query`, `count`, `cursor`, `sort`, `sort_dir`).
