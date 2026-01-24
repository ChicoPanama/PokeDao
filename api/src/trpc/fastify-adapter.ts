/**
 * tRPC Fastify Adapter
 *
 * Registers tRPC routes with Fastify.
 * Mounts at /trpc by default.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from './router.js';
import { createContext } from './context.js';

export interface TRPCPluginOptions {
  prefix?: string;
}

/**
 * Register tRPC routes with Fastify
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { registerTRPC } from './trpc/fastify-adapter.js';
 *
 * const app = Fastify();
 * await registerTRPC(app, { prefix: '/trpc' });
 * ```
 */
export async function registerTRPC(
  app: FastifyInstance,
  options: TRPCPluginOptions = {}
): Promise<void> {
  const prefix = options.prefix ?? '/trpc';

  // Handle all tRPC requests
  app.all(`${prefix}/*`, async (req: FastifyRequest, res: FastifyReply) => {
    // Convert Fastify request to Fetch Request
    const url = new URL(req.url, `http://${req.headers.host}`);

    const fetchRequest = new Request(url, {
      method: req.method,
      headers: req.headers as HeadersInit,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    // Handle with tRPC
    const response = await fetchRequestHandler({
      endpoint: prefix,
      req: fetchRequest,
      router: appRouter,
      createContext: () => createContext({ req, res }),
      onError({ error, path }) {
        console.error(`[trpc] Error in ${path}:`, error.message);
      },
    });

    // Send response
    res.status(response.status);

    response.headers.forEach((value, key) => {
      res.header(key, value);
    });

    const body = await response.text();
    return res.send(body);
  });

  console.log(`[trpc] Registered at ${prefix}/*`);
}

export default registerTRPC;
