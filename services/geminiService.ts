// Client-side fetch wrapper around the /api/scrape serverless function.
// The Gemini API key never reaches the browser — it lives only in the
// server-side runtime (Vercel Function env vars / Vite dev middleware).

import type { KPopEvent } from "../types";

interface ScrapeResponse {
  events?: KPopEvent[];
  error?: string;
  page?: number;
  fetchedAt?: string;
}

export const fetchScrapedEvents = async (page: number = 1): Promise<KPopEvent[]> => {
  const res = await fetch(`/api/scrape?page=${encodeURIComponent(String(page))}`, {
    headers: { 'Accept': 'application/json' },
  });

  let data: ScrapeResponse;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server returned non-JSON response (HTTP ${res.status})`);
  }

  if (!res.ok) {
    throw new Error(data.error || `Server error (HTTP ${res.status})`);
  }
  if (!data.events) {
    throw new Error('Server response missing "events" field');
  }
  return data.events;
};
