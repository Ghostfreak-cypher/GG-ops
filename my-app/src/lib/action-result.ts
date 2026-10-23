/** Serializable result returned by Server Actions to client components. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; warning?: string }
  | { ok: false; error: string };
