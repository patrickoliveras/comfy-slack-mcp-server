import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import type { SlackClient } from '../client/slack-client.js';
import { createSlackServer } from '../server/create-slack-server.js';
import type { Logger } from '../logger.js';

export async function runStdioServer(slackClient: SlackClient, logger: Logger) {
  logger.info('Starting Slack MCP Server with stdio transport...');
  const server = createSlackServer(slackClient, { logger });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Slack MCP Server running on stdio');
}
