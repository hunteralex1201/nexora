import winston from 'winston';

export interface LoggerOptions {
  service: string;
  level?: string;
  defaultMeta?: Readonly<Record<string, unknown>>;
}

export interface RequestContext {
  requestId: string;
  correlationId?: string;
}

const sensitiveKey = /(authorization|cookie|password|secret|token|api[-_]?key)/i;
const bearerValue = /bearer\s+[a-z0-9._~+/=-]+/gi;

export function sanitizeMetadata(value: unknown, key = ''): unknown {
  if (sensitiveKey.test(key)) {
    return '[REDACTED]';
  }
  if (typeof value === 'string') {
    return value.replace(bearerValue, 'Bearer [REDACTED]');
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadata(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeMetadata(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

const redactionFormat = winston.format((info) => {
  const sanitized = sanitizeMetadata(info) as Record<string, unknown>;
  for (const key of Object.keys(info)) {
    delete info[key];
  }
  Object.assign(info, sanitized);
  return info;
});

export function createLogger(options: LoggerOptions): winston.Logger {
  return winston.createLogger({
    level: options.level ?? 'info',
    defaultMeta: {
      service: options.service,
      ...options.defaultMeta,
    },
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      redactionFormat(),
      winston.format.json(),
    ),
    transports: [new winston.transports.Console()],
  });
}

export function withRequestContext(
  logger: winston.Logger,
  context: RequestContext,
): winston.Logger {
  return logger.child({
    request_id: context.requestId,
    correlation_id: context.correlationId ?? context.requestId,
  });
}
