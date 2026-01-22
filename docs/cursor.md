# Using this MCP server in Cursor

Cursor mounts MCP servers by launching a local process and communicating over **stdio**. This repo’s CLI (`slack-mcp`) supports both stdio and Streamable HTTP transports; for Cursor you should use **stdio**.

## Prerequisites

- A Slack workspace/team ID (`SLACK_TEAM_ID`, starts with `T…`)
- A Slack token:
  - **User token** (`SLACK_USER_TOKEN`, `xoxp-…`) is recommended if you need message search (`slack_search_messages`)
  - **Bot token** (`SLACK_BOT_TOKEN`, `xoxb-…`) is useful if you want a distinct bot identity

## Option A: Install from npm (recommended)

Install the CLI:

```bash
npm install -g @zencoderai/slack-mcp-server
```

Then add a Cursor MCP server entry that runs the CLI via stdio:

```json
{
  "mcpServers": {
    "slack": {
      "command": "slack-mcp",
      "args": ["--transport", "stdio"],
      "env": {
        "SLACK_TEAM_ID": "T123...",
        "SLACK_USER_TOKEN": "xoxp-...",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## Option B: Run from a local clone (development)

Build the compiled entrypoint (Cursor runs `dist/`):

```bash
npm install
npm run build
```

Then add a Cursor MCP server entry that runs the built file via Node:

```json
{
  "mcpServers": {
    "slack": {
      "command": "node",
      "args": ["/absolute/path/to/slack-mcp-server/dist/index.js", "--transport", "stdio"],
      "env": {
        "SLACK_TEAM_ID": "T123...",
        "SLACK_USER_TOKEN": "xoxp-...",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

Notes:

- If you change any TypeScript code, re-run `npm run build` so `dist/` stays up to date.
- If you set both `SLACK_USER_TOKEN` and `SLACK_BOT_TOKEN`, the **user token takes precedence**.
- Set `SLACK_CHANNEL_IDS` (comma-separated channel IDs) if you want to restrict channel access.
- This server writes structured logs to **stderr** so stdout remains clean for MCP.

## Troubleshooting

- If Cursor can’t start the server, try running the same `command`/`args` in your terminal first (the most common issue is a missing `dist/` build).
- If Slack returns `missing_scope`, add the required scopes in your Slack app and reinstall it to the workspace.

## Related docs

- Slack bot tokens: [slack-bot-tokens.md](slack-bot-tokens.md)
- Slack user tokens: [slack-user-tokens.md](slack-user-tokens.md)
- Slack team/workspace ID: [slack-team-id.md](slack-team-id.md)

## Update log

- 2026-01-22: Added Cursor (stdio) setup instructions and troubleshooting notes.
