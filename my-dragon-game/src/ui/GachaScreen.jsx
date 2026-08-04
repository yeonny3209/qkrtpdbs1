/* ==================================================================
   소환 화면 — 배너 선택 · 확률 안내 · 1회/10연차 · 결과 목록
   ================================================================== */
import { useMemo, useState } from 'react'
import DragonPreview from './DragonPreview.jsx'
import { ELEMENT_BY_ID } from '../game/elements.js'
import { RARITY_BY_ID, statsOf, STAT_KEYS, STAT_LABEL } from '../game/dragons.js'
import { BANNERS, PULL_COST, TEN_PULL_COST, TEN_PULL_SIZE, PITY, LIMITED_WIN_RATE } from '../game/gacha.js'

/* 만분율 → 화면용 퍼센트. 0.25% 같은 값이 반올림돼 사라지지 않도록
   소수점 두 자리까지 살리고, 불필요한 0은 지운다 (80 → "80%", 25 → "0.25%") */
const pct = (v) => `${Number((v / 100).toFixed(2))}%`

/* ---------------- 결과 카드 ---------------- */
export function DragonCard({ result, owned, onClick }) {
  const d = result.dragon
  const el = ELEMENT_BY_ID[d.element]
  const rar = RARITY_BY_ID[d.rarity]
  const isNew = owned === 1
  return (
    <button onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border p-3 text-left transition hover:-translate-y-1"
      style={{
        borderColor: rar.color + '66',
        background: `linear-gradient(160deg, ${el.deep}cc, #0b0b14 70%)`,
        boxShadow: d.rarity === 'legend' ? `0 0 26px ${rar.glow}` : 'none',
      }}>
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-black tracking-widest" style={{ color: rar.color }}>
          {'★'.repeat(rar.star)}
        </span>
        {isNew && <span className="rounded-full bg-emerald-500/25 px-2 py-0.5 text-[9px] font-black text-emerald-300">NEW</span>}
      </div>
      <div className="mt-1 text-2xl">{el.icon}</div>
      <div className="mt-1 truncate text-[13px] font-black text-white">{d.name}</div>
      <div className="text-[10px]" style={{ color: el.glow }}>{el.name} · {d.epithet}</div>
      {result.isLimited && (
        <div className="mt-1.5 inline-block rounded-full bg-amber-400/20 px-2 py-0.5 text-[9px] font-black text-amber-300">
          한정 픽업
        </div>
      )}
      {owned > 1 && (
        <div className="mt-1.5 text-[10px] text-slate-400">보유 {owned} · 진화 재료</div>
      )}
    </button>
  )
}

/* ---------------- 상세 ---------------- */
function DetailModal({ dragon, owned, onClose }) {
  const el = ELEMENT_BY_ID[dragon.element]
  const rar = RARITY_BY_ID[dragon.rarity]
  const lv1 = statsOf(dragon, 1, 0)
  const lv100 = statsOf(dragon, 100, 6)
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-3xl border shadow-2xl"
        style={{ borderColor: rar.color + '55', background: `linear-gradient(170deg, ${el.deep}, #0a0a12 65%)` }}>
        <DragonPreview elementId={dragon.element} rarity={dragon.rarity} className="h-56 w-full" />
        <div className="p-5 pt-0">
          <div className="text-[10px] font-black tracking-[0.3em]" style={{ color: rar.color }}>
            {'★'.repeat(rar.star)} {rar.name}
          </div>
          <h2 className="mt-1 text-2xl font-black text-white">{dragon.name}</h2>
          <div className="text-sm font-bold" style={{ color: el.glow }}>
            {el.icon} {el.name} · {el.role} · {dragon.epithet}
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-400">{el.desc}</p>

          <div className="mt-4 space-y-1.5">
            {STAT_KEYS.map((k) => (
              <div key={k} className="flex items-center gap-2 text-[12px]">
                <span className="w-10 text-slate-400">{STAT_LABEL[k]}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full"
                    style={{ width: `${(lv1[k] / lv100[k]) * 100}%`, background: rar.color }} />
                </div>
                <span className="w-24 text-right font-mono font-bold text-white">
                  {lv1[k]} <span className="text-slate-500">→ {lv100[k]}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-slate-500">
            Lv.1 · 0진화 → Lv.100 · 6진화 기준 · 보유 {owned}마리
          </div>
          <button onClick={onClose}
            className="mt-4 w-full rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white transition hover:bg-white/20">
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

/* ==================================================================
   메인 화면
   ================================================================== */
export default function GachaScreen({
  gems, bannerId, setBannerId, featured, gacha, results, ownedOf, onPull, onClearResults,
}) {
  const [detail, setDetail] = useState(null)
  const [ratesOpen, setRatesOpen] = useState(false)
  const banner = BANNERS[bannerId]
  const el = ELEMENT_BY_ID[featured.element]
  const limited = bannerId === 'limited'

  const canOne = gems >= PULL_COST
  const canTen = gems >= TEN_PULL_COST
  const toPity = Math.max(0, PITY - gacha.pity)

  const sorted = useMemo(() => {
    if (!results) return null
    const order = { legend: 0, epic: 1, rare: 2, common: 3 }
    return [...results].sort((a, b) => order[a.rarity] - order[b.rarity])
  }, [results])

  /* ---------- 결과 목록 ---------- */
  if (sorted) {
    return (
      <div className="fixed inset-0 z-30 overflow-y-auto bg-[#07070e]">
        <div className="mx-auto max-w-3xl px-5 py-10">
          <h2 className="text-center text-2xl font-black text-white">소환 결과</h2>
          <p className="mt-1 text-center text-[12px] text-slate-500">카드를 누르면 상세 정보를 볼 수 있습니다</p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {sorted.map((r, i) => (
              <DragonCard key={i} result={r} owned={ownedOf(r.dragon.id)} onClick={() => setDetail(r.dragon)} />
            ))}
          </div>
          <button onClick={onClearResults}
            className="mx-auto mt-8 block rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-10 py-3 font-black text-white transition hover:brightness-110">
            확인
          </button>
        </div>
        {detail && <DetailModal dragon={detail} owned={ownedOf(detail.id)} onClose={() => setDetail(null)} />}
      </div>
    )
  }

  /* ---------- 소환진 ---------- */
  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#07070e]">
      {/* 배경 광채 */}
      <div className="pointer-events-none fixed inset-0"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${el.deep}, transparent 60%)` }} />

      <div className="relative mx-auto max-w-4xl px-5 py-6">
        {/* 상단 — 보석 */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-black text-white">🐉 드래곤 소환</h1>
          <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-1.5">
            <span className="text-lg">💎</span>
            <span className="font-mono text-base font-black text-white">{gems.toLocaleString()}</span>
          </div>
        </div>

        {/* 배너 탭 */}
        <div className="mt-4 flex gap-2">
          {Object.values(BANNERS).map((b) => (
            <button key={b.id} onClick={() => setBannerId(b.id)}
              className={`flex-1 rounded-2xl border px-4 py-3 text-left transition ${bannerId === b.id
                ? 'border-fuchsia-400/60 bg-fuchsia-500/10' : 'border-white/10 bg-white/[.03] hover:bg-white/[.06]'}`}>
              <div className="text-sm font-black text-white">{b.name}</div>
              <div className="text-[11px] text-slate-400">{b.sub}</div>
            </button>
          ))}
        </div>

        {/* 픽업 드래곤 */}
        <div className="mt-4 overflow-hidden rounded-3xl border"
          style={{ borderColor: el.color + '44', background: `linear-gradient(160deg, ${el.deep}aa, #0a0a12 70%)` }}>
          <div className="relative">
            <DragonPreview elementId={featured.element} rarity={featured.rarity} className="h-64 w-full sm:h-72" />
            <div className="pointer-events-none absolute left-5 top-4">
              <div className="text-[10px] font-black tracking-[0.4em] text-amber-300">
                {limited ? '★ 한정 픽업 ★' : '상시 소환'}
              </div>
              <div className="mt-1 text-2xl font-black text-white drop-shadow-lg sm:text-3xl">
                {limited ? featured.name : '모든 상시 드래곤'}
              </div>
              <div className="text-sm font-bold" style={{ color: el.glow }}>
                {el.icon} {el.name} · {el.role}
              </div>
            </div>
          </div>

          {/* 천장 게이지 (한정만) */}
          {limited && (
            <div className="px-5 pb-4">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">천장까지</span>
                <span className="font-mono font-black text-amber-300">{toPity}회</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
                  style={{ width: `${(gacha.pity / PITY) * 100}%` }} />
              </div>
              {gacha.lastLegendStandard && (
                <div className="mt-2 rounded-lg bg-amber-400/12 px-3 py-1.5 text-[11px] font-bold text-amber-300">
                  ⚡ 다음 레전드는 <b>한정 확정</b>입니다 (상시 연속 등장 없음)
                </div>
              )}
            </div>
          )}
        </div>

        {/* 소환 버튼 */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button onClick={() => onPull(1)} disabled={!canOne}
            className={`rounded-2xl border py-4 font-black transition ${canOne
              ? 'border-white/15 bg-white/[.06] text-white hover:bg-white/[.12]'
              : 'cursor-not-allowed border-white/5 bg-white/[.02] text-slate-600'}`}>
            <div className="text-base">1회 소환</div>
            <div className="mt-0.5 text-[12px] text-slate-400">💎 {PULL_COST.toLocaleString()}</div>
          </button>
          <button onClick={() => onPull(TEN_PULL_SIZE)} disabled={!canTen}
            className={`rounded-2xl py-4 font-black transition ${canTen
              ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:brightness-110'
              : 'cursor-not-allowed bg-slate-800 text-slate-600'}`}>
            <div className="text-base">10연차 소환</div>
            <div className="mt-0.5 text-[12px] opacity-80">💎 {TEN_PULL_COST.toLocaleString()}</div>
          </button>
        </div>

        {/* 확률 */}
        <button onClick={() => setRatesOpen((v) => !v)}
          className="mt-3 w-full rounded-xl border border-white/10 bg-white/[.03] py-2 text-[12px] font-bold text-slate-400 transition hover:bg-white/[.06]">
          확률 보기 {ratesOpen ? '▲' : '▼'}
        </button>
        {ratesOpen && (
          <div className="mt-2 rounded-2xl border border-white/10 bg-white/[.03] p-4 text-[12px]">
            <div className="space-y-1.5">
              {[['common', '일반'], ['rare', '레어'], ['epic', '에픽']].map(([k, label]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-400">{label}</span>
                  <span className="font-mono text-white">{pct(banner.rates[k])}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-amber-300">레전드</span>
                <span className="font-mono text-amber-300">{pct(banner.rates.legend)}</span>
              </div>
              {/* 레전드 안쪽 내역 — 한정/상시가 각각 몇 %인지 */}
              {limited && (
                <div className="ml-3 space-y-1 border-l border-white/10 pl-3 pt-0.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">└ 한정 레전드 (픽업)</span>
                    <span className="font-mono text-white">{pct(banner.rates.legend * LIMITED_WIN_RATE)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">└ 상시 레전드</span>
                    <span className="font-mono text-white">{pct(banner.rates.legend * (1 - LIMITED_WIN_RATE))}</span>
                  </div>
                </div>
              )}
            </div>
            {limited && (
              <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-slate-400">
                <div>· 레전드가 나오면 <b className="text-white">{Math.round(LIMITED_WIN_RATE * 100)}%</b> 확률로 한정 픽업</div>
                <div>· 상시 레전드가 나오면 <b className="text-white">다음 레전드는 한정 확정</b></div>
                <div>· <b className="text-white">{PITY}회</b>까지 레전드가 없으면 한정 확정</div>
                <div>· 레전드를 얻으면 천장 스택은 초기화됩니다</div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 text-center text-[11px] text-slate-600">
          누적 소환 {gacha.totalPulls.toLocaleString()}회
        </div>
      </div>
    </div>
  )
}
