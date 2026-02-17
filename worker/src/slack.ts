import { SlackBlock } from './types';

export interface SlackMessage {
  text?: string;
  blocks?: SlackBlock[];
  channel?: string;
  username?: string;
  icon_emoji?: string;
}

async function sendToSlack(
  webhookUrl: string,
  message: SlackMessage
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...message,
        username: message.username || 'Triple Whale Bot',
        icon_emoji: message.icon_emoji || ':whale:',
      }),
    });

    if (!response.ok) {
      console.error('Slack webhook error:', response.status, await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Slack webhook exception:', error);
    return false;
  }
}

export async function sendBlockMessage(
  webhookUrl: string,
  blocks: SlackBlock[],
  fallbackText: string = 'Marketing Report'
): Promise<boolean> {
  return sendToSlack(webhookUrl, {
    text: fallbackText,
    blocks,
  });
}

export async function sendBlockMessages(
  webhookUrl: string,
  messages: SlackBlock[][]
): Promise<void> {
  for (const blocks of messages) {
    await sendBlockMessage(webhookUrl, blocks);
  }
}
