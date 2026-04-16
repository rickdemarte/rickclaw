import fs from 'fs';

/**
 * Caches file content in memory with TTL support.
 * Re-reads only when the file's mtime changes or TTL expires.
 * Falls back gracefully if the file doesn't exist.
 */
export class FileCache<T> {
  private cachedData: T | null = null;
  private lastMtime: number = 0;
  private lastCheckTime: number = 0;
  private readonly ttlMs: number;
  
  constructor(
    private filePath: string,
    private parser: (raw: string) => T,
    ttlSeconds: number = 300 // Default 5 minutes TTL
  ) {
    this.ttlMs = ttlSeconds * 1000;
  }

  public get(): T | null {
    const now = Date.now();
    const fileExists = fs.existsSync(this.filePath);
    
    // If file doesn't exist, always return null and reset cache
    if (!fileExists) {
      this.cachedData = null;
      this.lastMtime = 0;
      this.lastCheckTime = now;
      return null;
    }
    
    this.lastCheckTime = now;

    const mtime = fs.statSync(this.filePath).mtimeMs;
    
    // Always check mtime first - if file changed, re-read regardless of TTL
    if (mtime !== this.lastMtime || this.cachedData === null) {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      this.cachedData = this.parser(raw);
      this.lastMtime = mtime;
      return this.cachedData;
    }
    
    // File hasn't changed - use TTL to avoid unnecessary checks
    if (now - this.lastCheckTime < this.ttlMs) {
      return this.cachedData;
    }

    return this.cachedData;
  }
}
