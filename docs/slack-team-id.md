# Slack team/workspace ID (`T…`)

This MCP server requires `SLACK_TEAM_ID`, which is your Slack **workspace (team) ID**. It typically starts with `T…`.

## Option 1: From the browser URL (no API)

1. Open Slack in a browser (e.g. `https://acmeinc.slack.com`).
2. Look at the URL after Slack loads. It will look like:

   `https://app.slack.com/client/TXXXXXXX/CXXXXXXX`

3. The segment that starts with `T` (e.g. `TXXXXXXX`) is your Team/Workspace ID.

If you’re on Enterprise Grid, the org ID typically starts with `E…` and appears in similar places.

## Option 2: From the Slack API (`auth.test`) (best for scripts)

Call `auth.test` with any valid token (bot or user) and read `team_id` from the response:

```bash
curl -sS https://slack.com/api/auth.test \
  -H "Authorization: Bearer xoxb-YOUR_BOT_TOKEN"
```

That response includes `team_id` (and on Enterprise orgs you’ll also see `enterprise_id`).

Also works: `team.info` (useful for confirming you’re looking at the right workspace).

## Update log

- 2026-01-22: Reformatted and clarified the two reliable ways to find `SLACK_TEAM_ID`.
