import { CommandContext } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { UserContext } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

// In-memory store for user preferences (until we add to User model)
const userPreferences = new Map<string, {
  alertsEnabled: boolean;
  minDiscountPct: number;
  minPriceUsd: number;
  maxPriceUsd: number;
  grades: string[];
}>();

function getPreferences(telegramId: string) {
  if (!userPreferences.has(telegramId)) {
    userPreferences.set(telegramId, {
      alertsEnabled: true,
      minDiscountPct: 10,
      minPriceUsd: 0,
      maxPriceUsd: 10000,
      grades: ['PSA 10', 'PSA 9', 'CGC 10', 'BGS 10'],
    });
  }
  return userPreferences.get(telegramId)!;
}

/**
 * /alerts command handler
 * Shows and manages alert settings
 */
export async function alertsCommand(ctx: CommandContext<UserContext>) {
  if (!ctx.user) {
    await ctx.reply('Please use /start first to register.');
    return;
  }

  const prefs = getPreferences(ctx.user.telegramId);

  const statusEmoji = prefs.alertsEnabled ? '✅' : '❌';
  const statusText = prefs.alertsEnabled ? 'ON' : 'OFF';

  const message = `⚙️ **Alert Settings**

**Status:** ${statusEmoji} Alerts are ${statusText}

📊 **Current Filters:**
• Min Discount: ${prefs.minDiscountPct}%
• Price Range: $${prefs.minPriceUsd} - $${prefs.maxPriceUsd.toLocaleString()}
• Grades: ${prefs.grades.join(', ')}

💡 **What you'll receive:**
• Real-time alerts when cards drop ${prefs.minDiscountPct}%+ below fair value
• AI-generated investment thesis for each deal
• Direct links to purchase

_Use the buttons below to adjust your settings:_`;

  const keyboard = new InlineKeyboard()
    .text(prefs.alertsEnabled ? '🔕 Turn Off' : '🔔 Turn On', 'alerts:toggle')
    .row()
    .text('📉 5%', 'alerts:discount:5')
    .text('📉 10%', 'alerts:discount:10')
    .text('📉 15%', 'alerts:discount:15')
    .text('📉 20%', 'alerts:discount:20')
    .row()
    .text('💵 $0-$100', 'alerts:price:0-100')
    .text('💵 $100-$500', 'alerts:price:100-500')
    .text('💵 $500+', 'alerts:price:500-999999')
    .row()
    .text('🏆 Grades', 'alerts:grades')
    .text('🔄 Reset Defaults', 'alerts:reset');

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

/**
 * Handle alert-related callbacks
 */
export async function handleAlertsCallback(ctx: UserContext, action: string, params?: string) {
  if (!ctx.callbackQuery || !ctx.from) return;

  const prefs = getPreferences(ctx.from.id.toString());

  if (action === 'toggle') {
    prefs.alertsEnabled = !prefs.alertsEnabled;
    await ctx.answerCallbackQuery({
      text: `Alerts ${prefs.alertsEnabled ? 'enabled' : 'disabled'}!`,
    });
    // Refresh the message
    await updateAlertSettings(ctx, prefs);
  } else if (action === 'discount' && params) {
    const discount = parseInt(params, 10);
    if (!isNaN(discount)) {
      prefs.minDiscountPct = discount;
      await ctx.answerCallbackQuery({
        text: `Min discount set to ${discount}%`,
      });
      await updateAlertSettings(ctx, prefs);
    }
  } else if (action === 'price' && params) {
    const [min, max] = params.split('-').map(s => parseInt(s, 10));
    if (!isNaN(min) && !isNaN(max)) {
      prefs.minPriceUsd = min;
      prefs.maxPriceUsd = max;
      await ctx.answerCallbackQuery({
        text: `Price range set to $${min} - $${max === 999999 ? '∞' : max}`,
      });
      await updateAlertSettings(ctx, prefs);
    }
  } else if (action === 'grades') {
    await ctx.answerCallbackQuery();
    const gradeKeyboard = new InlineKeyboard()
      .text(prefs.grades.includes('PSA 10') ? '✅ PSA 10' : '⬜ PSA 10', 'alerts:grade:PSA 10')
      .text(prefs.grades.includes('PSA 9') ? '✅ PSA 9' : '⬜ PSA 9', 'alerts:grade:PSA 9')
      .row()
      .text(prefs.grades.includes('CGC 10') ? '✅ CGC 10' : '⬜ CGC 10', 'alerts:grade:CGC 10')
      .text(prefs.grades.includes('BGS 10') ? '✅ BGS 10' : '⬜ BGS 10', 'alerts:grade:BGS 10')
      .row()
      .text(prefs.grades.includes('Raw') ? '✅ Raw' : '⬜ Raw', 'alerts:grade:Raw')
      .row()
      .text('◀️ Back', 'alerts:back');

    await ctx.editMessageReplyMarkup({ reply_markup: gradeKeyboard });
  } else if (action === 'grade' && params) {
    const grade = params;
    if (prefs.grades.includes(grade)) {
      prefs.grades = prefs.grades.filter(g => g !== grade);
    } else {
      prefs.grades.push(grade);
    }
    await ctx.answerCallbackQuery({
      text: `${grade} ${prefs.grades.includes(grade) ? 'added' : 'removed'}`,
    });
    // Rebuild grade keyboard
    await handleAlertsCallback(ctx, 'grades');
  } else if (action === 'back') {
    await ctx.answerCallbackQuery();
    await updateAlertSettings(ctx, prefs);
  } else if (action === 'reset') {
    userPreferences.set(ctx.from.id.toString(), {
      alertsEnabled: true,
      minDiscountPct: 10,
      minPriceUsd: 0,
      maxPriceUsd: 10000,
      grades: ['PSA 10', 'PSA 9', 'CGC 10', 'BGS 10'],
    });
    await ctx.answerCallbackQuery({ text: 'Settings reset to defaults' });
    await updateAlertSettings(ctx, getPreferences(ctx.from.id.toString()));
  } else {
    await ctx.answerCallbackQuery({ text: 'Unknown action' });
  }
}

/**
 * Update the alert settings message
 */
async function updateAlertSettings(ctx: UserContext, prefs: ReturnType<typeof getPreferences>) {
  const statusEmoji = prefs.alertsEnabled ? '✅' : '❌';
  const statusText = prefs.alertsEnabled ? 'ON' : 'OFF';

  const message = `⚙️ **Alert Settings**

**Status:** ${statusEmoji} Alerts are ${statusText}

📊 **Current Filters:**
• Min Discount: ${prefs.minDiscountPct}%
• Price Range: $${prefs.minPriceUsd} - $${prefs.maxPriceUsd === 999999 ? '∞' : prefs.maxPriceUsd.toLocaleString()}
• Grades: ${prefs.grades.join(', ') || 'None selected'}

💡 **What you'll receive:**
• Real-time alerts when cards drop ${prefs.minDiscountPct}%+ below fair value
• AI-generated investment thesis for each deal
• Direct links to purchase

_Use the buttons below to adjust your settings:_`;

  const keyboard = new InlineKeyboard()
    .text(prefs.alertsEnabled ? '🔕 Turn Off' : '🔔 Turn On', 'alerts:toggle')
    .row()
    .text('📉 5%', 'alerts:discount:5')
    .text('📉 10%', 'alerts:discount:10')
    .text('📉 15%', 'alerts:discount:15')
    .text('📉 20%', 'alerts:discount:20')
    .row()
    .text('💵 $0-$100', 'alerts:price:0-100')
    .text('💵 $100-$500', 'alerts:price:100-500')
    .text('💵 $500+', 'alerts:price:500-999999')
    .row()
    .text('🏆 Grades', 'alerts:grades')
    .text('🔄 Reset Defaults', 'alerts:reset');

  try {
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (error) {
    // Message might not be editable, send new one
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }
}
