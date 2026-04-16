"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileCache = void 0;
const fs_1 = __importDefault(require("fs"));
/**
 * Caches file content in memory with TTL support.
 * Re-reads only when the file's mtime changes or TTL expires.
 * Falls back gracefully if the file doesn't exist.
 */
class FileCache {
    filePath;
    parser;
    cachedData = null;
    lastMtime = 0;
    lastCheckTime = 0;
    ttlMs;
    constructor(filePath, parser, ttlSeconds = 300 // Default 5 minutes TTL
    ) {
        this.filePath = filePath;
        this.parser = parser;
        this.ttlMs = ttlSeconds * 1000;
    }
    get() {
        const now = Date.now();
        // Check if cache is still valid within TTL
        if (this.cachedData !== null && this.lastMtime > 0) {
            if (now - this.lastCheckTime < this.ttlMs) {
                return this.cachedData;
            }
        }
        this.lastCheckTime = now;
        if (!fs_1.default.existsSync(this.filePath)) {
            this.cachedData = null;
            this.lastMtime = 0;
            return null;
        }
        const mtime = fs_1.default.statSync(this.filePath).mtimeMs;
        if (mtime !== this.lastMtime) {
            const raw = fs_1.default.readFileSync(this.filePath, 'utf-8');
            this.cachedData = this.parser(raw);
            this.lastMtime = mtime;
        }
        return this.cachedData;
    }
}
exports.FileCache = FileCache;
//# sourceMappingURL=file-cache.js.map