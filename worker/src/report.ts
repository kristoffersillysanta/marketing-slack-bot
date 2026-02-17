import { DailyReportData, WeeklyReportData, MonthlyReportData, SlackBlock } from './types';
import {
  formatMainTable,
  formatChannelBreakdownInline,
  formatChannelTable,
  formatTrendTable,
  formatDate,
  formatDateRange,
  getMonthName,
} from './formatting';

// =============================================================================
// CONTEXT MESSAGES (rotating cat messages)
// =============================================================================

const DAILY_MESSAGES = [
  "Meow <!channel> :fat_cat: Kitty checked your numbers overnight. Here:",
  "pspsps <!channel> daily marketing report. You're welcome :meow_fluffy-deal-with-it:",
  "Good morning <!channel> :meow_party: Kitty watched your campaigns yesterday. Here's what happened:",
  "Another day, another report <!channel> :fat_cat: Kitty delivered. As always:",
  "Kitty walked across the keyboard and accidentally pulled your daily report <!channel> Here :meow_fluffy-deal-with-it:",
];

const WEEKLY_MESSAGES = [
  "Meow meow <!channel> :meow_party: Kitty has been smashing the keyboard all week. Here's what came out:",
  "Weekly report time <!channel> :fat_cat: Kitty sat on the laptop all week watching your numbers:",
  "pspsps <!channel> Kitty tracked everything this week. You're welcome :meow_fluffy-deal-with-it:",
  "Seven days of keyboard smashing later <!channel> here's your weekly report :meow_party:",
];

const MONTHLY_MESSAGES = [
  "MEOW <!channel> :fat_cat::fat_cat::fat_cat: Kitty has been hoarding data all month. Here:",
  "30 days of keyboard smashing <!channel> and this is what Kitty found :meow_party:",
  "The big one <!channel> :fat_cat: Kitty spent a whole month on this. You may pet me now:",
  "Monthly report time <!channel> Kitty walked across every spreadsheet this month. Fine, you can have it :meow_fluffy-deal-with-it:",
];

function getRandomMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}

const OUTRO = `Chat with Claude\u2024ai — add this connector and call it _Marketing Kitty_: \`https://marketing-slack-bot.seoblogbot.workers.dev/sse\`, then ask: "What can Marketing Kitty help me with?" to list all the functions :meow_fluffy-deal-with-it:`;

// =============================================================================
// BLOCK HELPERS
// =============================================================================

function header(text: string): SlackBlock {
  return { type: 'header', text: { type: 'plain_text', text, emoji: true } };
}

function section(text: string): SlackBlock {
  return { type: 'section', text: { type: 'mrkdwn', text } };
}

function context(text: string): SlackBlock {
  return { type: 'context', elements: [{ type: 'mrkdwn', text }] };
}

function codeBlock(content: string): SlackBlock {
  return {
    type: 'rich_text',
    elements: [{
      type: 'rich_text_preformatted',
      elements: [{ type: 'text', text: content }],
    }],
  };
}

// =============================================================================
// DAILY REPORT
// =============================================================================

export function generateDailyReport(data: DailyReportData): SlackBlock[][] {
  const blocks: SlackBlock[] = [];

  // Title + date + greeting
  blocks.push(header('🚀 DAILY MARKETING REPORT'));
  blocks.push(context(formatDate(data.date)));
  blocks.push(section(getRandomMessage(DAILY_MESSAGES)));

  // Main metrics
  blocks.push(section(`*⚡ MAIN METRICS — ${formatDate(data.date)}*`));
  blocks.push(codeBlock(formatMainTable(data.countries, data.totals, false)));

  // Channel breakdown
  if (data.countries.some(c => c.channels.length > 0)) {
    blocks.push(section('*📊 CHANNEL BREAKDOWN*'));
    blocks.push(context('Market · Channel Spend · Channel ROAS · Share of spend (only markets and channels with spend)'));
    blocks.push(codeBlock(formatChannelBreakdownInline(data.countries)));
  }

  // WTD (Week-to-Date) — Wed-Fri only
  if (data.wtd) {
    blocks.push(section(`*📅 WEEK TO DATE (${data.wtd.label})*`));
    blocks.push(codeBlock(formatMainTable(data.wtd.countries, data.wtd.totals, false)));
  }

  // Outro
  blocks.push(context(OUTRO));

  // Footer as context
  const footerParts = [];
  footerParts.push('💡 ROAS is channel-reported (platform\'s own numbers). Pixel ROAS updated in weekly.');
  footerParts.push('💰 Revenue figures include VAT (gross). Spend is ex-VAT.');
  if (data.noSpendCountries.length > 0) {
    footerParts.push(`⚠️ No spend: ${data.noSpendCountries.join(', ')} — check TW setup`);
  }
  blocks.push(context(footerParts.join(' ')));

  return [blocks];
}

// =============================================================================
// WEEKLY REPORT (split into multiple messages)
// =============================================================================

export function generateWeeklyReport(data: WeeklyReportData): SlackBlock[][] {
  const messages: SlackBlock[][] = [];
  const blocks: SlackBlock[] = [];

  // Title + date range + greeting
  blocks.push(header('🚀 WEEKLY MARKETING REPORT'));
  blocks.push(context(`Week ${data.weekNumber}, ${data.year} — ${formatDateRange(data.startDate, data.endDate)}`));
  blocks.push(section(getRandomMessage(WEEKLY_MESSAGES)));

  // Main table
  blocks.push(section(`*⚡ MAIN METRICS — Week ${data.weekNumber}, ${data.year}*`));
  blocks.push(codeBlock(formatMainTable(data.countries, data.totals)));

  // 3-week trend
  if (data.trend.length > 0) {
    blocks.push(section('*📈 3-WEEK TREND*'));
    blocks.push(codeBlock(formatTrendTable(data.trend, 'weekly')));
  }

  // Channel tables per country
  for (const country of data.countries) {
    if (country.channels.length > 0) {
      blocks.push(section(`*🔍 CHANNELS — ${country.shop.flag} ${country.shop.code}*`));
      blocks.push(codeBlock(formatChannelTable(country, false)));
    }
  }

  // Footer parts
  const footerParts = [];
  if (data.pixelDataIncomplete) {
    footerParts.push('⏱️ Pixel data may update 1-3 days after week end. Saturday/Sunday numbers may be incomplete.');
  }
  footerParts.push('💰 Revenue figures include VAT (gross). Spend is ex-VAT.');
  if (data.noSpendCountries.length > 0) {
    footerParts.push(`⚠️ No spend: ${data.noSpendCountries.join(', ')} — check TW setup`);
  }

  if (data.mtd) {
    // First message: main report without footer
    messages.push([...blocks]);

    // Second message: MTD + outro + footer
    const mtdBlocks: SlackBlock[] = [];
    mtdBlocks.push(section(`*📅 MONTH TO DATE (${data.mtd.label})*`));
    mtdBlocks.push(codeBlock(formatMainTable(data.mtd.countries, data.mtd.totals)));
    mtdBlocks.push(context(OUTRO));
    mtdBlocks.push(context(footerParts.join(' ')));
    messages.push(mtdBlocks);
  } else {
    blocks.push(context(OUTRO));
    blocks.push(context(footerParts.join(' ')));
    messages.push(blocks);
  }

  return messages;
}

// =============================================================================
// MONTHLY REPORT (split into multiple messages)
// =============================================================================

export function generateMonthlyReport(data: MonthlyReportData): SlackBlock[][] {
  const messages: SlackBlock[][] = [];

  // --- Message 1: Main report ---
  const blocks: SlackBlock[] = [];

  const monthName = getMonthName(data.month);
  blocks.push(header('🚀 MONTHLY MARKETING REPORT'));
  blocks.push(context(`${monthName} ${data.year}`));
  blocks.push(section(getRandomMessage(MONTHLY_MESSAGES)));

  // Main table
  blocks.push(section(`*⚡ MAIN METRICS — ${monthName} ${data.year}*`));
  blocks.push(codeBlock(formatMainTable(data.countries, data.totals)));

  // 3-month trend
  if (data.trend.length > 0) {
    blocks.push(section('*📈 3-MONTH TREND*'));
    blocks.push(codeBlock(formatTrendTable(data.trend, 'monthly')));
  }

  messages.push(blocks);

  // Footer parts
  const footerParts = [];
  footerParts.push('💰 Revenue figures include VAT (gross). Spend is ex-VAT.');
  if (data.noSpendCountries.length > 0) {
    footerParts.push(`⚠️ No spend: ${data.noSpendCountries.join(', ')} — check TW setup`);
  }

  // --- Message 2: Channel tables (if any) ---
  const hasChannels = data.countries.some(c => c.channels.length > 0);
  if (hasChannels) {
    const channelBlocks: SlackBlock[] = [];
    for (const country of data.countries) {
      if (country.channels.length > 0) {
        channelBlocks.push(section(`*🔍 CHANNELS — ${country.shop.flag} ${country.shop.code}*`));
        channelBlocks.push(codeBlock(formatChannelTable(country, true)));
      }
    }
    channelBlocks.push(context(OUTRO));
    channelBlocks.push(context(footerParts.join(' ')));
    messages.push(channelBlocks);
  } else {
    // No channel tables — add outro + footer to main message
    const mainBlocks = messages[0];
    mainBlocks.push(context(OUTRO));
    mainBlocks.push(context(footerParts.join(' ')));
  }

  return messages;
}
