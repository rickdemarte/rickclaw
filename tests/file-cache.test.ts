/**
 * Testes unitários para o FileCache.
 *
 * O FileCache é um utilitário que armazena o conteúdo de um arquivo em memória
 * e só relê do disco quando o mtime do arquivo muda. Isso evita leituras
 * repetidas de arquivos que raramente mudam (ex: pricing, dicionários, configs).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FileCache } from '../src/utils/file-cache';

const TMP_DIR = path.join(process.cwd(), 'tmp');
const TEST_FILE = path.join(TMP_DIR, '_test_file_cache.json');

beforeEach(() => {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
});

afterEach(() => {
  if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
});

describe('FileCache', () => {

  it('retorna null quando o arquivo nao existe', () => {
    const cache = new FileCache<any>('/tmp/_nao_existe.json', JSON.parse);
    expect(cache.get()).toBeNull();
  });

  it('le e parseia o arquivo corretamente na primeira chamada', () => {
    fs.writeFileSync(TEST_FILE, JSON.stringify({ valor: 42 }));
    const cache = new FileCache<{ valor: number }>(TEST_FILE, JSON.parse);

    const resultado = cache.get();
    expect(resultado).toEqual({ valor: 42 });
  });

  it('retorna o valor cacheado sem reler se o arquivo nao mudou', () => {
    fs.writeFileSync(TEST_FILE, JSON.stringify({ x: 1 }));
    const cache = new FileCache<any>(TEST_FILE, JSON.parse);

    // Primeira leitura — le do disco
    const r1 = cache.get();
    expect(r1).toEqual({ x: 1 });

    // Segunda leitura — deve retornar o mesmo objeto (cache hit)
    const r2 = cache.get();
    expect(r2).toBe(r1); // mesma referencia em memoria
  });

  it('rele o arquivo quando o mtime muda', async () => {
    fs.writeFileSync(TEST_FILE, JSON.stringify({ versao: 1 }));
    const cache = new FileCache<any>(TEST_FILE, JSON.parse);

    expect(cache.get()).toEqual({ versao: 1 });

    // Aguarda 10ms para garantir que o mtime mude (resolucao de filesystem)
    await new Promise(r => setTimeout(r, 10));

    // Reescreve com conteudo diferente
    fs.writeFileSync(TEST_FILE, JSON.stringify({ versao: 2 }));

    expect(cache.get()).toEqual({ versao: 2 });
  });

  it('volta a retornar null se o arquivo for deletado', () => {
    fs.writeFileSync(TEST_FILE, '"hello"');
    const cache = new FileCache<string>(TEST_FILE, (raw) => JSON.parse(raw));

    expect(cache.get()).toBe('hello');

    fs.unlinkSync(TEST_FILE);
    expect(cache.get()).toBeNull();
  });
});
