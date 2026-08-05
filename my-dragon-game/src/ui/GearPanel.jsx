/* ==================================================================
   장비 · 룬 관리 — 드래곤 상세에서 열린다

   5칸 슬롯 · 가방에서 교체 · 강화 · 룬 장착
   ================================================================== */
import { useState } from 'react'
import {
  SLOTS, SLOT_IDS, gearInfo, activeSet, MAX_PLUS, failChance,
  enhanceGold, PROTECT_GEM_COST, salvageGold, gradeRank,
} from '../game/equipment.js'
import { runeInfo, salvageStones, runeGradeRank } from '../game/runes.js'
import { STAT_LABEL } from '../game/dragons.js'

const statLine = (stats) =>
  Object.entries(stats).map(([k, v]) => `${STAT_LABEL[k]} +${v}`).join(' · ')

/* ---------------- 장비 한 칸 ---------------- */
function GearCard({ item, onClick, active, compact }) {
  if (!item) return null
  const info = gearInfo(item)
  return (
    <button onClick={onClick}
      className={`w-full rounded-xl border px-2.5 py-2 text-left transition hover:bg-white/10 ${
        active ? 'border-fuchsia-400/70 bg-fuchsia-500/10' : 'border-white/12 bg-black/30'
      }`}
      style={{ borderColor: active ? undefined : info.grade.color + '55' }}>
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{info.slot.icon}</span>
        <span className="truncate text-[11px] font-black text-white">{info.name}</span>
        {item.plus > 0 && <span className="shrink-0 text-[11px] font-black text-amber-300">+{item.plus}</span>}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[9px]">
        <span className="font-bold" style={{ color: info.grade.color }}>{info.grade.name}</span>
        <span className="text-slate-500">{info.set.icon} {info.set.name}</span>
      </div>
      {!compact && <div className="mt-0.5 text-[10px] text-emerald-300">{statLine(info.stats)}</div>}
    </button>
  )
}

/* ---------------- 강화 ---------------- */
function EnhancePanel({ item, gold, gems, onEnhance, onClose }) {
  const [protect, setProtect] = useState(false)
  const info = gearInfo(item)
  const nextInfo = gearInfo({ ...item, plus: item.plus + 1 })
  const maxed = item.plus >= MAX_PLUS
  const cost = enhanceGold(item.plus)
  const fail = failChance(item.plus)
  const canPay = gold >= cost && (!protect || gems >= PROTECT_GEM_COST)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-3xl border border-white/12 bg-slate-900 p-5">
        <div className="text-center">
          <div className="text-3xl">{info.slot.icon}</div>
          <div className="mt-1 text-sm font-black text-white">{info.name}</div>
          <div className="text-[11px] font-bold" style={{ color: info.grade.color }}>
            {info.grade.name} · {info.set.icon} {info.set.name}
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-black/40 p-3">
          <div className="flex items-center justify-center gap-3 text-[13px] font-black">
            <span className="text-white">+{item.plus}</span>
            {!maxed && <><span className="text-slate-500">→</span><span className="text-amber-300">+{item.plus + 1}</span></>}
          </div>
          <div className="mt-2 space-y-0.5">
            {Object.entries(info.stats).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[11px]">
                <span className="text-slate-400">{STAT_LABEL[k]}</span>
                <span className="tabular-nums text-white">
                  +{v}
                  {!maxed && <span className="ml-1 text-emerald-400">→ +{nextInfo.stats[k]}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>

        {maxed ? (
          <div className="mt-4 text-center text-[12px] font-bold text-amber-300">최대 강화 완료</div>
        ) : (
          <>
            <div className="mt-3 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">비용</span>
                <span className={`tabular-nums font-bold ${gold >= cost ? 'text-amber-300' : 'text-rose-400'}`}>
                  🪙 {cost.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">실패 확률</span>
                <span className={`tabular-nums font-bold ${fail > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {Math.round(fail * 100)}%
                </span>
              </div>
            </div>

            {fail > 0 && (
              <button onClick={() => setProtect(!protect)}
                className={`mt-2 flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                  protect ? 'border-sky-400/60 bg-sky-400/10' : 'border-white/12 hover:bg-white/5'
                }`}>
                <span className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                  protect ? 'border-sky-400 bg-sky-400 text-slate-900' : 'border-white/30'
                }`}>{protect ? '✓' : ''}</span>
                <span className="text-[11px] font-bold text-white">보호권 사용</span>
                <span className={`ml-auto text-[11px] font-black ${gems >= PROTECT_GEM_COST ? 'text-fuchsia-300' : 'text-rose-400'}`}>
                  💎 {PROTECT_GEM_COST}
                </span>
              </button>
            )}
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
              {protect
                ? '실패해도 강화 수치가 내려가지 않습니다.'
                : '실패하면 강화 수치가 1 내려갑니다. 장비가 사라지지는 않습니다.'}
            </p>

            <button onClick={() => onEnhance(item.uid, protect)} disabled={!canPay}
              className={`mt-3 w-full rounded-xl py-2.5 text-[13px] font-black transition ${
                canPay ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:brightness-110'
                  : 'cursor-not-allowed bg-slate-800 text-slate-600'
              }`}>
              강화하기
            </button>
          </>
        )}

        <button onClick={onClose} className="mt-2 w-full rounded-xl bg-white/10 py-2 text-[12px] font-bold text-white hover:bg-white/20">
          닫기
        </button>
      </div>
    </div>
  )
}

/* ---------------- 본체 ---------------- */
export default function GearPanel({
  dragonId, loadout, runeId, inventory, runeBag, gold, gems,
  onEquip, onUnequip, onEquipRune, onUnequipRune,
  onEnhance, onSalvage, onSalvageRune,
}) {
  const [picking, setPicking] = useState(null)   // 교체할 슬롯 id
  const [enhancing, setEnhancing] = useState(null)
  const [runePick, setRunePick] = useState(false)

  const worn = Object.fromEntries(
    SLOT_IDS.map((s) => [s, inventory.find((i) => i.uid === loadout[s]) || null]),
  )
  const set = activeSet(worn)
  const rune = runeBag.find((r) => r.uid === runeId) || null
  const rInfo = runeInfo(rune)

  /* 다른 드래곤이 이미 낀 장비는 목록에서 뺀다 */
  const candidates = picking
    ? inventory
      .filter((i) => i.slot === picking && !i.equippedBy)
      .sort((a, b) => gradeRank(b.grade) - gradeRank(a.grade) || b.plus - a.plus)
    : []
  const runeCandidates = runeBag
    .filter((r) => !r.equippedBy)
    .sort((a, b) => runeGradeRank(b.grade) - runeGradeRank(a.grade))

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-black text-white">장비</span>
        {set ? (
          <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">
            {set.icon} {set.name} 세트 — {set.desc}
          </span>
        ) : (
          <span className="text-[10px] text-slate-500">5칸을 같은 세트로 채우면 세트 효과</span>
        )}
      </div>

      {/* 5칸 */}
      <div className="mt-2 space-y-1.5">
        {SLOTS.map((slot) => {
          const item = worn[slot.id]
          return (
            <div key={slot.id} className="flex items-center gap-1.5">
              {item ? (
                <>
                  <div className="min-w-0 flex-1"><GearCard item={item} onClick={() => setEnhancing(item)} /></div>
                  <button onClick={() => setPicking(slot.id)}
                    className="shrink-0 rounded-lg bg-white/10 px-2 py-2 text-[10px] font-bold text-slate-200 hover:bg-white/20">
                    교체
                  </button>
                  <button onClick={() => onUnequip(dragonId, slot.id)}
                    className="shrink-0 rounded-lg bg-white/10 px-2 py-2 text-[10px] font-bold text-slate-400 hover:bg-white/20">
                    해제
                  </button>
                </>
              ) : (
                <button onClick={() => setPicking(slot.id)}
                  className="flex w-full items-center gap-2 rounded-xl border border-dashed border-white/15 px-2.5 py-2.5 text-left hover:bg-white/5">
                  <span className="text-sm opacity-50">{slot.icon}</span>
                  <span className="text-[11px] text-slate-500">{slot.name} — 비어 있음</span>
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* 룬 */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[12px] font-black text-white">룬</span>
        <span className="text-[10px] text-slate-500">드래곤당 1개</span>
      </div>
      {rune ? (
        <div className="mt-1.5 flex items-center gap-1.5">
          <div className="min-w-0 flex-1 rounded-xl border px-2.5 py-2"
            style={{ borderColor: rInfo.grade.color + '66', background: rInfo.grade.color + '14' }}>
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{rInfo.icon}</span>
              <span className="truncate text-[11px] font-black text-white">{rInfo.name}</span>
              <span className="ml-auto shrink-0 text-[10px] font-bold" style={{ color: rInfo.grade.color }}>
                {rInfo.grade.name}
              </span>
            </div>
            <div className="mt-0.5 text-[10px] text-emerald-300">
              모든 스탯 +{Math.round(rInfo.statMul * 100)}% · {rInfo.desc}
            </div>
          </div>
          <button onClick={() => setRunePick(true)}
            className="shrink-0 rounded-lg bg-white/10 px-2 py-2 text-[10px] font-bold text-slate-200 hover:bg-white/20">교체</button>
          <button onClick={() => onUnequipRune(dragonId)}
            className="shrink-0 rounded-lg bg-white/10 px-2 py-2 text-[10px] font-bold text-slate-400 hover:bg-white/20">해제</button>
        </div>
      ) : (
        <button onClick={() => setRunePick(true)}
          className="mt-1.5 flex w-full items-center gap-2 rounded-xl border border-dashed border-white/15 px-2.5 py-2.5 text-left hover:bg-white/5">
          <span className="text-sm opacity-50">🔮</span>
          <span className="text-[11px] text-slate-500">
            {runeBag.length ? '룬 장착하기' : '무한의 탑 50층부터 룬이 나옵니다'}
          </span>
        </button>
      )}

      {/* 장비 고르기 */}
      {picking && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/85 p-4 sm:items-center"
          onClick={() => setPicking(null)}>
          <div onClick={(e) => e.stopPropagation()}
            className="max-h-[70vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-white/12 bg-slate-900 p-4">
            <div className="mb-2 text-[13px] font-black text-white">
              {SLOTS.find((s) => s.id === picking).name} 고르기
            </div>
            {candidates.length === 0 && (
              <div className="py-8 text-center text-[12px] text-slate-500">
                가방에 이 부위의 장비가 없습니다.
              </div>
            )}
            <div className="space-y-1.5">
              {candidates.map((it) => (
                <div key={it.uid} className="flex items-center gap-1.5">
                  <div className="min-w-0 flex-1">
                    <GearCard item={it} active={loadout[picking] === it.uid}
                      onClick={() => { onEquip(dragonId, picking, it.uid); setPicking(null) }} />
                  </div>
                  <button onClick={() => onSalvage(it.uid)}
                    className="shrink-0 rounded-lg bg-rose-500/15 px-2 py-2 text-[10px] font-bold text-rose-300 hover:bg-rose-500/30">
                    분해<br />🪙{salvageGold(it).toLocaleString()}
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => setPicking(null)}
              className="mt-3 w-full rounded-xl bg-white/10 py-2 text-[12px] font-bold text-white hover:bg-white/20">닫기</button>
          </div>
        </div>
      )}

      {/* 룬 고르기 */}
      {runePick && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/85 p-4 sm:items-center"
          onClick={() => setRunePick(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className="max-h-[70vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-white/12 bg-slate-900 p-4">
            <div className="mb-2 text-[13px] font-black text-white">룬 고르기</div>
            {runeCandidates.length === 0 && (
              <div className="py-8 text-center text-[12px] leading-relaxed text-slate-500">
                가진 룬이 없습니다.<br />무한의 탑 50층부터 떨어집니다.
              </div>
            )}
            <div className="space-y-1.5">
              {runeCandidates.map((r) => {
                const ri = runeInfo(r)
                return (
                  <div key={r.uid} className="flex items-center gap-1.5">
                    <button onClick={() => { onEquipRune(dragonId, r.uid); setRunePick(false) }}
                      className="min-w-0 flex-1 rounded-xl border px-2.5 py-2 text-left transition hover:brightness-125"
                      style={{ borderColor: ri.grade.color + '66', background: ri.grade.color + '14' }}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{ri.icon}</span>
                        <span className="truncate text-[11px] font-black text-white">{ri.name}</span>
                        <span className="ml-auto shrink-0 text-[10px] font-bold" style={{ color: ri.grade.color }}>
                          {ri.grade.name}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-emerald-300">
                        모든 스탯 +{Math.round(ri.statMul * 100)}% · {ri.desc}
                      </div>
                    </button>
                    <button onClick={() => onSalvageRune(r.uid)}
                      className="shrink-0 rounded-lg bg-rose-500/15 px-2 py-2 text-[10px] font-bold text-rose-300 hover:bg-rose-500/30">
                      분해<br />💠{salvageStones(r)}
                    </button>
                  </div>
                )
              })}
            </div>
            <button onClick={() => setRunePick(false)}
              className="mt-3 w-full rounded-xl bg-white/10 py-2 text-[12px] font-bold text-white hover:bg-white/20">닫기</button>
          </div>
        </div>
      )}

      {enhancing && (
        <EnhancePanel item={inventory.find((i) => i.uid === enhancing.uid) || enhancing}
          gold={gold} gems={gems}
          onEnhance={onEnhance} onClose={() => setEnhancing(null)} />
      )}
    </div>
  )
}
