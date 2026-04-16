import { Bot } from 'grammy';
export declare class TelegramOutputHandler {
    private bot;
    private MAX_CHUNK_SIZE;
    constructor(bot: Bot);
    sendResponse(chatId: string | number, response: string): Promise<void>;
    private chunkString;
}
//# sourceMappingURL=telegram-output-handler.d.ts.map