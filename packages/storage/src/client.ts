/**
 * Prisma client singleton
 */

import { PrismaClient } from '@prisma/client';

// Singleton instance
let prisma: PrismaClient | null = null;

/**
 * Get Prisma client instance
 *
 * Uses singleton pattern to avoid multiple connections
 */
export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
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
}

/**
 * Export singleton instance
 */
export const db = getPrisma();
