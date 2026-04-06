// CLI script to reset password: src/interfaces/reset-password.ts
import readline from 'readline';
import bcrypt from 'bcrypt';
import { UserRepository } from '../persistence/user-repository';

// Note: To run this, the SQLite must be accessed safely. Note the DbConnection logic inside UserRepository.
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const userRepo = new UserRepository();

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
         
         const hash = await bcrypt.hash(pass1, 10);
         userRepo.upsert(username, hash);
         console.log(`\nSuccess! Password for '${username}' has been updated in the local database.`);
         process.exit(0);
      });
   });
});
