import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Vite dev middleware that mounts /api/scrape locally using the same
// server-side scraper code that Vercel runs in production. The key never
// reaches the client — it's read from .env.local on the Node side here.
const scrapeApiPlugin = (geminiKey: string): Plugin => ({
  name: 'kpop-scrape-dev-api',
  configureServer(server) {
    server.middlewares.use('/api/scrape', async (req, res) => {
      if (req.method !== 'GET') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }
      if (!geminiKey) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'GEMINI_API_KEY missing in .env.local' }));
        return;
      }

      const url = new URL(req.url || '', 'http://localhost');
      const pageNum = Math.max(1, Math.min(20, parseInt(url.searchParams.get('page') || '1', 10) || 1));

      try {
        const { runScraper } = await server.ssrLoadModule('/lib/scraper.ts');
        const events = await runScraper(geminiKey, pageNum);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ events, page: pageNum, fetchedAt: new Date().toISOString() }));
      } catch (err: any) {
        const msg = typeof err?.message === 'string'
          ? err.message
          : (typeof err === 'string' ? err : JSON.stringify(err));
        console.error('[/api/scrape dev] failed:', msg);
        if (err?.cause) console.error('  cause:', err.cause);
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: msg }));
      }
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      scrapeApiPlugin(env.GEMINI_API_KEY),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
