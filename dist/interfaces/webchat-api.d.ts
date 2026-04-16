import { AgentController } from '../core/agent-controller';
import type { TelegramInputHandler } from './telegram-input-handler';
export declare class WebChatAPI {
    private controller;
    private app;
    private userRepo;
    /**
     * JWT secret key for signing/verifying tokens.
     * Generated fresh per process if no env var is set — this means tokens
     * invalidate on restart (acceptable for a local personal agent).
     * Set JWT_SECRET in .env for persistent sessions across restarts.
     */
    private jwtSecret;
    private telegramHandler;
    constructor(controller: AgentController);
    /**
     * Extracts and verifies the JWT from the Authorization header.
     * Returns the decoded payload or null if invalid/missing.
     */
    private verifyToken;
    setTelegramHandler(handler: TelegramInputHandler): void;
    private setupRoutes;
    start(): import('http').Server;
}
//# sourceMappingURL=webchat-api.d.ts.map