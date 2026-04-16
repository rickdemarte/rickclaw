import { AgentController } from '../core/agent-controller';
export declare class TelegramInputHandler {
    private controller;
    private bot;
    private allowedUsers;
    private outputHandler;
    private audioService;
    constructor(controller: AgentController);
    private setupMiddlewares;
    private setupHandlers;
    startPolling(): Promise<void>;
    isRunning(): boolean;
    stop(): Promise<void>;
}
//# sourceMappingURL=telegram-input-handler.d.ts.map