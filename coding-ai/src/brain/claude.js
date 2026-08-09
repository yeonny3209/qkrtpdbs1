/* ==================================================================
   Claude 두뇌 — 아직 켜지 않은 쪽

   규칙 기반 두뇌는 내가 미리 짜 둔 질문만 던진다. 여기를 켜면 무엇을
   물을지 Claude 가 그때그때 정하고, 만들 수 있는 것도 네 종류에
   묶이지 않는다.

   contract.js 의 약속(ask / build)을 똑같이 지키므로, App.jsx 는
   두뇌가 바뀐 줄도 모른다. 갈아끼우는 자리는 App.jsx 의 import 한 줄이다.

   ------------------------------------------------------------------
   왜 브라우저에서 Anthropic 을 직접 부르지 않는가

   API 키를 브라우저에 두면 그건 공개하는 것과 같다. 화면에 안 보여도
   개발자 도구 · 네트워크 탭 · 빌드된 js 파일에 그대로 남는다. 누군가
   가져다 쓰면 요금은 키 주인이 낸다. CORS 로 막히는 것과는 별개의,
   더 근본적인 문제다.

   그래서 열쇠는 내 컴퓨터(또는 서버)에 두고, 브라우저는 그 앞의
   작은 창구에만 말을 건다. 창구 쪽 코드는 프로젝트 뿌리의
   server.example.js 에 있다 — 그대로 실행하면 된다.
   ================================================================== */
import { validateQuestion, validateBuild } from './contract.js'

/* 창구 주소. 개발 중에는 vite 프록시로, 배포하면 같은 도메인으로 붙는다. */
const ENDPOINT = '/api/brain'

async function call(action, answers) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, answers }),
  })
  if (!res.ok) {
    /* 실패를 조용히 삼키면 화면이 그냥 멈춘 것처럼 보인다.
       무엇이 잘못됐는지는 말해줘야 고칠 수 있다. */
    const detail = await res.text().catch(() => '')
    throw new Error(`두뇌 호출 실패 (${res.status}) ${detail.slice(0, 200)}`)
  }
  return res.json()
}

export const claudeBrain = {
  id: 'claude',
  name: 'Claude',

  async ask(answers) {
    const q = await call('ask', answers)
    if (!q || q.done) return null          // 더 물을 것이 없다
    /* 사람이 쓴 규칙표와 달리 여기서 오는 질문은 매번 새로 만들어진다.
       모양이 어긋난 질문은 화면에서 빈칸으로 나타나 원인을 찾기 어려우니,
       받은 자리에서 바로 걸러낸다. */
    const check = validateQuestion(q)
    if (!check.ok) throw new Error(`질문 모양이 어긋났다 — ${check.why}`)
    return q
  },

  async build(answers) {
    const out = await call('build', answers)
    const check = validateBuild(out)
    if (!check.ok) throw new Error(`결과물 모양이 어긋났다 — ${check.why}`)
    return out
  },
}

export default claudeBrain
