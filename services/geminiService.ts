// Client-side fetch wrapper around the /api/scrape serverless function.
// The Gemini API key never reaches the browser — it lives only in the
// server-side runtime (Vercel Function env vars / Vite dev middleware).

import type { KPopEvent } from "../types";

interface ScrapeResponse {
  events?: KPopEvent[];
  error?: unknown;
  page?: number;
  fetchedAt?: string;
}

const stringifyError = (e: unknown): string => {
  if (e == null) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  if (typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    try { return JSON.stringify(e); } catch { return String(e); }
  }
  return String(e);
};

export const fetchScrapedEvents = async (page: number = 1): Promise<KPopEvent[]> => {
  const url = `/api/scrape?page=${encodeURIComponent(String(page))}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  } catch (e) {
    throw new Error(`Network error: ${stringifyError(e)}`);
  }

  let data: ScrapeResponse | null = null;
  let rawText = '';
  try {
    rawText = await res.text();
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    const preview = rawText.slice(0, 200);
    throw new Error(`Non-JSON response (HTTP ${res.status}): ${preview || '(empty body)'}`);
  }

  if (!res.ok) {
    const msg = data ? stringifyError(data.error) : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (!data || !Array.isArray(data.events)) {
    throw new Error(`Malformed response: ${rawText.slice(0, 200)}`);
  }
  return data.events;
};
