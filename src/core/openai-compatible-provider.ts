import { IProvider, ProviderResponse } from './provider-interface';
import { IMessage, ModelTier } from '../types';
import { BaseTool } from './tool-registry';
import OpenAI from 'openai';

/**
 * Base class for all OpenAI-compatible providers (OpenAI, DeepSeek, Groq, etc).
 * Subclasses only need to define MODEL_TIERS, providerName, and the OpenAI client config.
 */
export abstract class OpenAICompatibleProvider implements IProvider {
  protected ai: OpenAI;
  protected modelName: string;
  protected abstract readonly providerName: string;

  constructor(
    clientOptions: ConstructorParameters<typeof OpenAI>[0],
    tiers: Record<ModelTier, string>,
    tier: ModelTier = 'default'
  ) {
    this.ai = new OpenAI(clientOptions);
    this.modelName = tiers[tier];
  }

  public async generateResponse(systemPrompt: string, history: IMessage[], tools: BaseTool[]): Promise<ProviderResponse> {
    const mappedHistory: any[] = [{ role: 'system', content: systemPrompt }];

    for (const msg of history) {
      if (msg.role === 'tool') {
        mappedHistory.push({
          role: 'tool',
          tool_call_id: msg.tool_call_id,
          content: msg.content,
          name: msg.name
        });
      } else if (msg.role === 'assistant' && msg.tool_call_id) {
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
      } else {
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
        tools: openAITools.length > 0 ? openAITools as any : undefined
      });

      const choice = response.choices[0];
      if (!choice) throw new Error(`No choices returned from ${this.providerName}`);
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
            const fn = 'function' in tc ? (tc as any).function : tc;
            return {
              id: tc.id,
              name: fn.name as string,
              args: JSON.parse(fn.arguments || '{}')
            };
          }),
          usage
        };
      }

      return { text: msg.content || "", usage };

    } catch (err: any) {
      console.error(`[${this.providerName}/${this.modelName}] Error:`, err);
      throw new Error(`${this.providerName} Provider error: ${err.message}`);
    }
  }
}
