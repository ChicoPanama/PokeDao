/**
 * POKEDAO X/TWITTER SKILL
 *
 * Posts PokeDAO opportunities and market commentary to X/Twitter.
 * Integrates with Clawdbot's Twitter posting capabilities.
 *
 * Features:
 * - Posts strong buy opportunities
 * - Daily market commentary
 * - Rate limiting (max 1 post per 5 minutes)
 */

export default {
  name: 'pokedao-x',
  description: 'Posts PokeDAO opportunities to X/Twitter',
  version: '1.0.0',

  // Check for posts every 2 minutes
  schedule: '*/2 * * * *',

  async execute(context: any) {
    const { redis, twitter, log } = context;

    if (!twitter) {
      log.debug('Twitter not configured, skipping X posting');
      return;
    }

    try {
      // Rate limit: max 1 post per 5 minutes
      const lastPost = await redis.get('pokedao:x:lastPost');
      if (lastPost && Date.now() - parseInt(lastPost) < 5 * 60 * 1000) {
        return;
      }

      // Get pending posts from queue
      const postJson = await redis.lpop('pokedao:x:pending');
      if (!postJson) return;

      const post = JSON.parse(postJson);
      const tweet = this.formatTweet(post);

      await twitter.post(tweet);

      await redis.set('pokedao:x:lastPost', Date.now().toString());

      log.info(`Posted to X: ${post.cardName}`);
    } catch (error) {
      log.error('Error posting to X:', error);
    }
  },

  formatTweet(post: any): string {
    const discount = parseFloat(post.discount);
    const emoji = discount > 25 ? '🚨' : discount > 15 ? '🎯' : '📊';

    return `${emoji} ${post.cardName} Alert

💰 Price: $${parseFloat(post.price).toFixed(0)}
📊 Fair Value: $${parseFloat(post.fairValue).toFixed(0)}
📉 ${post.discount}% below market

${post.thesis?.split('\n')[0] || 'Undervalued opportunity spotted!'}

${post.url}

#Pokemon #PokemonTCG #CardInvesting`.trim();
  },

  /**
   * Post market commentary (called by commentary worker).
   */
  async postCommentary(context: any, commentary: any) {
    const { twitter, redis, log } = context;

    if (!twitter) {
      log.debug('Twitter not configured, skipping commentary');
      return;
    }

    const tweet = this.formatCommentary(commentary);

    try {
      const result = await twitter.post(tweet);
      await redis.set('pokedao:x:lastCommentary', Date.now().toString());

      log.info('Posted market commentary to X');
      return result;
    } catch (error) {
      log.error('Error posting commentary:', error);
      throw error;
    }
  },

  formatCommentary(commentary: any): string {
    return `📊 PokeDAO Daily Market Update

${commentary.highlights?.slice(0, 3).join('\n') || commentary.content?.substring(0, 200)}

${commentary.sentiment === 'bullish' ? '📈 Market Sentiment: Bullish' : commentary.sentiment === 'bearish' ? '📉 Market Sentiment: Bearish' : '➡️ Market Sentiment: Neutral'}

#Pokemon #PokemonTCG #CardMarket #Investing`.trim();
  },

  /**
   * Queue a post for later (used by processor).
   */
  async queuePost(context: any, opportunity: any) {
    const { redis } = context;

    await redis.rpush(
      'pokedao:x:pending',
      JSON.stringify({
        cardName: opportunity.cardName,
        price: opportunity.price,
        fairValue: opportunity.fairValue,
        discount: opportunity.discount,
        thesis: opportunity.thesis,
        url: opportunity.url,
        queuedAt: new Date().toISOString()
      })
    );
  },

  // Commands for manual posting
  commands: {
    async postNow(context: any, cardName: string) {
      const { redis, twitter, reply, log } = context;

      if (!twitter) {
        return reply('Twitter posting is not configured.');
      }

      // Find the opportunity
      const ids = await redis.zrevrange('opportunities:recent', 0, 49);
      let found = null;

      for (const id of ids) {
        const data = await redis.hgetall(`opportunity:${id}`);
        if (data?.cardName?.toLowerCase().includes(cardName.toLowerCase())) {
          found = data;
          break;
        }
      }

      if (!found) {
        return reply(`Couldn't find an opportunity for "${cardName}". Try searching recent opportunities first.`);
      }

      const tweet = this.formatTweet(found);
      await twitter.post(tweet);

      return reply(`✅ Posted to X:\n\n${tweet}`);
    },

    async queue(context: any) {
      const { redis, reply } = context;

      const pending = await redis.lrange('pokedao:x:pending', 0, -1);

      if (pending.length === 0) {
        return reply('No posts queued for X.');
      }

      const formatted = pending
        .slice(0, 5)
        .map((p: string, i: number) => {
          const data = JSON.parse(p);
          return `${i + 1}. ${data.cardName} ($${data.price})`;
        })
        .join('\n');

      return reply(`📋 **X Post Queue** (${pending.length} pending)\n\n${formatted}`);
    }
  }
};
