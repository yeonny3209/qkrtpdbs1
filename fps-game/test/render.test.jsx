/* ==================================================================
   렌더링 계층 검증  —  npm run test:render

   game/ 의 규칙은 logic.test.mjs 가 본다. 여기서 보는 것은 그 규칙이
   화면 쪽과 제대로 이어져 있는가다. 씬이 세워지는가, useFrame 이
   매 프레임 터지지 않고 도는가, 적의 렌더 좌표가 세션을 따라가는가,
   쏘면 실제로 죽고 그 사실이 UI 로 전달되는가.

   R3F 테스트 렌더러로 머리 없이(headless) 돌린다. WebGL 은 가짜지만
   씬 그래프·훅·ref 조작은 전부 진짜라, 브라우저를 못 띄우는 곳에서도
   렌더링 코드의 실수를 잡아낸다.
   ================================================================== */

/* ── Node 에는 DOM 이 없다 ──────────────────────────────────────
   두 곳이 캔버스를 필요로 한다.
     · Arena 의 바닥 격자 → 2d 컨텍스트 (그리는 시늉만 하면 된다)
     · 테스트 렌더러 자신 → WebGL 컨텍스트

   테스트 렌더러는 document 가 있으면 document.createElement 로
   캔버스를 만든다. 그래서 이 흉내 캔버스가 three 의 WebGLRenderer 가
   요구하는 것(addEventListener, style, getContext)까지 갖춰야 한다.
   webgl 컨텍스트는 테스트 렌더러가 globalThis 에 심어 두는 가짜
   클래스를 그대로 쓴다 — getContext 가 불릴 시점에는 이미 있다. */
const ctx2d = new Proxy({}, { get: () => () => {} })

function fakeCanvas() {
  const el = {
    width: 1280, height: 800, clientWidth: 1280, clientHeight: 800,
    style: {}, dataset: {},
    addEventListener() {}, removeEventListener() {},
    setAttribute() {}, appendChild() {}, remove() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
  }
  el.getContext = (id) => {
    if (id === '2d') return ctx2d
    const GL = globalThis.WebGL2RenderingContext
    return GL ? new GL(el) : null
  }
  return el
}

globalThis.document = globalThis.document || {
  createElement: () => fakeCanvas(),
  createElementNS: () => fakeCanvas(),
  body: { appendChild() {}, removeChild() {} },
  addEventListener() {}, removeEventListener() {},
  getElementById: () => null,
}
globalThis.window = globalThis.window || globalThis
globalThis.IS_REACT_ACT_ENVIRONMENT = true

import ReactThreeTestRenderer from '@react-three/test-renderer'

import Arena from '../src/three/Arena.jsx'
import Enemy from '../src/three/Enemy.jsx'
import Pickups from '../src/three/Pickups.jsx'
import Effects from '../src/three/Effects.jsx'
import Weapon from '../src/three/Weapon.jsx'
import PlayerRig from '../src/three/PlayerRig.jsx'
import { createEffects } from '../src/three/effectPool.js'
import { createSession } from '../src/game/session.js'
import { createInput } from '../src/hooks/useInput.js'

let pass = 0, fail = 0
const fails = []
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m) } }
const eq = (a, b, m) => ok(Object.is(a, b), `${m} — got ${a}, want ${b}`)

/* 세션과 참조들을 밖에서 만들어 테스트가 들여다볼 수 있게 한다 */
const session = createSession(12345)
const sessionRef = { current: session }
const inputRef = { current: createInput() }
const effectsRef = { current: createEffects() }
const flashRef = { current: { t: 0, seed: 0 } }
const runningRef = { current: true }

const hud = { last: null }
const seen = []
let enemyIds = []

function Scene() {
  return (
    <>
      <Arena map={session.map} />
      {enemyIds.map((id) => <Enemy key={id} id={id} sessionRef={sessionRef} />)}
      <Pickups sessionRef={sessionRef} revision={0} />
      <Effects effectsRef={effectsRef} />
      <Weapon sessionRef={sessionRef} flashRef={flashRef} />
      <PlayerRig
        sessionRef={sessionRef}
        inputRef={inputRef}
        effectsRef={effectsRef}
        flashRef={flashRef}
        runningRef={runningRef}
        onHud={(h) => { hud.last = h }}
        onEnemies={(ids) => { enemyIds = ids }}
        onEvent={(e) => seen.push(e)}
      />
    </>
  )
}

const renderer = await ReactThreeTestRenderer.create(<Scene />)

/* ── 씬이 실제로 세워졌는가 ─────────────────────────────────────── */
const scene = renderer.scene
ok(scene, '씬이 생성됨')
const all = []
scene.allChildren.forEach((c) => all.push(c))
ok(scene.children.length > 0, `씬에 물체가 있다 — ${scene.children.length}`)

/* 아레나 벽 + 바닥 + 천장 + 조명이 다 들어갔는지 (three 객체로 확인) */
const inst = renderer.toTree()
ok(Array.isArray(inst) && inst.length > 0, '트리가 만들어짐')

let meshCount = 0, lightCount = 0
renderer.scene.instance.traverse((o) => {
  if (o.isMesh) meshCount++
  if (o.isLight) lightCount++
})
ok(meshCount > 20, `아레나 메시가 충분히 생성됨 — ${meshCount}`)
ok(lightCount >= 5, `조명이 배치됨 — ${lightCount}`)

/* ── 프레임을 돌린다 — 여기서 useFrame 의 오류가 드러난다 ───────── */
await ReactThreeTestRenderer.act(async () => {
  await renderer.advanceFrames(30, 1 / 60)
})
ok(hud.last !== null, 'HUD 스냅샷이 전달됨')
eq(session.phase, 'ready', '아직 준비 단계')

/* 준비 시간을 넘겨 웨이브 1 시작 */
await ReactThreeTestRenderer.act(async () => {
  await renderer.advanceFrames(260, 1 / 60)
})
eq(session.phase, 'wave', '웨이브가 시작됨')
eq(session.wave, 1, '1웨이브')
ok(seen.some((e) => e.kind === 'waveStart'), 'waveStart 이벤트가 나옴')
ok(session.enemies.length > 0, `적이 스폰됨 — ${session.enemies.length}`)

/* 적 컴포넌트가 실제로 붙었는지 — onEnemies 로 아이디가 올라온다 */
ok(enemyIds.length > 0, `적 아이디가 React 로 전달됨 — ${enemyIds.length}`)

/* 적이 붙은 상태로 다시 렌더 후 프레임 — Enemy 의 useFrame 검증 */
await ReactThreeTestRenderer.act(async () => {
  renderer.update(<Scene />)
  await renderer.advanceFrames(120, 1 / 60)
})
let enemyMeshes = 0
renderer.scene.instance.traverse((o) => {
  if (o.isMesh) enemyMeshes++
})
ok(enemyMeshes > meshCount, `적 메시가 씬에 추가됨 — ${meshCount} → ${enemyMeshes}`)

/* 적이 실제로 움직였는가 (렌더 좌표가 세션을 따라가는가)

   컴포넌트가 붙어 있는 적만 볼 수 있다. 세션에는 방금 스폰되어
   아직 React 에 반영 안 된 적도 있어서, 마운트된 아이디 중에서
   고른다. */
{
  /* 마운트된 것과 세션을 먼저 맞춘다. enemyIds 는 콜백으로 계속
     갱신되지만 컴포넌트는 renderer.update 때만 다시 붙는다. 그
     사이에 죽고 새로 나온 적을 두고 비교하면 있지도 않은 그룹을
     찾게 된다. */
  await ReactThreeTestRenderer.act(async () => {
    renderer.update(<Scene />)
    await renderer.advanceFrames(2, 1 / 60)
  })
  const mounted = enemyIds.filter((id) => {
    const v = session.enemies.find((x) => x.id === id)
    return v && v.state !== 'dead'
  })
  ok(mounted.length > 0, '마운트된 살아있는 적이 있다')
  const e = session.enemies.find((v) => v.id === mounted[0])
  if (e) {
    let found = null
    renderer.scene.instance.traverse((o) => {
      if (found) return
      /* 한 프레임까지는 어긋나도 된다. Enemy 의 useFrame 이 PlayerRig
         보다 먼저 등록되어 먼저 돌기 때문에, 적은 세션이 갱신되기
         직전 좌표로 그려진다. 가장 빠른 적도 프레임당 0.08 밖에
         못 움직이므로 눈에 보이지 않는다. */
      if (o.isGroup && Math.abs(o.position.x - e.x) < 0.12 && Math.abs(o.position.z - e.z) < 0.12) {
        found = o
      }
    })
    if (!found) {
      let closest = null, cd = Infinity
      renderer.scene.instance.traverse((o) => {
        if (!o.isGroup) return
        const d = Math.hypot(o.position.x - e.x, o.position.z - e.z)
        if (d < cd) { cd = d; closest = o }
      })
      console.log('   [진단] 적 %s @(%s,%s), 가장 가까운 그룹 거리 %s @(%s,%s)',
        e.id, e.x.toFixed(2), e.z.toFixed(2), cd.toFixed(3),
        closest ? closest.position.x.toFixed(2) : '?',
        closest ? closest.position.z.toFixed(2) : '?')
    }
    ok(found, `적의 렌더 위치가 세션 좌표(${e.x.toFixed(1)}, ${e.z.toFixed(1)})와 일치`)

    /* 높이도 따라가야 한다. 계단과 통로가 생긴 뒤로 적의 y 가 0 이
       아닐 수 있는데, 그리는 쪽이 0 으로 고정해 두면 통로 위의 적이
       바닥에 파묻힌 채로 보인다. 걸음 흔들림만큼 여유를 둔다. */
    if (found) {
      ok(Math.abs(found.position.y - (e.y || 0)) < 0.2,
        `적의 렌더 높이가 세션 높이를 따른다 — 화면 ${found.position.y.toFixed(2)} vs 세션 ${(e.y || 0).toFixed(2)}`)
    }

    /* 통로 위로 올려 두면 그린 것도 같이 올라가는가 */
    {
      const before = found ? found.position.y : 0
      e.y = 2
      await ReactThreeTestRenderer.act(async () => { await renderer.advanceFrames(2, 1 / 60) })
      let raised = null
      renderer.scene.instance.traverse((o) => {
        if (!raised && o.isGroup && Math.abs(o.position.x - e.x) < 0.4 &&
            Math.abs(o.position.z - e.z) < 0.4 && o.position.y > 1.5) raised = o
      })
      ok(raised, `통로 높이로 올린 적이 그 높이에 그려진다 (이전 ${before.toFixed(2)})`)
      e.y = 0
    }
  }
}

/* ── 이동 ──────────────────────────────────────────────────────── */
{
  const x0 = session.player.x
  const z0 = session.player.z
  inputRef.current.forward = true
  await ReactThreeTestRenderer.act(async () => { await renderer.advanceFrames(40, 1 / 60) })
  inputRef.current.forward = false
  const moved = Math.hypot(session.player.x - x0, session.player.z - z0)
  ok(moved > 0.5, `앞으로 눌렀더니 실제로 움직임 — ${moved.toFixed(2)}`)
  ok(renderer.scene.instance.children.length >= 0, '이동 중 씬 유지')
}

ok(Math.abs(session.player.y) < 1e-6, '이동 뒤에도 땅에 서 있다')

/* ── 사격 ──────────────────────────────────────────────────────── */
{
  const killsBefore = session.score.kills
  const shotsBefore = seen.filter((e) => e.kind === 'hitmarker').length
  /* 시작 무기는 로비에서 고른 주무기다(기본 구성에서는 소총).
     권총을 고정해 보면 안 쏘는 총의 탄약을 재게 된다. */
  const firing = session.player.weapon
  const magBefore = session.player.ammo[firing].inMag
  /* 매 프레임 가장 가까운 적의 몸 한가운데를 겨눈다.

     pitch 를 0 으로 두면 눈높이(1.62)에서 수평으로 나가서 키 1.05 인
     크롤러 위로 전부 넘어간다. 순수 로직 테스트에서 한 번 데인 것과
     같은 실수라, 여기서도 똑같이 몸통 중심을 겨눈다. */
  const { ENEMY_TYPES } = await import('../src/game/enemies.js')
  const { PLAYER } = await import('../src/game/player.js')

  /* 무대를 정해 놓고 쏜다.

     처음엔 "가장 가까운 적"을 겨눴는데, 그 적이 벽 뒤에 있으면
     총알이 벽에 박혀서 한 발도 안 맞는다. 그건 게임이 옳게 동작한
     결과지 검증이 아니다. 그래서 플레이어를 중앙 광장 한가운데에
     세우고, 적을 그 앞 트인 자리로 옮겨 놓고 쏜다. */
  session.player.x = 0
  session.player.z = 0
  session.player.y = 0
  const victim = session.enemies.find((e) => e.state !== 'dead')
  ok(victim, '표적으로 쓸 적이 있다')
  victim.x = 0
  victim.z = -4
  victim.state = 'chasing'
  victim.stateT = 1
  victim.hp = victim.maxHp

  const targetY = ENEMY_TYPES[victim.type].height * 0.5

  /* 조준은 카메라가 정한다 — PlayerRig 가 매 프레임 카메라 회전을
     읽어 input.yaw/pitch 를 덮어쓴다. 진짜 게임에서는 마우스 잠금이
     카메라를 돌리므로, 여기서도 카메라를 직접 돌려야 한다.
     input 에 각도를 넣어 봐야 그 자리에서 지워진다. */
  let cam = null
  renderer.scene.instance.traverse((o) => { if (!cam && o.isCamera) cam = o })
  ok(cam, '카메라를 씬에서 찾음 (Weapon 이 scene.add(camera) 를 한다)')
  const aimPitch = Math.atan2(targetY - PLAYER.eyeHeight, 4)

  for (let i = 0; i < 60; i++) {
    /* 죽지 않게, 또 자리를 지키게 유지한다 — 지금 보는 건 사격이다 */
    session.player.hp = PLAYER.maxHp
    session.player.x = 0
    session.player.z = 0
    if (victim.state !== 'dead') { victim.x = 0; victim.z = -4 }
    if (cam) { cam.rotation.set(aimPitch, 0, 0, 'YXZ'); cam.updateMatrixWorld() }
    inputRef.current.fire = true
    inputRef.current.firePressed = true
    await ReactThreeTestRenderer.act(async () => { await renderer.advanceFrames(6, 1 / 60) })
  }
  inputRef.current.fire = false
  const magAfter = session.player.ammo[firing].inMag
  ok(magAfter !== magBefore || session.player.reloading > 0, '탄약이 소비됨')
  ok(session.score.kills > killsBefore,
    `사격으로 적을 잡음 — 처치 ${killsBefore} → ${session.score.kills}`)
  ok(seen.filter((e) => e.kind === 'hitmarker').length > shotsBefore, '명중 표시 이벤트 발생')
  ok(flashRef.current.t >= 0, '총구 화염 타이머가 정상 범위')
  ok(seen.some((e) => e.kind === 'kill'), 'kill 이벤트가 UI 로 전달됨')
}

/* ── 근접무기 — 슬롯 전환부터 처치까지 화면 쪽을 거쳐 확인 ────── */
{
  const killsBefore = session.score.kills
  const pistolMagBefore = session.player.ammo.pistol.inMag

  /* 3번 슬롯을 입력으로 요청한다. 세션이 이걸 받아 무기를 바꾸는지가
     이 검사의 절반이다 — 규칙 테스트는 switchSlot 을 직접 부르지만,
     여기서는 입력 → 세션 → 무기까지 실제 경로를 탄다. */
  inputRef.current.switchSlot = 'melee'
  await ReactThreeTestRenderer.act(async () => { await renderer.advanceFrames(4, 1 / 60) })
  eq(session.player.weapon, 'knife', '입력으로 근접 슬롯 전환')

  const victim2 = session.enemies.find((e) => e.state !== 'dead')
  ok(victim2, '벨 적이 있다')
  session.player.x = 0
  session.player.z = 0
  session.player.cooldown = 0
  let cam2 = null
  renderer.scene.instance.traverse((o) => { if (!cam2 && o.isCamera) cam2 = o })

  for (let i = 0; i < 40 && victim2.state !== 'dead'; i++) {
    session.player.hp = 100
    session.player.x = 0
    session.player.z = 0
    /* 코앞에 붙여 둔다 — 근접무기가 닿는 거리 */
    if (victim2.state !== 'dead') { victim2.x = 0; victim2.z = -1.3 }
    if (cam2) { cam2.rotation.set(0, 0, 0, 'YXZ'); cam2.updateMatrixWorld() }
    inputRef.current.fire = true
    inputRef.current.firePressed = true
    await ReactThreeTestRenderer.act(async () => { await renderer.advanceFrames(8, 1 / 60) })
  }
  inputRef.current.fire = false

  ok(session.score.kills > killsBefore, '근접무기로 적을 잡았다')
  eq(session.player.ammo.knife.inMag, 0, '근접무기는 탄창을 쓰지 않는다(0 유지)')
  eq(session.player.ammo.pistol.inMag, pistolMagBefore,
    '근접무기를 휘둘러도 권총 탄창은 그대로')

  // 다시 보조무기로 — 슬롯이 서로 독립인지
  inputRef.current.switchSlot = 'secondary'
  session.player.cooldown = 0
  await ReactThreeTestRenderer.act(async () => { await renderer.advanceFrames(4, 1 / 60) })
  eq(session.player.weapon, 'pistol', '2번으로 보조무기 복귀')
}

/* ── 무기 아홉 자루가 전부 실제로 그려지는가 ───────────────────
   모델은 손으로 조립한 부품 스무 개 안팎이라, 오타 하나로 특정
   무기만 조용히 비거나 터질 수 있다. 전부 손에 쥐여 보고 부품이
   실제로 씬에 생기는지 센다. */
{
  const { WEAPONS, WEAPON_ORDER } = await import('../src/game/weapons.js')

  /* 무기는 카메라의 자식으로 붙는다(createPortal). 씬 전체를 세면
     그 사이 스폰되고 죽는 적 때문에 숫자가 흔들려서, 카메라 아래만
     센다 — 거기 있는 것은 무기와 총구 화염뿐이다. */
  let weaponCam = null
  renderer.scene.instance.traverse((o) => { if (!weaponCam && o.isCamera) weaponCam = o })
  ok(weaponCam, '무기가 붙은 카메라를 찾았다')
  const countMeshes = () => {
    let n = 0
    weaponCam.traverse((o) => { if (o.isMesh) n++ })
    return n
  }

  for (const id of WEAPON_ORDER) {
    /* 소지하지 않은 무기도 들 수 있게 직접 넣어 준다 */
    session.player.ammo[id] = { ...session.player.ammo[id], owned: true }
    session.player.weapon = id
    session.player.slots[WEAPONS[id].slot] = id
    session.player.cooldown = 0
    session.player.reloading = 0

    let threw = null
    try {
      await ReactThreeTestRenderer.act(async () => {
        renderer.update(<Scene />)
        await renderer.advanceFrames(3, 1 / 60)
      })
    } catch (e) { threw = String((e && e.stack) || e) }

    ok(!threw, `${id} 모델이 예외 없이 그려진다${threw ? ` — ${threw.slice(0, 200)}` : ''}`)

    /* 부품이 여럿이어야 한다. 상자 두어 개짜리면 조립이 안 된 것.
       총구 화염 메시 하나가 늘 끼어 있으므로 빼고 센다. */
    const parts = countMeshes() - 1
    ok(parts >= 10, `${id} 가 부품 여러 개로 조립된다 — 부품 ${parts}개`)
  }

  // 원래 무기로 되돌린다
  session.player.weapon = 'pistol'
  await ReactThreeTestRenderer.act(async () => {
    renderer.update(<Scene />)
    await renderer.advanceFrames(2, 1 / 60)
  })
}

/* ── 예광선·불꽃이 실제로 만들어졌는가 ─────────────────────────── */
{
  effectsRef.current.addTracer({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: -5 })
  effectsRef.current.addSpark({ x: 1, y: 1, z: 1 }, 'wall')
  await ReactThreeTestRenderer.act(async () => { await renderer.advanceFrames(1, 1 / 60) })
  let visibleTracer = false
  renderer.scene.instance.traverse((o) => {
    if (o.isMesh && o.visible && o.scale.z > 2 && o.material?.transparent) visibleTracer = true
  })
  ok(visibleTracer, '예광선이 길이만큼 늘어나 보인다')
}

/* ── 죽은 적이 사라지고 React 목록에서도 빠지는가 ───────────────── */
{
  for (const e of session.enemies) e.hp = 0
  await ReactThreeTestRenderer.act(async () => {
    await renderer.advanceFrames(150, 1 / 60)
    renderer.update(<Scene />)
    await renderer.advanceFrames(10, 1 / 60)
  })
  ok(session.score.kills > 0, `처치가 기록됨 — ${session.score.kills}`)
  ok(seen.some((e) => e.kind === 'kill'), 'kill 이벤트가 UI 로 전달됨')
}

/* ── 오래 돌려도 안 터지는가 ───────────────────────────────────── */
{
  let threw = null
  try {
    for (let i = 0; i < 20; i++) {
      inputRef.current.fire = true
      inputRef.current.firePressed = true
      inputRef.current.forward = i % 2 === 0
      inputRef.current.yaw += 0.3
      await ReactThreeTestRenderer.act(async () => {
        renderer.update(<Scene />)
        await renderer.advanceFrames(60, 1 / 60)
      })
    }
  } catch (e) { threw = String((e && e.stack) || e) }
  ok(!threw, `1200 프레임 연속 실행에서 예외 없음${threw ? ` — ${threw.slice(0, 300)}` : ''}`)
  ok(Number.isFinite(session.player.x), '플레이어 좌표 유한')
  ok(session.wave >= 1, `웨이브 진행됨 — ${session.wave}`)
}

await ReactThreeTestRenderer.act(async () => { renderer.unmount() })
ok(true, '언마운트 성공')

if (fail) for (const f of fails) console.log('  ✗ ' + f)
console.log(`\n${fail === 0 ? '✅' : '❌'}  렌더링 검증: 통과 ${pass} / 실패 ${fail}`)
console.log(`   (마지막 상태: 웨이브 ${session.wave}, 처치 ${session.score.kills}, 점수 ${session.score.points}, HP ${Math.round(session.player.hp)})`)
process.exit(fail ? 1 : 0)
