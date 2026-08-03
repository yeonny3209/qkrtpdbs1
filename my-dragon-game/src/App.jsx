/* ==================================================================
   MY DRAGON GAME — 드래곤 시스템 (모델 · 소환 · 컷씬)
   ================================================================== */
import { useCallback, useMemo, useState } from 'react'
import GachaScreen from './ui/GachaScreen.jsx'
import SummonCutscene from './three/SummonCutscene.jsx'
import { limitedLegends, DRAGON_BY_ID } from './game/dragons.js'
import { createGachaState, pullMany, bestOf, costOf } from './game/gacha.js'

const LS_SAVE = 'dragon_save_v1'

const load = () => {
  try { return JSON.parse(localStorage.getItem(LS_SAVE)) } catch { return null }
}
const save = (v) => {
  try { localStorage.setItem(LS_SAVE, JSON.stringify(v)) } catch { /* 무시 */ }
}

const defaultSave = () => ({
  gems: 30000,                 // 시작 보석 (10연차 10번 분량)
  gacha: createGachaState(),
  owned: {},                   // dragonId -> 보유 수 (진화 재료)
})

export default function App() {
  const [state, setState] = useState(() => ({ ...defaultSave(), ...(load() || {}) }))
  const [bannerId, setBannerId] = useState('limited')
  const [results, setResults] = useState(null)     // 결과 목록
  const [cutscene, setCutscene] = useState(null)   // 재생할 컷씬 결과

  /* 이번 한정 배너의 픽업 드래곤 (상시 배너에선 대표 상시 레전드를 세워둔다) */
  const featured = useMemo(
    () => (bannerId === 'limited' ? limitedLegends()[0] : DRAGON_BY_ID.slegend_0),
    [bannerId],
  )

  const ownedOf = useCallback((id) => state.owned[id] || 0, [state.owned])

  const commit = useCallback((next) => {
    setState(next)
    save(next)
  }, [])

  const onPull = useCallback((count) => {
    const cost = costOf(count)
    if (state.gems < cost) return

    /* 순수 로직에 상태를 넘겨 뽑고, 그 결과로 세이브를 갱신한다 */
    const gacha = { ...state.gacha }
    const rolled = pullMany(gacha, bannerId, featured.id, count)

    const owned = { ...state.owned }
    rolled.forEach((r) => { owned[r.dragon.id] = (owned[r.dragon.id] || 0) + 1 })

    commit({ gems: state.gems - cost, gacha, owned })

    /* 가장 높은 등급 하나만 컷씬으로 보여주고, 끝나면 목록을 편다 */
    setResults(rolled)
    setCutscene(bestOf(rolled))
  }, [state, bannerId, featured, commit])

  return (
    <>
      <GachaScreen
        gems={state.gems}
        bannerId={bannerId}
        setBannerId={setBannerId}
        featured={featured}
        gacha={state.gacha}
        results={cutscene ? null : results}
        ownedOf={ownedOf}
        onPull={onPull}
        onClearResults={() => setResults(null)}
      />
      {cutscene && (
        <SummonCutscene result={cutscene} onDone={() => setCutscene(null)} />
      )}
    </>
  )
}
