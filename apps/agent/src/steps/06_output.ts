// For Step 3 we just prepare strings and call the X dry-run layer.
import { postThread } from '../../../../packages/social/x/client.js';
import { formatProfessionalAgentPost } from '../../../../packages/social/x/post.js';
import { postQueue } from '../queues.js';
import type { OpportunityCandidate } from './04_signal.js';

// Helper function to determine risk level
function calculateRiskLevel(candidate: OpportunityCandidate): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (candidate.confidence >= 0.8 && candidate.compCount30d >= 10) return 'LOW';
  if (candidate.confidence >= 0.6 && candidate.compCount30d >= 5) return 'MEDIUM';
  return 'HIGH';
}

// Helper function to determine market condition
function getMarketCondition(candidate: OpportunityCandidate): string {
  const spread = candidate.netSpreadBps / 100;
  if (spread >= 20) return 'bull market';
  if (spread >= 10) return 'stable market';
  return 'volatile market';
}

export async function stageAndMaybePost(cands: OpportunityCandidate[]) {
  if (cands.length === 0) return;
  const top = [...cands].sort((a, b) => b.netSpreadBps - a.netSpreadBps || b.confidence - a.confidence)[0];

  // Use professional agent format with all enhanced features including card value
  const lines = formatProfessionalAgentPost({
    cardTitle: top.cardId, // replace with a human-readable title if available
    spreadPct: top.netSpreadBps / 100,
    confidence: top.confidence,
    expectedProfitCents: top.expectedProfitCents,
    compCount30d: top.compCount30d,
    marketCondition: getMarketCondition(top),
    riskLevel: calculateRiskLevel(top),
    buyUrl: top.url || 'https://example.com',
    sellCompUrl: undefined,
    rationale: top.rationale,
    risks: ['Condition variance', 'Fee drift', 'Listing cancellation'],
    timeWindow: 'Next 24–72h',
    timestamp: new Date(),
    trackRecordUrl: process.env.TRACK_RECORD_URL || 'https://pokedao.ai/performance',
    cardValueCents: top.sellCompCents, // Use the comp value as card value for tier categorization
  });

  await postThread(lines); // dry-run by default

  // Flash alerts for very strong opportunities
  const flashEnabled = process.env.FLASH_ENABLED !== 'false';
  const minBps = Number(process.env.FLASH_MIN_SPREAD_BPS || 2000);
  const minConf = Number(process.env.FLASH_MIN_CONFIDENCE || 0.7);
  if (flashEnabled && top.netSpreadBps >= minBps && top.confidence >= minConf) {
    try {
      await postQueue.add(
        'flash',
        { kind: 'flash', lines },
        { removeOnComplete: 100, removeOnFail: 100 }
      );
      console.log('[post] flash enqueued');
    } catch (e) {
      console.warn('[post] flash enqueue failed', e);
    }
  }
}