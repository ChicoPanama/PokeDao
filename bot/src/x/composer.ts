export function composeQuickHit(args: {
  cardName: string;
  setCode: string;
  number: string;
  edgeBp: number;
  confidence: number;
  thesis: string;
  links: { listing: string; audit: string };
}) {
  const pct = Math.round(args.edgeBp / 100);
  const conf = Math.round(args.confidence * 100);
  const headline = `${args.cardName} — ${pct}% edge, conf ${conf}%`;
  const bullets = [args.thesis];
  const hashtags = ['#PokemonTCG', '#TCG'];
  return { style: 'quick_hit', headline, bullets, plan: { tag: 'WATCH' }, hashtags, links: args.links };
}

