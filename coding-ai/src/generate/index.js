/* ==================================================================
   생성기 모음

   만들 수 있는 종류는 여기 한 곳에만 적는다. 질문 목록도 이 배열을
   보고 선택지를 만들기 때문에, 새 종류를 붙이려면 여기 한 줄과
   생성기 파일 하나면 된다.
   ================================================================== */
import { generateTodo } from './todo.js'
import { generateQuiz } from './quiz.js'
import { generateTimer } from './timer.js'
import { generateLanding } from './landing.js'

export const APP_KINDS = [
  {
    id: 'todo', name: '할 일 목록', icon: '✅',
    desc: '적고, 지우고, 다 한 것을 표시합니다',
    make: generateTodo,
  },
  {
    id: 'quiz', name: '퀴즈', icon: '🧠',
    desc: '문제를 내고 점수를 매깁니다',
    make: generateQuiz,
  },
  {
    id: 'timer', name: '집중 타이머', icon: '⏱',
    desc: '집중과 휴식을 번갈아 재줍니다',
    make: generateTimer,
  },
  {
    id: 'landing', name: '소개 페이지', icon: '🪧',
    desc: '나 · 우리 가게 · 동아리를 소개합니다',
    make: generateLanding,
  },
]

export const KIND_BY_ID = Object.fromEntries(APP_KINDS.map((k) => [k.id, k]))

/* 답을 받아 파일로 바꾼다.

   결과 모양(files/summary)은 contract.js 가 정한 것이다. 나중에 Claude
   두뇌가 들어와도 화면은 이 모양만 알면 되므로, 여기서 그 약속을
   그대로 지킨다. */
export function buildProject(answers = {}) {
  const kind = KIND_BY_ID[answers.kind]
  if (!kind) {
    /* 화면에서는 종류를 안 고르면 만들기 버튼 자체가 안 나오지만,
       두뇌를 직접 부르는 쪽(테스트·나중의 API)이 있으니 막아둔다. */
    throw new Error(`알 수 없는 종류: ${answers.kind}`)
  }
  const { html, summary } = kind.make(answers)
  const name = safeFileName(answers.title || kind.name)
  return {
    files: [{ path: `${name}.html`, code: html }],
    summary,
  }
}

/* 파일 이름으로 쓸 수 없는 글자를 걷어낸다. 한글은 그대로 둔다 —
   받는 사람이 자기가 지은 이름을 알아볼 수 있어야 한다. */
export function safeFileName(s) {
  const cleaned = String(s)
    .replace(/[\\/:*?"<>|]/g, '')     // 윈도우에서 막히는 글자
    .replace(/\s+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')     // 앞뒤 점·붙임표는 숨김파일이 되거나 지저분하다
    .slice(0, 40)
  return cleaned || 'my-app'
}
