/* ==================================================================
   상점 — 보석 구매 · 월정액 (기획서 6장 · 7장)

   결제 버튼은 모의 결제다. 실제 카드 결제를 붙이려면 결제대행사(PG)와
   서버 검증이 필요하다 (shop.js 상단 주석 참고).
   ================================================================== */
import { useState } from 'react'
import {
  GEM_PACKAGES, packagePrice, gemsPerPiece,
  SUBSCRIPTION, subscriptionPrice, subscriptionTotalGems,
  subActive, subDaysLeft, canClaimDaily, canBuySubscription, subGemsReceived,
  PREMIUM_ITEMS, PREMIUM_UNLOCK_CHAPTER, premiumUnlocked, remainingToday, canBuyPremium,
  won,
} from '../game/shop.js'

/* 모의 결제 확인창 */
function PayModal({ item, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-5">
      <div className="w-full max-w-xs rounded-3xl border border-white/12 bg-slate-900 p-6">
        <div className="text-center text-4xl">{item.icon}</div>
        <div className="mt-2 text-center text-lg font-black text-white">{item.name}</div>
        <div className="mt-4 space-y-1.5 rounded-2xl bg-black/40 px-4 py-3 text-[13px]">
          <div className="flex justify-between">
            <span className="text-slate-400">받는 보석</span>
            <span className="font-black text-fuchsia-300">💎 {item.gems.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">결제 금액</span>
            <span className="font-black text-white">{won(item.price)}</span>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
          ⚠ 모의 결제입니다. 실제로 돈이 빠져나가지 않습니다.
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onCancel}
            className="flex-1 rounded-xl border border-white/12 py-2.5 text-[13px] font-bold text-slate-300 hover:bg-white/5">
            취소
          </button>
          <button onClick={onConfirm}
            className="flex-[1.4] rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-2.5 text-[13px] font-black text-white hover:brightness-110">
            구매하기
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ShopScreen({
  gems, stones, sub, premium, clearedChapters,
  onBuyPackage, onBuySubscription, onClaimDaily, onBuyPremium, onBack,
}) {
  const [pay, setPay] = useState(null)      // 확인 대기 중인 상품
  const [tab, setTab] = useState('gem')     // gem | premium

  const prem = premiumUnlocked(sub, clearedChapters)
  const active = subActive(sub)
  const daysLeft = subDaysLeft(sub)
  const claimable = canClaimDaily(sub)
  const buyable = canBuySubscription(sub)

  const confirm = () => {
    const it = pay
    setPay(null)
    if (it.kind === 'sub') onBuySubscription()
    else onBuyPackage(it.id)
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#07070e]">
      <div className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #3a1f4a, transparent 60%)' }} />

      <div className="relative mx-auto max-w-2xl px-5 py-6">
        <div className="flex items-center justify-between">
          <button onClick={onBack}
            className="rounded-full border border-white/15 px-4 py-1.5 text-[12px] font-bold text-slate-200 hover:bg-white/10">
            ← 홈
          </button>
          <div className="flex gap-2 text-[12px] font-black">
            <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-white">
              💎 {gems.toLocaleString()}
            </span>
            <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-violet-200">
              💠 {(stones ?? 0).toLocaleString()}
            </span>
          </div>
        </div>

        <h1 className="mt-5 text-2xl font-black text-white">상점</h1>

        {/* 탭 */}
        <div className="mt-3 flex gap-1.5">
          {[
            { id: 'gem', name: '보석 · 월정액' },
            { id: 'premium', name: '프리미엄', locked: !prem.open },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-1.5 text-[12px] font-black transition ${
                tab === t.id ? 'bg-white text-slate-900' : 'border border-white/12 text-slate-300 hover:bg-white/10'
              }`}>
              {t.locked && '🔒 '}{t.name}
            </button>
          ))}
        </div>

        {tab === 'premium' ? (
          /* ---------- 프리미엄 상점 ---------- */
          !prem.open ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-6 text-center">
              <div className="text-4xl">🔒</div>
              <div className="mt-2 text-sm font-black text-white">아직 열리지 않았습니다</div>
              <p className="mt-2 text-[12px] leading-relaxed text-slate-400">
                캠페인 {PREMIUM_UNLOCK_CHAPTER}장을 클리어하면 열립니다.<br />
                <span className="text-amber-300">월정액을 구매하면 지금 바로 이용할 수 있습니다.</span>
              </p>
            </div>
          ) : (
            <>
              {prem.early && (
                <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-[11px] font-bold text-amber-200">
                  👑 월정액 조기 접근으로 이용 중입니다
                </div>
              )}
              <p className="mt-4 text-[12px] text-slate-400">구매 한도는 매일 자정에 초기화됩니다.</p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {PREMIUM_ITEMS.map((item) => {
                  const rest = remainingToday(premium, item.id)
                  const ok = canBuyPremium(premium, item.id, gems)
                  return (
                    <button key={item.id} disabled={!ok}
                      onClick={() => onBuyPremium(item.id)}
                      className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                        ok
                          ? 'border-white/12 bg-white/[.05] hover:-translate-y-0.5 hover:border-fuchsia-400/50 hover:bg-fuchsia-500/10'
                          : 'cursor-not-allowed border-white/8 bg-white/[.02] opacity-45'
                      }`}>
                      <span className="text-2xl">{item.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-black text-white">{item.name}</span>
                        <span className="block truncate text-[11px] text-slate-400">{item.desc}</span>
                        <span className="mt-0.5 block text-[10px] text-slate-500">
                          오늘 {rest} / {item.daily} 남음
                        </span>
                      </span>
                      <span className="shrink-0 rounded-lg bg-black/40 px-2.5 py-1.5 text-[12px] font-black text-fuchsia-300 tabular-nums">
                        💎{item.gems.toLocaleString()}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )
        ) : (
        <>
        <p className="mt-4 text-[12px] text-slate-400">1 피스 = {won(1000)}</p>

        {/* ---------- 월정액 ---------- */}
        <div className="mt-5 overflow-hidden rounded-3xl border border-amber-400/35"
          style={{ background: 'linear-gradient(150deg, #3b2a10, #140f1e 70%)' }}>
          <div className="flex items-start justify-between px-5 pt-5">
            <div>
              <div className="text-[10px] tracking-[0.3em] text-amber-300/80">MONTHLY PASS</div>
              <div className="mt-1 text-xl font-black text-white">월정액</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-amber-200">{won(subscriptionPrice())}</div>
              <div className="text-[10px] text-slate-400">{SUBSCRIPTION.pieces} 피스 / {SUBSCRIPTION.days}일</div>
            </div>
          </div>

          <div className="mx-5 mt-4 rounded-2xl bg-black/40 px-4 py-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate-300">구매 즉시</span>
              <span className="font-black text-fuchsia-300">💎 {SUBSCRIPTION.initialGems}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[13px]">
              <span className="text-slate-300">매일 수령 × {SUBSCRIPTION.days}일</span>
              <span className="font-black text-fuchsia-300">💎 {SUBSCRIPTION.dailyGems}</span>
            </div>
            <div className="mt-2 border-t border-white/10 pt-2 flex items-center justify-between text-[13px]">
              <span className="font-bold text-white">총 획득</span>
              <span className="font-black text-amber-300">💎 {subscriptionTotalGems().toLocaleString()}</span>
            </div>
          </div>

          <div className="mx-5 mt-3 flex flex-wrap gap-1.5">
            {[`경험치 +${Math.round(SUBSCRIPTION.expBonus * 100)}%`,
              `일일 던전 +${SUBSCRIPTION.dungeonBonus}회`,
              '프리미엄 상점 조기 접근'].map((p) => (
              <span key={p} className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[11px] font-bold text-amber-100">
                {p}
              </span>
            ))}
          </div>

          {/* 상태에 따라 버튼이 바뀐다 */}
          <div className="p-5 pt-4">
            {active ? (
              <>
                <div className="mb-2 flex items-center justify-between text-[12px]">
                  <span className="text-emerald-300">✓ 이용 중 · {daysLeft}일 남음</span>
                  <span className="text-slate-400">누적 💎 {subGemsReceived(sub).toLocaleString()}</span>
                </div>
                <button onClick={onClaimDaily} disabled={!claimable}
                  className={`w-full rounded-xl py-3 text-[14px] font-black transition ${
                    claimable
                      ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-black hover:brightness-110'
                      : 'cursor-not-allowed border border-white/10 bg-white/5 text-slate-500'
                  }`}>
                  {claimable ? `오늘의 보석 받기 💎 ${SUBSCRIPTION.dailyGems}` : '오늘은 이미 받았습니다'}
                </button>
              </>
            ) : (
              <>
                {!buyable && <div className="mb-2 text-[12px] text-slate-400">이미 이용 중입니다</div>}
                <button
                  onClick={() => setPay({
                    kind: 'sub', id: 'monthly', icon: '👑', name: '월정액',
                    gems: SUBSCRIPTION.initialGems, price: subscriptionPrice(),
                  })}
                  disabled={!buyable}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 py-3 text-[14px] font-black text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
                  월정액 구매
                </button>
                <p className="mt-2 text-center text-[10px] leading-relaxed text-slate-500">
                  {SUBSCRIPTION.days}일 후 갱신 · 갱신 전 언제든 취소 가능 · 중복 구매 불가
                </p>
              </>
            )}
          </div>
        </div>

        {/* ---------- 보석 패키지 ---------- */}
        <h2 className="mt-7 text-sm font-black text-white">보석</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {GEM_PACKAGES.map((pkg) => (
            <button key={pkg.id}
              onClick={() => setPay({
                kind: 'pack', id: pkg.id, icon: '💎',
                name: `보석 ${pkg.gems}개`, gems: pkg.gems, price: packagePrice(pkg),
              })}
              className={`relative overflow-hidden rounded-2xl border p-5 text-center transition hover:-translate-y-1 ${
                pkg.tag ? 'border-fuchsia-400/50 bg-fuchsia-500/10' : 'border-white/10 bg-white/[.05]'
              }`}>
              {pkg.tag && (
                <div className="absolute right-0 top-0 rounded-bl-xl bg-fuchsia-500 px-2 py-0.5 text-[9px] font-black text-white">
                  {pkg.tag}
                </div>
              )}
              <div className="text-3xl">💎</div>
              <div className="mt-1 text-lg font-black text-white">{pkg.gems.toLocaleString()}</div>
              <div className="text-[10px] text-slate-400">{pkg.pieces} 피스</div>
              <div className="mt-2 rounded-lg bg-black/40 py-1.5 text-[12px] font-black text-amber-200">
                {won(packagePrice(pkg))}
              </div>
              <div className="mt-1 text-[10px] text-slate-500 tabular-nums">
                1,000원당 💎{gemsPerPiece(pkg).toLocaleString()}
              </div>
            </button>
          ))}
        </div>
        </>
        )}

        <p className="mt-5 rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3 text-[11px] leading-relaxed text-slate-500">
          이 상점의 결제는 전부 모의 처리입니다. 실제 결제를 받으려면 결제대행사(PG) 연동과
          서버 검증이 필요하며, 금액과 지급을 조작할 수 없도록 반드시 서버에서 확인해야 합니다.
        </p>
      </div>

      {pay && <PayModal item={pay} onConfirm={confirm} onCancel={() => setPay(null)} />}
    </div>
  )
}
