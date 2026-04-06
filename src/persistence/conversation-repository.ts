import { DbConnection } from './database';
import { IConversation } from '../types';

export class ConversationRepository {
  private db = DbConnection.getInstance();

  public getById(id: string): IConversation | undefined {
    const stmt = this.db.prepare('SELECT * FROM conversations WHERE id = ?');
    return stmt.get(id) as IConversation | undefined;
  }

  public getByUserId(userId: string): IConversation[] {
    const stmt = this.db.prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC');
    return stmt.all(userId) as IConversation[];
  }

  public getLatestByUserId(userId: string): IConversation | undefined {
    const stmt = this.db.prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1');
    return stmt.get(userId) as IConversation | undefined;
  }

  public create(conversation: IConversation): void {
    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, user_id, provider)
      VALUES (?, ?, ?)
    `);
    stmt.run(conversation.id, conversation.user_id, conversation.provider);
  }

  public updateProvider(id: string, provider: string): void {
    const stmt = this.db.prepare(`
      UPDATE conversations SET provider = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(provider, id);
  }

  public getRecentByUserId(userId: string, limit: number = 10): IConversation[] {
    const stmt = this.db.prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?');
    return stmt.all(userId, limit) as IConversation[];
  }

  public getByIdAndUserId(id: string, userId: string): IConversation | undefined {
    const stmt = this.db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?');
    return stmt.get(id, userId) as IConversation | undefined;
  }

  public updateSummary(id: string, summary: string, keywords: string, msgCount: number): void {
    const stmt = this.db.prepare(`
      UPDATE conversations
      SET session_summary = ?, session_keywords = ?, summary_msg_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(summary, keywords, msgCount, id);
  }

  public getSummaryData(id: string): { session_summary: string | null; session_keywords: string | null; summary_msg_count: number } | undefined {
    const stmt = this.db.prepare('SELECT session_summary, session_keywords, summary_msg_count FROM conversations WHERE id = ?');
    return stmt.get(id) as { session_summary: string | null; session_keywords: string | null; summary_msg_count: number } | undefined;
  }
}
