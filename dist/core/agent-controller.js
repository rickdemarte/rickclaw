"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentController = void 0;
const memory_manager_1 = require("../persistence/memory-manager");
const provider_factory_1 = require("./provider-factory");
const tool_registry_1 = require("./tool-registry");
const agent_loop_1 = require("./agent-loop");
const skill_loader_1 = require("../skills/skill-loader");
const skill_router_1 = require("../skills/skill-router");
const usage_tracker_1 = require("../services/usage-tracker");
const session_summarizer_1 = require("../services/session-summarizer");
const fs_tools_1 = require("./fs-tools");
const telegram_tool_1 = require("./telegram-tool");
const terminal_tool_1 = require("./terminal-tool");
const logger_1 = require("../utils/logger");
const file_cache_1 = require("../utils/file-cache");
const path_1 = __importDefault(require("path"));
class AgentController {
    memoryMgr;
    toolRegistry;
    skillLoader;
    usageTracker;
    contextDir = path_1.default.join(process.cwd(), 'context');
    contextCaches;
    cachedSystemPrompt = null;
    lastPromptBuild = 0;
    promptTtlMs = 60000; // 1 minute TTL for system prompt
    constructor() {
        this.memoryMgr = new memory_manager_1.MemoryManager();
        this.toolRegistry = new tool_registry_1.ToolRegistry();
        this.skillLoader = new skill_loader_1.SkillLoader();
        this.usageTracker = new usage_tracker_1.UsageTracker();
        this.contextCaches = [
            { label: 'PERSONALITY & RULES', cache: new file_cache_1.FileCache(path_1.default.join(this.contextDir, 'SOUL.md'), (raw) => raw.trim(), 300) },
            { label: 'USER PROFILE', cache: new file_cache_1.FileCache(path_1.default.join(this.contextDir, 'USER.md'), (raw) => raw.trim(), 300) },
            { label: 'SKILL SYSTEM INSTRUCTIONS', cache: new file_cache_1.FileCache(path_1.default.join(this.contextDir, 'SKILLS.md'), (raw) => raw.trim(), 300) },
            { label: 'PERSISTENT MEMORY', cache: new file_cache_1.FileCache(path_1.default.join(this.contextDir, 'MEMORY.md'), (raw) => raw.trim(), 60) },
        ];
        this.registerCoreTools();
    }
    registerCoreTools() {
        this.toolRegistry.register(new fs_tools_1.WriteFileTool());
        this.toolRegistry.register(new fs_tools_1.CreateDirTool());
        this.toolRegistry.register(new fs_tools_1.DeletePathTool());
        this.toolRegistry.register(new fs_tools_1.ReadFileTool());
        this.toolRegistry.register(new fs_tools_1.ListDirTool());
        this.toolRegistry.register(new telegram_tool_1.SendTelegramTool());
        this.toolRegistry.register(new terminal_tool_1.RunCommandTool());
    }
    /**
     * Loads context files (SOUL.md, USER.md, SKILLS.md, MEMORY.md) into the system prompt.
     * Uses mtime-based caching with TTL — re-reads only when the file changes or TTL expires.
     */
    buildSystemPrompt() {
        const now = Date.now();
        // Return cached prompt if still valid within TTL
        if (this.cachedSystemPrompt !== null && now - this.lastPromptBuild < this.promptTtlMs) {
            return this.cachedSystemPrompt;
        }
        const sections = [];
        for (const { label, cache } of this.contextCaches) {
            const content = cache.get();
            if (content) {
                sections.push(`[${label}]\n${content}`);
            }
        }
        if (sections.length === 0) {
            this.cachedSystemPrompt = 'You are RickClaw, an intelligent personal agent. You run locally on the user\'s desktop.';
        }
        else {
            this.cachedSystemPrompt = sections.join('\n\n---\n\n');
        }
        this.lastPromptBuild = now;
        return this.cachedSystemPrompt;
    }
    clearMemory(userId) {
        const providerName = process.env.DEFAULT_PROVIDER || 'gemini';
        this.memoryMgr.createNewSession(userId, providerName);
    }
    getHistory(userId) {
        return this.memoryMgr.getHistory(userId);
    }
    setSession(userId, sessionId) {
        const providerName = process.env.DEFAULT_PROVIDER || 'gemini';
        this.memoryMgr.setActiveSession(userId, sessionId, providerName);
        this.memoryMgr.addMessage({ conversation_id: sessionId, role: 'system', content: '[Session resumed]' });
    }
    getCostData() {
        return this.usageTracker.getCostData();
    }
    /**
     * Main entrypoint for dealing with incoming user messages
     */
    async handleUserMessage(userId, input) {
        const providerName = process.env.DEFAULT_PROVIDER || 'gemini';
        // Memory fetch
        const conversation = this.memoryMgr.getOrCreateActiveConversation(userId, providerName);
        const contextLimitMsgs = this.memoryMgr.getConversationHistoryContext(conversation.id);
        // Build system prompt from context files (SOUL.md, USER.md, SKILLS.md, MEMORY.md)
        let currentSystemPrompt = this.buildSystemPrompt();
        // Route intent + classify complexity
        const availableSkills = this.skillLoader.loadAllSkillsMeta();
        const isFollowUp = contextLimitMsgs.length > 0;
        const wordCount = input.trim().split(/\s+/).length;
        let routing;
        // Skip LLM router for short follow-ups in active conversations (saves latency + cost)
        if (isFollowUp && wordCount < 15 && !input.trim().startsWith('/')) {
            routing = { type: 'general', complexity: 'default' };
            logger_1.logger.info('[AgentController] Follow-up detected, skipping LLM router.');
        }
        else {
            const routerProvider = provider_factory_1.ProviderFactory.getProvider(providerName, 'light');
            const router = new skill_router_1.SkillRouter(routerProvider);
            logger_1.logger.info('[AgentController] Routing intent + classifying complexity...');
            routing = await router.route(input, availableSkills);
        }
        logger_1.logger.info(`[AgentController] Routing: type=${routing.type}, complexity=${'complexity' in routing ? routing.complexity : 'default'}${routing.value ? `, value=${routing.value}` : ''}`);
        if ('routerUsage' in routing && routing.routerUsage) {
            this.usageTracker.record(routing.routerUsage, conversation.id, 'light', 'router');
        }
        // Handle Slash Commands (Manual Routing)
        if (routing.type === 'command') {
            const fullCmd = routing.value || '';
            const [cmd, arg] = fullCmd.split(' ');
            if (cmd === '/new') {
                this.clearMemory(userId);
                return "✨ **Nova sessão iniciada.** O histórico anterior foi arquivado e agora temos uma timeline limpa.";
            }
            if (cmd === '/session' || cmd === '/sessions') {
                if (arg) {
                    // Switch session
                    this.setSession(userId, arg);
                    return `🔄 **Sessão alterada para:** \`${arg}\``;
                }
                else {
                    // List sessions
                    const history = this.memoryMgr.getHistory(userId);
                    const uniqueSessions = history.map(h => h.id);
                    const currentId = conversation.id;
                    let list = "📂 **Suas sessões recentes:**\n\n";
                    uniqueSessions.slice(0, 5).forEach(id => {
                        const label = (id === currentId) ? `➡️ **${id} (Atual)**` : `▫️ \`/session ${id}\``;
                        list += `- ${label}\n`;
                    });
                    return list;
                }
            }
            if (cmd === '/history') {
                const history = this.memoryMgr.getHistory(userId);
                const count = history.length;
                return `📜 **Histórico da Sessão:**\n\nEsta conversa (\`${conversation.id}\`) possui **${count}** mensagens registradas no banco de dados SQLite.`;
            }
            if (cmd === '/costs') {
                return this.usageTracker.formatCostReport();
            }
            return "Comando não reconhecido ou em desenvolvimento.";
        }
        if (routing.type === 'static') {
            // Smalltalk dictionary hit — no LLM needed
            this.memoryMgr.addMessage({ conversation_id: conversation.id, role: 'user', content: input });
            this.memoryMgr.addMessage({ conversation_id: conversation.id, role: 'assistant', content: routing.value });
            return routing.value;
        }
        if (routing.type === 'skill' && routing.value) {
            // Load specific skill into context
            logger_1.logger.info(`[AgentController] Intent matched skill: ${routing.value}`);
            const specificContent = this.skillLoader.getSkillContent(routing.value);
            if (specificContent) {
                currentSystemPrompt += `\n\n[ACTIVE SKILL INSTRUCTIONS]\n${specificContent}`;
            }
        }
        // Injeta ata da sessao e conceitos-chave no prompt (se existirem)
        const summaryData = this.memoryMgr.getSummaryData(conversation.id);
        if (summaryData?.session_keywords) {
            currentSystemPrompt += `\n\n[SESSION KEYWORDS]\n${summaryData.session_keywords}`;
        }
        if (summaryData?.session_summary) {
            currentSystemPrompt += `\n\n[SESSION SUMMARY]\n${summaryData.session_summary}`;
        }
        // Select provider based on assessed complexity
        const provider = provider_factory_1.ProviderFactory.getProvider(providerName, routing.complexity);
        logger_1.logger.info(`[AgentController] Using provider: ${providerName} (tier: ${routing.complexity})`);
        // Execute the reasoning loop
        const loop = new agent_loop_1.AgentLoop(provider, this.toolRegistry, this.usageTracker, routing.complexity);
        const producedContext = await loop.run(currentSystemPrompt, contextLimitMsgs, input, conversation.id);
        // Process new messages since loop start to persist them (Selective Memory Filter)
        const newItems = producedContext.slice(contextLimitMsgs.length);
        for (const item of newItems) {
            // PERSISTENCE FILTER: Only save User messages and Assistant's FINAL answers
            // Avoid saving internal tool calls/results to prevent "hallucination residues"
            const isUser = item.role === 'user';
            const isFinalAssistant = item.role === 'assistant' && !item.tool_call_id && !item.name;
            if (isUser || isFinalAssistant) {
                this.memoryMgr.addMessage(item);
            }
        }
        // Attempt to extract final assistant text
        const lastMsg = producedContext[producedContext.length - 1];
        const finalAnswer = (lastMsg && lastMsg.role === 'assistant') ? lastMsg.content : "No final answer generated.";
        // Dispara sumarizacao em background (nao bloqueia a resposta ao usuario)
        this.trySummarize(conversation.id, providerName).catch(err => logger_1.logger.error(`[AgentController] Erro na sumarizacao em background: ${err.message}`));
        return finalAnswer;
    }
    /**
     * Verifica se e hora de atualizar a ata da sessao.
     * Roda em background apos cada resposta — sem impacto na latencia.
     */
    async trySummarize(conversationId, providerName) {
        const summaryData = this.memoryMgr.getSummaryData(conversationId);
        const lastSummarizedCount = summaryData?.summary_msg_count ?? 0;
        const currentCount = this.memoryMgr.countUserMessages(conversationId);
        const summarizerProvider = provider_factory_1.ProviderFactory.getProvider(providerName, 'light');
        const summarizer = new session_summarizer_1.SessionSummarizer(summarizerProvider);
        if (!summarizer.shouldSummarize(currentCount, lastSummarizedCount)) {
            return;
        }
        logger_1.logger.info(`[AgentController] Atualizando ata da sessao (${currentCount} msgs usuario, ultima ata em ${lastSummarizedCount})...`);
        // Pega as mensagens recentes (todas da conversa, para contexto completo da janela)
        const recentMsgs = this.memoryMgr.getConversationHistoryContext(conversationId);
        let result = await summarizer.summarize(summaryData?.session_summary ?? null, summaryData?.session_keywords ?? null, recentMsgs);
        // Condensa se a ata ficou muito grande
        result = await summarizer.condense(result.summary, result.keywords);
        this.memoryMgr.updateSummary(conversationId, result.summary, result.keywords, currentCount);
        logger_1.logger.info(`[AgentController] Ata atualizada. Summary: ${result.summary.length} chars, Keywords: ${result.keywords.length} chars.`);
    }
}
exports.AgentController = AgentController;
//# sourceMappingURL=agent-controller.js.map