import dotenv from 'dotenv';
// Load .env vars
dotenv.config();

import { TelegramInputHandler } from './interfaces/telegram-input-handler';
import { WebChatAPI } from './interfaces/webchat-api';
import { AgentController } from './core/agent-controller';
import { logger } from './utils/logger';
import { DbConnection } from './persistence/database';
import path from 'path';
import fs from 'fs';
import http from 'http';

// References kept at module level for graceful shutdown
let httpServer: http.Server | null = null;
let telegramHandler: TelegramInputHandler | null = null;

async function bootstrap() {
   logger.info("=== Starting RickClaw Agent === ");

   // 1. Initialize SQLite Database and acquire the application lock.
   // DbConnection is the single source of truth for lockfile behavior.
   DbConnection.getInstance();

   // Clean up stale temp files from previous runs.
   const tmpDir = path.join(process.cwd(), 'tmp');
   if (fs.existsSync(tmpDir)) {
      const staleFiles = fs.readdirSync(tmpDir).filter(f => !f.startsWith('.'));
      if (staleFiles.length > 0) {
         for (const f of staleFiles) {
            try { fs.unlinkSync(path.join(tmpDir, f)); } catch { /* ignore */ }
         }
         logger.info(`[Bootstrap] Cleaned ${staleFiles.length} stale temp file(s).`);
      }
   }

   // 2. Initialize Core Logic / Controllers
   const controller = new AgentController();

   // 3. Initialize External Interfaces
   const webApi = new WebChatAPI(controller);

   try {
     telegramHandler = new TelegramInputHandler(controller);
     webApi.setTelegramHandler(telegramHandler);
     telegramHandler.startPolling().catch(err => {
         logger.error("[Bootstrap] Telegram failed to start:", err);
     });
   } catch (e: any) {
     logger.error("[Bootstrap] Proceeding without Telegram:", e.message);
   }

   // Optional web server start
   try {
     httpServer = webApi.start();
   } catch(e: any) {
     logger.error("[Bootstrap] WebAPI failed to start:", e.message);
   }
}

async function shutdown(signal: string) {
   logger.info(`[Shutdown] Received ${signal}. Draining connections...`);

   // 1. Stop accepting new Telegram updates
   if (telegramHandler) {
      try {
         await telegramHandler.stop();
         logger.info('[Shutdown] Telegram bot stopped.');
      } catch (e: any) {
         logger.error(`[Shutdown] Telegram stop error: ${e.message}`);
      }
   }

   // 2. Close HTTP server (stops accepting new connections, waits for in-flight)
   if (httpServer) {
      await new Promise<void>((resolve) => {
         httpServer!.close(() => {
            logger.info('[Shutdown] HTTP server closed.');
            resolve();
         });
         // Force-close after 5s if connections linger
         setTimeout(() => {
            logger.warn('[Shutdown] Forcing HTTP server close after timeout.');
            resolve();
         }, 5000);
      });
   }

   // 3. Close DB and remove lock file
   DbConnection.cleanup();
   logger.info('[Shutdown] Graceful shutdown complete.');
   process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

bootstrap().catch(err => {
    logger.error("[Fatal Error]", err);
    process.exit(1);
});
