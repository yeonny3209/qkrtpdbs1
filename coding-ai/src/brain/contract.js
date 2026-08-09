/* ==================================================================
   두뇌 계약 (brain contract)

   이 앱의 핵심 설계는 "질문을 고르는 일"과 "화면에 그리는 일"을
   갈라놓는 것이다. 화면은 두뇌가 규칙표인지 Claude 인지 몰라야 한다.
   그래야 나중에 두뇌만 갈아끼울 수 있다.

   두뇌는 딱 두 가지만 할 줄 알면 된다.

     ask(answers)   → 다음에 던질 질문, 더 물을 게 없으면 null
     build(answers) → { files: [{ path, code }], summary }

   둘 다 async 다. 규칙 기반 두뇌는 즉시 답하지만, Claude 두뇌는
   네트워크를 타야 한다. 지금부터 async 로 두면 나중에 화면 코드를
   한 줄도 안 고치고 갈아끼울 수 있다. 반대로 지금 동기로 만들어 두면
   그때 호출부를 전부 뜯어야 한다.

   ------------------------------------------------------------------
   질문의 모양
     id       답을 담을 열쇠 (answers[id])
     text     사람에게 보여줄 물음
     hint     보조 설명 (없어도 됨)
     kind     'choice' | 'multi' | 'text'
     options  [{ value, label, desc }]  — choice · multi 에서만
     placeholder  text 에서만

   답의 모양
     choice → 문자열 하나
     multi  → 문자열 배열
     text   → 문자열
   ================================================================== */

export const QUESTION_KINDS = ['choice', 'multi', 'text']

/* 두뇌가 계약을 지키는지 확인한다.

   두뇌를 갈아끼울 때 가장 먼저 깨지는 것이 이 모양이다. 화면에서
   조용히 빈 칸으로 나타나면 원인을 찾는 데 한참 걸리므로, 잘못된
   질문은 만들어진 자리에서 바로 잡는다. 테스트가 이 함수를 그대로 쓴다. */
export function validateQuestion(q) {
  const bad = (why) => ({ ok: false, why })
  if (!q || typeof q !== 'object') return bad('질문이 객체가 아니다')
  if (!q.id || typeof q.id !== 'string') return bad('id 가 없다')
  if (!q.text || typeof q.text !== 'string') return bad(`${q.id}: text 가 없다`)
  if (!QUESTION_KINDS.includes(q.kind)) return bad(`${q.id}: kind 가 ${QUESTION_KINDS.join('/')} 중 하나가 아니다`)

  if (q.kind === 'text') {
    /* 자유 입력에 선택지가 붙어 있으면 어느 쪽을 쓰라는 건지 모른다 */
    if (q.options) return bad(`${q.id}: text 질문에 options 가 붙어 있다`)
    return { ok: true }
  }

  if (!Array.isArray(q.options) || q.options.length < 2) {
    return bad(`${q.id}: 선택지가 두 개 미만이다`)
  }
  const seen = new Set()
  for (const o of q.options) {
    if (!o || typeof o.value !== 'string' || !o.value) return bad(`${q.id}: 선택지 value 가 없다`)
    if (!o.label || typeof o.label !== 'string') return bad(`${q.id}: 선택지 label 이 없다`)
    /* 값이 겹치면 고른 것과 저장된 것이 어긋난다 */
    if (seen.has(o.value)) return bad(`${q.id}: 선택지 value 중복 (${o.value})`)
    seen.add(o.value)
  }
  return { ok: true }
}

/* 만들어진 결과물이 쓸 만한 모양인지 확인한다 */
export function validateBuild(out) {
  const bad = (why) => ({ ok: false, why })
  if (!out || typeof out !== 'object') return bad('결과가 객체가 아니다')
  if (!Array.isArray(out.files) || !out.files.length) return bad('파일이 하나도 없다')
  for (const f of out.files) {
    if (!f.path || typeof f.path !== 'string') return bad('파일 경로가 없다')
    if (typeof f.code !== 'string' || !f.code.length) return bad(`${f.path}: 내용이 비었다`)
  }
  /* 미리보기는 html 파일을 띄운다. 하나도 없으면 화면이 빈 채로 남는다. */
  if (!out.files.some((f) => f.path.endsWith('.html'))) return bad('html 파일이 없다')
  if (typeof out.summary !== 'string' || !out.summary) return bad('요약이 없다')
  return { ok: true }
}

/* 미리보기에 띄울 파일 — 화면과 테스트가 같은 규칙을 쓰도록 여기 둔다 */
export const previewFile = (files = []) => files.find((f) => f.path.endsWith('.html')) || null
