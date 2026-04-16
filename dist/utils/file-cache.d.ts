/**
 * Caches file content in memory with TTL support.
 * Re-reads only when the file's mtime changes or TTL expires.
 * Falls back gracefully if the file doesn't exist.
 */
export declare class FileCache<T> {
    private filePath;
    private parser;
    private cachedData;
    private lastMtime;
    private lastCheckTime;
    private readonly ttlMs;
    constructor(filePath: string, parser: (raw: string) => T, ttlSeconds?: number);
    get(): T | null;
}
//# sourceMappingURL=file-cache.d.ts.map