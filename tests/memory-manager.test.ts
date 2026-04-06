/**
 * Testes de integração para o MemoryManager.
 *
 * O MemoryManager é a fachada que coordena ConversationRepository e
 * MessageRepository. Estes testes usam um banco SQLite REAL (em memória
 * temporária) para verificar que o fluxo completo funciona:
 * criar sessão, gravar mensagens, recuperar histórico e trocar de sessão.
 *
 * São testes de integração porque envolvem o banco de dados real,
 * diferente dos testes unitários que usam mocks.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DbConnection } from '../src/persistence/database';
import { MemoryManager } from '../src/persistence/memory-manager';

// O DbConnection usa Singleton. Inicializamos uma vez antes de todos os testes.
beforeAll(() => {
  // O banco sera criado automaticamente em data/rickclaw.db
  // Se ja existe de outro teste, reutiliza.
  DbConnection.getInstance();
});

describe('MemoryManager', () => {
  // Cada teste usa um userId unico para evitar colisao entre testes
  const testUser = `test-user-${Date.now()}`;
  let mm: MemoryManager;

  beforeAll(() => {
    mm = new MemoryManager();
  });

  it('cria uma conversa automaticamente quando nao existe nenhuma', () => {
    const conv = mm.getOrCreateActiveConversation(testUser, 'gemini');
    expect(conv).toBeDefined();
    expect(conv.id).toBeTruthy();
    expect(conv.user_id).toBe(testUser);
    expect(conv.provider).toBe('gemini');
  });

  it('retorna a mesma conversa em chamadas subsequentes', () => {
    const conv1 = mm.getOrCreateActiveConversation(testUser, 'gemini');
    const conv2 = mm.getOrCreateActiveConversation(testUser, 'gemini');
    expect(conv1.id).toBe(conv2.id);
  });

  it('grava e recupera mensagens dentro de uma conversa', () => {
    const conv = mm.getOrCreateActiveConversation(testUser, 'gemini');

    mm.addMessage({ conversation_id: conv.id, role: 'user', content: 'Oi' });
    mm.addMessage({ conversation_id: conv.id, role: 'assistant', content: 'Ola!' });

    const history = mm.getConversationHistoryContext(conv.id);
    expect(history.length).toBeGreaterThanOrEqual(2);

    const lastTwo = history.slice(-2);
    expect(lastTwo[0]?.content).toBe('Oi');
    expect(lastTwo[1]?.content).toBe('Ola!');
  });

  it('respeita o MEMORY_WINDOW_SIZE ao recuperar mensagens', () => {
    // Seta janela de contexto para 3 mensagens
    process.env.MEMORY_WINDOW_SIZE = '3';
    const user = `test-window-${Date.now()}`;
    const conv = mm.getOrCreateActiveConversation(user, 'gemini');

    // Grava 5 mensagens
    for (let i = 1; i <= 5; i++) {
      mm.addMessage({ conversation_id: conv.id, role: 'user', content: `Msg ${i}` });
    }

    const history = mm.getConversationHistoryContext(conv.id);
    // Deve retornar no maximo 3 (as mais recentes)
    expect(history.length).toBeLessThanOrEqual(3);
    expect(history[history.length - 1]?.content).toBe('Msg 5');
  });

  it('cria nova sessao e lista historico', () => {
    const user = `test-sessions-${Date.now()}`;

    // Cria primeira sessao implicitamente
    const conv1 = mm.getOrCreateActiveConversation(user, 'gemini');
    mm.addMessage({ conversation_id: conv1.id, role: 'user', content: 'Sessao 1' });

    // Cria segunda sessao explicitamente
    const conv2 = mm.createNewSession(user, 'groq');
    mm.addMessage({ conversation_id: conv2.id, role: 'user', content: 'Sessao 2' });

    const history = mm.getHistory(user);
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  it('limpa caracteres null das mensagens antes de gravar', () => {
    const user = `test-null-${Date.now()}`;
    const conv = mm.getOrCreateActiveConversation(user, 'gemini');

    // Mensagem com null bytes (pode vir de PDFs mal parseados)
    mm.addMessage({ conversation_id: conv.id, role: 'user', content: 'Hello\u0000World' });

    const history = mm.getConversationHistoryContext(conv.id);
    const msg = history.find(m => m.content.includes('Hello'));
    expect(msg?.content).toBe('HelloWorld'); // null byte removido
  });
});
