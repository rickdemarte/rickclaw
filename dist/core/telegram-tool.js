"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendTelegramTool = void 0;
const tool_registry_1 = require("./tool-registry");
const https_1 = __importDefault(require("https"));
class SendTelegramTool extends tool_registry_1.BaseTool {
    name = 'send_telegram';
    description = 'Sends a text message to a Telegram user/chat via the configured bot. Only sends to IDs in the TELEGRAM_ALLOWED_USER_IDS allow-list.';
    parameters = {
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
    async execute(args) {
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
            const targetId = args.chat_id ? String(args.chat_id).trim() : allowedIds[0];
            if (!targetId || !allowedIds.includes(targetId)) {
                return `Error: chat_id ${targetId} is not in the allowed list. Allowed: ${allowedIds.join(', ')}`;
            }
            const result = await this.sendMessage(token, targetId, args.message);
            return result;
        }
        catch (err) {
            return `Error sending Telegram message: ${err.message}`;
        }
    }
    sendMessage(token, chatId, text) {
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
            const req = https_1.default.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.ok) {
                            resolve(`Message sent successfully to chat ${chatId}. Message ID: ${json.result?.message_id}`);
                        }
                        else {
                            resolve(`Telegram API error: ${json.description || 'Unknown error'}`);
                        }
                    }
                    catch {
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
exports.SendTelegramTool = SendTelegramTool;
//# sourceMappingURL=telegram-tool.js.map