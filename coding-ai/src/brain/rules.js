/* ==================================================================
   규칙 기반 두뇌 — 영어 단어장 전용

   원래는 할 일 목록·퀴즈·타이머·소개 페이지까지 만드는 범용 도구였다.
   지금은 영어 단어장 하나만 만든다. 만들 수 있는 게 하나뿐이면
   "무엇을 만들어 드릴까요?"라고 먼저 묻는 것 자체가 쓸데없는 클릭이라,
   그 질문을 없애고 바로 단어장 질문부터 시작한다.

   이 파일은 순수하다 — React 도 DOM 도 모른다. Node 에서 그대로
   불러 검증할 수 있어야 질문 흐름의 빈틈(막다른 길, 닿지 않는 질문)을
   자동으로 잡을 수 있다.
   ================================================================== */
import { buildProject } from '../generate/index.js'

const THEMES = [
  { value: 'violet', label: '보라', desc: '차분하고 무난하다' },
  { value: 'blue', label: '파랑', desc: '신뢰감 있는 기본색' },
  { value: 'emerald', label: '초록', desc: '눈이 편하다' },
  { value: 'amber', label: '주황', desc: '활기차다' },
  { value: 'rose', label: '분홍', desc: '부드럽다' },
]

/* 답했는가 — 값이 비었는지가 아니라 "물어봤고 답이 기록되었는지"로 본다.
   빈 문자열을 "아직 안 답함"으로 치면, 이름 질문에서 건너뛰기를 눌러
   ''가 기록되어도 안 답한 것으로 읽혀 같은 질문을 영원히 다시 묻는다. */
const answered = (answers, id) => Object.prototype.hasOwnProperty.call(answers, id)

/* ------------------------------------------------------------------
   질문 목록 — 위에서부터 훑어 "아직 답 없고 지금 물을 만한" 첫 질문

   전부 when: () => true 다. 만들 수 있는 것이 단어장 하나뿐이라
   갈래가 갈릴 일이 없다. 그래도 조건부 구조는 남겨 뒀다 — 나중에
   종류가 다시 늘어나면 그때 각 질문에 조건만 달면 된다.
   ------------------------------------------------------------------ */
export const QUESTIONS = [
  {
    id: 'title',
    kind: 'text',
    text: '안녕하세요! 단어장 이름을 뭐라고 할까요?',
    hint: '화면 맨 위에 크게 들어갑니다. 비워두면 기본 이름을 씁니다.',
    placeholder: '예: 나의 영어 단어장',
    when: () => true,
  },
  {
    id: 'vocabTypes',
    kind: 'multi',
    text: '어떤 방식으로 물어볼까요?',
    hint: '여러 개 고르면 번갈아 나옵니다. 안 고르면 세 가지 다 넣어 드려요.',
    when: () => true,
    options: [
      { value: 'meaning', label: '🔤 스펠링 보고 뜻 맞히기', desc: '보기 네 개 중에서 고릅니다' },
      { value: 'spelling', label: '⌨️ 뜻 보고 스펠링 쓰기', desc: '직접 타이핑합니다. 틀린 글자를 짚어줍니다' },
      { value: 'blank', label: '📝 문장 빈칸 채우기', desc: '예문에 들어갈 낱말을 고릅니다' },
    ],
  },
  {
    id: 'save',
    kind: 'choice',
    text: '새로고침해도 내용이 남아 있어야 할까요?',
    hint: '브라우저에 저장합니다. 서버가 없어도 되고, 내 기기에만 남습니다.',
    when: () => true,
    options: [
      { value: 'yes', label: '네, 남겨주세요', desc: '창을 닫았다 열어도 그대로입니다' },
      { value: 'no', label: '아니요', desc: '새로고침하면 처음부터' },
    ],
  },
  {
    id: 'theme',
    kind: 'choice',
    text: '마지막으로, 어떤 색이 좋으세요?',
    hint: '밝은 화면과 어두운 화면 둘 다 알아서 맞춰 만듭니다.',
    when: () => true,
    options: THEMES,
  },
]

export const QUESTION_BY_ID = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]))

/* ------------------------------------------------------------------
   두뇌 본체
   ------------------------------------------------------------------ */

/* 지금 물을 질문. 없으면 null (= 설계 끝) */
export function nextQuestion(answers = {}) {
  return QUESTIONS.find((q) => !answered(answers, q.id) && q.when(answers)) || null
}

/* 이미 답한 것 중 지금 조건에 안 맞는 답은 버린다.
   지금은 모든 질문이 무조건 열려 있어 버릴 것이 없지만, 종류가 다시
   늘어났을 때를 위해 구조는 그대로 둔다. */
export function pruneAnswers(answers = {}) {
  const out = {}
  for (const q of QUESTIONS) {
    if (!answered(answers, q.id)) continue
    if (q.when(out)) out[q.id] = answers[q.id]
  }
  return out
}

/* 진행도 — 질문 수가 고정이라도 그때그때 세는 방식은 그대로 둔다.
   나중에 조건부 질문이 다시 생기면 이 함수는 손댈 필요가 없다. */
export function progress(answers = {}) {
  const done = QUESTIONS.filter((q) => q.when(answers) && answered(answers, q.id)).length
  const left = QUESTIONS.filter((q) => q.when(answers) && !answered(answers, q.id)).length
  return { done, total: done + left, left }
}

export const rulesBrain = {
  id: 'rules',
  name: '규칙 기반',
  async ask(answers) { return nextQuestion(answers) },
  /* 만들 수 있는 게 단어장 하나뿐이므로 kind 를 여기서 고정한다.
     질문에서 kind 를 더는 묻지 않으니, 생성기가 요구하는 값은
     두뇌가 대신 채워 넣는다. */
  async build(answers) { return buildProject({ kind: 'vocab', ...answers }) },
}

export default rulesBrain
