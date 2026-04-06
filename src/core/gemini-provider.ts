import { IProvider, ProviderResponse } from './provider-interface';
import { IMessage, ModelTier } from '../types';
import { BaseTool } from './tool-registry';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import crypto from 'crypto';

const MODEL_TIERS: Record<ModelTier, string> = {
  light: 'gemini-2.5-flash-lite',
  default: 'gemini-2.5-flash',
  heavy: 'gemini-2.5-pro',
};

export class GeminiProvider implements IProvider {
  private ai: GoogleGenAI;
  private modelName: string;

  constructor(tier: ModelTier = 'default') {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.modelName = MODEL_TIERS[tier];
  }

  public async generateResponse(systemPrompt: string, history: IMessage[], tools: BaseTool[]): Promise<ProviderResponse> {

    // Map internal history formats to Gemini Context Format
    const rawContents = history.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'function',
          parts: [{ functionResponse: { name: msg.name, response: { result: msg.content } } }]
        };
      } else if (msg.role === 'assistant' && msg.tool_call_id) {
        return {
          role: 'model',
          parts: [{ functionCall: { name: msg.name, args: JSON.parse(msg.content || '{}') } }]
        };
      } else {
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
        parameters: tool.parameters as Schema
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
            id: crypto.randomUUID(),
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

    } catch (err: any) {
      console.error(`[GeminiProvider/${this.modelName}] Error:`, err);
      throw new Error(`Integration error via Gemini: ${err.message}`);
    }
  }

  /**
   * Ensures functionCall messages are always immediately followed by functionResponse messages.
   * Drops orphaned calls/responses that result from memory window truncation.
   */
  private sanitizeFunctionPairs(contents: any[]): any[] {
    const sanitized: any[] = [];

    for (let i = 0; i < contents.length; i++) {
      const item = contents[i];
      const isFnCall = item.parts?.some((p: any) => p.functionCall);
      const isFnResponse = item.parts?.some((p: any) => p.functionResponse);

      if (isFnCall) {
        const next = contents[i + 1];
        if (next && next.parts?.some((p: any) => p.functionResponse)) {
          sanitized.push(item);
        }
      } else if (isFnResponse) {
        const prev = sanitized[sanitized.length - 1];
        if (prev && prev.parts?.some((p: any) => p.functionCall)) {
          sanitized.push(item);
        }
      } else {
        sanitized.push(item);
      }
    }

    return sanitized;
  }
}
