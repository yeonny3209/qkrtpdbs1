/* ==================================================================
   Bunker Break

   화면 상태(메뉴/플레이/일시정지/게임오버)와 3D 무대를 묶는다.
   캔버스는 한 번 만들면 끝까지 살아 있다 — 일시정지는 그 위에 판을
   덮는 것일 뿐이라, 풀면 있던 자리에서 그대로 이어진다. 메뉴로
   돌아갈 때만 세션을 새로 만든다.
   ================================================================== */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'

import Arena from './three/Arena.jsx'
import Enemy from './three/Enemy.jsx'
import Pickups from './three/Pickups.jsx'
import Effects from './three/Effects.jsx'
import { createEffects } from './three/effectPool.js'
import Weapon from './three/Weapon.jsx'
import PlayerRig from './three/PlayerRig.jsx'

import Hud from './ui/Hud.jsx'
import Lobby from './ui/Lobby.jsx'
import { MainMenu, PauseScreen, GameOverScreen } from './ui/Screens.jsx'

import { createSession } from './game/session.js'
import { loadBest } from './game/score.js'
import { DEFAULT_LOADOUT, normalizeLoadout } from './game/weapons.js'
import { DEFAULT_DIFFICULTY } from './game/difficulty.js'
import { useInput } from './hooks/useInput.js'
import { ensureAudio } from './audio.js'

/* 고른 구성을 브라우저에 남긴다. 막혀 있어도(사생활 보호 모드 등)
   게임은 그냥 기본값으로 돌아가면 된다 — 저장 실패로 멈추지 않는다. */
function loadStored(key, fallback, fix) {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    return raw ? fix(JSON.parse(raw)) : fallback
  } catch { return fallback }
}
function store(key, value) {
  try { globalThis.localStorage?.setItem(key, JSON.stringify(value)) } catch { /* 조용히 넘긴다 */ }
}

export default function App() {
  const [screen, setScreen] = useState('menu')
  const [hud, setHud] = useState(null)
  const [enemyIds, setEnemyIds] = useState([])
  const [pickupRev, setPickupRev] = useState(0)
  const [banner, setBanner] = useState(null)
  const [hitmarker, setHitmarker] = useState(null)
  const [hurtKey, setHurtKey] = useState(0)
  const [floaters, setFloaters] = useState([])
  const [best, setBest] = useState(() => loadBest())
  const [result, setResult] = useState(null)
  const [lockError, setLockError] = useState(false)
  /* 판마다 맵이 바뀐다. Arena 는 이 값이 바뀔 때만 다시 그린다. */
  const [mapId, setMapId] = useState(null)

  /* 로비에서 고른 것. 다시 하기를 눌러도 그대로 쓴다 — 판마다 다시
     고르게 하면 같은 구성으로 연습하는 것이 번거로워진다. */
  const [loadout, setLoadout] = useState(() => loadStored('bb:loadout', DEFAULT_LOADOUT, normalizeLoadout))
  const [difficulty, setDifficulty] = useState(() => loadStored('bb:difficulty', DEFAULT_DIFFICULTY, (v) => v))

  const sessionRef = useRef(null)
  const effectsRef = useRef(createEffects())
  const flashRef = useRef({ t: 0, seed: 0 })
  const controls = useRef(null)
  const runningRef = useRef(false)
  const inputEnabled = useRef(false)
  const inputRef = useInput(inputEnabled)

  if (!sessionRef.current) sessionRef.current = createSession()
  if (mapId === null) setMapId(sessionRef.current.map.id)

  /* 화면이 바뀔 때마다 "지금 굴러가는 중인가"를 ref 에도 적어 둔다.
     useFrame 안에서는 state 를 못 읽는다 — 클로저가 처음 값에 묶인다. */
  useEffect(() => {
    const playing = screen === 'playing'
    runningRef.current = playing
    inputEnabled.current = playing
  }, [screen])

  /* 마우스 잠금은 실패할 수 있다 — 브라우저가 막아 둔 자리(일부
     내장 미리보기, iframe)에서는 거부된다. 그때 아무 말 없이
     조작만 안 되면 게임이 고장 난 것으로 보인다. 잠깐 기다렸다가
     안 잡혔으면 이유를 알려 준다.

     시작·재개보다 먼저 선언해야 한다. const 는 끌어올려지지 않아서,
     아래에 두면 위 두 함수의 의존성 배열이 초기화 전에 이걸 읽어
     화면 전체가 안 뜬다. */
  const checkLock = useCallback(() => {
    setTimeout(() => {
      if (!document.pointerLockElement) {
        setLockError(true)
        setScreen((s) => (s === 'playing' ? 'paused' : s))
      }
    }, 800)
  }, [])

  const startRun = useCallback(() => {
    ensureAudio()
    sessionRef.current = createSession(Date.now(), { difficulty, loadout })
    setMapId(sessionRef.current.map.id)
    effectsRef.current = createEffects()
    setHud(null)
    setEnemyIds([])
    setResult(null)
    setBanner(null)
    setFloaters([])
    setPickupRev((v) => v + 1)
    setScreen('playing')
    /* 잠금 요청은 클릭 처리가 끝난 뒤라야 브라우저가 받아 준다 */
    requestAnimationFrame(() => controls.current?.lock())
    checkLock()
  }, [checkLock, difficulty, loadout])

  const resume = useCallback(() => {
    ensureAudio()
    setScreen('playing')
    requestAnimationFrame(() => controls.current?.lock())
    checkLock()
  }, [checkLock])

  const toMenu = useCallback(() => {
    controls.current?.unlock()
    sessionRef.current = createSession(Date.now(), { difficulty, loadout })
    setMapId(sessionRef.current.map.id)
    setScreen('menu')
    setHud(null)
    setEnemyIds([])
    setBest(loadBest())
  }, [difficulty, loadout])

  /* 마우스 잠금이 풀리면(Esc 등) 곧 일시정지다. 게임오버 화면에서는
     이미 풀어 놓은 것이므로 무시한다. */
  const onUnlock = useCallback(() => {
    setScreen((s) => (s === 'playing' ? 'paused' : s))
  }, [])

  const onLock = useCallback(() => setLockError(false), [])

  const pickWeapon = useCallback((slot, id) => {
    setLoadout((prev) => {
      const next = normalizeLoadout({ ...prev, [slot]: id })
      store('bb:loadout', next)
      return next
    })
  }, [])

  const pickDifficulty = useCallback((id) => {
    setDifficulty(id)
    store('bb:difficulty', id)
  }, [])

  const onEvent = useCallback((ev) => {
    if (ev.kind === 'hitmarker') {
      setHitmarker({ key: performance.now(), headshot: ev.headshot, lethal: ev.lethal })
    } else if (ev.kind === 'hurt') {
      setHurtKey(performance.now())
    } else if (ev.kind === 'kill') {
      const id = performance.now() + Math.random()
      setFloaters((f) => [...f.slice(-5), { id, gained: ev.gained }])
      setTimeout(() => setFloaters((f) => f.filter((v) => v.id !== id)), 900)
    } else if (ev.kind === 'waveStart') {
      setBanner({ key: performance.now(), text: `웨이브 ${ev.wave}`, sub: '버텨라' })
    } else if (ev.kind === 'waveClear') {
      setBanner({ key: performance.now(), text: '정리 완료', sub: '보급을 챙겨라' })
      setPickupRev((v) => v + 1)
    } else if (ev.kind === 'pickup') {
      setPickupRev((v) => v + 1)
    } else if (ev.kind === 'gameOver') {
      const s = sessionRef.current
      setResult({
        points: ev.points, wave: ev.wave,
        kills: s.score.kills, headshots: s.score.headshots,
      })
      setBest(loadBest())
      setScreen('over')
      controls.current?.unlock()
    }
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#4d5a6b]">
      <Canvas
        /* PCFSoft 는 three 에서 폐기 예고가 붙어 콘솔을 채운다.
           그림자 하나짜리 씬이라 부드러움 차이도 거의 없다. */
        shadows="percentage"
        dpr={[1, 1.75]}
        camera={{ fov: 76, near: 0.05, far: 130, position: [0, 1.62, 0] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        {/* 안개는 배경색과 같아야 먼 벽이 배경으로 자연스럽게 녹는다.
            시작 거리를 멀리 밀어 아레나 반대편이 뿌옇지 않게 했다 —
            30x30 짜리 방에서 11 부터 안개가 끼면 적이 흐릿해진다. */}
        <color attach="background" args={['#4d5a6b']} />
        <fog attach="fog" args={['#4d5a6b', 26, 68]} />

        <Arena key={mapId} map={sessionRef.current.map} />
        {enemyIds.map((id) => (
          <Enemy key={id} id={id} sessionRef={sessionRef} />
        ))}
        <Pickups sessionRef={sessionRef} revision={pickupRev} />
        <Effects effectsRef={effectsRef} />
        <Weapon sessionRef={sessionRef} flashRef={flashRef} />

        <PlayerRig
          sessionRef={sessionRef}
          inputRef={inputRef}
          effectsRef={effectsRef}
          flashRef={flashRef}
          runningRef={runningRef}
          onHud={setHud}
          onEnemies={setEnemyIds}
          onEvent={onEvent}
        />
        <PointerLockControls ref={controls} onLock={onLock} onUnlock={onUnlock} />
      </Canvas>

      {screen === 'playing' && (
        <Hud
          hud={hud}
          banner={banner}
          hitmarker={hitmarker}
          hurtKey={hurtKey}
          floaters={floaters}
        />
      )}
      {screen === 'menu' && <MainMenu onStart={() => setScreen('lobby')} best={best} />}
      {screen === 'lobby' && (
        <Lobby
          loadout={loadout}
          difficulty={difficulty}
          onPick={pickWeapon}
          onDifficulty={pickDifficulty}
          onStart={startRun}
          onBack={() => setScreen('menu')}
          best={best}
        />
      )}
      {screen === 'paused' && (
        <PauseScreen onResume={resume} onQuit={toMenu} hud={hud} lockError={lockError} />
      )}
      {screen === 'over' && result && (
        <GameOverScreen
          result={result} best={best} onRetry={startRun}
          onLobby={() => { controls.current?.unlock(); setScreen('lobby') }}
          onMenu={toMenu}
        />
      )}
    </div>
  )
}
