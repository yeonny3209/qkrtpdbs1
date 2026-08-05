/* ==================================================================
   드래곤 마스터: 레전드 — 메인

   화면: 시작(스타터 선택) → 홈 → 캠페인 / 소환 / 드래곤
   ================================================================== */
import { useCallback, useMemo, useState } from 'react'
import GachaScreen from './ui/GachaScreen.jsx'
import CampaignScreen from './ui/CampaignScreen.jsx'
import RosterScreen, { TEAM_SIZE, STONES_PER_COPY } from './ui/RosterScreen.jsx'
import ShopScreen from './ui/ShopScreen.jsx'
import DungeonScreen from './ui/DungeonScreen.jsx'
import StoryDialogue from './ui/StoryDialogue.jsx'
import EndingScreen from './ui/EndingScreen.jsx'
import BattleScreen from './ui/BattleScreen.jsx'
import SummonCutscene from './three/SummonCutscene.jsx'
import DragonPreview from './ui/DragonPreview.jsx'
import { ELEMENTS, ELEMENT_BY_ID } from './game/elements.js'
import { DRAGONS, DRAGON_BY_ID, limitedLegends, gainExp, evoCost, evoGoldCost, MAX_EVOLUTION } from './game/dragons.js'
import { createGachaState, pullMany, bestOf, costOf } from './game/gacha.js'
import { CAMPAIGN, CHAPTER_BY_ID, TOTAL_STAGES } from './game/campaign.js'
import { buildEncounter, stageReward } from './game/encounter.js'
import {
  GEM_PACKAGES, SUBSCRIPTION, noSubscription, startSubscription,
  claimDaily, canClaimDaily, canBuySubscription, subActive, expMultiplier,
  PREMIUM_BY_ID, canBuyPremium, buyPremium, freshPremium,
} from './game/shop.js'
import {
  dungeonStage, freshEntries, entriesLeft,
  canEnter, spendEntry, addTickets,
} from './game/dungeon.js'
import { scriptFor, applyGain, freshFlags, FINAL_PROLOGUE, FINAL_STAGE_ID } from './game/story.js'

const LS = 'dragonmaster_save_v1'
const load = () => { try { return JSON.parse(localStorage.getItem(LS)) } catch { return null } }
const save = (v) => { try { localStorage.setItem(LS, JSON.stringify(v)) } catch { /* 무시 */ } }

const fresh = () => ({
  started: false,
  gems: 3000, gold: 5000,
  gacha: createGachaState(),
  dragons: {},          // id -> { count, level, exp, evo }
  team: [],
  cleared: {},
  seenBeats: {},
  difficulty: 'normal',
  sub: noSubscription(),      // 월정액 { startDay, claimedDays }
  stones: 0,                  // 진화석
  entries: freshEntries(),    // 던전 일일 입장
  premium: freshPremium(),    // 프리미엄 상점 일일 구매 기록
  flags: freshFlags(),        // 스토리 선택 누적
  ending: null,               // 확정된 엔딩 id
})

export default function App() {
  const [S, setS] = useState(() => ({ ...fresh(), ...(load() || {}) }))
  const [screen, setScreen] = useState('home')     // home | campaign | gacha | roster
  const [bannerId, setBannerId] = useState('limited')
  const [results, setResults] = useState(null)
  const [cutscene, setCutscene] = useState(null)
  const [battle, setBattle] = useState(null)       // { stage, allies, enemies, difficulty }
  const [beat, setBeat] = useState(null)           // { script, chapter, then }
  const [reward, setReward] = useState(null)
  const [purchase, setPurchase] = useState(null)   // 구매 완료 알림
  const [ending, setEnding] = useState(false)      // 엔딩 선택 화면

  const commit = useCallback((next) => { setS(next); save(next) }, [])
  /* 대화 중 선택처럼 최신 상태 위에 얹어야 할 때 쓴다 */
  const update = useCallback((fn) => setS((cur) => { const n = fn(cur); save(n); return n }), [])
  const featured = useMemo(
    () => (bannerId === 'limited' ? limitedLegends()[0] : DRAGON_BY_ID.slegend_0), [bannerId],
  )

  /* ---------- 드래곤 추가 ---------- */
  const addDragons = (dragons, list) => {
    const out = { ...dragons }
    list.forEach((d) => {
      const cur = out[d.id]
      out[d.id] = cur ? { ...cur, count: cur.count + 1 } : { count: 1, level: 1, exp: 0, evo: 0 }
    })
    return out
  }

  /* ---------- 스타터 ---------- */
  const chooseStarter = (elementId) => {
    /* 각 속성의 일반 등급 첫 드래곤을 준다 */
    const starter = DRAGONS.find((d) => d.element === elementId && d.rarity === 'common')
    const dragons = addDragons({}, [starter])
    commit({ ...S, started: true, dragons, team: [starter.id] })
  }

  /* ---------- 소환 ---------- */
  const onPull = useCallback((count) => {
    const cost = costOf(count)
    if (S.gems < cost) return
    const gacha = { ...S.gacha }
    const rolled = pullMany(gacha, bannerId, featured.id, count)
    commit({
      ...S, gems: S.gems - cost, gacha,
      dragons: addDragons(S.dragons, rolled.map((r) => r.dragon)),
    })
    setResults(rolled)
    setCutscene(bestOf(rolled))
  }, [S, bannerId, featured, commit])

  /* ---------- 편성 ---------- */
  const toggleTeam = (id) => {
    const has = S.team.includes(id)
    let team = has ? S.team.filter((x) => x !== id) : [...S.team, id]
    if (team.length > TEAM_SIZE) team = team.slice(team.length - TEAM_SIZE)
    commit({ ...S, team })
  }

  /* ---------- 진화 ---------- */
  const evolve = (id) => {
    const cur = S.dragons[id]
    if (!cur || cur.evo >= MAX_EVOLUTION) return
    const step = cur.evo + 1
    const need = evoCost(step)
    const goldNeed = evoGoldCost(step)
    const spare = cur.count - 1
    /* 분신을 먼저 쓰고, 모자란 만큼만 진화석으로 채운다 */
    const useCopies = Math.min(spare, need)
    const stoneNeed = (need - useCopies) * STONES_PER_COPY
    if (S.gold < goldNeed || (S.stones ?? 0) < stoneNeed) return
    commit({
      ...S,
      gold: S.gold - goldNeed,
      stones: (S.stones ?? 0) - stoneNeed,
      dragons: { ...S.dragons, [id]: { ...cur, count: cur.count - useCopies, evo: step } },
    })
  }

  /* ---------- 상점 ----------
     모의 결제다. 실제 결제는 서버에서 검증해야 하므로 여기서는 처리하지 않는다. */
  const buyPackage = (packageId) => {
    const pkg = GEM_PACKAGES.find((p) => p.id === packageId)
    if (!pkg) return
    commit({ ...S, gems: S.gems + pkg.gems })
    setPurchase({ gems: pkg.gems, title: `보석 ${pkg.gems}개` })
  }

  const buySubscription = () => {
    if (!canBuySubscription(S.sub)) return
    commit({ ...S, gems: S.gems + SUBSCRIPTION.initialGems, sub: startSubscription() })
    setPurchase({ gems: SUBSCRIPTION.initialGems, title: '월정액 시작', sub: true })
  }

  const claimSubDaily = () => {
    if (!canClaimDaily(S.sub)) return
    const { sub, gems } = claimDaily(S.sub)
    commit({ ...S, gems: S.gems + gems, sub })
    setPurchase({ gems, title: '오늘의 월정액 보석' })
  }

  const buyPremiumItem = (itemId) => {
    if (!canBuyPremium(S.premium, itemId, S.gems)) return
    const item = PREMIUM_BY_ID[itemId]
    const g = item.grant
    const next = {
      ...S,
      gems: S.gems - item.gems,
      premium: buyPremium(S.premium, itemId),
    }
    if (g.gold) next.gold = S.gold + g.gold
    if (g.stones) next.stones = (S.stones ?? 0) + g.stones
    if (g.dungeonTickets) next.entries = addTickets(S.entries, g.dungeonTickets)
    if (g.teamExp) {
      const dragons = { ...S.dragons }
      S.team.forEach((id) => {
        const cur = dragons[id]
        if (!cur) return
        const gained = gainExp(cur.level, cur.exp, g.teamExp)
        dragons[id] = { ...cur, level: gained.level, exp: gained.exp }
      })
      next.dragons = dragons
    }
    commit(next)
    setPurchase({ title: item.name, item })
  }

  /* ---------- 편성 → 전투 유닛 ---------- */
  const teamUnits = () => S.team.map((id) => ({
    dragon: DRAGON_BY_ID[id],
    level: S.dragons[id]?.level ?? 1,
    evo: S.dragons[id]?.evo ?? 0,
  })).filter((a) => a.dragon)

  /* ---------- 전투 시작 ---------- */
  const startStage = (stage) => {
    if (!S.team.length) { setScreen('roster'); return }
    const allies = teamUnits()
    const { enemies, difficulty } = buildEncounter(stage, S.difficulty, Date.now() >>> 0, allies.length)
    const go = () => setBattle({ stage, allies, enemies, difficulty })
    /* 스테이지에 대화가 붙어 있고 아직 안 봤다면 먼저 보여준다 */
    const script = scriptFor(stage.id)
    if (script && !S.seenBeats[stage.id]) {
      commit({ ...S, seenBeats: { ...S.seenBeats, [stage.id]: true } })
      setBeat({ script, chapter: CHAPTER_BY_ID[stage.chapter], then: go })
    } else go()
  }

  /* ---------- 던전 ---------- */
  const enterDungeon = (dungeonId, tierId) => {
    if (!S.team.length) { setScreen('roster'); return }
    if (!canEnter(S.entries, S.sub)) return
    const allies = teamUnits()
    const stage = dungeonStage(dungeonId, tierId)
    const { enemies, difficulty } = buildEncounter(stage, 'normal', Date.now() >>> 0, allies.length)
    /* 입장권은 들어가는 순간 소모된다. 결과를 보고 무를 수 있으면
       제한이 의미가 없어진다. */
    commit({ ...S, entries: spendEntry(S.entries) })
    setBattle({ stage, allies, enemies, difficulty, dungeon: { dungeonId, tierId } })
  }

  /* ---------- 전투 종료 ---------- */
  const finishBattle = (outcome) => {
    const { stage, dungeon } = battle
    setBattle(null)
    if (outcome !== 'win') return
    /* 던전은 난이도 배수를 타지 않는다 — 단계 자체가 난이도다 */
    const base = dungeon
      ? { exp: stage.exp, gold: stage.gold }
      : stageReward(stage, S.difficulty)
    /* 월정액 보유 시 경험치 +10% (기획서 7장) */
    const expMul = expMultiplier(S.sub)
    const rw = { ...base, exp: Math.round(base.exp * expMul), stones: stage.stones || 0 }
    /* 참전한 드래곤에게 경험치 분배 */
    const dragons = { ...S.dragons }
    let levelUps = 0
    S.team.forEach((id) => {
      const cur = dragons[id]
      if (!cur) return
      const g = gainExp(cur.level, cur.exp, Math.round(rw.exp / Math.max(1, S.team.length)))
      levelUps += g.gained
      dragons[id] = { ...cur, level: g.level, exp: g.exp }
    })
    const next = { ...S, gold: S.gold + rw.gold, dragons, stones: (S.stones ?? 0) + rw.stones }
    if (!dungeon) next.cleared = { ...S.cleared, [stage.id]: true }
    commit(next)
    /* 마지막 스테이지라면 보상창 대신 최종 대화 → 엔딩 선택으로 넘긴다 */
    if (!dungeon && stage.id === FINAL_STAGE_ID && !S.ending) {
      setBeat({ script: FINAL_PROLOGUE, chapter: CHAPTER_BY_ID[10], then: () => setEnding(true) })
    } else {
      setReward({ ...rw, levelUps, stage, expBonus: expMul > 1, dungeon: !!dungeon })
    }
  }

  /* ---------- 스타터 선택 화면 ---------- */
  if (!S.started) {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-[#07070e]">
        <div className="mx-auto max-w-3xl px-5 py-10 text-center">
          <div className="text-[11px] tracking-[0.5em] text-fuchsia-300/70">DRAGON MASTER</div>
          <h1 className="mt-3 text-4xl font-black text-white">드래곤 마스터: 레전드</h1>
          <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
            폭풍에 휩쓸려 도착한 이름 없는 섬.<br />함께할 첫 드래곤을 고르세요.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ELEMENTS.map((el) => (
              <button key={el.id} onClick={() => chooseStarter(el.id)}
                className="overflow-hidden rounded-2xl border border-white/10 p-3 transition hover:-translate-y-1"
                style={{ background: `linear-gradient(160deg, ${el.deep}, #0b0b14 75%)` }}>
                <DragonPreview elementId={el.id} rarity="common" className="h-24 w-full" />
                <div className="mt-1 text-[13px] font-black text-white">{el.icon} {el.name}</div>
                <div className="text-[10px]" style={{ color: el.glow }}>{el.role}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ---------- 전투 ---------- */
  if (battle) {
    return (
      <BattleScreen {...battle}
        onFinish={finishBattle}
        onQuit={() => setBattle(null)} />
    )
  }

  const clearedCount = Object.keys(S.cleared).length
  const teamDragons = S.team.map((id) => DRAGON_BY_ID[id]).filter(Boolean)
  const dungeonLeft = entriesLeft(S.entries, S.sub)
  /* 프리미엄 상점 해금 판정용 — 10스테이지를 다 깬 장의 수 */
  const clearedChapters = CAMPAIGN.filter((c) => c.stages.every((s) => S.cleared[s.id])).length

  return (
    <>
      {/* ---------- 홈 ---------- */}
      {screen === 'home' && (
        <div className="fixed inset-0 overflow-y-auto bg-[#07070e]">
          <div className="pointer-events-none fixed inset-0"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, #2a1f4a, transparent 60%)' }} />
          <div className="relative mx-auto max-w-2xl px-5 py-6">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-black text-white">🐉 드래곤 마스터</h1>
              <div className="flex gap-2 text-[12px] font-black">
                {subActive(S.sub) && (
                  <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2.5 py-1 text-amber-200">👑</span>
                )}
                <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-white">💎 {S.gems.toLocaleString()}</span>
                <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-amber-200">🪙 {S.gold.toLocaleString()}</span>
              </div>
            </div>

            {/* 편성된 드래곤 */}
            <div className="mt-4 rounded-3xl border border-white/10 bg-white/[.03] p-4">
              <div className="text-[11px] font-bold text-slate-400">현재 편성 ({teamDragons.length}/{TEAM_SIZE})</div>
              {teamDragons.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-slate-500">드래곤을 편성해주세요</div>
              ) : (
                <div className="mt-2 flex gap-2">
                  {teamDragons.map((d) => (
                    <div key={d.id} className="flex-1 overflow-hidden rounded-2xl"
                      style={{ background: `linear-gradient(160deg, ${ELEMENT_BY_ID[d.element].deep}, #0b0b14)` }}>
                      <DragonPreview elementId={d.element} rarity={d.rarity} className="h-24 w-full" />
                      <div className="truncate px-2 pb-2 text-center text-[10px] font-bold text-white">
                        {d.name} <span className="text-slate-400">Lv.{S.dragons[d.id]?.level ?? 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 진행도 */}
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3">
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-400">캠페인 진행</span>
                <span className="font-black text-white">{clearedCount} / {TOTAL_STAGES}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500"
                  style={{ width: `${(clearedCount / TOTAL_STAGES) * 100}%` }} />
              </div>
            </div>

            {/* 메뉴 */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { id: 'campaign', icon: '⚔', name: '캠페인', sub: '용의 섬 10장' },
                { id: 'gacha', icon: '🔮', name: '소환', sub: '드래곤 뽑기' },
                { id: 'dungeon', icon: '🏛', name: '던전', sub: `오늘 ${dungeonLeft}회 남음`, hot: dungeonLeft > 0 },
                { id: 'roster', icon: '🐲', name: '드래곤', sub: '편성 · 진화' },
                { id: 'shop', icon: '🛒', name: '상점', sub: '보석 · 프리미엄', hot: canClaimDaily(S.sub) },
              ].map((m) => (
                <button key={m.id} onClick={() => setScreen(m.id)}
                  className="relative rounded-2xl border border-white/10 bg-white/[.05] p-5 text-center transition hover:-translate-y-1 hover:bg-white/[.1]">
                  {/* 오늘 월정액 보석을 아직 안 받았으면 알림 점 */}
                  {m.hot && <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-rose-500" />}
                  <div className="text-3xl">{m.icon}</div>
                  <div className="mt-1 text-sm font-black text-white">{m.name}</div>
                  <div className="text-[11px] text-slate-400">{m.sub}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {screen === 'campaign' && (
        <CampaignScreen
          cleared={S.cleared}
          difficulty={S.difficulty}
          setDifficulty={(d) => commit({ ...S, difficulty: d })}
          onStart={startStage}
          onBack={() => setScreen('home')} />
      )}

      {screen === 'roster' && (
        <RosterScreen
          dragons={S.dragons} team={S.team} gold={S.gold} stones={S.stones ?? 0}
          onToggleTeam={toggleTeam} onEvolve={evolve}
          onBack={() => setScreen('home')} />
      )}

      {screen === 'dungeon' && (
        <DungeonScreen
          entries={S.entries} sub={S.sub} clearedCount={clearedCount}
          onEnter={enterDungeon}
          onBack={() => setScreen('home')} />
      )}

      {screen === 'shop' && (
        <ShopScreen
          gems={S.gems} stones={S.stones ?? 0} sub={S.sub}
          premium={S.premium} clearedChapters={clearedChapters}
          onBuyPackage={buyPackage}
          onBuySubscription={buySubscription}
          onClaimDaily={claimSubDaily}
          onBuyPremium={buyPremiumItem}
          onBack={() => setScreen('home')} />
      )}

      {screen === 'gacha' && (
        <>
          <GachaScreen
            gems={S.gems} bannerId={bannerId} setBannerId={setBannerId}
            featured={featured} gacha={S.gacha}
            results={cutscene ? null : results}
            ownedOf={(id) => S.dragons[id]?.count ?? 0}
            onPull={onPull}
            onClearResults={() => setResults(null)} />
          {!results && !cutscene && (
            <button onClick={() => setScreen('home')}
              className="fixed left-5 top-5 z-20 rounded-full border border-white/15 bg-black/60 px-4 py-1.5 text-[12px] font-bold text-white backdrop-blur-sm hover:bg-white/10">
              ← 홈
            </button>
          )}
        </>
      )}

      {cutscene && <SummonCutscene result={cutscene} onDone={() => setCutscene(null)} />}

      {beat && (
        <StoryDialogue
          script={beat.script} chapter={beat.chapter}
          onChoice={(gain) => update((cur) => ({ ...cur, flags: applyGain(cur.flags, gain) }))}
          onDone={() => { const f = beat.then; setBeat(null); f() }} />
      )}

      {ending && (
        <EndingScreen flags={S.flags}
          onConfirm={(id) => { commit({ ...S, ending: id }); setEnding(false); setScreen('home') }} />
      )}

      {/* 구매 완료 */}
      {purchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-5">
          <div className="w-full max-w-xs rounded-3xl border border-fuchsia-400/40 bg-slate-900 p-6 text-center">
            <div className="text-4xl">{purchase.item ? purchase.item.icon : purchase.sub ? '👑' : '💎'}</div>
            <div className="mt-2 text-lg font-black text-white">{purchase.title}</div>
            {purchase.item ? (
              <div className="mt-3 text-[14px] font-black text-fuchsia-300">{purchase.item.desc}</div>
            ) : (
              <div className="mt-3 text-2xl font-black text-fuchsia-300">💎 +{purchase.gems.toLocaleString()}</div>
            )}
            {purchase.sub && (
              <div className="mt-2 text-[11px] leading-relaxed text-slate-400">
                {SUBSCRIPTION.days}일 동안 매일 상점에서 💎 {SUBSCRIPTION.dailyGems}을 받으세요
              </div>
            )}
            <button onClick={() => setPurchase(null)}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-2.5 font-black text-white hover:brightness-110">
              확인
            </button>
          </div>
        </div>
      )}

      {/* 전투 보상 */}
      {reward && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-5">
          <div className="w-full max-w-xs rounded-3xl border border-amber-400/40 bg-slate-900 p-6 text-center">
            <div className="text-4xl">🎁</div>
            <div className="mt-2 text-lg font-black text-white">
              {reward.dungeon ? '던전 클리어' : '스테이지 클리어'}
            </div>
            <div className="mt-3 space-y-1 text-[13px]">
              <div className="flex justify-between">
                <span className="text-slate-400">경험치{reward.expBonus && <span className="ml-1 text-[10px] text-amber-300">월정액 +10%</span>}</span>
                <span className="font-black text-sky-300">+{reward.exp}</span>
              </div>
              <div className="flex justify-between"><span className="text-slate-400">골드</span><span className="font-black text-amber-300">+{reward.gold}</span></div>
              {reward.stones > 0 && (
                <div className="flex justify-between"><span className="text-slate-400">진화석</span><span className="font-black text-violet-300">+{reward.stones}</span></div>
              )}
              {reward.levelUps > 0 && (
                <div className="flex justify-between"><span className="text-slate-400">레벨업</span><span className="font-black text-emerald-300">{reward.levelUps}회</span></div>
              )}
            </div>
            <button onClick={() => setReward(null)}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-2.5 font-black text-white hover:brightness-110">
              확인
            </button>
          </div>
        </div>
      )}
    </>
  )
}
