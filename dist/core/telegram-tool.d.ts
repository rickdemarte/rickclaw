import { BaseTool } from './tool-registry';
export declare class SendTelegramTool extends BaseTool {
    readonly name = "send_telegram";
    readonly description = "Sends a text message to a Telegram user/chat via the configured bot. Only sends to IDs in the TELEGRAM_ALLOWED_USER_IDS allow-list.";
    readonly parameters: {
        type: string;
        properties: {
            message: {
                type: string;
                description: string;
            };
            chat_id: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    execute(args: any): Promise<string>;
    private sendMessage;
}
//# sourceMappingURL=telegram-tool.d.ts.map