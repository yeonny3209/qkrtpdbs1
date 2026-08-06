/* ==================================================================
   도감 — 100마리 전부와 각자의 스킬셋

   보유하지 않은 드래곤도 목록에는 있지만 이름과 스킬은 가려둔다.
   "뭘 더 모아야 하는가"는 보이되 전부 미리 보여주지는 않는다.
   ================================================================== */
import { useMemo, useState } from 'react'
import DragonPreview from './DragonPreview.jsx'
import { ELEMENTS, ELEMENT_BY_ID } from '../game/elements.js'
import { DRAGONS, RARITY_BY_ID, RARITIES, statsOf, STAT_KEYS, STAT_LABEL } from '../game/dragons.js'
import { skillsetOf, passiveDesc } from '../game/skills.js'

const KINDS = [
  { id: 'all', name: '전체' },
  { id: 'standard', name: '상시' },
  { id: 'standardLegend', name: '상시 레전드' },
  { id: 'limitedLegend', name: '한정 레전드' },
]

/* 스킬 한 칸 */
function SkillRow({ skill, slot }) {
  const label = slot === 's1' ? '1스킬 · 홀수 턴'
    : slot === 's2' ? '2스킬 · 짝수 턴'
      : '궁극기 · 5턴 쿨'
  const color = slot === 'ult' ? '#fbbf24' : slot === 's1' ? '#38bdf8' : '#e879f9'
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{skill.icon}</span>
        <span className="text-[13px] font-black text-white">{skill.name}</span>
        <span className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold"
          style={{ background: color + '22', color }}>
          {label}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{skill.desc}</p>
      <div className="mt-1.5 flex flex-wrap gap-1 text-[10px] tabular-nums">
        {skill.power > 0 && (
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-rose-300">
            위력 {Math.round(skill.power * 100)}% · {skill.stat === 'matk' ? '마공' : '공격'}
          </span>
        )}
        {skill.heal > 0 && <span className="rounded bg-white/10 px-1.5 py-0.5 text-emerald-300">회복 {Math.round(skill.heal * 100)}%</span>}
        {skill.hits > 1 && <span className="rounded bg-white/10 px-1.5 py-0.5 text-amber-300">{skill.hits}연타</span>}
        {skill.drain > 0 && <span className="rounded bg-white/10 px-1.5 py-0.5 text-fuchsia-300">흡혈 {Math.round(skill.drain * 100)}%</span>}
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-slate-300">
          {skill.target === 'enemyAll' ? '적 전체' : skill.target === 'selfAll' ? '아군 전체'
            : skill.target === 'self' ? '자신' : '적 하나'}
        </span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-slate-400">명중 {skill.acc}%</span>
      </div>
    </div>
  )
}

function Detail({ dragon, owned, onClose }) {
  const el = ELEMENT_BY_ID[dragon.element]
  const rar = RARITY_BY_ID[dragon.rarity]
  const set = useMemo(() => skillsetOf(dragon), [dragon])
  const lv1 = statsOf(dragon, 1, 0)
  const lv100 = statsOf(dragon, 100, 6)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl border shadow-2xl"
        style={{ borderColor: rar.color + '55', background: `linear-gradient(170deg, ${el.deep}, #0a0a12 60%)` }}>
        <DragonPreview elementId={dragon.element} rarity={dragon.rarity} dragonId={dragon.id} className="h-52 w-full" />
        <div className="p-5 pt-0">
          <div className="text-[10px] font-black tracking-[0.3em]" style={{ color: rar.color }}>
            {'★'.repeat(rar.star)} {rar.name}
          </div>
          <h3 className="mt-1 text-xl font-black text-white">{owned ? dragon.name : '???'}</h3>
          <div className="text-[12px] font-bold" style={{ color: el.glow }}>
            {el.icon} {el.name} · {el.role}
            {owned && <span className="ml-2 text-slate-500">「{dragon.epithet}」</span>}
          </div>

          {/* 능력치 범위 */}
          <div className="mt-3 rounded-2xl bg-black/40 p-3">
            <div className="mb-1.5 flex justify-between text-[10px] text-slate-500">
              <span>Lv.1 · 0진화</span><span>Lv.100 · 6진화</span>
            </div>
            {STAT_KEYS.map((k) => (
              <div key={k} className="flex items-center gap-2 text-[11px]">
                <span className="w-8 shrink-0 text-slate-400">{STAT_LABEL[k]}</span>
                <span className="w-12 shrink-0 text-right tabular-nums text-slate-300">{lv1[k]}</span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: '100%', background: el.glow, opacity: 0.5 }} />
                </div>
                <span className="w-12 shrink-0 text-right font-bold tabular-nums text-white">{lv100[k]}</span>
              </div>
            ))}
          </div>

          {/* 스킬셋 */}
          <div className="mt-4 text-[12px] font-black text-white">스킬셋</div>
          {owned ? (
            <div className="mt-2 space-y-2">
              <SkillRow skill={set.s1} slot="s1" />
              <SkillRow skill={set.s2} slot="s2" />
              <SkillRow skill={set.ult} slot="ult" />
              {/* 패시브 */}
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/[.07] p-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{set.passive.icon}</span>
                  <span className="text-[13px] font-black text-white">{set.passive.name}</span>
                  <span className="ml-auto rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                    패시브 · 항상
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-emerald-200/80">{passiveDesc(set.passive)}</p>
              </div>
            </div>
          ) : (
            <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-6 text-center text-[12px] text-slate-500">
              🔒 아직 만나지 못한 드래곤입니다.<br />
              획득하면 스킬셋이 열립니다.
            </div>
          )}

          <button onClick={onClose} className="mt-4 w-full rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white hover:bg-white/20">
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DexScreen({ dragons = {}, onBack }) {
  const [kind, setKind] = useState('all')
  const [element, setElement] = useState('all')
  const [rarity, setRarity] = useState('all')
  const [onlyOwned, setOnlyOwned] = useState(false)
  const [detail, setDetail] = useState(null)

  const ownedCount = Object.keys(dragons).length
  const list = useMemo(() => DRAGONS.filter((d) => {
    if (kind !== 'all' && d.kind !== kind) return false
    if (element !== 'all' && d.element !== element) return false
    if (rarity !== 'all' && d.rarity !== rarity) return false
    if (onlyOwned && !dragons[d.id]) return false
    return true
  }), [kind, element, rarity, onlyOwned, dragons])

  const chip = (on) => `rounded-full px-3 py-1 text-[11px] font-bold transition ${
    on ? 'bg-white text-slate-900' : 'border border-white/12 text-slate-300 hover:bg-white/10'}`

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#07070e]">
      <div className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #1f2a4a, transparent 60%)' }} />

      <div className="relative mx-auto max-w-3xl px-5 py-6">
        <div className="flex items-center justify-between">
          <button onClick={onBack}
            className="rounded-full border border-white/15 px-4 py-1.5 text-[12px] font-bold text-slate-200 hover:bg-white/10">
            ← 홈
          </button>
          <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[12px] font-black text-white tabular-nums">
            {ownedCount} / {DRAGONS.length}
          </span>
        </div>

        <h1 className="mt-5 text-2xl font-black text-white">📖 드래곤 도감</h1>
        <p className="mt-1 text-[12px] text-slate-400">
          드래곤마다 1스킬 · 2스킬 · 궁극기 · 패시브를 하나씩 가집니다.
        </p>

        {/* 필터 */}
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button key={k.id} onClick={() => setKind(k.id)} className={chip(kind === k.id)}>{k.name}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setElement('all')} className={chip(element === 'all')}>속성 전체</button>
            {ELEMENTS.map((e) => (
              <button key={e.id} onClick={() => setElement(e.id)} className={chip(element === e.id)}>
                {e.icon} {e.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setRarity('all')} className={chip(rarity === 'all')}>등급 전체</button>
            {RARITIES.map((r) => (
              <button key={r.id} onClick={() => setRarity(r.id)} className={chip(rarity === r.id)}>
                <span style={{ color: rarity === r.id ? undefined : r.color }}>{r.name}</span>
              </button>
            ))}
            <button onClick={() => setOnlyOwned(!onlyOwned)} className={chip(onlyOwned)}>보유만</button>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-slate-500">{list.length}마리</div>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {list.map((d) => {
            const owned = !!dragons[d.id]
            const el = ELEMENT_BY_ID[d.element]
            const rar = RARITY_BY_ID[d.rarity]
            const set = skillsetOf(d)
            return (
              <button key={d.id} onClick={() => setDetail(d)}
                className={`overflow-hidden rounded-2xl border p-2.5 text-left transition hover:-translate-y-0.5 ${
                  owned ? '' : 'opacity-45'
                }`}
                style={{
                  borderColor: rar.color + (owned ? '55' : '22'),
                  background: owned ? `linear-gradient(155deg, ${el.deep}aa, #0b0b14 74%)` : '#0d0d16',
                }}>
                <div className="flex items-start justify-between">
                  <span className="text-[9px] font-black" style={{ color: rar.color }}>{'★'.repeat(rar.star)}</span>
                  <span className="text-base">{el.icon}</span>
                </div>
                <div className="mt-0.5 truncate text-[11px] font-black text-white">
                  {owned ? d.name : '???'}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[10px]">
                  {owned ? (
                    <>
                      <span title={set.s1.name}>{set.s1.icon}</span>
                      <span title={set.s2.name}>{set.s2.icon}</span>
                      <span title={set.ult.name}>{set.ult.icon}</span>
                      <span className="ml-auto" title={set.passive.name}>{set.passive.icon}</span>
                    </>
                  ) : (
                    <span className="text-slate-600">🔒 미보유</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {detail && <Detail dragon={detail} owned={!!dragons[detail.id]} onClose={() => setDetail(null)} />}
    </div>
  )
}
