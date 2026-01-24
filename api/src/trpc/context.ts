/**
 * tRPC Context
 *
 * Creates the context that's passed to all tRPC procedures.
 * Includes Prisma client, Redis, and request info.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';

export interface Context {
  prisma: typeof prisma;
  req: FastifyRequest;
  res: FastifyReply;
}

export interface CreateContextOptions {
  req: FastifyRequest;
  res: FastifyReply;
}

export function createContext({ req, res }: CreateContextOptions): Context {
  return {
    prisma,
    req,
    res,
  };
}

export type { Context as TRPCContext };
