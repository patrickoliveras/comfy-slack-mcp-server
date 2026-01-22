export type RetryOptions = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  getDelayMs?: (err: unknown, attempt: number, defaultBackoffMs: number) => number;
};

const defaultRetryOptions: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 250,
  maxDelayMs: 5_000,
};

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function jitter(ms: number): number {
  // Full jitter: random between 0 and the computed delay.
  return Math.floor(Math.random() * ms);
}

export async function retry<T>(
  fn: (attempt: number) => Promise<T>,
  options?: Partial<RetryOptions>,
): Promise<T> {
  const cfg: RetryOptions = { ...defaultRetryOptions, ...(options ?? {}) };

  let lastError: unknown;
  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt >= cfg.maxRetries) {
        throw err;
      }

      if (cfg.shouldRetry && !cfg.shouldRetry(err, attempt)) {
        throw err;
      }

      const defaultBackoff = clamp(cfg.baseDelayMs * 2 ** attempt, cfg.baseDelayMs, cfg.maxDelayMs);
      const delay = cfg.getDelayMs ? cfg.getDelayMs(err, attempt, defaultBackoff) : defaultBackoff;
      await sleep(jitter(clamp(delay, 0, cfg.maxDelayMs)));
    }
  }

  // Should be unreachable, but keeps TS happy.
  throw lastError;
}
