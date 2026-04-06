import { ModelTier } from '../types';
import { OpenAICompatibleProvider } from './openai-compatible-provider';

const MODEL_TIERS: Record<ModelTier, string> = {
  light:   'deepseek-chat',
  default: 'deepseek-chat',
  heavy:   'deepseek-reasoner',
};

export class DeepSeekProvider extends OpenAICompatibleProvider {
  protected readonly providerName = 'deepseek';

  constructor(tier: ModelTier = 'default') {
    super(
      { apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com/v1' },
      MODEL_TIERS,
      tier
    );
  }
}
