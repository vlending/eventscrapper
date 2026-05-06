import type { VercelRequest, VercelResponse } from '@vercel/node';
// .js extension required for Node ESM resolution at runtime (Vercel).
// TypeScript bundler mode accepts this and resolves to lib/scraper.ts.
import { runScraper } from '../lib/scraper.js';

export const config = {
  // Scraping with Google Search Grounding can take 20-40 seconds.
  // Vercel Hobby plan caps at 60s, Pro at 300s. 60 is plenty.
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    return;
  }

  const pageRaw = req.query.page;
  const pageStr = Array.isArray(pageRaw) ? pageRaw[0] : pageRaw;
  const page = Math.max(1, Math.min(20, parseInt(pageStr || '1', 10) || 1));

  // Cache prevents accidental hammering by aggressive clients.
  // Stale-while-revalidate keeps UX snappy while data refreshes server-side.
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');

  try {
    const events = await runScraper(apiKey, page);
    res.status(200).json({ events, page, fetchedAt: new Date().toISOString() });
  } catch (err: any) {
    const msg = typeof err?.message === 'string'
      ? err.message
      : (typeof err === 'string' ? err : JSON.stringify(err));
    console.error('[/api/scrape] failed:', msg);
    res.status(502).json({ error: msg });
  }
}
