import { Bot, InputFile } from 'grammy';
import { AgentController } from '../core/agent-controller';
import { TelegramOutputHandler } from './telegram-output-handler';
import { AudioService } from '../services/audio-service';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { logger } from '../utils/logger';

export class TelegramInputHandler {
   private bot: Bot;
   private allowedUsers: string[];
   private outputHandler: TelegramOutputHandler;
   private audioService: AudioService;

   constructor(private controller: AgentController) {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        throw new Error("TELEGRAM_BOT_TOKEN is not set in .env");
      }
      this.bot = new Bot(token);
      this.allowedUsers = (process.env.TELEGRAM_ALLOWED_USER_IDS || '').split(',');
      this.outputHandler = new TelegramOutputHandler(this.bot);
      this.audioService = new AudioService();

      this.setupMiddlewares();
      this.setupHandlers();
   }

   private setupMiddlewares() {
     // Whitelist check
     this.bot.use(async (ctx, next) => {
       const userId = ctx.from?.id.toString();
       if (!userId || !this.allowedUsers.includes(userId)) {
          logger.warn(`[Telegram] Blocked unauthorized access attempt from ID: ${userId}`);
          return; // silent drop
       }
       await next();
     });
   }

   private setupHandlers() {
     // Admin Session Flush Commands
     this.bot.command('new', async (ctx) => {
         const userId = ctx.from?.id.toString();
         if (!userId) return;
         this.controller.clearMemory(userId);
         await ctx.reply("Pronto! Tópico limpo. Podemos começar um novo assunto.");
     });

     this.bot.command('history', async (ctx) => {
         const userId = ctx.from?.id.toString();
         if (!userId) return;
         const hist = this.controller.getHistory(userId);
         if (hist.length === 0) return ctx.reply("Nenhum histórico encontrado.");
         let msg = "Suas últimas sessões:\n\n";
         hist.forEach(h => msg += `ID: \`${h.id}\` (Provider: ${h.provider})\n`);
         msg += "\nUse `/session <ID>` para retomar.";
         await ctx.reply(msg, { parse_mode: 'Markdown' });
     });

     this.bot.command('session', async (ctx) => {
         const userId = ctx.from?.id.toString();
         if (!userId) return;
         const args = ctx.message?.text?.split(' ');
         if (!args || args.length < 2) return ctx.reply("Sintaxe: `/session <ID>`", { parse_mode: 'Markdown' });

         const targetId = args[1]!;
         this.controller.setSession(userId, targetId);
         await ctx.reply(`Sessão \`${targetId}\` ativada! Você voltou ao passado.`, { parse_mode: 'Markdown' });
     });

     this.bot.on('message:text', async (ctx) => {
       const userId = ctx.from.id.toString();
       const text = ctx.message.text;
       
       logger.info(`[Telegram] Got msg from ${userId}: ${text}`);

       // Show typing indicator
       await ctx.replyWithChatAction('typing');

       try {
         const answer = await this.controller.handleUserMessage(userId, text);
         await this.outputHandler.sendResponse(ctx.chat.id, answer);
       } catch (err: any) {
         logger.error(`[Telegram] Error processing: ${err}`);
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
                
                const tempPath = path.join(process.cwd(), 'tmp', `doc_${Date.now()}_${doc.file_name}`);
                const response = await axios({ url: dlUrl, responseType: 'arraybuffer' });
                fs.writeFileSync(tempPath, response.data);
                
                let extractedText = "";
                if (doc.mime_type === 'application/pdf') {
                    const dataBuffer = fs.readFileSync(tempPath);
                    // @ts-ignore
                    const pdfData = await pdfParse(dataBuffer);
                    extractedText = pdfData.text;
                } else if (doc.file_name?.endsWith('.md')) {
                    extractedText = fs.readFileSync(tempPath, 'utf8');
                }

                fs.unlinkSync(tempPath);
                
                const prompt = `Arquivo anexado (${doc.file_name}):\n\n${extractedText}\n\nUser Caption: ${ctx.message.caption || ''}`;
                
                const answer = await this.controller.handleUserMessage(userId, prompt);
                await this.outputHandler.sendResponse(ctx.chat.id, answer);

            } catch (err: any) {
                logger.error(`[TelegramDocument] Error: ${err}`);
                await ctx.reply("⚠️ Falha ao ler ou extrair o documento temporário.");
            }
       } else {
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
           
           const oggPath = path.join(process.cwd(), 'tmp', `voice_${Date.now()}.ogg`);
           const response = await axios({ url: dlUrl, responseType: 'stream' });
           
           await new Promise((resolve, reject) => {
               const writer = fs.createWriteStream(oggPath);
               response.data.pipe(writer);
               writer.on('finish', resolve);
               writer.on('error', reject);
           });

           // 2. Transcribe
           logger.info(`[Telegram] Processing voice from ${userId}...`);
           const textInput = await this.audioService.transcribeVoice(oggPath);
           logger.info(`[Telegram] Transcribed: ${textInput}`);
           
           if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);

           // 3. Process Logic
           await ctx.replyWithChatAction('typing');
           const answer = await this.controller.handleUserMessage(userId, textInput);

           // 4. Generate TTS and send back
           const outWav = path.join(process.cwd(), 'tmp', `tts_${Date.now()}.wav`);
           await this.audioService.generateSpeech(answer, outWav);

           // The outputHandler in spec currently does not have sendVoice, so we use ctx.replyWithVoice directly here
           await ctx.replyWithVoice(new InputFile(outWav));
           if (fs.existsSync(outWav)) fs.unlinkSync(outWav);

        } catch (err: any) {
           logger.error(`[TelegramVoice] Error: ${err}`);
           await ctx.reply("Sorry, I had trouble processing the audio.");
        }
     });
   }

   public async startPolling() {
     logger.info('[Telegram] Starting polling loop...');
     try {
        await this.bot.start({
           onStart: (botInfo) => {
             logger.info(`[Telegram] Bot @${botInfo.username} online and ready.`);
           }
        });
     } catch (err: any) {
        logger.error(`[Telegram] Failed to start bot: ${err.message}`);
     }
   }

   public isRunning(): boolean {
     return this.bot.isRunning();
   }

   public async stop() {
     await this.bot.stop();
   }
}
