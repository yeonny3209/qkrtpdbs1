# 배포 가이드 — My 3D Game Universe

이 프로젝트는 Vite로 빌드되는 정적 웹사이트(SPA)입니다.
`npm run build` → `dist/` 폴더를 어떤 정적 호스팅에 올려도 바로 웹사이트가 됩니다.

> ⚠️ **실행 위치 주의** — 모든 `npm` 명령은 `my-3d-game` 폴더 **안에서** 실행해야 합니다.
> (상위 폴더 `yunny_game`에는 `package.json`이 없어 `ENOENT` 에러가 납니다.)
>
> ```bash
> cd my-3d-game        # ← 먼저 프로젝트 폴더로 이동
> npm run build
> ```
>
> 폴더 이동 없이 한 줄로 실행하려면: `npm --prefix my-3d-game run build`

> `react-router-dom`을 쓰므로 `/rpg`, `/dragon` 주소를 새로고침해도 404가 나지 않게
> **SPA 폴백 설정**이 필요합니다. 아래 방법들은 그 설정을 이미 포함합니다.
> (Netlify → `public/_redirects`, Vercel → `vercel.json` 이 저장소에 들어 있습니다.)

---

## 방법 1. Netlify Drop — 가장 쉬움 (계정 없이 1분)

1. 터미널에서 빌드 (프로젝트 폴더 안에서):
   ```bash
   cd my-3d-game
   npm run build
   ```
2. 브라우저로 <https://app.netlify.com/drop> 접속
3. 생성된 **`my-3d-game\dist` 폴더를 통째로 드래그 앤 드롭**
4. 즉시 `https://랜덤이름.netlify.app` 주소가 발급됩니다 (공유 가능)

`public/_redirects` 덕분에 딥링크 새로고침도 정상 동작합니다.

---

## 방법 2. Vercel (깃 연동 · 자동 재배포)

1. GitHub에 이 저장소를 push
2. <https://vercel.com> 로그인 → **Add New → Project** → 저장소 선택
3. 설정 자동 감지 (Vite):
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Root Directory: `my-3d-game` (모노레포일 경우 지정)
4. Deploy → `https://프로젝트.vercel.app`

`vercel.json`의 rewrites가 딥링크를 처리합니다. 이후 push할 때마다 자동 재배포됩니다.

---

## 방법 3. GitHub Pages (무료 · 약간의 설정 필요)

Pages는 `github.io/저장소이름/` 처럼 **하위 경로**로 서비스되므로 `base` 설정이 필요합니다.

1. `vite.config.js`에 base 추가:
   ```js
   export default defineConfig({
     base: '/저장소이름/',            // 예: '/my-3d-game/'
     plugins: [react(), tailwindcss()],
   })
   ```
2. `src/main.jsx`의 라우터에 basename 지정 — 또는 `App.jsx`의
   `<BrowserRouter>`를 `<BrowserRouter basename="/저장소이름">`로 변경
   (Pages는 서버 rewrite가 안 되므로 `dist/404.html`을 `index.html` 복사본으로
   두는 처리가 추가로 필요합니다.)
3. `npm run build` 후 `dist/`를 `gh-pages` 브랜치로 push
   (또는 `npm i -D gh-pages` 후 `"deploy": "gh-pages -d dist"` 스크립트 사용)

> 설정이 번거로우면 **방법 1(Netlify Drop)** 또는 **방법 2(Vercel)** 를 추천합니다.
> 두 방법은 루트 경로(`/`)로 서비스되어 별도 base 설정이 필요 없습니다.

---

## 🌐 인터넷 멀티플레이 서버 (공유 사냥터)

RPG의 「같이 하기」를 **다른 기기의 가족·친구와** 쓰려면 릴레이 서버가 필요합니다.
서버 코드는 [`server/main.ts`](server/main.ts) 한 파일이 전부입니다.

### Deno Deploy에 올리기 (무료 · 카드 불필요 · 약 3분)

1. <https://dash.deno.com> 접속 → **Sign in with GitHub**
2. **New Playground** 클릭
3. `server/main.ts` 파일 내용을 통째로 붙여넣기
4. **Save & Deploy** → 오른쪽에 `https://이름.deno.dev` 주소가 생깁니다
5. 그 주소를 `src/net/config.js`의 `WS_URL`에 넣고 다시 빌드·배포:
   ```js
   export const WS_URL = 'https://이름.deno.dev'   // https여도 자동으로 wss 변환됨
   ```

`WS_URL`이 비어 있으면 기존처럼 **같은 브라우저의 탭끼리만** 연결되는
로컬 모드로 동작하므로, 서버 없이도 게임은 항상 정상입니다.

> 서버를 바꿔가며 시험하려면 빌드 없이 브라우저 콘솔에서:
> `localStorage.setItem('rpg_ws_url', 'wss://주소')` → 새로고침.
> `'off'`를 넣으면 강제 로컬 모드, 지우면 기본값으로 돌아갑니다.

---

## 로컬에서 프로덕션 빌드 미리보기

```bash
npm run build
npm run preview     # http://localhost:4173 에서 dist/ 를 서빙
```

## 참고 — 용량 최적화 (선택)

- `public/dagger.glb`(약 1.9MB), `public/icons.svg`는 현재 코드에서 참조되지 않는
  미사용 에셋입니다. 삭제하면 배포 용량이 줄어듭니다.
- JS 번들이 약 1.3MB(gzip 359KB)입니다. 초기 로딩을 더 빠르게 하려면
  `React.lazy`로 `/rpg`, `/dragon` 라우트를 코드 스플리팅할 수 있습니다.
