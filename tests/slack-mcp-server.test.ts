import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';

// Mock fetch globally
(global as any).fetch = jest.fn();

function mockJsonResponse(
  payload: unknown,
  options?: {
    status?: number;
    ok?: boolean;
    statusText?: string;
    headers?: Record<string, string>;
  },
) {
  const headerEntries = Object.entries(options?.headers ?? {}).map(
    ([k, v]) => [k.toLowerCase(), v] as const,
  );
  const headerMap = new Map(headerEntries);

  return {
    status: options?.status ?? 200,
    ok: options?.ok ?? true,
    statusText: options?.statusText ?? 'OK',
    headers: {
      get: (name: string) => headerMap.get(name.toLowerCase()) ?? null,
    },
    json: () => Promise.resolve(payload),
    text: () => Promise.resolve(typeof payload === 'string' ? payload : JSON.stringify(payload)),
  };
}

// Mock the MCP SDK modules
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    registerTool: jest.fn(),
    connect: jest.fn(),
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn(),
}));

jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest.fn().mockImplementation(() => ({
    sessionId: 'test-session-id',
    onclose: null,
    handleRequest: jest.fn(),
  })),
}));

jest.mock('express', () => {
  const mockApp = {
    use: jest.fn(),
    post: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    listen: jest.fn(() => ({ close: jest.fn() })),
  };
  const mockExpress = jest.fn(() => mockApp);
  (mockExpress as any).json = jest.fn();
  return mockExpress;
});

// Mock process.env
const originalEnv = process.env;
const originalArgv = process.argv;
let stderrWriteSpy: any;

beforeEach(() => {
  jest.resetModules();
  stderrWriteSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  process.env = {
    ...originalEnv,
    SLACK_BOT_TOKEN: 'xoxb-test-token',
    SLACK_TEAM_ID: 'T123456',
  };
  process.argv = originalArgv;
});

afterEach(() => {
  if (stderrWriteSpy) {
    stderrWriteSpy.mockRestore();
    stderrWriteSpy = undefined;
  }
  process.env = originalEnv;
  process.argv = originalArgv;
  jest.clearAllMocks();
});

describe('SlackClient', () => {
  let SlackClient: any;
  let slackClient: any;
  const mockFetch = (global as any).fetch;

  beforeEach(async () => {
    const indexModule = await import('../index.js');
    SlackClient = indexModule.SlackClient;
    slackClient = new SlackClient('xoxb-test-token');
  });

  test('SlackClient constructor creates headers (bot mode)', () => {
    expect(slackClient).toHaveProperty('headers');
    expect((slackClient as any).headers).toEqual({
      Authorization: 'Bearer xoxb-test-token',
      'Content-Type': 'application/json',
    });
    expect(slackClient.tokenType).toBe('bot');
    expect(slackClient.isUserMode()).toBe(false);
  });

  test('SlackClient constructor with user token', () => {
    const userClient = new SlackClient('xoxp-user-token', 'user');
    expect((userClient as any).headers).toEqual({
      Authorization: 'Bearer xoxp-user-token',
      'Content-Type': 'application/json',
    });
    expect(userClient.tokenType).toBe('user');
    expect(userClient.isUserMode()).toBe(true);
  });

  test('getChannels with predefined IDs', async () => {
    process.env.SLACK_CHANNEL_IDS = 'C123456,C789012';
    mockFetch
      .mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          channel: { id: 'C123456', name: 'general', is_archived: false },
        }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          channel: { id: 'C789012', name: 'random', is_archived: false },
        }),
      );

    const result = await slackClient.getChannels();

    expect(result).toEqual({
      ok: true,
      channels: [
        { id: 'C123456', name: 'general', is_archived: false },
        { id: 'C789012', name: 'random', is_archived: false },
      ],
      response_metadata: { next_cursor: '' },
    });
  });

  test('getChannels with API call', async () => {
    delete process.env.SLACK_CHANNEL_IDS;
    const mockResponse = {
      ok: true,
      channels: [
        { id: 'C123456', name: 'general', is_archived: false },
        { id: 'C789012', name: 'random', is_archived: false },
      ],
      response_metadata: { next_cursor: '' },
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse(mockResponse));

    const result = await slackClient.getChannels();

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://slack.com/api/conversations.list'),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer xoxb-test-token',
          'Content-Type': 'application/json',
        },
      }),
    );
  });

  test('postMessage successful response', async () => {
    const mockResponse = {
      ok: true,
      channel: 'C123456',
      ts: '1234567890.123456',
      message: {
        text: 'Hello, world!',
        user: 'U123456',
        ts: '1234567890.123456',
      },
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse(mockResponse));

    const result = await slackClient.postMessage('C123456', 'Hello, world!');

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer xoxb-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: 'C123456',
        text: 'Hello, world!',
      }),
    });
  });

  test('postReply successful response', async () => {
    const mockResponse = {
      ok: true,
      channel: 'C123456',
      ts: '1234567890.123457',
      message: {
        text: 'Reply text',
        user: 'U123456',
        ts: '1234567890.123457',
        thread_ts: '1234567890.123456',
      },
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse(mockResponse));

    const result = await slackClient.postReply('C123456', '1234567890.123456', 'Reply text');

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer xoxb-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: 'C123456',
        thread_ts: '1234567890.123456',
        text: 'Reply text',
      }),
    });
  });

  test('addReaction successful response', async () => {
    const mockResponse = {
      ok: true,
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse(mockResponse));

    const result = await slackClient.addReaction('C123456', '1234567890.123456', 'thumbsup');

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith('https://slack.com/api/reactions.add', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer xoxb-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: 'C123456',
        timestamp: '1234567890.123456',
        name: 'thumbsup',
      }),
    });
  });

  test('getChannelHistory successful response', async () => {
    const mockResponse = {
      ok: true,
      messages: [
        {
          type: 'message',
          user: 'U123456',
          text: 'Hello',
          ts: '1234567890.123456',
        },
      ],
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse(mockResponse));

    const result = await slackClient.getChannelHistory('C123456', 10);

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://slack.com/api/conversations.history'),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer xoxb-test-token',
          'Content-Type': 'application/json',
        },
      }),
    );
  });

  test('getChannelHistory with time window parameters', async () => {
    const mockResponse = {
      ok: true,
      messages: [
        {
          type: 'message',
          user: 'U123456',
          text: 'Hello from the past',
          ts: '1704067200.123456',
        },
      ],
      has_more: true,
      response_metadata: { next_cursor: 'abc123' },
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse(mockResponse));

    const result = await slackClient.getChannelHistory(
      'C123456',
      50,
      '1704067200', // oldest
      '1704153600', // latest
      undefined, // cursor
      true, // inclusive
    );

    expect(result).toEqual(mockResponse);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('oldest=1704067200');
    expect(calledUrl).toContain('latest=1704153600');
    expect(calledUrl).toContain('inclusive=true');
  });

  test('getChannelHistory with pagination cursor', async () => {
    const mockResponse = {
      ok: true,
      messages: [],
      has_more: false,
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse(mockResponse));

    const result = await slackClient.getChannelHistory(
      'C123456',
      50,
      undefined,
      undefined,
      'next_cursor_value',
    );

    expect(result).toEqual(mockResponse);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('cursor=next_cursor_value');
  });

  test('getThreadReplies successful response', async () => {
    const mockResponse = {
      ok: true,
      messages: [
        {
          type: 'message',
          user: 'U123456',
          text: 'Parent message',
          ts: '1234567890.123456',
        },
        {
          type: 'message',
          user: 'U789012',
          text: 'Reply message',
          ts: '1234567890.123457',
          thread_ts: '1234567890.123456',
        },
      ],
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse(mockResponse));

    const result = await slackClient.getThreadReplies('C123456', '1234567890.123456');

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://slack.com/api/conversations.replies'),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer xoxb-test-token',
          'Content-Type': 'application/json',
        },
      }),
    );
  });

  test('getThreadReplies with pagination', async () => {
    const mockResponse = {
      ok: true,
      messages: [],
      has_more: true,
      response_metadata: { next_cursor: 'thread_cursor_123' },
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse(mockResponse));

    const result = await slackClient.getThreadReplies(
      'C123456',
      '1234567890.123456',
      'prev_cursor',
      50,
    );

    expect(result).toEqual(mockResponse);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('cursor=prev_cursor');
    expect(calledUrl).toContain('limit=50');
  });

  test('searchMessages successful response', async () => {
    const mockResponse = {
      ok: true,
      messages: {
        total: 2,
        matches: [
          {
            type: 'message',
            user: 'U123456',
            text: 'database migration completed',
            ts: '1704067200.123456',
            channel: { id: 'C123456', name: 'backend' },
          },
          {
            type: 'message',
            user: 'U789012',
            text: 'starting database migration',
            ts: '1704060000.123456',
            channel: { id: 'C123456', name: 'backend' },
          },
        ],
        paging: { count: 20, total: 2, page: 1, pages: 1 },
      },
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse(mockResponse));

    const result = await slackClient.searchMessages('database migration');

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://slack.com/api/search.messages'),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer xoxb-test-token',
          'Content-Type': 'application/json',
        },
      }),
    );
  });

  test('searchMessages with all parameters', async () => {
    const mockResponse = {
      ok: true,
      messages: { total: 0, matches: [] },
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse(mockResponse));

    const result = await slackClient.searchMessages(
      'auth outage in:#incidents',
      50,
      'search_cursor_123',
      'score',
      'asc',
    );

    expect(result).toEqual(mockResponse);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('query=auth+outage+in%3A%23incidents');
    expect(calledUrl).toContain('count=50');
    expect(calledUrl).toContain('cursor=search_cursor_123');
    expect(calledUrl).toContain('sort=score');
    expect(calledUrl).toContain('sort_dir=asc');
  });

  test('getUsers successful response', async () => {
    const mockResponse = {
      ok: true,
      members: [
        {
          id: 'U123456',
          name: 'testuser',
          real_name: 'Test User',
        },
      ],
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse(mockResponse));

    const result = await slackClient.getUsers(100);

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://slack.com/api/users.list'),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer xoxb-test-token',
          'Content-Type': 'application/json',
        },
      }),
    );
  });

  test('getUserProfile successful response', async () => {
    const mockResponse = {
      ok: true,
      profile: {
        real_name: 'Test User',
        email: 'test@example.com',
        phone: '+1234567890',
      },
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse(mockResponse));

    const result = await slackClient.getUserProfile('U123456');

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://slack.com/api/users.profile.get'),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer xoxb-test-token',
          'Content-Type': 'application/json',
        },
      }),
    );
  });

  // Canvas tests

  test('listCanvases successful response', async () => {
    const mockResponse = {
      ok: true,
      files: [
        {
          id: 'F0123CANVAS1',
          name: 'Project Plan',
          title: 'Project Plan',
          filetype: 'canvas',
          created: 1704067200,
          updated: 1704153600,
          permalink: 'https://workspace.slack.com/canvas/F0123CANVAS1',
        },
        {
          id: 'F0123CANVAS2',
          name: 'Meeting Notes',
          title: 'Meeting Notes',
          filetype: 'canvas',
          created: 1704060000,
          updated: 1704060000,
          permalink: 'https://workspace.slack.com/canvas/F0123CANVAS2',
        },
      ],
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse(mockResponse));

    const result = await slackClient.listCanvases(100);

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://slack.com/api/files.list'),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer xoxb-test-token',
          'Content-Type': 'application/json',
        },
      }),
    );
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('types=canvas');
  });

  test('getCanvasInfo successful response', async () => {
    const mockResponse = {
      ok: true,
      file: {
        id: 'F0123CANVAS1',
        title: 'Project Plan',
        filetype: 'canvas',
        url_private: 'https://files.slack.com/files-pri/T123/F0123CANVAS1/canvas.html',
        permalink: 'https://workspace.slack.com/canvas/F0123CANVAS1',
      },
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse(mockResponse));

    const result = await slackClient.getCanvasInfo('F0123CANVAS1');

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://slack.com/api/files.info'),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer xoxb-test-token',
          'Content-Type': 'application/json',
        },
      }),
    );
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('file=F0123CANVAS1');
  });

  test('editCanvas successful response', async () => {
    const mockResponse = {
      ok: true,
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse(mockResponse));

    const result = await slackClient.editCanvas('F0123CANVAS1', [
      {
        operation: 'insert_at_end',
        document_content: {
          type: 'markdown',
          markdown: '## New Section\n\nHello world',
        },
      },
    ]);

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith('https://slack.com/api/canvases.edit', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer xoxb-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        canvas_id: 'F0123CANVAS1',
        changes: [
          {
            operation: 'insert_at_end',
            document_content: {
              type: 'markdown',
              markdown: '## New Section\n\nHello world',
            },
          },
        ],
      }),
    });
  });

  test('createCanvas successful response', async () => {
    const mockResponse = {
      ok: true,
      canvas_id: 'F0NEW123456',
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse(mockResponse));

    const result = await slackClient.createCanvas('New Canvas', '# Hello\n\nWorld');

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith('https://slack.com/api/canvases.create', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer xoxb-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'New Canvas',
        document_content: {
          type: 'markdown',
          markdown: '# Hello\n\nWorld',
        },
      }),
    });
  });

  test('retries idempotent requests on 429 (no Retry-After)', async () => {
    const retryingClient = new SlackClient('xoxb-test-token', 'bot', {
      retryOptions: { maxRetries: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });

    mockFetch
      .mockResolvedValueOnce(
        mockJsonResponse({ ok: false, error: 'rate_limited' }, { status: 429, ok: false }),
      )
      .mockResolvedValueOnce(mockJsonResponse({ ok: true, members: [] }));

    const result = await retryingClient.getUsers(1);
    expect(result).toEqual({ ok: true, members: [] });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('readCanvas returns download_failed when url_private fetch fails', async () => {
    mockFetch
      // files.info
      .mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          file: {
            id: 'F1',
            title: 't',
            url_private: 'https://files.slack.com/private/canvas.html',
          },
        }),
      )
      // url_private download
      .mockResolvedValueOnce(
        mockJsonResponse('nope', { status: 500, ok: false, statusText: 'Internal Server Error' }),
      );

    const result = await slackClient.readCanvas('F1');
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: 'download_failed',
      }),
    );
  });

  test('postMessage does not retry non-idempotent requests on 5xx', async () => {
    const nonRetryingClient = new SlackClient('xoxb-test-token', 'bot', {
      retryOptions: { maxRetries: 3, baseDelayMs: 0, maxDelayMs: 0 },
    });

    mockFetch.mockResolvedValueOnce(
      mockJsonResponse(
        { ok: false },
        { status: 500, ok: false, statusText: 'Internal Server Error' },
      ),
    );

    await expect(nonRetryingClient.postMessage('C1', 'hi')).rejects.toThrow('Slack API HTTP error');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('createSlackServer', () => {
  test('createSlackServer returns server instance', async () => {
    const { createSlackServer, SlackClient } = await import('../index.js');

    const mockSlackClient = new SlackClient('xoxb-test-token');
    const server = createSlackServer(mockSlackClient);

    // Just test that the server is created and defined
    expect(server).toBeDefined();
    expect(typeof server).toBe('object');
  });

  test('tool handlers return a structured error when Slack client throws', async () => {
    const { createSlackServer } = await import('../index.js');

    const throwingClient: any = {
      getChannels: jest.fn(async () => {
        throw new Error('boom');
      }),
    };

    const fakeServer: any = { registerTool: jest.fn(), connect: jest.fn() };
    const server: any = createSlackServer(throwingClient, { server: fakeServer });
    expect(server).toBe(fakeServer);

    // Find the registered slack_list_channels handler and invoke it.
    const registerCalls = fakeServer.registerTool.mock.calls as any[];
    const listChannelsCall = registerCalls.find((c) => c[0] === 'slack_list_channels');
    expect(listChannelsCall).toBeDefined();
    const handler = listChannelsCall[2];

    const result = await handler({ limit: 1, cursor: undefined });
    const text = result.content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed).toEqual(
      expect.objectContaining({
        ok: false,
        error: 'tool_execution_failed',
        _tool: 'slack_list_channels',
      }),
    );
  });

  test('registers all tools and handlers return JSON tool content', async () => {
    const { createSlackServer } = await import('../index.js');

    const slackClient: any = {
      getChannels: jest.fn(async () => ({
        ok: true,
        channels: [],
        response_metadata: { next_cursor: '' },
      })),
      getChannelHistory: jest.fn(async () => ({
        ok: true,
        messages: [{ ts: '1.0' }, { ts: '0.5' }],
      })),
      searchMessages: jest.fn(async () => ({ ok: true, messages: { total: 0, matches: [] } })),
      editCanvas: jest.fn(async () => ({ ok: true })),
    };

    const fakeServer: any = { registerTool: jest.fn(), connect: jest.fn() };
    const server: any = createSlackServer(slackClient, { server: fakeServer });
    expect(server).toBe(fakeServer);
    const registerCalls = fakeServer.registerTool.mock.calls as any[];
    expect(registerCalls.length).toBe(13);

    const handlerByName = (name: string) => registerCalls.find((c) => c[0] === name)?.[2];

    // Success path: slack_list_channels
    {
      const handler = handlerByName('slack_list_channels');
      const result = await handler({ limit: 1, cursor: undefined });
      expect(JSON.parse(result.content[0].text)).toEqual(
        expect.objectContaining({ ok: true, channels: expect.any(Array) }),
      );
    }

    // Enrichment path: slack_get_channel_history (_time_range)
    {
      const handler = handlerByName('slack_get_channel_history');
      const result = await handler({
        channel_id: 'C1',
        limit: 2,
        oldest: undefined,
        latest: undefined,
        cursor: undefined,
        inclusive: undefined,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual(
        expect.objectContaining({ ok: true, _request_context: expect.any(Object) }),
      );
      expect(parsed._time_range).toBeDefined();
    }

    // Canvas edit change construction: slack_edit_canvas
    {
      const handler = handlerByName('slack_edit_canvas');
      await handler({
        canvas_id: 'F1',
        operation: 'insert_at_end',
        markdown: 'hi',
        section_id: undefined,
      });
      expect(slackClient.editCanvas).toHaveBeenCalledWith('F1', [
        expect.objectContaining({
          operation: 'insert_at_end',
          document_content: expect.objectContaining({ type: 'markdown', markdown: 'hi' }),
        }),
      ]);
    }
  });
});

describe('parseArgs', () => {
  test('parseArgs with default values', async () => {
    process.argv = ['node', 'index.js'];
    const { parseArgs } = await import('../index.js');

    const result = parseArgs();

    expect(result).toEqual({
      transport: 'stdio',
      port: 3000,
      authToken: undefined,
    });
  });

  test('parseArgs with custom transport', async () => {
    process.argv = ['node', 'index.js', '--transport', 'http'];
    const { parseArgs } = await import('../index.js');

    const result = parseArgs();

    expect(result).toEqual({
      transport: 'http',
      port: 3000,
      authToken: undefined,
    });
  });

  test('parseArgs with custom port', async () => {
    process.argv = ['node', 'index.js', '--port', '8080'];
    const { parseArgs } = await import('../index.js');

    const result = parseArgs();

    expect(result).toEqual({
      transport: 'stdio',
      port: 8080,
      authToken: undefined,
    });
  });

  test('parseArgs with invalid transport', async () => {
    process.argv = ['node', 'index.js', '--transport', 'invalid'];
    const { parseArgs } = await import('../index.js');

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseArgs()).toThrow('process.exit called');
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Error: --transport must be either "stdio" or "http"',
    );
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  test('parseArgs with invalid port', async () => {
    process.argv = ['node', 'index.js', '--port', 'invalid'];
    const { parseArgs } = await import('../index.js');

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseArgs()).toThrow('process.exit called');
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Error: --port must be a valid port number (1-65535)',
    );
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });
});

describe('main', () => {
  test('main with missing team ID', async () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    delete process.env.SLACK_TEAM_ID;

    const { main } = await import('../index.js');

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    await expect(main()).rejects.toThrow('process.exit called');
    expect(stderrWriteSpy).toHaveBeenCalledWith(
      expect.stringContaining('Please set SLACK_TEAM_ID environment variable'),
    );
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  test('main with missing both tokens', async () => {
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_USER_TOKEN;
    process.env.SLACK_TEAM_ID = 'T123456';

    const { main } = await import('../index.js');

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    await expect(main()).rejects.toThrow('process.exit called');
    expect(stderrWriteSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Please set either SLACK_BOT_TOKEN or SLACK_USER_TOKEN environment variable',
      ),
    );
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });
});

describe('HTTP Server', () => {
  test('express module can be imported', async () => {
    const express = await import('express');

    // Test that express module is available and mocked
    expect(express.default).toBeDefined();
    expect(typeof express.default).toBe('function');
  });

  test('SlackClient can be instantiated', async () => {
    const { SlackClient } = await import('../index.js');

    const mockSlackClient = new SlackClient('xoxb-test-token');

    // Test that SlackClient is created successfully
    expect(mockSlackClient).toBeDefined();
    expect(mockSlackClient).toHaveProperty('headers');
    expect(mockSlackClient.tokenType).toBe('bot');
  });

  test('SlackClient can be instantiated in user mode', async () => {
    const { SlackClient } = await import('../index.js');

    const mockSlackClient = new SlackClient('xoxp-user-token', 'user');

    // Test that SlackClient is created successfully in user mode
    expect(mockSlackClient).toBeDefined();
    expect(mockSlackClient).toHaveProperty('headers');
    expect(mockSlackClient.tokenType).toBe('user');
    expect(mockSlackClient.isUserMode()).toBe(true);
  });

  test('index module exports expected functions', async () => {
    const indexModule = await import('../index.js');

    // Test that required exports are available
    expect(indexModule.SlackClient).toBeDefined();
    expect(indexModule.createSlackServer).toBeDefined();
    expect(indexModule.parseArgs).toBeDefined();
    expect(indexModule.main).toBeDefined();
  });

  test('HTTP auth middleware rejects missing/invalid token and allows valid token', async () => {
    const { runHttpServer } = await import('../src/transports/http.js');
    const { createLogger } = await import('../src/logger.js');
    const express = (await import('express')).default as any;

    const logger = createLogger({ level: 'error' });
    const slackClient: any = {};

    await runHttpServer(slackClient, logger, 3000, 'secret');

    // app.post('/mcp', authMiddleware, handler)
    const app = express.mock.results[0].value;
    const authMiddleware = app.post.mock.calls[0][1];

    const makeRes = () => {
      const res: any = {};
      res.status = jest.fn(() => res);
      res.json = jest.fn(() => res);
      return res;
    };

    // Missing header -> 401
    {
      const req: any = { headers: {} };
      const res = makeRes();
      const next = jest.fn();
      authMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    }

    // Wrong token -> 401
    {
      const req: any = { headers: { authorization: 'Bearer nope' } };
      const res = makeRes();
      const next = jest.fn();
      authMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    }

    // Correct token -> next()
    {
      const req: any = { headers: { authorization: 'Bearer secret' } };
      const res = makeRes();
      const next = jest.fn();
      authMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    }
  });

  test('HTTP handler returns 400 for missing session without initialize', async () => {
    const { runHttpServer } = await import('../src/transports/http.js');
    const { createLogger } = await import('../src/logger.js');
    const express = (await import('express')).default as any;

    const logger = createLogger({ level: 'error' });
    const slackClient: any = {};

    await runHttpServer(slackClient, logger, 3000, undefined);

    const app = express.mock.results[0].value;
    const handler = app.post.mock.calls[0][2];

    const req: any = { headers: {}, body: { method: 'not-initialize' } };
    const res: any = { status: jest.fn(() => res), json: jest.fn(() => res), headersSent: false };

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Bad Request: No valid session ID provided',
        }),
      }),
    );
  });

  test('stdio transport connects the MCP server', async () => {
    const { runStdioServer } = await import('../src/transports/stdio.js');
    const slackClient: any = {};
    const logger: any = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

    await runStdioServer(slackClient, logger);
    expect(logger.info).toHaveBeenCalled();
  });
});
