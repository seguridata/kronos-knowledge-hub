import { chunkText } from './chunker';
import { reciprocalRankFusion } from './rrf';
import { testEmbedding } from './embedding.service';

describe('chunkText', () => {
  it('devuelve [] para texto vacío o solo espacios', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\n  ')).toEqual([]);
  });

  it('un texto corto produce un solo fragmento con offsets exactos', () => {
    const text = '  Hola mundo.  ';
    const [c] = chunkText(text);
    expect(c.text).toBe('Hola mundo.');
    expect(text.substr(c.start, c.length)).toBe('Hola mundo.');
  });

  it('los offsets siempre apuntan al texto original', () => {
    const text = Array.from({ length: 60 }, (_, i) => `Párrafo ${i}. ` + 'palabra '.repeat(30)).join('\n\n');
    const chunks = chunkText(text, { maxChars: 500, overlap: 60 });
    expect(chunks.length).toBeGreaterThan(5);
    for (const c of chunks) {
      expect(text.substr(c.start, c.length)).toBe(c.text);
      expect(c.text.length).toBeLessThanOrEqual(500);
    }
  });

  it('cubre todo el texto y respeta el traslape', () => {
    const text = 'abcdefghij '.repeat(300);
    const chunks = chunkText(text, { maxChars: 400, overlap: 50, maxChunks: 1000 });
    expect(chunks[0].start).toBe(0);
    const last = chunks[chunks.length - 1];
    expect(last.start + last.length).toBe(text.trimEnd().length);
    for (let i = 1; i < chunks.length; i++) {
      const prevEnd = chunks[i - 1].start + chunks[i - 1].length;
      expect(chunks[i].start).toBeLessThan(prevEnd); // traslape
      expect(chunks[i].start).toBeGreaterThan(chunks[i - 1].start); // avanza
    }
  });

  it('prefiere cortar en límite de párrafo u oración', () => {
    const a = 'Primera oración completa. '.repeat(20);
    const text = `${a}\n\n${'Segundo bloque. '.repeat(20)}`;
    const [first] = chunkText(text, { maxChars: a.length + 80, overlap: 20 });
    expect(first.text.endsWith('.')).toBe(true);
  });

  it('respeta maxChunks y no se cicla con texto sin espacios', () => {
    const chunks = chunkText('x'.repeat(100_000), { maxChars: 500, overlap: 50, maxChunks: 10 });
    expect(chunks).toHaveLength(10);
  });
});

describe('reciprocalRankFusion', () => {
  it('un elemento presente en ambas listas gana a uno presente en una', () => {
    const r = reciprocalRankFusion([
      { ids: ['a', 'b', 'c'] },
      { ids: ['c', 'd', 'a'] },
    ]);
    expect(r[0].id).toBe('a'); // rangos 1 y 3
    expect(r.map((x) => x.id)).toEqual(expect.arrayContaining(['a', 'b', 'c', 'd']));
  });

  it('el rango importa: primero en una lista supera a segundo en la otra', () => {
    const r = reciprocalRankFusion([{ ids: ['x', 'y'] }, { ids: ['z'] }]);
    expect(r.findIndex((v) => v.id === 'x')).toBeLessThan(r.findIndex((v) => v.id === 'y'));
  });

  it('respeta pesos', () => {
    const r = reciprocalRankFusion([
      { ids: ['a'], weight: 1 },
      { ids: ['b'], weight: 3 },
    ]);
    expect(r[0].id).toBe('b');
  });

  it('listas vacías no fallan', () => {
    expect(reciprocalRankFusion([])).toEqual([]);
    expect(reciprocalRankFusion([{ ids: [] }])).toEqual([]);
  });
});

describe('testEmbedding (solo pruebas)', () => {
  const cos = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

  it('es determinista, normalizado y de la dimensión pedida', () => {
    const v = testEmbedding('Política de vacaciones', 256);
    expect(v).toHaveLength(256);
    expect(Math.hypot(...v)).toBeCloseTo(1, 5);
    expect(testEmbedding('Política de vacaciones', 256)).toEqual(v);
  });

  it('textos con palabras en común se parecen más que textos sin relación', () => {
    const q = testEmbedding('vacaciones de empleados', 512);
    const near = testEmbedding('los empleados tienen vacaciones pagadas', 512);
    const far = testEmbedding('configuración del servidor postgres', 512);
    expect(cos(q, near)).toBeGreaterThan(cos(q, far));
  });
});
