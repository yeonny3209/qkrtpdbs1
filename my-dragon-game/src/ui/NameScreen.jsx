/* ==================================================================
   닉네임 정하기 — 게임을 처음 켤 때 한 번만

   못 바꾸는 값이라서 화면에서도 그 사실을 분명히 알려 준다.
   "정말 이 이름으로 하시겠어요?" 를 한 번 더 묻는 이유가 그것이다.
   ================================================================== */
import { useState } from 'react'
import { validateName, NAME_MAX } from '../game/profile.js'

export default function NameScreen({ onConfirm }) {
  const [raw, setRaw] = useState('')
  const [confirming, setConfirming] = useState(false)
  const v = validateName(raw)
  /* 아무것도 안 쳤을 때부터 빨간 글씨를 띄우면 혼내는 것 같다 */
  const showWhy = raw.length > 0 && !v.ok

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#07070e]">
      <div className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #2a1f4a, transparent 60%)' }} />

      <div className="relative mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-12">
        <div className="text-center">
          <div className="text-[11px] tracking-[0.5em] text-fuchsia-300/70">DRAGON MASTER</div>
          <h1 className="mt-3 text-3xl font-black text-white">드래곤 마스터: 레전드</h1>
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[.04] p-5">
          <div className="text-[13px] font-black text-white">이름을 정해 주세요</div>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
            섬에서 당신을 부를 이름입니다.<br />
            <span className="font-bold text-amber-300">한 번 정하면 바꿀 수 없어요.</span>
          </p>

          <input
            autoFocus
            value={raw}
            maxLength={NAME_MAX + 4}
            onChange={(e) => { setRaw(e.target.value); setConfirming(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && v.ok) setConfirming(true) }}
            placeholder="한글 · 영문 · 숫자 2~12자"
            className="mt-4 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-[15px] font-bold text-white outline-none transition placeholder:font-normal placeholder:text-slate-600 focus:border-fuchsia-400/60"
          />

          <div className="mt-2 flex min-h-[18px] items-center justify-between text-[11px]">
            <span className={showWhy ? 'text-rose-400' : 'text-slate-500'}>
              {showWhy ? v.why : ' '}
            </span>
            <span className="tabular-nums text-slate-600">
              {v.ok ? `${v.name.length} / ${NAME_MAX}` : ' '}
            </span>
          </div>

          {!confirming ? (
            <button
              disabled={!v.ok}
              onClick={() => setConfirming(true)}
              className="mt-3 w-full rounded-xl bg-fuchsia-500 py-3 text-sm font-black text-white transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500">
              이 이름으로 시작
            </button>
          ) : (
            <div className="mt-3 rounded-xl border border-amber-300/35 bg-amber-300/10 p-3">
              <div className="text-center text-[13px] text-slate-200">
                <span className="font-black text-amber-200">{v.name}</span>
                <span className="text-slate-400"> 으로 정할까요?</span>
              </div>
              <div className="mt-1 text-center text-[11px] text-slate-400">
                다시는 바꿀 수 없습니다.
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setConfirming(false)}
                  className="flex-1 rounded-lg bg-white/10 py-2.5 text-[12px] font-bold text-white transition hover:bg-white/20">
                  다시 고를래요
                </button>
                <button onClick={() => onConfirm(v.name)}
                  className="flex-1 rounded-lg bg-amber-300 py-2.5 text-[12px] font-black text-slate-900 transition hover:bg-amber-200">
                  네, 정할게요
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-600">
          …이 섬에서는 아무도 당신의 이름을 부르지 않습니다.<br />그래도, 이름은 있어야 하니까요.
        </p>
      </div>
    </div>
  )
}
