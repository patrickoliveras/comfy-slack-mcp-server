export class SlackApiError extends Error {
  public readonly code: string;
  public readonly response?: unknown;

  constructor(message: string, code: string, response?: unknown) {
    super(message);
    this.name = 'SlackApiError';
    this.code = code;
    this.response = response;
  }
}

export class SlackTransportError extends Error {
  public readonly status?: number;
  public readonly details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'SlackTransportError';
    this.status = status;
    this.details = details;
  }
}

export class SlackRateLimitError extends SlackTransportError {
  public readonly retryAfterSeconds?: number;

  constructor(message: string, retryAfterSeconds?: number, details?: unknown) {
    super(message, 429, details);
    this.name = 'SlackRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
