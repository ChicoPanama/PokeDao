/**
 * Signal repository
 */

import { db } from '../client.js';

/**
 * Get signals without thesis
 */
export async function getSignalsNeedingThesis(limit: number = 50) {
  return db.signal.findMany({
    where: {
      thesis: '',
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    include: {
      card: true,
      marketListing: true,
    },
  });
}

/**
 * Update signal thesis
 */
export async function updateSignalThesis(
  signalId: string,
  thesis: string,
  confidence?: number
) {
  return db.signal.update({
    where: { id: signalId },
    data: {
      thesis,
      ...(confidence !== undefined && { confidence }),
    },
  });
}

/**
 * Get top signals by edge
 */
export async function getTopSignals(limit: number = 10) {
  return db.signal.findMany({
    where: {
      thesis: {
        not: '',
      },
      confidence: {
        gte: 0.65,
      },
    },
    orderBy: [
      { edgeBp: 'desc' },
      { confidence: 'desc' },
    ],
    take: limit,
    include: {
      card: true,
      marketListing: true,
    },
  });
}
