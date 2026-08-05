/* ==================================================================
   대화창 — 메이플스토리식

   · 글자가 한 자씩 찍힌다
   · 엔터/스페이스/클릭으로 넘긴다
     - 찍히는 중이면 즉시 전부 표시
     - 다 찍혔으면 다음 대사
   · 선택지가 나오면 숫자키 1~4 또는 클릭으로 고른다

   키 입력을 window 에 붙이는 이유: 대화창 안에 포커스 가능한 요소가
   없을 때도 엔터가 먹어야 하기 때문이다. 선택지가 떠 있는 동안에는
   엔터를 막는다 — 연타하다 실수로 골라버리면 엔딩이 바뀐다.
   ================================================================== */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const SPEED = 22        // 글자당 ms

export default function StoryDialogue({ script, chapter, onChoice, onDone }) {
  const [idx, setIdx] = useState(0)          // 지금 보고 있는 노드
  const [shown, setShown] = useState(0)      // 몇 글자까지 찍혔나
  const [extra, setExtra] = useState([])     // 선택 후 이어붙는 대사
  const timer = useRef(null)
  const box = useRef(null)

  /* 대화창을 연 버튼이 포커스를 쥔 채로 남으면, 엔터를 칠 때마다
     그 버튼이 같이 눌려서 대화가 처음부터 다시 시작된다.
     포커스를 대화창으로 가져와 끊는다. */
  useEffect(() => {
    document.activeElement?.blur?.()
    box.current?.focus()
  }, [])

  /* 원본 스크립트 + 선택으로 늘어난 대사 */
  const nodes = useMemo(() => {
    const out = []
    script.forEach((n, i) => {
      out.push(n)
      const added = extra.find((e) => e.at === i)
      if (added) added.lines.forEach((l) => out.push(l))
    })
    return out
  }, [script, extra])

  const node = nodes[idx]
  const isChoice = !!node?.choice
  const full = node?.text ?? ''
  const typing = !isChoice && shown < full.length

  /* 타자 효과 */
  useEffect(() => {
    if (isChoice) return
    setShown(0)
    if (!full) return
    let i = 0
    timer.current = setInterval(() => {
      i += 1
      setShown(i)
      if (i >= full.length) clearInterval(timer.current)
    }, SPEED)
    return () => clearInterval(timer.current)
  }, [idx, full, isChoice])

  const advance = useCallback(() => {
    if (isChoice) return
    if (typing) { clearInterval(timer.current); setShown(full.length); return }
    if (idx + 1 >= nodes.length) { onDone(); return }
    setIdx(idx + 1)
  }, [isChoice, typing, full, idx, nodes.length, onDone])

  const choose = useCallback((opt) => {
    /* 고른 선택지의 점수를 올리고, 반응 대사를 뒤에 끼워 넣는다 */
    onChoice?.(opt.gain)
    const srcIndex = script.indexOf(node)
    if (opt.reply?.length) {
      setExtra((e) => [...e, { at: srcIndex, lines: opt.reply }])
      setIdx(idx + 1)
    } else if (idx + 1 >= nodes.length) onDone()
    else setIdx(idx + 1)
  }, [onChoice, script, node, idx, nodes.length, onDone])

  /* 키 입력 */
  useEffect(() => {
    const onKey = (e) => {
      if (isChoice) {
        const n = Number(e.key)
        if (n >= 1 && n <= node.choice.options.length) {
          e.preventDefault()
          choose(node.choice.options[n - 1])
        }
        return
      }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isChoice, node, advance, choose])

  if (!node) return null

  return (
    <div
      ref={box}
      tabIndex={-1}
      onClick={advance}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 outline-none backdrop-blur-[2px]"
      style={{ cursor: isChoice ? 'default' : 'pointer' }}
    >
      {chapter && (
        <div className="absolute left-0 right-0 top-6 text-center">
          <div className="text-[10px] tracking-[0.4em] text-slate-500">
            {chapter.id}장 · {chapter.name}
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-2xl p-4 pb-6">
        {/* 선택지 */}
        {isChoice && (
          <div className="mb-3">
            <div className="mb-2 px-1 text-[12px] text-slate-400">{node.choice.prompt}</div>
            <div className="flex flex-col gap-1.5">
              {node.choice.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); choose(opt) }}
                  className="group flex items-center gap-3 rounded-xl border border-white/12 bg-white/[.06] px-4 py-3 text-left transition hover:border-amber-300/60 hover:bg-amber-300/10"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-white/20 text-[10px] font-black text-slate-400 group-hover:border-amber-300/60 group-hover:text-amber-200">
                    {i + 1}
                  </span>
                  <span className="text-[13px] font-bold text-white">{opt.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 대사창 */}
        {!isChoice && (
          <div className="relative rounded-2xl border border-white/15 bg-slate-900/95 px-5 pb-5 pt-4">
            <div className="absolute -top-2.5 left-5 rounded-full border border-amber-300/40 bg-slate-900 px-3 py-0.5 text-[11px] font-black text-amber-200">
              {node.who}
            </div>
            <p className="min-h-[3.5rem] whitespace-pre-wrap text-[14px] leading-relaxed text-slate-100">
              {full.slice(0, shown)}
              {typing && <span className="ml-0.5 inline-block w-1.5 animate-pulse text-amber-300">▌</span>}
            </p>
            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
              <span>{idx + 1} / {nodes.length}</span>
              <span className={typing ? 'opacity-0' : 'animate-pulse'}>Enter ▼</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
