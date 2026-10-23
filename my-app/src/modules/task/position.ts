/** Gap-based ordering step — leaves room to insert between items without reindexing. */
export const POSITION_STEP = 1000;

/** Next position at the end of a list (order-independent). */
export function nextPosition(existing: number[]): number {
  if (existing.length === 0) return POSITION_STEP;
  return Math.max(...existing) + POSITION_STEP;
}

/** Evenly re-space an ordered list of ids into clean, gap-friendly positions. */
export function reindexPositions(ids: string[]): { id: string; position: number }[] {
  return ids.map((id, i) => ({ id, position: (i + 1) * POSITION_STEP }));
}
