"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const database_1 = require("./database");
class UserRepository {
    db = database_1.DbConnection.getInstance();
    getByUsername(username) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
        return stmt.get(username);
    }
    upsert(username, passwordHash) {
        const existing = this.getByUsername(username);
        if (existing) {
            const stmt = this.db.prepare('UPDATE users SET password_hash = ? WHERE username = ?');
            stmt.run(passwordHash, username);
        }
        else {
            const stmt = this.db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
            stmt.run(username, passwordHash);
        }
    }
}
exports.UserRepository = UserRepository;
//# sourceMappingURL=user-repository.js.map