import path from 'path';
import { ISkillMeta } from './skill-types';
import { IProvider } from '../core/provider-interface';
import { RoutingResult, ModelTier } from '../types';
import { FileCache } from '../utils/file-cache';

// LLM Schema output expected for the router
interface RouterResponse {
  skillName: string | null;
  complexity: ModelTier;
}

export class SkillRouter {
  private dictionaryCache = new FileCache<Record<string, string[]>>(
    path.join(process.cwd(), 'data', 'smalltalk-dictionary.json'),
    (raw) => JSON.parse(raw)
  );

  constructor(private lightweightProvider: IProvider) {}

  public async route(input: string, availableSkills: ISkillMeta[]): Promise<RoutingResult> {
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
      const history = [{ conversation_id: 'router', role: 'user' as const, content: input }];
      
      const response = await this.lightweightProvider.generateResponse(systemPrompt, history, []);
      if (response.text) {
         // Use regex to find the FIRST JSON object in the text
         const match = response.text.match(/\{[\s\S]*\}/);
         if (!match) {
            console.warn('[SkillRouter] No JSON object found in LLM response:', response.text);
            return { type: 'general', complexity: 'default' };
         }

         const jsonStr = match[0].trim();
         const parsed: RouterResponse = JSON.parse(jsonStr);
         
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
    } catch (e) {
       console.error('[SkillRouter] Failed to extract or parse router JSON:', e);
    }
    
    return { type: 'general', complexity: 'default' };
  }

  /**
   * Fallback: when no skills exist, just classify complexity via heuristic
   */
  private classifyComplexityOnly(input: string): RoutingResult {
    const lower = input.trim().toLowerCase();
    const wordCount = lower.split(/\s+/).length;

    // Simple heuristic when no LLM call is available
    if (wordCount <= 5) return { type: 'general', complexity: 'light' };
    if (wordCount >= 30 || /(?:analis|compar|implement|refator|expliqu|crie|desenvolv|investig|pesquis)/i.test(lower)) {
      return { type: 'general', complexity: 'heavy' };
    }
    return { type: 'general', complexity: 'default' };
  }

  private trySmalltalk(input: string): string | null {
    try {
       const dic = this.dictionaryCache.get();
       if (!dic) return null;
       
       for (const [regexStr, replies] of Object.entries(dic)) {
          const match = regexStr.match(/^\/(.*?)\/([a-z]*)$/);
          let rx: RegExp;
          
          if (match) rx = new RegExp(match[1] || '', match[2] || undefined);
          else rx = new RegExp(regexStr);

          if (rx.test(input.trim())) {
             const randIdx = Math.floor(Math.random() * replies.length);
             let chosen = replies[randIdx] || null;
             
             if (chosen && chosen.includes('__NODE_TIME__')) {
                chosen = chosen.replace('__NODE_TIME__', `A data e hora local do sistema é: ${new Date().toLocaleString('pt-BR')}`);
             }
             return chosen;
          }
       }
    } catch (e) {
        console.error('[SkillRouter] Dictionary parsing error:', e);
    }

    return null;
  }
}
