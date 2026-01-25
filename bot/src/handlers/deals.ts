/**
 * /deals command handler
 * Show current top deals
 */

import { Context } from 'grammy';
import { db } from '../lib/db.js';
import { formatDealAlert, createDealKeyboard, DealAlert } from '../services/alerts.js';
import { cacheDeal } from './callbacks.js';

export async function handleDeals(ctx: Context) {
  const from = ctx.from;

  if (!from) {
    await ctx.reply('❌ Could not identify user.');
    return;
  }

  try {
    // Get recent evaluations with good discounts
    const evaluations = await db.evaluation.findMany({
      where: {
        discount: { gte: 10 }, // At least 10% discount
        confidence: { gte: 0.7 }, // At least 70% confidence
      },
      include: {
        card: true,
        listing: true,
      },
      orderBy: { discount: 'desc' },
      take: 5,
    });

    if (evaluations.length === 0) {
      await ctx.reply(
        '📊 *Current Deals*\n\n' +
        'No deals found matching your criteria right now\\.\n\n' +
        'Criteria: ≥10% discount, ≥70% confidence\n\n' +
        'Check back later or adjust your /alerts settings\\.',
        { parse_mode: 'MarkdownV2' }
      );
      return;
    }

    await ctx.reply(`🔥 *Top ${evaluations.length} Deals Right Now*\n\nTap any deal for actions:`);

    for (const evaluation of evaluations) {
      const deal: DealAlert = {
        listingId: evaluation.listingId,
        cardId: evaluation.cardId,
        cardName: evaluation.card.name,
        setName: evaluation.card.set,
        grade: evaluation.card.grade || undefined,
        source: evaluation.listing.source,
        listingUrl: evaluation.listing.url,
        priceCents: Math.round(evaluation.listing.price * 100),
        fairValueCents: Math.round(evaluation.fairValue * 100),
        discountPct: evaluation.discount,
        confidence: evaluation.confidence,
      };

      // Cache for callback handling (include user ID for authorization)
      cacheDeal(deal.listingId, String(from.id), {
        cardId: deal.cardId,
        cardName: deal.cardName,
        priceCents: deal.priceCents,
      });

      await ctx.reply(formatDealAlert(deal), {
        parse_mode: 'Markdown',
        reply_markup: createDealKeyboard(deal),
      });
    }
  } catch (error) {
    console.error('❌ Error in /deals handler:', error);
    await ctx.reply('❌ Something went wrong. Please try again.');
  }
}

/**
 * Send a test deal alert (for development/admin testing)
 */
export async function handleTestAlert(ctx: Context) {
  const from = ctx.from;

  if (!from) {
    await ctx.reply('❌ Could not identify user.');
    return;
  }

  const testDeal: DealAlert = {
    listingId: 'test-123',
    cardId: 'card-456',
    cardName: 'Charizard Holo',
    setName: 'Base Set',
    grade: 'PSA 9',
    source: 'Collector Crypt',
    listingUrl: 'https://collectorcrypt.com/example',
    priceCents: 420000,
    fairValueCents: 510000,
    discountPct: 17.6,
    confidence: 0.87,
  };

  // Cache for callback handling (include user ID for authorization)
  cacheDeal(testDeal.listingId, String(from.id), {
    cardId: testDeal.cardId,
    cardName: testDeal.cardName,
    priceCents: testDeal.priceCents,
  });

  await ctx.reply(formatDealAlert(testDeal), {
    parse_mode: 'Markdown',
    reply_markup: createDealKeyboard(testDeal),
  });
}
