import type { Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';

import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import type { SlackClient } from '../client/slack-client.js';
import { createSlackServer } from '../server/create-slack-server.js';
import { getPackageVersionSync } from '../version.js';
import type { Logger } from '../logger.js';

export async function runHttpServer(
  slackClient: SlackClient,
  logger: Logger,
  port: number = 3000,
  authToken?: string,
): Promise<HttpServer> {
  logger.info('Starting Slack MCP Server with Streamable HTTP transport', { port });

  const app = express();
  app.use(express.json());

  const authMiddleware = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (!authToken) return next();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Unauthorized: Missing or invalid Authorization header' },
        id: null,
      });
    }

    const token = authHeader.substring(7);
    if (token !== authToken) {
      return res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Unauthorized: Invalid token' },
        id: null,
      });
    }

    next();
  };

  const transports: Record<string, StreamableHTTPServerTransport> = {};

  app.post('/mcp', authMiddleware, async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && req.body?.method === 'initialize') {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            transports[newSessionId] = transport;
          },
        });

        transport.onclose = () => {
          if (transport.sessionId) delete transports[transport.sessionId];
        };

        const server = createSlackServer(slackClient, { logger });
        await server.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error handling MCP request', { message });
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  const handleSessionRequest = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  };

  app.get('/mcp', authMiddleware, handleSessionRequest);
  app.delete('/mcp', authMiddleware, handleSessionRequest);

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Slack MCP Server',
      version: getPackageVersionSync(),
    });
  });

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info('Slack MCP Server running', { url: `http://0.0.0.0:${port}/mcp` });
  });

  return server;
}
