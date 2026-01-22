# slack-mcp-server

## Disclaimer

This project is licensed under the **Apache License 2.0**. It includes [code](https://github.com/modelcontextprotocol/servers-archived/tree/main/src/slack) originally developed by Anthropic and released under the MIT License (see `LICENSE` for the third-party notice).

## Overview

A Model Context Protocol (MCP) server for interacting with Slack workspaces. This server provides tools to list channels, post messages, reply to threads, add reactions, get channel history, and manage users.

## Docs

- Cursor setup: [docs/cursor.md](docs/cursor.md)
- Slack tokens:
  - Bot tokens (`xoxb-`): [docs/slack-bot-tokens.md](docs/slack-bot-tokens.md)
  - User tokens (`xoxp-`): [docs/slack-user-tokens.md](docs/slack-user-tokens.md)
- Slack team/workspace ID (`T…`): [docs/slack-team-id.md](docs/slack-team-id.md)
- Slack search: [docs/search.md](docs/search.md)
- Slack history: [docs/channel-history.md](docs/channel-history.md)
- Slack canvases: [docs/canvas.md](docs/canvas.md)

## Available Tools

1. **slack_list_channels**
   - List channels accessible to the authenticated token (or pre-defined channels)
   - Optional inputs:
     - `limit` (number, default: 100, max: 200): Maximum number of channels to return
     - `cursor` (string): Pagination cursor for next page
   - Returns: List of channels with their IDs and information

2. **slack_post_message**
   - Post a new message to a Slack channel
   - Required inputs:
     - `channel_id` (string): The ID of the channel to post to
     - `text` (string): The message text to post
   - Returns: Message posting confirmation and timestamp

3. **slack_reply_to_thread**
   - Reply to a specific message thread
   - Required inputs:
     - `channel_id` (string): The channel containing the thread
     - `thread_ts` (string): Timestamp of the parent message
     - `text` (string): The reply text
   - Returns: Reply confirmation and timestamp

4. **slack_add_reaction**
   - Add an emoji reaction to a message
   - Required inputs:
     - `channel_id` (string): The channel containing the message
     - `timestamp` (string): Message timestamp to react to
     - `reaction` (string): Emoji name without colons
   - Returns: Reaction confirmation

5. **slack_get_channel_history**
   - Get messages from a channel with time range and pagination support
   - Required inputs:
     - `channel_id` (string): The channel ID
   - Optional inputs:
     - `limit` (number, default: 50, max: 200): Number of messages to retrieve
     - `oldest` (string): Unix timestamp - only fetch messages AFTER this time
     - `latest` (string): Unix timestamp - only fetch messages BEFORE this time
     - `cursor` (string): Pagination cursor from previous response
     - `inclusive` (boolean): Include messages at oldest/latest timestamps
   - Returns: List of messages with `has_more` and `response_metadata.next_cursor` for pagination

6. **slack_get_thread_replies**
   - Get replies in a message thread with pagination support
   - Required inputs:
     - `channel_id` (string): The channel containing the thread
     - `thread_ts` (string): Timestamp of the parent message
   - Optional inputs:
     - `cursor` (string): Pagination cursor from previous response
     - `limit` (number, default: 100, max: 200): Number of replies to retrieve
   - Returns: List of replies with `has_more` and `response_metadata.next_cursor` for pagination

7. **slack_search_messages**
   - Search for messages across the workspace using Slack's search syntax
   - Required inputs:
     - `query` (string): Search query with optional modifiers (e.g., `in:#channel`, `from:@user`, `after:YYYY-MM-DD`)
   - Optional inputs:
     - `count` (number, default: 20, max: 100): Number of results to return
     - `cursor` (string): Pagination cursor for next page
     - `sort` (string): Sort by 'score' (relevance) or 'timestamp' (default: timestamp)
     - `sort_dir` (string): Sort direction 'asc' or 'desc' (default: desc)
   - Returns: Search results with message matches, channel info, and pagination data

8. **slack_get_users**
   - Get list of workspace users with basic profile information
   - Optional inputs:
     - `cursor` (string): Pagination cursor for next page
     - `limit` (number, default: 100, max: 200): Maximum users to return
   - Returns: List of users with their basic profiles

9. **slack_get_user_profile**
   - Get detailed profile information for a specific user
   - Required inputs:
     - `user_id` (string): The user's ID
   - Returns: Detailed user profile information

10. **slack_list_canvases**
    - List canvases accessible to the authenticated token
    - Optional inputs:
      - `limit` (number, default: 100): Maximum canvases to return
      - `cursor` (string): Pagination cursor for next page
    - Returns: List of canvases with IDs, titles, and metadata

11. **slack_read_canvas**
    - Read the full content of a canvas (returns HTML)
    - Required inputs:
      - `canvas_id` (string): The canvas/file ID (starts with 'F')
    - Returns: Canvas content as HTML, plus metadata (title, created, updated, permalink)

12. **slack_edit_canvas**
    - Edit a canvas by inserting, replacing, or deleting content
    - Required inputs:
      - `canvas_id` (string): The canvas/file ID
      - `operation` (string): One of 'insert_at_start', 'insert_at_end', 'replace', 'delete'
    - Optional inputs:
      - `markdown` (string): Content in Slack markdown format
      - `section_id` (string): Target section for replace/delete operations
    - Note: Uses Slack-specific markdown. Mentions: `![](#C123)` for channels, `![](@U123)` for users

13. **slack_create_canvas**
    - Create a new standalone canvas
    - Required inputs:
      - `title` (string): Title of the new canvas
    - Optional inputs:
      - `markdown` (string): Initial content in Slack markdown
    - Note: Standalone canvases require a paid Slack plan

## Token Modes

This server supports two authentication modes with different capabilities:

| Feature              | Bot Mode (`xoxb-`)              | User Mode (`xoxp-`)             |
| -------------------- | ------------------------------- | ------------------------------- |
| Messages appear from | Bot app                         | Your account                    |
| Channel access       | Only channels bot is invited to | All channels you have access to |
| `search.messages`    | **Does not work**               | Works                           |
| OAuth flow           | App installation                | User OAuth                      |
| Best for             | Team-wide automation            | Personal assistant, searching   |

**Recommendation**: Use **User Mode** if you want messages to appear as yourself or need to use `slack_search_messages`. Use **Bot Mode** if you want a distinct bot identity for the integration.

## Slack Setup

### Option A: Bot Token Setup (Bot Mode)

Use this if you want messages to appear from a bot app.

#### 1. Create a Slack App

- Visit the [Slack Apps page](https://api.slack.com/apps)
- Click "Create New App"
- Choose "From scratch"
- Name your app and select your workspace

#### 2. Configure Bot Token Scopes

Navigate to "OAuth & Permissions" and add these **Bot Token Scopes**:

- `channels:history` - View messages and other content in public channels
- `channels:read` - View basic channel information
- `chat:write` - Send messages as the app
- `reactions:write` - Add emoji reactions to messages
- `users:read` - View users and their basic information
- `users.profile:read` - View detailed profiles about users
- `files:read` - View files and canvases (required for listing/reading canvases)
- `canvases:write` - Create/edit canvases (required for `slack_edit_canvas` and `slack_create_canvas`)

> **Note**: `search:read` scope does not work with bot tokens. Use a user token if you need search functionality.

#### 3. Install App to Workspace

- Click "Install to Workspace" and authorize the app
- Save the "Bot User OAuth Token" that starts with `xoxb-`

#### 4. Add Bot to Channels

For the bot to access channels, invite it using `/invite @your-bot-name`

### Option B: User Token Setup (User Mode)

Use this if you want messages to appear as yourself and need full search functionality.

#### 1. Create a Slack App (if not already done)

- Visit the [Slack Apps page](https://api.slack.com/apps)
- Click "Create New App" → "From scratch"
- Name your app and select your workspace

#### 2. Configure User Token Scopes

Navigate to "OAuth & Permissions" and add these **User Token Scopes**:

- `channels:history` - View messages in public channels
- `channels:read` - View basic channel information
- `chat:write` - Send messages as yourself
- `reactions:write` - Add emoji reactions
- `users:read` - View users and their basic information
- `users.profile:read` - View detailed profiles
- `search:read` - Search messages and files (**only works with user tokens**)
- `files:read` - View files and canvases (required for listing/reading canvases)
- `canvases:write` - Create/edit canvases (required for `slack_edit_canvas` and `slack_create_canvas`)

For private channels, also add:

- `groups:history` - View messages in private channels
- `groups:read` - View private channel information

#### 3. Install and Authorize

- Click "Install to Workspace"
- Authorize the app with your user account
- Save the "User OAuth Token" that starts with `xoxp-`

### Get Your Team ID

Get your Team ID (starts with a `T`) by following [this guidance](https://slack.com/help/articles/221769328-Locate-your-Slack-URL-or-ID#find-your-workspace-or-org-id)

## Features

- **Multiple Transport Support**: Supports both stdio and Streamable HTTP transports
- **Modern MCP SDK**: Uses the MCP SDK `@modelcontextprotocol/sdk` (currently `^1.25.3`) with the modern `McpServer` API
- **Comprehensive Slack Integration**: Full set of Slack operations including:
  - List channels (with predefined channel support)
  - Post messages
  - Reply to threads
  - Add reactions
  - Get channel history
  - Get thread replies
  - List users
  - Get user profiles
  - Canvas operations (list/read/edit/create)
  - Search (user token mode only)
- **Operational hygiene**:
  - Structured logs to **stderr** (set `LOG_LEVEL=debug|info|warn|error`)
  - Rate-limit aware retries for safe, idempotent Slack reads

## Installation

### Local Development

```bash
npm install
npm run build
```

### Global Installation (NPM)

```bash
npm install -g @zencoderai/slack-mcp-server
```

### Docker Installation

```bash
# Build the Docker image locally
docker build -t slack-mcp-server .

# Or pull from Docker Hub
docker pull zencoderai/slack-mcp:latest

# Or pull a specific version
docker pull zencoderai/slack-mcp:1.0.0
```

## Configuration

Set the following environment variables:

```bash
# Required: Your workspace/team ID
export SLACK_TEAM_ID="your-team-id"

# Choose ONE of these token options:
export SLACK_BOT_TOKEN="xoxb-your-bot-token"   # Bot mode - messages appear as bot
export SLACK_USER_TOKEN="xoxp-your-user-token" # User mode - messages appear as you (takes precedence)

# Optional settings:
export SLACK_CHANNEL_IDS="channel1,channel2,channel3"  # Restrict to specific channels
export AUTH_TOKEN="your-auth-token"  # Bearer token for HTTP transport authorization
export LOG_LEVEL="info"  # Structured logs to stderr (debug|info|warn|error)
```

> **Note**: If both `SLACK_USER_TOKEN` and `SLACK_BOT_TOKEN` are set, the user token takes precedence.

## Usage

### Cursor (MCP)

See [docs/cursor.md](docs/cursor.md) for a copy-pasteable Cursor MCP configuration (stdio).

### Command Line Options

```bash
slack-mcp [options]

Options:
  --transport <type>     Transport type: 'stdio' or 'http' (default: stdio)
  --port <number>        Port for HTTP server when using Streamable HTTP transport (default: 3000)
  --token <token>        Bearer token for HTTP authorization (optional, can also use AUTH_TOKEN env var)
  --help, -h             Show this help message
```

### Local Usage Examples

#### Using the slack-mcp command (after global installation)

```bash
# Use stdio transport (default)
slack-mcp

# Use stdio transport explicitly
slack-mcp --transport stdio

# Use Streamable HTTP transport on default port 3000
slack-mcp --transport http

# Use Streamable HTTP transport on custom port
slack-mcp --transport http --port 8080

# Use Streamable HTTP transport with custom auth token
slack-mcp --transport http --token mytoken

# Use Streamable HTTP transport with auth token from environment variable
AUTH_TOKEN=mytoken slack-mcp --transport http
```

#### Using node directly (for development)

```bash
# Use stdio transport (default)
node dist/index.js

# Use stdio transport explicitly
node dist/index.js --transport stdio

# Use Streamable HTTP transport on default port 3000
node dist/index.js --transport http

# Use Streamable HTTP transport on custom port
node dist/index.js --transport http --port 8080

# Use Streamable HTTP transport with custom auth token
node dist/index.js --transport http --token mytoken

# Use Streamable HTTP transport with auth token from environment variable
AUTH_TOKEN=mytoken node dist/index.js --transport http
```

### Docker Usage Examples

#### Using Docker directly

```bash
# Run with stdio transport (default)
docker run --rm \
  -e SLACK_BOT_TOKEN="xoxb-your-bot-token" \
  -e SLACK_TEAM_ID="your-team-id" \
  zencoderai/slack-mcp:latest

# Run with HTTP transport on port 3000
docker run --rm -p 3000:3000 \
  -e SLACK_BOT_TOKEN="xoxb-your-bot-token" \
  -e SLACK_TEAM_ID="your-team-id" \
  zencoderai/slack-mcp:latest --transport http

# Run with HTTP transport on custom port
docker run --rm -p 8080:8080 \
  -e SLACK_BOT_TOKEN="xoxb-your-bot-token" \
  -e SLACK_TEAM_ID="your-team-id" \
  zencoderai/slack-mcp:latest --transport http --port 8080

# Run with custom auth token
docker run --rm -p 3000:3000 \
  -e SLACK_BOT_TOKEN="xoxb-your-bot-token" \
  -e SLACK_TEAM_ID="your-team-id" \
  -e AUTH_TOKEN="mytoken" \
  zencoderai/slack-mcp:latest --transport http
```

#### Using Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  slack-mcp:
    # Use published image:
    image: zencoderai/slack-mcp:latest
    # Or build locally:
    # build: .
    environment:
      - SLACK_BOT_TOKEN=xoxb-your-bot-token
      - SLACK_TEAM_ID=your-team-id
      - SLACK_CHANNEL_IDS=channel1,channel2,channel3 # Optional
      - AUTH_TOKEN=your-auth-token # Optional for HTTP transport
    ports:
      - '3000:3000' # Only needed for HTTP transport
    command: ['--transport', 'http'] # Optional: specify transport type
    restart: unless-stopped
```

Then run:

```bash
# Start the service
docker compose up -d

# View logs
docker compose logs -f slack-mcp

# Stop the service
docker compose down
```

## Transport Types

### Stdio Transport

- **Use case**: Command-line tools and direct integrations
- **Communication**: Standard input/output streams
- **Default**: Yes

### Streamable HTTP Transport

- **Use case**: Remote servers and web-based integrations
- **Communication**: HTTP POST requests with optional Server-Sent Events streams
- **Features**:
  - Session management
  - Bidirectional communication
  - Resumable connections
  - RESTful API endpoints
  - Bearer token authentication

## Authentication (Streamable HTTP Transport Only)

When using Streamable HTTP transport, the server supports Bearer token authentication:

1. **Command Line**: Use `--token <token>` to specify a custom token
2. **Environment Variable**: Set `AUTH_TOKEN=<token>` as a fallback
3. **Auto-generated**: If neither is provided, a random token is generated

The command line option takes precedence over the environment variable. Include the token in HTTP requests using the `Authorization: Bearer <token>` header.

## Troubleshooting

If you encounter permission errors, verify that:

1. All required scopes are added to your Slack app
2. The app is properly installed to your workspace
3. The tokens and workspace ID are correctly copied to your configuration
4. The app has been added to the channels it needs to access

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Lint & format

```bash
# Lint
npm run lint
npm run lint:fix

# Format
npm run format
npm run format:check
```

### Tests

```bash
npm test
npm run test:coverage
```

### Git hooks

This repo uses **Husky + lint-staged** to run formatting and linting on staged files during `pre-commit`, and `npm test` on `pre-push`.

## API Endpoints (Streamable HTTP Transport)

When using Streamable HTTP transport, the server exposes the following endpoints:

- `POST /mcp` - Client-to-server communication
- `GET /mcp` - Server-to-client notifications (Server-Sent Events streams)
- `DELETE /mcp` - Session termination

## Changes from Previous Version

- **Updated MCP SDK**: Upgraded from v1.0.1 to `@modelcontextprotocol/sdk` `^1.25.3`
- **Modern API**: Migrated from low-level Server class to high-level McpServer class
- **Zod Validation**: Added proper schema validation using Zod
- **Transport Flexibility**: Added support for Streamable HTTP transport
- **Command Line Interface**: Added CLI arguments for transport selection
- **Session Management**: Implemented proper session handling for HTTP transport
- **Better Error Handling**: Improved error handling and logging

## Update log

- 2026-01-22: Added linting/formatting tooling, CI checks, Dependabot, contribution/security docs, and Canvas/search/history enhancements.
- 2026-01-22: Refactored runtime code into `src/`, added structured stderr logging, rate-limit aware retries, generated `.d.ts` types, and expanded tests/coverage.
