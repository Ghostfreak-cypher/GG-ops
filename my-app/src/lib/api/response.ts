export type ApiSuccess<T> = { ok: true; data: T };
export type ApiError = { ok: false; error: string };
export type ApiResult<T> = ApiSuccess<T> | ApiError;

/** Standard success envelope: `{ ok: true, data }`. */
export function ok<T>(data: T, status = 200): Response {
  return Response.json({ ok: true, data } satisfies ApiSuccess<T>, { status });
}

/** Standard error envelope: `{ ok: false, error }`. */
export function err(error: string, status = 400, headers?: HeadersInit): Response {
  return Response.json({ ok: false, error } satisfies ApiError, { status, headers });
}
