export interface SlackMessage {
  text?: string;
  blocks?: any[];
  channel?: string;
  username?: string;
  icon_emoji?: string;
}

export async function sendToSlack(
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

export async function sendReport(
  webhookUrl: string,
  reportText: string
): Promise<boolean> {
  return sendToSlack(webhookUrl, {
    text: reportText,
  });
}
