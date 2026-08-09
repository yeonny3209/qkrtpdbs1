/* ==================================================================
   규칙 기반 두뇌

   질문을 한 줄로 세워두고 순서대로 던지면 그건 설문지지 대화가 아니다.
   앞의 답에 따라 다음 질문이 갈라져야 "듣고 있다"는 느낌이 난다.
   그래서 질문마다 when(answers) 을 달아, 지금 물을 만한 질문 중
   맨 앞의 것을 고른다.

   이 파일은 순수하다 — React 도 DOM 도 모른다. Node 에서 그대로
   불러 검증할 수 있어야 질문 흐름의 빈틈(막다른 길, 닿지 않는 질문)을
   자동으로 잡을 수 있다.
   ================================================================== */
import { buildProject, APP_KINDS } from '../generate/index.js'

/* 만들 수 있는 것들. 여기가 늘어나면 질문도 자동으로 늘어난다. */
const KIND_OPTIONS = APP_KINDS.map((k) => ({
  value: k.id, label: `${k.icon} ${k.name}`, desc: k.desc,
}))

const THEMES = [
  { value: 'violet', label: '보라', desc: '차분하고 무난하다' },
  { value: 'blue', label: '파랑', desc: '신뢰감 있는 기본색' },
  { value: 'emerald', label: '초록', desc: '눈이 편하다' },
  { value: 'amber', label: '주황', desc: '활기차다' },
  { value: 'rose', label: '분홍', desc: '부드럽다' },
]

/* 답했는가 — 값이 비었는지가 아니라 "물어봤고 답이 기록되었는지"로 본다.

   예전에는 빈 문자열을 "아직 안 답함"으로 쳤다. 그래서 이름 질문에서
   건너뛰기를 누르면 답이 '' 로 기록되는데도 안 답한 것으로 읽혀,
   같은 질문을 영원히 다시 물었다. 건너뛰기도 엄연한 답이다. */
const answered = (answers, id) => Object.prototype.hasOwnProperty.call(answers, id)

/* ------------------------------------------------------------------
   질문 목록 — 위에서부터 훑어 "아직 답 없고 지금 물을 만한" 첫 질문
   ------------------------------------------------------------------ */
export const QUESTIONS = [
  {
    id: 'kind',
    kind: 'choice',
    text: '안녕하세요! 무엇을 만들어 드릴까요?',
    hint: '고르면 그에 맞춰 필요한 것만 더 여쭤볼게요.',
    when: () => true,
    options: KIND_OPTIONS,
  },
  {
    id: 'title',
    kind: 'text',
    text: '이름을 뭐라고 할까요?',
    hint: '화면 맨 위에 크게 들어갑니다. 비워두면 기본 이름을 씁니다.',
    placeholder: '예: 나의 하루',
    when: (a) => !!a.kind,
  },

  /* ---------- 할 일 목록 ---------- */
  {
    id: 'todoFields',
    kind: 'multi',
    text: '할 일 하나에 무엇까지 적을 수 있게 할까요?',
    hint: '여러 개 고를 수 있고, 아무것도 안 골라도 됩니다.',
    when: (a) => a.kind === 'todo',
    options: [
      { value: 'due', label: '📅 마감일', desc: '지난 것은 빨갛게 표시합니다' },
      { value: 'priority', label: '🔥 중요도', desc: '높음/보통/낮음 — 높은 것이 위로 옵니다' },
      { value: 'tag', label: '🏷 분류', desc: '분류별로 걸러 볼 수 있습니다' },
      { value: 'none', label: '아니요, 제목만', desc: '가장 단순한 형태' },
    ],
  },

  /* ---------- 퀴즈 ---------- */
  {
    id: 'quizTopic',
    kind: 'text',
    text: '퀴즈 주제가 무엇인가요?',
    hint: '문제는 직접 넣을 수 있게 만들어 드리고, 예시 문제 3개를 미리 채워둡니다.',
    placeholder: '예: 한국사, 영어 단어',
    when: (a) => a.kind === 'quiz',
  },
  {
    id: 'quizTimer',
    kind: 'choice',
    text: '문제마다 제한 시간을 둘까요?',
    when: (a) => a.kind === 'quiz',
    options: [
      { value: 'none', label: '없음', desc: '천천히 풀게 합니다' },
      { value: '10', label: '10초', desc: '빠른 순발력 퀴즈' },
      { value: '30', label: '30초', desc: '생각할 틈은 주는 정도' },
    ],
  },

  /* ---------- 영어 단어장 ---------- */
  {
    id: 'vocabTypes',
    kind: 'multi',
    text: '어떤 방식으로 물어볼까요?',
    hint: '여러 개 고르면 번갈아 나옵니다. 안 고르면 세 가지 다 넣어 드려요.',
    when: (a) => a.kind === 'vocab',
    options: [
      { value: 'meaning', label: '🔤 스펠링 보고 뜻 맞히기', desc: '보기 네 개 중에서 고릅니다' },
      { value: 'spelling', label: '⌨️ 뜻 보고 스펠링 쓰기', desc: '직접 타이핑합니다. 틀린 글자를 짚어줍니다' },
      { value: 'blank', label: '📝 문장 빈칸 채우기', desc: '예문에 들어갈 낱말을 고릅니다' },
    ],
  },

  /* ---------- 집중 타이머 ---------- */
  {
    id: 'timerFocus',
    kind: 'choice',
    text: '한 번에 몇 분씩 집중할까요?',
    when: (a) => a.kind === 'timer',
    options: [
      { value: '25', label: '25분', desc: '뽀모도로 기본값' },
      { value: '45', label: '45분', desc: '한 과목 분량' },
      { value: '50', label: '50분', desc: '수업 한 교시' },
    ],
  },
  {
    id: 'timerBreak',
    kind: 'choice',
    text: '쉬는 시간은요?',
    when: (a) => a.kind === 'timer',
    options: [
      { value: '5', label: '5분', desc: '짧게 끊고 바로 복귀' },
      { value: '10', label: '10분', desc: '가볍게 걷다 올 정도' },
      { value: '15', label: '15분', desc: '충분히 쉬기' },
    ],
  },

  /* ---------- 소개 페이지 ---------- */
  {
    id: 'landingSections',
    kind: 'multi',
    text: '어떤 내용을 넣을까요?',
    hint: '고른 순서와 상관없이 읽기 좋은 순서로 배치합니다.',
    when: (a) => a.kind === 'landing',
    options: [
      { value: 'about', label: '소개', desc: '무엇을 하는 곳인지' },
      { value: 'features', label: '특징 3가지', desc: '카드 세 장으로 보여줍니다' },
      { value: 'gallery', label: '사진 갤러리', desc: '자리를 잡아 두고 사진만 바꾸면 됩니다' },
      { value: 'contact', label: '연락처', desc: '이메일과 링크' },
    ],
  },

  /* ---------- 공통 마무리 ---------- */
  {
    id: 'save',
    kind: 'choice',
    text: '새로고침해도 내용이 남아 있어야 할까요?',
    hint: '브라우저에 저장합니다. 서버가 없어도 되고, 내 기기에만 남습니다.',
    /* 소개 페이지는 사용자가 채우는 내용이 없어 저장할 것도 없다 */
    when: (a) => !!a.kind && a.kind !== 'landing',
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
    when: (a) => !!a.kind,
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

   "할 일 목록"으로 답하다가 "퀴즈"로 바꾸면 todoFields 답이 남아 있는데,
   그대로 두면 다음에 다시 할 일 목록을 고를 때 그 질문을 건너뛴다.
   사람은 답한 기억이 없는데 답이 채워져 있는 셈이라 이상하다. */
export function pruneAnswers(answers = {}) {
  const out = {}
  for (const q of QUESTIONS) {
    if (!answered(answers, q.id)) continue
    /* 지금까지 살아남은 답만으로 조건을 따진다 — 버려질 답이 다른 답을
       살려두는 일이 없도록 순서대로 쌓아 올린다 */
    if (q.when(out)) out[q.id] = answers[q.id]
  }
  return out
}

/* 진행도 — 남은 질문 수는 답에 따라 변하므로 그때그때 다시 센다.
   미리 "총 7문항"이라고 못 박으면 갈래가 갈릴 때 숫자가 어긋난다. */
export function progress(answers = {}) {
  const done = QUESTIONS.filter((q) => q.when(answers) && answered(answers, q.id)).length
  const left = QUESTIONS.filter((q) => q.when(answers) && !answered(answers, q.id)).length
  return { done, total: done + left, left }
}

export const rulesBrain = {
  id: 'rules',
  name: '규칙 기반',
  async ask(answers) { return nextQuestion(answers) },
  async build(answers) { return buildProject(answers) },
}

export default rulesBrain
