/**
 * Testes unitários para o SkillRouter.
 *
 * O SkillRouter decide como tratar cada mensagem do usuário:
 * - Comandos (ex: /new, /costs) são interceptados antes de qualquer processamento.
 * - Respostas do dicionário de smalltalk são retornadas sem chamar o LLM.
 * - Mensagens normais são classificadas por complexidade (light/default/heavy).
 *
 * Aqui testamos as partes que NÃO dependem de chamada LLM real:
 * comandos, smalltalk e heurística de complexidade.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SkillRouter } from '../src/skills/skill-router';
import { IProvider, ProviderResponse } from '../src/core/provider-interface';
import { IMessage } from '../src/types';
import { BaseTool } from '../src/core/tool-registry';

// Provider falso que nunca e chamado nos testes de comando/smalltalk
const fakeProvider: IProvider = {
  async generateResponse(): Promise<ProviderResponse> {
    return { text: '{"skillName": null, "complexity": "default"}' };
  }
};

// Dicionario de smalltalk temporario para testes
const DIC_PATH = path.join(process.cwd(), 'data', 'test-smalltalk.json');

describe('SkillRouter — Comandos', () => {

  it('reconhece /new como comando', async () => {
    const router = new SkillRouter(fakeProvider);
    const result = await router.route('/new', []);
    expect(result.type).toBe('command');
    expect(result.value).toBe('/new');
    expect(result.complexity).toBe('light');
  });

  it('reconhece /costs como comando', async () => {
    const router = new SkillRouter(fakeProvider);
    const result = await router.route('/costs', []);
    expect(result.type).toBe('command');
  });

  it('reconhece /session com argumento', async () => {
    const router = new SkillRouter(fakeProvider);
    const result = await router.route('/session abc-123', []);
    expect(result.type).toBe('command');
    expect(result.value).toBe('/session abc-123');
  });

  it('nao trata comando desconhecido como command type', async () => {
    const router = new SkillRouter(fakeProvider);
    const result = await router.route('/foobar', []);
    expect(result.type).not.toBe('command');
  });
});

describe('SkillRouter — Classificação de complexidade (heurística)', () => {

  it('mensagens curtas (<= 5 palavras) sao classificadas como light', async () => {
    const router = new SkillRouter(fakeProvider);
    // Sem skills disponiveis, usa heuristica pura
    const result = await router.route('bom dia', []);
    expect(result.complexity).toBe('light');
  });

  it('mensagens longas com palavras-chave sao classificadas como heavy', async () => {
    const router = new SkillRouter(fakeProvider);
    const input = 'analise detalhadamente o código fonte e implemente as melhorias de segurança identificadas no relatório de auditoria que enviei ontem';
    const result = await router.route(input, []);
    expect(result.complexity).toBe('heavy');
  });

  it('mensagens intermediarias sao classificadas como default', async () => {
    const router = new SkillRouter(fakeProvider);
    const input = 'me explica como funciona o sistema de memória do projeto';
    const result = await router.route(input, []);
    expect(result.complexity).toBe('default');
  });
});

describe('SkillRouter — Roteamento com LLM mock', () => {

  it('identifica skill quando LLM retorna skillName valido', async () => {
    const mockProvider: IProvider = {
      async generateResponse(): Promise<ProviderResponse> {
        return {
          text: '{"skillName": "email-skill", "complexity": "default"}',
          usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120, model: 'test', provider: 'mock' }
        };
      }
    };

    const router = new SkillRouter(mockProvider);
    const skills = [{ folderName: 'email-skill', name: 'Email', description: 'Envia emails', filePath: '' }];

    const result = await router.route('manda um email pro chefe', skills);
    expect(result.type).toBe('skill');
    expect(result.value).toBe('email-skill');
    expect(result.routerUsage).toBeDefined();
  });

  it('retorna general quando LLM indica skill inexistente', async () => {
    const mockProvider: IProvider = {
      async generateResponse(): Promise<ProviderResponse> {
        return { text: '{"skillName": "skill-que-nao-existe", "complexity": "heavy"}' };
      }
    };

    const router = new SkillRouter(mockProvider);
    const skills = [{ folderName: 'email-skill', name: 'Email', description: 'Envia emails', filePath: '' }];

    const result = await router.route('faz algo impossivel', skills);
    expect(result.type).toBe('general');
    // A complexidade vinda do LLM ainda e respeitada
    expect(result.complexity).toBe('heavy');
  });

  it('retorna general/default quando LLM retorna JSON invalido', async () => {
    const mockProvider: IProvider = {
      async generateResponse(): Promise<ProviderResponse> {
        return { text: 'isso nao e json nenhum' };
      }
    };

    const router = new SkillRouter(mockProvider);
    const result = await router.route('qualquer coisa', [{ folderName: 'x', name: 'x', description: 'x', filePath: '' }]);
    expect(result.type).toBe('general');
    expect(result.complexity).toBe('default');
  });
});
