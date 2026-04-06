import { DbConnection } from './database';
import { logger } from '../utils/logger';

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

export class UsageRepository {
  private db = DbConnection.getInstance();

  public insert(record: UsageRecord): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO usage_log (
          conversation_id, provider, model, tier, 
          prompt_tokens, completion_tokens, total_tokens, 
          estimated_cost_usd, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        record.conversation_id,
        record.provider,
        record.model,
        record.tier,
        record.prompt_tokens,
        record.completion_tokens,
        record.total_tokens,
        record.estimated_cost_usd,
        record.source
      );
    } catch (err: any) {
      logger.error(`[UsageRepository] Failed to insert usage log: ${err.message}`);
    }
  }

  public getTodayCost(): number {
    const stmt = this.db.prepare(`
      SELECT SUM(estimated_cost_usd) as total
      FROM usage_log
      WHERE date(created_at, 'localtime') = date('now', 'localtime')
    `);
    const result = stmt.get() as { total: number | null };
    return result.total || 0;
  }

  public getMonthCost(): number {
    const stmt = this.db.prepare(`
      SELECT SUM(estimated_cost_usd) as total
      FROM usage_log
      WHERE strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')
    `);
    const result = stmt.get() as { total: number | null };
    return result.total || 0;
  }

  public getCostByProvider(days: number = 30): { provider: string; total_cost: number; source: string }[] {
    const stmt = this.db.prepare(`
      SELECT provider, source, SUM(estimated_cost_usd) as total_cost
      FROM usage_log
      WHERE created_at >= date('now', '-' || ? || ' days')
      GROUP BY provider, source
      ORDER BY total_cost DESC
    `);
    return stmt.all(days) as { provider: string; total_cost: number; source: string }[];
  }

  public getTodayIterations(): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as total
      FROM usage_log
      WHERE date(created_at, 'localtime') = date('now', 'localtime')
    `);
    const result = stmt.get() as { total: number };
    return result.total || 0;
  }
}
