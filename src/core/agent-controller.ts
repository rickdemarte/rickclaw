import { MemoryManager } from '../persistence/memory-manager';
import { ProviderFactory } from './provider-factory';
import { ToolRegistry } from './tool-registry';
import { AgentLoop } from './agent-loop';
import { SkillLoader } from '../skills/skill-loader';
import { SkillRouter } from '../skills/skill-router';
import { UsageTracker } from '../services/usage-tracker';
import { SessionSummarizer } from '../services/session-summarizer';
import { WriteFileTool, CreateDirTool, DeletePathTool, ReadFileTool, ListDirTool } from './fs-tools';
import { SendTelegramTool } from './telegram-tool';
import { RunCommandTool } from './terminal-tool';
import { logger } from '../utils/logger';
import { FileCache } from '../utils/file-cache';
import path from 'path';

export class AgentController {
   private memoryMgr: MemoryManager;
   private toolRegistry: ToolRegistry;
   private skillLoader: SkillLoader;
   private usageTracker: UsageTracker;
   private readonly contextDir = path.join(process.cwd(), 'context');
   private contextCaches: { label: string; cache: FileCache<string> }[];

   constructor() {
      this.memoryMgr = new MemoryManager();
      this.toolRegistry = new ToolRegistry();
      this.skillLoader = new SkillLoader();
      this.usageTracker = new UsageTracker();

      this.contextCaches = [
         { label: 'PERSONALITY & RULES',      cache: new FileCache(path.join(this.contextDir, 'SOUL.md'),   (raw) => raw.trim()) },
         { label: 'USER PROFILE',             cache: new FileCache(path.join(this.contextDir, 'USER.md'),   (raw) => raw.trim()) },
         { label: 'SKILL SYSTEM INSTRUCTIONS', cache: new FileCache(path.join(this.contextDir, 'SKILLS.md'), (raw) => raw.trim()) },
         { label: 'PERSISTENT MEMORY',         cache: new FileCache(path.join(this.contextDir, 'MEMORY.md'), (raw) => raw.trim()) },
      ];

      this.registerCoreTools();
   }

   private registerCoreTools() {
      this.toolRegistry.register(new WriteFileTool());
      this.toolRegistry.register(new CreateDirTool());
      this.toolRegistry.register(new DeletePathTool());
      this.toolRegistry.register(new ReadFileTool());
      this.toolRegistry.register(new ListDirTool());
      this.toolRegistry.register(new SendTelegramTool());
      this.toolRegistry.register(new RunCommandTool());
   }

   /**
    * Loads context files (SOUL.md, USER.md, SKILLS.md, MEMORY.md) into the system prompt.
    * Uses mtime-based caching — re-reads only when the file changes on disk.
    */
   private buildSystemPrompt(): string {
      const sections: string[] = [];

      for (const { label, cache } of this.contextCaches) {
         const content = cache.get();
         if (content) {
            sections.push(`[${label}]\n${content}`);
         }
      }

      if (sections.length === 0) {
         return 'You are RickClaw, an intelligent personal agent. You run locally on the user\'s desktop.';
      }

      return sections.join('\n\n---\n\n');
   }

   public clearMemory(userId: string) {
      const providerName = process.env.DEFAULT_PROVIDER || 'gemini';
      this.memoryMgr.createNewSession(userId, providerName);
   }

   public getHistory(userId: string) {
      return this.memoryMgr.getHistory(userId);
   }

   public setSession(userId: string, sessionId: string) {
      const providerName = process.env.DEFAULT_PROVIDER || 'gemini';
      this.memoryMgr.setActiveSession(userId, sessionId, providerName);
      this.memoryMgr.addMessage({ conversation_id: sessionId, role: 'system', content: '[Session resumed]' });
   }

   public getCostData() {
      return this.usageTracker.getCostData();
   }

   /**
    * Main entrypoint for dealing with incoming user messages
    */
   public async handleUserMessage(userId: string, input: string): Promise<string> {
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
         routing = { type: 'general' as const, complexity: 'default' as const };
         logger.info('[AgentController] Follow-up detected, skipping LLM router.');
      } else {
         const routerProvider = ProviderFactory.getProvider(providerName, 'light');
         const router = new SkillRouter(routerProvider);
         logger.info('[AgentController] Routing intent + classifying complexity...');
         routing = await router.route(input, availableSkills);
      }
      logger.info(`[AgentController] Routing: type=${routing.type}, complexity=${'complexity' in routing ? routing.complexity : 'default'}${routing.value ? `, value=${routing.value}` : ''}`);

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
            } else {
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
         this.memoryMgr.addMessage({ conversation_id: conversation.id, role: 'assistant', content: routing.value! });
         return routing.value!;
      }

      if (routing.type === 'skill' && routing.value) {
         // Load specific skill into context
         logger.info(`[AgentController] Intent matched skill: ${routing.value}`);
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
      const provider = ProviderFactory.getProvider(providerName, routing.complexity);
      logger.info(`[AgentController] Using provider: ${providerName} (tier: ${routing.complexity})`);

      // Execute the reasoning loop
      const loop = new AgentLoop(provider, this.toolRegistry, this.usageTracker, routing.complexity);
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
      this.trySummarize(conversation.id, providerName).catch(err =>
        logger.error(`[AgentController] Erro na sumarizacao em background: ${err.message}`)
      );

      return finalAnswer;
   }

   /**
    * Verifica se e hora de atualizar a ata da sessao.
    * Roda em background apos cada resposta — sem impacto na latencia.
    */
   private async trySummarize(conversationId: string, providerName: string): Promise<void> {
      const summaryData = this.memoryMgr.getSummaryData(conversationId);
      const lastSummarizedCount = summaryData?.summary_msg_count ?? 0;
      const currentCount = this.memoryMgr.countUserMessages(conversationId);

      const summarizerProvider = ProviderFactory.getProvider(providerName, 'light');
      const summarizer = new SessionSummarizer(summarizerProvider);

      if (!summarizer.shouldSummarize(currentCount, lastSummarizedCount)) {
        return;
      }

      logger.info(`[AgentController] Atualizando ata da sessao (${currentCount} msgs usuario, ultima ata em ${lastSummarizedCount})...`);

      // Pega as mensagens recentes (todas da conversa, para contexto completo da janela)
      const recentMsgs = this.memoryMgr.getConversationHistoryContext(conversationId);

      let result = await summarizer.summarize(
        summaryData?.session_summary ?? null,
        summaryData?.session_keywords ?? null,
        recentMsgs
      );

      // Condensa se a ata ficou muito grande
      result = await summarizer.condense(result.summary, result.keywords);

      this.memoryMgr.updateSummary(conversationId, result.summary, result.keywords, currentCount);
      logger.info(`[AgentController] Ata atualizada. Summary: ${result.summary.length} chars, Keywords: ${result.keywords.length} chars.`);
   }
}
