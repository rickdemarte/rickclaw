import { Database as IDatabase } from 'better-sqlite3';
export declare class DbConnection {
    private static instance;
    static getInstance(): IDatabase;
    private static checkAndCreateLockFile;
    /** Called by the centralized shutdown handler in app.ts */
    static cleanup(): void;
    private static readLockFile;
    private static writeLockFile;
    private static isProcessRunning;
    private static currentProcessOwnsLock;
    private static getLockHostId;
    private static initializeSchema;
}
//# sourceMappingURL=database.d.ts.map