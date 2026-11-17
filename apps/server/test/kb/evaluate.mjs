// Evalúa la calidad de recuperación con PREGUNTAS REALES de tu empresa:
// compara búsqueda por texto vs. híbrida (texto + vectores) con hit@k y MRR.
//
//   KB_API_KEY=kr_... node apps/server/test/kb/evaluate.mjs preguntas.json [k=3]
//
// preguntas.json: [{ "q": "¿cuántos días de vacaciones tengo?", "expect": "Política de vacaciones" }, ...]
// `expect` es el título (o parte del título) de la página que debería aparecer.
// Recomendado: 30–50 preguntas redactadas como las haría una persona o una IA.
import { readFileSync } from 'node:fs';

const API = process.env.API ?? 'http://127.0.0.1:3010';
const KEY = process.env.KB_API_KEY;
const [file, kArg] = process.argv.slice(2);
if (!KEY || !file) {
  console.error('Uso: KB_API_KEY=kr_... node evaluate.mjs preguntas.json [k]');
  process.exit(2);
}
const K = Number(kArg ?? 3);
const questions = JSON.parse(readFileSync(file, 'utf8'));

async function search(q, mode) {
  const res = await fetch(`${API}/api/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ query: q, mode, limit: 10 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} en "${q}"`);
  const body = await res.json();
  const data = body.data ?? body;
  return { titles: (data.items ?? []).map((i) => i.title ?? ''), mode: data.mode };
}

const stats = { keyword: { hit: 0, rr: 0 }, hybrid: { hit: 0, rr: 0 } };
let usedHybrid = 0;
for (const { q, expect } of questions) {
  for (const mode of ['keyword', 'hybrid']) {
    const r = await search(q, mode);
    if (mode === 'hybrid' && r.mode === 'hybrid') usedHybrid++;
    const rank = r.titles.findIndex((t) => t.toLowerCase().includes(expect.toLowerCase()));
    if (rank >= 0 && rank < K) stats[mode].hit++;
    if (rank >= 0) stats[mode].rr += 1 / (rank + 1);
    if (mode === 'hybrid' && (rank < 0 || rank >= K)) {
      console.log(`  miss: "${q}" (esperaba "${expect}") → ${JSON.stringify(r.titles.slice(0, 5))}`);
    }
  }
}
const n = questions.length;
const pct = (v) => `${((v / n) * 100).toFixed(1)}%`;
console.log(`\nPreguntas: ${n}   k=${K}`);
console.log(`texto   hit@${K}=${pct(stats.keyword.hit)}  MRR=${(stats.keyword.rr / n).toFixed(3)}`);
console.log(`híbrida hit@${K}=${pct(stats.hybrid.hit)}  MRR=${(stats.hybrid.rr / n).toFixed(3)}`);
if (usedHybrid < n) {
  console.log(`\n⚠ Solo ${usedHybrid}/${n} consultas usaron vectores: revisa AI_DRIVER y /api/knowledge/status.`);
}
