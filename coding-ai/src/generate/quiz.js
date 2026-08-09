/* ==================================================================
   퀴즈 생성기

   예전에는 예시 문제 세 개를 넣어 두고 "코드 맨 위 QUESTIONS 를
   고치세요"라고 안내했다. 코딩을 모르는 사람에게 그건 안내가 아니다.
   주제를 물어봐 놓고 정작 그 주제 문제는 하나도 없는 파일을 주는 셈이라,
   받아 보면 속은 기분이 든다.

   그래서 문제를 넣고 고치는 화면을 앱 안에 넣었다. 코드를 열 일이 없다.
   시작할 때 가짜 문제로 채우지도 않는다 — 빈 채로 열고 "첫 문제를
   만들어 보세요"라고 말한다. 어떻게 노는지 보고 싶으면 예시를 한 번에
   넣는 버튼이 따로 있다.
   ================================================================== */
import { htmlShell, storageJs, beepJs, escapeHtml, jsString } from './theme.js'

export function generateQuiz(a) {
  const title = a.title || '퀴즈'
  const topic = (a.quizTopic || '').trim()
  const limit = a.quizTimer && a.quizTimer !== 'none' ? Number(a.quizTimer) : 0
  const keep = a.save === 'yes'

  const body = `  <header style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:20px">
    <div style="margin-right:auto">
      <h1>${escapeHtml(title)}</h1>
      <p class="sub" style="margin:0">${topic ? escapeHtml(topic) + ' 퀴즈' : '나만의 퀴즈'}</p>
    </div>
    <nav class="row" role="tablist">
      <button id="tabPlay" class="primary">풀기</button>
      <button id="tabEdit">문제 만들기</button>
    </nav>
  </header>

  <!-- ================= 푸는 화면 ================= -->
  <section id="play" hidden>
    <div class="bar"><div class="bar-fill" id="progressBar"></div></div>
    <div class="row" style="justify-content:space-between;margin:10px 0 16px">
      <span class="sub" style="margin:0" id="progress"></span>
      <span class="sub" style="margin:0" id="clock"></span>
    </div>
${limit ? `    <div class="bar" style="margin-bottom:16px">
      <div class="bar-fill" id="timeBar" style="background:var(--accent);transition:width .25s linear"></div>
    </div>
` : ''}    <div class="card">
      <h2 id="q" style="font-size:20px;margin:0 0 18px;line-height:1.45"></h2>
      <div id="choices" style="display:grid;gap:8px"></div>
      <div id="after" style="margin-top:16px"></div>
    </div>
    <p class="sub" style="margin-top:12px;font-size:12px">
      숫자키 1~9 로 답을 고르고, Enter 로 넘어갈 수 있어요.
    </p>
  </section>

  <!-- ================= 결과 화면 ================= -->
  <section id="result" hidden>
    <div class="card" style="text-align:center">
      <div style="font-size:52px;line-height:1" id="face">🎉</div>
      <h2 id="score" style="margin:10px 0 2px"></h2>
      <p class="sub" id="best" style="margin:0"></p>
      <div class="row" style="justify-content:center;flex-wrap:wrap;margin-top:18px">
        <button class="primary" id="again">다시 풀기</button>
        <button id="againWrong" hidden>틀린 것만 다시</button>
        <button id="toEdit2">문제 고치기</button>
      </div>
    </div>
    <h3 style="font-size:15px;margin:22px 0 10px">문항별 결과</h3>
    <div id="review"></div>
  </section>

  <!-- ================= 문제 만드는 화면 ================= -->
  <section id="edit" hidden>
    <div class="card" style="margin-bottom:16px">
      <h2 style="font-size:16px;margin:0 0 4px" id="formTitle">새 문제 추가</h2>
      <p class="sub" style="margin:0 0 14px">정답 옆의 동그라미를 눌러 정답을 정하세요.</p>

      <label class="lab" for="fq">질문</label>
      <input id="fq" placeholder="예: apple 의 뜻은?" style="width:100%">

      <label class="lab" style="margin-top:14px">보기</label>
      <div id="fchoices"></div>
      <button id="addChoice" style="margin-top:8px">+ 보기 추가</button>

      <div class="row" style="margin-top:16px;flex-wrap:wrap">
        <button class="primary" id="saveQ">문제 저장</button>
        <button id="cancelQ" hidden>취소</button>
        <span class="sub" id="formMsg" style="margin:0 0 0 auto"></span>
      </div>
    </div>

    <div class="row" style="justify-content:space-between;margin:0 0 10px">
      <h3 style="font-size:15px;margin:0">만든 문제 <span id="count" class="sub"></span></h3>
      <span class="row">
        <button id="exportBtn">파일로 내보내기</button>
        <button id="importBtn">가져오기</button>
        <input id="importFile" type="file" accept=".json,application/json" hidden>
      </span>
    </div>
    <div id="qlist"></div>
${keep ? '' : `    <p class="sub" style="margin-top:16px;font-size:12px;color:#f59e0b">
      ⚠ 저장을 끄고 만들어서 새로고침하면 문제가 사라집니다.
      <b>파일로 내보내기</b>로 보관해 두세요.
    </p>
`}  </section>`

  const extraCss = `.bar { height: 6px; background: var(--border); border-radius: 99px; overflow: hidden; }
.bar-fill { height: 100%; width: 0; background: var(--accent); border-radius: 99px; transition: width .3s ease; }
.lab { display: block; font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 5px; }
.pick {
  text-align: left; width: 100%; padding: 13px 15px; line-height: 1.45;
  display: flex; gap: 10px; align-items: flex-start;
}
/* 보기 앞의 번호 — 숫자키로 고를 수 있다는 걸 눈으로 알려준다 */
.pick .num {
  flex: none; width: 21px; height: 21px; border-radius: 6px; font-size: 12px; font-weight: 700;
  background: var(--soft); color: var(--accent); display: grid; place-items: center;
}
.pick[disabled] { cursor: default; opacity: 1; }
.ok { background: #16a34a !important; border-color: #16a34a !important; color: #fff !important; }
.ng { background: #dc2626 !important; border-color: #dc2626 !important; color: #fff !important; }
.ok .num, .ng .num { background: rgba(255,255,255,.25); color: #fff; }
.qrow { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 8px; }
.qrow .idx { flex: none; color: var(--muted); font-size: 12px; width: 22px; padding-top: 2px; }
.crow { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
.crow input[type=text] { flex: 1; min-width: 0; }
.crow input[type=radio] { width: 18px; height: 18px; flex: none; accent-color: var(--accent); }`

  const script = `${storageJs(keep, 'quiz.' + (a.title || 'default'))}

${beepJs}

var TOPIC = ${jsString(topic)};
${limit ? `var LIMIT = ${limit};\n` : ''}
/* ------------------------------------------------------------------
   상태
   ------------------------------------------------------------------ */
var saved = load({ questions: [], best: 0 });
var questions = saved.questions || [];
var best = saved.best || 0;

var view = 'play';
var order = [];        // 이번 판에 풀 문제들의 원래 번호
var pos = 0;
var picks = [];        // 문항별로 무엇을 골랐는지 (-1 = 시간 초과)
var locked = false;
var editing = -1;      // 고치는 중인 문제 번호 (-1 이면 새 문제)
${limit ? 'var left = 0;\nvar ticker = null;\n' : ''}
function persist() { save({ questions: questions, best: best }); }

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function $(id) { return document.getElementById(id); }

/* ------------------------------------------------------------------
   화면 전환
   ------------------------------------------------------------------ */
function go(next) {
  view = next;
${limit ? '  stopTimer();\n' : ''}  ['play', 'result', 'edit'].forEach(function (id) { $(id).hidden = id !== view; });
  $('tabPlay').className = view === 'edit' ? '' : 'primary';
  $('tabEdit').className = view === 'edit' ? 'primary' : '';
  if (view === 'play') startRound(null);
  if (view === 'edit') renderList();
}

/* ------------------------------------------------------------------
   푸는 화면
   ------------------------------------------------------------------ */
/* only 를 주면 그 번호들만 푼다 — 틀린 것만 다시 풀 때 쓴다 */
function startRound(only) {
  if (!questions.length) {
    /* 문제가 없으면 푸는 화면 대신 만드는 화면으로 보낸다.
       빈 화면을 보여주고 사람이 알아서 찾아가게 두면 안 된다. */
    go('edit');
    $('formMsg').textContent = '먼저 문제를 하나 만들어 주세요.';
    return;
  }
  order = only && only.length ? only.slice() : questions.map(function (_, i) { return i; });
  pos = 0;
  picks = [];
  $('result').hidden = true;
  $('play').hidden = false;
  showQuestion();
}

function showQuestion() {
  locked = false;
  var item = questions[order[pos]];
  var right = picks.filter(function (p, i) { return p === questions[order[i]].answer; }).length;

  $('progressBar').style.width = (pos / order.length) * 100 + '%';
  $('progress').textContent = (pos + 1) + ' / ' + order.length + '문제';
  $('clock').textContent = right + '문제 맞힘';
  $('q').textContent = item.q;
  $('after').innerHTML = '';
  $('choices').innerHTML = item.choices.map(function (c, i) {
    return '<button class="pick" data-pick="' + i + '">'
      + '<span class="num">' + (i + 1) + '</span><span>' + esc(c) + '</span></button>';
  }).join('');
${limit ? '  startTimer();\n' : ''}}
${limit ? `
/* 남은 시간을 막대로 보여준다. 숫자만 있으면 눈이 계속 그리로 간다. */
function startTimer() {
  stopTimer();
  left = LIMIT;
  paintBar();
  ticker = setInterval(function () {
    left -= 0.1;
    if (left <= 0) { stopTimer(); if (!locked) { locked = true; reveal(-1); } return; }
    paintBar();
  }, 100);
}
function stopTimer() { if (ticker) { clearInterval(ticker); ticker = null; } }
function paintBar() {
  var pct = Math.max(0, (left / LIMIT) * 100);
  var bar = $('timeBar');
  bar.style.width = pct + '%';
  /* 얼마 안 남으면 색으로도 알린다 — 막대 길이만으론 눈에 안 들어온다 */
  bar.style.background = pct < 25 ? '#dc2626' : 'var(--accent)';
}
` : ''}
function pick(i) {
  if (locked || view !== 'play') return;
  locked = true;
${limit ? '  stopTimer();\n' : ''}  reveal(i);
}

/* 정답을 초록, 내가 고른 오답을 빨강으로 칠하고 넘어갈 버튼을 준다.
   바로 다음 문제로 넘기면 맞았는지 틀렸는지 볼 틈이 없다. */
function reveal(picked) {
  picks[pos] = picked;
  var item = questions[order[pos]];
  var btns = document.querySelectorAll('[data-pick]');
  for (var i = 0; i < btns.length; i++) {
    var n = Number(btns[i].dataset.pick);
    if (n === item.answer) btns[i].classList.add('ok');
    else if (n === picked) btns[i].classList.add('ng');
    btns[i].disabled = true;
  }
  var msg = picked === item.answer ? '정답입니다!'
    : picked === -1 ? '시간이 다 됐어요.' : '아쉬워요. 정답은 초록색이에요.';
  var last = pos === order.length - 1;
  $('after').innerHTML =
    '<div class="row" style="justify-content:space-between;flex-wrap:wrap">'
    + '<span class="sub" style="margin:0">' + msg + '</span>'
    + '<button class="primary" id="next">' + (last ? '결과 보기' : '다음 문제') + '</button>'
    + '</div>';
  $('next').focus();       // Enter 로 바로 넘어갈 수 있게
}

function next() {
  pos++;
  if (pos >= order.length) finish();
  else showQuestion();
}

function finish() {
${limit ? '  stopTimer();\n' : ''}  var right = 0;
  for (var i = 0; i < order.length; i++) {
    if (picks[i] === questions[order[i]].answer) right++;
  }
  $('play').hidden = true;
  $('result').hidden = false;

  var pct = Math.round((right / order.length) * 100);
  $('face').textContent = pct === 100 ? '🏆' : pct >= 70 ? '😄' : pct >= 40 ? '🙂' : '💪';
  $('score').textContent = order.length + '문제 중 ' + right + '문제 정답 (' + pct + '점)';

  var isNew = right > best;
  if (isNew) { best = right; persist(); }
  $('best').textContent = isNew ? '최고 기록을 새로 세웠어요!' : '최고 기록 ' + best + '문제';

  /* 틀린 문제를 짚어준다 — 점수만 보여주면 공부가 안 된다 */
  var wrong = [];
  $('review').innerHTML = order.map(function (qi, i) {
    var item = questions[qi];
    var good = picks[i] === item.answer;
    if (!good) wrong.push(qi);
    var mine = picks[i] === -1 ? '시간 초과'
      : picks[i] == null ? '안 풂' : item.choices[picks[i]];
    return '<div class="card" style="margin-bottom:8px;border-left:3px solid '
      + (good ? '#16a34a' : '#dc2626') + '">'
      + '<div style="font-size:13px;font-weight:700">' + (good ? '⭕ ' : '❌ ') + esc(item.q) + '</div>'
      + (good ? ''
        : '<div class="sub" style="margin:6px 0 0;font-size:12px">'
          + '내 답: ' + esc(mine) + '<br>정답: <b style="color:#16a34a">'
          + esc(item.choices[item.answer]) + '</b></div>')
      + '</div>';
  }).join('');

  $('againWrong').hidden = wrong.length === 0;
  $('againWrong').onclick = function () { startRound(wrong); };
  beep();
}

/* ------------------------------------------------------------------
   문제 만드는 화면
   ------------------------------------------------------------------ */
function choiceRow(text, checked) {
  var d = document.createElement('div');
  d.className = 'crow';
  d.innerHTML = '<input type="radio" name="ans" title="이것이 정답">'
    + '<input type="text" placeholder="보기를 적어주세요">'
    + '<button class="delChoice" title="이 보기 지우기">✕</button>';
  d.querySelector('input[type=text]').value = text || '';
  d.querySelector('input[type=radio]').checked = !!checked;
  return d;
}

function resetForm() {
  editing = -1;
  $('formTitle').textContent = '새 문제 추가';
  $('fq').value = '';
  $('cancelQ').hidden = true;
  var box = $('fchoices');
  box.innerHTML = '';
  box.appendChild(choiceRow('', true));
  box.appendChild(choiceRow('', false));
}

function loadForm(i) {
  editing = i;
  var item = questions[i];
  $('formTitle').textContent = (i + 1) + '번 문제 고치기';
  $('fq').value = item.q;
  $('cancelQ').hidden = false;
  var box = $('fchoices');
  box.innerHTML = '';
  item.choices.forEach(function (c, n) { box.appendChild(choiceRow(c, n === item.answer)); });
  $('fq').focus();
  $('edit').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function readForm() {
  var q = $('fq').value.trim();
  var rows = [].slice.call($('fchoices').children);
  var choices = [];
  var answer = -1;
  rows.forEach(function (row) {
    var text = row.querySelector('input[type=text]').value.trim();
    if (!text) return;                       // 빈 보기는 없는 셈 친다
    if (row.querySelector('input[type=radio]').checked) answer = choices.length;
    choices.push(text);
  });
  if (!q) return { err: '질문을 적어주세요.' };
  if (choices.length < 2) return { err: '보기를 두 개 이상 적어주세요.' };
  if (answer < 0) return { err: '정답을 골라주세요 (보기 왼쪽 동그라미).' };
  return { q: q, choices: choices, answer: answer };
}

function saveQuestion() {
  var got = readForm();
  if (got.err) { $('formMsg').textContent = got.err; return; }
  if (editing >= 0) questions[editing] = got;
  else questions.push(got);
  persist();
  resetForm();
  renderList();
  $('formMsg').textContent = editing >= 0 ? '고쳤어요.' : '추가했어요.';
}

function renderList() {
  $('count').textContent = questions.length ? '(' + questions.length + '개)' : '';
  if (!questions.length) {
    $('qlist').innerHTML = '<div class="empty">'
      + '<p style="margin:0 0 12px">아직 문제가 없어요.<br>위에서 첫 문제를 만들어 보세요.</p>'
      + '<button id="demo">예시로 3문제 넣어보기</button></div>';
    return;
  }
  $('qlist').innerHTML = questions.map(function (item, i) {
    return '<div class="card qrow" style="margin-bottom:8px">'
      + '<span class="idx">' + (i + 1) + '.</span>'
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-weight:700;font-size:14px">' + esc(item.q) + '</div>'
      + '<div class="sub" style="margin:4px 0 0;font-size:12px">'
      + item.choices.map(function (c, n) {
        return n === item.answer
          ? '<b style="color:#16a34a">' + esc(c) + '</b>' : esc(c);
      }).join(' · ')
      + '</div></div>'
      + '<button data-edit="' + i + '">고치기</button>'
      + '<button data-del="' + i + '" title="지우기">✕</button>'
      + '</div>';
  }).join('');
}

/* 예시 — 어떻게 노는지 한 번 보고 싶은 사람을 위한 것.
   주제와 상관없는 가짜 문제로 앱을 미리 채워두지는 않는다. */
function addDemo() {
  var t = TOPIC || '이 주제';
  questions = questions.concat([
    { q: t + ' 문제 1 — 이 글을 지우고 내 문제를 적으세요.', choices: ['첫 번째 보기', '두 번째 보기'], answer: 1 },
    { q: t + ' 문제 2 — 보기는 몇 개든 됩니다.', choices: ['하나', '둘', '셋'], answer: 0 },
    { q: '문제는 언제든 고치거나 지울 수 있어요.', choices: ['알겠어요', '모르겠어요'], answer: 0 },
  ]);
  persist();
  renderList();
}

/* ------------------------------------------------------------------
   내보내기 · 가져오기 — 저장을 껐어도 손으로 만든 문제를 잃지 않게
   ------------------------------------------------------------------ */
function exportJson() {
  var blob = new Blob([JSON.stringify(questions, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = (TOPIC || 'quiz') + '-문제.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(file) {
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error('형식이 다릅니다');
      /* 남이 준 파일이 우리 모양대로일 거라고 믿지 않는다.
         한 줄이라도 어긋나면 푸는 도중에 화면이 깨진다. */
      var clean = data.filter(function (it) {
        return it && typeof it.q === 'string' && Array.isArray(it.choices)
          && it.choices.length >= 2 && typeof it.answer === 'number'
          && it.answer >= 0 && it.answer < it.choices.length;
      });
      if (!clean.length) throw new Error('쓸 수 있는 문제가 없습니다');
      questions = questions.concat(clean);
      persist();
      renderList();
      $('formMsg').textContent = clean.length + '문제를 가져왔어요.'
        + (clean.length < data.length ? ' (' + (data.length - clean.length) + '개는 형식이 안 맞아 건너뜀)' : '');
    } catch (e) {
      $('formMsg').textContent = '가져오지 못했어요: ' + e.message;
    }
  };
  reader.readAsText(file);
}

/* ------------------------------------------------------------------
   입력 받기 — 목록이 계속 다시 그려지므로 위에서 한 번만 받는다
   ------------------------------------------------------------------ */
document.addEventListener('click', function (e) {
  var t = e.target.closest ? e.target.closest('button') : e.target;
  if (!t) return;
  if (t.dataset.pick != null) pick(Number(t.dataset.pick));
  else if (t.id === 'next') next();
  else if (t.id === 'again') startRound(null);
  else if (t.id === 'tabPlay') go('play');
  else if (t.id === 'tabEdit' || t.id === 'toEdit2') go('edit');
  else if (t.id === 'saveQ') saveQuestion();
  else if (t.id === 'cancelQ') { resetForm(); $('formMsg').textContent = ''; }
  else if (t.id === 'addChoice') $('fchoices').appendChild(choiceRow('', false));
  else if (t.classList.contains('delChoice')) {
    if ($('fchoices').children.length > 2) t.parentNode.remove();
    else $('formMsg').textContent = '보기는 두 개 이상 있어야 해요.';
  } else if (t.dataset.edit != null) loadForm(Number(t.dataset.edit));
  else if (t.dataset.del != null) {
    var i = Number(t.dataset.del);
    questions.splice(i, 1);
    if (editing === i) resetForm();
    persist();
    renderList();
  } else if (t.id === 'demo') addDemo();
  else if (t.id === 'exportBtn') exportJson();
  else if (t.id === 'importBtn') $('importFile').click();
});

$('importFile').addEventListener('change', function (e) {
  if (e.target.files[0]) importJson(e.target.files[0]);
  e.target.value = '';        // 같은 파일을 다시 골라도 반응하게
});

/* 숫자키로 답을 고르고 Enter 로 넘어간다 — 손이 키보드에 있을 때가 많다 */
document.addEventListener('keydown', function (e) {
  if (view !== 'play') return;
  if (/^[1-9]$/.test(e.key)) {
    var btn = document.querySelector('[data-pick="' + (Number(e.key) - 1) + '"]');
    if (btn && !btn.disabled) { e.preventDefault(); pick(Number(e.key) - 1); }
  } else if (e.key === 'Enter' && $('next')) {
    e.preventDefault();
    next();
  }
});

/* 문제가 하나도 없으면 만드는 화면부터 — 빈 퀴즈를 들이밀지 않는다 */
resetForm();
go(questions.length ? 'play' : 'edit');`

  const bits = [
    '앱 안에서 문제를 만들고 고칠 수 있고',
    limit ? `문제당 ${limit}초 제한이 있으며` : '시간 제한 없이 풀 수 있고',
    '틀린 문제만 골라 다시 풀 수 있습니다',
  ]

  return {
    html: htmlShell({ title, themeId: a.theme, body, script, extraCss }),
    summary: `${topic ? topic + ' ' : ''}퀴즈를 만들었어요. ${bits.join(', ')}. `
      + `코드를 열 필요 없이 [문제 만들기] 화면에서 바로 추가하시면 되고, `
      + `만든 문제는 파일로 내보내 보관할 수 있어요.`,
  }
}
