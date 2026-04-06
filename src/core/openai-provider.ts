import { ModelTier } from '../types';
import { OpenAICompatibleProvider } from './openai-compatible-provider';

const MODEL_TIERS: Record<ModelTier, string> = {
  light: 'gpt-5.4-nano',
  default: 'gpt-5.4-mini',
  heavy: 'gpt-5.4',
};

export class OpenAIProvider extends OpenAICompatibleProvider {
  protected readonly providerName = 'openai';

  constructor(tier: ModelTier = 'default') {
    super({ apiKey: process.env.OPENAI_API_KEY }, MODEL_TIERS, tier);
  }
}
