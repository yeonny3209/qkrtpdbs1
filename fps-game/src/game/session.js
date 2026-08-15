/* ==================================================================
   한 판 (session)

   지금까지의 조각들(플레이어·적·무기·웨이브·점수)을 하나로 묶어
   "한 판"을 굴린다. 화면과 소리는 여기서 만들지 않는다 — 대신 이번
   프레임에 무슨 일이 있었는지 events 로 돌려주고, 그리는 쪽이 그걸
   보고 총구 화염을 띄우거나 소리를 낸다.

   앞의 파일들과 달리 세션 객체는 제자리에서 고친다. 적 20마리 × 60fps
   로 매 프레임 통째로 새 객체를 만들면 쓰레기 수집이 눈에 띄게
   걸리기 때문이다. 대신 안에서 부르는 규칙 함수들은 그대로 순수하다 —
   바뀌는 것은 이 그릇 하나뿐이라 어디서 무엇이 변했는지 추적할 수 있다.
   ================================================================== */
import { ALL_BOXES, PLAYER_START, PICKUP_SPOTS } from './arena.js'
import {
  initialPlayer, movePlayer, tickReload, canFire, consumeShot, startReload,
  switchWeapon, cycleWeapon, hurtPlayer, grantPickup, aimDir, eyeOf, PLAYER,
} from './player.js'
import { WEAPONS } from './weapons.js'
import { fireShot } from './combat.js'
import {
  makeEnemy, tickEnemy, damageEnemy, shouldRemove, ENEMY_TYPES, resetEnemyIds,
} from './enemies.js'
import { spawnSchedule, waveScaling, pickupsForWave, WAVE_BREAK } from './waveSpawner.js'
import {
  initialScore, recordKill, recordWaveClear, tickScore, loadBest, saveBest,
} from './score.js'
import { makeRng } from './rng.js'

/* 첫 웨이브 전 준비 시간. 조작이 처음인 사람이 둘러보고 마우스
   감도를 느껴 볼 짬은 있어야 한다. */
const READY_TIME = 3.5

/* 한 프레임에 허용할 최대 시간.

   탭을 다른 데 두었다 돌아오면 dt 가 몇 초씩 들어온다. 그대로 쓰면
   적이 벽을 건너뛰어 순간이동하고, 그 한 프레임에 맞아 죽는다.
   느려지는 편이 낫다. */
const MAX_DT = 1 / 20

export function createSession(seed = Date.now()) {
  resetEnemyIds()
  return {
    phase: 'ready',        // ready → wave ⇄ break → over
    wave: 0,
    timer: READY_TIME,
    schedule: [],
    spawned: 0,
    waveT: 0,
    player: initialPlayer(PLAYER_START.x, PLAYER_START.z),
    enemies: [],
    pickups: [],
    score: initialScore(),
    best: loadBest(),
    rng: makeRng(seed),
    boxes: ALL_BOXES,
    time: 0,
    /* 처치 수와 스폰 수를 따로 센다. 웨이브가 끝났는지 판단할 때
       "살아있는 적이 0" 만 보면, 아직 안 나온 적이 남았는데 넘어간다. */
    aliveCount: 0,
  }
}

function beginWave(s, events) {
  s.wave += 1
  s.phase = 'wave'
  s.waveT = 0
  s.spawned = 0
  s.schedule = spawnSchedule(s.wave, s.rng)

  /* 보급은 웨이브 시작과 함께 놓인다. 자리는 매번 다르게 골라
     같은 곳만 도는 습관이 안 생기게 한다. */
  for (const p of pickupsForWave(s.wave)) {
    const spot = PICKUP_SPOTS[Math.floor(s.rng() * PICKUP_SPOTS.length)]
    const jitter = () => (s.rng() - 0.5) * 1.6
    s.pickups.push({
      id: `p${s.wave}-${s.pickups.length}`,
      ...p,
      x: spot.x + jitter(),
      z: spot.z + jitter(),
      born: s.time,
    })
  }
  events.push({ type: 'waveStart', wave: s.wave })
}

export function stepSession(s, input, dtRaw) {
  const events = []
  if (s.phase === 'over') return events

  const dt = Math.min(dtRaw, MAX_DT)
  s.time += dt

  // ── 시점 ──────────────────────────────────────────────────────
  if (typeof input.yaw === 'number') s.player.yaw = input.yaw
  if (typeof input.pitch === 'number') s.player.pitch = input.pitch

  // ── 플레이어 ──────────────────────────────────────────────────
  s.player = movePlayer(s.player, input, dt, s.boxes)
  s.player = tickReload(s.player, dt)

  if (input.reload) s.player = startReload(s.player)
  if (input.switchTo) s.player = switchWeapon(s.player, input.switchTo)
  if (input.cycle) s.player = cycleWeapon(s.player, input.cycle)

  // ── 사격 ──────────────────────────────────────────────────────
  const weapon = WEAPONS[s.player.weapon]
  const wantsFire = weapon.auto ? input.fire : input.firePressed
  if (wantsFire && canFire(s.player)) {
    const origin = { x: s.player.x, y: eyeOf(s.player), z: s.player.z }
    const dir = aimDir(s.player)
    const alive = s.enemies.filter((e) => e.state !== 'dead')
    const res = fireShot(weapon, origin, dir, alive, s.boxes, s.rng)

    for (const d of res.damages) {
      const i = s.enemies.findIndex((e) => e.id === d.enemy.id)
      if (i < 0) continue
      s.enemies[i] = damageEnemy(s.enemies[i], d.damage)
      /* 죽은 뒤 점수를 줄 때 머리를 맞았는지 알아야 하는데, 죽음은
         다음 프레임에 처리된다. 마지막 타격이 헤드샷이었는지 여기
         적어 두는 게 죽음 처리 경로를 늘리는 것보다 낫다. */
      s.enemies[i].lastHitHead = d.isHeadshot
      events.push({
        type: 'hit',
        point: d.enemy,
        isHeadshot: d.isHeadshot,
        damage: d.damage,
        lethal: s.enemies[i].hp <= 0,
      })
    }
    for (const h of res.hits) {
      if (h.kind === 'wall') events.push({ type: 'impact', point: h.point })
    }
    s.player = consumeShot(s.player)

    /* 예광선이 끝날 지점들. 아무것도 못 맞힌 알은 착탄점이 없으므로
       사거리 끝까지 그린다 — 허공에 쐈을 때 화면에 아무 일도 안
       일어나면 방아쇠가 먹었는지조차 알 수 없다. */
    const ends = res.hits.map((h) => h.point)
    if (ends.length === 0) {
      ends.push({
        x: origin.x + dir.x * weapon.range,
        y: origin.y + dir.y * weapon.range,
        z: origin.z + dir.z * weapon.range,
      })
    }
    events.push({ type: 'shot', weapon: weapon.id, origin, dir, ends })
  }

  // ── 적 ────────────────────────────────────────────────────────
  const ctx = {
    player: { x: s.player.x, y: s.player.y, z: s.player.z, eyeY: eyeOf(s.player) },
    boxes: s.boxes,
    rng: s.rng,
  }
  const next = []
  let alive = 0
  for (const e of s.enemies) {
    const r = tickEnemy(e, ctx, dt)

    for (const ev of r.events) {
      if (ev.type === 'died') {
        const t = ENEMY_TYPES[ev.enemy.type]
        s.score = recordKill(s.score, ev.enemy.type, ev.enemy.lastHitHead === true, t.score)
        events.push({ type: 'kill', enemy: ev.enemy, gained: s.score.lastGain })
      } else if (ev.type === 'melee' || ev.type === 'shoot') {
        events.push({ type: 'enemyAttack', enemy: ev.enemy, ranged: ev.type === 'shoot' })
        if (ev.damage > 0) {
          const dx = s.player.x - ev.enemy.x
          const dz = s.player.z - ev.enemy.z
          const len = Math.hypot(dx, dz) || 1
          const hr = hurtPlayer(
            s.player, ev.damage, { x: dx / len, z: dz / len }, ev.knockback || 0,
          )
          s.player = hr.player
          if (!hr.blocked) {
            events.push({ type: 'playerHurt', damage: ev.damage, from: ev.enemy })
            if (hr.died) {
              s.phase = 'over'
              s.best = saveBest(s.score.points, s.wave)
              events.push({ type: 'gameOver', points: s.score.points, wave: s.wave })
            }
          }
        }
      }
    }

    if (!shouldRemove(r.enemy)) {
      next.push(r.enemy)
      if (r.enemy.state !== 'dead') alive++
    }
  }
  s.enemies = next
  s.aliveCount = alive

  if (s.phase === 'over') return events

  // ── 보급 줍기 ─────────────────────────────────────────────────
  const PICKUP_RADIUS = 1.5
  s.pickups = s.pickups.filter((p) => {
    const d = Math.hypot(p.x - s.player.x, p.z - s.player.z)
    if (d > PICKUP_RADIUS) return true
    s.player = grantPickup(s.player, p)
    events.push({ type: 'pickup', pickup: p })
    return false
  })

  // ── 웨이브 진행 ───────────────────────────────────────────────
  s.score = tickScore(s.score, dt)

  if (s.phase === 'ready' || s.phase === 'break') {
    s.timer -= dt
    if (s.timer <= 0) beginWave(s, events)
  } else if (s.phase === 'wave') {
    s.waveT += dt
    while (s.spawned < s.schedule.length && s.schedule[s.spawned].at <= s.waveT) {
      const item = s.schedule[s.spawned++]
      const scale = waveScaling(s.wave)
      const e = makeEnemy(item.type, item.point.x, item.point.z)
      e.hp = Math.round(e.hp * scale.hp)
      e.maxHp = e.hp
      e.speedScale = scale.speed
      s.enemies.push(e)
      events.push({ type: 'spawn', enemy: e })
    }

    /* 다 나왔고 다 죽었을 때만 넘어간다 */
    if (s.spawned >= s.schedule.length && alive === 0) {
      s.score = recordWaveClear(s.score, s.wave)
      s.phase = 'break'
      s.timer = WAVE_BREAK
      s.best = saveBest(s.score.points, s.wave)
      events.push({ type: 'waveClear', wave: s.wave })
    }
  }

  return events
}

/* HUD 가 필요로 하는 것만 뽑는다. 매 프레임 React 상태를 통째로
   갈아끼우면 화면 전체가 다시 그려지므로, 바뀐 숫자 몇 개만 넘긴다. */
export function hudSnapshot(s) {
  const w = WEAPONS[s.player.weapon]
  const ammo = s.player.ammo[s.player.weapon]
  return {
    hp: Math.round(s.player.hp),
    maxHp: PLAYER.maxHp,
    weapon: w.id,
    weaponName: w.name,
    weaponIcon: w.icon,
    inMag: ammo.inMag,
    reserve: ammo.reserve,
    reloading: s.player.reloading > 0,
    reloadPct: s.player.reloading > 0 ? 1 - s.player.reloading / w.reload : 1,
    owned: Object.fromEntries(Object.entries(s.player.ammo).map(([k, v]) => [k, v.owned])),
    wave: s.wave,
    phase: s.phase,
    timer: Math.max(0, s.timer),
    remaining: s.aliveCount + Math.max(0, s.schedule.length - s.spawned),
    points: s.score.points,
    kills: s.score.kills,
    combo: s.score.combo,
    comboT: s.score.comboT,
    best: s.best,
  }
}
