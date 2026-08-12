/* ==================================================================
   대화형 코딩 AI — 메인

   흐름은 하나뿐이다.
     묻는다 → 답을 받는다 → 더 물을 게 있으면 다시 묻는다 → 만든다

   두뇌가 무엇인지는 여기서 신경 쓰지 않는다. ask / build 두 가지만
   부른다. 나중에 아래 import 한 줄을 claude.js 로 바꾸면 그대로
   Claude 가 물어보게 된다.
   ================================================================== */
import { useCallback, useEffect, useRef, useState } from 'react'
import brain from './brain/rules.js'
import Answer from './ui/Answer.jsx'
import Result from './ui/Result.jsx'

/* 답을 사람이 읽을 수 있는 말로 되돌린다 — 말풍선에 'todoFields: ["due"]'
   가 찍히면 자기가 무엇을 골랐는지 알 수 없다. */
function answerLabel(q, value) {
  if (q.kind === 'text') return value || '(그냥 넘어감)'
  const list = Array.isArray(value) ? value : [value]
  const labels = list
    .map((v) => q.options.find((o) => o.value === v)?.label)
    .filter(Boolean)
  return labels.length ? labels.join(', ') : '(고르지 않음)'
}

export default function App() {
  /* 주고받은 것을 순서대로 쌓는다. 답만 따로 들고 있으면 "몇 번째
     질문이었는지"를 잃어버려서 되돌아가 고칠 수가 없다. */
  const [history, setHistory] = useState([])     // [{ q, value }]
  const [question, setQuestion] = useState(null)
  const [thinking, setThinking] = useState(true)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const bottom = useRef(null)

  const answersOf = (h) => Object.fromEntries(h.map((it) => [it.q.id, it.value]))

  /* 다음 질문을 받아온다. 규칙 두뇌는 즉시 답하지만 Claude 두뇌는
     네트워크를 타므로, 지금부터 기다리는 모양을 갖춰 둔다. */
  const advance = useCallback(async (h) => {
    setThinking(true)
    setError(null)
    try {
      const next = await brain.ask(answersOf(h))
      setQuestion(next)
    } catch (e) {
      setError(e.message || '질문을 가져오지 못했습니다')
    } finally {
      setThinking(false)
    }
  }, [])

  useEffect(() => { advance([]) }, [advance])

  /* 새 말풍선이 생기면 그쪽으로 따라 내려간다 */
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [history.length, question, thinking])

  const onAnswer = (value) => {
    const h = [...history, { q: question, value }]
    setHistory(h)
    setQuestion(null)
    advance(h)
  }

  /* 이미 답한 것을 다시 고르기 — 그 뒤의 답은 버린다.
     "할 일 목록"을 "퀴즈"로 바꾸면 뒤에 했던 대답들은 물어본 적 없는
     질문의 답이 되어버리기 때문이다. */
  const rewind = (index) => {
    const h = history.slice(0, index)
    setHistory(h)
    setResult(null)
    setQuestion(null)
    advance(h)
  }

  const make = async () => {
    setThinking(true)
    setError(null)
    try {
      setResult(await brain.build(answersOf(history)))
    } catch (e) {
      setError(e.message || '만들지 못했습니다')
    } finally {
      setThinking(false)
    }
  }

  const restart = () => {
    setHistory([])
    setResult(null)
    setQuestion(null)
    advance([])
  }

  const done = !thinking && !question       // 더 물을 것이 없다

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* ---------- 대화 ---------- */}
      <div className={`flex min-h-0 flex-col ${result ? 'lg:w-[46%] lg:border-r lg:border-white/10' : 'mx-auto w-full max-w-3xl'}`}>
        <header className="flex items-center gap-3 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg">
            🤖
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-black text-white">영어 단어장 만들기</h1>
            <p className="text-[11px] text-zinc-500">몇 가지만 물어보고 바로 만들어 드립니다</p>
          </div>
          {history.length > 0 && (
            <button onClick={restart}
              className="ml-auto rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-bold text-zinc-400 transition hover:bg-white/10">
              처음부터
            </button>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {history.map((it, i) => (
            <div key={i} className="rise mb-5">
              <Bubble>{it.q.text}</Bubble>
              <div className="mt-2 flex justify-end">
                <button onClick={() => rewind(i)} title="눌러서 다시 고르기"
                  className="max-w-[85%] rounded-2xl rounded-br-md border border-violet-400/30 bg-violet-500/15 px-4 py-2
                    text-left text-[13.5px] font-bold text-violet-100 transition hover:border-violet-300/60 hover:bg-violet-500/25">
                  {answerLabel(it.q, it.value)}
                </button>
              </div>
            </div>
          ))}

          {question && (
            <div className="rise mb-4">
              <Bubble>{question.text}</Bubble>
              {question.hint && (
                <p className="mb-3 ml-11 mt-1.5 text-[12px] leading-relaxed text-zinc-500">{question.hint}</p>
              )}
              <div className="ml-11 mt-3">
                <Answer question={question} onAnswer={onAnswer} />
              </div>
            </div>
          )}

          {thinking && (
            <div className="mb-4 flex items-center gap-1.5 pl-11 text-zinc-600">
              {[0, 1, 2].map((i) => (
                <span key={i} className="dot h-1.5 w-1.5 rounded-full bg-current"
                  style={{ animationDelay: `${i * 0.18}s` }} />
              ))}
            </div>
          )}

          {error && (
            <div className="rise mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3">
              <p className="text-[13px] font-bold text-rose-200">{error}</p>
              <button onClick={() => advance(history)}
                className="mt-2 text-[12px] font-bold text-rose-300 underline">다시 시도</button>
            </div>
          )}

          {done && !result && !error && (
            <div className="rise mb-4">
              <Bubble>다 물어봤어요. 이제 만들어 드릴게요!</Bubble>
              <div className="ml-11 mt-3">
                <button onClick={make}
                  className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-3.5
                    text-[15px] font-black text-white transition hover:brightness-110">
                  ✨ 만들기
                </button>
              </div>
            </div>
          )}

          <div ref={bottom} />
        </div>
      </div>

      {/* ---------- 결과 ---------- */}
      {result && (
        <div className="min-h-0 flex-1 border-t border-white/10 lg:border-t-0">
          <Result result={result} onRestart={restart} />
        </div>
      )}
    </div>
  )
}

function Bubble({ children }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[.06] text-[15px]">
        🤖
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-white/10 bg-white/[.04] px-4 py-2.5
        text-[14px] leading-relaxed text-zinc-100">
        {children}
      </div>
    </div>
  )
}
