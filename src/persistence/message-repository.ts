import { DbConnection } from './database';
import { IMessage } from '../types';

export class MessageRepository {
  private db = DbConnection.getInstance();

  public insert(message: IMessage): void {
    const stmt = this.db.prepare(`
      INSERT INTO messages (conversation_id, role, content, tool_call_id, name)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      message.conversation_id, 
      message.role, 
      // replace null bytes if any to prevent SQLite errors (from EC-02)
      message.content ? message.content.replace(/\u0000/g, '') : '', 
      message.tool_call_id || null,
      message.name || null
    );

    // Update conversation's updated_at timestamp
    const updateStmt = this.db.prepare(`UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
    updateStmt.run(message.conversation_id);
  }

  // Gets the last N messages for a conversation
  public getRecentContext(conversationId: string, limit: number): IMessage[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE conversation_id = ? 
      ORDER BY id DESC 
      LIMIT ?
    `);
    const rows = stmt.all(conversationId, limit) as IMessage[];
    // Return in chronological order (oldest first)
    return rows.reverse();
  }

  public getAllByConversationId(conversationId: string): IMessage[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY id ASC
    `);
    return stmt.all(conversationId) as IMessage[];
  }

  /** Conta mensagens do usuario nesta conversa */
  public countUserMessages(conversationId: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as cnt FROM messages
      WHERE conversation_id = ? AND role = 'user'
    `);
    const row = stmt.get(conversationId) as { cnt: number };
    return row.cnt;
  }
}
