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
import { getMap, pickMap } from './maps.js'
import { surfaceHeightAt } from './collide.js'
import {
  initialPlayer, movePlayer, tickReload, canFire, consumeShot, startReload,
  switchSlot, cycleWeapon, hurtPlayer, grantPickup, aimDir, eyeOf, PLAYER,
  tickTrigger, resetTrigger,
} from './player.js'
import {
  WEAPONS, WEAPONS_BY_SLOT, SLOTS, SLOT_LABEL,
  chargeMultiplier, fireMode, normalizeLoadout, DEFAULT_LOADOUT,
} from './weapons.js'
import { getDifficulty, combinedScaling, DEFAULT_DIFFICULTY } from './difficulty.js'
import { fireShot } from './combat.js'
import {
  makeEnemy, tickEnemy, damageEnemy, shouldRemove, ENEMY_TYPES, resetEnemyIds,
} from './enemies.js'
import { spawnSchedule, waveScaling, pickupsForWave, WAVE_BREAK } from './waveSpawner.js'
import {
  initialScore, recordKill, recordWaveClear, tickScore, loadBest, saveBest,
} from './score.js'
import { makeRng } from './rng.js'
import { buildNav, navField, navDir, navCol } from './navgrid.js'

/* 첫 웨이브 전 준비 시간. 조작이 처음인 사람이 둘러보고 마우스
   감도를 느껴 볼 짬은 있어야 한다. */
const READY_TIME = 3.5

/* 한 프레임에 허용할 최대 시간.

   탭을 다른 데 두었다 돌아오면 dt 가 몇 초씩 들어온다. 그대로 쓰면
   적이 벽을 건너뛰어 순간이동하고, 그 한 프레임에 맞아 죽는다.
   느려지는 편이 낫다. */
const MAX_DT = 1 / 20

export function createSession(seed = Date.now(), opts = {}) {
  resetEnemyIds()
  const diff = getDifficulty(opts.difficulty || DEFAULT_DIFFICULTY)
  const loadout = normalizeLoadout(opts.loadout || DEFAULT_LOADOUT)
  /* 맵은 세션의 난수로 뽑는다 — 같은 씨앗이면 같은 맵이 나와서
     실패한 판을 그대로 재현할 수 있다. 이름을 주면 그것을 쓴다. */
  const rng = makeRng(seed)
  const map = opts.map ? getMap(opts.map) : pickMap(rng)
  return {
    difficulty: diff,
    loadout,
    map,
    phase: 'ready',        // ready → wave ⇄ break → over
    wave: 0,
    timer: READY_TIME,
    schedule: [],
    spawned: 0,
    waveT: 0,
    /* 시작 자리에 단이 있으면 그 위에서 시작한다. 안 그러면 탑
       한가운데에서 지형 속에 파묻힌 채로 판이 열린다. */
    player: (() => {
      const p = initialPlayer(map.playerStart.x, map.playerStart.z, { loadout, regenMul: diff.regen })
      p.y = surfaceHeightAt(map.playerStart.x, map.playerStart.z, PLAYER.radius, map.boxes)
      return p
    })(),
    enemies: [],
    pickups: [],
    score: initialScore(),
    best: loadBest(),
    rng,
    boxes: map.boxes,
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
  s.schedule = spawnSchedule(s.wave, s.rng, s.map.spawns)

  /* 보급은 웨이브 시작과 함께 놓인다. 자리는 매번 다르게 골라
     같은 곳만 도는 습관이 안 생기게 한다. */
  for (const p of pickupsForWave(s.wave)) {
    const spots = s.map.pickups
    const spot = spots[Math.floor(s.rng() * spots.length)]
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

/* 길찾기 거리밭 관리.

   밭은 플레이어 자리에서 퍼져 나온다. 매 프레임 다시 깔 필요는 없다 —
   플레이어가 1미터 칸을 옮겼을 때만 다시 계산하면 된다. 900칸 다익스트라를
   초당 몇 번 도는 셈이라, 적 한 마리가 상자 목록을 한 번 훑는 것보다 싸다.

   몸 굵기마다 지나갈 수 있는 자리가 달라서 격자도 굵기별로 따로 깐다.
   종류는 셋뿐이고 맵이 바뀌지 않으니 판 처음에 한 번만 만든다. */
function refreshNav(s) {
  if (!s.nav) {
    s.nav = { byRadius: new Map(), cell: -1 }
    for (const t of Object.values(ENEMY_TYPES)) {
      if (s.nav.byRadius.has(t.radius)) continue
      s.nav.byRadius.set(t.radius, { grid: buildNav(s.map, t.radius), field: null })
    }
  }
  const cell = navCol(s.player.z) * 1000 + navCol(s.player.x)
  if (cell === s.nav.cell) return
  s.nav.cell = cell
  for (const n of s.nav.byRadius.values()) {
    n.field = navField(n.grid, s.player.x, s.player.z)
  }
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
  if (input.switchSlot) s.player = switchSlot(s.player, input.switchSlot)
  if (input.cycle) s.player = cycleWeapon(s.player, input.cycle)

  // ── 사격 ──────────────────────────────────────────────────────
  const weapon = WEAPONS[s.player.weapon]

  /* 차지 무기는 "놓는 순간"에 나간다. 그런데 tickTrigger 가 손을
     뗀 프레임에 charging 을 먼저 꺼 버리므로, 갱신 전에 붙잡아 둬야
     한다. 안 그러면 다 모아 놓고 놓아도 영영 안 나간다 — 방아쇠를
     당길 수 없는 총이 된다. */
  const wasCharging = s.player.charging
  const heldCharge = s.player.charge

  /* 방아쇠를 잡고 있는 동안 자라는 값(예열·차지)을 갱신한다.
     쏠지 말지 정하기 전에 해야, 이번 프레임의 회전수로 이번 발이
     나간다. */
  s.player = tickTrigger(s.player, !!input.fire, dt)

  /* 이번 프레임에 몇 발이 나가는지, 배율은 얼마인지 정한다.
     방아쇠 방식이 다섯이라 여기서 한 번에 갈라 둔다. */
  let shots = 0
  let damageMul = 1

  if (weapon.burst) {
    /* 점사 — 누르는 순간 발수를 채워 두고, 쿨다운마다 한 발씩
       내보낸다. 마지막 발 뒤에는 더 길게 쉰다. */
    if (input.firePressed && s.player.burstLeft <= 0 && canFire(s.player)) {
      s.player = { ...s.player, burstLeft: weapon.burst }
    }
    if (s.player.burstLeft > 0 && canFire(s.player)) shots = 1
  } else if (weapon.charge) {
    /* 차지 — 놓는 순간에 나간다. 조금밖에 못 모았으면 안 나가고
       모은 것도 버린다(살짝 스친 클릭으로 아까운 탄을 안 쓰게). */
    const released = wasCharging && !input.fire
    if (released) {
      if (heldCharge >= weapon.chargeMin && canFire(s.player)) {
        shots = 1
        damageMul = chargeMultiplier(weapon, heldCharge)
      }
      s.player = { ...s.player, charge: 0, charging: false }
    }
  } else {
    const wantsFire = weapon.auto ? input.fire : input.firePressed
    if (wantsFire && canFire(s.player)) shots = 1
  }

  if (shots > 0) {
    const origin = { x: s.player.x, y: eyeOf(s.player), z: s.player.z }
    const dir = aimDir(s.player)
    const alive = s.enemies.filter((e) => e.state !== 'dead')
    /* 차지 배율은 무기 수치를 통째로 복사하지 않고 피해만 올린다 */
    const fired = damageMul === 1 ? weapon : { ...weapon, damage: weapon.damage * damageMul }
    const res = fireShot(fired, origin, dir, alive, s.boxes, s.rng)

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
        melee: !!weapon.melee,
        damage: d.damage,
        lethal: s.enemies[i].hp <= 0,
      })
    }
    for (const h of res.hits) {
      if (h.kind === 'wall') events.push({ type: 'impact', point: h.point })
    }
    s.player = consumeShot(s.player)

    /* 점사 — 한 발 썼으니 남은 발수를 줄이고, 다 나갔으면 길게 쉰다.
       consumeShot 이 넣은 쿨다운(rpm 기준)은 점사 안의 간격이므로
       여기서 덮어써야 "세 발 → 쉼"의 박자가 생긴다. */
    if (weapon.burst) {
      const left = s.player.burstLeft - 1
      s.player = {
        ...s.player,
        burstLeft: Math.max(0, left),
        cooldown: left > 0 ? weapon.burstGap : weapon.burstRest,
      }
    }

    /* 예광선이 끝날 지점들. 아무것도 못 맞힌 알은 착탄점이 없으므로
       사거리 끝까지 그린다 — 허공에 쐈을 때 화면에 아무 일도 안
       일어나면 방아쇠가 먹었는지조차 알 수 없다.

       근접무기는 예광선을 안 그린다. 총알이 나가지 않으니 그릴 것도
       없고, 칼끝에서 빛줄기가 뻗으면 무기가 뭔지 헷갈린다. */
    const ends = []
    if (!weapon.melee) {
      for (const h of res.hits) ends.push(h.point)
      if (ends.length === 0) {
        ends.push({
          x: origin.x + dir.x * weapon.range,
          y: origin.y + dir.y * weapon.range,
          z: origin.z + dir.z * weapon.range,
        })
      }
    }
    events.push({
      type: 'shot', weapon: weapon.id, melee: !!weapon.melee,
      charged: damageMul > 1 ? damageMul : 0,
      origin, dir, ends,
    })
  }

  // ── 적 ────────────────────────────────────────────────────────
  refreshNav(s)

  const ctx = {
    player: { x: s.player.x, y: s.player.y, z: s.player.z, eyeY: eyeOf(s.player) },
    boxes: s.boxes,
    rng: s.rng,
    /* 길찾기가 있으면 적이 물어본다. 돌아가야 할 때만 답이 온다. */
    navDir: (x, z, radius, feetY) => {
      const n = s.nav.byRadius.get(radius)
      return n ? navDir(n.grid, n.field, x, z, s.player.x, s.player.z, feetY) : null
    },
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
              s.player = resetTrigger(s.player)
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
      /* 웨이브 배율과 난이도 배율을 합쳐 태어날 때 한 번만 새긴다.
         매 프레임 곱하면 난이도를 바꿀 수 없는 값들(이미 깎인 체력)이
         뒤늦게 흔들린다. */
      const scale = combinedScaling(waveScaling(s.wave), s.difficulty)
      const e = makeEnemy(item.type, item.point.x, item.point.z)
      /* 통로 위 스폰 지점이면 그 위에서 태어난다. 안 그러면 지형
         속에 파묻힌 채로 생겨나 밀어내기가 엉뚱한 곳으로 밀어낸다. */
      e.y = surfaceHeightAt(e.x, e.z, ENEMY_TYPES[item.type].radius, s.boxes)
      e.hp = Math.max(1, Math.round(e.hp * scale.hp))
      e.maxHp = e.hp
      e.speedScale = scale.speed
      e.dmgScale = scale.damage
      e.accScale = scale.accuracy
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
    slot: w.slot,
    noAmmo: !!w.noAmmo,
    fireMode: fireMode(w),
    /* 방아쇠가 모으고 있는 것들 — HUD 가 게이지로 보여준다 */
    spin: w.spinUp ? s.player.spin : 0,
    charge: w.charge ? s.player.charge : 0,
    charging: !!s.player.charging,
    burstLeft: w.burst ? s.player.burstLeft : 0,
    difficulty: { id: s.difficulty.id, name: s.difficulty.name, color: s.difficulty.color },
    mapName: s.map.name,
    inMag: ammo.inMag,
    reserve: ammo.reserve,
    reloading: s.player.reloading > 0,
    reloadPct: s.player.reloading > 0 && w.reload > 0
      ? 1 - s.player.reloading / w.reload
      : 1,
    /* 슬롯마다 어떤 무기가 들어 있는지 — HUD 가 1·2·3 자리를 그린다 */
    slots: SLOTS.map((slot) => {
      const held = s.player.slots[slot]
      const anyOwned = (WEAPONS_BY_SLOT[slot] || []).some((id) => s.player.ammo[id]?.owned)
      return {
        slot,
        label: SLOT_LABEL[slot],
        weapon: held,
        icon: held ? WEAPONS[held].icon : null,
        owned: anyOwned,
        active: w.slot === slot,
      }
    }),
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
