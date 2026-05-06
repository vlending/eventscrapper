# K-pop 앨범 판매 사이트 이벤트 스크래퍼

국내 K-pop 음반 판매 사이트(Ktown4u, Weverse Shop, Withmuu, Makestar, Soundwave, Apple Music, Music Korea 등)의
**팬사인회 / 영상통화 팬사인회 / 팬미팅 / 컴백 쇼케이스 / 럭키드로우 / MD 이벤트** 정보를
Google Search Grounding 기반 Gemini 2.5 Flash로 수집해서 카드 형태로 보여주는 React + Vite 대시보드입니다.

## 기능
- 30+ 국내 K-pop 음반몰을 페이지 단위로 순회 스크래핑 (Deep Scan)
- 한국어 키워드 기반 이벤트 분류: 팬사인회 / 영통팬싸 / 팬미팅 / 쇼케이스 / 럭키드로우 / MD 등
- 칩 형태의 타입 필터, 아티스트/스토어/제목 검색
- 아티스트별·날짜별 그룹 보기
- 무한 스크롤 + Deep Scan으로 더 많은 페이지 로드
- 이벤트 카드: 포스터, 상태(Open/Upcoming/Closed), 신청 기간, 이벤트 일자, 원본 링크

## 실행 방법

### 사전 준비
- Node.js 18+
- [Google AI Studio](https://aistudio.google.com/app/apikey) 에서 Gemini API Key 발급

### 설치 및 실행
```bash
npm install
# .env.local 파일에 GEMINI_API_KEY 입력
npm run dev
```

### `.env.local` 예시
```
GEMINI_API_KEY=발급받은_키
```

### 빌드
```bash
npm run build
npm run preview
```

## 프로젝트 구조
- `App.tsx` — 대시보드 / 필터 / 그룹 보기 / 무한스크롤
- `services/geminiService.ts` — Gemini google_search 도구로 이벤트 수집·파싱
- `components/EventCard.tsx` — 이벤트 카드 (이미지, 상태, 타입 아이콘)
- `components/ScrapeLoader.tsx` — 스크래핑 진행 표시 모달
- `types.ts` — 이벤트/스토어/타입 정의

## 주의사항
- Gemini 응답은 결정적이지 않아 같은 페이지에서도 결과가 매번 약간 달라집니다.
- 스토어 측 이미지 hotlink 차단을 우회하기 위해 `referrerPolicy="no-referrer"`를 사용하지만,
  일부 이미지는 로드 실패 시 그라디언트 폴백으로 대체됩니다.
- 링크가 상품 상세가 아닌 홈페이지로 매핑될 수 있으니, 결과는 참고용으로 활용하세요.
