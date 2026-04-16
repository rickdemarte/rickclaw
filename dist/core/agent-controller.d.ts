export declare class AgentController {
    private memoryMgr;
    private toolRegistry;
    private skillLoader;
    private usageTracker;
    private readonly contextDir;
    private contextCaches;
    private cachedSystemPrompt;
    private lastPromptBuild;
    private readonly promptTtlMs;
    constructor();
    private registerCoreTools;
    /**
     * Loads context files (SOUL.md, USER.md, SKILLS.md, MEMORY.md) into the system prompt.
     * Uses mtime-based caching with TTL — re-reads only when the file changes or TTL expires.
     */
    private buildSystemPrompt;
    clearMemory(userId: string): void;
    getHistory(userId: string): import("../types").IConversation[];
    setSession(userId: string, sessionId: string): void;
    getCostData(): {
        todayUsd: number;
        monthUsd: number;
        iterationsToday: number;
        rate: number;
        details: {
            provider: string;
            total_cost: number;
            source: string;
        }[];
    };
    /**
     * Main entrypoint for dealing with incoming user messages
     */
    handleUserMessage(userId: string, input: string): Promise<string>;
    /**
     * Verifica se e hora de atualizar a ata da sessao.
     * Roda em background apos cada resposta — sem impacto na latencia.
     */
    private trySummarize;
}
//# sourceMappingURL=agent-controller.d.ts.map