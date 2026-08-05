/* ==================================================================
   무한의 탑 — 500층

   현재 도달한 층 주변만 보여준다. 500층을 전부 그리면 스크롤이
   끝없이 길어지고 렌더도 무거워진다.
   ================================================================== */
import { useMemo, useState } from 'react'
import {
  MAX_FLOOR, BANDS, bandOf, isBossFloor, MILESTONES, nextMilestone,
  nextFloor, floorLevel, floorReward, baseHpMul, growth,
  gearDropsAt, runeDropsAt,
} from '../game/tower.js'
import { ELEMENT_BY_ID } from '../game/elements.js'
import { floorElements } from '../game/tower.js'

const WINDOW = 12   // 한 번에 보여줄 층 수

export default function TowerScreen({ tower, onClimb, onBack }) {
  const best = tower?.best ?? 0
  const target = nextFloor(tower)
  const cleared = best >= MAX_FLOOR
  const [from, setFrom] = useState(() => Math.max(1, target - 3))
  const ms = nextMilestone(tower)

  const floors = useMemo(
    () => Array.from({ length: WINDOW }, (_, i) => from + i).filter((f) => f >= 1 && f <= MAX_FLOOR),
    [from],
  )

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#07070e]">
      <div className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #2a1f4a, transparent 60%)' }} />

      <div className="relative mx-auto max-w-2xl px-5 py-6">
        <div className="flex items-center justify-between">
          <button onClick={onBack}
            className="rounded-full border border-white/15 px-4 py-1.5 text-[12px] font-bold text-slate-200 hover:bg-white/10">
            ← 홈
          </button>
          <span className="rounded-full border border-violet-300/40 bg-violet-300/10 px-3 py-1 text-[12px] font-black text-violet-200 tabular-nums">
            최고 {best}층 / {MAX_FLOOR}
          </span>
        </div>

        <h1 className="mt-5 text-2xl font-black text-white">🗼 무한의 탑</h1>
        <p className="mt-1 text-[12px] text-slate-400">
          입장 제한이 없습니다. 한 번 오른 층은 다시 오르지 않습니다.
        </p>

        {/* 전체 진행도 */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <div className="flex justify-between text-[12px]">
            <span className="font-black" style={{ color: bandOf(Math.max(1, best)).color }}>
              {bandOf(Math.max(1, best)).name} 구간
            </span>
            <span className="tabular-nums text-slate-400">{Math.round((best / MAX_FLOOR) * 100)}%</span>
          </div>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/10">
            {BANDS.map((b) => {
              const span = b.to - b.from + 1
              const done = Math.max(0, Math.min(span, best - b.from + 1))
              return (
                <div key={b.from} className="relative h-full" style={{ width: `${(span / MAX_FLOOR) * 100}%` }}>
                  <div className="h-full transition-all"
                    style={{ width: `${(done / span) * 100}%`, background: b.color }} />
                </div>
              )
            })}
          </div>
          {ms && (
            <div className="mt-2 text-[11px] text-slate-400">
              다음 이정표 — <span className="font-bold text-amber-300">{ms.floor}층 {ms.text}</span>
              <span className="text-slate-500"> ({ms.floor - best}층 남음)</span>
            </div>
          )}
        </div>

        {/* 도전 버튼 */}
        {cleared ? (
          <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-5 text-center">
            <div className="text-4xl">👑</div>
            <div className="mt-1 text-sm font-black text-amber-200">500층 정복 완료</div>
          </div>
        ) : (
          <button onClick={() => onClimb(target)}
            className="mt-4 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-4 text-center font-black text-white transition hover:brightness-110">
            <span className="text-[15px]">{target}층 도전</span>
            <span className="ml-2 text-[11px] font-bold opacity-80">
              Lv.{floorLevel(target)} · {bandOf(target).name}
            </span>
          </button>
        )}

        {/* 층 목록 */}
        <div className="mt-5 flex items-center justify-between">
          <button onClick={() => setFrom(Math.max(1, from - WINDOW))} disabled={from <= 1}
            className="rounded-lg border border-white/12 px-3 py-1 text-[11px] font-bold text-slate-300 hover:bg-white/10 disabled:opacity-30">
            ▲ 아래 층
          </button>
          <span className="text-[11px] text-slate-500 tabular-nums">{from} ~ {Math.min(MAX_FLOOR, from + WINDOW - 1)}층</span>
          <button onClick={() => setFrom(Math.min(MAX_FLOOR - WINDOW + 1, from + WINDOW))}
            disabled={from + WINDOW > MAX_FLOOR}
            className="rounded-lg border border-white/12 px-3 py-1 text-[11px] font-bold text-slate-300 hover:bg-white/10 disabled:opacity-30">
            위 층 ▼
          </button>
        </div>

        <div className="mt-2 flex flex-col-reverse gap-1.5">
          {floors.map((f) => {
            const done = f <= best
            const isNext = f === target
            const rw = floorReward(f)
            const milestone = MILESTONES[f]
            const els = floorElements(f)
            return (
              <div key={f}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                  isNext ? 'border-fuchsia-400/60 bg-fuchsia-500/10'
                    : done ? 'border-white/8 bg-white/[.02] opacity-55'
                      : 'border-white/10 bg-black/30'
                }`}>
                <span className={`w-12 shrink-0 text-center text-[13px] font-black tabular-nums ${
                  isNext ? 'text-fuchsia-300' : done ? 'text-slate-500' : 'text-white'
                }`}>
                  {f}
                </span>
                <span className="shrink-0 text-sm">
                  {done ? '✓' : isBossFloor(f) ? '👑' : '⚔'}
                </span>
                <span className="flex shrink-0 gap-0.5 text-[11px]">
                  {els.map((e, i) => <span key={i}>{ELEMENT_BY_ID[e].icon}</span>)}
                </span>
                <span className="ml-auto flex items-center gap-1.5 text-[10px] tabular-nums">
                  {milestone && (
                    <span className="rounded bg-amber-400/20 px-1.5 py-0.5 font-bold text-amber-200">
                      ★ {milestone.text}
                    </span>
                  )}
                  {!milestone && runeDropsAt(f) && <span className="text-emerald-300">룬</span>}
                  {!milestone && gearDropsAt(f) && !runeDropsAt(f) && <span className="text-sky-300">장비</span>}
                  <span className="text-amber-300">{rw.gold.toLocaleString()}G</span>
                </span>
              </div>
            )
          })}
        </div>

        {/* 구간 안내 */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <div className="text-[11px] font-bold text-slate-400">난이도 구간</div>
          <div className="mt-2 space-y-1">
            {BANDS.map((b) => (
              <div key={b.from} className="flex items-center gap-2 text-[11px]">
                <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
                <span className="w-24 tabular-nums text-slate-400">
                  {b.from === b.to ? `${b.from}층` : `${b.from}~${b.to}층`}
                </span>
                <span className="font-bold text-white">{b.name}</span>
                <span className="ml-auto text-slate-500 tabular-nums">
                  적 체력 ×{baseHpMul(b.to).toFixed(1)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
            50층부터 룬이 떨어집니다. 층이 오를수록 좋은 등급이 나옵니다.
            {' '}현재 진척도 {Math.round(growth(Math.max(1, best)) * 100)}%.
          </p>
        </div>
      </div>
    </div>
  )
}
