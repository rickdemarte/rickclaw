export interface UsageRecord {
    conversation_id: string | null;
    provider: string;
    model: string;
    tier: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost_usd: number | null;
    source: 'router' | 'agent_loop';
}
export declare class UsageRepository {
    private db;
    insert(record: UsageRecord): void;
    getTodayCost(): number;
    getMonthCost(): number;
    getCostByProvider(days?: number): {
        provider: string;
        total_cost: number;
        source: string;
    }[];
    getTodayIterations(): number;
}
//# sourceMappingURL=usage-repository.d.ts.map