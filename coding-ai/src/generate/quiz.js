/* ==================================================================
   퀴즈 생성기

   문제를 코드 맨 위 배열 하나에 몰아둔다. 만들어 받은 사람이 가장 먼저
   하고 싶은 일은 "내 문제로 바꾸기"인데, 그게 파일 여기저기 흩어져
   있으면 손을 못 댄다.
   ================================================================== */
import { htmlShell, storageJs, beepJs, escapeHtml, jsString } from './theme.js'

export function generateQuiz(a) {
  const title = a.title || '퀴즈'
  const topic = (a.quizTopic || '').trim()
  const limit = a.quizTimer && a.quizTimer !== 'none' ? Number(a.quizTimer) : 0
  const keep = a.save === 'yes'

  const body = `  <h1>${escapeHtml(title)}</h1>
  <p class="sub">${topic ? escapeHtml(topic) + ' 퀴즈입니다. ' : ''}문제는 코드 맨 위 <b>QUESTIONS</b> 에서 바꿀 수 있어요.</p>

  <div class="card" id="stage">
    <div id="progress" class="sub" style="margin:0 0 10px"></div>
${limit ? `    <div style="height:5px;background:var(--border);border-radius:99px;overflow:hidden;margin-bottom:14px">
      <div id="bar" style="height:100%;width:100%;background:var(--accent);transition:width .25s linear"></div>
    </div>
` : ''}    <h2 id="q" style="font-size:19px;margin:0 0 16px"></h2>
    <div id="choices" style="display:grid;gap:8px"></div>
    <div id="after" style="margin-top:14px"></div>
  </div>

  <div class="card" id="result" style="display:none;text-align:center">
    <div style="font-size:44px" id="face">🎉</div>
    <h2 id="score" style="margin:8px 0 4px"></h2>
    <p class="sub" id="best"></p>
    <button class="primary" id="again" style="margin-top:8px">다시 풀기</button>
  </div>`

  const script = `/* ------------------------------------------------------------------
   문제 — 여기만 고치면 됩니다.
     q       질문
     choices 보기 (몇 개든 됩니다)
     answer  정답이 choices 의 몇 번째인지 (0부터 셉니다)
   ------------------------------------------------------------------ */
var QUESTIONS = [
${sampleQuestions(topic)}
];

${storageJs(keep, 'quiz.' + (a.title || 'default'))}

${beepJs}

var idx = 0;
var score = 0;
var locked = false;      // 답을 고른 뒤 연달아 눌리는 것을 막는다
${limit ? 'var left = 0;\nvar ticker = null;\n' : ''}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function show() {
  locked = false;
  var item = QUESTIONS[idx];
  document.getElementById('progress').textContent =
    (idx + 1) + ' / ' + QUESTIONS.length + '문제  ·  ' + score + '점';
  document.getElementById('q').textContent = item.q;
  document.getElementById('after').innerHTML = '';
  document.getElementById('choices').innerHTML = item.choices.map(function (c, i) {
    return '<button data-pick="' + i + '" style="text-align:left">' + esc(c) + '</button>';
  }).join('');
${limit ? `  startTimer();
` : ''}}
${limit ? `
/* 남은 시간을 막대로 보여준다. 숫자만 있으면 눈이 계속 그리로 간다. */
function startTimer() {
  stopTimer();
  left = ${limit};
  paintBar();
  ticker = setInterval(function () {
    left -= 0.1;
    if (left <= 0) { stopTimer(); timeUp(); return; }
    paintBar();
  }, 100);
}
function paintBar() {
  document.getElementById('bar').style.width = Math.max(0, (left / ${limit}) * 100) + '%';
}
function stopTimer() { if (ticker) { clearInterval(ticker); ticker = null; } }

function timeUp() {
  if (locked) return;
  locked = true;
  reveal(-1);
}
` : ''}
function pick(i) {
  if (locked) return;
  locked = true;
${limit ? '  stopTimer();\n' : ''}  if (i === QUESTIONS[idx].answer) score++;
  reveal(i);
}

/* 정답을 초록, 내가 고른 오답을 빨강으로 칠하고 넘어갈 버튼을 준다.
   바로 다음 문제로 넘기면 맞았는지 틀렸는지 볼 틈이 없다. */
function reveal(picked) {
  var item = QUESTIONS[idx];
  var btns = document.querySelectorAll('[data-pick]');
  for (var i = 0; i < btns.length; i++) {
    var n = Number(btns[i].dataset.pick);
    if (n === item.answer) {
      btns[i].style.background = '#16a34a'; btns[i].style.borderColor = '#16a34a';
      btns[i].style.color = '#fff'; btns[i].style.fontWeight = '700';
    } else if (n === picked) {
      btns[i].style.background = '#dc2626'; btns[i].style.borderColor = '#dc2626';
      btns[i].style.color = '#fff';
    }
    btns[i].disabled = true;
  }
  var msg = picked === item.answer ? '정답입니다!'
    : picked === -1 ? '시간이 다 됐어요.' : '아쉬워요.';
  var last = idx === QUESTIONS.length - 1;
  document.getElementById('after').innerHTML =
    '<div class="row" style="justify-content:space-between">'
    + '<span class="sub" style="margin:0">' + msg + '</span>'
    + '<button class="primary" id="next">' + (last ? '결과 보기' : '다음 문제') + '</button>'
    + '</div>';
}

function next() {
  idx++;
  if (idx >= QUESTIONS.length) finish();
  else show();
}

function finish() {
${limit ? '  stopTimer();\n' : ''}  document.getElementById('stage').style.display = 'none';
  var box = document.getElementById('result');
  box.style.display = '';
  var pct = Math.round((score / QUESTIONS.length) * 100);
  document.getElementById('face').textContent = pct >= 80 ? '🏆' : pct >= 50 ? '🙂' : '💪';
  document.getElementById('score').textContent =
    QUESTIONS.length + '문제 중 ' + score + '문제 정답 (' + pct + '점)';

  var record = load({ best: 0 });
  var isNew = score > record.best;
  if (isNew) { record.best = score; save(record); }
  document.getElementById('best').textContent =
    isNew ? '최고 기록을 새로 세웠어요!' : '최고 기록 ' + record.best + '문제';
  beep();
}

function restart() {
  idx = 0; score = 0;
  document.getElementById('result').style.display = 'none';
  document.getElementById('stage').style.display = '';
  show();
}

document.addEventListener('click', function (e) {
  var t = e.target;
  if (t.dataset.pick) pick(Number(t.dataset.pick));
  else if (t.id === 'next') next();
  else if (t.id === 'again') restart();
});

show();`

  const bits = [
    limit ? `문제당 ${limit}초 제한` : '시간 제한 없음',
    keep && '최고 기록 저장',
  ].filter(Boolean)

  return {
    html: htmlShell({ title, themeId: a.theme, body, script }),
    summary: `${topic ? topic + ' ' : ''}퀴즈를 만들었어요. ${bits.join(' · ')}. 예시 문제 3개를 넣어뒀으니 코드 맨 위 QUESTIONS 만 바꾸면 바로 내 퀴즈가 됩니다.`,
  }
}

/* 주제를 물어봤으니 그 주제가 결과물에 보여야 한다. 다만 진짜 문제를
   지어낼 수는 없으므로, 형식이 드러나는 예시 셋을 넣고 "여기를 바꾸라"고
   분명히 적어둔다. 엉뚱한 사실을 지어내 정답이라고 우기는 것보다 낫다. */
function sampleQuestions(topic) {
  const t = topic || '이 주제'
  const rows = [
    { q: `${t}에 대한 첫 번째 문제를 여기에 적으세요.`, choices: ['첫 번째 보기', '두 번째 보기 (정답)', '세 번째 보기'], answer: 1 },
    { q: `${t}에 대한 두 번째 문제입니다.`, choices: ['이것이 정답', '아닌 것', '역시 아닌 것'], answer: 0 },
    { q: '보기 개수는 자유롭게 늘리거나 줄여도 됩니다.', choices: ['둘 중 하나', '나머지 하나 (정답)'], answer: 1 },
  ]
  return rows.map((r) => `  {
    q: ${jsString(r.q)},
    choices: [${r.choices.map(jsString).join(', ')}],
    answer: ${r.answer},
  },`).join('\n')
}
