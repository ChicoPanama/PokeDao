/**
 * Fetch Node
 *
 * Step 1: Fetches fresh market listings from all sources.
 */

import type { AgentStateType, MarketListing, PipelineError } from '../state.js';

export async function fetchNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const startTime = Date.now();

  try {
    // Import the existing fetch step
    const { findFreshListings } = await import('../../steps/01_fetch.js');

    const rawListings = await findFreshListings();

    // Map to our typed format
    const listings: MarketListing[] = rawListings.map((l: any) => ({
      id: l.id,
      source: l.source,
      sourceId: l.sourceId,
      title: l.title,
      priceCents: l.priceCents,
      url: l.url || l.sourceUrl,
      cardName: l.cardName,
      setName: l.setName,
      grade: l.grade,
      gradeCompany: l.gradeCompany,
      condition: l.condition,
      seller: l.seller,
      seenAt: new Date(l.seenAt || l.lastSeenAt || Date.now()),
    }));

    const durationMs = Date.now() - startTime;

    return {
      listings,
      metrics: {
        fetch_count: listings.length,
        fetch_duration_ms: durationMs,
      },
    };
  } catch (error: any) {
    const pipelineError: PipelineError = {
      step: 'fetch',
      message: error?.message || String(error),
      timestamp: new Date(),
      recoverable: false,
    };

    return {
      listings: [],
      errors: [pipelineError],
      metrics: {
        fetch_count: 0,
        fetch_duration_ms: Date.now() - startTime,
        fetch_error: 1,
      },
    };
  }
}
