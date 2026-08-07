/* ==================================================================
   일일 출석

   28칸을 달력처럼 늘어놓고, 오늘 열린 칸만 누를 수 있게 한다.
   칸은 "받은 횟수"로 나아가므로 하루 빼먹어도 밀리지 않는다 —
   그 사실을 화면에도 적어 둔다. 안 그러면 하루 거른 사람이
   "보상을 놓쳤다"고 오해한다.
   ================================================================== */
import { CYCLE, calendar, canClaim, todayReward, scaledReward, daysToBig } from '../game/attendance.js'
import { ORB_BY_ID } from '../game/orbs.js'
import { subActive } from '../game/shop.js'

/* 보상 한 칸을 아이콘 목록으로 */
function itemsOf(r) {
  const out = [{ icon: '💎', n: r.gems }]
  if (r.gold) out.push({ icon: '🪙', n: r.gold })
  if (r.stones) out.push({ icon: '💠', n: r.stones })
  if (r.drinks) out.push({ icon: '🧪', n: r.drinks })
  if (r.orbs) {
    for (const [id, n] of Object.entries(r.orbs)) out.push({ icon: ORB_BY_ID[id]?.icon ?? '🔹', n })
  }
  return out
}

const short = (n) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n.toLocaleString())

export default function AttendanceScreen({ attendance, sub, onClaim, onBack }) {
  const days = calendar(attendance)
  const open = canClaim(attendance)
  const today = scaledReward(todayReward(attendance), sub)
  const toBig = daysToBig(attendance)
  const boosted = subActive(sub)

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#07070e]">
      <div className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #3a2a1a, transparent 60%)' }} />

      <div className="relative mx-auto max-w-2xl px-5 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-black text-white">📅 일일 출석</h1>
          <button onClick={onBack}
            className="rounded-full border border-white/15 px-3 py-1.5 text-[12px] font-bold text-slate-300 hover:bg-white/10">
            ← 홈
          </button>
        </div>

        <p className="mt-1 text-[12px] text-slate-400">
          하루에 한 번 받습니다. 하루 걸러도 칸은 밀리지 않아요.
        </p>

        {/* 오늘 받을 것 */}
        <div className="mt-4 rounded-2xl border p-4"
          style={{
            borderColor: open ? 'rgba(251,191,36,.45)' : 'rgba(255,255,255,.1)',
            background: open ? 'rgba(251,191,36,.08)' : 'rgba(255,255,255,.03)',
          }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12px] text-slate-400">
                {open ? '오늘의 보상' : '오늘은 받았어요'}
                {boosted && <span className="ml-2 rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] font-black text-amber-200">월정액 +50%</span>}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {itemsOf(today).map((it, i) => (
                  <span key={i} className="rounded-lg border border-white/12 bg-black/30 px-2.5 py-1 text-[13px] font-black text-white">
                    {it.icon} {it.n.toLocaleString()}
                  </span>
                ))}
              </div>
            </div>
            <button disabled={!open} onClick={onClaim}
              className="shrink-0 rounded-xl px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed"
              style={open
                ? { background: '#fbbf24', color: '#0f172a' }
                : { background: 'rgba(255,255,255,.08)', color: '#64748b' }}>
              {open ? '받기' : '완료'}
            </button>
          </div>
          {toBig !== null && toBig > 0 && (
            <div className="mt-3 text-[11px] text-amber-200/80">
              큰 보상까지 {toBig}일 남았어요
            </div>
          )}
        </div>

        {/* 28칸 */}
        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {days.map((d) => (
            <div key={d.day}
              className="relative rounded-xl border p-1.5 text-center transition"
              style={{
                borderColor: d.open ? '#fbbf24' : d.reward.big ? 'rgba(251,191,36,.28)' : 'rgba(255,255,255,.08)',
                background: d.done ? 'rgba(255,255,255,.02)'
                  : d.open ? 'rgba(251,191,36,.14)'
                    : d.reward.big ? 'rgba(251,191,36,.05)' : 'rgba(255,255,255,.04)',
                opacity: d.done ? 0.42 : 1,
              }}>
              <div className="text-[9px] font-black"
                style={{ color: d.reward.big ? '#fbbf24' : '#64748b' }}>
                {d.day}일
              </div>
              <div className="mt-0.5 text-[15px] leading-none">
                {d.reward.drinks ? '🧪' : d.reward.orbs ? Object.keys(d.reward.orbs).map((k) => ORB_BY_ID[k]?.icon).join('') : d.reward.stones ? '💠' : d.reward.gold ? '🪙' : '💎'}
              </div>
              <div className="mt-0.5 text-[9px] font-bold text-slate-300">
                💎{short(d.reward.gems)}
              </div>
              {d.done && (
                <div className="absolute inset-0 flex items-center justify-center text-[16px] text-emerald-400/80">✓</div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-[12px]">
          <span className="text-slate-400">누적 출석</span>
          <span className="font-black text-white">{attendance?.totalDays ?? 0}일</span>
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-600">
          {CYCLE}일을 채우면 1일차부터 다시 시작합니다.
        </p>
      </div>
    </div>
  )
}
