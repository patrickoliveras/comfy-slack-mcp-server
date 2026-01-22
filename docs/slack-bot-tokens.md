# Slack bot tokens (`xoxb-`)

A Slack bot token is minted when you **install** a Slack app to a workspace. It represents the app’s bot user.

This MCP server uses bot tokens via `SLACK_BOT_TOKEN`. You’ll also need your workspace/team ID (`SLACK_TEAM_ID`).

## Get a bot token (Slack UI)

1. Go to `https://api.slack.com/apps` and create a new app (“From scratch”).
2. Open **OAuth & Permissions**.
3. Under **Scopes → Bot Token Scopes**, add the scopes you need (see `README.md` for the recommended scope set).
4. Click **Install to Workspace** and authorize the app.
5. Copy the **Bot User OAuth Token** (it starts with `xoxb-`).

## Common gotchas

- **No install = no token**: Slack only shows the bot token after you install the app to a workspace.
- **Scope changes usually require reinstall**: if you add/remove scopes, reinstall so the token is updated.
- **Tokens are per-workspace**: if your app is installed to multiple workspaces, you’ll have a different token per workspace.
- **Channel access is invite-based**: bot tokens can only see channels the bot is invited to.

## Other Slack secrets (not used by this MCP server)

- **Signing Secret**: used to verify requests for Slack Events / interactive features.
- **App-level token (`xapp-…`)**: used for Socket Mode.

## Update log

- 2026-01-22: Reformatted and clarified token creation + common gotchas.
