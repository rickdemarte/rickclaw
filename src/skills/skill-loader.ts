import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { ISkillMeta, ISkill } from './skill-types';
import { FileCache } from '../utils/file-cache';

export class SkillLoader {
  private readonly baseDir = path.join(process.cwd(), '.agents', 'skills');
  private metaCache: ISkillMeta[] | null = null;
  private metaCacheTime: number = 0;
  private contentCaches = new Map<string, FileCache<string>>();

  public loadAllSkillsMeta(): ISkillMeta[] {
    if (!fs.existsSync(this.baseDir)) {
      return [];
    }

    // Re-scan the directory at most every 5 seconds
    const now = Date.now();
    if (this.metaCache && (now - this.metaCacheTime) < 5000) {
      return this.metaCache;
    }

    const list: ISkillMeta[] = [];
    const folders = fs.readdirSync(this.baseDir, { withFileTypes: true });
    for (const folder of folders) {
      if (folder.isDirectory()) {
         const mdPath = path.join(this.baseDir, folder.name, 'SKILL.md');
         if (!fs.existsSync(mdPath)) continue;

         const content = fs.readFileSync(mdPath, 'utf-8');
         const meta = this.parseFrontmatter(content, folder.name, mdPath);
         if (meta) {
            const existingIdx = list.findIndex(l => l.name === meta.name || l.folderName === meta.folderName);
            if (existingIdx >= 0) {
              list[existingIdx] = meta;
            } else {
              list.push(meta);
            }
         }
      }
    }

    this.metaCache = list;
    this.metaCacheTime = now;
    return list;
  }

  public getSkillContent(folderName: string): string | null {
     if (!this.contentCaches.has(folderName)) {
        const mdPath = path.join(this.baseDir, folderName, 'SKILL.md');
        this.contentCaches.set(folderName, new FileCache<string>(mdPath, (raw) => {
           return raw.replace(/^---[\s\S]+?---/, '').trim();
        }));
     }
     return this.contentCaches.get(folderName)!.get();
  }

  private parseFrontmatter(content: string, folderName: string, filePath: string): ISkillMeta | null {
      try {
         const match = content.match(/^---\n([\s\S]*?)\n---/);
         if (!match) return null;
         const metadataRows = yaml.load(match[1] || '') as any;

         if (!metadataRows || !metadataRows.name || !metadataRows.description) {
             return null;
         }

         return {
            folderName,
            name: metadataRows.name,
            description: metadataRows.description,
            filePath
         };
      } catch (e) {
         return null;
      }
  }
}
