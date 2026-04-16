"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAICompatibleProvider = void 0;
const openai_1 = __importDefault(require("openai"));
/**
 * Base class for all OpenAI-compatible providers (OpenAI, DeepSeek, Groq, etc).
 * Subclasses only need to define MODEL_TIERS, providerName, and the OpenAI client config.
 */
class OpenAICompatibleProvider {
    ai;
    modelName;
    constructor(clientOptions, tiers, tier = 'default') {
        this.ai = new openai_1.default(clientOptions);
        this.modelName = tiers[tier];
    }
    async generateResponse(systemPrompt, history, tools) {
        const mappedHistory = [{ role: 'system', content: systemPrompt }];
        for (const msg of history) {
            if (msg.role === 'tool') {
                mappedHistory.push({
                    role: 'tool',
                    tool_call_id: msg.tool_call_id,
                    content: msg.content,
                    name: msg.name
                });
            }
            else if (msg.role === 'assistant' && msg.tool_call_id) {
                mappedHistory.push({
                    role: 'assistant',
                    content: null,
                    tool_calls: [{
                            id: msg.tool_call_id,
                            type: 'function',
                            function: {
                                name: msg.name,
                                arguments: msg.content
                            }
                        }]
                });
            }
            else {
                mappedHistory.push({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content
                });
            }
        }
        const openAITools = tools.map(t => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters
            }
        }));
        try {
            const response = await this.ai.chat.completions.create({
                model: this.modelName,
                messages: mappedHistory,
                tools: openAITools.length > 0 ? openAITools : undefined
            });
            const choice = response.choices[0];
            if (!choice)
                throw new Error(`No choices returned from ${this.providerName}`);
            const msg = choice.message;
            const usage = response.usage ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens || 0,
                totalTokens: response.usage.total_tokens,
                model: this.modelName,
                provider: this.providerName
            } : undefined;
            if (msg.tool_calls && msg.tool_calls.length > 0) {
                return {
                    toolCalls: msg.tool_calls.map(tc => {
                        const fn = 'function' in tc ? tc.function : tc;
                        return {
                            id: tc.id,
                            name: fn.name,
                            args: JSON.parse(fn.arguments || '{}')
                        };
                    }),
                    usage
                };
            }
            return { text: msg.content || "", usage };
        }
        catch (err) {
            console.error(`[${this.providerName}/${this.modelName}] Error:`, err);
            throw new Error(`${this.providerName} Provider error: ${err.message}`);
        }
    }
}
exports.OpenAICompatibleProvider = OpenAICompatibleProvider;
//# sourceMappingURL=openai-compatible-provider.js.map