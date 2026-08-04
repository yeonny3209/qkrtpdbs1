/* ==================================================================
   드래곤 마스터: 레전드 — 메인

   화면: 시작(스타터 선택) → 홈 → 캠페인 / 소환 / 드래곤
   ================================================================== */
import { useCallback, useMemo, useState } from 'react'
import GachaScreen from './ui/GachaScreen.jsx'
import CampaignScreen, { StoryBeat } from './ui/CampaignScreen.jsx'
import RosterScreen, { TEAM_SIZE } from './ui/RosterScreen.jsx'
import BattleScreen from './ui/BattleScreen.jsx'
import SummonCutscene from './three/SummonCutscene.jsx'
import DragonPreview from './ui/DragonPreview.jsx'
import { ELEMENTS, ELEMENT_BY_ID } from './game/elements.js'
import { DRAGONS, DRAGON_BY_ID, limitedLegends, gainExp, evoCost, evoGoldCost, MAX_EVOLUTION } from './game/dragons.js'
import { createGachaState, pullMany, bestOf, costOf } from './game/gacha.js'
import { CHAPTER_BY_ID, TOTAL_STAGES } from './game/campaign.js'
import { buildEncounter, stageReward } from './game/encounter.js'

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
})

export default function App() {
  const [S, setS] = useState(() => ({ ...fresh(), ...(load() || {}) }))
  const [screen, setScreen] = useState('home')     // home | campaign | gacha | roster
  const [bannerId, setBannerId] = useState('limited')
  const [results, setResults] = useState(null)
  const [cutscene, setCutscene] = useState(null)
  const [battle, setBattle] = useState(null)       // { stage, allies, enemies, difficulty }
  const [beat, setBeat] = useState(null)           // { beat, chapter, then }
  const [reward, setReward] = useState(null)

  const commit = useCallback((next) => { setS(next); save(next) }, [])
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
    if (cur.count - 1 < need || S.gold < goldNeed) return
    commit({
      ...S, gold: S.gold - goldNeed,
      dragons: { ...S.dragons, [id]: { ...cur, count: cur.count - need, evo: step } },
    })
  }

  /* ---------- 전투 시작 ---------- */
  const startStage = (stage) => {
    if (!S.team.length) { setScreen('roster'); return }
    const allies = S.team.map((id) => ({
      dragon: DRAGON_BY_ID[id],
      level: S.dragons[id]?.level ?? 1,
      evo: S.dragons[id]?.evo ?? 0,
    })).filter((a) => a.dragon)
    const { enemies, difficulty } = buildEncounter(stage, S.difficulty, Date.now() >>> 0, allies.length)
    const go = () => setBattle({ stage, allies, enemies, difficulty })
    /* 스테이지에 스토리 연출이 있고 아직 안 봤다면 먼저 보여준다 */
    if (stage.beat && !S.seenBeats[stage.id]) {
      commit({ ...S, seenBeats: { ...S.seenBeats, [stage.id]: true } })
      setBeat({ beat: stage.beat, chapter: CHAPTER_BY_ID[stage.chapter], then: go })
    } else go()
  }

  /* ---------- 전투 종료 ---------- */
  const finishBattle = (outcome) => {
    const { stage } = battle
    setBattle(null)
    if (outcome !== 'win') return
    const rw = stageReward(stage, S.difficulty)
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
    commit({
      ...S, gold: S.gold + rw.gold, dragons,
      cleared: { ...S.cleared, [stage.id]: true },
    })
    setReward({ ...rw, levelUps, stage })
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
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { id: 'campaign', icon: '⚔', name: '캠페인', sub: '용의 섬 10장' },
                { id: 'gacha', icon: '🔮', name: '소환', sub: '드래곤 뽑기' },
                { id: 'roster', icon: '🐲', name: '드래곤', sub: '편성 · 진화' },
              ].map((m) => (
                <button key={m.id} onClick={() => setScreen(m.id)}
                  className="rounded-2xl border border-white/10 bg-white/[.05] p-5 text-center transition hover:-translate-y-1 hover:bg-white/[.1]">
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
          dragons={S.dragons} team={S.team} gold={S.gold}
          onToggleTeam={toggleTeam} onEvolve={evolve}
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
      {beat && <StoryBeat beat={beat.beat} chapter={beat.chapter} onDone={() => { const f = beat.then; setBeat(null); f() }} />}

      {/* 전투 보상 */}
      {reward && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-5">
          <div className="w-full max-w-xs rounded-3xl border border-amber-400/40 bg-slate-900 p-6 text-center">
            <div className="text-4xl">🎁</div>
            <div className="mt-2 text-lg font-black text-white">스테이지 클리어</div>
            <div className="mt-3 space-y-1 text-[13px]">
              <div className="flex justify-between"><span className="text-slate-400">경험치</span><span className="font-black text-sky-300">+{reward.exp}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">골드</span><span className="font-black text-amber-300">+{reward.gold}</span></div>
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
