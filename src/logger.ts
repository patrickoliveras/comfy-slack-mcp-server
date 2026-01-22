export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levels: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ message: 'Failed to serialize log payload' });
  }
}

export type Logger = {
  debug: (message: string, fields?: Record<string, unknown>) => void;
  info: (message: string, fields?: Record<string, unknown>) => void;
  warn: (message: string, fields?: Record<string, unknown>) => void;
  error: (message: string, fields?: Record<string, unknown>) => void;
};

export function createLogger(options?: { level?: LogLevel; service?: string }): Logger {
  const level = (options?.level ??
    (process.env.LOG_LEVEL as LogLevel | undefined) ??
    'info') as LogLevel;
  const min = levels[level] ?? levels.info;
  const service = options?.service;

  const write = (lvl: LogLevel, message: string, fields?: Record<string, unknown>) => {
    if ((levels[lvl] ?? 100) < min) return;
    const line = {
      ts: new Date().toISOString(),
      level: lvl,
      ...(service ? { service } : {}),
      message,
      ...(fields ? { ...fields } : {}),
    };
    process.stderr.write(safeJson(line) + '\n');
  };

  return {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
  };
}
