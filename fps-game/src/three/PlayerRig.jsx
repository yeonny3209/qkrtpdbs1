/* ==================================================================
   플레이어 장치 — 시뮬레이션과 화면이 만나는 곳

   매 프레임 하는 일은 넷이다.
     1. 카메라가 어디를 보는지 읽어 세션에 넣는다
     2. 세션을 dt 만큼 굴린다
     3. 카메라를 플레이어 눈 위치로 옮긴다
     4. 이번에 벌어진 일(events)을 소리와 연출로 옮긴다

   순서가 중요하다. 세션을 굴리기 전에 시점을 넣어야 이번 프레임의
   조준으로 총알이 나간다. 한 프레임 늦으면 빠르게 휘두르며 쏠 때
   조준점과 실제 탄착이 눈에 띄게 어긋난다.
   ================================================================== */
import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { stepSession, hudSnapshot } from '../game/session.js'
import { eyeOf, canFire } from '../game/player.js'
import { consumeEdges } from '../hooks/useInput.js'
import { sfx } from '../audio.js'

/* HUD 를 매 프레임 갱신할 이유가 없다. 숫자가 초당 열 몇 번 바뀌면
   사람 눈에는 실시간이고, React 는 훨씬 덜 일한다. */
const HUD_INTERVAL = 1 / 14

export default function PlayerRig({
  sessionRef, inputRef, effectsRef, flashRef, onHud, onEnemies, onEvent, runningRef,
}) {
  const camera = useThree((s) => s.camera)
  const hudT = useRef(0)
  const idsKey = useRef('')
  const shake = useRef(0)
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const muzzle = useRef(new THREE.Vector3())
  const basis = useRef({ right: new THREE.Vector3(), up: new THREE.Vector3(), fwd: new THREE.Vector3() })

  useEffect(() => {
    const s = sessionRef.current
    if (s) camera.position.set(s.player.x, eyeOf(s.player), s.player.z)
  }, [camera, sessionRef])

  useFrame((state, dt) => {
    const s = sessionRef.current
    const input = inputRef.current
    if (!s || !input) return

    if (!runningRef.current) {
      /* 멈춰 있는 동안에도 카메라는 제자리를 지켜야 한다. 안 그러면
         일시정지를 풀 때 화면이 튄다. */
      camera.position.set(s.player.x, eyeOf(s.player), s.player.z)
      return
    }

    // ① 시점 읽기 — PointerLockControls 가 돌려놓은 카메라에서
    euler.current.setFromQuaternion(camera.quaternion, 'YXZ')
    input.yaw = euler.current.y
    input.pitch = euler.current.x

    // 빈 총 딸깍 — 쏘려 했는데 못 쏘고, 재장전 중도 아니라면
    const ammoNow = s.player.ammo[s.player.weapon]
    if (input.firePressed && !canFire(s.player) && s.player.reloading <= 0 && ammoNow.inMag <= 0) {
      sfx.empty()
    }

    // ② 굴리기
    const events = stepSession(s, input, dt)
    consumeEdges(input)

    // ③ 카메라를 눈 위치로
    shake.current = Math.max(0, shake.current - dt * 3.2)
    const sh = shake.current
    camera.position.set(
      s.player.x + (Math.random() - 0.5) * sh * 0.22,
      eyeOf(s.player) + (Math.random() - 0.5) * sh * 0.22,
      s.player.z + (Math.random() - 0.5) * sh * 0.22,
    )

    // ④ 일어난 일을 소리와 연출로
    const fx = effectsRef.current
    basis.current.fwd.set(0, 0, -1).applyQuaternion(camera.quaternion)
    basis.current.right.set(1, 0, 0).applyQuaternion(camera.quaternion)
    basis.current.up.set(0, 1, 0).applyQuaternion(camera.quaternion)

    for (const ev of events) {
      if (ev.type === 'shot') {
        sfx.shot(ev.weapon)
        if (!ev.melee) {
          flashRef.current.t = 0.055
          flashRef.current.seed = Math.random() * Math.PI
        }
        shake.current = Math.min(
          1,
          shake.current + (ev.melee ? 0.12 : ev.weapon === 'shotgun' ? 0.5 : 0.22),
        )

        /* 예광선은 총구에서 나가야 한다. 화면 한가운데(카메라)에서
           그으면 눈에서 빔이 나가는 것처럼 보인다. */
        muzzle.current.copy(camera.position)
          .addScaledVector(basis.current.fwd, 0.55)
          .addScaledVector(basis.current.right, 0.22)
          .addScaledVector(basis.current.up, -0.16)
        for (const end of ev.ends) fx.addTracer(muzzle.current, end)
      } else if (ev.type === 'hit') {
        if (ev.melee) sfx.meleeHit()
        else sfx.hit(ev.isHeadshot)
        fx.addSpark(ev.point, 'flesh')
        onEvent({ kind: 'hitmarker', headshot: ev.isHeadshot, lethal: ev.lethal })
      } else if (ev.type === 'impact') {
        fx.addSpark(ev.point, 'wall')
      } else if (ev.type === 'kill') {
        sfx.kill()
        onEvent({ kind: 'kill', gained: ev.gained, type: ev.enemy.type })
      } else if (ev.type === 'playerHurt') {
        sfx.hurt()
        shake.current = 1
        onEvent({ kind: 'hurt', damage: ev.damage })
      } else if (ev.type === 'enemyAttack' && ev.ranged) {
        sfx.enemyShot()
      } else if (ev.type === 'pickup') {
        sfx.pickup()
        onEvent({ kind: 'pickup', pickup: ev.pickup })
      } else if (ev.type === 'waveStart') {
        sfx.waveStart(ev.wave)
        onEvent({ kind: 'waveStart', wave: ev.wave })
      } else if (ev.type === 'waveClear') {
        sfx.waveClear()
        onEvent({ kind: 'waveClear', wave: ev.wave })
      } else if (ev.type === 'gameOver') {
        sfx.gameOver()
        onEvent({ kind: 'gameOver', points: ev.points, wave: ev.wave })
      }
    }

    // 적 목록이 바뀐 때만 React 에 알린다
    const key = s.enemies.map((e) => e.id).join(',')
    if (key !== idsKey.current) {
      idsKey.current = key
      onEnemies(s.enemies.map((e) => e.id))
    }

    // HUD
    hudT.current += dt
    if (hudT.current >= HUD_INTERVAL) {
      hudT.current = 0
      onHud(hudSnapshot(s))
    }
  })

  return null
}
