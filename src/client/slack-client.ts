import { SlackRateLimitError, SlackTransportError } from '../errors.js';
import { createLogger, type Logger } from '../logger.js';
import { retry, sleep, type RetryOptions } from '../retry.js';
import type {
  CanvasChange,
  SlackChatPostMessageResponse,
  SlackChannelInfoResponse,
  SlackChannelsListResponse,
  SlackConversationsHistoryResponse,
  SlackConversationsRepliesResponse,
  SlackFilesInfoResponse,
  SlackFilesListResponse,
  SlackReactionsAddResponse,
  SlackSearchMessagesResponse,
  SlackUsersListResponse,
  SlackUsersProfileGetResponse,
  TokenType,
} from '../types/slack.js';

function parseRetryAfterSeconds(headers: Headers): number | undefined {
  const raw = headers.get('retry-after');
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

type RequestPolicy = {
  idempotent: boolean;
};

export class SlackClient {
  private headers: { Authorization: string; 'Content-Type': string };
  public readonly tokenType: TokenType;
  private readonly logger: Logger;
  private readonly retryOptions: Partial<RetryOptions>;

  constructor(
    token: string,
    tokenType: TokenType = 'bot',
    options?: { logger?: Logger; retryOptions?: Partial<RetryOptions> },
  ) {
    this.headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    this.tokenType = tokenType;
    this.logger = options?.logger ?? createLogger({ service: 'slack-mcp-server' });
    this.retryOptions = options?.retryOptions ?? {};
  }

  /**
   * Check if running in user token mode (messages appear as the user)
   */
  isUserMode(): boolean {
    return this.tokenType === 'user';
  }

  private async requestJson<T>(
    url: string,
    init: Parameters<typeof fetch>[1],
    policy: RequestPolicy,
  ): Promise<T> {
    const shouldRetry = (err: unknown): boolean => {
      if (err instanceof SlackRateLimitError) return true;
      if (!policy.idempotent) return false;
      if (err instanceof SlackTransportError) {
        // Retry transient server/network errors for idempotent requests.
        return err.status === undefined || err.status >= 500;
      }
      // fetch() typically throws TypeError on network failures.
      return err instanceof TypeError;
    };

    return retry(
      async (attempt) => {
        try {
          const response = await fetch(url, init);

          if (response.status === 429) {
            const retryAfterSeconds = parseRetryAfterSeconds(response.headers);
            throw new SlackRateLimitError('Slack API rate limited', retryAfterSeconds, {
              url,
              status: response.status,
            });
          }

          if (!response.ok) {
            throw new SlackTransportError(
              `Slack API HTTP error: ${response.status} ${response.statusText}`,
              response.status,
              { url },
            );
          }

          return (await response.json()) as T;
        } catch (err) {
          // If we get rate-limited and Slack tells us when to retry, respect it.
          if (err instanceof SlackRateLimitError && err.retryAfterSeconds !== undefined) {
            const delayMs = err.retryAfterSeconds * 1000;
            this.logger.warn('Rate limited by Slack API; sleeping before retry', {
              url,
              retryAfterSeconds: err.retryAfterSeconds,
              attempt,
            });
            await sleep(delayMs);
          }
          throw err;
        }
      },
      {
        ...this.retryOptions,
        shouldRetry: (err) => shouldRetry(err),
        getDelayMs: (err, _attempt, defaultBackoffMs) => {
          // If Slack provided Retry-After, we already slept before rethrowing; no extra delay.
          if (err instanceof SlackRateLimitError && err.retryAfterSeconds !== undefined) {
            return 0;
          }
          return defaultBackoffMs;
        },
      },
    );
  }

  async getChannels(limit: number = 100, cursor?: string): Promise<SlackChannelsListResponse> {
    const predefinedChannelIds = process.env.SLACK_CHANNEL_IDS;
    if (!predefinedChannelIds) {
      const params = new URLSearchParams({
        types: 'public_channel,private_channel',
        exclude_archived: 'true',
        limit: Math.min(limit, 200).toString(),
        team_id: process.env.SLACK_TEAM_ID!,
      });

      if (cursor) {
        params.append('cursor', cursor);
      }

      return this.requestJson<SlackChannelsListResponse>(
        `https://slack.com/api/conversations.list?${params}`,
        { headers: this.headers },
        { idempotent: true },
      );
    }

    const predefinedChannelIdsArray = predefinedChannelIds
      .split(',')
      .map((id: string) => id.trim())
      .filter(Boolean);

    const channels = [];
    for (const channelId of predefinedChannelIdsArray) {
      const params = new URLSearchParams({ channel: channelId });
      const data = await this.requestJson<SlackChannelInfoResponse>(
        `https://slack.com/api/conversations.info?${params}`,
        { headers: this.headers },
        { idempotent: true },
      );

      if (data.ok && data.channel && !data.channel.is_archived) {
        channels.push(data.channel);
      }
    }

    return {
      ok: true,
      channels,
      response_metadata: { next_cursor: '' },
    };
  }

  async postMessage(channel_id: string, text: string): Promise<SlackChatPostMessageResponse> {
    return this.requestJson<SlackChatPostMessageResponse>(
      'https://slack.com/api/chat.postMessage',
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ channel: channel_id, text }),
      },
      { idempotent: false },
    );
  }

  async postReply(
    channel_id: string,
    thread_ts: string,
    text: string,
  ): Promise<SlackChatPostMessageResponse> {
    return this.requestJson<SlackChatPostMessageResponse>(
      'https://slack.com/api/chat.postMessage',
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ channel: channel_id, thread_ts, text }),
      },
      { idempotent: false },
    );
  }

  async addReaction(
    channel_id: string,
    timestamp: string,
    reaction: string,
  ): Promise<SlackReactionsAddResponse> {
    return this.requestJson<SlackReactionsAddResponse>(
      'https://slack.com/api/reactions.add',
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ channel: channel_id, timestamp, name: reaction }),
      },
      { idempotent: false },
    );
  }

  async getChannelHistory(
    channel_id: string,
    limit: number = 10,
    oldest?: string,
    latest?: string,
    cursor?: string,
    inclusive?: boolean,
  ): Promise<SlackConversationsHistoryResponse> {
    const params = new URLSearchParams({
      channel: channel_id,
      limit: Math.min(limit, 200).toString(),
    });

    if (oldest) params.append('oldest', oldest);
    if (latest) params.append('latest', latest);
    if (cursor) params.append('cursor', cursor);
    if (inclusive !== undefined) params.append('inclusive', inclusive.toString());

    return this.requestJson<SlackConversationsHistoryResponse>(
      `https://slack.com/api/conversations.history?${params}`,
      { headers: this.headers },
      { idempotent: true },
    );
  }

  async getThreadReplies(
    channel_id: string,
    thread_ts: string,
    cursor?: string,
    limit: number = 100,
  ): Promise<SlackConversationsRepliesResponse> {
    const params = new URLSearchParams({
      channel: channel_id,
      ts: thread_ts,
      limit: Math.min(limit, 200).toString(),
    });

    if (cursor) {
      params.append('cursor', cursor);
    }

    return this.requestJson<SlackConversationsRepliesResponse>(
      `https://slack.com/api/conversations.replies?${params}`,
      { headers: this.headers },
      { idempotent: true },
    );
  }

  async searchMessages(
    query: string,
    count: number = 20,
    cursor?: string,
    sort: string = 'timestamp',
    sort_dir: string = 'desc',
  ): Promise<SlackSearchMessagesResponse> {
    const params = new URLSearchParams({
      query,
      count: Math.min(count, 100).toString(),
      sort,
      sort_dir,
    });

    if (cursor) params.append('cursor', cursor);

    return this.requestJson<SlackSearchMessagesResponse>(
      `https://slack.com/api/search.messages?${params}`,
      { headers: this.headers },
      { idempotent: true },
    );
  }

  async getUsers(limit: number = 100, cursor?: string): Promise<SlackUsersListResponse> {
    const params = new URLSearchParams({
      limit: Math.min(limit, 200).toString(),
      team_id: process.env.SLACK_TEAM_ID!,
    });

    if (cursor) {
      params.append('cursor', cursor);
    }

    return this.requestJson<SlackUsersListResponse>(
      `https://slack.com/api/users.list?${params}`,
      { headers: this.headers },
      { idempotent: true },
    );
  }

  async getUserProfile(user_id: string): Promise<SlackUsersProfileGetResponse> {
    const params = new URLSearchParams({
      user: user_id,
      include_labels: 'true',
    });

    return this.requestJson<SlackUsersProfileGetResponse>(
      `https://slack.com/api/users.profile.get?${params}`,
      { headers: this.headers },
      { idempotent: true },
    );
  }

  // Canvas methods

  async listCanvases(limit: number = 100, cursor?: string): Promise<SlackFilesListResponse> {
    const params = new URLSearchParams({
      types: 'canvas',
      count: Math.min(limit, 100).toString(),
    });

    if (cursor) params.append('cursor', cursor);

    return this.requestJson<SlackFilesListResponse>(
      `https://slack.com/api/files.list?${params}`,
      { headers: this.headers },
      { idempotent: true },
    );
  }

  async getCanvasInfo(canvas_id: string): Promise<SlackFilesInfoResponse> {
    const params = new URLSearchParams({ file: canvas_id });
    return this.requestJson<SlackFilesInfoResponse>(
      `https://slack.com/api/files.info?${params}`,
      { headers: this.headers },
      { idempotent: true },
    );
  }

  async downloadCanvasContent(url_private: string): Promise<string> {
    const response = await fetch(url_private, {
      headers: { Authorization: this.headers.Authorization },
    });

    if (response.status === 429) {
      const retryAfterSeconds = parseRetryAfterSeconds(response.headers);
      throw new SlackRateLimitError('Slack file download rate limited', retryAfterSeconds, {
        url: url_private,
        status: response.status,
      });
    }

    if (!response.ok) {
      throw new SlackTransportError(
        `Failed to download canvas: ${response.status} ${response.statusText}`,
        response.status,
        { url: url_private },
      );
    }

    return response.text();
  }

  async readCanvas(canvas_id: string): Promise<unknown> {
    const fileInfo = await this.getCanvasInfo(canvas_id);
    if (!fileInfo.ok) return fileInfo;

    const file = fileInfo.file;
    if (!file?.url_private) {
      return {
        ok: false,
        error: 'no_url_private',
        message: 'Canvas file does not have a downloadable URL',
      };
    }

    try {
      const htmlContent = await retry(async () => this.downloadCanvasContent(file.url_private!), {
        ...this.retryOptions,
        shouldRetry: (err) => err instanceof SlackRateLimitError,
        getDelayMs: (err, _attempt, defaultBackoffMs) => {
          if (err instanceof SlackRateLimitError && err.retryAfterSeconds !== undefined) {
            return err.retryAfterSeconds * 1000;
          }
          return defaultBackoffMs;
        },
      });

      return {
        ok: true,
        canvas_id,
        title: file.title,
        created: file.created,
        updated: file.updated,
        user: file.user,
        permalink: file.permalink,
        content_html: htmlContent,
        _file_info: {
          id: file.id,
          name: file.name,
          filetype: file.filetype,
          size: file.size,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        error: 'download_failed',
        message,
        file_info: file,
      };
    }
  }

  async editCanvas(canvas_id: string, changes: CanvasChange[]): Promise<SlackApiWriteResponse> {
    return this.requestJson<SlackApiWriteResponse>(
      'https://slack.com/api/canvases.edit',
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ canvas_id, changes }),
      },
      { idempotent: false },
    );
  }

  async createCanvas(title: string, markdown?: string): Promise<SlackApiWriteResponse> {
    const body: Record<string, unknown> = { title };
    if (markdown) {
      body.document_content = { type: 'markdown', markdown };
    }

    return this.requestJson<SlackApiWriteResponse>(
      'https://slack.com/api/canvases.create',
      { method: 'POST', headers: this.headers, body: JSON.stringify(body) },
      { idempotent: false },
    );
  }
}

type SlackApiWriteResponse = {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
};
