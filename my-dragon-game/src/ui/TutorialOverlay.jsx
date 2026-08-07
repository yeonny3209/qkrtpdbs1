/* ==================================================================
   튜토리얼 말풍선

   강조할 요소는 UI 쪽에서 data-tut="이름" 을 달아 두고, 여기서
   그 요소를 찾아 구멍을 뚫는다. 좌표를 상수로 박으면 화면 크기가
   바뀔 때마다 어긋나기 때문이다.

   구멍은 바깥 네 장의 검은 판으로 만든다. 가운데를 뚫은 큰 판
   하나(box-shadow 로 뚫기)는 그 구멍까지 클릭을 막아버려서,
   "이 버튼을 눌러 보세요" 를 정작 누를 수 없게 된다.
   ================================================================== */
import { useEffect, useLayoutEffect, useState } from 'react'
import { stepAt, isTappable, STEP_COUNT as STEP_TOTAL } from '../game/tutorial.js'

const PAD = 8

function useSpotRect(spot, deps) {
  const [rect, setRect] = useState(null)

  useLayoutEffect(() => {
    if (!spot) { setRect(null); return }
    let raf = 0
    const measure = () => {
      const el = document.querySelector(`[data-tut="${spot}"]`)
      if (!el) { setRect(null); return }
      const r = el.getBoundingClientRect()
      setRect({ x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 })
    }
    /* 화면이 막 바뀐 직후엔 아직 그려지지 않았을 수 있다 */
    measure()
    raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot, ...deps])

  return rect
}

export default function TutorialOverlay({ tut, screen, onTap, onSkip }) {
  const step = stepAt(tut.step)
  const rect = useSpotRect(step?.spot, [tut.step, screen])
  const tappable = isTappable(tut)

  /* 탭으로 넘기는 단계는 스페이스·엔터로도 넘어간다 */
  useEffect(() => {
    if (!tappable) return
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tappable, onTap])

  if (!step) return null

  /* 말풍선은 강조 영역을 피해서 위나 아래에 붙는다 */
  const below = !rect || rect.y + rect.h < window.innerHeight * 0.52

  const shade = 'fixed bg-black/72 backdrop-blur-[1px]'
  const blocks = rect
    ? [
      { className: shade, style: { left: 0, top: 0, width: '100vw', height: Math.max(0, rect.y) } },
      { className: shade, style: { left: 0, top: rect.y + rect.h, width: '100vw', bottom: 0 } },
      { className: shade, style: { left: 0, top: rect.y, width: Math.max(0, rect.x), height: rect.h } },
      { className: shade, style: { left: rect.x + rect.w, top: rect.y, right: 0, height: rect.h } },
    ]
    : [{ className: shade, style: { inset: 0 } }]

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {/* 어둡게 — 강조 구멍만 빼고. 클릭은 이 판들만 먹는다 */}
      {blocks.map((b, i) => (
        <div key={i} {...b}
          className={`${b.className} pointer-events-auto`}
          onClick={tappable ? onTap : undefined}
          style={{ ...b.style, cursor: tappable ? 'pointer' : 'default' }} />
      ))}

      {/* 강조 테두리 — 구멍 자체는 클릭이 통과해야 하므로 테두리만 그린다 */}
      {rect && (
        <div className="pointer-events-none fixed rounded-2xl"
          style={{
            left: rect.x, top: rect.y, width: rect.w, height: rect.h,
            border: '2px solid #fbbf24',
            boxShadow: '0 0 0 3px rgba(251,191,36,.25), 0 0 28px rgba(251,191,36,.45)',
            animation: 'tutPulse 1.6s ease-in-out infinite',
          }} />
      )}

      {/* 말풍선 */}
      <div className="pointer-events-auto fixed inset-x-0 px-4"
        style={below
          ? { top: rect ? Math.min(rect.y + rect.h + 14, window.innerHeight - 240) : '38%' }
          : { bottom: rect ? Math.min(window.innerHeight - rect.y + 14, window.innerHeight - 240) : 40 }}>
        <div className="mx-auto max-w-md rounded-2xl border border-amber-300/35 bg-slate-900/97 p-4 shadow-[0_20px_60px_rgba(0,0,0,.7)]"
          onClick={tappable ? onTap : undefined}
          style={{ cursor: tappable ? 'pointer' : 'default' }}>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-300/15 text-lg">🌙</div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-black text-amber-200">{step.title}</div>
              <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-slate-200">
                {step.body}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] tabular-nums text-slate-500">
                {tut.step + 1} / {STEP_TOTAL}
              </span>
              <div className="h-1 w-24 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-amber-300 transition-all"
                  style={{ width: `${((tut.step + 1) / STEP_TOTAL) * 100}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); onSkip() }}
                className="rounded-full px-2.5 py-1 text-[11px] text-slate-500 transition hover:bg-white/5 hover:text-slate-300">
                건너뛰기
              </button>
              {tappable
                ? <button onClick={(e) => { e.stopPropagation(); onTap() }}
                  className="rounded-full bg-amber-300 px-3.5 py-1.5 text-[11px] font-black text-slate-900 transition hover:bg-amber-200">
                  다음 →
                </button>
                : <span className="animate-pulse text-[11px] font-bold text-amber-300/80">직접 해 보세요</span>}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tutPulse {
          0%,100% { box-shadow: 0 0 0 3px rgba(251,191,36,.22), 0 0 22px rgba(251,191,36,.35) }
          50%     { box-shadow: 0 0 0 5px rgba(251,191,36,.32), 0 0 34px rgba(251,191,36,.60) }
        }
      `}</style>
    </div>
  )
}
