"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillRouter = void 0;
const path_1 = __importDefault(require("path"));
const file_cache_1 = require("../utils/file-cache");
class SkillRouter {
    lightweightProvider;
    dictionaryCache;
    compiledRegexCache = new Map();
    smalltalkPatterns = [];
    patternsLoaded = false;
    constructor(lightweightProvider) {
        this.lightweightProvider = lightweightProvider;
        this.dictionaryCache = new file_cache_1.FileCache(path_1.default.join(process.cwd(), 'data', 'smalltalk-dictionary.json'), (raw) => JSON.parse(raw), 60 // 1 minute TTL for smalltalk dictionary
        );
    }
    async route(input, availableSkills) {
        const trimmed = input.trim();
        // 0. Intercept Slash Commands (Specs G-06 / RF-07)
        if (trimmed.startsWith('/')) {
            const command = trimmed.split(' ')[0] ?? '';
            if (['/new', '/session', '/sessions', '/history', '/costs'].includes(command.toLowerCase())) {
                return { type: 'command', value: trimmed.toLowerCase(), complexity: 'light' };
            }
        }
        // 1. Try Regex Smalltalk Dictionary First (Fast Path — always 'light')
        const dicReply = this.trySmalltalk(input);
        if (dicReply) {
            return { type: 'static', value: dicReply, complexity: 'light' };
        }
        // 2. Try LLM matching for a Skill + complexity classification
        if (availableSkills.length === 0) {
            return this.classifyComplexityOnly(input);
        }
        const systemPrompt = `
      You are an intent classifier AND complexity assessor.
      Return a JSON payload with exactly two keys:
      1. "skillName": the 'folderName' of the skill that best matches the user's intent, or null if no skill matches.
      2. "complexity": classify the cognitive effort needed to answer:
         - "light" = casual greetings, confirmations, simple factual questions, short answers
         - "default" = normal conversation, explanations, summaries, moderate tasks
         - "heavy" = complex analysis, code generation, multi-step reasoning, research, technical deep-dives

      Available skills:
      ${availableSkills.map(s => `- Folder: ${s.folderName} | Name: ${s.name} | Desc: ${s.description}`).join('\n')}
      
      You must respond strictly with valid JSON. Example: {"skillName": null, "complexity": "default"}
    `;
        try {
            const history = [{ conversation_id: 'router', role: 'user', content: input }];
            const response = await this.lightweightProvider.generateResponse(systemPrompt, history, []);
            if (response.text) {
                // Use regex to find the FIRST JSON object in the text
                const match = response.text.match(/\{[\s\S]*\}/);
                if (!match) {
                    console.warn('[SkillRouter] No JSON object found in LLM response:', response.text);
                    return { type: 'general', complexity: 'default' };
                }
                const jsonStr = match[0].trim();
                const parsed = JSON.parse(jsonStr);
                const complexity = (['light', 'default', 'heavy'].includes(parsed.complexity))
                    ? parsed.complexity
                    : 'default';
                if (parsed.skillName) {
                    // Verify if skill exists (prevent LLM from hallucinating non-existent folders)
                    const skillExists = availableSkills.some(s => s.folderName === parsed.skillName);
                    if (skillExists) {
                        return { type: 'skill', value: parsed.skillName, complexity, routerUsage: response.usage };
                    }
                }
                return { type: 'general', complexity, routerUsage: response.usage };
            }
        }
        catch (e) {
            console.error('[SkillRouter] Failed to extract or parse router JSON:', e);
        }
        return { type: 'general', complexity: 'default' };
    }
    /**
     * Fallback: when no skills exist, just classify complexity via heuristic
     */
    classifyComplexityOnly(input) {
        const lower = input.trim().toLowerCase();
        const wordCount = lower.split(/\s+/).length;
        // Simple heuristic when no LLM call is available
        if (wordCount <= 5)
            return { type: 'general', complexity: 'light' };
        if (wordCount >= 30 || /(?:analis|compar|implement|refator|expliqu|crie|desenvolv|investig|pesquis)/i.test(lower)) {
            return { type: 'general', complexity: 'heavy' };
        }
        return { type: 'general', complexity: 'default' };
    }
    trySmalltalk(input) {
        try {
            // Load and compile patterns lazily
            if (!this.patternsLoaded) {
                this.loadAndCompilePatterns();
            }
            if (this.smalltalkPatterns.length === 0) {
                return null;
            }
            const trimmedInput = input.trim();
            for (const { regex, replies } of this.smalltalkPatterns) {
                if (regex.test(trimmedInput)) {
                    const randIdx = Math.floor(Math.random() * replies.length);
                    let chosen = replies[randIdx] || null;
                    if (chosen && chosen.includes('__NODE_TIME__')) {
                        chosen = chosen.replace('__NODE_TIME__', `A data e hora local do sistema é: ${new Date().toLocaleString('pt-BR')}`);
                    }
                    return chosen;
                }
            }
        }
        catch (e) {
            console.error('[SkillRouter] Dictionary parsing error:', e);
        }
        return null;
    }
    loadAndCompilePatterns() {
        this.patternsLoaded = true;
        const dic = this.dictionaryCache.get();
        if (!dic)
            return;
        this.smalltalkPatterns = [];
        this.compiledRegexCache.clear();
        for (const [regexStr, replies] of Object.entries(dic)) {
            const match = regexStr.match(/^\/(.*?)\/([a-z]*)$/);
            let rx;
            if (match) {
                rx = new RegExp(match[1] || '', match[2] || undefined);
            }
            else {
                rx = new RegExp(regexStr);
            }
            this.compiledRegexCache.set(regexStr, rx);
            this.smalltalkPatterns.push({ regex: rx, replies });
        }
    }
}
exports.SkillRouter = SkillRouter;
//# sourceMappingURL=skill-router.js.map