// Server-only Gemini scraper. NEVER import this file from client/browser code.
// It runs in Vercel Functions (production) and Vite dev middleware (local).

import { GoogleGenAI } from "@google/genai";
// .js extension for Node ESM resolution at runtime (Vercel).
// TypeScript bundler mode resolves this to ../types.ts.
import type { KPopEvent } from "../types.js";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const shuffle = (array: string[]) => {
  return array.sort(() => Math.random() - 0.5);
};

const STORE_DOMAINS: Record<string, string[]> = {
  'Ktown4u': ['ktown4u.com'],
  'Weverse Shop': ['weverseshop.io', 'shop.weverse.io'],
  'Withmuu': ['withmuu.com'],
  'Makestar': ['makestar.com', 'makestar.co'],
  'Soundwave': ['sound-wave.co.kr', 'soundwave.co.kr'],
  'Apple Music': ['applemusic.co.kr'],
  'Music Korea': ['musickorea.asia', 'musickorea.co.kr'],
  'Music Plant': ['musicplant.co.kr', 'musicplant.kr'],
  'Hello Live': ['hellolive.tv', 'hellolive.co.kr'],
  'Blue Dream Media': ['bluedreammedia.com', 'bluedream.kr'],
  'Inter Asia': ['interasia.kr', 'interasia.co.kr'],
  'Mini Record': ['minirecord.net', 'minirecord.co.kr'],
  'Whosfan Store': ['whosfan-store.com', 'whosfanstore.com'],
  'Flink': ['flink.kr', 'flink.co.kr'],
  'Inside Record': ['insiderecord.co.kr', 'insiderecord.com'],
  'JJ Muse': ['jjmuse.com', 'jjmuse.co.kr'],
  'Jump Up': ['jumpup.co.kr'],
  'ITTA': ['itta.co.kr', 'itta.kr'],
  'Mokket Shop': ['mokketshop.com', 'mokket.co.kr'],
  'DMC Music': ['dmcmusic.co.kr', 'dmcmusic.com'],
  'Music & Drama': ['musicndrama.com', 'musicndrama.co.kr'],
  'hello82': ['hello82.com'],
  'K&Pops': ['knpops.com', 'k-and-pops.com'],
  'All MD': ['allmd.shop', 'allmd.kr'],
  'Fanplee': ['fanplee.com', 'fanplee.kr'],
  'Music Art': ['musicart.kr', 'musicart.co.kr'],
  'Rising Star': ['risingstar.kr', 'risingstar.co.kr'],
  'Danal Enter Music': ['danalmusic.com', 'danalentermusic.com'],
  'Amuse Record': ['amuserecord.com', 'amuserecord.co.kr'],
};

const isLinkTrusted = (link: string, store: string): boolean => {
  if (!link || !link.startsWith('http')) return false;
  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase();
    const domains = STORE_DOMAINS[store];
    if (!domains) return true;
    return domains.some(d => host === d || host.endsWith('.' + d));
  } catch {
    return false;
  }
};

const buildSearchFallbackLink = (store: string, artist: string, title: string): string => {
  const domains = STORE_DOMAINS[store] || [];
  const siteHint = domains[0] ? ` site:${domains[0]}` : '';
  const q = encodeURIComponent(`${store} ${artist} ${title}${siteHint}`);
  return `https://www.google.com/search?q=${q}`;
};

export const runScraper = async (apiKey: string, page: number = 1): Promise<KPopEvent[]> => {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server");
  }

  const ai = new GoogleGenAI({ apiKey });
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const todayDot = today.replace(/-/g, '.');
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0].replace(/-/g, '.');
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const majorStores = [
    "Ktown4u (케이타운포유) event board",
    "Weverse Shop (위버스샵) announcements",
    "Withmuu (위드뮤) fansign",
    "Makestar (메이크스타) project",
    "Soundwave (사운드웨이브) event",
    "Apple Music (애플뮤직) fansign",
    "Music Korea (뮤직코리아)",
    "Music Plant (뮤직플랜트)"
  ];

  const otherStores = [
    "Hello Live (헬로라이브)", "Blue Dream Media (블루드림미디어)", "Inter Asia (인터아시아)",
    "Mini Record (미니레코드)", "Whosfan Store (후즈팬)", "Flink (플링크)", "Inside Record (인사이드 레코드)",
    "JJ Muse (제이제이뮤즈)", "Jump Up (점프업)", "ITTA (잇타)", "Mokket Shop (모켓샵)",
    "DMC Music", "Music & Drama (뮤직앤드라마)", "hello82", "K&Pops (케이앤팝스)",
    "All MD (올엠디)", "Fanplee (팬플리)", "Music Art (뮤직아트)", "Rising Star (라이징스타)",
    "Danal Enter Music (다날엔터)", "Amuse Record (어뮤즈)"
  ];

  // Smaller batches per request to stay under the 60s Vercel timeout.
  // Page 1 prioritises the biggest stores; later pages rotate through the rest.
  let targetStores: string[] = [];
  if (page === 1) {
    targetStores = [...majorStores.slice(0, 5), ...otherStores.slice(0, 2)];
  } else {
    const chunkSize = 5;
    const totalOthers = otherStores.length;
    const startIndex = ((page - 2) * chunkSize) % totalOthers;
    targetStores = otherStores.slice(startIndex, startIndex + chunkSize);
    targetStores.push(...shuffle([...majorStores]).slice(0, 1));
  }
  const searchFocus = targetStores.join(', ');

  const prompt = `
    You are a specialized K-Pop Album Sales Event Scraper for Korean retailers.
    Your job is to return ONLY currently-relevant events with verified, accurate data.
    Accuracy beats quantity — skipping uncertain entries is REQUIRED, not optional.

    ============================================================
    CURRENT DATE: ${todayDot} (오늘 = ${currentYear}년 ${currentMonth}월)
    RECENCY WINDOW: Only include events whose application period or event date
                    falls between ${cutoff} and 60 days after ${todayDot}.
                    REJECT anything older than ${cutoff} or with stale dates.
    ============================================================

    Target event types (한국어 키워드 포함):
      - 오프라인 팬사인회 (Offline Fansign)
      - 영상통화 팬사인회 / 영통팬싸 (Video Call Fansign)
      - 팬미팅 / 팬콘 (Fan Meeting / Fan Concert)
      - 컴백 쇼케이스 (Comeback Showcase)
      - 럭키드로우 / 미공포 / 포카이벤트 (Lucky Draw / Photo Card Event)
      - MD/굿즈 발매 이벤트 (MD/Goods launch event)
      - 음반 발매 응모 이벤트 (Album release entry events)

    Scan Context: Page ${page} (Deep Scan)
    Target Stores: ${searchFocus}

    SEARCH STRATEGY (CRITICAL — for recent data):
    1. Use google_search with date-bounded Korean queries. Examples:
       - "케이타운포유 팬사인회 ${currentYear}년 ${currentMonth}월"
       - "위버스샵 영상통화 팬사인회 ${currentYear}"
       - "위드뮤 팬미팅 ${currentYear}년"
       - "사운드웨이브 팬싸 ${currentYear}.${String(currentMonth).padStart(2,'0')}"
       - "메이크스타 ${currentYear} 이벤트"
    2. ALWAYS include the current year (${currentYear}) and ideally month in the query.
    3. Prefer search results dated within the last 30 days.
       If a search hit's snippet shows ${currentYear-1} or earlier with no ${currentYear} reference, IGNORE it.

    DATA QUALITY RULES (STRICT):
    A. Every event MUST have artist, title, store, eventType,
       applicationPeriod OR eventDate within the recency window, and a link.
    B. If you cannot verify any of the above, OMIT THAT CANDIDATE entirely.
       NEVER fabricate or hallucinate.
    C. The 'link' must be on the store's real domain. If only homepage available, OMIT.
    D. Skip events whose application period clearly ENDED before ${todayDot}
       unless they are within the last 30 days (mark "Closed").

    EVENT TYPE LABEL (use exactly):
       "Offline Fansign", "Video Call Fansign", "Fan Meeting",
       "Comeback Showcase", "Lucky Draw", "Photo Event", "MD/Goods Event"

    STATUS:
       "Open" — application period currently accepting
       "Upcoming" — application starts in the future
       "Closed" — application period already ended (within 30 days)

    DATE FORMAT:
       YYYY.MM.DD. Range: "YYYY.MM.DD ~ YYYY.MM.DD". Use "TBA" only if literally TBA / 추후공지.

    THUMBNAIL (OPTIONAL):
       - thumbnailUrl is OPTIONAL. If you cannot find a verified poster image quickly, return "".
       - DO NOT spend search effort on images. Prioritize accurate dates/links/titles.

    OUTPUT REQUIREMENTS:
    - Return between 10 and 20 events (do not exceed 20 — must respond within 50 seconds).
    - Prioritize the most imminent application periods first.
    - Sort by application start date ascending.
    - VALID JSON array only. No markdown, no commentary, no trailing text.

    JSON Object Structure (per event):
    - id: string
    - artist: string
    - title: string
    - store: string
    - eventType: string
    - applicationPeriod: string
    - eventDate: string
    - status: "Open" | "Closed" | "Upcoming"
    - link: string
    - thumbnailUrl: string

    Output ONLY the JSON array.
  `;

  let lastError: any;
  // Vercel Hobby caps functions at 60s. Retries are pointless once Gemini
  // takes >30s, so we run a single attempt with a 50s soft timeout to
  // produce a clean error before the platform kills the function.
  const maxAttempts = 1;
  const SOFT_TIMEOUT_MS = 50_000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const generation = ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        }
      });

      const timeout = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Gemini 응답이 50초 안에 오지 않았습니다. 잠시 후 다시 시도해주세요.')),
          SOFT_TIMEOUT_MS
        )
      );

      const response = await Promise.race([generation, timeout]) as Awaited<typeof generation>;

      const rawText = response.text || "";
      let jsonString = rawText.trim();

      if (jsonString.includes('```json')) {
        jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '');
      } else if (jsonString.includes('```')) {
        jsonString = jsonString.replace(/```/g, '');
      }

      const firstBracket = jsonString.indexOf('[');
      const lastBracket = jsonString.lastIndexOf(']');
      let parsedData: KPopEvent[] = [];

      if (firstBracket !== -1 && lastBracket !== -1) {
        try {
          const cleanedJson = jsonString.substring(firstBracket, lastBracket + 1);
          parsedData = JSON.parse(cleanedJson);
        } catch (parseError) {
          try {
            parsedData = JSON.parse(jsonString);
          } catch {
            throw new Error("Failed to parse server response as JSON.");
          }
        }
      } else {
        if (rawText.length < 50) {
          throw new Error("Received empty or invalid response from AI model.");
        }
        throw new Error("No JSON array found in response.");
      }

      const cutoffMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;
      const futureLimitMs = now.getTime() + 90 * 24 * 60 * 60 * 1000;

      const extractLatestDate = (e: KPopEvent): number | null => {
        const candidates = [e.applicationPeriod, e.eventDate].filter(Boolean) as string[];
        let best: number | null = null;
        for (const raw of candidates) {
          const matches = raw.match(/(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/g) || [];
          for (const m of matches) {
            const norm = m.replace(/[.\-/]/g, '-');
            const t = new Date(norm).getTime();
            if (!isNaN(t) && (best === null || t > best)) best = t;
          }
        }
        return best;
      };

      const validated = parsedData
        .map((event, index) => {
          const trustedLink = isLinkTrusted(event.link, event.store as string);
          const safeLink = trustedLink
            ? event.link
            : buildSearchFallbackLink(event.store as string, event.artist, event.title);
          return {
            ...event,
            id: event.id || `evt-${page}-${index}-${Date.now()}`,
            link: safeLink,
            linkVerified: trustedLink,
            thumbnailUrl: (event.thumbnailUrl && event.thumbnailUrl.startsWith('http'))
              ? event.thumbnailUrl
              : '',
            status: ['Open', 'Closed', 'Upcoming'].includes(event.status)
              ? event.status as 'Open' | 'Closed' | 'Upcoming'
              : 'Open',
          } as KPopEvent;
        })
        .filter(e => {
          if (!e.artist || !e.title || !e.store) return false;
          const t = extractLatestDate(e);
          if (t === null) {
            const blob = `${e.applicationPeriod} ${e.eventDate}`.toLowerCase();
            const looksTba = blob.includes('tba') || blob.includes('추후');
            return looksTba && e.status === 'Upcoming';
          }
          return t >= cutoffMs && t <= futureLimitMs;
        });

      return validated;

    } catch (error: any) {
      console.error(`[scraper] Attempt ${attempt}/${maxAttempts} failed`);
      console.error('  message:', error?.message);
      console.error('  status :', error?.status || error?.code);

      const friendly = toFriendlyError(error);
      lastError = friendly.error;

      // For unrecoverable conditions (quota / auth) STOP RETRYING IMMEDIATELY.
      // Retrying just burns more quota or stays broken.
      if (friendly.fatal) {
        throw friendly.error;
      }

      if (attempt < maxAttempts) {
        await delay(2000 * attempt);
      }
    }
  }

  throw lastError || new Error('Gemini scraper failed after all retry attempts.');
};

// Parse Gemini SDK errors into a plain Error with a Korean-friendly message.
// SDK throws Error whose .message contains a JSON-stringified body like:
//   {"error":{"code":429,"message":"...","status":"RESOURCE_EXHAUSTED",...}}
function toFriendlyError(err: any): { error: Error; fatal: boolean } {
  const rawMsg: string =
    typeof err?.message === 'string' ? err.message :
    typeof err === 'string' ? err :
    '';

  // Extract the embedded JSON if present
  let parsed: any = null;
  const firstBrace = rawMsg.indexOf('{');
  const lastBrace = rawMsg.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      parsed = JSON.parse(rawMsg.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  const inner = parsed?.error || parsed;
  const code = inner?.code || err?.code || err?.status;
  const status = inner?.status || '';
  const innerMsg: string = inner?.message || rawMsg || 'Unknown Gemini error';

  // 429 / RESOURCE_EXHAUSTED — daily free tier quota
  if (code === 429 || status === 'RESOURCE_EXHAUSTED' || /quota|rate limit/i.test(innerMsg)) {
    const retryMatch = innerMsg.match(/retry in ([\d.]+)s/i);
    const retryHint = retryMatch ? ` (약 ${Math.ceil(parseFloat(retryMatch[1]))}초 후 재시도 가능)` : '';
    return {
      error: new Error(
        `Gemini 무료 등급의 하루 요청 한도(20회)를 모두 사용했습니다.${retryHint} ` +
        `내일 다시 시도하시거나, AI Studio에서 결제를 활성화하면 한도가 풀립니다.`
      ),
      fatal: true,
    };
  }

  // 401 / 403 / API_KEY_INVALID — bad key
  if (code === 401 || code === 403 || /api key not valid|permission/i.test(innerMsg)) {
    return {
      error: new Error('Gemini API 키가 유효하지 않거나 권한이 없습니다. Vercel 환경변수를 확인해주세요.'),
      fatal: true,
    };
  }

  // 503 / UNAVAILABLE — transient, allow retry
  if (code === 503 || status === 'UNAVAILABLE' || /unavailable/i.test(innerMsg)) {
    return {
      error: new Error('Gemini 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해주세요.'),
      fatal: false,
    };
  }

  // Empty/invalid AI output — allow retry
  if (/empty|invalid response|no json array|failed to parse/i.test(innerMsg)) {
    return {
      error: new Error('AI 응답을 해석할 수 없었습니다. 다시 시도해주세요.'),
      fatal: false,
    };
  }

  // Unknown — surface inner message, allow retry
  return { error: new Error(innerMsg), fatal: false };
}
