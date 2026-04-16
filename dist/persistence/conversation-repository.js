"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationRepository = void 0;
const database_1 = require("./database");
class ConversationRepository {
    db = database_1.DbConnection.getInstance();
    getById(id) {
        const stmt = this.db.prepare('SELECT * FROM conversations WHERE id = ?');
        return stmt.get(id);
    }
    getByUserId(userId) {
        const stmt = this.db.prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC');
        return stmt.all(userId);
    }
    getLatestByUserId(userId) {
        const stmt = this.db.prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1');
        return stmt.get(userId);
    }
    create(conversation) {
        const stmt = this.db.prepare(`
      INSERT INTO conversations (id, user_id, provider)
      VALUES (?, ?, ?)
    `);
        stmt.run(conversation.id, conversation.user_id, conversation.provider);
    }
    updateProvider(id, provider) {
        const stmt = this.db.prepare(`
      UPDATE conversations SET provider = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
        stmt.run(provider, id);
    }
    getRecentByUserId(userId, limit = 10) {
        const stmt = this.db.prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?');
        return stmt.all(userId, limit);
    }
    getByIdAndUserId(id, userId) {
        const stmt = this.db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?');
        return stmt.get(id, userId);
    }
    updateSummary(id, summary, keywords, msgCount) {
        const stmt = this.db.prepare(`
      UPDATE conversations
      SET session_summary = ?, session_keywords = ?, summary_msg_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
        stmt.run(summary, keywords, msgCount, id);
    }
    getSummaryData(id) {
        const stmt = this.db.prepare('SELECT session_summary, session_keywords, summary_msg_count FROM conversations WHERE id = ?');
        return stmt.get(id);
    }
}
exports.ConversationRepository = ConversationRepository;
//# sourceMappingURL=conversation-repository.js.map