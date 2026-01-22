# Slack user tokens (`xoxp-`)

A Slack user token is an OAuth access token that represents a **specific workspace member** (it typically starts with `xoxp-`). In this MCP server, user tokens are configured via `SLACK_USER_TOKEN` and take precedence over `SLACK_BOT_TOKEN`.

User tokens are also required for message search: Slack’s search APIs (and therefore `slack_search_messages`) do **not** work with bot tokens.

## Quickest way (one workspace, for yourself)

1. Go to `https://api.slack.com/apps` and select your app.
2. Open **OAuth & Permissions**.
3. Under **Scopes → User Token Scopes**, add the scopes you need (see `README.md` for the recommended scope set).
4. Click **Install to Workspace** (or reinstall if the app is already installed).
5. Copy the **User OAuth Token** (it starts with `xoxp-`).

Gotcha: if you don’t add any **user scopes**, Slack won’t issue/show a user token.

## Proper way (many users): run the OAuth flow

If you need user tokens for multiple people, each user must complete your app’s OAuth authorize/install flow. After authorization, Slack returns a user token via `oauth.v2.access`. Store tokens per user (and per workspace) as appropriate for your product.

## Verify the token

Call `auth.test` with the token and confirm it returns `"token_type": "user"` and the expected `user_id` / `team_id`:

```bash
curl -sS https://slack.com/api/auth.test \
  -H "Authorization: Bearer xoxp-YOUR_USER_TOKEN"
```

## Avoid “legacy tokens”

Slack has deprecated older legacy token approaches and recommends OAuth-based tokens for new apps.

## Update log

- 2026-01-22: Reformatted and clarified how to obtain/verify user tokens.
