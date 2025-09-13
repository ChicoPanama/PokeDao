import pino from "pino";
import { createRequire } from 'node:module';

function prettyTransport() {
  if (process.env.NODE_ENV === 'production') return undefined;
  try {
    const req = createRequire(import.meta.url);
    req.resolve('pino-pretty');
    return { target: 'pino-pretty' } as any;
  } catch {
    return undefined;
  }
}

export const log = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: prettyTransport(),
});
