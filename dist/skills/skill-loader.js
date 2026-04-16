"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillLoader = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const file_cache_1 = require("../utils/file-cache");
class SkillLoader {
    baseDir = path_1.default.join(process.cwd(), '.agents', 'skills');
    metaCache = null;
    metaCacheTime = 0;
    contentCaches = new Map();
    loadAllSkillsMeta() {
        if (!fs_1.default.existsSync(this.baseDir)) {
            return [];
        }
        // Re-scan the directory at most every 5 seconds
        const now = Date.now();
        if (this.metaCache && (now - this.metaCacheTime) < 5000) {
            return this.metaCache;
        }
        const list = [];
        const folders = fs_1.default.readdirSync(this.baseDir, { withFileTypes: true });
        for (const folder of folders) {
            if (folder.isDirectory()) {
                const mdPath = path_1.default.join(this.baseDir, folder.name, 'SKILL.md');
                if (!fs_1.default.existsSync(mdPath))
                    continue;
                const content = fs_1.default.readFileSync(mdPath, 'utf-8');
                const meta = this.parseFrontmatter(content, folder.name, mdPath);
                if (meta) {
                    const existingIdx = list.findIndex(l => l.name === meta.name || l.folderName === meta.folderName);
                    if (existingIdx >= 0) {
                        list[existingIdx] = meta;
                    }
                    else {
                        list.push(meta);
                    }
                }
            }
        }
        this.metaCache = list;
        this.metaCacheTime = now;
        return list;
    }
    getSkillContent(folderName) {
        if (!this.contentCaches.has(folderName)) {
            const mdPath = path_1.default.join(this.baseDir, folderName, 'SKILL.md');
            this.contentCaches.set(folderName, new file_cache_1.FileCache(mdPath, (raw) => {
                return raw.replace(/^---[\s\S]+?---/, '').trim();
            }));
        }
        return this.contentCaches.get(folderName).get();
    }
    parseFrontmatter(content, folderName, filePath) {
        try {
            const match = content.match(/^---\n([\s\S]*?)\n---/);
            if (!match)
                return null;
            const metadataRows = js_yaml_1.default.load(match[1] || '');
            if (!metadataRows || !metadataRows.name || !metadataRows.description) {
                return null;
            }
            return {
                folderName,
                name: metadataRows.name,
                description: metadataRows.description,
                filePath
            };
        }
        catch (e) {
            return null;
        }
    }
}
exports.SkillLoader = SkillLoader;
//# sourceMappingURL=skill-loader.js.map