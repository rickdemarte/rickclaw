import { IProvider, ProviderResponse } from './provider-interface';
import { IMessage, ModelTier } from '../types';
import { BaseTool } from './tool-registry';
export declare class GeminiProvider implements IProvider {
    private ai;
    private modelName;
    constructor(tier?: ModelTier);
    generateResponse(systemPrompt: string, history: IMessage[], tools: BaseTool[]): Promise<ProviderResponse>;
    /**
     * Ensures functionCall messages are always immediately followed by functionResponse messages.
     * Drops orphaned calls/responses that result from memory window truncation.
     */
    private sanitizeFunctionPairs;
}
//# sourceMappingURL=gemini-provider.d.ts.map