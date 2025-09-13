import { formatOpportunityThread } from '../../../../packages/social/x/post.js';
import { postThread } from '../../../../packages/social/x/client.js';
import { sharedPrisma as prisma } from '../../../../packages/shared/db.js';
import { cardTitleForTweet } from './title.js';

function inWindow(now: Date) {
  const start = process.env.POSTING_WINDOW_START || '09:00';
  const end = process.env.POSTING_WINDOW_END || '18:00';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return mins >= s && mins <= e;
}

export async function postDailyBest() {
  const now = new Date();
  if (!inWindow(now)) {
    console.log('[post] daily: outside posting window, skipping');
    return;
  }

  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const best = await prisma.opportunity.findFirst({
    where: { status: 'PENDING', createdAt: { gte: since } },
    orderBy: [{ netSpreadBps: 'desc' }, { confidence: 'desc' }],
  });
  if (!best) {
    console.log('[post] daily: no PENDING opportunities in 24h');
    return;
  }

  const listing = await prisma.marketListing.findUnique({
    where: { id: best.listingId },
    select: { url: true },
  });

  const cardTitle = await cardTitleForTweet(best.cardId);

  const lines = formatOpportunityThread({
    cardTitle,
    spreadPct: best.netSpreadBps / 100,
    buyUrl: listing?.url || 'https://example.com',
    sellCompUrl: undefined,
    rationale: best.rationale,
  risks: ['Condition variance', 'Fee drift', 'Listing cancellation'] as readonly string[],
    timeWindow: 'Next 24–72h',
  });

  await postThread(lines);
  await prisma.opportunity.update({ where: { id: best.id }, data: { status: 'POSTED' } });
}
