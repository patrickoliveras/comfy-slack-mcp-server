import type { Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';

import { SlackClient } from './client/slack-client.js';
import { createLogger } from './logger.js';
import { parseArgs } from './cli.js';
import { runStdioServer } from './transports/stdio.js';
import { runHttpServer } from './transports/http.js';

export async function main() {
  const { transport, port, authToken } = parseArgs();
  const logger = createLogger({ service: 'slack-mcp-server' });

  const botToken = process.env.SLACK_BOT_TOKEN;
  const userToken = process.env.SLACK_USER_TOKEN;
  const teamId = process.env.SLACK_TEAM_ID;

  if (!teamId) {
    logger.error('Please set SLACK_TEAM_ID environment variable');
    process.exit(1);
  }

  if (!botToken && !userToken) {
    logger.error('Please set either SLACK_BOT_TOKEN or SLACK_USER_TOKEN environment variable');
    process.exit(1);
  }

  let slackClient: SlackClient;
  if (userToken) {
    slackClient = new SlackClient(userToken, 'user', { logger });
    logger.info('Running in USER mode - messages will appear as you');
    if (botToken) {
      logger.info('Both SLACK_USER_TOKEN and SLACK_BOT_TOKEN are set; using user token');
    }
  } else {
    slackClient = new SlackClient(botToken!, 'bot', { logger });
    logger.info('Running in BOT mode - messages will appear as the bot app');
  }

  let httpServer: HttpServer | null = null;

  const setupGracefulShutdown = () => {
    const shutdown = (signal: string) => {
      logger.info('Shutting down gracefully', { signal });

      if (httpServer) {
        httpServer.close(() => {
          logger.info('HTTP server closed.');
          process.exit(0);
        });

        setTimeout(() => {
          logger.error('Forcing shutdown...');
          process.exit(1);
        }, 5000);
      } else {
        process.exit(0);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));
  };

  setupGracefulShutdown();

  if (transport === 'stdio') {
    await runStdioServer(slackClient, logger);
  } else if (transport === 'http') {
    let finalAuthToken = authToken || process.env.AUTH_TOKEN;
    if (!finalAuthToken) {
      finalAuthToken = randomUUID();
      logger.warn('Generated auth token', { authToken: finalAuthToken });
      logger.warn('Use this token in the Authorization header', {
        header: `Bearer ${finalAuthToken}`,
      });
    } else if (authToken) {
      logger.info('Using provided auth token for authorization');
    } else {
      logger.info('Using auth token from AUTH_TOKEN environment variable');
    }

    httpServer = await runHttpServer(slackClient, logger, port, finalAuthToken);
  }
}
