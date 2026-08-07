/* ==================================================================
   던전 — 종류 3개 × 난이도 3단계, 하루 입장 횟수 제한
   ================================================================== */
import { useState } from 'react'
import {
  DUNGEONS, TIERS, dungeonReward, tierUnlocked,
  entriesLeft, maxEntries, BASE_ENTRIES,
} from '../game/dungeon.js'
import { SUBSCRIPTION, subActive } from '../game/shop.js'

export default function DungeonScreen({ entries, sub, clearedCount, onEnter, onBack }) {
  const [openId, setOpenId] = useState(null)
  const left = entriesLeft(entries, sub)
  const max = maxEntries(entries, sub)
  const hasSub = subActive(sub)

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#07070e]">
      <div className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #1f3a4a, transparent 60%)' }} />

      <div className="relative mx-auto max-w-2xl px-5 py-6">
        <div className="flex items-center justify-between">
          <button onClick={onBack}
            className="rounded-full border border-white/15 px-4 py-1.5 text-[12px] font-bold text-slate-200 hover:bg-white/10">
            ← 홈
          </button>
          <span className={`rounded-full border px-3 py-1 text-[12px] font-black ${
            left > 0 ? 'border-sky-300/40 bg-sky-300/10 text-sky-200' : 'border-white/12 bg-white/5 text-slate-500'
          }`}>
            오늘 입장 {left} / {max}
          </span>
        </div>

        <h1 className="mt-5 text-2xl font-black text-white">사이드 던전</h1>
        <p className="mt-1 text-[12px] text-slate-400">
          하루 {BASE_ENTRIES}회 입장{hasSub && <span className="text-amber-300"> · 월정액 +{SUBSCRIPTION.dungeonBonus}회</span>}
          {' '}· 자정에 초기화
        </p>

        {left === 0 && (
          <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-[12px] text-amber-200">
            오늘 입장 횟수를 모두 썼습니다. 프리미엄 상점의 던전 입장권으로 늘릴 수 있습니다.
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3">
          {DUNGEONS.map((d) => {
            const open = openId === d.id
            return (
              <div key={d.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.04]">
                <button onClick={() => setOpenId(open ? null : d.id)}
                  className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/[.06]">
                  <span className="text-3xl">{d.icon}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-black" style={{ color: d.color }}>{d.name}</span>
                    <span className="block text-[11px] text-slate-400">{d.desc}</span>
                  </span>
                  <span className="text-slate-500">{open ? '▲' : '▼'}</span>
                </button>

                {open && (
                  <div className="flex flex-col gap-1.5 border-t border-white/8 p-3">
                    {TIERS.map((t) => {
                      const unlocked = tierUnlocked(t.id, clearedCount)
                      const rw = dungeonReward(d.id, t.id)
                      const canGo = unlocked && left > 0
                      return (
                        <button key={t.id} disabled={!canGo}
                          onClick={() => onEnter(d.id, t.id)}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                            canGo
                              ? 'border-white/12 bg-black/30 hover:border-white/30 hover:bg-white/10'
                              : 'cursor-not-allowed border-white/6 bg-black/20 opacity-45'
                          }`}>
                          <span className="w-10 shrink-0 text-[12px] font-black text-white">{t.name}</span>
                          <span className="shrink-0 text-[10px] text-slate-500">Lv.{t.level}</span>
                          <span className="ml-auto flex gap-2 text-[11px] font-bold tabular-nums">
                            {rw.exp > 0 && <span className="text-sky-300">EXP {rw.exp.toLocaleString()}</span>}
                            {rw.gold > 0 && <span className="text-amber-300">{rw.gold.toLocaleString()}G</span>}
                            {rw.stones > 0 && <span className="text-violet-300">💠{rw.stones}</span>}
                            {rw.drinks > 0 && <span className="text-pink-300">🧪{rw.drinks}</span>}
                          </span>
                          {!unlocked && (
                            <span className="shrink-0 text-[10px] text-slate-500">🔒 {t.needCleared}스테이지</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
