import { DbConnection } from './database';
import { IUserAuth } from '../types';

export class UserRepository {
  private db = DbConnection.getInstance();

  public getByUsername(username: string): IUserAuth | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) as IUserAuth | undefined;
  }

  public upsert(username: string, passwordHash: string): void {
    const existing = this.getByUsername(username);
    if (existing) {
      const stmt = this.db.prepare('UPDATE users SET password_hash = ? WHERE username = ?');
      stmt.run(passwordHash, username);
    } else {
      const stmt = this.db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
      stmt.run(username, passwordHash);
    }
  }
}
