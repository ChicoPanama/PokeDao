/**
 * POKEDAO QUERY SKILL
 *
 * Answers questions about Pokemon card investments.
 * Uses natural language understanding to route queries.
 *
 * Capabilities:
 * - Search for cards
 * - Get card prices and valuations
 * - Show portfolio
 * - Market analysis
 */

export default {
  name: 'pokedao-query',
  description: 'Answer questions about Pokemon card investments',
  version: '1.0.0',

  // Trigger words that activate this skill
  triggers: [
    'pokemon',
    'card',
    'price',
    'charizard',
    'pikachu',
    'psa',
    'investment',
    'buy',
    'sell',
    'worth',
    'value',
    'graded',
    'tcg',
    'pokedao'
  ],

  async execute(context: any, message: string) {
    const { llm, http, redis, reply, userId } = context;
    const apiUrl = process.env.POKEDAO_API_URL || 'http://localhost:3000';
    const startTime = Date.now();

    // Use LLM to understand intent
    const intent = await llm.classify(message, {
      intents: [
        { name: 'search', description: 'User wants to find/search for cards' },
        { name: 'price', description: 'User wants to know the price/value of a card' },
        { name: 'portfolio', description: 'User wants to see their portfolio' },
        { name: 'opportunities', description: 'User wants to see current opportunities' },
        { name: 'subscribe', description: 'User wants to subscribe to alerts' },
        { name: 'help', description: 'User needs help or information' }
      ]
    });

    // Collect query data for analytics
    this.collectQuery(http, apiUrl, userId, message, intent.name, startTime).catch(() => {
      // Ignore collection errors - don't block user
    });

    switch (intent.name) {
      case 'search':
        return this.handleSearch(context, message);
      case 'price':
        return this.handlePrice(context, message);
      case 'portfolio':
        return this.handlePortfolio(context);
      case 'opportunities':
        return this.handleOpportunities(context);
      case 'subscribe':
        return this.handleSubscribe(context);
      default:
        return this.handleHelp(context);
    }
  },

  async collectQuery(
    http: any,
    apiUrl: string,
    userId: string,
    rawText: string,
    intentType: string,
    startTime: number
  ) {
    try {
      await http.post(`${apiUrl}/api/collect/query`, {
        userId,
        platform: 'CLAWDBOT',
        rawText,
        intentType: intentType.toUpperCase(),
        responseTimeMs: Date.now() - startTime
      });
    } catch {
      // Ignore - collection is best-effort
    }
  },

  async handleSearch(context: any, message: string) {
    const { http, llm, reply } = context;
    const apiUrl = process.env.POKEDAO_API_URL || 'http://localhost:3000';

    // Extract search terms using LLM
    const extraction = await llm.extract(message, {
      cardName: 'The Pokemon card name',
      set: 'The card set (optional)',
      grade: 'The grade like PSA 10 (optional)',
      maxPrice: 'Maximum price (optional)'
    });

    // Build search query
    const params = new URLSearchParams();
    if (extraction.cardName) params.set('q', extraction.cardName);
    if (extraction.set) params.set('set', extraction.set);
    if (extraction.grade) params.set('grade', extraction.grade);
    if (extraction.maxPrice) params.set('maxPrice', extraction.maxPrice);

    try {
      const response = await http.get(`${apiUrl}/api/search?${params}`);
      const cards = response.data?.cards || response.data || [];

      if (!Array.isArray(cards) || cards.length === 0) {
        return reply("I couldn't find any cards matching that. Try being more specific?");
      }

      const formatted = cards
        .slice(0, 5)
        .map(
          (c: any, i: number) =>
            `${i + 1}. **${c.name}** (${c.set || 'Unknown Set'}) - $${c.price?.toFixed(2) || '?'}${
              c.discount > 0 ? ` (${c.discount.toFixed(1)}% below fair value)` : ''
            }`
        )
        .join('\n');

      return reply(
        `Found ${cards.length} cards:\n\n${formatted}\n\nWant me to analyze any of these?`
      );
    } catch (error) {
      return reply("Sorry, I couldn't search right now. Try again in a moment.");
    }
  },

  async handlePrice(context: any, message: string) {
    const { http, llm, reply, redis } = context;
    const apiUrl = process.env.POKEDAO_API_URL || 'http://localhost:3000';

    const extraction = await llm.extract(message, {
      cardName: 'The Pokemon card name',
      set: 'The card set (optional)',
      grade: 'The grade (optional)'
    });

    if (!extraction.cardName) {
      return reply("Which card would you like to check? Try: 'What's a Charizard Base Set PSA 10 worth?'");
    }

    try {
      const response = await http.get(
        `${apiUrl}/api/cards/price?name=${encodeURIComponent(extraction.cardName)}`
      );
      const data = response.data;

      if (!data || !data.fairValue) {
        return reply(`I don't have price data for ${extraction.cardName} yet. Try a different card?`);
      }

      return reply(`**${data.name}** ${data.set ? `(${data.set})` : ''}

💰 **Fair Value:** $${data.fairValue.toFixed(2)}
📈 **Trend:** ${data.trend?.direction || 'STABLE'} ${data.trend?.percent || 0}% (30d)
📊 **Recent Sales:** ${data.recentSales || 0} in last 30 days
${data.psa10Pop ? `🏆 **PSA 10 Pop:** ${data.psa10Pop}` : ''}

${
  data.currentListings > 0
    ? `🛒 **${data.currentListings} listings** starting at $${data.lowestPrice}`
    : 'No current listings found'
}`);
    } catch (error) {
      return reply(`I couldn't find price data for "${extraction.cardName}". Is the name spelled correctly?`);
    }
  },

  async handlePortfolio(context: any) {
    const { http, reply, userId, redis } = context;
    const apiUrl = process.env.POKEDAO_API_URL || 'http://localhost:3000';

    try {
      const response = await http.get(`${apiUrl}/api/portfolio/${userId}`);
      const portfolio = response.data;

      if (!portfolio?.holdings || portfolio.holdings.length === 0) {
        return reply(
          "You don't have any cards in your portfolio yet.\n\nTell me what you own and I'll track it! Try: 'Add Charizard Base Set PSA 10, bought for $5000'"
        );
      }

      const formatted = portfolio.holdings
        .map(
          (h: any) =>
            `• **${h.cardName}** - Bought: $${h.purchasePrice} | Current: $${h.currentValue} (${
              h.gainLoss > 0 ? '+' : ''
            }${h.gainLoss}%)`
        )
        .join('\n');

      return reply(`📊 **Your Portfolio**

${formatted}

**Total Value:** $${portfolio.totalValue}
**Total P&L:** ${portfolio.totalGainLoss > 0 ? '+' : ''}$${portfolio.totalGainLoss} (${
        portfolio.totalGainLossPercent
      }%)`);
    } catch (error) {
      // Check Redis for local portfolio
      const purchases = await context.redis.smembers(`user:${userId}:purchases`);

      if (purchases.length === 0) {
        return reply("You don't have any cards in your portfolio yet. Mark some alerts as 'Bought' to start tracking!");
      }

      return reply(`You have ${purchases.length} cards tracked. Full portfolio view coming soon!`);
    }
  },

  async handleOpportunities(context: any) {
    const { redis, reply } = context;

    // Get recent opportunities from Redis
    const ids = await redis.zrevrange('opportunities:recent', 0, 9);

    if (ids.length === 0) {
      return reply("No recent opportunities found. I'll alert you when I find good deals!");
    }

    const opportunities = [];
    for (const id of ids) {
      const data = await redis.hgetall(`opportunity:${id}`);
      if (data && data.cardName) {
        opportunities.push(data);
      }
    }

    const formatted = opportunities
      .slice(0, 5)
      .map(
        (o: any, i: number) =>
          `${i + 1}. **${o.cardName}** - $${parseFloat(o.price).toFixed(2)} (${o.discount}% off)`
      )
      .join('\n');

    return reply(`🎯 **Recent Opportunities**

${formatted}

Reply with a number to see details, or say "subscribe" to get alerts.`);
  },

  async handleSubscribe(context: any) {
    const { redis, reply, userId } = context;

    await redis.sadd('pokedao:subscribers', userId);

    return reply(`✅ You're now subscribed to PokeDAO alerts!

I'll notify you when I find undervalued Pokemon cards.

**Configure your preferences:**
• "Set minimum discount to 15%"
• "Only cards under $500"
• "Focus on Charizard cards"

What would you like to customize?`);
  },

  async handleHelp(context: any) {
    const { reply } = context;

    return reply(`🎴 **PokeDAO - Pokemon Card Investment Intelligence**

**What I can do:**
• Search for cards: "Find PSA 10 Charizard under $1000"
• Check prices: "What's a base set Pikachu worth?"
• Track portfolio: "Show my portfolio"
• Get opportunities: "Show me deals"
• Get alerts: "Subscribe to alerts"

**Example questions:**
• "What's a good Pokemon card to buy for $500?"
• "Is this Charizard a good investment?"
• "Show me undervalued cards from Base Set"

Just ask naturally - I'll figure it out! 🚀`);
  }
};
