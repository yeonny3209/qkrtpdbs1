/* ==================================================================
   HUD

   3D 안에 글자를 넣지 않고 DOM 으로 얹는다. 캔버스 안 텍스트는
   화면 해상도와 무관하게 흐려지고, 폰트를 따로 실어야 한다. 화면
   앞에 붙는 정보는 화면의 언어(HTML)로 쓰는 게 맞다.

   숫자는 초당 열네 번만 갱신된다(session 쪽 HUD_INTERVAL). 사람
   눈에는 실시간이고 React 는 훨씬 덜 일한다.
   ================================================================== */

const fmt = (n) => (n === Infinity ? '∞' : String(n))

/* 체력에 따라 색이 바뀐다. 숫자를 읽기 전에 색으로 먼저 안다. */
function hpColor(pct) {
  if (pct > 0.6) return '#4ade80'
  if (pct > 0.3) return '#fbbf24'
  return '#f87171'
}

export default function Hud({ hud, banner, hitmarker, hurtKey, floaters }) {
  if (!hud) return null
  const pct = hud.hp / hud.maxHp
  const low = pct <= 0.3

  return (
    <div className="pointer-events-none absolute inset-0 select-none font-mono text-white">
      {/* 피격 시 붉은 섬광 */}
      {hurtKey > 0 && (
        <div key={hurtKey} className="absolute inset-0 bg-red-600/35 animate-[hurt_360ms_ease-out_forwards]" />
      )}

      {/* 체력이 낮을 때 가장자리가 붉게 맥동한다 */}
      {low && hud.hp > 0 && (
        <div
          className="absolute inset-0 animate-[pulse-vignette_1.1s_ease-in-out_infinite]"
          style={{ boxShadow: 'inset 0 0 22vmin 6vmin rgba(220,38,38,0.55)' }}
        />
      )}

      {/* ── 조준선 ─────────────────────────────────────────────── */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative h-10 w-10">
          <span className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90" />
          {[
            'left-1/2 top-0 h-[7px] w-[2px] -translate-x-1/2',
            'left-1/2 bottom-0 h-[7px] w-[2px] -translate-x-1/2',
            'top-1/2 left-0 w-[7px] h-[2px] -translate-y-1/2',
            'top-1/2 right-0 w-[7px] h-[2px] -translate-y-1/2',
          ].map((c) => (
            <span key={c} className={`absolute bg-white/75 ${c}`} />
          ))}
          {/* 명중 표시 — 맞았는지 화면 한가운데서 바로 알려준다 */}
          {hitmarker && (
            <div key={hitmarker.key} className="absolute inset-0 animate-[hitmark_240ms_ease-out_forwards]">
              {['rotate-45', '-rotate-45'].map((r, i) => (
                <span
                  key={i}
                  className={`absolute left-1/2 top-1/2 h-[2px] w-6 -translate-x-1/2 -translate-y-1/2 ${r}`}
                  style={{
                    background: hitmarker.lethal ? '#f87171'
                      : hitmarker.headshot ? '#fbbf24' : '#ffffff',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 웨이브 배너 ─────────────────────────────────────────── */}
      {banner && (
        <div
          key={banner.key}
          className="absolute left-1/2 top-[18%] -translate-x-1/2 text-center animate-[banner_2400ms_ease-out_forwards]"
        >
          <div className="text-4xl font-bold tracking-[0.25em] drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
            {banner.text}
          </div>
          {banner.sub && (
            <div className="mt-1 text-sm tracking-widest text-white/70">{banner.sub}</div>
          )}
        </div>
      )}

      {/* ── 왼쪽 위: 점수 ───────────────────────────────────────── */}
      <div className="absolute left-5 top-4">
        <div className="text-2xl font-bold tabular-nums drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
          {hud.points.toLocaleString()}
        </div>
        <div className="text-xs tracking-widest text-white/60">
          처치 {hud.kills} · 최고 {hud.best.points.toLocaleString()}
        </div>
        {hud.combo >= 2 && (
          <div className="mt-1 text-sm font-bold text-amber-300">
            {hud.combo} 연속
            <span className="ml-2 inline-block h-1 w-14 overflow-hidden rounded-full bg-white/20 align-middle">
              <span
                className="block h-full bg-amber-400 transition-[width] duration-100"
                style={{ width: `${(hud.comboT / 3) * 100}%` }}
              />
            </span>
          </div>
        )}
      </div>

      {/* ── 오른쪽 위: 웨이브 ───────────────────────────────────── */}
      <div className="absolute right-5 top-4 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-widest"
            style={{ background: `${hud.difficulty.color}28`, color: hud.difficulty.color }}
          >
            {hud.difficulty.name}
          </span>
          <span className="text-xs tracking-[0.3em] text-white/60">웨이브</span>
        </div>
        <div className="text-3xl font-bold tabular-nums drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
          {hud.wave || '—'}
        </div>
        {hud.phase === 'wave' ? (
          <div className="text-xs tracking-widest text-white/70">남은 적 {hud.remaining}</div>
        ) : (
          <div className="text-xs tracking-widest text-emerald-300">
            다음까지 {hud.timer.toFixed(1)}초
          </div>
        )}
      </div>

      {/* ── 왼쪽 아래: 체력 ─────────────────────────────────────── */}
      <div className="absolute bottom-6 left-6">
        <div className="mb-1 flex items-baseline gap-2">
          <span className="text-xs tracking-[0.3em] text-white/60">체력</span>
          <span
            className="text-3xl font-bold tabular-nums"
            style={{ color: hpColor(pct) }}
          >
            {hud.hp}
          </span>
        </div>
        <div className="h-2 w-56 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/15">
          <div
            className="h-full transition-[width] duration-150"
            style={{ width: `${pct * 100}%`, background: hpColor(pct) }}
          />
        </div>
      </div>

      {/* ── 오른쪽 아래: 탄약 ───────────────────────────────────── */}
      <div className="absolute bottom-6 right-6 text-right">
        <div className="mb-1 flex items-center justify-end gap-2">
          <span className="text-lg">{hud.weaponIcon}</span>
          <span className="text-xs tracking-[0.25em] text-white/60">{hud.weaponName}</span>
          <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] tracking-widest text-white/70">
            {hud.slots.find((s) => s.slot === hud.slot)?.label}
          </span>
        </div>
        {/* 근접무기는 탄약 자리가 필요 없다. 0/0 이나 ∞ 를 띄우면
            없는 자원을 관리해야 하는 것처럼 읽힌다. */}
        {hud.noAmmo ? (
          <div className="text-2xl font-bold tracking-widest text-white/70">탄약 불필요</div>
        ) : (
          <div className="flex items-baseline justify-end gap-2 tabular-nums">
            <span className={`text-4xl font-bold ${hud.inMag === 0 ? 'text-red-400' : ''}`}>
              {hud.inMag}
            </span>
            <span className="text-lg text-white/50">/ {fmt(hud.reserve)}</span>
          </div>
        )}
        {/* 재장전 · 예열 · 차지는 같은 자리를 나눠 쓴다. 셋 다
            "지금 기다리는 중"이라는 같은 뜻이라, 눈이 한 곳만 보면 된다. */}
        {hud.reloading ? (
          <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/15">
            <div className="h-full bg-sky-400" style={{ width: `${hud.reloadPct * 100}%` }} />
          </div>
        ) : hud.charge > 0 ? (
          <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/15">
            <div
              className="h-full transition-[width] duration-75"
              style={{
                width: `${hud.charge * 100}%`,
                background: hud.charge >= 1 ? '#ffd166' : '#7fd4ff',
              }}
            />
          </div>
        ) : hud.spin > 0 ? (
          <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/15">
            <div className="h-full bg-amber-400" style={{ width: `${hud.spin * 100}%` }} />
          </div>
        ) : (
          <div className="mt-1 h-1.5 w-32" />
        )}

        {/* 슬롯 셋 — 1 주무기 · 2 보조 · 3 근접.
            자리는 항상 셋 다 보인다. 아직 못 주운 주무기 자리가
            비어 있는 것 자체가 "저걸 찾아야 한다"는 안내가 된다. */}
        <div className="mt-2 flex justify-end gap-1.5">
          {hud.slots.map((s, i) => (
            <span
              key={s.slot}
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] tracking-widest ring-1 ${
                s.active
                  ? 'bg-white/90 text-black ring-white'
                  : s.owned
                    ? 'text-white/70 ring-white/25'
                    : 'text-white/20 ring-white/10'
              }`}
            >
              <span>{i + 1}</span>
              <span className="text-[11px]">{s.owned ? s.icon : '—'}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── 떠오르는 점수 ──────────────────────────────────────── */}
      <div className="absolute left-1/2 top-[56%] -translate-x-1/2">
        {floaters.map((f) => (
          <div
            key={f.id}
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-lg font-bold text-amber-300 animate-[floatup_900ms_ease-out_forwards]"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}
          >
            +{f.gained}
          </div>
        ))}
      </div>
    </div>
  )
}
