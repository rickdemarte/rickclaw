import fs from 'fs';

/**
 * Caches file content in memory. Re-reads only when the file's mtime changes.
 * Falls back gracefully if the file doesn't exist.
 */
export class FileCache<T> {
  private cachedData: T | null = null;
  private lastMtime: number = 0;

  constructor(
    private filePath: string,
    private parser: (raw: string) => T
  ) {}

  public get(): T | null {
    if (!fs.existsSync(this.filePath)) {
      this.cachedData = null;
      this.lastMtime = 0;
      return null;
    }

    const mtime = fs.statSync(this.filePath).mtimeMs;
    if (mtime !== this.lastMtime) {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      this.cachedData = this.parser(raw);
      this.lastMtime = mtime;
    }

    return this.cachedData;
  }
}
