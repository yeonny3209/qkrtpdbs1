/* ==================================================================
   생성기 모음

   예전에는 할 일 목록·퀴즈·타이머·소개 페이지까지 만드는 범용
   도구였다. 지금은 영어 단어장 하나만 만든다. 여러 종류를 오가며
   테스트·유지보수할 이유가 없어서, 쓰지 않는 나머지는 걷어냈다.
   ================================================================== */
import { generateVocab } from './vocab.js'

export const APP_KINDS = [
  {
    id: 'vocab', name: '영어 단어장', icon: '📖',
    desc: '단어 1200개로 뜻·스펠링·빈칸 문제를 냅니다',
    make: generateVocab,
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
