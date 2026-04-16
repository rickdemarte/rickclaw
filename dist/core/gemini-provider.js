"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiProvider = void 0;
const genai_1 = require("@google/genai");
const crypto_1 = __importDefault(require("crypto"));
const MODEL_TIERS = {
    light: 'gemini-2.5-flash-lite',
    default: 'gemini-2.5-flash',
    heavy: 'gemini-2.5-pro',
};
class GeminiProvider {
    ai;
    modelName;
    constructor(tier = 'default') {
        this.ai = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        this.modelName = MODEL_TIERS[tier];
    }
    async generateResponse(systemPrompt, history, tools) {
        // Map internal history formats to Gemini Context Format
        const rawContents = history.map(msg => {
            if (msg.role === 'tool') {
                return {
                    role: 'function',
                    parts: [{ functionResponse: { name: msg.name, response: { result: msg.content } } }]
                };
            }
            else if (msg.role === 'assistant' && msg.tool_call_id) {
                return {
                    role: 'model',
                    parts: [{ functionCall: { name: msg.name, args: JSON.parse(msg.content || '{}') } }]
                };
            }
            else {
                return {
                    role: msg.role === 'assistant' || msg.role === 'system' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                };
            }
        });
        // Sanitize: Gemini requires functionCall to be immediately followed by functionResponse.
        const contents = this.sanitizeFunctionPairs(rawContents);
        // Map internal tools Array to Gemini Types Tool Definitions
        const geminiTools = tools.length > 0 ? [{
                functionDeclarations: tools.map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters
                }))
            }] : undefined;
        try {
            const response = await this.ai.models.generateContent({
                model: this.modelName,
                contents: contents,
                config: {
                    systemInstruction: systemPrompt,
                    tools: geminiTools
                }
            });
            const functionCalls = response.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
                return {
                    toolCalls: functionCalls.map(call => ({
                        id: crypto_1.default.randomUUID(),
                        name: call.name || '',
                        args: call.args || {}
                    })),
                    usage: response.usageMetadata ? {
                        promptTokens: response.usageMetadata.promptTokenCount || 0,
                        completionTokens: response.usageMetadata.candidatesTokenCount || 0,
                        totalTokens: response.usageMetadata.totalTokenCount || 0,
                        model: this.modelName,
                        provider: 'gemini'
                    } : undefined
                };
            }
            return {
                text: response.text,
                usage: response.usageMetadata ? {
                    promptTokens: response.usageMetadata.promptTokenCount || 0,
                    completionTokens: response.usageMetadata.candidatesTokenCount || 0,
                    totalTokens: response.usageMetadata.totalTokenCount || 0,
                    model: this.modelName,
                    provider: 'gemini'
                } : undefined
            };
        }
        catch (err) {
            console.error(`[GeminiProvider/${this.modelName}] Error:`, err);
            throw new Error(`Integration error via Gemini: ${err.message}`);
        }
    }
    /**
     * Ensures functionCall messages are always immediately followed by functionResponse messages.
     * Drops orphaned calls/responses that result from memory window truncation.
     */
    sanitizeFunctionPairs(contents) {
        const sanitized = [];
        for (let i = 0; i < contents.length; i++) {
            const item = contents[i];
            const isFnCall = item.parts?.some((p) => p.functionCall);
            const isFnResponse = item.parts?.some((p) => p.functionResponse);
            if (isFnCall) {
                const next = contents[i + 1];
                if (next && next.parts?.some((p) => p.functionResponse)) {
                    sanitized.push(item);
                }
            }
            else if (isFnResponse) {
                const prev = sanitized[sanitized.length - 1];
                if (prev && prev.parts?.some((p) => p.functionCall)) {
                    sanitized.push(item);
                }
            }
            else {
                sanitized.push(item);
            }
        }
        return sanitized;
    }
}
exports.GeminiProvider = GeminiProvider;
//# sourceMappingURL=gemini-provider.js.map