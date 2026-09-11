/** Mirrors the phone's readBackendError: `{ error: string }` or `{ error: { code, message } }`. */
export function readBackendErrorBody(body: unknown, fallback: string): { message: string; code: string | null } {
  if (!body || typeof body !== "object") {
    return { message: fallback, code: null };
  }
  const o = body as Record<string, unknown>;
  if (typeof o.error === "string" && o.error.trim()) {
    return { message: o.error, code: null };
  }
  if (o.error && typeof o.error === "object") {
    const nested = o.error as Record<string, unknown>;
    const code = typeof nested.code === "string" ? nested.code : null;
    const message = typeof nested.message === "string" && nested.message.trim() ? nested.message : fallback;
    return { message, code };
  }
  if (typeof o.message === "string" && o.message.trim()) {
    return { message: o.message, code: null };
  }
  return { message: fallback, code: null };
}
