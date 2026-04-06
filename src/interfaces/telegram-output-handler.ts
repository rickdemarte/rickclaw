import { Bot, InputFile } from 'grammy';
import fs from 'fs';
import path from 'path';

export class TelegramOutputHandler {
   private MAX_CHUNK_SIZE = 4000;

   constructor(private bot: Bot) {}

   public async sendResponse(chatId: string | number, response: string) {
       // Check for FileOutputStrategy triggers if the script intended a file export explicitly
       if (response.includes("ARQUIVO.MD")) {
           const cleanContent = response.replace("ARQUIVO.MD", "").trim();
           const tempPath = path.join(process.cwd(), 'tmp', `export_${Date.now()}.md`);
           fs.writeFileSync(tempPath, cleanContent);
           await this.bot.api.sendDocument(chatId, new InputFile(tempPath), {
             caption: "Seu arquivo gerado."
           });
           fs.unlinkSync(tempPath);
           return;
       }

       // TextOutputStrategy (Chunking to prevent 4096 Payload limit crashes)
       const chunks = this.chunkString(response, this.MAX_CHUNK_SIZE);
       
       for (const chunk of chunks) {
           try {
              await this.bot.api.sendMessage(chatId, chunk);
           } catch (e: any) {
              if (e.message?.includes("429")) {
                  // Basic sleep for flood limits
                  console.warn("[TelegramOutput] Rate limit hit. Sleeping for 2 seconds.");
                  await new Promise(r => setTimeout(r, 2000));
                  await this.bot.api.sendMessage(chatId, chunk);
              } else {
                  console.error("[TelegramOutput] Error sending chunk:", e);
                  // ErrorOutputStrategy
                  await this.bot.api.sendMessage(chatId, "⚠️ Erro crítico de formatação ou API no Output.");
              }
           }
       }
   }

   private chunkString(str: string, size: number): string[] {
       const chunks = [];
       let i = 0;
       while (i < str.length) {
           // Find the best split point (newline or space) near 'size'
           let slice = str.slice(i, i + size);
           if (i + size < str.length) {
               const lastNewline = slice.lastIndexOf('\n');
               if (lastNewline > 0) {
                   slice = slice.slice(0, lastNewline);
               } else {
                   const lastSpace = slice.lastIndexOf(' ');
                   if (lastSpace > 0) {
                       slice = slice.slice(0, lastSpace);
                   }
               }
           }
           chunks.push(slice);
           i += slice.length;
       }
       return chunks;
   }
}
