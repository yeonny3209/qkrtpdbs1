/* ==================================================================
   엔딩 선택 — 10장을 끝내면 뜬다

   지금까지의 선택으로 열린 결말만 고를 수 있다.
   "완전한 작별"은 작별 쪽 선택을 충분히 쌓아야 나타난다.
   ================================================================== */
import { useState } from 'react'
import { ENDINGS } from '../game/campaign.js'
import { unlockedEndings, leaningEnding, FAREWELL_THRESHOLD, freshFlags } from '../game/story.js'

export default function EndingScreen({ flags, onConfirm }) {
  const [picked, setPicked] = useState(null)
  const f = { ...freshFlags(), ...flags }
  const open = unlockedEndings(f)
  const leaning = leaningEnding(f)
  const chosen = ENDINGS.find((e) => e.id === picked)

  /* 결말을 고른 뒤 — 결과 컷신 */
  if (chosen) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-[#05050a]">
        <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-12 text-center">
          <div className="text-6xl">{chosen.icon}</div>
          <div className="mt-4 text-[10px] tracking-[0.5em] text-slate-500">ENDING</div>
          <h1 className="mt-2 text-3xl font-black text-white">{chosen.name}</h1>
          <p className="mt-6 whitespace-pre-wrap text-[14px] leading-loose text-slate-300">
            {chosen.text}
          </p>
          <div className="mt-10 border-t border-white/10 pt-6">
            <div className="text-[11px] text-slate-500">— 용의 섬 —</div>
            <button onClick={() => onConfirm(chosen.id)}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-3 font-black text-white transition hover:brightness-110">
              여정을 마친다
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#05050a]">
      <div className="mx-auto max-w-lg px-6 py-12">
        <div className="text-center">
          <div className="text-[10px] tracking-[0.5em] text-slate-500">FINAL CHOICE</div>
          <h1 className="mt-2 text-2xl font-black text-white">무엇을 선택하겠습니까</h1>
          <p className="mt-3 text-[12px] leading-relaxed text-slate-400">
            여기까지 오며 당신이 한 선택들이,<br />고를 수 있는 결말을 정했습니다.
          </p>
        </div>

        {/* 지금까지의 마음 */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <div className="text-[11px] font-bold text-slate-400">당신이 쌓아온 마음</div>
          <div className="mt-2 space-y-2">
            {[
              { id: 'fusion', label: '다시 하나가 되려는 마음', color: '#c084fc' },
              { id: 'share', label: '짐을 나누려는 마음', color: '#4ade80' },
              { id: 'farewell', label: '홀로 짊어지려는 마음', color: '#60a5fa' },
            ].map((row) => {
              const total = Math.max(1, f.fusion + f.share + f.farewell)
              return (
                <div key={row.id}>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">{row.label}</span>
                    <span className="font-black tabular-nums" style={{ color: row.color }}>{f[row.id]}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${(f[row.id] / total) * 100}%`, background: row.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {ENDINGS.map((e) => {
            const locked = !open.includes(e.id)
            return (
              <button key={e.id} disabled={locked}
                onClick={() => setPicked(e.id)}
                className={`rounded-2xl border p-5 text-left transition ${
                  locked
                    ? 'cursor-not-allowed border-white/8 bg-white/[.02] opacity-45'
                    : 'border-white/12 bg-white/[.05] hover:-translate-y-0.5 hover:border-amber-300/50 hover:bg-amber-300/10'
                }`}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{locked ? '🔒' : e.icon}</span>
                  <span className="text-sm font-black text-white">
                    {locked ? '???' : e.name}
                  </span>
                  {!locked && e.id === leaning && (
                    <span className="ml-auto rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                      당신다운 선택
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-slate-400">
                  {locked
                    ? `홀로 짊어지려는 마음이 ${FAREWELL_THRESHOLD} 이상이어야 열립니다. (현재 ${f.farewell})`
                    : e.desc}
                </p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
