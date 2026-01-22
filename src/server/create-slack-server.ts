import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { SlackClient } from '../client/slack-client.js';
import { createLogger, type Logger } from '../logger.js';
import { getPackageVersionSync } from '../version.js';
import type { CanvasChange, SlackFile, SlackSearchMatch } from '../types/slack.js';

function toToolResponse(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }] };
}

function serializeError(err: unknown): { name: string; message: string } {
  if (err instanceof Error) {
    return { name: err.name, message: err.message };
  }
  return { name: 'Error', message: String(err) };
}

function withToolErrorHandling<TArgs extends Record<string, unknown>>(
  logger: Logger,
  toolName: string,
  handler: (args: TArgs) => Promise<unknown>,
) {
  return async (args: TArgs) => {
    try {
      const result = await handler(args);
      return toToolResponse(result);
    } catch (err) {
      const e = serializeError(err);
      logger.error('Tool execution failed', {
        tool: toolName,
        error_name: e.name,
        error_message: e.message,
      });
      return toToolResponse({
        ok: false,
        error: 'tool_execution_failed',
        message: e.message,
        _tool: toolName,
      });
    }
  };
}

export function createSlackServer(
  slackClient: SlackClient,
  options?: { logger?: Logger; server?: McpServer },
): McpServer {
  const logger = options?.logger ?? createLogger({ service: 'slack-mcp-server' });

  const server =
    options?.server ??
    new McpServer({
      name: 'Slack MCP Server',
      version: getPackageVersionSync(),
    });

  server.registerTool(
    'slack_list_channels',
    {
      title: 'List Slack Channels',
      description:
        'List public and private channels accessible to the authenticated token, or pre-defined channels in the workspace with pagination. Use this to discover channel IDs before calling slack_get_channel_history. Returns channel id, name, and metadata.',
      inputSchema: {
        limit: z
          .number()
          .optional()
          .default(100)
          .describe('Maximum number of channels to return (default 100, max 200)'),
        cursor: z.string().optional().describe('Pagination cursor for next page of results'),
      },
    },
    withToolErrorHandling(logger, 'slack_list_channels', async ({ limit, cursor }) => {
      return slackClient.getChannels(limit, cursor);
    }),
  );

  server.registerTool(
    'slack_post_message',
    {
      title: 'Post Slack Message',
      description:
        "Post a new message to a Slack channel or direct message to user. For DMs, use the user's ID (U0123ABC) as the channel_id.",
      inputSchema: {
        channel_id: z.string().describe('The ID of the channel or user to post to'),
        text: z.string().describe('The message text to post'),
      },
    },
    withToolErrorHandling(logger, 'slack_post_message', async ({ channel_id, text }) => {
      return slackClient.postMessage(channel_id, text);
    }),
  );

  server.registerTool(
    'slack_reply_to_thread',
    {
      title: 'Reply to Slack Thread',
      description: 'Reply to a specific message thread in Slack',
      inputSchema: {
        channel_id: z.string().describe('The ID of the channel containing the thread'),
        thread_ts: z
          .string()
          .describe(
            "The timestamp of the parent message in the format '1234567890.123456'. Timestamps in the format without the period can be converted by adding the period such that 6 numbers come after it.",
          ),
        text: z.string().describe('The reply text'),
      },
    },
    withToolErrorHandling(
      logger,
      'slack_reply_to_thread',
      async ({ channel_id, thread_ts, text }) => {
        return slackClient.postReply(channel_id, thread_ts, text);
      },
    ),
  );

  server.registerTool(
    'slack_add_reaction',
    {
      title: 'Add Slack Reaction',
      description: 'Add a reaction emoji to a message',
      inputSchema: {
        channel_id: z.string().describe('The ID of the channel containing the message'),
        timestamp: z.string().describe('The timestamp of the message to react to'),
        reaction: z.string().describe('The name of the emoji reaction (without ::)'),
      },
    },
    withToolErrorHandling(
      logger,
      'slack_add_reaction',
      async ({ channel_id, timestamp, reaction }) => {
        return slackClient.addReaction(channel_id, timestamp, reaction);
      },
    ),
  );

  server.registerTool(
    'slack_get_channel_history',
    {
      title: 'Get Slack Channel History',
      description:
        "Get messages from a channel with optional time range and pagination. Use oldest/latest to jump to specific dates, cursor to paginate through results. Messages with 'reply_count > 0' or 'thread_ts' are thread parents - use slack_get_thread_replies to fetch their replies. User IDs in messages can be resolved via slack_get_users.",
      inputSchema: {
        channel_id: z.string().describe('The ID of the channel'),
        limit: z
          .number()
          .optional()
          .default(50)
          .describe('Number of messages to retrieve (default 50, max 200)'),
        oldest: z
          .string()
          .optional()
          .describe(
            'Unix timestamp (seconds, can be fractional) - only fetch messages AFTER this time',
          ),
        latest: z
          .string()
          .optional()
          .describe(
            'Unix timestamp (seconds, can be fractional) - only fetch messages BEFORE this time',
          ),
        cursor: z
          .string()
          .optional()
          .describe("Pagination cursor from previous response's response_metadata.next_cursor"),
        inclusive: z
          .boolean()
          .optional()
          .describe('Include messages with oldest/latest timestamps (default false)'),
      },
    },
    withToolErrorHandling(
      logger,
      'slack_get_channel_history',
      async ({ channel_id, limit, oldest, latest, cursor, inclusive }) => {
        const response = await slackClient.getChannelHistory(
          channel_id,
          limit,
          oldest,
          latest,
          cursor,
          inclusive,
        );
        const messages = response.messages ?? [];
        return {
          ...response,
          _request_context: { channel_id, oldest, latest, limit, cursor_used: cursor },
          ...(messages.length > 0 && {
            _time_range: {
              oldest_message_ts: messages[messages.length - 1]?.ts,
              newest_message_ts: messages[0]?.ts,
              oldest_message_time: (() => {
                const ts = messages[messages.length - 1]?.ts;
                return ts ? new Date(parseFloat(ts) * 1000).toISOString() : null;
              })(),
              newest_message_time: (() => {
                const ts = messages[0]?.ts;
                return ts ? new Date(parseFloat(ts) * 1000).toISOString() : null;
              })(),
            },
          }),
        };
      },
    ),
  );

  server.registerTool(
    'slack_get_thread_replies',
    {
      title: 'Get Slack Thread Replies',
      description:
        "Get replies in a message thread with pagination support for long threads. Use this after finding a thread parent in channel history (messages with 'reply_count > 0'). The thread_ts is the 'ts' of the parent message.",
      inputSchema: {
        channel_id: z.string().describe('The ID of the channel containing the thread'),
        thread_ts: z
          .string()
          .describe(
            "The timestamp of the parent message in the format '1234567890.123456'. Timestamps in the format without the period can be converted by adding the period such that 6 numbers come after it.",
          ),
        cursor: z
          .string()
          .optional()
          .describe("Pagination cursor from previous response's response_metadata.next_cursor"),
        limit: z
          .number()
          .optional()
          .default(100)
          .describe('Number of replies to retrieve (default 100, max 200)'),
      },
    },
    withToolErrorHandling(
      logger,
      'slack_get_thread_replies',
      async ({ channel_id, thread_ts, cursor, limit }) => {
        const response = await slackClient.getThreadReplies(channel_id, thread_ts, cursor, limit);
        const messages = response.messages ?? [];
        return {
          ...response,
          _request_context: {
            channel_id,
            thread_ts,
            thread_time: new Date(parseFloat(thread_ts) * 1000).toISOString(),
            limit,
            cursor_used: cursor,
          },
          ...(messages.length > 0 && {
            _thread_info: {
              reply_count: messages.length - 1,
              parent_ts: messages[0]?.ts,
              latest_reply_ts: messages[messages.length - 1]?.ts,
              latest_reply_time: (() => {
                const ts = messages[messages.length - 1]?.ts;
                return ts ? new Date(parseFloat(ts) * 1000).toISOString() : null;
              })(),
            },
          }),
        };
      },
    ),
  );

  server.registerTool(
    'slack_search_messages',
    {
      title: 'Search Slack Messages',
      description:
        "Search for messages across the workspace using Slack's search syntax. Supports modifiers like 'in:#channel', 'from:@user', 'before:YYYY-MM-DD', 'after:YYYY-MM-DD', 'on:YYYY-MM-DD', 'has:reaction', 'has:pin', 'is:thread'. Example: '\"database migration\" in:#backend after:2026-01-01'. NOTE: This tool ONLY works with user tokens (xoxp-), not bot tokens. If search returns an error or empty results unexpectedly, check the token type.",
      inputSchema: {
        query: z.string().describe('Search query with optional Slack search modifiers'),
        count: z
          .number()
          .optional()
          .default(20)
          .describe('Number of results to return (default 20, max 100)'),
        cursor: z
          .string()
          .optional()
          .describe(
            'Pagination cursor for next page of results (use next_cursor from previous response)',
          ),
        sort: z
          .enum(['score', 'timestamp'])
          .optional()
          .default('timestamp')
          .describe(
            "Sort order: 'score' for relevance, 'timestamp' for recency (default: timestamp)",
          ),
        sort_dir: z
          .enum(['asc', 'desc'])
          .optional()
          .default('desc')
          .describe("Sort direction: 'asc' or 'desc' (default: desc)"),
      },
    },
    withToolErrorHandling(
      logger,
      'slack_search_messages',
      async ({ query, count, cursor, sort, sort_dir }) => {
        const response = await slackClient.searchMessages(query, count, cursor, sort, sort_dir);
        const matches = (response.messages?.matches ?? []) as SlackSearchMatch[];
        return {
          ...response,
          _request_context: { query, count, sort, sort_dir, cursor_used: cursor },
          _search_summary: {
            total_matches: response.messages?.total || 0,
            returned_count: matches.length,
            channels_in_results: [...new Set(matches.map((m) => m.channel?.name).filter(Boolean))],
            ...(matches.length > 0 && {
              oldest_result_time: (() => {
                const ts = matches[matches.length - 1]?.ts;
                return ts ? new Date(parseFloat(ts) * 1000).toISOString() : null;
              })(),
              newest_result_time: (() => {
                const ts = matches[0]?.ts;
                return ts ? new Date(parseFloat(ts) * 1000).toISOString() : null;
              })(),
            }),
          },
        };
      },
    ),
  );

  server.registerTool(
    'slack_get_users',
    {
      title: 'Get Slack Users',
      description:
        "Get a list of all users in the workspace with their basic profile information. Use this to resolve user IDs (like 'U0123ABC') from messages to names. Returns id, name, real_name, and basic profile for each user.",
      inputSchema: {
        cursor: z.string().optional().describe('Pagination cursor for next page of results'),
        limit: z
          .number()
          .optional()
          .default(100)
          .describe('Maximum number of users to return (default 100, max 200)'),
      },
    },
    withToolErrorHandling(logger, 'slack_get_users', async ({ cursor, limit }) => {
      return slackClient.getUsers(limit, cursor);
    }),
  );

  server.registerTool(
    'slack_get_user_profile',
    {
      title: 'Get Slack User Profile',
      description: 'Get detailed profile information for a specific user',
      inputSchema: {
        user_id: z.string().describe('The ID of the user'),
      },
    },
    withToolErrorHandling(logger, 'slack_get_user_profile', async ({ user_id }) => {
      return slackClient.getUserProfile(user_id);
    }),
  );

  // Canvas tools

  server.registerTool(
    'slack_list_canvases',
    {
      title: 'List Slack Canvases',
      description:
        "List canvases accessible to the authenticated token. Returns canvas files with their IDs, titles, and metadata. Use the canvas_id (file ID starting with 'F') with other canvas tools.",
      inputSchema: {
        limit: z
          .number()
          .optional()
          .default(100)
          .describe('Maximum number of canvases to return (default 100, max 100)'),
        cursor: z.string().optional().describe('Pagination cursor for next page of results'),
      },
    },
    withToolErrorHandling(logger, 'slack_list_canvases', async ({ limit, cursor }) => {
      const response = await slackClient.listCanvases(limit, cursor);
      const files = (response.files || []) as SlackFile[];
      return {
        ...response,
        _summary: {
          returned_count: files.length,
          canvases: files.map((f) => ({
            canvas_id: f.id,
            title: f.title || f.name,
            created: f.created ? new Date(f.created * 1000).toISOString() : null,
            updated: f.updated ? new Date(f.updated * 1000).toISOString() : null,
            permalink: f.permalink,
          })),
        },
      };
    }),
  );

  server.registerTool(
    'slack_read_canvas',
    {
      title: 'Read Slack Canvas',
      description:
        "Read the full content of a canvas. Returns the canvas as HTML. The canvas_id is a file ID starting with 'F' (get it from slack_list_canvases or from channel info).",
      inputSchema: {
        canvas_id: z.string().describe("The canvas/file ID (starts with 'F', e.g., 'F0123CANVAS')"),
      },
    },
    withToolErrorHandling(logger, 'slack_read_canvas', async ({ canvas_id }) => {
      return slackClient.readCanvas(canvas_id);
    }),
  );

  server.registerTool(
    'slack_edit_canvas',
    {
      title: 'Edit Slack Canvas',
      description:
        "Edit a canvas by inserting, replacing, or deleting content. Content uses Slack's markdown format. Mentions use special syntax: channel mention '![](#C123ABC)', user mention '![](@U123ABC)'. Note: Standalone canvases require a paid Slack plan.",
      inputSchema: {
        canvas_id: z.string().describe("The canvas/file ID (starts with 'F')"),
        operation: z
          .enum(['insert_at_start', 'insert_at_end', 'replace', 'delete'])
          .describe('The edit operation to perform'),
        markdown: z
          .string()
          .optional()
          .describe(
            'Markdown content for insert/replace operations. Supports headers, lists, checkboxes, etc.',
          ),
        section_id: z
          .string()
          .optional()
          .describe(
            'Target section ID for replace/delete operations. Get section IDs from the canvas structure.',
          ),
      },
    },
    withToolErrorHandling(
      logger,
      'slack_edit_canvas',
      async ({ canvas_id, operation, markdown, section_id }) => {
        const change: CanvasChange = { operation };
        if (section_id) change.section_id = section_id;
        if (
          markdown &&
          (operation === 'insert_at_start' ||
            operation === 'insert_at_end' ||
            operation === 'replace')
        ) {
          change.document_content = { type: 'markdown', markdown };
        }
        return slackClient.editCanvas(canvas_id, [change]);
      },
    ),
  );

  server.registerTool(
    'slack_create_canvas',
    {
      title: 'Create Slack Canvas',
      description:
        'Create a new standalone canvas. Note: Standalone canvases require a paid Slack plan. For free plans, use channel canvases instead.',
      inputSchema: {
        title: z.string().describe('Title of the new canvas'),
        markdown: z.string().optional().describe('Initial content in Slack markdown format'),
      },
    },
    withToolErrorHandling(logger, 'slack_create_canvas', async ({ title, markdown }) => {
      return slackClient.createCanvas(title, markdown);
    }),
  );

  return server;
}
