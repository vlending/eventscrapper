# 호스팅 가이드

## ⚠️ 보안 경고 — 먼저 읽으세요

이 앱은 Gemini API 키를 **클라이언트 번들에 포함**시켜 빌드합니다
([vite.config.ts](vite.config.ts) 의 `define: process.env.API_KEY`).
공개 호스팅하면 누구나 브라우저 개발자도구 → Sources에서 키를 추출할 수 있습니다.

**호스팅 전 필수 조치 (둘 중 하나):**

### A) 키에 HTTP 리퍼러 제한 걸기 (간편)
1. [Google AI Studio API Keys](https://aistudio.google.com/app/apikey) 접속
2. 사용 중인 키 클릭 → "Edit API key"
3. **Application restrictions** → **HTTP referrers (web sites)** 선택
4. 허용 리퍼러에 본인 배포 도메인 추가:
   - 예) `https://your-app.vercel.app/*`
   - 예) `https://your-app.netlify.app/*`
5. 저장
- 효과: 다른 사이트에서 키를 훔쳐도 호출이 거부됨
- 한계: 키 자체는 여전히 공개

### B) 서버리스 함수로 옮기기 (권장)
Gemini 호출을 Vercel/Netlify Functions로 이동시켜 키를 서버에 두는 방법.
별도 작업이 필요하므로 원하시면 코드 변경을 추가로 진행해드립니다.

---

## 옵션 1. Vercel 배포 (권장 — 무료, 가장 쉬움)

### CLI 없이 GitHub 연동으로 배포
1. 이 폴더를 GitHub 저장소로 푸시
2. https://vercel.com 가입 → "Add New Project" → GitHub 저장소 선택
3. **Environment Variables** 에 `GEMINI_API_KEY = <발급받은 키>` 추가 (Production/Preview/Development 모두)
4. Framework Preset: `Vite` 자동 인식됨
5. **Deploy** 클릭 → 1분 내 `https://<프로젝트명>.vercel.app` 발급
6. (위 보안조치 A 적용) 발급된 도메인을 Google API Key 리퍼러에 추가

### CLI로 배포 (선택)
```cmd
npm i -g vercel
cd "C:\Users\pendo\Documents\Kpop event scrapper"
vercel login
vercel             # 첫 배포 (Preview)
vercel --prod      # 프로덕션 배포
```
환경변수는 Vercel 웹 대시보드 또는 `vercel env add GEMINI_API_KEY` 로 등록.

---

## 옵션 2. Netlify 배포 (대안 — 무료)

1. https://app.netlify.com 가입 → "Add new site" → "Import from Git"
2. 저장소 선택. `netlify.toml` 자동 인식
3. **Site settings → Environment variables** 에 `GEMINI_API_KEY` 추가
4. Deploy → `https://<random>.netlify.app` 발급
5. 보안조치 A 적용

---

## 옵션 3. Cloudflare Tunnel (임시 공개 URL — 5분 테스트용)

cloudflared를 설치하면 회원가입/배포 없이 즉시 공개 URL을 얻을 수 있습니다.

```cmd
:: cloudflared 설치 (winget)
winget install --id Cloudflare.cloudflared

:: 새 터미널에서 dev 서버 실행
cd "C:\Users\pendo\Documents\Kpop event scrapper"
npm run dev

:: 또 다른 터미널에서 터널 실행
cloudflared tunnel --url http://localhost:3000
```
출력 결과 끝쯤에 `https://xxx-xxx-xxx.trycloudflare.com` 주소가 나옵니다 — 이 URL로 외부에서 접속 가능.
- 터널 종료(Ctrl+C) 시 URL은 사라짐
- 영구 URL을 원하면 Cloudflare 계정 + Named Tunnel 필요

---

## 옵션 4. 같은 네트워크에서만 접근 (집/사무실 내부망)

vite는 이미 `0.0.0.0` 에 바인딩됩니다. 같은 와이파이 사용자라면:

1. dev 서버 실행: `npm run dev`
2. Windows 방화벽에서 3000 포트 인바운드 허용 (관리자 권한 cmd):
   ```cmd
   netsh advfirewall firewall add rule name="Kpop Scraper Dev" dir=in action=allow protocol=TCP localport=3000
   ```
3. 같은 네트워크 기기에서 `http://192.168.0.67:3000` 접속

⚠️ 이 방식은 인터넷 노출이 아니라 **로컬 네트워크 한정**입니다.

---

## 추천 흐름

1. 먼저 **옵션 4**로 같은 네트워크에서 동작 확인
2. 외부 공유가 필요하면 **옵션 3** (cloudflared) 으로 단기 테스트
3. 영구 호스팅 원하면 **옵션 1** (Vercel) — 무조건 보안조치 A 또는 B 함께 적용
