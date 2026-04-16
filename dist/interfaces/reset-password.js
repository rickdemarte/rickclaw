"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// CLI script to reset password: src/interfaces/reset-password.ts
const readline_1 = __importDefault(require("readline"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const user_repository_1 = require("../persistence/user-repository");
// Note: To run this, the SQLite must be accessed safely. Note the DbConnection logic inside UserRepository.
const rl = readline_1.default.createInterface({
    input: process.stdin,
    output: process.stdout
});
const userRepo = new user_repository_1.UserRepository();
console.log("=== RickClaw Admin CLI ===");
console.log("Password Recovery utility.");
rl.question("Target Account Username (default: admin): ", (usernameInput) => {
    const username = usernameInput.trim() || process.env.WEB_CHAT_USERNAME || 'admin';
    rl.question("New Password: ", async (pass1) => {
        rl.question("Confirm New Password: ", async (pass2) => {
            if (pass1 !== pass2) {
                console.error("Passwords do not match. Aborting.");
                process.exit(1);
            }
            const hash = await bcrypt_1.default.hash(pass1, 10);
            userRepo.upsert(username, hash);
            console.log(`\nSuccess! Password for '${username}' has been updated in the local database.`);
            process.exit(0);
        });
    });
});
//# sourceMappingURL=reset-password.js.map