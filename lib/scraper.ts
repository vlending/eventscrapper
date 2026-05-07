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

  // Smaller batches to stay well under the 60s Vercel timeout.
  // 4 stores per request is the sweet spot with thinking disabled.
  let targetStores: string[] = [];
  if (page === 1) {
    targetStores = [...majorStores.slice(0, 4)];
  } else {
    const chunkSize = 4;
    const totalOthers = otherStores.length;
    const startIndex = ((page - 2) * chunkSize) % totalOthers;
    targetStores = otherStores.slice(startIndex, startIndex + chunkSize);
  }
  const searchFocus = targetStores.join(', ');

  // Compact prompt — short prompts let Gemini start search faster.
  const prompt = `K-Pop 음반 판매 사이트 이벤트 스크래퍼.
오늘: ${todayDot}. 신청 기간 또는 이벤트 일자가 ${cutoff} ~ ${todayDot} 이후 60일 이내인 것만 포함.

대상 스토어 (이번 페이지): ${searchFocus}

이벤트 종류 (한국어 키워드, 영문 라벨 정확히):
- 오프라인 팬사인회 → "Offline Fansign"
- 영상통화 팬사인회 / 영통팬싸 → "Video Call Fansign"
- 팬미팅 / 팬콘 → "Fan Meeting"
- 컴백 쇼케이스 → "Comeback Showcase"
- 럭키드로우 / 미공포 / 포카 → "Lucky Draw"
- MD/굿즈 → "MD/Goods Event"
- 포토 이벤트 → "Photo Event"

google_search 사용. 검색어에 반드시 ${currentYear}년 또는 ${currentYear}.${String(currentMonth).padStart(2,'0')} 포함.
예: "케이타운포유 팬사인회 ${currentYear}년 ${currentMonth}월", "위버스샵 영통팬싸 ${currentYear}".

규칙:
- artist/title/store/eventType + (applicationPeriod 또는 eventDate) + link 모두 필수.
- link는 스토어 실제 도메인의 상세 페이지여야 함. 홈페이지면 제외.
- 검증 불가하면 항목 생략. 절대 추측·환각 금지.
- 날짜는 YYYY.MM.DD. 기간은 "YYYY.MM.DD ~ YYYY.MM.DD".
- thumbnailUrl 은 선택. 빨리 못 찾으면 "" 반환. 이미지 검색에 시간 쓰지 마세요.

상태:
- Open: 신청 기간이 오늘을 포함
- Upcoming: 신청 시작이 미래
- Closed: 신청 기간이 30일 이내에 종료됨

출력:
- 5~15개 이벤트. 10개 검증되면 더 찾지 말고 즉시 반환.
- 신청 시작일 오름차순 정렬.
- JSON 배열만 출력 (마크다운 없이).

각 객체: { id, artist, title, store, eventType, applicationPeriod, eventDate, status, link, thumbnailUrl }`;

  let lastError: any;
  // Vercel Hobby caps functions at 60s. We run a single attempt with a
  // 55s soft timeout and Gemini "thinking" disabled (otherwise the model
  // burns 20-40s reasoning before it even starts the search).
  const maxAttempts = 1;
  const SOFT_TIMEOUT_MS = 55_000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const generation = ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          // Disable thinking mode — Search Grounding is the slow part,
          // we don't need extra latency from chain-of-thought.
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const timeout = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Gemini 응답이 55초 안에 오지 않았습니다. 다시 시도하시면 캐시 덕분에 더 빠를 수 있습니다.')),
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
