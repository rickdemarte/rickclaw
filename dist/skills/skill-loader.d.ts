import { ISkillMeta } from './skill-types';
export declare class SkillLoader {
    private readonly baseDir;
    private metaCache;
    private metaCacheTime;
    private contentCaches;
    loadAllSkillsMeta(): ISkillMeta[];
    getSkillContent(folderName: string): string | null;
    private parseFrontmatter;
}
//# sourceMappingURL=skill-loader.d.ts.map