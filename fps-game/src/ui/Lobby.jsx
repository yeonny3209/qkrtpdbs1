/* ==================================================================
   로비 — 들어가기 전에 정하는 것

   난이도 하나와 무기 셋을 고른다. 고르는 화면이 따로 있는 이유는
   선택을 무겁게 만들기 위해서다. 웨이브 도중에 총이 굴러다니면
   "무엇을 들 것인가"가 그때그때 주운 것으로 정해지지만, 들어가기
   전에 정하면 그 판 전체가 그 선택 위에서 굴러간다.

   그래서 고르는 데 필요한 정보를 여기서 다 보여 준다 — 발사 방식,
   초당 피해, 탄창, 사거리. 숫자를 읽지 않아도 되게 한 줄 설명을
   같이 두고, 숫자를 읽고 싶은 사람에겐 막대로 비교를 보여 준다.
   ================================================================== */
import { useMemo } from 'react'
import {
  WEAPONS, WEAPONS_BY_SLOT, SLOTS, SLOT_LABEL, FIRE_MODE_LABEL, fireMode,
} from '../game/weapons.js'
import { DIFFICULTIES } from '../game/difficulty.js'
import { MAPS } from '../game/maps.js'

/* 비교용 초당 피해. 예열·차지·점사는 "최대로 굴렸을 때"로 잰다 —
   무기를 고르는 순간 알고 싶은 것은 잘 썼을 때의 값이다. */
function dpsOf(w) {
  if (w.melee) return (w.damage * w.rpm) / 60
  if (w.charge) return (w.damage * w.chargeMax * w.rpm) / 60
  return (w.damage * w.pellets * w.rpm) / 60
}

function Bar({ value, max, color }) {
  const pct = Math.max(3, Math.min(100, (value / max) * 100))
  return (
    <span className="inline-block h-1 w-full overflow-hidden rounded-full bg-white/12 align-middle">
      <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </span>
  )
}

function WeaponCard({ w, picked, onPick, maxDps, maxRange }) {
  const mode = fireMode(w)
  return (
    <button
      onClick={() => onPick(w.id)}
      className={`w-full rounded-lg p-2.5 text-left transition ring-1 ${
        picked
          ? 'bg-white/95 text-black ring-white'
          : 'bg-white/5 text-white ring-white/12 hover:bg-white/10 hover:ring-white/30'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-base">{w.icon}</span>
        <span className="flex-1 font-bold">{w.name}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] tracking-widest ${
            picked ? 'bg-black/15' : 'bg-white/12 text-white/75'
          }`}
        >
          {FIRE_MODE_LABEL[mode]}
        </span>
      </div>
      <p className={`mt-1 text-xs ${picked ? 'text-black/65' : 'text-white/55'}`}>{w.blurb}</p>

      <dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 text-[10px]">
        <dt className={picked ? 'text-black/50' : 'text-white/45'}>화력</dt>
        <dd><Bar value={dpsOf(w)} max={maxDps} color={picked ? '#c2452f' : '#ff8a6b'} /></dd>
        <dt className={picked ? 'text-black/50' : 'text-white/45'}>사거리</dt>
        <dd><Bar value={w.range} max={maxRange} color={picked ? '#2f6f8f' : '#7fd4ff'} /></dd>
      </dl>

      <div className={`mt-1.5 text-[10px] tabular-nums ${picked ? 'text-black/55' : 'text-white/45'}`}>
        {w.noAmmo
          ? `부채꼴 ${w.arc}° · 사거리 ${w.range}`
          : `탄창 ${w.mag} · 초당 ${(w.rpm / 60).toFixed(1)}발${w.pierce ? ` · 관통 ${w.pierce >= 99 ? '∞' : w.pierce}` : ''}`}
      </div>
    </button>
  )
}

export default function Lobby({ loadout, difficulty, onPick, onDifficulty, onStart, onBack, best }) {
  /* 막대 길이를 맞추려면 전체에서 가장 큰 값이 필요하다 */
  const { maxDps, maxRange } = useMemo(() => {
    const all = Object.values(WEAPONS)
    return {
      maxDps: Math.max(...all.map(dpsOf)),
      maxRange: Math.max(...all.filter((w) => !w.melee).map((w) => w.range)),
    }
  }, [])

  const diff = DIFFICULTIES.find((d) => d.id === difficulty) || DIFFICULTIES[1]

  return (
    <div className="absolute inset-0 overflow-y-auto bg-black/85 backdrop-blur-sm">
      <div className="mx-auto min-h-full w-full max-w-5xl px-6 py-8 text-white">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="text-xs tracking-[0.5em] text-rose-400">LOADOUT</div>
            <h1 className="mt-1 text-3xl font-bold">무엇을 들고 들어갈까</h1>
          </div>
          <button
            onClick={onBack}
            className="rounded px-3 py-1.5 text-xs tracking-widest text-white/50 ring-1 ring-white/15 transition hover:text-white hover:ring-white/40"
          >
            ← 처음 화면
          </button>
        </div>

        {/* ── 난이도 ─────────────────────────────────────────────── */}
        <h2 className="mt-7 text-xs tracking-[0.3em] text-white/45">상대 실력</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-5">
          {DIFFICULTIES.map((d) => {
            const on = d.id === difficulty
            return (
              <button
                key={d.id}
                onClick={() => onDifficulty(d.id)}
                className={`rounded-lg p-2.5 text-left transition ring-1 ${
                  on ? 'ring-2' : 'bg-white/5 ring-white/12 hover:bg-white/10'
                }`}
                style={on ? { background: `${d.color}22`, borderColor: d.color, boxShadow: `inset 0 0 0 2px ${d.color}` } : undefined}
              >
                <div className="font-bold" style={{ color: d.color }}>{d.name}</div>
                <div className="text-[10px] tracking-wider text-white/45">{d.tag}</div>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-white/50">{diff.desc}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] tabular-nums text-white/40">
          <span>적 체력 ×{diff.hp}</span>
          <span>피해 ×{diff.damage}</span>
          <span>수 ×{diff.count}</span>
          <span>명중률 ×{diff.accuracy}</span>
          <span>{diff.regen > 0 ? `회복 ×${diff.regen}` : '회복 없음'}</span>
        </div>

        {/* ── 맵 ─────────────────────────────────────────────────
            고를 수는 없지만 무엇이 나올 수 있는지는 알려 준다.
            들어가서야 처음 보는 것보다, 열 장 중 하나라는 걸 알고
            들어가는 편이 낫다. */}
        <h2 className="mt-7 text-xs tracking-[0.3em] text-white/45">
          맵 — {MAPS.length}장 중 무작위
        </h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MAPS.map((m) => (
            <span
              key={m.id}
              title={m.blurb}
              className="rounded bg-white/5 px-2 py-1 text-xs text-white/55 ring-1 ring-white/10"
            >
              {m.name}
            </span>
          ))}
        </div>

        {/* ── 무기 셋 ────────────────────────────────────────────── */}
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {SLOTS.map((slot, i) => (
            <section key={slot}>
              <h2 className="mb-2 flex items-center gap-2 text-xs tracking-[0.3em] text-white/45">
                <span className="rounded bg-white/12 px-1.5 py-0.5 font-mono text-[10px] text-white/70">
                  {i + 1}
                </span>
                {SLOT_LABEL[slot]}
              </h2>
              <div className="space-y-2">
                {WEAPONS_BY_SLOT[slot].map((id) => (
                  <WeaponCard
                    key={id}
                    w={WEAPONS[id]}
                    picked={loadout[slot] === id}
                    onPick={(wid) => onPick(slot, wid)}
                    maxDps={maxDps}
                    maxRange={maxRange}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* ── 시작 ───────────────────────────────────────────────── */}
        <div className="sticky bottom-0 mt-8 -mx-6 bg-gradient-to-t from-black via-black/95 to-transparent px-6 pb-6 pt-5">
          <div className="mb-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-white/70">
            {SLOTS.map((slot) => (
              <span key={slot}>
                {WEAPONS[loadout[slot]].icon}{' '}
                <b className="text-white">{WEAPONS[loadout[slot]].name}</b>
              </span>
            ))}
            <span style={{ color: diff.color }}>· {diff.name}</span>
          </div>
          <button
            onClick={onStart}
            className="w-full rounded-lg bg-rose-500 py-4 text-lg font-bold tracking-widest transition hover:bg-rose-400 active:scale-[0.99]"
          >
            들어가기
          </button>
          <p className="mt-2 text-center text-xs text-white/35">
  맵은 들어가 봐야 압니다 · 마우스가 화면에 잠깁니다 (Esc 로 해제)
            {best.wave > 0 && ` · 최고 ${best.wave}웨이브 (${best.points.toLocaleString()}점)`}
          </p>
        </div>
      </div>
    </div>
  )
}
