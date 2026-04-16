"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsageTracker = void 0;
const path_1 = __importDefault(require("path"));
const usage_repository_1 = require("../persistence/usage-repository");
const file_cache_1 = require("../utils/file-cache");
const logger_1 = require("../utils/logger");
class UsageTracker {
    repository = new usage_repository_1.UsageRepository();
    pricingCache = new file_cache_1.FileCache(path_1.default.join(process.cwd(), 'data', 'model-pricing.json'), (raw) => JSON.parse(raw), 600 // 10 minutes TTL for pricing data
    );
    cachedPricing = null;
    lastPricingLoad = 0;
    loadPricing() {
        const now = Date.now();
        // Use in-memory cache with TTL to avoid file system checks on every call
        if (this.cachedPricing !== null && now - this.lastPricingLoad < 600000) {
            return this.cachedPricing;
        }
        try {
            this.cachedPricing = this.pricingCache.get();
            this.lastPricingLoad = now;
            return this.cachedPricing;
        }
        catch (err) {
            logger_1.logger.error(`[UsageTracker] Error reading model-pricing.json: ${err.message}`);
            return null;
        }
    }
    calculateCost(usage) {
        const config = this.loadPricing();
        if (!config)
            return null;
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
    record(usage, conversationId, tier, source) {
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
            logger_1.logger.info(`[UsageTracker] Recorded: ${usage.totalTokens} tokens, $${costUsd.toFixed(6)} from ${source}`);
        }
        else {
            logger_1.logger.warn(`[UsageTracker] Recorded ${usage.totalTokens} tokens. Pricing not found for ${usage.provider}/${usage.model}.`);
        }
    }
    getUsdToBrlRate() {
        const config = this.loadPricing();
        return config?.config?.USD_TO_BRL || 5.10;
    }
    formatCostReport() {
        const rate = this.getUsdToBrlRate();
        const todayUsd = this.repository.getTodayCost();
        const monthUsd = this.repository.getMonthCost();
        const iterations = this.repository.getTodayIterations();
        const breakdown = this.repository.getCostByProvider(30);
        const formatCurrency = (usd) => {
            const brl = usd * rate;
            return `$${usd.toFixed(4)} (~R$ ${brl.toFixed(2)})`;
        };
        let report = `📊 **Gastos Estimados do RickClaw**\n\n`;
        report += `Hoje: ${formatCurrency(todayUsd)}\n`;
        report += `Este mês: ${formatCurrency(monthUsd)}\n\n`;
        if (breakdown.length > 0) {
            report += `🔹 **Por Provider (30 dias):**\n`;
            const providerTotals = {};
            const sourceBreakdown = {};
            for (const b of breakdown) {
                providerTotals[b.provider] = (providerTotals[b.provider] ?? 0) + b.total_cost;
                if (!sourceBreakdown[b.provider])
                    sourceBreakdown[b.provider] = [];
                if (b.total_cost > 0) {
                    sourceBreakdown[b.provider].push(`${b.source}: $${b.total_cost.toFixed(4)}`);
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
        }
        else {
            report += `Nenhum custo registrado nos últimos 30 dias.\n`;
        }
        report += `\n_Iterações hoje: ${iterations} chamadas de LLM_`;
        return report;
    }
    getCostData() {
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
exports.UsageTracker = UsageTracker;
//# sourceMappingURL=usage-tracker.js.map