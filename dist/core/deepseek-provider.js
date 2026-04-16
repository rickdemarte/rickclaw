"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepSeekProvider = void 0;
const openai_compatible_provider_1 = require("./openai-compatible-provider");
const MODEL_TIERS = {
    light: 'deepseek-chat',
    default: 'deepseek-chat',
    heavy: 'deepseek-reasoner',
};
class DeepSeekProvider extends openai_compatible_provider_1.OpenAICompatibleProvider {
    providerName = 'deepseek';
    constructor(tier = 'default') {
        super({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com/v1' }, MODEL_TIERS, tier);
    }
}
exports.DeepSeekProvider = DeepSeekProvider;
//# sourceMappingURL=deepseek-provider.js.map