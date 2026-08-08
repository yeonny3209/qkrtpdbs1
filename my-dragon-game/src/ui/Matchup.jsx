/* ==================================================================
   상성 표시 조각들

   상성은 규칙이 아니라 "보이는 정보"여야 한다. 들어가기 전에 알 수
   없으면 진 뒤에 이유를 알게 되고, 그러면 편성을 고민할 기회 자체가
   전투 뒤로 밀린다. 그래서 스테이지 목록·전투 화면·도감이 전부 같은
   조각을 쓴다.
   ================================================================== */
import { ELEMENT_BY_ID } from '../game/elements.js'
import {
  WHEELS, AFF_REASON, AFF_STRONG, AFF_WEAK,
  matchup, teamMatchup, counters, counteredBy, recommendedAgainst,
} from '../game/affinity.js'

const TONE = {
  strong: { mark: '▲', color: '#fca5a5', bg: 'bg-rose-500/15', border: 'border-rose-400/40', label: '유리' },
  weak: { mark: '▼', color: '#93c5fd', bg: 'bg-sky-500/15', border: 'border-sky-400/40', label: '불리' },
  even: { mark: '', color: '#94a3b8', bg: 'bg-white/[.04]', border: 'border-white/10', label: '보통' },
}

/* 적 속성 줄 — 이 스테이지에서 무엇이 나오는가 */
export function EnemyElements({ elements = [] }) {
  const uniq = [...new Set(elements)]
  return (
    <span className="inline-flex items-center gap-0.5">
      {uniq.map((id) => (
        <span key={id} title={ELEMENT_BY_ID[id]?.name}>{ELEMENT_BY_ID[id]?.icon}</span>
      ))}
    </span>
  )
}

/* 내 편성이 저 적들에게 어떤가 — 한 덩이로 요약한다.
   숫자를 그대로 보여주면 읽지 않는다. 색과 한 단어로 끝낸다. */
export function TeamVerdict({ myElements = [], foeElements = [], compact }) {
  if (!myElements.length || !foeElements.length) return null
  const m = teamMatchup(myElements, foeElements)
  const tone = m.verdict === 'good' ? TONE.strong : m.verdict === 'bad' ? TONE.weak : TONE.even
  const text = m.verdict === 'good' ? '상성 유리' : m.verdict === 'bad' ? '상성 불리' : '상성 보통'
  /* 불리할 때만 무엇을 데려가면 되는지 알려준다. 유리한데도 훈수를
     두면 잔소리가 되고, 정작 필요할 때 눈에 안 들어온다. */
  const rec = m.verdict === 'bad' ? recommendedAgainst(foeElements) : []

  if (compact) {
    return (
      <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-black ${tone.bg} ${tone.border}`}
        style={{ color: tone.color }} title={`유리 ${m.adv} · 불리 ${m.dis}`}>
        {tone.mark}{text.replace('상성 ', '')}
      </span>
    )
  }
  return (
    <div className={`rounded-xl border px-3 py-2 ${tone.bg} ${tone.border}`}>
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-black" style={{ color: tone.color }}>{tone.mark} {text}</span>
        <span className="text-[10px] text-slate-400">유리한 짝 {m.adv} · 불리한 짝 {m.dis}</span>
      </div>
      {rec.length > 0 && (
        <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
          <span>추천</span>
          {rec.slice(0, 3).map((id) => (
            <span key={id} className="rounded-full bg-black/40 px-1.5 py-0.5 font-bold"
              style={{ color: ELEMENT_BY_ID[id]?.glow }}>
              {ELEMENT_BY_ID[id]?.icon} {ELEMENT_BY_ID[id]?.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* 전투 중 — 지금 행동하는 쪽이 이 유닛을 때리면 어떤가 */
export function MatchupTag({ fromElement, toElement }) {
  if (!fromElement || !toElement) return null
  const kind = matchup(fromElement, toElement)
  if (kind === 'even') return null
  const tone = TONE[kind]
  return (
    <span className="shrink-0 text-[9px] font-black" style={{ color: tone.color }}
      title={kind === 'strong' ? `${AFF_STRONG}배 — ${AFF_REASON[fromElement]}` : `${AFF_WEAK}배`}>
      {tone.mark}
    </span>
  )
}

/* ------------------------------------------------------------------
   상성표 — 고리 두 개를 그림 없이 화살표 줄로 보여준다

   격자표(8×8)로 그리면 64칸을 눈으로 훑어야 하는데, 실제 규칙은
   화살표 여덟 개뿐이다. 고리를 그대로 늘어놓는 편이 짧고 정확하다.
   ------------------------------------------------------------------ */
export function AffinityChart() {
  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-slate-400">
        공격하는 쪽이 유리하면 피해가 <b className="text-rose-300">{AFF_STRONG}배</b>,
        불리하면 <b className="text-sky-300">{AFF_WEAK}배</b>가 된다.
        고리는 두 개뿐이고 서로 엮이지 않는다 — 자연은 자연끼리, 신성은 신성끼리만 문다.
      </p>
      {WHEELS.map((w) => (
        <div key={w.id} className="rounded-2xl border border-white/10 bg-white/[.03] p-3">
          <div className="text-[11px] font-black tracking-widest text-slate-300">{w.name} 고리</div>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {[...w.ring, w.ring[0]].map((id, i) => {
              const el = ELEMENT_BY_ID[id]
              return (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-[11px] text-slate-600">→</span>}
                  <span className="rounded-lg px-1.5 py-0.5 text-[11px] font-bold"
                    style={{ background: `${el.deep}88`, color: el.glow }}>
                    {el.icon} {el.name}
                  </span>
                </span>
              )
            })}
          </div>
          <ul className="mt-2 space-y-0.5">
            {w.ring.map((id) => (
              <li key={id} className="text-[10px] text-slate-500">
                <span style={{ color: ELEMENT_BY_ID[id].glow }}>{ELEMENT_BY_ID[id].name}</span>
                {' — '}{AFF_REASON[id]}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/* 도감 카드 한 장에 붙는 줄 — 이 속성은 무엇을 찌르고 무엇에 찔리는가 */
export function ElementMatchupLine({ elementId }) {
  const strong = counters(elementId).map((id) => ELEMENT_BY_ID[id])
  const weak = counteredBy(elementId).map((id) => ELEMENT_BY_ID[id])
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
      <span className="text-rose-300">
        ▲ 강함 {strong.map((e) => `${e.icon}${e.name}`).join(' ')}
      </span>
      <span className="text-sky-300">
        ▼ 약함 {weak.map((e) => `${e.icon}${e.name}`).join(' ')}
      </span>
    </div>
  )
}
