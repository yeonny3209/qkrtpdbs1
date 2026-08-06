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
import TowerScreen from './ui/TowerScreen.jsx'
import DexScreen from './ui/DexScreen.jsx'
import StoryDialogue from './ui/StoryDialogue.jsx'
import EndingScreen from './ui/EndingScreen.jsx'
import BattleScreen from './ui/BattleScreen.jsx'
import SummonCutscene from './three/SummonCutscene.jsx'
import DragonPreview from './ui/DragonPreview.jsx'
import { ELEMENTS, ELEMENT_BY_ID } from './game/elements.js'
import { DRAGONS, DRAGON_BY_ID, limitedLegends, gainExp, evoCost, evoGoldCost, MAX_EVOLUTION, MAX_LEVEL } from './game/dragons.js'
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
import {
  MAX_PLUS, failChance, enhanceGold, PROTECT_GEM_COST, salvageGold,
  INVENTORY_MAX, SLOT_IDS, gearInfo,
} from './game/equipment.js'
import { salvageStones, runeInfo } from './game/runes.js'
import { freshOrbs, expToOrbs, addOrbs, orbCount, EXP_ORBS, ORB_BY_ID, spendOrbs } from './game/orbs.js'
import {
  freshTower, towerStage, towerEnemies, climbRewards, hatchEgg,
  TOWER_MAX_ROUNDS, MAX_FLOOR,
} from './game/tower.js'

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
  inventory: [],              // 장비 가방 [{ uid, slot, grade, seed, plus, equippedBy }]
  runeBag: [],                // 룬 가방 [{ uid, grade, ability, equippedBy }]
  gear: {},                   // 드래곤별 장착 — id -> { loadout: {slot:uid}, rune: uid }
  tower: freshTower(),        // 무한의 탑 { best }
  orbs: freshOrbs(),          // 경험 구슬 — 레벨업은 이걸 먹여서 한다
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
  const [enhanceResult, setEnhanceResult] = useState(null)

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

  /* ---------- 경험 구슬로 레벨업 ----------
     전투는 구슬만 떨구고, 어느 드래곤을 키울지는 플레이어가 정한다. */
  const feedOrb = (dragonId, orbId, count = 1) => update((cur) => {
    const d = cur.dragons[dragonId]
    const orb = ORB_BY_ID[orbId]
    if (!d || !orb || d.level >= MAX_LEVEL) return cur
    const n = Math.min(count, cur.orbs?.[orbId] || 0)
    if (n <= 0) return cur
    const g = gainExp(d.level, d.exp, orb.exp * n)
    let orbs = cur.orbs
    for (let i = 0; i < n; i++) orbs = spendOrbs(orbs, orbId, 1)
    return {
      ...cur,
      orbs,
      dragons: { ...cur.dragons, [dragonId]: { ...d, level: g.level, exp: g.exp } },
    }
  })

  /* ---------- 장비 · 룬 ---------- */
  const wornOf = useCallback((st, id) => {
    const g = st.gear?.[id]?.loadout || {}
    return Object.fromEntries(
      SLOT_IDS.map((s) => [s, (st.inventory || []).find((i) => i.uid === g[s]) || null]),
    )
  }, [])

  /* 한 장비는 한 드래곤만 낄 수 있다. 다른 드래곤이 끼고 있으면 거기서 뺀다. */
  const equipGear = (dragonId, slot, uid) => update((cur) => {
    const gear = { ...cur.gear }
    const inventory = cur.inventory.map((i) => (i.uid === uid ? { ...i, equippedBy: dragonId } : i))
    /* 그 자리에 있던 장비는 가방으로 돌아간다 */
    const prev = gear[dragonId]?.loadout?.[slot]
    const inv2 = inventory.map((i) => (i.uid === prev ? { ...i, equippedBy: null } : i))
    gear[dragonId] = {
      ...gear[dragonId],
      loadout: { ...(gear[dragonId]?.loadout || {}), [slot]: uid },
    }
    return { ...cur, gear, inventory: inv2 }
  })

  const unequipGear = (dragonId, slot) => update((cur) => {
    const gear = { ...cur.gear }
    const uid = gear[dragonId]?.loadout?.[slot]
    if (!uid) return cur
    const loadout = { ...gear[dragonId].loadout }
    delete loadout[slot]
    gear[dragonId] = { ...gear[dragonId], loadout }
    return {
      ...cur, gear,
      inventory: cur.inventory.map((i) => (i.uid === uid ? { ...i, equippedBy: null } : i)),
    }
  })

  const equipRune = (dragonId, uid) => update((cur) => {
    const gear = { ...cur.gear }
    const prev = gear[dragonId]?.rune
    gear[dragonId] = { ...gear[dragonId], rune: uid }
    return {
      ...cur, gear,
      runeBag: cur.runeBag.map((r) =>
        r.uid === uid ? { ...r, equippedBy: dragonId }
          : r.uid === prev ? { ...r, equippedBy: null } : r),
    }
  })

  const unequipRune = (dragonId) => update((cur) => {
    const gear = { ...cur.gear }
    const uid = gear[dragonId]?.rune
    if (!uid) return cur
    gear[dragonId] = { ...gear[dragonId], rune: null }
    return {
      ...cur, gear,
      runeBag: cur.runeBag.map((r) => (r.uid === uid ? { ...r, equippedBy: null } : r)),
    }
  })

  const enhanceGear = (uid, protect) => update((cur) => {
    const item = cur.inventory.find((i) => i.uid === uid)
    if (!item || item.plus >= MAX_PLUS) return cur
    const cost = enhanceGold(item.plus)
    const gemCost = protect ? PROTECT_GEM_COST : 0
    if (cur.gold < cost || cur.gems < gemCost) return cur
    const failed = Math.random() < failChance(item.plus)
    /* 성공하면 +1. 실패하면 -1 — 단, 보호권을 썼으면 그대로 둔다. */
    const plus = failed ? (protect ? item.plus : Math.max(0, item.plus - 1)) : item.plus + 1
    setEnhanceResult({ ok: !failed, protect, plus, from: item.plus })
    return {
      ...cur,
      gold: cur.gold - cost,
      gems: cur.gems - gemCost,
      inventory: cur.inventory.map((i) => (i.uid === uid ? { ...i, plus } : i)),
    }
  })

  const salvageGear = (uid) => update((cur) => {
    const item = cur.inventory.find((i) => i.uid === uid)
    if (!item || item.equippedBy) return cur
    return {
      ...cur,
      gold: cur.gold + salvageGold(item),
      inventory: cur.inventory.filter((i) => i.uid !== uid),
    }
  })

  const salvageRune = (uid) => update((cur) => {
    const r = cur.runeBag.find((x) => x.uid === uid)
    if (!r || r.equippedBy) return cur
    return {
      ...cur,
      stones: (cur.stones ?? 0) + salvageStones(r),
      runeBag: cur.runeBag.filter((x) => x.uid !== uid),
    }
  })

  /* ---------- 편성 → 전투 유닛 ---------- */
  const teamUnits = () => S.team.map((id) => ({
    dragon: DRAGON_BY_ID[id],
    level: S.dragons[id]?.level ?? 1,
    evo: S.dragons[id]?.evo ?? 0,
    items: wornOf(S, id),
    rune: (S.runeBag || []).find((r) => r.uid === S.gear?.[id]?.rune) || null,
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

  /* ---------- 무한의 탑 ---------- */
  const climbTower = (floor) => {
    if (!S.team.length) { setScreen('roster'); return }
    const allies = teamUnits()
    const stage = towerStage(floor)
    setBattle({
      stage, allies,
      enemies: towerEnemies(floor, allies.length, (Date.now() ^ floor) >>> 0),
      difficulty: { name: `${floor}층` },
      tower: floor,
      /* 고층은 적 체력이 커서 캠페인 기준 라운드 제한에 먼저 걸린다 */
      maxRounds: TOWER_MAX_ROUNDS,
    })
  }

  /* ---------- 전투 종료 ---------- */
  const finishBattle = (outcome) => {
    const { stage, dungeon, tower } = battle
    setBattle(null)
    if (outcome !== 'win') return

    /* ----- 무한의 탑 ----- */
    if (tower) {
      const rw = climbRewards(tower, Date.now() >>> 0)
      const expMulT = expMultiplier(S.sub)
      /* 경험치는 드래곤에게 바로 들어가지 않고 구슬로 떨어진다 */
      const gainedExp = Math.round(rw.exp * expMulT)
      const gotOrbs = expToOrbs(gainedExp)
      /* 가방이 꽉 차면 새 장비는 들어오지 않는다 */
      const room = Math.max(0, INVENTORY_MAX - S.inventory.length)
      const newGear = rw.gear.slice(0, room)
      const eggDragon = rw.dragonEgg ? hatchEgg(Date.now() >>> 0) : null
      commit({
        ...S,
        gold: S.gold + rw.gold,
        gems: S.gems + rw.gems,
        stones: (S.stones ?? 0) + rw.stones,
        orbs: addOrbs(S.orbs, gotOrbs),
        dragons: eggDragon ? addDragons(S.dragons, [eggDragon]) : S.dragons,
        inventory: [...S.inventory, ...newGear],
        runeBag: [...S.runeBag, ...rw.runes],
        tower: { ...S.tower, best: Math.max(S.tower?.best ?? 0, tower) },
      })
      setReward({
        ...rw, exp: gainedExp, orbs: gotOrbs, stage, tower,
        expBonus: expMulT > 1,
        gear: newGear, bagFull: rw.gear.length > newGear.length,
        eggDragon,
      })
      return
    }
    /* 던전은 난이도 배수를 타지 않는다 — 단계 자체가 난이도다 */
    const base = dungeon
      ? { exp: stage.exp, gold: stage.gold }
      : stageReward(stage, S.difficulty)
    /* 월정액 보유 시 경험치 +10% (기획서 7장) */
    const expMul = expMultiplier(S.sub)
    const rw = { ...base, exp: Math.round(base.exp * expMul), stones: stage.stones || 0 }
    /* 경험치는 구슬로 떨어진다. 드래곤은 구슬을 먹여서 키운다. */
    const gotOrbs = expToOrbs(rw.exp)
    const next = {
      ...S,
      gold: S.gold + rw.gold,
      stones: (S.stones ?? 0) + rw.stones,
      orbs: addOrbs(S.orbs, gotOrbs),
    }
    if (!dungeon) next.cleared = { ...S.cleared, [stage.id]: true }
    commit(next)
    /* 마지막 스테이지라면 보상창 대신 최종 대화 → 엔딩 선택으로 넘긴다 */
    if (!dungeon && stage.id === FINAL_STAGE_ID && !S.ending) {
      setBeat({ script: FINAL_PROLOGUE, chapter: CHAPTER_BY_ID[10], then: () => setEnding(true) })
    } else {
      setReward({ ...rw, orbs: gotOrbs, stage, expBonus: expMul > 1, dungeon: !!dungeon })
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
 />
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
                      <DragonPreview elementId={d.element} rarity={d.rarity} dragonId={d.id} className="h-24 w-full" />
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
                { id: 'tower', icon: '🗼', name: '무한의 탑', sub: `${S.tower?.best ?? 0} / ${MAX_FLOOR}층` },
                { id: 'roster', icon: '🐲', name: '드래곤', sub: '장비 · 룬 · 진화', hot: orbCount(S.orbs) > 0 },
                { id: 'dex', icon: '📖', name: '도감', sub: `${Object.keys(S.dragons).length} / ${DRAGONS.length}종` },
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
          dragons={S.dragons} team={S.team} gold={S.gold} gems={S.gems} stones={S.stones ?? 0}
          orbs={S.orbs || {}}
          inventory={S.inventory || []} runeBag={S.runeBag || []} gear={S.gear || {}}
          onToggleTeam={toggleTeam} onEvolve={evolve} onFeed={feedOrb}
          gearActions={{
            onEquip: equipGear, onUnequip: unequipGear,
            onEquipRune: equipRune, onUnequipRune: unequipRune,
            onEnhance: enhanceGear, onSalvage: salvageGear, onSalvageRune: salvageRune,
          }}
          onBack={() => setScreen('home')} />
      )}

      {screen === 'tower' && (
        <TowerScreen tower={S.tower} onClimb={climbTower} onBack={() => setScreen('home')} />
      )}

      {screen === 'dex' && (
        <DexScreen dragons={S.dragons} onBack={() => setScreen('home')} />
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

      {/* 강화 결과 */}
      {enhanceResult && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-5"
          onClick={() => setEnhanceResult(null)}>
          <div className="w-full max-w-[15rem] rounded-3xl border border-white/12 bg-slate-900 p-6 text-center">
            <div className="text-4xl">{enhanceResult.ok ? '✨' : enhanceResult.protect ? '🛡' : '💥'}</div>
            <div className={`mt-2 text-lg font-black ${enhanceResult.ok ? 'text-amber-300' : 'text-slate-300'}`}>
              {enhanceResult.ok ? '강화 성공!' : '강화 실패…'}
            </div>
            <div className="mt-2 text-[13px] font-black tabular-nums text-white">
              +{enhanceResult.from} → +{enhanceResult.plus}
            </div>
            {!enhanceResult.ok && enhanceResult.protect && (
              <div className="mt-1 text-[11px] text-sky-300">보호권이 수치를 지켜냈습니다</div>
            )}
            <button onClick={() => setEnhanceResult(null)}
              className="mt-4 w-full rounded-xl bg-white/10 py-2 text-[12px] font-bold text-white hover:bg-white/20">
              확인
            </button>
          </div>
        </div>
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
            <div className="text-4xl">{reward.tower ? '🗼' : '🎁'}</div>
            <div className="mt-2 text-lg font-black text-white">
              {reward.tower ? `${reward.tower}층 돌파` : reward.dungeon ? '던전 클리어' : '스테이지 클리어'}
            </div>
            {reward.milestone && (
              <div className="mt-1 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-[11px] font-black text-amber-200">
                ★ {reward.milestone.text}
              </div>
            )}
            <div className="mt-3 space-y-1 text-[13px]">
              <div className="flex justify-between">
                <span className="text-slate-400">경험 구슬{reward.expBonus && <span className="ml-1 text-[10px] text-amber-300">월정액 +10%</span>}</span>
                <span className="flex gap-1.5 font-black text-sky-300">
                  {EXP_ORBS.filter((o) => reward.orbs?.[o.id] > 0).map((o) => (
                    <span key={o.id}>{o.icon}{reward.orbs[o.id]}</span>
                  ))}
                </span>
              </div>
              <div className="flex justify-between"><span className="text-slate-400">골드</span><span className="font-black text-amber-300">+{reward.gold}</span></div>
              {reward.stones > 0 && (
                <div className="flex justify-between"><span className="text-slate-400">진화석</span><span className="font-black text-violet-300">+{reward.stones}</span></div>
              )}
              {reward.gems > 0 && (
                <div className="flex justify-between"><span className="text-slate-400">보석</span><span className="font-black text-fuchsia-300">+{reward.gems}</span></div>
              )}

            </div>
            {/* 탑에서 나온 장비·룬·드래곤 */}
            {(reward.gear?.length > 0 || reward.runes?.length > 0 || reward.eggDragon) && (
              <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
                {reward.gear?.map((it) => {
                  const info = gearInfo(it)
                  return (
                    <div key={it.uid} className="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left"
                      style={{ borderColor: info.grade.color + '66' }}>
                      <span className="text-sm">{info.slot.icon}</span>
                      <span className="truncate text-[11px] font-bold text-white">{info.name}</span>
                      <span className="ml-auto shrink-0 text-[10px] font-black" style={{ color: info.grade.color }}>
                        {info.grade.name}
                      </span>
                    </div>
                  )
                })}
                {reward.runes?.map((r) => {
                  const ri = runeInfo(r)
                  return (
                    <div key={r.uid} className="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left"
                      style={{ borderColor: ri.grade.color + '66' }}>
                      <span className="text-sm">{ri.icon}</span>
                      <span className="truncate text-[11px] font-bold text-white">{ri.name}</span>
                      <span className="ml-auto shrink-0 text-[10px] font-black" style={{ color: ri.grade.color }}>
                        {ri.grade.name}
                      </span>
                    </div>
                  )
                })}
                {reward.eggDragon && (
                  <div className="rounded-lg border border-amber-300/50 bg-amber-300/10 px-2 py-1.5 text-[11px] font-bold text-amber-200">
                    🥚 특수 드래곤 알 — {reward.eggDragon.name}
                  </div>
                )}
                {reward.bagFull && (
                  <div className="text-[10px] text-rose-400">가방이 가득 차 일부 장비를 받지 못했습니다</div>
                )}
              </div>
            )}
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
