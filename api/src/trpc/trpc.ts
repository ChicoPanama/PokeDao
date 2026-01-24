/**
 * tRPC Initialization
 *
 * Sets up the tRPC instance with context and error handling.
 */

import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context.js';

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof Error ? error.cause.message : null,
      },
    };
  },
});

/**
 * Export reusable router and procedure helpers
 */
export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

/**
 * Middleware that logs procedure calls
 */
const loggerMiddleware = middleware(async ({ path, type, next }) => {
  const start = Date.now();
  const result = await next();
  const durationMs = Date.now() - start;

  if (result.ok) {
    console.log(`[trpc] ${type} ${path} OK (${durationMs}ms)`);
  } else {
    console.error(`[trpc] ${type} ${path} ERROR (${durationMs}ms)`);
  }

  return result;
});

/**
 * Logged procedure - use for most procedures
 */
export const loggedProcedure = publicProcedure.use(loggerMiddleware);

/**
 * Create a server-side caller for testing or internal use
 */
export const createCallerFactory = t.createCallerFactory;
