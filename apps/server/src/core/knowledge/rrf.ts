export type RankedList = {
  /** Ids en orden de relevancia (el primero es el mejor). */
  ids: string[];
  weight?: number;
};

/**
 * Reciprocal Rank Fusion: combina rankings de escalas distintas (ts_rank vs
 * distancia coseno) sin normalizar puntajes. score = Σ weight / (k + rank).
 */
export function reciprocalRankFusion(
  lists: RankedList[],
  k = 60,
): { id: string; score: number }[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    const weight = list.weight ?? 1;
    list.ids.forEach((id, index) => {
      scores.set(id, (scores.get(id) ?? 0) + weight / (k + index + 1));
    });
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
