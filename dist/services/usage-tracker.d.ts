import { TokenUsage } from '../types';
export declare class UsageTracker {
    private repository;
    private pricingCache;
    private cachedPricing;
    private lastPricingLoad;
    private loadPricing;
    calculateCost(usage: TokenUsage): number | null;
    record(usage: TokenUsage, conversationId: string | null, tier: string, source: 'router' | 'agent_loop'): void;
    getUsdToBrlRate(): number;
    formatCostReport(): string;
    getCostData(): {
        todayUsd: number;
        monthUsd: number;
        iterationsToday: number;
        rate: number;
        details: {
            provider: string;
            total_cost: number;
            source: string;
        }[];
    };
}
//# sourceMappingURL=usage-tracker.d.ts.map