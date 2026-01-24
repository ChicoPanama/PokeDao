/**
 * Prisma client singleton
 *
 * This module provides a lazy-initialized Prisma client for database access.
 * The client is loaded dynamically at runtime from the api package's generated client.
 */

import dotenv from 'dotenv';
// Load .env before any database access
dotenv.config();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClientType = any;

// Singleton instance
let prisma: PrismaClientType | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pool: any = null;

/**
 * Get Prisma client instance (async)
 *
 * Uses singleton pattern to avoid multiple connections
 */
export async function getPrisma(): Promise<PrismaClientType> {
  if (!prisma) {
    // Dynamic imports to avoid TypeScript rootDir issues in monorepo
    const pg = await import('pg');
    const { PrismaPg } = await import('@prisma/adapter-pg');
    // Path resolved at runtime - the generated client is in api/prisma/generated/client
    // Using a computed path to prevent TypeScript from statically analyzing it
    const clientPath = ['..', '..', '..', 'api', 'prisma', 'generated', 'client', 'client.js'].join('/');
    const clientModule = await import(/* @vite-ignore */ clientPath);
    const PrismaClient = clientModule.PrismaClient;

    pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
  }

  return prisma;
}

/**
 * Disconnect Prisma client
 */
export async function disconnect(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Note: db is now lazily initialized - use getPrisma() for async access
// This export is kept for backwards compatibility but will be null initially
export let db: PrismaClientType = null;

// Initialize db asynchronously
getPrisma().then((client) => {
  db = client;
});
