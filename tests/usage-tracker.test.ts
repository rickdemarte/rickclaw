/**
 * Testes unitários para o UsageTracker.
 *
 * O UsageTracker calcula custos de uso de LLM baseado em uma tabela
 * de preços por modelo (model-pricing.json). Ele usa o FileCache
 * para ler o pricing e converte tokens em custo USD.
 *
 * Estes testes focam no cálculo de custo (calculateCost) e na
 * conversão de moeda (getUsdToBrlRate), usando um arquivo de pricing
 * temporário para isolar dos dados reais.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { UsageTracker } from '../src/services/usage-tracker';
import { TokenUsage } from '../src/types';

// Caminho do arquivo de pricing que o UsageTracker le via FileCache
const DATA_DIR = path.join(process.cwd(), 'data');
const PRICING_FILE = path.join(DATA_DIR, 'model-pricing.json');

// Guarda o conteúdo original para restaurar depois dos testes
let originalContent: string | null = null;

// Pricing fake para testes com valores fáceis de calcular
const TEST_PRICING = {
  config: {
    USD_TO_BRL: 5.00
  },
  models: {
    'gemini/gemini-2.0-flash': {
      input: 1.0,    // $1.00 por 1M tokens de input
      output: 2.0     // $2.00 por 1M tokens de output
    },
    'openai/gpt-4o-mini': {
      input: 0.15,
      output: 0.60
    }
  }
};

beforeEach(() => {
  // Salva o arquivo original se existir
  if (fs.existsSync(PRICING_FILE)) {
    originalContent = fs.readFileSync(PRICING_FILE, 'utf-8');
  }
  // Garante que o diretorio data/ existe
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  // Escreve o pricing de teste
  fs.writeFileSync(PRICING_FILE, JSON.stringify(TEST_PRICING));
});

afterEach(() => {
  // Restaura o arquivo original
  if (originalContent !== null) {
    fs.writeFileSync(PRICING_FILE, originalContent);
    originalContent = null;
  }
});

describe('UsageTracker — calculateCost', () => {

  it('calcula custo corretamente para modelo conhecido', () => {
    const tracker = new UsageTracker();
    const usage: TokenUsage = {
      promptTokens: 1000,        // 1000 tokens de input
      completionTokens: 500,     // 500 tokens de output
      totalTokens: 1500,
      model: 'gemini-2.0-flash',
      provider: 'gemini'
    };

    const cost = tracker.calculateCost(usage);
    expect(cost).not.toBeNull();

    // input:  1000 / 1_000_000 * 1.0 = 0.001
    // output: 500  / 1_000_000 * 2.0 = 0.001
    // total: 0.002
    expect(cost).toBeCloseTo(0.002, 6);
  });

  it('retorna null para modelo nao configurado no pricing', () => {
    const tracker = new UsageTracker();
    const usage: TokenUsage = {
      promptTokens: 1000,
      completionTokens: 500,
      totalTokens: 1500,
      model: 'modelo-inexistente',
      provider: 'provider-fake'
    };

    const cost = tracker.calculateCost(usage);
    expect(cost).toBeNull();
  });

  it('retorna zero quando tokens sao zero', () => {
    const tracker = new UsageTracker();
    const usage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      model: 'gemini-2.0-flash',
      provider: 'gemini'
    };

    const cost = tracker.calculateCost(usage);
    expect(cost).toBe(0);
  });

  it('calcula custo para segundo modelo (openai)', () => {
    const tracker = new UsageTracker();
    const usage: TokenUsage = {
      promptTokens: 2_000_000,    // exatamente 2M tokens
      completionTokens: 1_000_000, // exatamente 1M tokens
      totalTokens: 3_000_000,
      model: 'gpt-4o-mini',
      provider: 'openai'
    };

    const cost = tracker.calculateCost(usage);
    expect(cost).not.toBeNull();

    // input:  2_000_000 / 1_000_000 * 0.15 = 0.30
    // output: 1_000_000 / 1_000_000 * 0.60 = 0.60
    // total: 0.90
    expect(cost).toBeCloseTo(0.90, 6);
  });
});

describe('UsageTracker — getUsdToBrlRate', () => {

  it('retorna a taxa configurada no pricing', () => {
    const tracker = new UsageTracker();
    const rate = tracker.getUsdToBrlRate();
    expect(rate).toBe(5.00); // valor do TEST_PRICING
  });

  it('retorna taxa padrao 5.10 quando pricing nao existe', () => {
    // Remove o arquivo de pricing temporariamente
    if (fs.existsSync(PRICING_FILE)) {
      fs.unlinkSync(PRICING_FILE);
    }

    const tracker = new UsageTracker();
    const rate = tracker.getUsdToBrlRate();
    expect(rate).toBe(5.10); // fallback padrao

    // Recria o arquivo para o afterEach nao falhar
    fs.writeFileSync(PRICING_FILE, JSON.stringify(TEST_PRICING));
  });
});
