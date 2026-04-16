import { IProvider, ProviderResponse } from './provider-interface';
import { IMessage, ModelTier } from '../types';
import { BaseTool } from './tool-registry';
export declare class GroqProvider implements IProvider {
    private ai;
    private modelName;
    private readonly providerName;
    constructor(tier?: ModelTier);
    generateResponse(systemPrompt: string, history: IMessage[], tools: BaseTool[]): Promise<ProviderResponse>;
    private extractErrorMessage;
    private extractFallbackToolCall;
    private parseFallbackArgs;
}
//# sourceMappingURL=groq-provider.d.ts.map