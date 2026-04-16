"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsageRepository = void 0;
const database_1 = require("./database");
const logger_1 = require("../utils/logger");
class UsageRepository {
    db = database_1.DbConnection.getInstance();
    insert(record) {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO usage_log (
          conversation_id, provider, model, tier, 
          prompt_tokens, completion_tokens, total_tokens, 
          estimated_cost_usd, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            stmt.run(record.conversation_id, record.provider, record.model, record.tier, record.prompt_tokens, record.completion_tokens, record.total_tokens, record.estimated_cost_usd, record.source);
        }
        catch (err) {
            logger_1.logger.error(`[UsageRepository] Failed to insert usage log: ${err.message}`);
        }
    }
    getTodayCost() {
        const stmt = this.db.prepare(`
      SELECT SUM(estimated_cost_usd) as total
      FROM usage_log
      WHERE date(created_at, 'localtime') = date('now', 'localtime')
    `);
        const result = stmt.get();
        return result.total || 0;
    }
    getMonthCost() {
        const stmt = this.db.prepare(`
      SELECT SUM(estimated_cost_usd) as total
      FROM usage_log
      WHERE strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')
    `);
        const result = stmt.get();
        return result.total || 0;
    }
    getCostByProvider(days = 30) {
        const stmt = this.db.prepare(`
      SELECT provider, source, SUM(estimated_cost_usd) as total_cost
      FROM usage_log
      WHERE created_at >= date('now', '-' || ? || ' days')
      GROUP BY provider, source
      ORDER BY total_cost DESC
    `);
        return stmt.all(days);
    }
    getTodayIterations() {
        const stmt = this.db.prepare(`
      SELECT COUNT(*) as total
      FROM usage_log
      WHERE date(created_at, 'localtime') = date('now', 'localtime')
    `);
        const result = stmt.get();
        return result.total || 0;
    }
}
exports.UsageRepository = UsageRepository;
//# sourceMappingURL=usage-repository.js.map