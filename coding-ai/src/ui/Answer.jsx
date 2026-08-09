/* ==================================================================
   답을 고르는 자리

   질문 종류에 따라 모양이 다르다. 세 가지뿐이라 파일 하나에 둔다.
   ================================================================== */
import { useEffect, useRef, useState } from 'react'

export default function Answer({ question, onAnswer }) {
  if (question.kind === 'text') return <TextAnswer q={question} onAnswer={onAnswer} />
  if (question.kind === 'multi') return <MultiAnswer q={question} onAnswer={onAnswer} />
  return <ChoiceAnswer q={question} onAnswer={onAnswer} />
}

/* ---------- 하나 고르기 ---------- */
function ChoiceAnswer({ q, onAnswer }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {q.options.map((o) => (
        <button key={o.value} onClick={() => onAnswer(o.value)}
          className="group rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3 text-left
            transition hover:-translate-y-0.5 hover:border-violet-400/50 hover:bg-violet-500/10">
          <div className="text-[14px] font-bold text-white">{o.label}</div>
          {o.desc && <div className="mt-0.5 text-[12px] leading-snug text-zinc-400">{o.desc}</div>}
        </button>
      ))}
    </div>
  )
}

/* ---------- 여러 개 고르기 ---------- */
function MultiAnswer({ q, onAnswer }) {
  const [picked, setPicked] = useState([])

  /* 질문이 바뀌면 이전 선택이 남아 있으면 안 된다 — 다른 질문의 답이
     체크된 채로 나타나면 사람이 자기가 고른 줄 안다. */
  useEffect(() => { setPicked([]) }, [q.id])

  /* '아무것도 아니요' 류의 선택지는 다른 것과 같이 고를 수 없다.
     "마감일도 넣고, 제목만 쓰고"는 말이 안 된다. */
  const soloValues = q.options.filter((o) => /^(none|아니요)/.test(o.value)).map((o) => o.value)
  const toggle = (v) => setPicked((cur) => {
    if (soloValues.includes(v)) return cur.includes(v) ? [] : [v]
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
    return next.filter((x) => !soloValues.includes(x))
  })

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((o) => {
          const on = picked.includes(o.value)
          return (
            <button key={o.value} onClick={() => toggle(o.value)}
              className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-left transition ${
                on ? 'border-violet-400/60 bg-violet-500/15'
                  : 'border-white/10 bg-white/[.03] hover:border-white/25 hover:bg-white/[.06]'}`}>
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border text-[10px] ${
                on ? 'border-violet-300 bg-violet-400 text-black' : 'border-white/25'}`}>
                {on ? '✓' : ''}
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-bold text-white">{o.label}</span>
                {o.desc && <span className="mt-0.5 block text-[12px] leading-snug text-zinc-400">{o.desc}</span>}
              </span>
            </button>
          )
        })}
      </div>
      <button onClick={() => onAnswer(picked.length ? picked : ['none'])}
        className="mt-3 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-3
          text-[14px] font-black text-white transition hover:brightness-110">
        {picked.length ? `${picked.length}개 고르고 넘어가기` : '고르지 않고 넘어가기'}
      </button>
    </div>
  )
}

/* ---------- 직접 쓰기 ---------- */
function TextAnswer({ q, onAnswer }) {
  const [text, setText] = useState('')
  const ref = useRef(null)

  /* 질문이 바뀌면 칸을 비우고 커서를 옮긴다 — 마우스로 칸을 찾아
     누르게 만들면 대화의 흐름이 끊긴다. */
  useEffect(() => { setText(''); ref.current?.focus() }, [q.id])

  const send = () => onAnswer(text.trim())

  return (
    <div className="flex flex-wrap gap-2">
      <input ref={ref} value={text} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && send()}
        placeholder={q.placeholder || '여기에 적어주세요'}
        className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3
          text-[14px] text-white outline-none placeholder:text-zinc-600 focus:border-violet-400/60" />
      <button onClick={send}
        className="rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3
          text-[14px] font-black text-white transition hover:brightness-110">
        {text.trim() ? '보내기' : '건너뛰기'}
      </button>
    </div>
  )
}
