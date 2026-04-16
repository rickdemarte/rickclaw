"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentLoop = void 0;
const logger_1 = require("../utils/logger");
class AgentLoop {
    provider;
    toolRegistry;
    usageTracker;
    tier;
    maxIterations;
    constructor(provider, toolRegistry, usageTracker, tier) {
        this.provider = provider;
        this.toolRegistry = toolRegistry;
        this.usageTracker = usageTracker;
        this.tier = tier;
        this.maxIterations = parseInt(process.env.MAX_ITERATIONS || '5', 10);
    }
    /**
     * Runs the ReAct loop until a final answer is reached or max loops are exhausted.
     */
    async run(systemPrompt, memoryContext, newUserInput, conversationId) {
        logger_1.logger.info('[AgentLoop] Starting ReAct iteration block');
        // Optimize: avoid cloning entire array upfront, build incrementally
        const currentContext = [];
        // Copy existing context efficiently
        for (let i = 0; i < memoryContext.length; i++) {
            const msg = memoryContext[i];
            if (msg)
                currentContext.push(msg);
        }
        // Append the current fresh input
        currentContext.push({
            conversation_id: conversationId,
            role: 'user',
            content: newUserInput
        });
        let iterations = 0;
        while (iterations < this.maxIterations) {
            iterations++;
            logger_1.logger.info(`[AgentLoop] Iteration ${iterations}/${this.maxIterations}`);
            try {
                if (process.env.LOG_PROMPTS === 'true') {
                    logger_1.promptLogger.info(`[ITERATION ${iterations}] SYSTEM PROMPT:\n${systemPrompt}`);
                    logger_1.promptLogger.info(`[ITERATION ${iterations}] CONTEXT:\n${JSON.stringify(currentContext, null, 2)}`);
                }
                const response = await this.provider.generateResponse(systemPrompt, currentContext, this.toolRegistry.getAll());
                if (response.usage) {
                    this.usageTracker.record(response.usage, conversationId, this.tier, 'agent_loop');
                }
                if (response.toolCalls && response.toolCalls.length > 0) {
                    // Model wants to use tool(s)
                    logger_1.logger.info(`[AgentLoop] LLM requested Tools: ${response.toolCalls.map(tc => tc.name).join(', ')}`);
                    for (const tc of response.toolCalls) {
                        // Record the LLM's thought/call
                        currentContext.push({
                            conversation_id: conversationId,
                            role: 'assistant',
                            content: JSON.stringify(tc.args),
                            tool_call_id: tc.id,
                            name: tc.name
                        });
                        const tool = this.toolRegistry.getTool(tc.name);
                        let observationData = '';
                        if (!tool) {
                            observationData = `{"error": "Tool not found or not active: ${tc.name}"}`;
                        }
                        else {
                            try {
                                observationData = await tool.execute(tc.args);
                            }
                            catch (err) {
                                observationData = `{"error": "Failed to execute ${tc.name}: ${err.message}"}`;
                                logger_1.logger.error(`[AgentLoop] Tool Exception in ${tc.name}: ${err.message}`);
                            }
                        }
                        // Push the Tool's observation/result
                        currentContext.push({
                            conversation_id: conversationId,
                            role: 'tool',
                            content: observationData,
                            tool_call_id: tc.id,
                            name: tc.name
                        });
                    }
                }
                else if (response.text) {
                    // We have a final Answer
                    logger_1.logger.info('[AgentLoop] Received Final Answer');
                    currentContext.push({
                        conversation_id: conversationId,
                        role: 'assistant',
                        content: response.text
                    });
                    break; // Exit the loop happily
                }
                else {
                    // Edge-case: No text, no tool call
                    currentContext.push({
                        conversation_id: conversationId,
                        role: 'assistant',
                        content: "Sorry, I encountered an empty internal state and couldn't process."
                    });
                    break;
                }
            }
            catch (e) {
                const errorMsg = e.message || String(e);
                logger_1.logger.error(`[AgentLoop] Provider failure: ${errorMsg}`);
                // Recoverable: LLM tried to call a non-existent tool (e.g. a skill name)
                if (errorMsg.includes('tool_use_failed') || errorMsg.includes('not in request.tools')) {
                    logger_1.logger.warn('[AgentLoop] LLM tried to call a non-tool. Injecting correction and retrying...');
                    const availableTools = this.toolRegistry.getAll().map(t => t.name).join(', ');
                    currentContext.push({
                        conversation_id: conversationId,
                        role: 'user',
                        content: `[SYSTEM] You tried to call a function that does not exist. Skills are NOT callable tools. The ONLY tools you can call are: ${availableTools}. Respond to the user using your knowledge and the skill instructions in your context.`
                    });
                    continue; // Retry the iteration
                }
                // Fatal error — break
                currentContext.push({
                    conversation_id: conversationId,
                    role: 'assistant',
                    content: "Estou com dificuldade para conectar ao provedor de raciocínio. Tente novamente."
                });
                break;
            }
        }
        if (iterations >= this.maxIterations) {
            logger_1.logger.warn(`[AgentLoop] Exhausted MAX_ITERATIONS (${this.maxIterations})`);
            // Collect what tools were successfully executed
            const toolsUsed = currentContext
                .filter(m => m.role === 'tool')
                .map(m => m.name)
                .filter(Boolean);
            const summary = toolsUsed.length > 0
                ? `Atingi o limite de iterações (${this.maxIterations}), mas executei as seguintes ações: ${[...new Set(toolsUsed)].join(', ')}. Pode pedir pra continuar de onde parei.`
                : `Atingi o limite de iterações (${this.maxIterations}) sem conseguir finalizar. Tente simplificar o pedido.`;
            currentContext.push({
                conversation_id: conversationId,
                role: 'assistant',
                content: summary
            });
        }
        return currentContext;
    }
}
exports.AgentLoop = AgentLoop;
//# sourceMappingURL=agent-loop.js.map