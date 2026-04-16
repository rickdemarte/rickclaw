import { IProvider, ProviderResponse } from './provider-interface';
import { IMessage, ModelTier } from '../types';
import { BaseTool } from './tool-registry';
import OpenAI from 'openai';
/**
 * Base class for all OpenAI-compatible providers (OpenAI, DeepSeek, Groq, etc).
 * Subclasses only need to define MODEL_TIERS, providerName, and the OpenAI client config.
 */
export declare abstract class OpenAICompatibleProvider implements IProvider {
    protected ai: OpenAI;
    protected modelName: string;
    protected abstract readonly providerName: string;
    constructor(clientOptions: ConstructorParameters<typeof OpenAI>[0], tiers: Record<ModelTier, string>, tier?: ModelTier);
    generateResponse(systemPrompt: string, history: IMessage[], tools: BaseTool[]): Promise<ProviderResponse>;
}
//# sourceMappingURL=openai-compatible-provider.d.ts.map