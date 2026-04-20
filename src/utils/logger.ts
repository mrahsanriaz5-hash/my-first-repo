type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

function pad(val: number): string {
  return String(val).padStart(2, '0');
}

function timestamp(): string {
  const now = new Date();
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return `${date} ${time}`;
}

function format(level: LogLevel, context: string, message: string): string {
  return `[${timestamp()}] [${level.padEnd(5)}] [${context}] ${message}`;
}

export const logger = {
  info(context: string, message: string): void {
    console.log(format('INFO', context, message));
  },

  warn(context: string, message: string): void {
    console.warn(format('WARN', context, message));
  },

  error(context: string, message: string, err?: unknown): void {
    console.error(format('ERROR', context, message));
    if (err instanceof Error) {
      console.error(`           ↳ ${err.message}`);
    }
  },

  debug(context: string, message: string): void {
    if (process.env['NODE_ENV'] === 'development') {
      console.debug(format('DEBUG', context, message));
    }
  },
};

