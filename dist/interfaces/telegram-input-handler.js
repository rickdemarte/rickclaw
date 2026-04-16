"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramInputHandler = void 0;
const grammy_1 = require("grammy");
const telegram_output_handler_1 = require("./telegram-output-handler");
const audio_service_1 = require("../services/audio-service");
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const logger_1 = require("../utils/logger");
class TelegramInputHandler {
    controller;
    bot;
    allowedUsers;
    outputHandler;
    audioService;
    constructor(controller) {
        this.controller = controller;
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
            throw new Error("TELEGRAM_BOT_TOKEN is not set in .env");
        }
        this.bot = new grammy_1.Bot(token);
        this.allowedUsers = (process.env.TELEGRAM_ALLOWED_USER_IDS || '').split(',');
        this.outputHandler = new telegram_output_handler_1.TelegramOutputHandler(this.bot);
        this.audioService = new audio_service_1.AudioService();
        this.setupMiddlewares();
        this.setupHandlers();
    }
    setupMiddlewares() {
        // Whitelist check
        this.bot.use(async (ctx, next) => {
            const userId = ctx.from?.id.toString();
            if (!userId || !this.allowedUsers.includes(userId)) {
                logger_1.logger.warn(`[Telegram] Blocked unauthorized access attempt from ID: ${userId}`);
                return; // silent drop
            }
            await next();
        });
    }
    setupHandlers() {
        // Admin Session Flush Commands
        this.bot.command('new', async (ctx) => {
            const userId = ctx.from?.id.toString();
            if (!userId)
                return;
            this.controller.clearMemory(userId);
            await ctx.reply("Pronto! Tópico limpo. Podemos começar um novo assunto.");
        });
        this.bot.command('history', async (ctx) => {
            const userId = ctx.from?.id.toString();
            if (!userId)
                return;
            const hist = this.controller.getHistory(userId);
            if (hist.length === 0)
                return ctx.reply("Nenhum histórico encontrado.");
            let msg = "Suas últimas sessões:\n\n";
            hist.forEach(h => msg += `ID: \`${h.id}\` (Provider: ${h.provider})\n`);
            msg += "\nUse `/session <ID>` para retomar.";
            await ctx.reply(msg, { parse_mode: 'Markdown' });
        });
        this.bot.command('session', async (ctx) => {
            const userId = ctx.from?.id.toString();
            if (!userId)
                return;
            const args = ctx.message?.text?.split(' ');
            if (!args || args.length < 2)
                return ctx.reply("Sintaxe: `/session <ID>`", { parse_mode: 'Markdown' });
            const targetId = args[1];
            this.controller.setSession(userId, targetId);
            await ctx.reply(`Sessão \`${targetId}\` ativada! Você voltou ao passado.`, { parse_mode: 'Markdown' });
        });
        this.bot.on('message:text', async (ctx) => {
            const userId = ctx.from.id.toString();
            const text = ctx.message.text;
            logger_1.logger.info(`[Telegram] Got msg from ${userId}: ${text}`);
            // Show typing indicator
            await ctx.replyWithChatAction('typing');
            try {
                const answer = await this.controller.handleUserMessage(userId, text);
                await this.outputHandler.sendResponse(ctx.chat.id, answer);
            }
            catch (err) {
                logger_1.logger.error(`[Telegram] Error processing: ${err}`);
                await this.outputHandler.sendResponse(ctx.chat.id, "Sorry, I encountered an internal error processing your request.");
            }
        });
        this.bot.on('message:document', async (ctx) => {
            const userId = ctx.from.id.toString();
            const doc = ctx.message.document;
            if (doc.mime_type === 'application/pdf' || doc.file_name?.endsWith('.md')) {
                await ctx.replyWithChatAction('typing');
                try {
                    const fileObj = await ctx.api.getFile(doc.file_id);
                    const dlUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileObj.file_path}`;
                    const tempPath = path_1.default.join(process.cwd(), 'tmp', `doc_${Date.now()}_${doc.file_name}`);
                    const response = await (0, axios_1.default)({ url: dlUrl, responseType: 'arraybuffer' });
                    fs_1.default.writeFileSync(tempPath, response.data);
                    let extractedText = "";
                    if (doc.mime_type === 'application/pdf') {
                        const dataBuffer = fs_1.default.readFileSync(tempPath);
                        // @ts-ignore
                        const pdfData = await (0, pdf_parse_1.default)(dataBuffer);
                        extractedText = pdfData.text;
                    }
                    else if (doc.file_name?.endsWith('.md')) {
                        extractedText = fs_1.default.readFileSync(tempPath, 'utf8');
                    }
                    fs_1.default.unlinkSync(tempPath);
                    const prompt = `Arquivo anexado (${doc.file_name}):\n\n${extractedText}\n\nUser Caption: ${ctx.message.caption || ''}`;
                    const answer = await this.controller.handleUserMessage(userId, prompt);
                    await this.outputHandler.sendResponse(ctx.chat.id, answer);
                }
                catch (err) {
                    logger_1.logger.error(`[TelegramDocument] Error: ${err}`);
                    await ctx.reply("⚠️ Falha ao ler ou extrair o documento temporário.");
                }
            }
            else {
                await ctx.reply("⚠️ Documento não anexado. Suporte restrito a .pdf e .md nesta etapa.");
            }
        });
        this.bot.on('message:voice', async (ctx) => {
            const userId = ctx.from.id.toString();
            await ctx.replyWithChatAction('typing');
            try {
                // 1. Download the voice file
                const fileId = ctx.message.voice.file_id;
                const fileObj = await ctx.api.getFile(fileId);
                const dlUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileObj.file_path}`;
                const oggPath = path_1.default.join(process.cwd(), 'tmp', `voice_${Date.now()}.ogg`);
                const response = await (0, axios_1.default)({ url: dlUrl, responseType: 'stream' });
                await new Promise((resolve, reject) => {
                    const writer = fs_1.default.createWriteStream(oggPath);
                    response.data.pipe(writer);
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
                // 2. Transcribe
                logger_1.logger.info(`[Telegram] Processing voice from ${userId}...`);
                const textInput = await this.audioService.transcribeVoice(oggPath);
                logger_1.logger.info(`[Telegram] Transcribed: ${textInput}`);
                if (fs_1.default.existsSync(oggPath))
                    fs_1.default.unlinkSync(oggPath);
                // 3. Process Logic
                await ctx.replyWithChatAction('typing');
                const answer = await this.controller.handleUserMessage(userId, textInput);
                // 4. Generate TTS and send back
                const outWav = path_1.default.join(process.cwd(), 'tmp', `tts_${Date.now()}.wav`);
                await this.audioService.generateSpeech(answer, outWav);
                // The outputHandler in spec currently does not have sendVoice, so we use ctx.replyWithVoice directly here
                await ctx.replyWithVoice(new grammy_1.InputFile(outWav));
                if (fs_1.default.existsSync(outWav))
                    fs_1.default.unlinkSync(outWav);
            }
            catch (err) {
                logger_1.logger.error(`[TelegramVoice] Error: ${err}`);
                await ctx.reply("Sorry, I had trouble processing the audio.");
            }
        });
    }
    async startPolling() {
        logger_1.logger.info('[Telegram] Starting polling loop...');
        try {
            await this.bot.start({
                onStart: (botInfo) => {
                    logger_1.logger.info(`[Telegram] Bot @${botInfo.username} online and ready.`);
                }
            });
        }
        catch (err) {
            logger_1.logger.error(`[Telegram] Failed to start bot: ${err.message}`);
        }
    }
    isRunning() {
        return this.bot.isRunning();
    }
    async stop() {
        await this.bot.stop();
    }
}
exports.TelegramInputHandler = TelegramInputHandler;
//# sourceMappingURL=telegram-input-handler.js.map