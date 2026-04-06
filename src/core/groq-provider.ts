import Groq from 'groq-sdk';
import crypto from 'crypto';
import { IProvider, ProviderResponse, ToolCall } from './provider-interface';
import { IMessage, ModelTier } from '../types';
import { BaseTool } from './tool-registry';

const MODEL_TIERS: Record<ModelTier, string> = {
  light: 'openai/gpt-oss-20b',
  default: 'openai/gpt-oss-120b',
  heavy: 'openai/gpt-oss-120b',
};

export class GroqProvider implements IProvider {
  private ai: Groq;
  private modelName: string;
  private readonly providerName = 'groq';

  constructor(tier: ModelTier = 'default') {
    this.ai = new Groq({ apiKey: process.env.GROQ_API_KEY });
    this.modelName = MODEL_TIERS[tier];
  }

  public async generateResponse(
    systemPrompt: string,
    history: IMessage[],
    tools: BaseTool[]
  ): Promise<ProviderResponse> {
    const mappedHistory: any[] = [{ role: 'system', content: systemPrompt }];

    for (const msg of history) {
      if (msg.role === 'tool') {
        // Groq's OpenAI compatibility docs mark messages[].name as unsupported.
        // tool_call_id is sufficient to thread the result to the prior tool call.
        mappedHistory.push({
          role: 'tool',
          tool_call_id: msg.tool_call_id,
          content: msg.content,
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
              arguments: msg.content,
            },
          }],
        });
      } else {
        mappedHistory.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      }
    }

    const groqTools = tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    try {
      const response = await this.ai.chat.completions.create({
        model: this.modelName,
        messages: mappedHistory,
        tools: groqTools.length > 0 ? groqTools as any : undefined,
        tool_choice: groqTools.length > 0 ? 'auto' : undefined,
      });

      const choice = response.choices[0];
      if (!choice) throw new Error(`No choices returned from ${this.providerName}`);
      const msg = choice.message;

      const usage = response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens || 0,
        totalTokens: response.usage.total_tokens,
        model: this.modelName,
        provider: this.providerName,
      } : undefined;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        return {
          toolCalls: msg.tool_calls.map(tc => ({
            id: tc.id,
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments || '{}'),
          })),
          usage,
        };
      }

      const fallbackToolCall = this.extractFallbackToolCall(msg.content);
      if (fallbackToolCall) {
        return { toolCalls: [fallbackToolCall], usage };
      }

      return { text: msg.content || '', usage };
    } catch (err: any) {
      console.error(`[${this.providerName}/${this.modelName}] Error:`, err);
      throw new Error(`${this.providerName} Provider error: ${this.extractErrorMessage(err)}`);
    }
  }

  private extractErrorMessage(err: any): string {
    if (typeof err?.message === 'string' && err.message.trim()) {
      return err.message;
    }

    if (typeof err?.error?.message === 'string' && err.error.message.trim()) {
      return err.error.message;
    }

    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  private extractFallbackToolCall(content: unknown): ToolCall | null {
    if (typeof content !== 'string') return null;

    const trimmed = content.trim();
    if (!trimmed) return null;

    const xmlLike = trimmed.match(/^<function(?:\s+name="([^"]+)"|=([^\s>]+)[^>]*)>([\s\S]*?)<\/function>$/i);
    if (xmlLike) {
      const toolName = xmlLike[1] || xmlLike[2];
      if (!toolName) return null;

      const parsedArgs = this.parseFallbackArgs(xmlLike[3] || '');
      if (parsedArgs) {
        return {
          id: crypto.randomUUID(),
          name: toolName,
          args: parsedArgs,
        };
      }
    }

    const rawJsonArgs = this.parseFallbackArgs(trimmed);
    if (rawJsonArgs && typeof rawJsonArgs.name === 'string') {
      const args =
        typeof rawJsonArgs.arguments === 'object' && rawJsonArgs.arguments !== null
          ? rawJsonArgs.arguments
          : typeof rawJsonArgs.parameters === 'object' && rawJsonArgs.parameters !== null
            ? rawJsonArgs.parameters
            : {};

      return {
        id: crypto.randomUUID(),
        name: rawJsonArgs.name,
        args,
      };
    }

    return null;
  }

  private parseFallbackArgs(raw: string): any | null {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.name === 'string') {
          if (parsed.arguments && typeof parsed.arguments === 'object') return parsed;
          if (parsed.parameters && typeof parsed.parameters === 'object') return parsed;
        }

        return parsed;
      }
    } catch {
      return null;
    }

    return null;
  }
}
