/* ==================================================================
   집중 타이머 생성기

   집중 시간이 끝나면 저절로 휴식으로 넘어가고, 휴식이 끝나면 다시
   집중으로 돌아온다. 매번 사람이 다음 단계를 눌러야 하면 딴짓하다
   놓치고, 그 순간 타이머를 쓰는 이유가 사라진다.
   ================================================================== */
import { htmlShell, storageJs, beepJs, escapeHtml } from './theme.js'

export function generateTimer(a) {
  const title = a.title || '집중 타이머'
  const focus = Number(a.timerFocus || 25)
  const rest = Number(a.timerBreak || 5)
  const keep = a.save === 'yes'

  const body = `  <h1>${escapeHtml(title)}</h1>
  <p class="sub">집중 ${focus}분 → 휴식 ${rest}분을 저절로 오갑니다.</p>

  <div class="card" style="text-align:center;padding:32px 16px">
    <div id="phase" style="font-size:14px;letter-spacing:.2em;color:var(--accent);font-weight:700"></div>
    <div id="clock" style="font-size:76px;font-weight:800;letter-spacing:-.03em;
      font-variant-numeric:tabular-nums;line-height:1.1;margin:6px 0 4px">--:--</div>

    <div style="height:6px;background:var(--border);border-radius:99px;overflow:hidden;margin:14px auto 22px;max-width:340px">
      <div id="bar" style="height:100%;width:0%;background:var(--accent);transition:width .3s linear"></div>
    </div>

    <div class="row" style="justify-content:center">
      <button class="primary" id="toggle">시작</button>
      <button id="reset">처음으로</button>
      <button id="skip">건너뛰기</button>
    </div>
  </div>

  <p class="sub" id="done" style="text-align:center;margin-top:18px"></p>`

  const script = `var FOCUS = ${focus} * 60;      // 집중 (초)
var REST = ${rest} * 60;       // 휴식 (초)

${storageJs(keep, 'timer.' + (a.title || 'default'))}

${beepJs}

var state = load({ done: 0 });
var phase = 'focus';          // 'focus' | 'rest'
var left = FOCUS;
var running = false;
var endAt = 0;                // 끝나는 시각 (밀리초)
var ticker = null;

/* 남은 초를 1초마다 빼면 시간이 밀린다. 탭이 뒤로 가면 브라우저가
   타이머를 느리게 돌리기 때문이다. 그래서 "끝나는 시각"을 잡아두고
   매번 지금과의 차이를 다시 잰다 — 뒤로 갔다 와도 정확하다. */
function tick() {
  left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
  paint();
  if (left <= 0) nextPhase();
}

function paint() {
  var m = Math.floor(left / 60);
  var s = left % 60;
  document.getElementById('clock').textContent =
    String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  document.getElementById('phase').textContent = phase === 'focus' ? '집중' : '휴식';

  var total = phase === 'focus' ? FOCUS : REST;
  document.getElementById('bar').style.width = ((total - left) / total) * 100 + '%';
  document.getElementById('toggle').textContent = running ? '잠깐 멈춤' : '시작';

  /* 탭 제목에도 남은 시간을 띄운다 — 다른 창을 보고 있어도 보인다 */
  document.title = (running ? (phase === 'focus' ? '집중 ' : '휴식 ') : '')
    + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
    + ' · ' + ${JSON.stringify(title)};

  document.getElementById('done').textContent =
    state.done ? '오늘 집중을 ' + state.done + '번 마쳤어요.' : '';
}

function start() {
  if (running) return;
  running = true;
  endAt = Date.now() + left * 1000;
  ticker = setInterval(tick, 250);   // 1초보다 자주 봐야 화면이 안 끊긴다
  paint();
}

function pause() {
  running = false;
  if (ticker) { clearInterval(ticker); ticker = null; }
  paint();
}

function nextPhase() {
  pause();
  beep();
  if (phase === 'focus') {
    state.done++;
    save(state);
    phase = 'rest';
    left = REST;
  } else {
    phase = 'focus';
    left = FOCUS;
  }
  paint();
  start();          // 알아서 이어간다 — 딴짓하다 놓치지 않게
}

function reset() {
  pause();
  phase = 'focus';
  left = FOCUS;
  paint();
}

document.getElementById('toggle').addEventListener('click', function () {
  if (running) pause(); else start();
});
document.getElementById('reset').addEventListener('click', reset);
document.getElementById('skip').addEventListener('click', nextPhase);
/* 스페이스바로 시작·정지. 손이 키보드에 있을 때가 대부분이다. */
document.addEventListener('keydown', function (e) {
  if (e.code === 'Space') { e.preventDefault(); if (running) pause(); else start(); }
});

paint();`

  return {
    html: htmlShell({ title, themeId: a.theme, body, script }),
    summary: `집중 ${focus}분 · 휴식 ${rest}분 타이머를 만들었어요. 두 단계를 저절로 오가고, 끝날 때 알림음이 납니다${keep ? '. 오늘 몇 번 집중했는지도 남습니다' : ''}.`,
  }
}
