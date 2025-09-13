export function composeTraderTake({
  name,
  setCode,
  number,
  edgePct,
  confPct,
  thesis,
  link,
}: {
  name: string;
  setCode: string;
  number: string;
  edgePct: number;
  confPct: number;
  thesis: string;
  link: string;
}) {
  const headline = `${name} (${setCode} #${number}) — ${edgePct}% edge · conf ${confPct}%`;
  const line = thesis.replace(/\s+/g, ' ').trim();
  const suffix = link ? ` ${link}` : '';
  return `${headline}\n${line}${suffix}`;
}

