const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    // fetch() itself throws a raw, unhandled-looking TypeError for any
    // network-level failure (server unreachable, connection dropped mid-
    // request, etc.) — wrapped here so every caller can handle it the same
    // way as a normal API error, instead of it surfacing as an uncaught
    // exception that crashes the whole page.
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    const message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? res.statusText);
    throw new ApiError(message, res.status);
  }

  // A successful DELETE (and some other endpoints) return an EMPTY body —
  // NestJS's default success status for a handler that returns nothing is
  // 200, not 204, so `res.status === 204` alone never caught this. Calling
  // res.json() on an empty body throws a raw SyntaxError, which isn't an
  // ApiError, so every caller's `err instanceof ApiError ? ... : 'generic
  // message'` fallback fired — showing "could not delete" etc. even though
  // the request had already succeeded. This was the real cause behind
  // nearly every "shows an error but it actually worked" report (line
  // items, sections, templates, and anything else using DELETE).
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// A FormData body must NOT get the 'Content-Type: application/json' header
// request() applies by default — the browser needs to set its own
// multipart/form-data boundary, which it only does when Content-Type is
// left unset entirely.
async function uploadFile<T>(path: string, file: File): Promise<T> {
  const token = getToken();
  const form = new FormData();
  form.append('file', file);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    const message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? res.statusText);
    throw new ApiError(message, res.status);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  uploadFile,
};
