import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';
import winston from 'winston';

import { createLogger, sanitizeMetadata, withRequestContext } from './index.js';

describe('@nexora/logger', () => {
  it('redacts nested credentials and bearer values', () => {
    const sanitized = sanitizeMetadata({
      password: 'secret-password',
      nested: {
        apiKey: 'secret-key',
        message: 'Authorization: Bearer abc.def.ghi',
      },
    });

    expect(sanitized).toEqual({
      password: '[REDACTED]',
      nested: {
        apiKey: '[REDACTED]',
        message: 'Authorization: Bearer [REDACTED]',
      },
    });
  });

  it('emits request and correlation identifiers from child loggers', async () => {
    const stream = new PassThrough();
    const logger = createLogger({ service: 'test-service' });
    logger.clear();
    logger.add(new winston.transports.Stream({ stream }));
    const child = withRequestContext(logger, {
      requestId: 'request-1',
      correlationId: 'correlation-1',
    });
    const emitted = new Promise<string>((resolve) => {
      stream.once('data', (chunk: Buffer) => resolve(chunk.toString()));
    });

    child.info('context test');
    const entry = JSON.parse(await emitted) as Record<string, unknown>;

    expect(entry).toMatchObject({
      service: 'test-service',
      request_id: 'request-1',
      correlation_id: 'correlation-1',
      message: 'context test',
    });
  });
});
