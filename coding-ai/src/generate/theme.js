/* ==================================================================
   만들어 낼 코드의 껍데기

   어떤 종류를 만들든 공통으로 필요한 것 — 색, 여백, 밝은/어두운 화면,
   글꼴 — 을 한곳에 모은다. 종류별 생성기는 알맹이만 채우면 된다.

   결과물은 파일 하나짜리 HTML 이다. 그래야 미리보기 창에 그대로
   띄울 수 있고, 받아서 두 번 누르면 바로 열린다. 초보자에게 "빌드를
   먼저 하세요"라고 말해야 하는 순간 그 코드는 안 쓰이게 된다.
   ================================================================== */

/* 테마마다 강조색 한 쌍. 밝은 화면과 어두운 화면에서 각각 읽히는
   명도를 따로 골랐다 — 하나만 쓰면 한쪽에서 반드시 묻힌다. */
export const THEME_COLORS = {
  violet: { accent: '#7c3aed', accentDark: '#a78bfa', soft: '#f3f0ff', softDark: '#2a1f4d' },
  blue: { accent: '#2563eb', accentDark: '#7aa7ff', soft: '#eff6ff', softDark: '#16294d' },
  emerald: { accent: '#059669', accentDark: '#4ade80', soft: '#ecfdf5', softDark: '#0f3a2c' },
  amber: { accent: '#d97706', accentDark: '#fbbf24', soft: '#fffbeb', softDark: '#402a0c' },
  rose: { accent: '#e11d48', accentDark: '#fb7185', soft: '#fff1f2', softDark: '#4a1626' },
}

export const themeOf = (id) => THEME_COLORS[id] || THEME_COLORS.violet

/* 사람이 넣은 글자가 그대로 HTML 이 되면 화면이 깨진다.
   제목에 <  를 넣는 사람은 드물지만, 드물다고 안 막을 이유는 없다. */
export function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/* 만들어 낸 자바스크립트 안에 문자열로 박아 넣을 때 쓴다 */
export const jsString = (s = '') => JSON.stringify(String(s))

/* ------------------------------------------------------------------
   공통 스타일

   CSS 변수로 색을 빼두면 어두운 화면 대응이 규칙 한 벌로 끝난다.
   색을 곳곳에 직접 적어두면 다크 모드를 붙일 때 전부 다시 찾아야 한다.
   ------------------------------------------------------------------ */
export function baseCss(themeId, extra = '') {
  const t = themeOf(themeId)
  return `:root {
  --accent: ${t.accent};
  --soft: ${t.soft};
  --bg: #ffffff;
  --fg: #18181b;
  --muted: #71717a;
  --card: #fafafa;
  --border: #e4e4e7;
}
/* 기기 설정이 어두운 화면이면 알아서 따라간다 */
@media (prefers-color-scheme: dark) {
  :root {
    --accent: ${t.accentDark};
    --soft: ${t.softDark};
    --bg: #0b0b12;
    --fg: #f4f4f5;
    --muted: #a1a1aa;
    --card: #15151d;
    --border: #2a2a33;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 28px 16px 72px;
  background: var(--bg);
  color: var(--fg);
  font-family: system-ui, -apple-system, "Segoe UI", "Malgun Gothic", sans-serif;
  line-height: 1.65;
  /* 글자가 또렷해진다 — 특히 어두운 배경에서 차이가 크다 */
  -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 680px; margin: 0 auto; }
h1 { font-size: 28px; margin: 0 0 4px; letter-spacing: -0.02em; line-height: 1.25; }
h2, h3 { letter-spacing: -0.01em; }
.sub { color: var(--muted); font-size: 14px; margin: 0 0 24px; }

button {
  font: inherit; cursor: pointer; border-radius: 10px;
  border: 1px solid var(--border); background: var(--card); color: var(--fg);
  padding: 9px 14px;
  transition: filter .15s, background .15s, border-color .15s, transform .06s;
}
button:hover:not([disabled]) { filter: brightness(1.06); border-color: var(--accent); }
/* 눌리는 느낌 — 눌렸는지 아닌지 모르면 두 번 누르게 된다 */
button:active:not([disabled]) { transform: translateY(1px); }
button[disabled] { cursor: default; opacity: .65; }
button.primary {
  background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 700;
}
/* 키보드로 넘길 때 지금 어디인지 보여야 한다 */
button:focus-visible, input:focus-visible, select:focus-visible, [tabindex]:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px;
}
input, select {
  font: inherit; padding: 9px 11px; border-radius: 10px;
  border: 1px solid var(--border); background: var(--bg); color: var(--fg);
  transition: border-color .15s;
}
input:focus, select:focus { border-color: var(--accent); }
input::placeholder { color: var(--muted); opacity: .7; }

.card {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 14px; padding: 16px;
}
.row { display: flex; gap: 8px; align-items: center; }
.empty {
  color: var(--muted); text-align: center; padding: 36px 20px;
  border: 1px dashed var(--border); border-radius: 14px;
}

/* 화면이 좁으면 한 줄에 밀어 넣지 않고 접는다 */
@media (max-width: 520px) {
  .row { flex-wrap: wrap; }
  h1 { font-size: 23px; }
  body { padding: 20px 13px 56px; }
}
/* 움직임을 줄이도록 설정한 사람에게는 걸지 않는다 — 취향이 아니라 필요다 */
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}${extra ? '\n\n' + extra : ''}`
}

/* 브라우저에 남기는 저장소.

   save 를 안 골랐으면 아무것도 하지 않는 같은 모양의 함수를 넣는다.
   호출하는 쪽에서 if 로 갈라놓으면 저장을 껐다 켤 때마다 알맹이 코드를
   고쳐야 하는데, 이렇게 두면 이 두 줄만 바뀐다. */
export function storageJs(enabled, key) {
  if (!enabled) {
    return `/* 저장을 쓰지 않는 설정으로 만들어졌습니다.
   나중에 남기고 싶어지면 아래 두 함수의 속을 채우면 됩니다. */
function load(fallback) { return fallback; }
function save() {}`
  }
  return `/* 브라우저에 남긴다 — 서버가 없어도 되고, 이 기기에만 저장된다.
   사파리 비공개 모드처럼 저장이 막힌 곳에서도 앱이 죽지 않도록 감싼다. */
var STORE_KEY = ${jsString(key)};
function load(fallback) {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function save(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
}`
}

/* 알림음 — 소리 파일을 딸려 보내면 파일 하나로 끝나지 않는다.
   그래서 브라우저가 직접 음을 만들게 한다. */
export const beepJs = `/* 짧은 알림음. 소리 파일 없이 브라우저가 직접 음을 만든다. */
function beep() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(); osc.stop(ctx.currentTime + 0.5);
  } catch (e) {}
}`

/* 완성된 한 장짜리 HTML */
export function htmlShell({ title, themeId, body, script, extraCss = '' }) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${baseCss(themeId, extraCss)}
</style>
</head>
<body>
<div class="wrap">
${body}
</div>
<script>
${script}
</script>
</body>
</html>
`
}
