/* ==================================================================
   보유 드래곤 — 편성(최대 3) · 진화
   ================================================================== */
import { useState } from 'react'
import DragonPreview from './DragonPreview.jsx'
import { ELEMENT_BY_ID } from '../game/elements.js'
import {
  DRAGON_BY_ID, RARITY_BY_ID, statsOf, power, expToNext,
  STAT_KEYS, STAT_LABEL, MAX_EVOLUTION, EVOLUTIONS, evoCost, evoGoldCost, evolutionPassives,
} from '../game/dragons.js'

export const TEAM_SIZE = 3

/* 부족한 분신 1마리를 진화석 몇 개로 대신할 수 있는가.
   결정 동굴을 돌면 중복이 안 떠도 진화를 이어갈 수 있게 하는 장치다. */
export const STONES_PER_COPY = 40

export default function RosterScreen({ dragons, team, gold, stones = 0, onToggleTeam, onEvolve, onBack }) {
  const [detail, setDetail] = useState(null)
  const owned = Object.entries(dragons)
    .map(([id, s]) => ({ id, ...s, dragon: DRAGON_BY_ID[id] }))
    .filter((o) => o.dragon)
    .sort((a, b) => power(b.dragon, b.level, b.evo) - power(a.dragon, a.level, a.evo))

  const d = detail ? owned.find((o) => o.id === detail) : null

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#07070e]">
      <div className="mx-auto max-w-3xl px-5 py-6">
        <button onClick={onBack} className="text-[12px] font-bold text-slate-400 hover:text-white">← 홈</button>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">🐲 보유 드래곤</h2>
            <p className="text-[12px] text-slate-500">
              편성 {team.length}/{TEAM_SIZE} · 총 {owned.length}종 보유
            </p>
          </div>
          <div className="flex gap-2 text-[12px] font-black">
            <div className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-amber-200">
              🪙 {gold.toLocaleString()}
            </div>
            <div className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-violet-200">
              💠 {stones.toLocaleString()}
            </div>
          </div>
        </div>

        {owned.length === 0 && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[.03] p-8 text-center text-[13px] text-slate-500">
            아직 드래곤이 없습니다. 소환에서 드래곤을 얻어보세요.
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {owned.map((o) => {
            const el = ELEMENT_BY_ID[o.dragon.element]
            const rar = RARITY_BY_ID[o.dragon.rarity]
            const inTeam = team.includes(o.id)
            return (
              <div key={o.id}
                className="overflow-hidden rounded-2xl border p-3"
                style={{
                  borderColor: inTeam ? '#c084fc99' : rar.color + '44',
                  background: `linear-gradient(155deg, ${el.deep}bb, #0b0b14 72%)`,
                }}>
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-black" style={{ color: rar.color }}>{'★'.repeat(rar.star)}</span>
                  <span className="text-lg">{el.icon}</span>
                </div>
                <div className="mt-1 truncate text-[12px] font-black text-white">{o.dragon.name}</div>
                <div className="text-[10px] text-slate-400">
                  Lv.{o.level} · {o.evo > 0 ? `${o.evo}진화` : '0진화'} · 보유 {o.count}
                </div>
                <div className="mt-1.5 flex gap-1">
                  <button onClick={() => onToggleTeam(o.id)}
                    className={`flex-1 rounded-lg py-1.5 text-[11px] font-black transition ${
                      inTeam ? 'bg-fuchsia-500/80 text-white' : 'bg-white/10 text-slate-200 hover:bg-white/20'}`}>
                    {inTeam ? '편성됨' : '편성'}
                  </button>
                  <button onClick={() => setDetail(o.id)}
                    className="rounded-lg bg-white/10 px-2 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-white/20">
                    정보
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 상세 · 진화 */}
      {d && <DetailPanel o={d} gold={gold} stones={stones} onEvolve={onEvolve} onClose={() => setDetail(null)} />}
    </div>
  )
}

function DetailPanel({ o, gold, stones, onEvolve, onClose }) {
  const el = ELEMENT_BY_ID[o.dragon.element]
  const rar = RARITY_BY_ID[o.dragon.rarity]
  const cur = statsOf(o.dragon, o.level, o.evo)
  const next = o.evo < MAX_EVOLUTION ? statsOf(o.dragon, o.level, o.evo + 1) : null
  const step = o.evo + 1
  const needCopies = evoCost(step)
  const needGold = evoGoldCost(step)
  /* 진화에 쓸 수 있는 여분 = 보유 수 - 본체 1 */
  const spare = o.count - 1
  /* 모자라는 만큼은 진화석으로 메운다 */
  const missing = Math.max(0, needCopies - spare)
  const needStones = missing * STONES_PER_COPY
  const canEvo = next && gold >= needGold && stones >= needStones

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl border shadow-2xl"
        style={{ borderColor: rar.color + '55', background: `linear-gradient(170deg, ${el.deep}, #0a0a12 65%)` }}>
        <DragonPreview elementId={o.dragon.element} rarity={o.dragon.rarity} className="h-48 w-full" />
        <div className="p-5 pt-0">
          <div className="text-[10px] font-black tracking-[0.3em]" style={{ color: rar.color }}>
            {'★'.repeat(rar.star)} {rar.name}
          </div>
          <h3 className="mt-1 text-xl font-black text-white">{o.dragon.name}</h3>
          <div className="text-[12px] font-bold" style={{ color: el.glow }}>
            {el.icon} {el.name} · {el.role}
          </div>

          {/* 레벨 · 경험치 */}
          <div className="mt-3 rounded-xl bg-white/5 p-3">
            <div className="flex justify-between text-[12px]">
              <span className="font-black text-white">Lv.{o.level}</span>
              <span className="text-slate-400">{o.exp} / {expToNext(o.level)} EXP</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-sky-400" style={{ width: `${Math.min(100, (o.exp / expToNext(o.level)) * 100)}%` }} />
            </div>
          </div>

          {/* 능력치 */}
          <div className="mt-3 space-y-1">
            {STAT_KEYS.map((k) => (
              <div key={k} className="flex items-center gap-2 text-[12px]">
                <span className="w-9 text-slate-400">{STAT_LABEL[k]}</span>
                <span className="ml-auto font-mono font-bold text-white">{cur[k]}</span>
                {next && <span className="w-16 text-right font-mono text-emerald-400">+{next[k] - cur[k]}</span>}
              </div>
            ))}
          </div>

          {/* 진화 */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-black text-white">진화 {o.evo} / {MAX_EVOLUTION}</span>
              <span className="text-[10px] text-slate-400">패시브 {evolutionPassives(o.evo)}개</span>
            </div>
            {next ? (
              <>
                <div className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                  {EVOLUTIONS[o.evo].note}
                </div>
                <div className="mt-2 flex justify-between text-[11px]">
                  <span className={spare >= needCopies ? 'text-emerald-400' : 'text-slate-400'}>
                    같은 드래곤 {Math.min(spare, needCopies)} / {needCopies}
                  </span>
                  <span className={gold >= needGold ? 'text-emerald-400' : 'text-rose-400'}>
                    🪙 {needGold.toLocaleString()}
                  </span>
                </div>
                {missing > 0 && (
                  <div className={`mt-1 text-[11px] ${stones >= needStones ? 'text-violet-300' : 'text-rose-400'}`}>
                    부족한 {missing}마리를 진화석으로 대체 · 💠 {needStones} (보유 {stones})
                  </div>
                )}
                <button onClick={() => { onEvolve(o.id); onClose() }} disabled={!canEvo}
                  className={`mt-2 w-full rounded-xl py-2.5 text-[13px] font-black transition ${
                    canEvo ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:brightness-110'
                      : 'cursor-not-allowed bg-slate-800 text-slate-600'}`}>
                  {step}진화 하기
                </button>
              </>
            ) : (
              <div className="mt-2 text-center text-[12px] font-bold text-amber-300">최종 진화 완료</div>
            )}
          </div>

          <button onClick={onClose} className="mt-4 w-full rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white hover:bg-white/20">
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
