/* ==================================================================
   Claude 두뇌를 켤 때 실행하는 창구 (아직 안 켜도 됩니다)

   지금 앱은 규칙 기반 두뇌로 혼자 돌아갑니다. 이 파일은 나중에
   "두뇌만 Claude 로 갈아끼울 때" 쓰는 조각이고, 그때까지는 실행할
   필요가 없습니다.

   ------------------------------------------------------------------
   켜는 순서
     1) API 키를 발급받는다 (console.anthropic.com)
     2) 이 폴더에서:
          npm install @anthropic-ai/sdk
          set ANTHROPIC_API_KEY=발급받은키        (윈도우 cmd)
          $env:ANTHROPIC_API_KEY="발급받은키"      (윈도우 PowerShell)
          node server.example.js
     3) vite.config.js 에 프록시를 한 줄 추가한다:
          server: { proxy: { '/api': 'http://localhost:8787' } }
     4) src/App.jsx 의 두뇌 import 를 rules.js → claude.js 로 바꾼다

   키는 이 프로세스 안에서만 삽니다. 브라우저로는 절대 내려가지 않아요.
   ================================================================== */
import { createServer } from 'node:http'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()      // ANTHROPIC_API_KEY 를 알아서 읽는다
const PORT = 8787

const SYSTEM = `당신은 코딩을 모르는 사람과 대화하며 그 사람이 원하는 것을
만들어 주는 조수입니다. 한국어로 말합니다.

질문을 던질 때:
- 한 번에 하나만 묻습니다. 여러 개를 몰아서 물으면 사람이 지칩니다.
- 전문 용어를 쓰지 않습니다. "로컬 스토리지"가 아니라 "새로고침해도 남을까요".
- 이미 답한 것에서 유추할 수 있는 것은 다시 묻지 않습니다.
- 다 물었으면 { "done": true } 만 돌려줍니다. 확인차 더 묻지 않습니다.

코드를 만들 때:
- 파일 하나짜리 HTML 로 만듭니다. 받아서 두 번 누르면 바로 열려야 합니다.
- 주석은 한국어로, "무엇을"이 아니라 "왜"를 적습니다.
- 밝은 화면과 어두운 화면 모두에서 읽히게 만듭니다.`

/* 구조화된 출력 — 모양을 스키마로 못 박으면 "가끔 형식이 어긋나서
   화면이 깨지는" 일이 사라진다. 사람에게 보여주기 전에 서버가 먼저 안다. */
const QUESTION_SCHEMA = {
  type: 'object',
  properties: {
    done: { type: 'boolean' },
    id: { type: 'string' },
    text: { type: 'string' },
    hint: { type: 'string' },
    kind: { type: 'string', enum: ['choice', 'multi', 'text'] },
    placeholder: { type: 'string' },
    options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: { type: 'string' },
          label: { type: 'string' },
          desc: { type: 'string' },
        },
        required: ['value', 'label', 'desc'],
        additionalProperties: false,
      },
    },
  },
  required: ['done', 'id', 'text', 'hint', 'kind', 'placeholder', 'options'],
  additionalProperties: false,
}

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    files: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          code: { type: 'string' },
        },
        required: ['path', 'code'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'files'],
  additionalProperties: false,
}

async function ask(answers) {
  const msg = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 4096,
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: QUESTION_SCHEMA } },
    messages: [{
      role: 'user',
      content: `지금까지 받은 답입니다:\n${JSON.stringify(answers, null, 2)}\n\n`
        + '다음에 물어볼 질문 하나를 정해주세요. 만들기에 충분하면 done 을 true 로 하세요.',
    }],
  })
  return readJson(msg)
}

async function build(answers) {
  /* 코드를 통째로 뽑으므로 길다. 스트리밍으로 받아야 요청이 시간 초과로
     끊기지 않는다 — 큰 max_tokens 를 비스트리밍으로 부르면 자주 끊긴다. */
  const stream = client.messages.stream({
    model: 'claude-opus-5',
    max_tokens: 32000,
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: BUILD_SCHEMA } },
    messages: [{
      role: 'user',
      content: `아래 답에 맞춰 완성된 코드를 만들어 주세요:\n${JSON.stringify(answers, null, 2)}`,
    }],
  })
  return readJson(await stream.finalMessage())
}

/* 안전 장치가 요청을 거절할 수 있다. content[0] 을 무조건 읽으면
   그 순간 엉뚱한 오류가 나서 원인을 못 찾는다. 먼저 확인한다. */
function readJson(msg) {
  if (msg.stop_reason === 'refusal') {
    throw new Error('요청이 거절되었습니다: ' + (msg.stop_details?.explanation || ''))
  }
  const text = msg.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('응답이 비어 있습니다')
  return JSON.parse(text)
}

createServer((req, res) => {
  if (req.method !== 'POST' || !req.url.startsWith('/api/brain')) {
    res.writeHead(404).end()
    return
  }
  let body = ''
  req.on('data', (c) => { body += c })
  req.on('end', async () => {
    try {
      const { action, answers } = JSON.parse(body)
      const out = action === 'build' ? await build(answers) : await ask(answers)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(out))
    } catch (e) {
      /* 무엇이 잘못됐는지 브라우저까지 전해야 고칠 수 있다.
         단, 키가 섞여 들어갈 수 있는 원본 오류는 그대로 넘기지 않는다. */
      console.error(e)
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      res.end(String(e.message || '알 수 없는 오류'))
    }
  })
}).listen(PORT, () => console.log(`두뇌 창구가 http://localhost:${PORT} 에서 기다립니다`))
