export type OpportunityForPost = {
  cardTitle: string;
  spreadPct: number; // net percent, e.g., 17.3
  buyUrl: string;
  sellCompUrl?: string;
  rationale: string; // short paragraph
  risks: readonly string[]; // bullet points (read-only ok)
  timeWindow: string; // e.g., "Next 24–72h"
};

export function formatOpportunityThread(o: OpportunityForPost) {
  const head = `🧩 Pokémon arbitrage: ${o.cardTitle}\nSpread: ${o.spreadPct.toFixed(1)}% (net)\n⌛ ${o.timeWindow}`;
  const why = `Why it exists:\n${o.rationale}`;
  const how = `Plan: Buy here → ${o.buyUrl}${o.sellCompUrl ? `\nExit via comps → ${o.sellCompUrl}` : ''}`;
  const risk = `Risks:\n${o.risks.map((r) => `• ${r}`).join('\n')}\nNot financial advice.`;
  return [head, why, how, risk];
}
