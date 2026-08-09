/* ==================================================================
   할 일 목록 생성기

   고른 항목(마감일·중요도·분류)에 따라 입력칸과 목록 모양이 달라진다.
   안 고른 기능의 코드는 아예 만들지 않는다 — 쓰지도 않는 코드가 파일에
   남아 있으면 나중에 읽는 사람이 "이건 뭐지"부터 해야 한다.
   ================================================================== */
import { htmlShell, storageJs, escapeHtml } from './theme.js'

export function generateTodo(a) {
  const f = Array.isArray(a.todoFields) ? a.todoFields : []
  /* '제목만'을 골랐으면 다른 선택은 무시한다 — 같이 고르면 뜻이 어긋난다 */
  const plain = f.includes('none')
  const due = !plain && f.includes('due')
  const pri = !plain && f.includes('priority')
  const tag = !plain && f.includes('tag')
  const title = a.title || '할 일 목록'
  const keep = a.save === 'yes'

  /* ---------- 화면 ---------- */
  const inputs = [
    '      <input id="text" placeholder="할 일을 적어보세요" style="flex:1;min-width:160px">',
    due ? '      <input id="due" type="date" aria-label="마감일">' : '',
    pri ? `      <select id="pri" aria-label="중요도">
        <option value="1">보통</option>
        <option value="2">🔥 높음</option>
        <option value="0">낮음</option>
      </select>` : '',
    tag ? '      <input id="tag" placeholder="분류" style="width:110px" aria-label="분류">' : '',
    '      <button class="primary" id="add">추가</button>',
  ].filter(Boolean).join('\n')

  const body = `  <h1>${escapeHtml(title)}</h1>
  <p class="sub">할 일을 적고 <b>추가</b>를 누르세요. 다 한 일은 눌러서 지웁니다.</p>

  <div class="card">
    <div class="row">
${inputs}
    </div>
  </div>
${tag ? '\n  <div class="row" id="filters" style="margin-top:14px;flex-wrap:wrap"></div>\n' : ''}
  <div id="list" style="margin-top:16px"></div>
  <p class="sub" id="count" style="margin-top:16px"></p>`

  /* ---------- 동작 ---------- */
  const PRI_LABEL = pri
    ? `var PRI = { 2: { text: '높음', color: '#ef4444' }, 1: { text: '보통', color: 'var(--muted)' }, 0: { text: '낮음', color: 'var(--muted)' } };\n`
    : ''

  const script = `${storageJs(keep, 'todo.' + (a.title || 'default'))}

var items = load([]);
${tag ? "var filter = 'all';\n" : ''}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
${due ? `/* 오늘 날짜를 'YYYY-MM-DD' 로 — 날짜 입력칸이 쓰는 형식과 맞춘다.
   toISOString() 은 UTC 기준이라 한국 시간 새벽에 하루가 밀린다. */
function today() {
  var d = new Date();
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}
` : ''}${PRI_LABEL}
function add() {
  var text = document.getElementById('text').value.trim();
  if (!text) return;                       // 빈 줄이 쌓이면 목록이 지저분해진다
  var item = { id: Date.now(), text: text, done: false };
${due ? "  item.due = document.getElementById('due').value || '';\n" : ''}${pri ? "  item.pri = Number(document.getElementById('pri').value);\n" : ''}${tag ? "  item.tag = document.getElementById('tag').value.trim();\n" : ''}  items.push(item);
  document.getElementById('text').value = '';
${tag ? "  document.getElementById('tag').value = '';\n" : ''}  save(items);
  render();
  document.getElementById('text').focus();   // 연달아 여러 개 적을 때 손이 안 멈추게
}

function toggle(id) {
  items = items.map(function (it) {
    return it.id === id ? Object.assign({}, it, { done: !it.done }) : it;
  });
  save(items); render();
}

function remove(id) {
  items = items.filter(function (it) { return it.id !== id; });
  save(items); render();
}
${tag ? `
function renderFilters() {
  var tags = [];
  items.forEach(function (it) {
    if (it.tag && tags.indexOf(it.tag) === -1) tags.push(it.tag);
  });
  var box = document.getElementById('filters');
  if (!tags.length) { box.innerHTML = ''; return; }
  var all = ['all'].concat(tags);
  box.innerHTML = all.map(function (t) {
    var on = filter === t;
    return '<button data-filter="' + esc(t) + '" style="'
      + (on ? 'background:var(--accent);border-color:var(--accent);color:#fff;font-weight:700' : '')
      + '">' + (t === 'all' ? '전체' : esc(t)) + '</button>';
  }).join('');
}
` : ''}
function render() {
${tag ? `  renderFilters();
  var shown = items.filter(function (it) { return filter === 'all' || it.tag === filter; });
` : '  var shown = items;\n'}${pri ? `  /* 중요한 것이 위로. 같은 중요도면 넣은 순서를 지킨다 —
     매번 순서가 바뀌면 어디를 눌러야 할지 눈이 다시 찾아야 한다. */
  shown = shown.slice().sort(function (x, y) { return (y.pri || 0) - (x.pri || 0); });
` : ''}
  var list = document.getElementById('list');
  if (!shown.length) {
    list.innerHTML = '<p class="empty">아직 없습니다. 위에 적어보세요.</p>';
  } else {
    list.innerHTML = shown.map(function (it) {
      var meta = [];
${pri ? `      if (PRI[it.pri]) {
        meta.push('<span style="color:' + PRI[it.pri].color + '">' + PRI[it.pri].text + '</span>');
      }
` : ''}${due ? `      if (it.due) {
        var late = !it.done && it.due < today();
        meta.push('<span style="color:' + (late ? '#ef4444' : 'var(--muted)') + '">'
          + (late ? '⚠ ' : '📅 ') + esc(it.due) + '</span>');
      }
` : ''}${tag ? `      if (it.tag) meta.push('<span style="color:var(--muted)">🏷 ' + esc(it.tag) + '</span>');
` : ''}      return '<div class="card" style="margin-bottom:8px;display:flex;align-items:center;gap:10px">'
        + '<input type="checkbox" data-toggle="' + it.id + '"' + (it.done ? ' checked' : '')
        + ' style="width:18px;height:18px;flex:none" aria-label="완료">'
        + '<div style="flex:1;min-width:0">'
        + '<div style="' + (it.done ? 'text-decoration:line-through;color:var(--muted)' : '') + '">'
        + esc(it.text) + '</div>'
        + (meta.length ? '<div style="font-size:12px;display:flex;gap:10px;margin-top:2px">' + meta.join('') + '</div>' : '')
        + '</div>'
        + '<button data-remove="' + it.id + '" aria-label="삭제">✕</button>'
        + '</div>';
    }).join('');
  }

  var left = items.filter(function (it) { return !it.done; }).length;
  document.getElementById('count').textContent =
    items.length ? '남은 일 ' + left + '개 / 전체 ' + items.length + '개' : '';
}

/* 목록은 계속 다시 그려지므로 버튼마다 이벤트를 붙이면 그릴 때마다
   새로 달아야 한다. 위에서 한 번만 받아 누가 눌렸는지 보고 나눈다. */
document.addEventListener('click', function (e) {
  var t = e.target;
  if (t.id === 'add') add();
  else if (t.dataset.remove) remove(Number(t.dataset.remove));
${tag ? "  else if (t.dataset.filter) { filter = t.dataset.filter; render(); }\n" : ''}});
document.addEventListener('change', function (e) {
  if (e.target.dataset.toggle) toggle(Number(e.target.dataset.toggle));
});
/* 엔터로도 추가되게 — 적고 나서 마우스로 손을 옮기는 건 번거롭다 */
document.getElementById('text').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') add();
});

render();`

  const features = [
    due && '마감일(지나면 빨갛게)',
    pri && '중요도 정렬',
    tag && '분류별 보기',
    keep && '새로고침해도 유지',
  ].filter(Boolean)

  return {
    html: htmlShell({ title, themeId: a.theme, body, script }),
    summary: `할 일 목록을 만들었어요. ${features.length ? features.join(' · ') + ' 기능이 들어갔습니다.' : '제목만 담는 가장 단순한 형태입니다.'}`,
  }
}
