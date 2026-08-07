/* ==================================================================
   메인 캠페인 — 장 선택 → 스테이지 선택 → 스토리 → 전투
   ================================================================== */
import { useState } from 'react'
import { ELEMENT_BY_ID } from '../game/elements.js'
import {
  CAMPAIGN, DIFFICULTIES, chapterUnlocked, stageUnlocked, chapterProgress,
} from '../game/campaign.js'
import { stageReward } from '../game/encounter.js'

/* 스토리 연출 — 한 장면씩 넘긴다 */
export function StoryBeat({ beat, chapter, onDone }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/85 p-5 sm:items-center" onClick={onDone}>
      <div className="w-full max-w-lg rounded-3xl border border-white/12 bg-slate-900/95 p-6">
        <div className="text-[10px] tracking-[0.35em] text-slate-500">
          {chapter.id}장 · {chapter.name}
        </div>
        <div className="mt-3 text-sm font-black" style={{ color: beat.kind === 'omen' ? '#c084fc' : '#fbbf24' }}>
          {beat.who}
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-white">{beat.text}</p>
        <button onClick={onDone}
          className="mt-5 w-full rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white transition hover:bg-white/20">
          계속
        </button>
      </div>
    </div>
  )
}

export default function CampaignScreen({ cleared, difficulty, setDifficulty, onStart, onBack }) {
  const [openChapter, setOpenChapter] = useState(null)
  const ch = openChapter != null ? CAMPAIGN.find((c) => c.id === openChapter) : null

  /* ---------- 스테이지 목록 ---------- */
  if (ch) {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-[#07070e]">
        <div className="mx-auto max-w-2xl px-5 py-6">
          <button onClick={() => setOpenChapter(null)} className="text-[12px] font-bold text-slate-400 hover:text-white">← 장 선택</button>
          <h2 className="mt-2 text-2xl font-black text-white">{ch.id}장 · {ch.name}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{ch.intro}</p>

          {/* 난이도 */}
          <div className="mt-4 flex gap-2">
            {DIFFICULTIES.map((d) => (
              <button key={d.id} onClick={() => setDifficulty(d.id)}
                className={`flex-1 rounded-xl border py-2 text-[12px] font-black transition ${
                  difficulty === d.id ? 'border-fuchsia-400/60 bg-fuchsia-500/15 text-white'
                    : 'border-white/10 bg-white/[.03] text-slate-400 hover:bg-white/[.07]'}`}>
                {d.name}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {ch.stages.map((s) => {
              const open = stageUnlocked(s, cleared)
              const done = !!cleared[s.id]
              const rw = stageReward(s, difficulty)
              return (
                <button key={s.id} data-tut={open && !cleared[s.id] ? 'stage' : undefined}
                  onClick={() => open && onStart(s)} disabled={!open}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    open ? 'border-white/10 bg-white/[.04] hover:bg-white/[.09]' : 'cursor-not-allowed border-white/5 bg-black/30 opacity-50'}`}>
                  <span className="text-xl">{s.boss ? '👑' : open ? '⚔' : '🔒'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-black text-white">
                      {ch.id}-{s.no} {s.boss && <span className="text-amber-300">보스</span>}
                    </div>
                    <div className="truncate text-[11px] text-slate-500">
                      Lv.{s.level} · 적 {s.count}마리 · EXP {rw.exp} · {rw.gold}G
                    </div>
                  </div>
                  {done && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300">클리어</span>}
                </button>
              )
            })}
          </div>
          <button onClick={onBack} className="mx-auto mt-6 block rounded-full border border-white/15 px-5 py-2 text-[12px] font-bold text-slate-300 hover:bg-white/5">
            ← 홈으로
          </button>
        </div>
      </div>
    )
  }

  /* ---------- 장 목록 ---------- */
  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#07070e]">
      <div className="mx-auto max-w-2xl px-5 py-6">
        <button onClick={onBack} className="text-[12px] font-bold text-slate-400 hover:text-white">← 홈</button>
        <h2 className="mt-2 text-2xl font-black text-white">⚔ 메인 캠페인</h2>
        <p className="text-[12px] text-slate-500">용의 섬 — 10장 100스테이지</p>

        <div className="mt-5 space-y-2.5">
          {CAMPAIGN.map((c) => {
            const open = chapterUnlocked(c.id, cleared)
            const p = chapterProgress(c.id, cleared)
            const el = ELEMENT_BY_ID[c.boss.element]
            return (
              <button key={c.id} onClick={() => open && setOpenChapter(c.id)} disabled={!open}
                className={`w-full overflow-hidden rounded-2xl border p-4 text-left transition ${
                  open ? 'border-white/10 hover:-translate-y-0.5' : 'cursor-not-allowed border-white/5 opacity-45'}`}
                style={{ background: open ? `linear-gradient(150deg, ${el.deep}aa, #0b0b14 70%)` : '#0b0b14' }}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{open ? el.icon : '🔒'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-black text-white">{c.id}장 · {c.name}</div>
                    <div className="truncate text-[11px] text-slate-400">{c.region}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[11px] font-black" style={{ color: el.glow }}>{p.done}/{p.total}</div>
                  </div>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${(p.done / p.total) * 100}%`, background: el.color }} />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
