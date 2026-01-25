/**
 * Settings Command
 *
 * Deep user preferences management
 */

import { Context, InlineKeyboard } from 'grammy';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

// Type assertions for new Prisma models (run `prisma generate` after schema update)
const db = prisma as any;

/**
 * /settings command handler
 */
export async function settingsCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id?.toString();
  if (!telegramId) {
    await ctx.reply('Could not identify user.');
    return;
  }

  try {
    const user = await db.user.findUnique({
      where: { telegramId },
      include: {
        preferences: true,
      },
    });

    if (!user) {
      await ctx.reply('❌ Please register first with /start');
      return;
    }

    // Get or create preferences
    let prefs = user.preferences;
    if (!prefs) {
      prefs = await db.userPreferences.create({
        data: { userId: user.id },
      });
    }

    const keyboard = new InlineKeyboard()
      .text(`${prefs.alertsEnabled ? '🔔' : '🔕'} Alerts`, 'settings:toggle_alerts')
      .text('📊 Thresholds', 'settings:thresholds')
      .row()
      .text('🏷️ Grades', 'settings:grades')
      .text('🏪 Sources', 'settings:sources')
      .row()
      .text('🌙 Quiet Hours', 'settings:quiet')
      .text('🔐 Token Gate', 'settings:tokengate')
      .row()
      .text('♻️ Reset to Defaults', 'settings:reset');

    const alertStatus = prefs.alertsEnabled ? '🟢 ON' : '🔴 OFF';
    const grades = prefs.alertGrades?.length > 0 ? prefs.alertGrades.join(', ') : 'All grades';
    const sources = prefs.alertSources?.length > 0 ? prefs.alertSources.join(', ') : 'All sources';

    await ctx.reply(
      `⚙️ **Settings**

**Alert Settings**
├ Status: ${alertStatus}
├ Min Spread: ${prefs.minSpreadPct}%
├ Price Range: $${(prefs.minPriceCents / 100).toFixed(0)} - $${(prefs.maxPriceCents / 100).toFixed(0)}
├ Max Alerts/Hour: ${prefs.maxAlertsPerHour}
├ Grades: ${grades}
└ Sources: ${sources}

**Quiet Hours**
${prefs.quietHoursStart !== null
        ? `├ Start: ${prefs.quietHoursStart}:00 UTC\n└ End: ${prefs.quietHoursEnd}:00 UTC`
        : '└ Not configured'}

**Token Gating**
└ ${prefs.tokenGateEnabled ? `Enabled (min: ${prefs.minTokenBalance} tokens)` : 'Disabled'}

_Tap a button to modify settings_`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  } catch (error) {
    logger.error({ error }, 'Settings command failed');
    await ctx.reply('❌ Failed to load settings. Please try again.');
  }
}

/**
 * Settings callback handler
 */
export async function handleSettingsCallback(
  ctx: Context,
  action: string,
  params?: string
): Promise<void> {
  const telegramId = ctx.from?.id?.toString();
  if (!telegramId) return;

  try {
    await ctx.answerCallbackQuery();

    const user = await db.user.findUnique({
      where: { telegramId },
      include: { preferences: true },
    });

    if (!user) {
      await ctx.reply('❌ Please register first with /start');
      return;
    }

    let prefs = user.preferences;
    if (!prefs) {
      prefs = await db.userPreferences.create({
        data: { userId: user.id },
      });
    }

    switch (action) {
      case 'toggle_alerts':
        await db.userPreferences.update({
          where: { userId: user.id },
          data: { alertsEnabled: !prefs.alertsEnabled },
        });
        await ctx.reply(
          `${!prefs.alertsEnabled ? '🔔' : '🔕'} Alerts ${!prefs.alertsEnabled ? 'enabled' : 'disabled'}`
        );
        break;

      case 'thresholds':
        await showThresholdsMenu(ctx, prefs);
        break;

      case 'grades':
        await showGradesMenu(ctx, prefs);
        break;

      case 'sources':
        await showSourcesMenu(ctx, prefs);
        break;

      case 'quiet':
        await showQuietHoursMenu(ctx, prefs);
        break;

      case 'tokengate':
        await showTokenGateMenu(ctx, prefs);
        break;

      case 'reset':
        await resetSettings(ctx, user.id);
        break;

      case 'set_spread':
        if (params) {
          const spread = parseFloat(params);
          if (!isNaN(spread) && spread >= 5 && spread <= 100) {
            await db.userPreferences.update({
              where: { userId: user.id },
              data: { minSpreadPct: spread },
            });
            await ctx.reply(`✅ Minimum spread set to ${spread}%`);
          }
        }
        break;

      case 'set_min_price':
        if (params) {
          const price = parseInt(params);
          if (!isNaN(price) && price >= 0) {
            await db.userPreferences.update({
              where: { userId: user.id },
              data: { minPriceCents: price * 100 },
            });
            await ctx.reply(`✅ Minimum price set to $${price}`);
          }
        }
        break;

      case 'set_max_price':
        if (params) {
          const price = parseInt(params);
          if (!isNaN(price) && price > 0) {
            await db.userPreferences.update({
              where: { userId: user.id },
              data: { maxPriceCents: price * 100 },
            });
            await ctx.reply(`✅ Maximum price set to $${price}`);
          }
        }
        break;

      case 'toggle_grade':
        if (params) {
          const grades = prefs.alertGrades || [];
          const newGrades = grades.includes(params)
            ? grades.filter((g) => g !== params)
            : [...grades, params];
          await db.userPreferences.update({
            where: { userId: user.id },
            data: { alertGrades: newGrades },
          });
          await ctx.reply(`✅ Grade "${params}" ${newGrades.includes(params) ? 'added' : 'removed'}`);
        }
        break;

      case 'toggle_source':
        if (params) {
          const sources = prefs.alertSources || [];
          const newSources = sources.includes(params)
            ? sources.filter((s) => s !== params)
            : [...sources, params];
          await db.userPreferences.update({
            where: { userId: user.id },
            data: { alertSources: newSources },
          });
          await ctx.reply(`✅ Source "${params}" ${newSources.includes(params) ? 'added' : 'removed'}`);
        }
        break;

      default:
        await settingsCommand(ctx);
    }
  } catch (error) {
    logger.error({ error, action }, 'Settings callback failed');
    await ctx.reply('❌ Action failed. Please try again.');
  }
}

async function showThresholdsMenu(ctx: Context, prefs: any): Promise<void> {
  const keyboard = new InlineKeyboard()
    .text('10%', 'settings:set_spread:10')
    .text('15%', 'settings:set_spread:15')
    .text('20%', 'settings:set_spread:20')
    .text('25%', 'settings:set_spread:25')
    .row()
    .text('Min $5', 'settings:set_min_price:5')
    .text('Min $10', 'settings:set_min_price:10')
    .text('Min $25', 'settings:set_min_price:25')
    .row()
    .text('Max $100', 'settings:set_max_price:100')
    .text('Max $500', 'settings:set_max_price:500')
    .text('Max $1000', 'settings:set_max_price:1000')
    .row()
    .text('« Back', 'settings:back');

  await ctx.reply(
    `📊 **Threshold Settings**

Current:
• Min Spread: ${prefs.minSpreadPct}%
• Min Price: $${(prefs.minPriceCents / 100).toFixed(0)}
• Max Price: $${(prefs.maxPriceCents / 100).toFixed(0)}

_Select a value to change_`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    }
  );
}

async function showGradesMenu(ctx: Context, prefs: any): Promise<void> {
  const allGrades = ['PSA 10', 'PSA 9', 'BGS 10', 'BGS 9.5', 'CGC 10', 'CGC 9.5', 'Raw'];
  const currentGrades = prefs.alertGrades || [];

  const keyboard = new InlineKeyboard();

  allGrades.forEach((grade, i) => {
    const isEnabled = currentGrades.includes(grade);
    keyboard.text(`${isEnabled ? '✅' : '⬜'} ${grade}`, `settings:toggle_grade:${grade}`);
    if ((i + 1) % 2 === 0) keyboard.row();
  });

  keyboard.row().text('« Back', 'settings:back');

  await ctx.reply(
    `🏷️ **Grade Filters**

Only receive alerts for cards with these grades.
Tap to toggle:`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    }
  );
}

async function showSourcesMenu(ctx: Context, prefs: any): Promise<void> {
  const allSources = ['eBay', 'JustTCG', 'Phygitals', 'CollectorCrypt', 'Courtyard', 'TCGPlayer'];
  const currentSources = prefs.alertSources || [];

  const keyboard = new InlineKeyboard();

  allSources.forEach((source, i) => {
    const isEnabled = currentSources.includes(source);
    keyboard.text(`${isEnabled ? '✅' : '⬜'} ${source}`, `settings:toggle_source:${source}`);
    if ((i + 1) % 2 === 0) keyboard.row();
  });

  keyboard.row().text('« Back', 'settings:back');

  await ctx.reply(
    `🏪 **Source Filters**

Only receive alerts from these marketplaces.
Tap to toggle:`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    }
  );
}

async function showQuietHoursMenu(ctx: Context, prefs: any): Promise<void> {
  await ctx.reply(
    `🌙 **Quiet Hours**

Set hours when you don't want to receive alerts.

Current: ${prefs.quietHoursStart !== null
      ? `${prefs.quietHoursStart}:00 - ${prefs.quietHoursEnd}:00 UTC`
      : 'Not set'}

To set quiet hours, use:
\`/quiet_hours <start> <end>\`

Example: \`/quiet_hours 22 8\` (10 PM - 8 AM UTC)

To disable: \`/quiet_hours off\``,
    { parse_mode: 'Markdown' }
  );
}

async function showTokenGateMenu(ctx: Context, prefs: any): Promise<void> {
  const keyboard = new InlineKeyboard()
    .text(prefs.tokenGateEnabled ? '🔓 Disable' : '🔐 Enable', 'settings:toggle_tokengate')
    .row()
    .text('« Back', 'settings:back');

  await ctx.reply(
    `🔐 **Token Gating**

Status: ${prefs.tokenGateEnabled ? '🟢 Enabled' : '🔴 Disabled'}
${prefs.tokenGateEnabled ? `Min Balance: ${prefs.minTokenBalance} tokens` : ''}

When enabled, certain features require holding tokens.
Connect your wallet with /wallet to verify holdings.`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    }
  );
}

async function resetSettings(ctx: Context, userId: string): Promise<void> {
  await db.userPreferences.update({
    where: { userId },
    data: {
      alertsEnabled: true,
      minSpreadPct: 15.0,
      minPriceCents: 500,
      maxPriceCents: 100000,
      alertGrades: ['PSA 10', 'PSA 9', 'BGS 9.5', 'CGC 10'],
      alertSources: ['eBay', 'JustTCG', 'Phygitals'],
      maxAlertsPerHour: 10,
      quietHoursStart: null,
      quietHoursEnd: null,
      tokenGateEnabled: false,
      minTokenBalance: 0,
      snoozedCards: [],
      snoozedUntil: null,
    },
  });

  await ctx.reply('♻️ Settings reset to defaults!');
}
