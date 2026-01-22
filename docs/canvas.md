# Slack canvases

Slack “canvases” are manipulated via a small set of Canvas API methods plus the Files API (for discovery and for downloading the rendered canvas as a file).

This repo exposes four MCP tools around canvases:

- `slack_list_canvases`: list accessible canvases (IDs, titles, metadata)
- `slack_read_canvas`: download the rendered canvas content as **HTML**
- `slack_edit_canvas`: insert/replace/delete content using Slack canvas markdown
- `slack_create_canvas`: create a new standalone canvas (paid plans)

## IDs and terminology

Canvas IDs are typically file IDs that start with `F…` (you’ll pass these as `canvas_id`).

## Required scopes (high level)

- **List/read canvases**: `files:read`
- **Create/edit canvases**: `canvases:write`

## Find canvases you can access

You can either use the MCP tool `slack_list_canvases`, or call Slack’s Files API directly:

```bash
curl -sS -G https://slack.com/api/files.list \
  -H "Authorization: Bearer xoxb-your-token" \
  --data-urlencode "types=canvas"
```

## Read a canvas (HTML)

Slack doesn’t provide a “return the whole canvas body as markdown” method. The reliable way to read a canvas today is to:

1. Call `files.info` for the canvas file ID (to get `url_private`)
2. Download `url_private` with the same Bearer token (returns rendered HTML)

This is what `slack_read_canvas` does internally.

## Edit a canvas (Slack canvas markdown)

`slack_edit_canvas` calls `canvases.edit` and supports operations:

- `insert_at_start`
- `insert_at_end`
- `replace` (requires `section_id`)
- `delete` (requires `section_id`)

### Mentions in canvas markdown

Canvas markdown uses Slack-specific mention syntax:

- Channel mention: `![](#C123ABC456)`
- User mention: `![](@U123ABCDEFG)`

Note: canvases don’t support Block Kit.

### Replace/delete: getting a `section_id`

To replace/delete a specific section you need its `section_id`. This repo does not currently expose a dedicated “section lookup” MCP tool; you can get section IDs by:

- Calling Slack’s `canvases.sections.lookup` API (requires `canvases:read`), or
- Inspecting the canvas structure returned by Slack tooling/exports (depending on your workflow)

## Plan differences

Channel/DM canvases are available on all plans, but standalone canvases are paid-only.

## Update log

- 2026-01-22: Reformatted and aligned with the implemented canvas tools.
