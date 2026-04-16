"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = void 0;
const openai_compatible_provider_1 = require("./openai-compatible-provider");
const MODEL_TIERS = {
    light: 'gpt-5.4-nano',
    default: 'gpt-5.4-mini',
    heavy: 'gpt-5.4',
};
class OpenAIProvider extends openai_compatible_provider_1.OpenAICompatibleProvider {
    providerName = 'openai';
    constructor(tier = 'default') {
        super({ apiKey: process.env.OPENAI_API_KEY }, MODEL_TIERS, tier);
    }
}
exports.OpenAIProvider = OpenAIProvider;
//# sourceMappingURL=openai-provider.js.map