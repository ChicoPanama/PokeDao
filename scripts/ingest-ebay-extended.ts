import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { cardKey } from '../packages/shared/keys';
import { upsertCardByKey } from '../packages/shared/db';

type Row = {
  set_name?: string | null;
  card_number?: string | null;
  ebay_item_id?: string | null;
  ebay_url?: string | null;
  price?: number | string | null;
  seenAt?: string | null;
  condition_description?: string | null;
  grading_company?: string | null;
  grade_number?: string | null;
  seller_name?: string | null;
  seller_feedback?: number | null;
  watchers_count?: number | null;
  bid_count?: number | null;
  shipping_cost?: number | string | null;
  listing_type?: string | null;
  auction_end_time?: string | null;
};

const prisma = new PrismaClient();

function toFloat(n: unknown): number | null {
  if (n === null || n === undefined) return null;
  const x = typeof n === 'number' ? n : Number(String(n).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(x) ? x : null;
}

async function upsertListing(row: Row) {
  const setCode = String(row.set_name || '').trim();
  const number = String(row.card_number || '').trim();
  const ck = cardKey(setCode, number, 'EN', 'EN');
  const name = `${setCode} ${number}`.trim();

  const card = await upsertCardByKey(prisma as any, ck, name);

  const externalId = String(row.ebay_item_id || '');
  const url = String(row.ebay_url || '');
  const price = toFloat(row.price) || 0;
  const ship = toFloat(row.shipping_cost) ?? undefined;
  const seenAt = row.seenAt ? new Date(row.seenAt) : new Date();
  const endTime = row.auction_end_time ? new Date(row.auction_end_time) : null;
  const grade = [row.grading_company, row.grade_number].filter(Boolean).join(' ').trim() || null;
  const listingType = String(row.listing_type || '').toUpperCase();

  const existing = await prisma.listing.findFirst({
    where: {
      OR: [
        ...(externalId ? [{ externalId }] : []),
        ...(url ? [{ url }] : []),
      ],
      source: 'Ebay',
    },
  });

  if (existing) {
    await prisma.listing.update({
      where: { id: existing.id },
      data: {
        cardId: card.id,
        price,
        currency: 'USD',
        url,
        seller: row.seller_name || undefined,
        condition: row.condition_description || undefined,
        grade,
        marketplace: 'Ebay',
        externalId: externalId || undefined,
        shippingPrice: ship,
        listingType: listingType || undefined,
        endTime: endTime || undefined,
        bidCount: row.bid_count ?? undefined,
        watchers: row.watchers_count ?? undefined,
      },
    });
  } else {
    await prisma.listing.create({
      data: {
        cardId: card.id,
        source: 'Ebay',
        price,
        currency: 'USD',
        url,
        seller: row.seller_name || undefined,
        isActive: true,
        scrapedAt: seenAt,
        condition: row.condition_description || undefined,
        grade,
        marketplace: 'Ebay',
        externalId: externalId || undefined,
        shippingPrice: ship,
        listingType: listingType || undefined,
        endTime: endTime || undefined,
        bidCount: row.bid_count ?? undefined,
        watchers: row.watchers_count ?? undefined,
        stock: 1,
      },
    });
  }
}

async function main() {
  const file = process.argv[2] || 'data/research/ebay_current_extended.json';
  const raw = fs.readFileSync(file, 'utf8');
  const arr = JSON.parse(raw) as Row[];
  let ok = 0, err = 0;
  for (const row of arr) {
    try {
      // High-value focus only
      const price = toFloat(row.price) || 0;
      if (price < 500) continue;
      await upsertListing(row);
      ok++;
    } catch (e) {
      err++;
    }
  }
  console.log(`[ingest-ebay-extended] ok=${ok} err=${err}`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });

