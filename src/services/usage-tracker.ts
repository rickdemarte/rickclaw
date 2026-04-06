import path from 'path';
import { TokenUsage } from '../types';
import { UsageRepository } from '../persistence/usage-repository';
import { FileCache } from '../utils/file-cache';
import { logger } from '../utils/logger';

interface ModelPricing {
  input: number;
  output: number;
}

interface PricingConfig {
  config: {
    USD_TO_BRL: number;
  };
  models: Record<string, ModelPricing>;
}

export class UsageTracker {
  private repository = new UsageRepository();
  private pricingCache = new FileCache<PricingConfig>(
    path.join(process.cwd(), 'data', 'model-pricing.json'),
    (raw) => JSON.parse(raw)
  );

  private loadPricing(): PricingConfig | null {
    try {
      return this.pricingCache.get();
    } catch (err: any) {
      logger.error(`[UsageTracker] Error reading model-pricing.json: ${err.message}`);
      return null;
    }
  }

  public calculateCost(usage: TokenUsage): number | null {
    const config = this.loadPricing();
    if (!config) return null;

    const id = `${usage.provider}/${usage.model}`;
    const pricing = config.models[id];

    if (!pricing) {
      // Model not configured
      return null;
    }

    // Pricing is per 1 million tokens
    const promptCost = (usage.promptTokens / 1_000_000) * pricing.input;
    const completionCost = (usage.completionTokens / 1_000_000) * pricing.output;
    
    return promptCost + completionCost;
  }

  public record(usage: TokenUsage, conversationId: string | null, tier: string, source: 'router' | 'agent_loop'): void {
    const costUsd = this.calculateCost(usage);

    this.repository.insert({
      conversation_id: conversationId,
      provider: usage.provider,
      model: usage.model,
      tier,
      prompt_tokens: usage.promptTokens,
      completion_tokens: usage.completionTokens,
      total_tokens: usage.totalTokens,
      estimated_cost_usd: costUsd,
      source
    });

    if (costUsd !== null) {
      logger.info(`[UsageTracker] Recorded: ${usage.totalTokens} tokens, $${costUsd.toFixed(6)} from ${source}`);
    } else {
      logger.warn(`[UsageTracker] Recorded ${usage.totalTokens} tokens. Pricing not found for ${usage.provider}/${usage.model}.`);
    }
  }

  public getUsdToBrlRate(): number {
    const config = this.loadPricing();
    return config?.config?.USD_TO_BRL || 5.10;
  }

  public formatCostReport(): string {
    const rate = this.getUsdToBrlRate();
    const todayUsd = this.repository.getTodayCost();
    const monthUsd = this.repository.getMonthCost();
    const iterations = this.repository.getTodayIterations();
    const breakdown = this.repository.getCostByProvider(30);

    const formatCurrency = (usd: number) => {
      const brl = usd * rate;
      return `$${usd.toFixed(4)} (~R$ ${brl.toFixed(2)})`;
    };

    let report = `📊 **Gastos Estimados do RickClaw**\n\n`;
    report += `Hoje: ${formatCurrency(todayUsd)}\n`;
    report += `Este mês: ${formatCurrency(monthUsd)}\n\n`;

    if (breakdown.length > 0) {
      report += `🔹 **Por Provider (30 dias):**\n`;
      const providerTotals: Record<string, number> = {};
      const sourceBreakdown: Record<string, string[]> = {};

      for (const b of breakdown) {
        providerTotals[b.provider] = (providerTotals[b.provider] ?? 0) + b.total_cost;

        if (!sourceBreakdown[b.provider]) sourceBreakdown[b.provider] = [];
        if (b.total_cost > 0) {
           sourceBreakdown[b.provider]!.push(`${b.source}: $${b.total_cost.toFixed(4)}`);
        }
      }

      for (const provider of Object.keys(providerTotals)) {
        const total = providerTotals[provider] ?? 0;
        const sources = sourceBreakdown[provider] ?? [];
        report += `  • **${provider.charAt(0).toUpperCase() + provider.slice(1)}**: $${total.toFixed(4)}`;
        if (sources.length > 0) {
          report += ` _(${sources.join(', ')})_`;
        }
        report += `\n`;
      }
    } else {
      report += `Nenhum custo registrado nos últimos 30 dias.\n`;
    }

    report += `\n_Iterações hoje: ${iterations} chamadas de LLM_`;
    return report;
  }

  public getCostData() {
     const rate = this.getUsdToBrlRate();
     return {
        todayUsd: this.repository.getTodayCost(),
        monthUsd: this.repository.getMonthCost(),
        iterationsToday: this.repository.getTodayIterations(),
        rate,
        details: this.repository.getCostByProvider(30)
     };
  }
}
