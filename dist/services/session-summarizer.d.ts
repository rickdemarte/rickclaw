import { IProvider } from '../core/provider-interface';
import { IMessage } from '../types';
export interface SummaryResult {
    summary: string;
    keywords: string;
}
/**
 * Gera e atualiza incrementalmente a ata da sessao e o JSON de conceitos-chave.
 *
 * Fluxo:
 * 1. Recebe a ata anterior + mensagens novas desde a ultima sumarizacao
 * 2. Pede ao LLM (tier light) para atualizar a ata incorporando as novas informacoes
 * 3. Se a ata ultrapassar SUMMARY_MAX_CHARS, pede condensacao
 */
export declare class SessionSummarizer {
    private provider;
    constructor(provider: IProvider);
    /** Verifica se e hora de atualizar a ata com base na contagem de mensagens */
    shouldSummarize(currentUserMsgCount: number, lastSummarizedCount: number): boolean;
    /** Gera ou atualiza a ata da sessao */
    summarize(previousSummary: string | null, previousKeywords: string | null, recentMessages: IMessage[]): Promise<SummaryResult>;
    /** Condensa uma ata que ficou grande demais */
    condense(currentSummary: string, currentKeywords: string): Promise<SummaryResult>;
    private buildSummarizationPrompt;
    private parseResponse;
}
//# sourceMappingURL=session-summarizer.d.ts.map