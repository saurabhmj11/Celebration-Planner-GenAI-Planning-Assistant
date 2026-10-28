/**
 * Capped JSON body reader for request handlers.
 *
 * Red-team fix (V-1): the public album/RSVP endpoints used to
 * `JSON.parse(await request.text())` with no size ceiling, so a single
 * guest request could make the server buffer + parse megabytes before Zod
 * ever ran (memory DoS). The sync/auth routes already capped bodies —
 * this module gives the public routes the same discipline in one place.
 *
 * Defence-in-depth, two layers:
 *  1. Content-Length pre-check — oversized requests are refused before
 *     the body is buffered at all (fast path for honest clients and tools).
 *  2. Post-read length check — chunked-encoding requests that lie about
 *     (or omit) Content-Length are still capped after buffering.
 *
 * The cap must exceed the legitimate maximum payload of the endpoint
 * (e.g. album uploads: 400k dataUrl + JSON overhead), never the reverse.
 */

export interface CappedBodyResult {
  /** false when the body should be rejected without parsing. */
  ok: boolean;
  /** HTTP status to return when ok === false (413 = too large, 400 = bad JSON). */
  status: 400 | 413;
  /** Human-readable error text for ok === false. */
  message: string;
  /** Parsed JSON value when ok === true ({} for an empty body). */
  value?: unknown;
}

/** Read a JSON request body, refusing anything larger than maxBytes. */
export async function readCappedJsonBody(
  request: Request,
  maxBytes: number
): Promise<CappedBodyResult> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    return { ok: false, status: 413, message: "Payload Too Large" };
  }
  const raw = await request.text();
  if (raw.length > maxBytes) {
    return { ok: false, status: 413, message: "Payload Too Large" };
  }
  if (!raw) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, status: 400, message: "Invalid JSON body" };
  }
}
