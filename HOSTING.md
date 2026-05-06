# 호스팅 가이드 (서버리스 함수 버전)

## ✅ 이 빌드의 보안 모델

이 프로젝트는 Gemini 호출을 **Vercel Serverless Function** ([api/scrape.ts](api/scrape.ts))으로 옮겨두었습니다.

- 클라이언트 번들에는 Gemini 키도, Gemini SDK도 들어있지 않습니다.
- 키는 Vercel 환경변수 `GEMINI_API_KEY`에서만 살아있고, Function 런타임 안에서만 읽힙니다.
- 로컬 개발에서는 [vite.config.ts](vite.config.ts)의 dev 미들웨어가 같은 [lib/scraper.ts](lib/scraper.ts)를 호출하므로
  `.env.local`의 키 또한 클라이언트 번들에는 박히지 않습니다.

→ 따라서 **HTTP referrer 제한 같은 추가 조치는 선택 사항**입니다(중요도 낮음). 다만 키 도용 시 무료 한도 보호용으로 걸어두는 것은 여전히 권장.

---

## 옵션 1. Vercel 배포 (권장)

### A. GitHub + Vercel 웹 (가장 쉬움)

**1) GitHub 저장소 만들고 푸시**

[github.com/new](https://github.com/new) 에서 새 저장소 생성 (예: `kpop-event-scraper`, **Private 권장**).

```cmd
cd "C:\Users\pendo\Documents\Kpop event scrapper"
git remote add origin https://github.com/<본인계정>/kpop-event-scraper.git
git push -u origin main
```

**2) Vercel 연동**

1. [vercel.com](https://vercel.com) 가입 → GitHub 로그인
2. **Add New → Project** → 위에서 만든 저장소 선택 → **Import**
3. Framework: **Vite** 자동 인식, [vercel.json](vercel.json) 자동 적용
4. **Environment Variables** 펼치기:
   - Name: `GEMINI_API_KEY`
   - Value: `.env.local` 의 키 그대로 붙여넣기
   - Environments: ✅ Production ✅ Preview ✅ Development
5. **Deploy** 클릭 → 약 1분 후 `https://<프로젝트명>.vercel.app` 발급
6. (선택) Google AI Studio에서 키 사용량 모니터링 알람 설정

### B. Vercel CLI 직접 배포

```cmd
cd "C:\Users\pendo\Documents\Kpop event scrapper"
npm i -g vercel
vercel login
vercel env add GEMINI_API_KEY production    :: 키 입력
vercel env add GEMINI_API_KEY preview
vercel env add GEMINI_API_KEY development
vercel --prod
```

---

## 옵션 2. Netlify 배포 (대안)

Netlify는 Vercel과 함수 사양이 다릅니다. 이 프로젝트의 [api/scrape.ts](api/scrape.ts)는 Vercel 형식이라 Netlify에서 동작시키려면 별도 변환이 필요합니다(Netlify Functions로 래핑).
권장: Vercel 사용. Netlify가 꼭 필요하면 별도 작업으로 변환 가능합니다.

---

## 옵션 3. Cloudflare Tunnel (임시 공개 URL)

현재 PC에서 `npm run dev`로 띄운 서버를 외부에 잠깐 노출시키는 용도.

```cmd
winget install --id Cloudflare.cloudflared

:: 터미널 A
cd "C:\Users\pendo\Documents\Kpop event scrapper"
npm run dev

:: 터미널 B
cloudflared tunnel --url http://localhost:3000
```
출력에 `https://xxx.trycloudflare.com` 임시 URL이 나타납니다.

---

## 옵션 4. 같은 네트워크에서만 (LAN)

Vite가 `0.0.0.0`에 바인딩됩니다. 같은 와이파이 사용자라면:

```cmd
:: 관리자 cmd 한 번
netsh advfirewall firewall add rule name="Kpop Scraper Dev" dir=in action=allow protocol=TCP localport=3000

:: 일반 cmd
npm run dev
```
같은 네트워크에서 `http://192.168.0.67:3000` 접속.

---

## 환경변수 정리

| 변수 | 위치 | 용도 |
|---|---|---|
| `GEMINI_API_KEY` | `.env.local` (로컬) | Vite dev 미들웨어가 읽음 |
| `GEMINI_API_KEY` | Vercel Project Settings | Vercel Function 런타임이 읽음 |

`.env.local`은 `.gitignore`에 의해 git에 절대 올라가지 않습니다.

---

## 동작 검증 체크리스트

- [ ] `npm run dev` → http://localhost:3000 → 자동으로 첫 스캔 → 결과 카드 표시
- [ ] 브라우저 개발자도구 Network 탭에 `/api/scrape?page=1` 호출 보임
- [ ] `view-source:` 또는 dist/assets/*.js 검색해도 `AIza` 키와 `GoogleGenAI` 모두 없음
- [ ] 배포 후 `https://<프로젝트>.vercel.app` 동일하게 동작
