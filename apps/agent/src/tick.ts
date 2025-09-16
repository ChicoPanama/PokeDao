import 'dotenv/config';

export async function runAgentTick() {
  const SMOKE = process.env.AGENT_SMOKE_ONLY === 'true';

  if (SMOKE) {
    const { postThread } = await import('../../../packages/social/x/client.js');
    const { formatProfessionalAgentPost } = await import('../../../packages/social/x/post.js');

    // Test different card value tiers
    const testTier = process.env.TEST_TIER || 'MEGA'; // Default to MEGA tier
    
    let sample;
    
    switch (testTier) {
      case 'MEDIUM':
        sample = {
          cardTitle: 'Charizard VMAX – PSA 9',
          spreadPct: 28.3,
          confidence: 0.88,
          expectedProfitCents: 12500, // $125 profit
          compCount30d: 15,
          marketCondition: 'bull market',
          riskLevel: 'LOW' as const,
          buyUrl: 'https://example.com/listing/charizard-vmax',
          sellCompUrl: 'https://example.com/comps/charizard-vmax',
          rationale: 'Weekend lags on raw while graded comps hold steady; left-tail raw listings are under the 7-day median.',
          risks: ['Condition variance', 'Listing cancellation', 'Fee drift'],
          timeWindow: 'Next 24h',
          timestamp: new Date(),
          trackRecordUrl: 'https://pokedao.ai/performance',
          cardValueCents: 15000, // $150 - MEDIUM tier
        };
        break;
        
      case 'HIGH':
        sample = {
          cardTitle: 'Lugia Alt Art – PSA 10',
          spreadPct: 32.5,
          confidence: 0.91,
          expectedProfitCents: 18500, // $185 profit
          compCount30d: 18,
          marketCondition: 'bull market',
          riskLevel: 'LOW' as const,
          buyUrl: 'https://example.com/listing/lugia-alt',
          sellCompUrl: 'https://example.com/comps/lugia-alt',
          rationale: 'Significant arbitrage opportunity with raw cards trading well below graded comps after recent market volatility.',
          risks: ['Condition variance', 'Listing cancellation', 'Fee drift'],
          timeWindow: 'Next 24h',
          timestamp: new Date(),
          trackRecordUrl: 'https://pokedao.ai/performance',
          cardValueCents: 150000, // $1,500 - HIGH tier
        };
        break;
        
      case 'MEGA':
        sample = {
          cardTitle: 'Pikachu Illustrator – PSA 9',
          spreadPct: 35.2,
          confidence: 0.92,
          expectedProfitCents: 185000, // $1,850 profit
          compCount30d: 8,
          marketCondition: 'bull market',
          riskLevel: 'LOW' as const,
          buyUrl: 'https://example.com/listing/pikachu-illustrator',
          sellCompUrl: 'https://example.com/comps/pikachu-illustrator',
          rationale: 'Significant arbitrage opportunity with raw cards trading well below graded comps after recent market volatility.',
          risks: ['Condition variance', 'Listing cancellation', 'Fee drift'],
          timeWindow: 'Next 24h',
          timestamp: new Date(),
          trackRecordUrl: 'https://pokedao.ai/performance',
          cardValueCents: 500000, // $5,000 - MEGA tier
        };
        break;
        
      case 'ULTRA':
        sample = {
          cardTitle: 'Charizard Base Set – PSA 10',
          spreadPct: 42.1,
          confidence: 0.95,
          expectedProfitCents: 2500000, // $25,000 profit
          compCount30d: 3,
          marketCondition: 'bull market',
          riskLevel: 'LOW' as const,
          buyUrl: 'https://example.com/listing/charizard-base-psa10',
          sellCompUrl: 'https://example.com/comps/charizard-base-psa10',
          rationale: 'Ultra-rare opportunity with massive spread between raw and graded comps after recent market volatility.',
          risks: ['Condition variance', 'Listing cancellation', 'Fee drift'],
          timeWindow: 'Next 24h',
          timestamp: new Date(),
          trackRecordUrl: 'https://pokedao.ai/performance',
          cardValueCents: 5000000, // $50,000 - ULTRA tier
        };
        break;
        
      case 'GOD':
        sample = {
          cardTitle: 'Pikachu Illustrator – PSA 10',
          spreadPct: 45.8,
          confidence: 0.98,
          expectedProfitCents: 5000000, // $50,000 profit
          compCount30d: 1,
          marketCondition: 'bull market',
          riskLevel: 'LOW' as const,
          buyUrl: 'https://example.com/listing/pikachu-illustrator-psa10',
          sellCompUrl: 'https://example.com/comps/pikachu-illustrator-psa10',
          rationale: 'Legendary opportunity with unprecedented spread between raw and graded comps.',
          risks: ['Condition variance', 'Listing cancellation', 'Fee drift'],
          timeWindow: 'Next 24h',
          timestamp: new Date(),
          trackRecordUrl: 'https://pokedao.ai/performance',
          cardValueCents: 50000000, // $500,000 - GOD tier
        };
        break;
        
      default:
        sample = {
          cardTitle: 'Pikachu Illustrator – PSA 9',
          spreadPct: 35.2,
          confidence: 0.92,
          expectedProfitCents: 185000,
          compCount30d: 8,
          marketCondition: 'bull market',
          riskLevel: 'LOW' as const,
          buyUrl: 'https://example.com/listing/pikachu-illustrator',
          sellCompUrl: 'https://example.com/comps/pikachu-illustrator',
          rationale: 'Significant arbitrage opportunity with raw cards trading well below graded comps after recent market volatility.',
          risks: ['Condition variance', 'Listing cancellation', 'Fee drift'],
          timeWindow: 'Next 24h',
          timestamp: new Date(),
          trackRecordUrl: 'https://pokedao.ai/performance',
          cardValueCents: 500000, // $5,000 - MEGA tier
        };
    }

    const lines = formatProfessionalAgentPost(sample);
    await postThread(lines);
    return;
  }

  const { findFreshListings } = await import('./steps/01_fetch.js');
  const { normalizeListings } = await import('./steps/02_normalize.js');
  const { attachComps } = await import('./steps/03_features.js');
  const { detectCandidates } = await import('./steps/04_signal.js');
  const { validateAndPersist } = await import('./steps/05_validate.js');
  const { stageAndMaybePost } = await import('./steps/06_output.js');

  const listings = await findFreshListings();
  const norm = await normalizeListings(listings);
  const withComps = await attachComps(norm);
  const cands = detectCandidates(withComps);
  const kept = await validateAndPersist(cands);
  await stageAndMaybePost(kept);
}