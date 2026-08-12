/* ==================================================================
   영어 단어장 생성기

   사전 1200개를 통째로 넣고, 난이도를 고르면 그 등급에서 무작위로
   뽑아 문제를 낸다. 문제 유형은 셋:

     1. 스펠링 → 뜻 고르기      (보기 4개)
     2. 뜻 → 스펠링 직접 쓰기   (타이핑)
     3. 문장 빈칸에 들어갈 낱말 (보기 4개)

   오답 보기는 반드시 같은 등급에서 뽑는다. 초급 문제에 상급 단어가
   섞이면 길이만 보고도 답이 보인다 — 문제가 아니라 눈속임이 된다.
   ================================================================== */
import { htmlShell, storageJs, beepJs, escapeHtml } from './theme.js'
import { WORDS, LEVELS } from './words.js'

/* 사전을 만들어 낼 코드에 심는다. 한 줄에 하나씩 적으면 1200줄이라
   파일이 길어지므로, 사람이 읽을 일 없는 이 부분만 촘촘히 적는다. */
function dictJs() {
  const tier = (list) => list
    .map(([w, m, s, tr]) =>
      `[${JSON.stringify(w)},${JSON.stringify(m)},${JSON.stringify(s)},${JSON.stringify(tr)}]`)
    .join(',\n')
  return `var DICT = {
easy: [
${tier(WORDS.easy)}
],
normal: [
${tier(WORDS.normal)}
],
hard: [
${tier(WORDS.hard)}
]
};`
}

export function generateVocab(a) {
  const title = a.title || '영어 단어장'
  const keep = a.save === 'yes'
  /* 안 고르면 세 유형을 다 넣는다 — 유형이 하나도 없는 단어장은
     만들어 봐야 쓸 수가 없다 */
  const picked = Array.isArray(a.vocabTypes) ? a.vocabTypes.filter((t) => t !== 'none') : []
  const types = picked.length ? picked : ['meaning', 'spelling', 'blank']

  const body = `  <header style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:18px">
    <div style="margin-right:auto">
      <h1>${escapeHtml(title)}</h1>
      <p class="sub" style="margin:0">단어 1200개 · 초급 400 · 중급 400 · 상급 400</p>
    </div>
    <nav class="row">
      <button id="navStudy" class="primary">학습</button>
      <button id="navDict">단어 도감</button>
    </nav>
  </header>

  <!-- ================= 단어 도감 ================= -->
  <section id="dict" hidden>
    <div class="row" id="dictLevels" style="flex-wrap:wrap"></div>
    <input id="dictSearch" placeholder="단어나 뜻으로 찾기 (예: apple, 사과)"
      autocomplete="off" style="width:100%;margin-top:12px">
    <div class="row" style="justify-content:space-between;margin:12px 0 10px;flex-wrap:wrap">
      <span class="sub" style="margin:0" id="dictCount"></span>
      <span class="row" id="dictFilters"></span>
    </div>
    <div id="dictList"></div>
  </section>

  <!-- ================= 시작 화면 ================= -->
  <section id="home">
    <h2 style="font-size:16px;margin:0 0 10px">난이도를 고르세요</h2>
    <div id="levels" style="display:grid;gap:10px"></div>

    <h2 style="font-size:16px;margin:26px 0 10px">문제 유형</h2>
    <div id="types" style="display:grid;gap:8px"></div>

    <div class="card" id="records" style="margin-top:22px"></div>
  </section>

  <!-- ================= 푸는 화면 ================= -->
  <section id="play" hidden>
    <div class="bar"><div class="bar-fill" id="progressBar"></div></div>
    <div class="row" style="justify-content:space-between;margin:10px 0 16px">
      <span class="sub" style="margin:0" id="progress"></span>
      <span class="sub" style="margin:0" id="tally"></span>
    </div>
    <div class="card">
      <div class="tag" id="typeTag"></div>
      <h2 id="q" style="font-size:21px;margin:10px 0 18px;line-height:1.45"></h2>
      <div id="choices" style="display:grid;gap:8px"></div>
      <div id="typing" hidden>
        <input id="answerInput" placeholder="스펠링을 그대로 입력하세요"
          autocomplete="off" autocapitalize="off" spellcheck="false" style="width:100%;font-size:17px">
        <button class="primary" id="submitAnswer" style="margin-top:10px;width:100%">확인</button>
      </div>
      <div id="after" style="margin-top:16px"></div>
    </div>
  </section>

  <!-- ================= 결과 화면 ================= -->
  <section id="result" hidden>
    <div class="card" style="text-align:center">
      <div style="font-size:52px;line-height:1" id="face">🎉</div>
      <h2 id="score" style="margin:10px 0 2px"></h2>
      <p class="sub" id="best" style="margin:0"></p>
      <div class="row" style="justify-content:center;flex-wrap:wrap;margin-top:18px">
        <button class="primary" id="again">같은 난이도로 다시</button>
        <button id="againWrong" hidden>틀린 단어만 다시</button>
        <button id="home2">난이도 바꾸기</button>
      </div>
    </div>
    <h3 style="font-size:15px;margin:22px 0 10px">오답 노트</h3>
    <div id="review"></div>
  </section>`

  const extraCss = `.bar { height: 6px; background: var(--border); border-radius: 99px; overflow: hidden; }
.bar-fill { height: 100%; width: 0; background: var(--accent); border-radius: 99px; transition: width .3s ease; }
.tag {
  display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: .04em;
  background: var(--soft); color: var(--accent); padding: 3px 9px; border-radius: 99px;
}
.pick {
  text-align: left; width: 100%; padding: 13px 15px; line-height: 1.45;
  display: flex; gap: 10px; align-items: flex-start;
}
.pick .num {
  flex: none; width: 21px; height: 21px; border-radius: 6px; font-size: 12px; font-weight: 700;
  background: var(--soft); color: var(--accent); display: grid; place-items: center;
}
.ok { background: #16a34a !important; border-color: #16a34a !important; color: #fff !important; }
.ng { background: #dc2626 !important; border-color: #dc2626 !important; color: #fff !important; }
.ok .num, .ng .num { background: rgba(255,255,255,.25); color: #fff; }
.lvl { text-align: left; padding: 14px 16px; display: flex; align-items: center; gap: 12px; }
.lvl b { font-size: 15px; }
.lvl .go { margin-left: auto; color: var(--accent); font-weight: 700; }
.chip { padding: 9px 14px; text-align: left; }
.chip.on { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 700; }
/* 스펠링을 쓸 때는 글자 하나하나가 또렷해야 한다 */
#answerInput { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: .04em; }
.miss { color: #dc2626; font-weight: 700; }

/* ---------- 단어 도감 ---------- */
.entry { padding: 13px 15px; margin-bottom: 7px; }
.entry .w {
  font-size: 16px; font-weight: 700; letter-spacing: .01em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.entry .mean { color: var(--fg); font-size: 14px; margin-top: 2px; }
/* 사용 예는 한 단계 물러나 보이게 — 뜻을 먼저 읽어야 한다 */
.entry .ex {
  color: var(--muted); font-size: 13px; margin-top: 7px;
  padding-left: 10px; border-left: 2px solid var(--border); line-height: 1.55;
}
.entry .ex b { color: var(--accent); }
/* 번역은 예문보다 한 단계 더 물러난다 — 영어 문장을 먼저 읽고,
   막히면 그다음에 확인하는 순서가 자연스럽다 */
.entry .ex-tr {
  color: var(--muted); font-size: 12px; margin: 3px 0 0 12px;
  opacity: .8;
}
.badge {
  flex: none; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px;
  border: 1px solid var(--border); color: var(--muted);
}
.badge.right { border-color: #16a34a; color: #16a34a; }
.badge.wrong { border-color: #dc2626; color: #dc2626; }
.more { width: 100%; margin-top: 8px; }`

  const script = `${dictJs()}

var LEVELS = ${JSON.stringify(LEVELS)};
var TYPES = ${JSON.stringify(types)};
var TYPE_INFO = {
  meaning: { tag: '뜻 고르기', label: '스펠링 보고 뜻 맞히기' },
  spelling: { tag: '스펠링 쓰기', label: '뜻 보고 스펠링 직접 쓰기' },
  blank: { tag: '빈칸 채우기', label: '문장에 들어갈 낱말 고르기' }
};

${storageJs(keep, 'vocab.' + (a.title || 'default'))}

${beepJs}

var store = load({ best: {}, wrong: [], right: [] });
var best = store.best || {};
store.wrong = store.wrong || [];
store.right = store.right || [];      // 한 번이라도 맞힌 단어 (도감의 학습 상태)

var level = 'easy';
var dictLevel = 'easy';               // 도감에서 보고 있는 등급
var dictQuery = '';
var dictFilter = 'all';               // all | wrong | right | new
var dictLimit = 60;                   // 처음에 이만큼만 그린다
var useTypes = TYPES.slice();      // 지금 켜 놓은 유형
var quiz = [];                     // 이번 판 문제들
var pos = 0;
var picks = [];
var locked = false;

function $(id) { return document.getElementById(id); }
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function persist() {
  save({ best: best, wrong: store.wrong, right: store.right });
}

/* 등급+번호로 단어 하나를 가리키는 열쇠. 등급이 다르면 같은 번호라도
   다른 단어이므로 번호만으로는 안 된다. */
function keyOf(lvl, i) { return lvl + ':' + i; }
function inList(list, lvl, i) {
  var k = keyOf(lvl, i);
  for (var n = 0; n < list.length; n++) {
    if (keyOf(list[n].level, list[n].index) === k) return n;
  }
  return -1;
}

/* 그 단어의 학습 상태 — 도감이 이걸로 표시를 고른다.
   틀린 적이 있으면 나중에 맞혔더라도 '복습'이 우선이다. */
function statusOf(lvl, i) {
  if (inList(store.wrong, lvl, i) >= 0) return 'wrong';
  if (inList(store.right, lvl, i) >= 0) return 'right';
  return 'new';
}
var STATUS_TEXT = { wrong: '복습 필요', right: '맞힘', new: '아직' };

/* 셔플 — 뒤에서부터 무작위 자리와 바꾼다 (Fisher-Yates).
   sort(() => Math.random() - 0.5) 는 고르게 섞이지 않는다. */
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/* ------------------------------------------------------------------
   문제 만들기
   ------------------------------------------------------------------ */
/* 오답 보기는 같은 등급에서만 뽑는다. 등급을 섞으면 길이나 난이도만
   보고도 답이 보여서 문제가 되지 않는다. */
function distractors(pool, correctIndex, n, field) {
  var out = [];
  var used = { };
  used[correctIndex] = true;
  var guard = 0;
  while (out.length < n && guard++ < 500) {
    var i = Math.floor(Math.random() * pool.length);
    if (used[i]) continue;
    /* 뜻이나 단어가 정답과 똑같으면 보기로 쓸 수 없다 —
       정답이 둘이 되어 버린다 */
    if (pool[i][field] === pool[correctIndex][field]) continue;
    used[i] = true;
    out.push(pool[i]);
  }
  return out;
}

function makeQuiz(lvl, only) {
  var pool = DICT[lvl];
  var conf = LEVELS.filter(function (l) { return l.id === lvl; })[0];
  var indexes;
  if (only && only.length) {
    indexes = only.slice();
  } else {
    indexes = shuffle(pool.map(function (_, i) { return i; })).slice(0, conf.count);
  }
  return indexes.map(function (i, n) {
    var type = useTypes[n % useTypes.length];
    var entry = pool[i];
    var item = { level: lvl, index: i, type: type, word: entry[0], meaning: entry[1] };
    if (type === 'spelling') {
      item.prompt = '"' + entry[1] + '" 을(를) 영어로 쓰면?';
      item.answer = entry[0];
    } else if (type === 'blank') {
      item.prompt = entry[2].replace('___', '_____');
      var wrongW = distractors(pool, i, 3, 0);
      item.choices = shuffle([entry[0]].concat(wrongW.map(function (e) { return e[0]; })));
      item.answer = item.choices.indexOf(entry[0]);
    } else {
      item.prompt = entry[0];
      var wrongM = distractors(pool, i, 3, 1);
      item.choices = shuffle([entry[1]].concat(wrongM.map(function (e) { return e[1]; })));
      item.answer = item.choices.indexOf(entry[1]);
    }
    return item;
  });
}

/* ------------------------------------------------------------------
   시작 화면
   ------------------------------------------------------------------ */
function renderHome() {
  $('levels').innerHTML = LEVELS.map(function (l) {
    var b = best[l.id];
    return '<button class="lvl" data-level="' + l.id + '">'
      + '<span><b>' + l.name + '</b><br><span class="sub" style="margin:0;font-size:12px">'
      + l.desc + '</span></span>'
      + '<span class="go">' + (b != null ? '최고 ' + b + '점' : '시작') + ' →</span>'
      + '</button>';
  }).join('');

  $('types').innerHTML = TYPES.map(function (t) {
    return '<button class="chip' + (useTypes.indexOf(t) >= 0 ? ' on' : '') + '" data-type="' + t + '">'
      + (useTypes.indexOf(t) >= 0 ? '✓ ' : '') + TYPE_INFO[t].label + '</button>';
  }).join('');

  var w = store.wrong || [];
  $('records').innerHTML = w.length
    ? '<div class="row" style="justify-content:space-between;flex-wrap:wrap">'
      + '<span><b>틀린 단어 ' + w.length + '개</b><br>'
      + '<span class="sub" style="margin:0;font-size:12px">'
      + w.slice(0, 6).map(function (x) { return esc(x.word); }).join(', ')
      + (w.length > 6 ? ' 외 ' + (w.length - 6) + '개' : '') + '</span></span>'
      + '<span class="row"><button id="reviewWrong">모아서 복습</button>'
      + '<button id="clearWrong">비우기</button></span></div>'
    : '<p class="sub" style="margin:0">아직 오답 노트가 비어 있어요. 한 판 풀어보세요.</p>';
}

function toggleType(t) {
  var i = useTypes.indexOf(t);
  if (i >= 0) {
    /* 마지막 하나까지 끄면 낼 문제가 없어진다 */
    if (useTypes.length === 1) return;
    useTypes.splice(i, 1);
  } else {
    useTypes.push(t);
  }
  /* 고른 순서가 아니라 원래 순서를 지킨다 — 껐다 켤 때마다
     유형 순서가 바뀌면 어수선하다 */
  useTypes = TYPES.filter(function (x) { return useTypes.indexOf(x) >= 0; });
  renderHome();
}

/* ------------------------------------------------------------------
   단어 도감 — 등급별로 뜻·스펠링·사용 예를 훑어보는 곳

   푸는 화면에서는 예문의 그 자리가 빈칸이지만, 도감에서는 단어를
   채워 넣어 보여준다. 도감의 목적은 맞히는 게 아니라 "이 단어가
   문장에서 어떻게 쓰이는지" 보는 것이다.
   ------------------------------------------------------------------ */
function renderDict() {
  $('dictLevels').innerHTML = LEVELS.map(function (l) {
    return '<button class="chip' + (dictLevel === l.id ? ' on' : '') + '" data-dlevel="' + l.id + '">'
      + l.name + ' <span style="opacity:.7">' + DICT[l.id].length + '</span></button>';
  }).join('');

  var pool = DICT[dictLevel];
  var counts = { all: pool.length, wrong: 0, right: 0, new: 0 };
  pool.forEach(function (_, i) { counts[statusOf(dictLevel, i)]++; });

  $('dictFilters').innerHTML = [
    ['all', '전체'], ['wrong', '복습 필요'], ['right', '맞힘'], ['new', '아직']
  ].map(function (f) {
    return '<button class="chip' + (dictFilter === f[0] ? ' on' : '') + '" data-dfilter="' + f[0] + '"'
      + ' style="padding:5px 10px;font-size:12px">' + f[1] + ' ' + counts[f[0]] + '</button>';
  }).join('');

  /* 단어로도 뜻으로도 찾을 수 있어야 한다 — 뜻이 기억날 때가 더 많다 */
  var q = dictQuery.trim().toLowerCase();
  var rows = [];
  for (var i = 0; i < pool.length; i++) {
    var e = pool[i];
    if (dictFilter !== 'all' && statusOf(dictLevel, i) !== dictFilter) continue;
    if (q && e[0].toLowerCase().indexOf(q) < 0 && e[1].toLowerCase().indexOf(q) < 0) continue;
    rows.push({ i: i, e: e });
  }

  $('dictCount').textContent = q || dictFilter !== 'all'
    ? rows.length + '개 찾음'
    : pool.length + '개';

  if (!rows.length) {
    $('dictList').innerHTML = '<div class="empty">찾는 단어가 없어요.</div>';
    return;
  }

  var shown = rows.slice(0, dictLimit);
  $('dictList').innerHTML = shown.map(function (r) {
    var st = statusOf(dictLevel, r.i);
    /* 예문의 빈칸을 단어로 메워 실제 쓰임을 보여준다.
       빈칸 앞뒤로 띄워 둔 공백이 그대로 남으면 "in the kitchen ." 처럼
       읽히므로, 문장부호 앞 공백은 여기서 붙여 준다. */
    var ex = esc(r.e[2])
      .replace('___', '<b>' + esc(r.e[0]) + '</b>')
      .replace(/\\s+([.,!?;:])/g, '$1');
    /* 문장 번역 — 영어 예문만 봐서는 전체 뜻까지 알기 어렵다.
       r.e[3] 가 없는(옛 데이터) 경우에도 죽지 않도록 감싼다. */
    var exTr = r.e[3] ? '<div class="ex-tr">' + esc(r.e[3]) + '</div>' : '';
    return '<div class="card entry">'
      + '<div class="row" style="justify-content:space-between;align-items:flex-start">'
      + '<span class="w">' + esc(r.e[0]) + '</span>'
      + '<span class="badge ' + st + '">' + STATUS_TEXT[st] + '</span></div>'
      + '<div class="mean">' + esc(r.e[1]) + '</div>'
      + '<div class="ex">' + ex + '</div>'
      + exTr
      + '</div>';
  }).join('')
    /* 200개를 한꺼번에 그리면 느린 기기에서 눈에 띄게 버벅인다 */
    + (rows.length > shown.length
      ? '<button class="more" id="dictMore">더 보기 (' + (rows.length - shown.length) + '개 남음)</button>'
      : '');
}

/* ------------------------------------------------------------------
   푸는 화면
   ------------------------------------------------------------------ */
function go(v) {
  ['home', 'play', 'result', 'dict'].forEach(function (id) { $(id).hidden = id !== v; });
  $('navStudy').className = v === 'dict' ? '' : 'primary';
  $('navDict').className = v === 'dict' ? 'primary' : '';
  if (v === 'home') renderHome();
  if (v === 'dict') renderDict();
}

function start(lvl, only) {
  level = lvl;
  quiz = makeQuiz(lvl, only);
  pos = 0;
  picks = [];
  go('play');
  showQuestion();
}

function showQuestion() {
  locked = false;
  var item = quiz[pos];
  var right = countRight();

  $('progressBar').style.width = (pos / quiz.length) * 100 + '%';
  $('progress').textContent = (pos + 1) + ' / ' + quiz.length + '문제';
  $('tally').textContent = right + '개 맞힘';
  $('typeTag').textContent = TYPE_INFO[item.type].tag;
  $('q').textContent = item.prompt;
  $('after').innerHTML = '';

  if (item.type === 'spelling') {
    $('choices').innerHTML = '';
    $('typing').hidden = false;
    $('answerInput').value = '';
    $('answerInput').disabled = false;
    $('submitAnswer').disabled = false;
    $('answerInput').focus();
  } else {
    $('typing').hidden = true;
    $('choices').innerHTML = item.choices.map(function (c, i) {
      return '<button class="pick" data-pick="' + i + '">'
        + '<span class="num">' + (i + 1) + '</span><span>' + esc(c) + '</span></button>';
    }).join('');
  }
}

function countRight() {
  var n = 0;
  for (var i = 0; i < picks.length; i++) {
    if (picks[i] != null && picks[i].correct) n++;
  }
  return n;
}

function pick(i) {
  if (locked || quiz[pos].type === 'spelling') return;
  locked = true;
  var item = quiz[pos];
  var correct = i === item.answer;
  picks[pos] = { correct: correct, given: item.choices[i] };
  var btns = document.querySelectorAll('[data-pick]');
  for (var n = 0; n < btns.length; n++) {
    var v = Number(btns[n].dataset.pick);
    if (v === item.answer) btns[n].classList.add('ok');
    else if (v === i) btns[n].classList.add('ng');
    btns[n].disabled = true;
  }
  afterAnswer(correct, item.choices[item.answer]);
}

function submitSpelling() {
  if (locked) return;
  locked = true;
  var item = quiz[pos];
  var given = $('answerInput').value.trim();
  /* 대소문자와 앞뒤 공백은 봐준다 — 스펠링을 묻는 문제지
     대문자를 묻는 문제가 아니다. */
  var correct = given.toLowerCase() === item.answer.toLowerCase();
  picks[pos] = { correct: correct, given: given };
  $('answerInput').disabled = true;
  $('submitAnswer').disabled = true;
  afterAnswer(correct, item.answer, given);
}

/* 어디가 틀렸는지 글자 단위로 짚어준다. 정답만 보여주면
   내가 어디서 틀렸는지 스스로 찾아야 한다. */
function diffHtml(given, answer) {
  var out = '';
  var max = Math.max(given.length, answer.length);
  for (var i = 0; i < max; i++) {
    var g = given[i];
    var b = answer[i];
    if (g == null) out += '<span class="miss">_</span>';
    else if (g.toLowerCase() === (b || '').toLowerCase()) out += esc(g);
    else out += '<span class="miss">' + esc(g) + '</span>';
  }
  return out;
}

function afterAnswer(correct, answerText, given) {
  var item = quiz[pos];
  if (correct) rememberRight(item); else rememberWrong(item);
  var last = pos === quiz.length - 1;
  var detail = correct ? '정답입니다!'
    : item.type === 'spelling'
      ? '아쉬워요. 정답은 <b>' + esc(answerText) + '</b>'
        + (given ? ' — 내가 쓴 것: ' + diffHtml(given, answerText) : '')
      : '아쉬워요. 정답은 <b>' + esc(answerText) + '</b>';
  $('after').innerHTML =
    '<div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px">'
    + '<span class="sub" style="margin:0">' + detail + '</span>'
    + '<button class="primary" id="next">' + (last ? '결과 보기' : '다음 문제') + '</button>'
    + '</div>';
  $('next').focus();
}

/* 틀린 단어를 모아 둔다. 같은 단어를 또 틀려도 한 번만 담는다. */
function rememberWrong(item) {
  if (inList(store.wrong, item.level, item.index) < 0) {
    store.wrong.push({ level: item.level, index: item.index, word: item.word });
  }
  persist();
}

/* 맞히면 오답 노트에서 빼준다. 한 번 틀린 단어가 영영 남아 있으면
   노트가 계속 불어나기만 해서 "아직 못 외운 단어"라는 뜻을 잃는다. */
function rememberRight(item) {
  var at = inList(store.wrong, item.level, item.index);
  if (at >= 0) store.wrong.splice(at, 1);
  if (inList(store.right, item.level, item.index) < 0) {
    store.right.push({ level: item.level, index: item.index, word: item.word });
  }
  persist();
}

function next() {
  pos++;
  if (pos >= quiz.length) finish();
  else showQuestion();
}

function finish() {
  var right = countRight();
  var pct = Math.round((right / quiz.length) * 100);
  go('result');
  $('face').textContent = pct === 100 ? '🏆' : pct >= 70 ? '😄' : pct >= 40 ? '🙂' : '💪';
  $('score').textContent = quiz.length + '문제 중 ' + right + '문제 정답 (' + pct + '점)';

  var prev = best[level];
  var isNew = prev == null || pct > prev;
  if (isNew) { best[level] = pct; persist(); }
  $('best').textContent = isNew ? '최고 기록을 새로 세웠어요!' : '최고 기록 ' + prev + '점';

  var wrongIdx = [];
  $('review').innerHTML = quiz.map(function (item, i) {
    var p = picks[i] || { correct: false, given: '' };
    if (!p.correct) wrongIdx.push(item.index);
    return '<div class="card" style="margin-bottom:8px;border-left:3px solid '
      + (p.correct ? '#16a34a' : '#dc2626') + '">'
      + '<div style="font-weight:700;font-size:14px">'
      + (p.correct ? '⭕ ' : '❌ ') + esc(item.word) + ' — ' + esc(item.meaning) + '</div>'
      + (p.correct ? ''
        : '<div class="sub" style="margin:6px 0 0;font-size:12px">'
          + TYPE_INFO[item.type].tag + ' · 내 답: ' + (p.given ? esc(p.given) : '(없음)') + '</div>')
      + '</div>';
  }).join('');

  $('againWrong').hidden = wrongIdx.length === 0;
  $('againWrong').onclick = function () { start(level, wrongIdx); };
  beep();
}

/* ------------------------------------------------------------------
   입력 받기
   ------------------------------------------------------------------ */
document.addEventListener('click', function (e) {
  var t = e.target.closest ? e.target.closest('button') : e.target;
  if (!t) return;
  if (t.dataset.pick != null) pick(Number(t.dataset.pick));
  else if (t.dataset.level) start(t.dataset.level, null);
  else if (t.dataset.type) toggleType(t.dataset.type);
  else if (t.id === 'next') next();
  else if (t.id === 'submitAnswer') submitSpelling();
  else if (t.id === 'again') start(level, null);
  else if (t.id === 'home2' || t.id === 'navStudy') go('home');
  else if (t.id === 'navDict') go('dict');
  else if (t.dataset.dlevel) { dictLevel = t.dataset.dlevel; dictLimit = 60; renderDict(); }
  else if (t.dataset.dfilter) { dictFilter = t.dataset.dfilter; dictLimit = 60; renderDict(); }
  else if (t.id === 'dictMore') { dictLimit += 60; renderDict(); }
  else if (t.id === 'reviewWrong') {
    /* 오답 노트는 등급이 섞여 있으니, 가장 많이 틀린 등급으로 몬다 */
    var byLevel = {};
    (store.wrong || []).forEach(function (x) { (byLevel[x.level] = byLevel[x.level] || []).push(x.index); });
    var top = Object.keys(byLevel).sort(function (a, b) { return byLevel[b].length - byLevel[a].length; })[0];
    if (top) start(top, byLevel[top]);
  } else if (t.id === 'clearWrong') {
    store.wrong = [];
    persist();
    renderHome();
  }
});

$('dictSearch').addEventListener('input', function (e) {
  dictQuery = e.target.value;
  dictLimit = 60;        // 새로 검색하면 처음부터 보여준다
  renderDict();
});

document.addEventListener('keydown', function (e) {
  if (!$('play').hidden) {
    var item = quiz[pos];
    if (item && item.type === 'spelling') {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (locked) next(); else submitSpelling();
      }
      return;
    }
    if (/^[1-9]$/.test(e.key)) {
      var btn = document.querySelector('[data-pick="' + (Number(e.key) - 1) + '"]');
      if (btn && !btn.disabled) { e.preventDefault(); pick(Number(e.key) - 1); }
    } else if (e.key === 'Enter' && $('next')) {
      e.preventDefault();
      next();
    }
  }
});

go('home');`

  const typeNames = {
    meaning: '스펠링 보고 뜻 맞히기',
    spelling: '뜻 보고 스펠링 쓰기',
    blank: '문장 빈칸 채우기',
  }
  return {
    html: htmlShell({ title, themeId: a.theme, body, script, extraCss }),
    summary: `영어 단어장을 만들었어요. 단어 1200개(초급·중급·상급 각 400개)가 들어 있고, `
      + `난이도를 고르면 그 등급에서 무작위로 뽑아 냅니다 `
      + `(쉬움 10문제 · 보통 15문제 · 상급 30문제). `
      + `문제 유형은 ${types.map((t) => typeNames[t]).join(', ')}이고, `
      + `틀린 단어는 오답 노트에 모아 두었다가 모아서 다시 풀 수 있어요. `
      + `[단어 도감]에서는 등급별로 뜻·스펠링·사용 예를 훑어볼 수 있고, `
      + `단어나 뜻으로 찾거나 아직 못 외운 것만 골라 볼 수 있습니다.`,
  }
}
