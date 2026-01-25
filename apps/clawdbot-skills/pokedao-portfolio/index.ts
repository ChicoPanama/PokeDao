/**
 * POKEDAO PORTFOLIO SKILL
 *
 * Manages user Pokemon card portfolios.
 * Tracks purchases, calculates P&L, provides insights.
 *
 * Features:
 * - Add holdings manually or from alerts
 * - Track cost basis and current value
 * - P&L calculations
 * - Performance insights
 */

export default {
  name: 'pokedao-portfolio',
  description: 'Manage Pokemon card investment portfolios',
  version: '1.0.0',

  triggers: ['portfolio', 'holdings', 'add card', 'bought', 'my cards', 'p&l', 'profit'],

  async execute(context: any, message: string) {
    const { llm, reply } = context;

    const intent = await llm.classify(message, {
      intents: [
        { name: 'view', description: 'User wants to see their portfolio' },
        { name: 'add', description: 'User wants to add a card to portfolio' },
        { name: 'remove', description: 'User wants to remove a card' },
        { name: 'performance', description: 'User wants to see P&L or performance' },
        { name: 'help', description: 'User needs help with portfolio' }
      ]
    });

    switch (intent.name) {
      case 'view':
        return this.viewPortfolio(context);
      case 'add':
        return this.addHolding(context, message);
      case 'remove':
        return this.removeHolding(context, message);
      case 'performance':
        return this.showPerformance(context);
      default:
        return this.portfolioHelp(context);
    }
  },

  async viewPortfolio(context: any) {
    const { redis, reply, userId } = context;

    // Get holdings from Redis
    const holdingIds = await redis.smembers(`portfolio:${userId}:holdings`);

    if (holdingIds.length === 0) {
      return reply(`📊 **Your Portfolio is Empty**

Add cards to track your investments!

Examples:
• "Add Charizard Base Set PSA 10, bought for $5000"
• "Bought Pikachu Illustrator for $50000"

Or mark alerts as "Bought" to auto-add.`);
    }

    let totalValue = 0;
    let totalCost = 0;
    const holdings = [];

    for (const id of holdingIds) {
      const data = await redis.hgetall(`holding:${id}`);
      if (data && data.cardName) {
        const cost = parseFloat(data.costBasis || '0');
        const current = parseFloat(data.currentValue || data.costBasis || '0');
        const gainLoss = cost > 0 ? ((current - cost) / cost) * 100 : 0;

        holdings.push({
          ...data,
          cost,
          current,
          gainLoss
        });

        totalCost += cost;
        totalValue += current;
      }
    }

    const totalGainLoss = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

    const formatted = holdings
      .map(
        (h) =>
          `• **${h.cardName}** ${h.grade || ''}
    Cost: $${h.cost.toFixed(0)} → $${h.current.toFixed(0)} (${h.gainLoss > 0 ? '+' : ''}${h.gainLoss.toFixed(1)}%)`
      )
      .join('\n');

    return reply(`📊 **Your Portfolio** (${holdings.length} cards)

${formatted}

━━━━━━━━━━━━━━━━━━
**Total Cost:** $${totalCost.toFixed(0)}
**Current Value:** $${totalValue.toFixed(0)}
**P&L:** ${totalGainLoss > 0 ? '+' : ''}$${(totalValue - totalCost).toFixed(0)} (${totalGainLoss.toFixed(1)}%)`);
  },

  async addHolding(context: any, message: string) {
    const { llm, redis, reply, userId } = context;

    // Extract card details
    const extraction = await llm.extract(message, {
      cardName: 'The Pokemon card name',
      set: 'The card set (optional)',
      grade: 'The grade like PSA 10 (optional)',
      price: 'The purchase price in dollars',
      quantity: 'Number of cards (default 1)'
    });

    if (!extraction.cardName || !extraction.price) {
      return reply(`Please provide the card name and purchase price.

Example: "Add Charizard Base Set PSA 10, bought for $5000"`);
    }

    const holdingId = `${userId}-${Date.now()}`;
    const price = parseFloat(extraction.price.replace(/[$,]/g, ''));

    await redis.hset(`holding:${holdingId}`, {
      cardName: extraction.cardName,
      setName: extraction.set || '',
      grade: extraction.grade || '',
      costBasis: price.toString(),
      currentValue: price.toString(), // Will be updated by price tracker
      quantity: extraction.quantity || '1',
      purchaseDate: new Date().toISOString(),
      userId
    });

    await redis.sadd(`portfolio:${userId}:holdings`, holdingId);

    return reply(`✅ Added to portfolio!

**${extraction.cardName}** ${extraction.set || ''} ${extraction.grade || ''}
**Cost:** $${price.toFixed(2)}

I'll track its value and notify you of significant changes.`);
  },

  async removeHolding(context: any, message: string) {
    const { llm, redis, reply, userId } = context;

    const extraction = await llm.extract(message, {
      cardName: 'The Pokemon card name to remove'
    });

    if (!extraction.cardName) {
      return reply('Which card would you like to remove? Say "remove [card name]"');
    }

    const holdingIds = await redis.smembers(`portfolio:${userId}:holdings`);
    let removed = false;

    for (const id of holdingIds) {
      const data = await redis.hgetall(`holding:${id}`);
      if (data?.cardName?.toLowerCase().includes(extraction.cardName.toLowerCase())) {
        await redis.srem(`portfolio:${userId}:holdings`, id);
        await redis.del(`holding:${id}`);
        removed = true;

        return reply(`✅ Removed **${data.cardName}** from your portfolio.`);
      }
    }

    if (!removed) {
      return reply(`Couldn't find "${extraction.cardName}" in your portfolio.`);
    }
  },

  async showPerformance(context: any) {
    const { redis, reply, userId } = context;

    const holdingIds = await redis.smembers(`portfolio:${userId}:holdings`);

    if (holdingIds.length === 0) {
      return reply('Your portfolio is empty. Add some cards first!');
    }

    let totalCost = 0;
    let totalValue = 0;
    let bestPerformer = { name: '', gainPct: -Infinity };
    let worstPerformer = { name: '', gainPct: Infinity };

    for (const id of holdingIds) {
      const data = await redis.hgetall(`holding:${id}`);
      if (data && data.cardName) {
        const cost = parseFloat(data.costBasis || '0');
        const current = parseFloat(data.currentValue || data.costBasis || '0');
        const gainPct = cost > 0 ? ((current - cost) / cost) * 100 : 0;

        totalCost += cost;
        totalValue += current;

        if (gainPct > bestPerformer.gainPct) {
          bestPerformer = { name: data.cardName, gainPct };
        }
        if (gainPct < worstPerformer.gainPct) {
          worstPerformer = { name: data.cardName, gainPct };
        }
      }
    }

    const totalGainPct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
    const totalGain = totalValue - totalCost;

    return reply(`📈 **Portfolio Performance**

**Total Return:** ${totalGain >= 0 ? '+' : ''}$${totalGain.toFixed(0)} (${totalGainPct.toFixed(1)}%)

**Best Performer:** ${bestPerformer.name}
${bestPerformer.gainPct > 0 ? '+' : ''}${bestPerformer.gainPct.toFixed(1)}%

**Worst Performer:** ${worstPerformer.name}
${worstPerformer.gainPct > 0 ? '+' : ''}${worstPerformer.gainPct.toFixed(1)}%

**Portfolio Size:** ${holdingIds.length} cards
**Total Invested:** $${totalCost.toFixed(0)}
**Current Value:** $${totalValue.toFixed(0)}`);
  },

  async portfolioHelp(context: any) {
    const { reply } = context;

    return reply(`📊 **Portfolio Commands**

• **View portfolio:** "Show my portfolio"
• **Add card:** "Add Charizard PSA 10, bought for $5000"
• **Remove card:** "Remove Charizard from portfolio"
• **Performance:** "How is my portfolio doing?"

Your portfolio tracks:
✓ Purchase price and date
✓ Current market value
✓ Profit/Loss per card
✓ Total portfolio performance`);
  }
};
