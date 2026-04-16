"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// Load .env vars
dotenv_1.default.config();
const telegram_input_handler_1 = require("./interfaces/telegram-input-handler");
const webchat_api_1 = require("./interfaces/webchat-api");
const agent_controller_1 = require("./core/agent-controller");
const logger_1 = require("./utils/logger");
const database_1 = require("./persistence/database");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// References kept at module level for graceful shutdown
let httpServer = null;
let telegramHandler = null;
async function bootstrap() {
    logger_1.logger.info("=== Starting RickClaw Agent === ");
    // 1. Initialize SQLite Database and acquire the application lock.
    // DbConnection is the single source of truth for lockfile behavior.
    database_1.DbConnection.getInstance();
    // Clean up stale temp files from previous runs.
    const tmpDir = path_1.default.join(process.cwd(), 'tmp');
    if (fs_1.default.existsSync(tmpDir)) {
        const staleFiles = fs_1.default.readdirSync(tmpDir).filter(f => !f.startsWith('.'));
        if (staleFiles.length > 0) {
            for (const f of staleFiles) {
                try {
                    fs_1.default.unlinkSync(path_1.default.join(tmpDir, f));
                }
                catch { /* ignore */ }
            }
            logger_1.logger.info(`[Bootstrap] Cleaned ${staleFiles.length} stale temp file(s).`);
        }
    }
    // 2. Initialize Core Logic / Controllers
    const controller = new agent_controller_1.AgentController();
    // 3. Initialize External Interfaces
    const webApi = new webchat_api_1.WebChatAPI(controller);
    try {
        telegramHandler = new telegram_input_handler_1.TelegramInputHandler(controller);
        webApi.setTelegramHandler(telegramHandler);
        telegramHandler.startPolling().catch(err => {
            logger_1.logger.error("[Bootstrap] Telegram failed to start:", err);
        });
    }
    catch (e) {
        logger_1.logger.error("[Bootstrap] Proceeding without Telegram:", e.message);
    }
    // Optional web server start
    try {
        httpServer = webApi.start();
    }
    catch (e) {
        logger_1.logger.error("[Bootstrap] WebAPI failed to start:", e.message);
    }
}
async function shutdown(signal) {
    logger_1.logger.info(`[Shutdown] Received ${signal}. Draining connections...`);
    // 1. Stop accepting new Telegram updates
    if (telegramHandler) {
        try {
            await telegramHandler.stop();
            logger_1.logger.info('[Shutdown] Telegram bot stopped.');
        }
        catch (e) {
            logger_1.logger.error(`[Shutdown] Telegram stop error: ${e.message}`);
        }
    }
    // 2. Close HTTP server (stops accepting new connections, waits for in-flight)
    if (httpServer) {
        await new Promise((resolve) => {
            httpServer.close(() => {
                logger_1.logger.info('[Shutdown] HTTP server closed.');
                resolve();
            });
            // Force-close after 5s if connections linger
            setTimeout(() => {
                logger_1.logger.warn('[Shutdown] Forcing HTTP server close after timeout.');
                resolve();
            }, 5000);
        });
    }
    // 3. Close DB and remove lock file
    database_1.DbConnection.cleanup();
    logger_1.logger.info('[Shutdown] Graceful shutdown complete.');
    process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
bootstrap().catch(err => {
    logger_1.logger.error("[Fatal Error]", err);
    process.exit(1);
});
//# sourceMappingURL=app.js.map