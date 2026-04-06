import Database, { Database as IDatabase } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'rickclaw.db');
const LOCK_FILE = path.join(DATA_DIR, '.keepuniq');

interface LockFileData {
  host: string;
  pid?: number;
  createdAt?: string;
}

export class DbConnection {
  private static instance: IDatabase | null = null;

  public static getInstance(): IDatabase {
    if (!this.instance) {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      this.checkAndCreateLockFile();

      this.instance = new Database(DB_PATH);
      
      // Enable WAL mode for better concurrency and fast reads/writes
      this.instance.pragma('journal_mode = WAL');
      this.instance.pragma('synchronous = NORMAL');
      // No strict foreign keys per spec request (lighter inserts)

      this.initializeSchema();
    }
    return this.instance;
  }

  private static checkAndCreateLockFile() {
    if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
      return;
    }

    const hostname = this.getLockHostId();

    if (!fs.existsSync(LOCK_FILE)) {
      this.writeLockFile(hostname);
      return;
    }

    const existingLock = this.readLockFile();

    if (existingLock.host && existingLock.host !== hostname) {
      throw new Error(
        `Lockfile already belongs to host "${existingLock.host}". ` +
        `This may indicate that RickClaw is active on another machine or that a synced stale lock is present. ` +
        `If you are sure the other host is offline, run: npm run release-lock`
      );
    }

    if (existingLock.pid && existingLock.pid !== process.pid && this.isProcessRunning(existingLock.pid)) {
      throw new Error(
        `RickClaw already appears to be running on this host (pid ${existingLock.pid}). ` +
        `If this is a stale lock, stop the other process first and then run: npm run release-lock`
      );
    }

    console.warn('[WARNING] Found a stale or legacy .keepuniq lock on this host. Reclaiming it for the current process.');
    this.writeLockFile(hostname);
  }

  /** Called by the centralized shutdown handler in app.ts */
  public static cleanup() {
    if (this.currentProcessOwnsLock()) {
      fs.unlinkSync(LOCK_FILE);
    } else if (fs.existsSync(LOCK_FILE)) {
      console.warn('[WARNING] Skipping lockfile removal because it is no longer owned by the current process.');
    }
    if (DbConnection.instance) {
      DbConnection.instance.close();
      DbConnection.instance = null;
    }
  }

  private static readLockFile(): LockFileData {
    const raw = fs.readFileSync(LOCK_FILE, 'utf-8').trim();
    if (!raw) return { host: '' };

    try {
      const parsed = JSON.parse(raw) as Partial<LockFileData>;
      if (typeof parsed.host === 'string') {
        return {
          host: parsed.host,
          pid: typeof parsed.pid === 'number' ? parsed.pid : undefined,
          createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : undefined,
        };
      }
    } catch {
      // Backward compatibility: older locks stored only the hostname as plain text.
    }

    return { host: raw };
  }

  private static writeLockFile(hostname: string) {
    const lockData: LockFileData = {
      host: hostname,
      pid: process.pid,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(LOCK_FILE, JSON.stringify(lockData, null, 2), 'utf-8');
  }

  private static isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (err: any) {
      return err?.code === 'EPERM';
    }
  }

  private static currentProcessOwnsLock(): boolean {
    if (!fs.existsSync(LOCK_FILE)) return false;

    const lockData = this.readLockFile();
    return lockData.host === this.getLockHostId() && lockData.pid === process.pid;
  }

  private static getLockHostId(): string {
    const configured = process.env.LOCK_HOST_ID?.trim();
    return configured || os.hostname();
  }

  private static initializeSchema() {
    if (!this.instance) return;

    this.instance.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        session_summary TEXT,
        session_keywords TEXT,
        summary_msg_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_call_id TEXT,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS usage_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        tier TEXT,
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        estimated_cost_usd REAL,
        source TEXT DEFAULT 'agent_loop',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    `);

    // Migrations para bancos existentes — adiciona colunas se ainda nao existem
    const cols = this.instance!.pragma('table_info(conversations)') as { name: string }[];
    const colNames = cols.map(c => c.name);
    if (!colNames.includes('session_summary')) {
      this.instance!.exec(`ALTER TABLE conversations ADD COLUMN session_summary TEXT`);
    }
    if (!colNames.includes('session_keywords')) {
      this.instance!.exec(`ALTER TABLE conversations ADD COLUMN session_keywords TEXT`);
    }
    if (!colNames.includes('summary_msg_count')) {
      this.instance!.exec(`ALTER TABLE conversations ADD COLUMN summary_msg_count INTEGER DEFAULT 0`);
    }

    this.instance!.exec(`
      CREATE INDEX IF NOT EXISTS idx_usage_log_created_at ON usage_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_usage_log_provider ON usage_log(provider);
    `);
  }
}
