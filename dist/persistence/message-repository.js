"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageRepository = void 0;
const database_1 = require("./database");
class MessageRepository {
    db = database_1.DbConnection.getInstance();
    insert(message) {
        const stmt = this.db.prepare(`
      INSERT INTO messages (conversation_id, role, content, tool_call_id, name)
      VALUES (?, ?, ?, ?, ?)
    `);
        stmt.run(message.conversation_id, message.role, 
        // replace null bytes if any to prevent SQLite errors (from EC-02)
        message.content ? message.content.replace(/\u0000/g, '') : '', message.tool_call_id || null, message.name || null);
        // Trigger automatically updates conversation's updated_at timestamp
    }
    // Gets the last N messages for a conversation
    getRecentContext(conversationId, limit) {
        const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE conversation_id = ? 
      ORDER BY id DESC 
      LIMIT ?
    `);
        const rows = stmt.all(conversationId, limit);
        // Return in chronological order (oldest first)
        return rows.reverse();
    }
    getAllByConversationId(conversationId) {
        const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY id ASC
    `);
        return stmt.all(conversationId);
    }
    /** Conta mensagens do usuario nesta conversa */
    countUserMessages(conversationId) {
        const stmt = this.db.prepare(`
      SELECT COUNT(*) as cnt FROM messages
      WHERE conversation_id = ? AND role = 'user'
    `);
        const row = stmt.get(conversationId);
        return row.cnt;
    }
}
exports.MessageRepository = MessageRepository;
//# sourceMappingURL=message-repository.js.map