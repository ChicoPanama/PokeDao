/**
 * Prisma client for the Telegram bot
 *
 * Uses dynamic import to load the generated Prisma client from the API package.
 * This avoids TypeScript rootDir issues in the monorepo.
 */

import dotenv from 'dotenv';
// Load .env before any database access
dotenv.config();

import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Pool for the Prisma adapter
let pool: InstanceType<typeof pg.Pool> | null = null;

// Prisma client instance (typed as any to avoid cross-package import issues)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prismaInstance: any = null;

// Global cache for development hot reloading
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalForPrisma = globalThis as unknown as { prisma: any };

async function createPrismaClient() {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  // Dynamic import of the generated Prisma client
  const { PrismaClient } = await import('../../../api/prisma/generated/client/client.js');

  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
  }

  return client;
}

// Initialize synchronously for module export
// The actual client creation is lazy
const prismaPromise = createPrismaClient();

// For synchronous access, we need to initialize eagerly
// This will be awaited on first use
prismaPromise.then((client) => {
  prismaInstance = client;
});

// Export a proxy that waits for initialization
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma: any = new Proxy({} as any, {
  get(_target, prop) {
    if (!prismaInstance) {
      throw new Error('Prisma client not initialized. Call initPrisma() first or use getPrisma().');
    }
    return prismaInstance[prop];
  },
});

// Async getter for when you need the client
export async function getPrisma() {
  if (prismaInstance) return prismaInstance;
  return await prismaPromise;
}

// Initialize the client (call this at app startup)
export async function initPrisma() {
  prismaInstance = await prismaPromise;
  return prismaInstance;
}

export async function disconnect(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
    globalForPrisma.prisma = null;
  }
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export default prisma;
