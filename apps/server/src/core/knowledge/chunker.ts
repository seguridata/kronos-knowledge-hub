export type TextChunk = { start: number; length: number; text: string };

export type ChunkOptions = {
  /** Tamaño objetivo por fragmento, en caracteres (~300 tokens). */
  maxChars?: number;
  /** Traslape entre fragmentos consecutivos para no perder contexto en los cortes. */
  overlap?: number;
  /** Tope de fragmentos por página (protege costos con documentos enormes). */
  maxChunks?: number;
};

const BREAKS = ['\n\n', '\n', '. ', '; ', ', ', ' '];

/**
 * Parte un texto en ventanas deslizantes, cortando preferentemente en
 * párrafo > línea > oración > palabra. Devuelve offsets exactos sobre el texto
 * original (start/length) para poder recuperar el fragmento después.
 */
export function chunkText(text: string, opts: ChunkOptions = {}): TextChunk[] {
  const maxChars = opts.maxChars ?? 1200;
  const overlap = Math.min(opts.overlap ?? 150, Math.floor(maxChars / 2));
  const maxChunks = opts.maxChunks ?? 200;
  const clean = text ?? '';
  const chunks: TextChunk[] = [];
  if (clean.trim().length === 0) return chunks;

  let start = 0;
  while (start < clean.length && chunks.length < maxChunks) {
    let end = Math.min(start + maxChars, clean.length);

    if (end < clean.length) {
      // Busca el mejor corte en el último 40% de la ventana.
      const minCut = start + Math.floor(maxChars * 0.6);
      for (const br of BREAKS) {
        const idx = clean.lastIndexOf(br, end);
        if (idx >= minCut) {
          end = idx + br.length;
          break;
        }
      }
    }

    const raw = clean.slice(start, end);
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      const lead = raw.length - raw.trimStart().length;
      chunks.push({
        start: start + lead,
        length: trimmed.length,
        text: trimmed,
      });
    }

    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
