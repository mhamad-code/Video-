export type ErrorKind = 'auth' | 'quota' | 'rate_limit' | 'unsupported' | 'network' | 'timeout' | 'server' | 'unknown';

export class ProviderError extends Error {
  constructor(public kind: ErrorKind, message: string, public status?: number) {
    super(message);
    this.name = 'ProviderError';
  }
}

/** Map an HTTP failure to an error kind. 429 is split into daily/billing quota vs. transient rate limit. */
export function classifyHttp(status: number, body = ''): ErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 402) return 'quota';
  if (status === 429) return /perday|per day|daily|billing|insufficient|credit/i.test(body) ? 'quota' : 'rate_limit';
  if (status === 408 || status === 504) return 'timeout';
  if (status === 404) return 'unsupported';
  if (status === 400) return /image|vision|multimodal|modalit/i.test(body) ? 'unsupported' : 'unknown';
  if (status >= 500) return 'server';
  return 'unknown';
}

/** Only these are worth retrying against the same provider. Quota/auth/unsupported go straight to fallback. */
export const isRecoverable = (k: ErrorKind): boolean => k === 'rate_limit' || k === 'network' || k === 'timeout' || k === 'server';

export async function fetchWithTimeout(url: string, init: RequestInit, ms: number, outer?: AbortSignal): Promise<Response> {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, ms);
  const onAbort = () => ctrl.abort();
  outer?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(classifyHttp(res.status, body), `HTTP ${res.status}: ${body.slice(0, 300)}`, res.status);
    }
    return res;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (outer?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (timedOut) throw new ProviderError('timeout', `Timed out after ${ms}ms`);
    // fetch() rejects with TypeError for network failures and CORS blocks (indistinguishable in browsers).
    throw new ProviderError('network', e instanceof Error ? e.message : 'Network error');
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onAbort);
  }
}
