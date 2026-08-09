/* ==================================================================
   소개 페이지 생성기

   고른 순서대로가 아니라 읽기 좋은 순서로 놓는다. 연락처를 첫 번째로
   골랐다고 맨 위에 두면, 무엇을 하는 곳인지도 모르는 사람에게 먼저
   연락처를 들이미는 페이지가 된다.
   ================================================================== */
import { htmlShell, escapeHtml } from './theme.js'

/* 읽는 사람 입장에서 자연스러운 순서 */
const ORDER = ['about', 'features', 'gallery', 'contact']

export function generateLanding(a) {
  const title = a.title || '우리 소개'
  const picked = Array.isArray(a.landingSections) ? a.landingSections : []
  const on = (id) => picked.includes(id)
  const sections = ORDER.filter(on)

  const blocks = sections.map((id) => SECTION[id]()).join('\n\n')

  const body = `  <header style="padding:44px 0 32px;text-align:center">
    <h1 style="font-size:38px;margin-bottom:10px">${escapeHtml(title)}</h1>
    <p class="sub" style="font-size:16px;max-width:460px;margin:0 auto 22px">
      여기에 한 줄 소개를 적으세요. 무엇을 하는 곳인지 한 문장으로 말해주는 자리입니다.
    </p>
    <button class="primary" style="padding:12px 26px;font-size:15px"
      onclick="document.querySelector('main').scrollIntoView({behavior:'smooth'})">
      더 알아보기
    </button>
  </header>

  <main>
${blocks || `    <section class="card">
      <p class="sub" style="margin:0">넣을 내용을 고르지 않으셨어요. 이 자리에 직접 채워 넣으시면 됩니다.</p>
    </section>`}
  </main>

  <footer style="margin-top:56px;padding-top:20px;border-top:1px solid var(--border);
    text-align:center;color:var(--muted);font-size:13px">
    © ${new Date().getFullYear()} ${escapeHtml(title)}
  </footer>`

  /* 페이지에 스크립트가 꼭 필요하지는 않지만, 스크롤에 맞춰 살짝
     떠오르게 하면 훨씬 완성돼 보인다. 움직임을 줄이도록 설정한
     사람에게는 걸지 않는다 — 그 설정은 취향이 아니라 필요다. */
  const script = `var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var blocks = document.querySelectorAll('main section');

if (reduce || !('IntersectionObserver' in window)) {
  /* 관찰을 못 하거나 원치 않으면 그냥 다 보이게 둔다 —
     효과를 못 걸어서 내용이 영영 안 보이는 일은 없어야 한다. */
  blocks.forEach(function (el) { el.style.opacity = 1; });
} else {
  blocks.forEach(function (el) {
    el.style.opacity = 0;
    el.style.transform = 'translateY(14px)';
    el.style.transition = 'opacity .5s ease, transform .5s ease';
  });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.style.opacity = 1;
      en.target.style.transform = 'none';
      io.unobserve(en.target);        // 한 번 떠오르면 그만 본다
    });
  }, { threshold: 0.15 });
  blocks.forEach(function (el) { io.observe(el); });
}`

  const names = { about: '소개', features: '특징', gallery: '갤러리', contact: '연락처' }
  return {
    html: htmlShell({ title, themeId: a.theme, body, script }),
    summary: sections.length
      ? `소개 페이지를 만들었어요. ${sections.map((s) => names[s]).join(' · ')} 순서로 넣었고, 스크롤하면 각 칸이 떠오릅니다.`
      : '소개 페이지 뼈대를 만들었어요. 내용은 직접 채우시면 됩니다.',
  }
}

const wrap = (inner) => `    <section class="card" style="margin-bottom:16px">
${inner}
    </section>`

const SECTION = {
  about: () => wrap(`      <h2 style="margin-top:0">소개</h2>
      <p style="color:var(--muted);margin-bottom:0">
        여기에 자세한 이야기를 적으세요. 어떻게 시작했는지, 무엇을 가장 잘하는지처럼
        한 줄 소개에서 못 다한 말을 담는 자리입니다.
      </p>`),

  features: () => wrap(`      <h2 style="margin-top:0">특징</h2>
      <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
${[['⚡', '빠릅니다', '무엇이 빠른지 적으세요.'],
    ['🎯', '정확합니다', '무엇이 정확한지 적으세요.'],
    ['💛', '친절합니다', '어떻게 친절한지 적으세요.']]
    .map(([icon, h, p]) => `        <div style="background:var(--soft);border-radius:12px;padding:16px">
          <div style="font-size:26px">${icon}</div>
          <b>${h}</b>
          <p style="color:var(--muted);font-size:13px;margin:4px 0 0">${p}</p>
        </div>`).join('\n')}
      </div>`),

  /* 사진은 자리만 잡아둔다. 남의 사진을 링크로 끌어오면 그 주소가
     죽는 순간 페이지가 깨진다. */
  gallery: () => wrap(`      <h2 style="margin-top:0">갤러리</h2>
      <p class="sub" style="margin-top:0">
        아래 칸의 <code>&lt;img src="..."&gt;</code> 에 사진 주소를 넣으면 바뀝니다.
      </p>
      <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
${[1, 2, 3, 4].map((n) => `        <div style="aspect-ratio:4/3;background:var(--soft);border-radius:12px;
          display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px">
          사진 ${n}
        </div>`).join('\n')}
      </div>`),

  contact: () => wrap(`      <h2 style="margin-top:0">연락처</h2>
      <p style="color:var(--muted)">궁금한 점이 있으면 언제든 연락 주세요.</p>
      <div class="row" style="flex-wrap:wrap">
        <a href="mailto:hello@example.com"
          style="color:var(--accent);font-weight:700;text-decoration:none">✉ hello@example.com</a>
        <span style="color:var(--border)">|</span>
        <a href="#" style="color:var(--accent);font-weight:700;text-decoration:none">🔗 링크</a>
      </div>`),
}
