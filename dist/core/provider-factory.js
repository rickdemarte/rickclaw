"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderFactory = void 0;
const gemini_provider_1 = require("./gemini-provider");
const openai_provider_1 = require("./openai-provider");
const deepseek_provider_1 = require("./deepseek-provider");
const groq_provider_1 = require("./groq-provider");
class ProviderFactory {
    /** Returns configuration status for all known providers (API key present or not). */
    static getProvidersStatus() {
        return [
            { name: 'gemini', configured: !!process.env.GEMINI_API_KEY },
            { name: 'openai', configured: !!process.env.OPENAI_API_KEY },
            { name: 'deepseek', configured: !!process.env.DEEPSEEK_API_KEY },
            { name: 'groq', configured: !!process.env.GROQ_API_KEY },
        ];
    }
    static getProvider(name, tier = 'default') {
        switch (name.toLowerCase()) {
            case 'gemini':
                return new gemini_provider_1.GeminiProvider(tier);
            case 'openai':
                return new openai_provider_1.OpenAIProvider(tier);
            case 'deepseek':
                return new deepseek_provider_1.DeepSeekProvider(tier);
            case 'groq':
                return new groq_provider_1.GroqProvider(tier);
            default:
                console.warn(`[ProviderFactory] Unknown provider '${name}', falling back to Gemini`);
                return new gemini_provider_1.GeminiProvider(tier);
        }
    }
}
exports.ProviderFactory = ProviderFactory;
//# sourceMappingURL=provider-factory.js.map