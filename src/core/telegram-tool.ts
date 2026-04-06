import { BaseTool } from './tool-registry';
import https from 'https';

export class SendTelegramTool extends BaseTool {
  public readonly name = 'send_telegram';
  public readonly description = 'Sends a text message to a Telegram user/chat via the configured bot. Only sends to IDs in the TELEGRAM_ALLOWED_USER_IDS allow-list.';

  public readonly parameters = {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The text message to send. Supports Telegram Markdown formatting.'
      },
      chat_id: {
        type: 'string',
        description: 'Optional. Target Telegram user/chat ID. If omitted, sends to the first ID in the allow-list.'
      }
    },
    required: ['message']
  };

  public async execute(args: any): Promise<string> {
    try {
      if (!args.message) {
        return 'Error: send_telegram requires a "message" argument.';
      }

      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        return 'Error: TELEGRAM_BOT_TOKEN environment variable is not set.';
      }

      const allowedRaw = process.env.TELEGRAM_ALLOWED_USER_IDS || '';
      const allowedIds = allowedRaw.split(',').map(id => id.trim()).filter(Boolean);
      if (allowedIds.length === 0) {
        return 'Error: TELEGRAM_ALLOWED_USER_IDS is empty. No recipients allowed.';
      }

      const targetId = args.chat_id ? String(args.chat_id).trim() : allowedIds[0]!;

      if (!targetId || !allowedIds.includes(targetId)) {
        return `Error: chat_id ${targetId} is not in the allowed list. Allowed: ${allowedIds.join(', ')}`;
      }

      const result = await this.sendMessage(token, targetId, args.message);
      return result;
    } catch (err: any) {
      return `Error sending Telegram message: ${err.message}`;
    }
  }

  private sendMessage(token: string, chatId: string, text: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      });

      const options = {
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.ok) {
              resolve(`Message sent successfully to chat ${chatId}. Message ID: ${json.result?.message_id}`);
            } else {
              resolve(`Telegram API error: ${json.description || 'Unknown error'}`);
            }
          } catch {
            resolve(`Unexpected response from Telegram: ${data.substring(0, 200)}`);
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.write(payload);
      req.end();
    });
  }
}
