# Channel and thread history (`conversations.history` / `conversations.replies`)

This repo’s history tools map directly to Slack’s Conversations API:

- `slack_get_channel_history` → `conversations.history`
- `slack_get_thread_replies` → `conversations.replies`

## Fetch channel history

```bash
curl -sS -G https://slack.com/api/conversations.history \
  -H "Authorization: Bearer xoxb-your-token" \
  --data-urlencode "channel=C0123456789" \
  --data-urlencode "limit=200"
```

This returns a single “page” of messages for the conversation.

## Required OAuth scopes (depends on conversation type)

You need the matching `*:history` scope for what you’re reading:

- Public channels: `channels:history`
- Private channels: `groups:history`
- DMs: `im:history`
- Group DMs: `mpim:history`

Bot tokens also require that the bot is actually a member of the channel (invite it first).

## Pagination (cursor)

Slack uses cursor-based pagination: read `response_metadata.next_cursor`, then pass it back as `cursor` to get the next page.

First page (no cursor):

```bash
curl -sS -G https://slack.com/api/conversations.history \
  -H "Authorization: Bearer xoxb-your-token" \
  --data-urlencode "channel=C0123456789" \
  --data-urlencode "limit=200"
```

Next page:

```bash
curl -sS -G https://slack.com/api/conversations.history \
  -H "Authorization: Bearer xoxb-your-token" \
  --data-urlencode "channel=C0123456789" \
  --data-urlencode "limit=200" \
  --data-urlencode "cursor=dGVhbTpDMD... (next_cursor)"
```

## Time window / incremental sync (optional)

Pass:

- `oldest` / `latest` (Unix epoch seconds; can be fractional)
- `inclusive=true|false`

This is the usual way to do “fetch since last run” incremental ingestion.

## Thread replies

`conversations.history` returns the channel timeline; thread replies are fetched with `conversations.replies` using the parent message’s `ts`:

```bash
curl -sS -G https://slack.com/api/conversations.replies \
  -H "Authorization: Bearer xoxb-your-token" \
  --data-urlencode "channel=C0123456789" \
  --data-urlencode "ts=1705852800.123456" \
  --data-urlencode "limit=200"
```

## Update log

- 2026-01-22: Reformatted and aligned with `slack_get_channel_history` / `slack_get_thread_replies` behavior (cursor + time-window).
