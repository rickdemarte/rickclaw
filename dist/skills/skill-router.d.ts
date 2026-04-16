import { ISkillMeta } from './skill-types';
import { IProvider } from '../core/provider-interface';
import { RoutingResult } from '../types';
export declare class SkillRouter {
    private lightweightProvider;
    private dictionaryCache;
    private compiledRegexCache;
    private smalltalkPatterns;
    private patternsLoaded;
    constructor(lightweightProvider: IProvider);
    route(input: string, availableSkills: ISkillMeta[]): Promise<RoutingResult>;
    /**
     * Fallback: when no skills exist, just classify complexity via heuristic
     */
    private classifyComplexityOnly;
    private trySmalltalk;
    private loadAndCompilePatterns;
}
//# sourceMappingURL=skill-router.d.ts.map