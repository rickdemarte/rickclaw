/**
 * Testes unitários para o AgentLoop.
 *
 * O AgentLoop implementa o padrão ReAct: envia mensagens ao LLM, que pode
 * responder com texto final (fim do loop) ou com tool calls (ação + observação).
 * O loop repete até obter resposta final ou atingir MAX_ITERATIONS.
 *
 * Usamos um Provider mock que simula respostas do LLM sem chamadas reais.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentLoop } from '../src/core/agent-loop';
import { ToolRegistry, BaseTool } from '../src/core/tool-registry';
import { UsageTracker } from '../src/services/usage-tracker';
import { IProvider, ProviderResponse } from '../src/core/provider-interface';
import { IMessage } from '../src/types';

// Tool falsa para testes — sempre retorna um texto fixo
class EchoTool extends BaseTool {
  public readonly name = 'echo';
  public readonly description = 'Repete o texto recebido';
  public readonly parameters = {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text']
  };
  public async execute(args: any): Promise<string> {
    return `Echo: ${args.text}`;
  }
}

// Cria um provider mock com respostas pre-definidas (fila FIFO)
function createMockProvider(responses: ProviderResponse[]): IProvider {
  let callIndex = 0;
  return {
    async generateResponse(): Promise<ProviderResponse> {
      const response = responses[callIndex] || { text: 'fallback' };
      callIndex++;
      return response;
    }
  };
}

describe('AgentLoop', () => {

  let registry: ToolRegistry;
  let tracker: UsageTracker;

  beforeEach(() => {
    // MAX_ITERATIONS baixo para testes rapidos
    process.env.MAX_ITERATIONS = '3';
    registry = new ToolRegistry();
    registry.register(new EchoTool());
    tracker = new UsageTracker();
  });

  it('retorna resposta final quando o LLM responde com texto direto', async () => {
    // O LLM responde "Ola!" sem usar nenhuma tool
    const provider = createMockProvider([
      { text: 'Ola!' }
    ]);

    const loop = new AgentLoop(provider, registry, tracker, 'default');
    const ctx = await loop.run('System prompt', [], 'Oi', 'conv-1');

    // O contexto deve ter: input do usuario + resposta do assistente
    const lastMsg = ctx[ctx.length - 1];
    expect(lastMsg?.role).toBe('assistant');
    expect(lastMsg?.content).toBe('Ola!');
  });

  it('executa tool call e retorna resposta final na segunda iteracao', async () => {
    const provider = createMockProvider([
      // Iteracao 1: LLM pede para chamar a tool "echo"
      {
        toolCalls: [{ id: 'tc-1', name: 'echo', args: { text: 'teste' } }]
      },
      // Iteracao 2: LLM recebe o resultado da tool e responde com texto final
      {
        text: 'A tool retornou: Echo: teste'
      }
    ]);

    const loop = new AgentLoop(provider, registry, tracker, 'default');
    const ctx = await loop.run('System', [], 'Usa a tool echo', 'conv-2');

    const lastMsg = ctx[ctx.length - 1];
    expect(lastMsg?.role).toBe('assistant');
    expect(lastMsg?.content).toBe('A tool retornou: Echo: teste');

    // Deve ter registrado a chamada e o resultado da tool no contexto
    const toolResult = ctx.find(m => m.role === 'tool');
    expect(toolResult?.content).toBe('Echo: teste');
  });

  it('para no limite de MAX_ITERATIONS se o LLM nunca der resposta final', async () => {
    // O LLM sempre pede tool calls e nunca responde com texto
    const provider = createMockProvider([
      { toolCalls: [{ id: 'tc-1', name: 'echo', args: { text: '1' } }] },
      { toolCalls: [{ id: 'tc-2', name: 'echo', args: { text: '2' } }] },
      { toolCalls: [{ id: 'tc-3', name: 'echo', args: { text: '3' } }] },
    ]);

    const loop = new AgentLoop(provider, registry, tracker, 'default');
    const ctx = await loop.run('System', [], 'Loop infinito', 'conv-3');

    // A ultima mensagem deve ser o aviso de limite atingido
    const lastMsg = ctx[ctx.length - 1];
    expect(lastMsg?.role).toBe('assistant');
    expect(lastMsg?.content).toContain('limite de iterações');
  });

  it('trata tool inexistente graciosamente', async () => {
    const provider = createMockProvider([
      // LLM tenta chamar uma tool que nao existe
      { toolCalls: [{ id: 'tc-1', name: 'tool_fantasma', args: {} }] },
      // Na segunda iteracao, responde normalmente
      { text: 'Ok, nao achei a tool.' }
    ]);

    const loop = new AgentLoop(provider, registry, tracker, 'default');
    const ctx = await loop.run('System', [], 'Chama tool fantasma', 'conv-4');

    // Deve ter uma observacao de erro sobre a tool inexistente
    const toolResult = ctx.find(m => m.role === 'tool');
    expect(toolResult?.content).toContain('Tool not found');
  });

  it('trata resposta vazia do provider (sem texto e sem tool calls)', async () => {
    const provider = createMockProvider([
      { /* resposta vazia */ }
    ]);

    const loop = new AgentLoop(provider, registry, tracker, 'default');
    const ctx = await loop.run('System', [], 'Teste vazio', 'conv-5');

    const lastMsg = ctx[ctx.length - 1];
    expect(lastMsg?.role).toBe('assistant');
    expect(lastMsg?.content).toContain('empty internal state');
  });
});
