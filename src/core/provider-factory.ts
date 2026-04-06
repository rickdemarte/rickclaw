import { IProvider } from './provider-interface';
import { ModelTier } from '../types';
import { GeminiProvider } from './gemini-provider';
import { OpenAIProvider } from './openai-provider';
import { DeepSeekProvider } from './deepseek-provider';
import { GroqProvider } from './groq-provider';

export interface ProviderStatus {
  name: string;
  configured: boolean;
}

export class ProviderFactory {
  /** Returns configuration status for all known providers (API key present or not). */
  public static getProvidersStatus(): ProviderStatus[] {
    return [
      { name: 'gemini',   configured: !!process.env.GEMINI_API_KEY },
      { name: 'openai',   configured: !!process.env.OPENAI_API_KEY },
      { name: 'deepseek', configured: !!process.env.DEEPSEEK_API_KEY },
      { name: 'groq',     configured: !!process.env.GROQ_API_KEY },
    ];
  }

  public static getProvider(name: string, tier: ModelTier = 'default'): IProvider {
    switch (name.toLowerCase()) {
      case 'gemini':
        return new GeminiProvider(tier);
      case 'openai':
        return new OpenAIProvider(tier);
      case 'deepseek':
        return new DeepSeekProvider(tier);
      case 'groq':
        return new GroqProvider(tier);
      default:
        console.warn(`[ProviderFactory] Unknown provider '${name}', falling back to Gemini`);
        return new GeminiProvider(tier);
    }
  }
}
