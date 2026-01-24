/**
 * Database client for Telegram bot
 * Uses shared Prisma client from api
 *
 * Re-exports the singleton from prisma.ts for backwards compatibility
 */

import prisma, { disconnect as prismaDisconnect } from './prisma.js';

export function getDb() {
  return prisma;
}

export async function disconnect(): Promise<void> {
  await prismaDisconnect();
}

export const db = prisma;
