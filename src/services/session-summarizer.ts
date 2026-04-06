import { IProvider } from '../core/provider-interface';
import { IMessage } from '../types';
import { logger } from '../utils/logger';

/** Intervalo de mensagens do usuario entre cada atualizacao de ata */
const SUMMARY_INTERVAL = parseInt(process.env.SUMMARY_INTERVAL || '10', 10);

/** Limite aproximado de tokens na ata antes de condensar (~4 chars por token) */
const SUMMARY_MAX_CHARS = 3200; // ~800 tokens

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
export class SessionSummarizer {

  constructor(private provider: IProvider) {}

  /** Verifica se e hora de atualizar a ata com base na contagem de mensagens */
  public shouldSummarize(currentUserMsgCount: number, lastSummarizedCount: number): boolean {
    return (currentUserMsgCount - lastSummarizedCount) >= SUMMARY_INTERVAL;
  }

  /** Gera ou atualiza a ata da sessao */
  public async summarize(
    previousSummary: string | null,
    previousKeywords: string | null,
    recentMessages: IMessage[]
  ): Promise<SummaryResult> {
    if (recentMessages.length === 0) {
      return {
        summary: previousSummary || '',
        keywords: previousKeywords || '{}'
      };
    }

    const messagesText = recentMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `[${m.role}]: ${m.content.substring(0, 500)}`)
      .join('\n');

    const systemPrompt = this.buildSummarizationPrompt(previousSummary, previousKeywords);

    try {
      const response = await this.provider.generateResponse(systemPrompt, [{
        conversation_id: '',
        role: 'user',
        content: `Mensagens recentes da conversa:\n\n${messagesText}`
      }], []);

      const raw = response.text || '';
      return this.parseResponse(raw, previousSummary, previousKeywords);
    } catch (err: any) {
      logger.error(`[SessionSummarizer] Erro na sumarizacao: ${err.message}`);
      return {
        summary: previousSummary || '',
        keywords: previousKeywords || '{}'
      };
    }
  }

  /** Condensa uma ata que ficou grande demais */
  public async condense(currentSummary: string, currentKeywords: string): Promise<SummaryResult> {
    if (currentSummary.length <= SUMMARY_MAX_CHARS) {
      return { summary: currentSummary, keywords: currentKeywords };
    }

    logger.info(`[SessionSummarizer] Ata com ${currentSummary.length} chars, condensando...`);

    const prompt = `Você é um assistente especializado em sumarização.

Recebeu uma ata de sessão que ficou longa demais. Condense-a mantendo apenas:
- Decisões tomadas
- Fatos relevantes sobre o usuário ou projeto
- Pendências em aberto
- Informações que seriam difíceis de recuperar

Descarte conversa casual, saudações, e detalhes de implementação já concluídos.

Responda EXATAMENTE neste formato (sem texto fora dele):

---ATA---
(ata condensada, máximo 1500 caracteres)
---CONCEITOS---
(JSON atualizado de conceitos-chave)`;

    try {
      const response = await this.provider.generateResponse(prompt, [{
        conversation_id: '',
        role: 'user',
        content: `Ata atual:\n${currentSummary}\n\nConceitos atuais:\n${currentKeywords}`
      }], []);

      const raw = response.text || '';
      return this.parseResponse(raw, currentSummary, currentKeywords);
    } catch (err: any) {
      logger.error(`[SessionSummarizer] Erro na condensacao: ${err.message}`);
      return { summary: currentSummary, keywords: currentKeywords };
    }
  }

  private buildSummarizationPrompt(previousSummary: string | null, previousKeywords: string | null): string {
    const hasPrevious = previousSummary && previousSummary.trim().length > 0;

    let prompt = `Você é um assistente especializado em sumarização de conversas.
Sua tarefa é gerar dois artefatos a partir das mensagens recentes:

1. **ATA DA SESSÃO**: Resumo objetivo do que foi discutido, decidido e realizado.
2. **CONCEITOS-CHAVE**: JSON com temas, decisões, pendências e termos técnicos relevantes.

Regras:
- Seja conciso e factual. Sem opinião, sem floreio.
- Mantenha na ata tudo que seria difícil de recuperar sem reler as mensagens originais.
- No JSON de conceitos, use as chaves: "temas", "decisoes", "pendencias", "termos_tecnicos".
- Cada array no JSON deve ter no máximo 10 itens. Priorize os mais recentes e relevantes.`;

    if (hasPrevious) {
      prompt += `\n\nAta anterior (INCORPORE as informações novas sem perder o que já existia):
${previousSummary}

Conceitos anteriores (ATUALIZE adicionando novos e removendo obsoletos):
${previousKeywords}`;
    }

    prompt += `\n\nResponda EXATAMENTE neste formato (sem texto adicional fora dele):

---ATA---
(texto da ata atualizada)
---CONCEITOS---
(JSON de conceitos-chave)`;

    return prompt;
  }

  private parseResponse(raw: string, fallbackSummary: string | null, fallbackKeywords: string | null): SummaryResult {
    const ataMatch = raw.match(/---ATA---\s*([\s\S]*?)(?:---CONCEITOS---|$)/);
    const conceitosMatch = raw.match(/---CONCEITOS---\s*([\s\S]*?)$/);

    let summary = ataMatch?.[1]?.trim() || fallbackSummary || '';
    let keywords = conceitosMatch?.[1]?.trim() || fallbackKeywords || '{}';

    // Valida que keywords e JSON valido
    try {
      JSON.parse(keywords);
    } catch {
      // Se nao for JSON valido, tenta extrair o bloco JSON do texto
      const jsonMatch = keywords.match(/\{[\s\S]*\}/);
      keywords = jsonMatch?.[0] || fallbackKeywords || '{}';
    }

    return { summary, keywords };
  }
}
