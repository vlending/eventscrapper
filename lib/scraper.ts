// Server-only Gemini scraper. NEVER import this file from client/browser code.
// It runs in Vercel Functions (production) and Vite dev middleware (local).

import { GoogleGenAI } from "@google/genai";
import type { KPopEvent } from "../types";

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

  let targetStores: string[] = [];
  if (page === 1) {
    targetStores = [...majorStores, ...otherStores.slice(0, 4)];
  } else {
    const chunkSize = 8;
    const totalOthers = otherStores.length;
    const startIndex = ((page - 2) * chunkSize) % totalOthers;
    targetStores = otherStores.slice(startIndex, startIndex + chunkSize);
    targetStores.push(...shuffle([...majorStores]).slice(0, 2));
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
    - Return ALL events you can find in the recency window. Aim for 25 to 50 events.
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
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        }
      });

      await delay(500);

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
      console.error(`[scraper] Attempt ${attempt} failed:`, error?.message || error);
      lastError = error;
      if (attempt < maxAttempts) {
        await delay(2000 * attempt);
      }
    }
  }

  throw lastError || new Error("Failed to fetch events after multiple attempts.");
};
