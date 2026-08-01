/* ==================================================================
   여러 게임이 함께 쓰는 터치 UI 컴포넌트
   (상수·함수는 util.js — 한 파일이 둘 다 내보내면 HMR이 깨진다)
   ================================================================== */
import { useEffect, useRef } from 'react'

/* ------------------------------------------------------------------
   가상 조이스틱 — 아날로그 입력 (살짝 밀면 걷고, 끝까지 밀면 전력)
   ------------------------------------------------------------------ */
export function VirtualJoystick({ onVec, size = 128, tint = 'rgba(255,255,255,.75)' }) {
  const pad = useRef(null)
  const knob = useRef(null)
  const pid = useRef(null)
  const R = size * 0.33

  const apply = (cx, cy) => {
    const el = pad.current
    if (!el) return
    const r = el.getBoundingClientRect()
    let dx = cx - (r.left + r.width / 2)
    let dy = cy - (r.top + r.height / 2)
    const len = Math.hypot(dx, dy)
    if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R }
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`
    onVec(dx / R, dy / R)
  }
  const reset = () => {
    pid.current = null
    if (knob.current) knob.current.style.transform = 'translate(0px, 0px)'
    onVec(0, 0)
  }
  /* 게임을 벗어나도 입력이 남지 않도록 정리 */
  useEffect(() => () => onVec(0, 0), [onVec])

  return (
    <div
      data-ui
      ref={pad}
      onPointerDown={(e) => {
        e.preventDefault()
        pid.current = e.pointerId
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* 무시 */ }
        apply(e.clientX, e.clientY)
      }}
      onPointerMove={(e) => { if (pid.current === e.pointerId) apply(e.clientX, e.clientY) }}
      onPointerUp={(e) => { if (pid.current === e.pointerId) reset() }}
      onPointerCancel={reset}
      onContextMenu={(e) => e.preventDefault()}
      style={{ width: size, height: size, touchAction: 'none' }}
      className="relative select-none rounded-full border-2 border-white/25 bg-black/35 backdrop-blur-sm"
    >
      <div
        ref={knob}
        style={{
          width: size * 0.44, height: size * 0.44,
          marginLeft: -size * 0.22, marginTop: -size * 0.22,
          background: tint,
        }}
        className="absolute left-1/2 top-1/2 rounded-full border border-white/50 shadow-lg"
      />
    </div>
  )
}

/* ------------------------------------------------------------------
   터치 버튼 — 누르는 순간/떼는 순간을 각각 알려준다
   ------------------------------------------------------------------ */
export function TouchBtn({ onPress, onRelease, label, sub, size = 78, bg, border, disabled, textSize = 'text-base' }) {
  return (
    <button
      data-ui
      disabled={disabled}
      onPointerDown={(e) => { e.preventDefault(); if (!disabled && onPress) onPress() }}
      onPointerUp={() => { if (onRelease) onRelease() }}
      onPointerCancel={() => { if (onRelease) onRelease() }}
      onPointerLeave={() => { if (onRelease) onRelease() }}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        width: size, height: size, touchAction: 'none',
        background: bg || 'rgba(255,255,255,.14)',
        borderColor: border || 'rgba(255,255,255,.32)',
      }}
      className={`flex select-none flex-col items-center justify-center rounded-full border-2 font-black text-white backdrop-blur-sm transition active:scale-90 disabled:opacity-35 ${textSize}`}
    >
      <span className="leading-none">{label}</span>
      {sub && <span className="mt-0.5 text-[9px] font-bold leading-none opacity-75">{sub}</span>}
    </button>
  )
}
