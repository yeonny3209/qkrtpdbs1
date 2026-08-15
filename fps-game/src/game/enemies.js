/* ==================================================================
   적과 그 머릿속

   상태 기계는 순수 함수다. tickEnemy 는 적 하나와 주변 상황을 받아
   "다음 순간의 적"과 "이번에 일어난 일"을 돌려준다. 화면도 소리도
   여기서 건드리지 않는다 — 그래야 "체력을 0으로 만들면 정말 죽는가"
   같은 걸 브라우저 없이 확인할 수 있다.

   상태: spawning → chasing ⇄ attacking → dead
   ================================================================== */
import { resolveMove, hasLineOfSight } from './collide.js'
import { hash32 } from './rng.js'

export const ENEMY_TYPES = {
  crawler: {
    id: 'crawler',
    name: '크롤러',
    hp: 30,
    speed: 4.3,           // 플레이어 기본 이동(5.2)보다 느리다. 뒷걸음질로
    radius: 0.45,          // 떼어낼 수는 있지만 여유는 없다.
    height: 1.05,
    damage: 7,
    attackRange: 1.9,
    attackCooldown: 0.75,
    ranged: false,
    score: 10,
    color: '#e0533f',
    spawnTime: 0.45,
  },
  trooper: {
    id: 'trooper',
    name: '트루퍼',
    hp: 60,
    speed: 2.7,
    radius: 0.42,
    height: 1.85,
    damage: 9,
    attackRange: 22,
    attackCooldown: 1.9,
    ranged: true,
    accuracy: 0.42,        // 이 확률로만 맞는다. 원거리 적이 백발백중이면
    score: 20,             // 엄폐물 뒤에서 나올 이유가 없어진다.
    color: '#d9a441',
    spawnTime: 0.6,
    /* 사거리에 들어와도 조금 더 붙는다. 22유닛 밖에서 멈춰 서면
       맵 반대편 점처럼 보여서 쏘는 재미가 없다. */
    preferredRange: 13,
  },
  brute: {
    id: 'brute',
    name: '브루트',
    hp: 150,
    speed: 1.75,
    radius: 0.82,
    height: 2.45,
    damage: 24,
    attackRange: 2.8,
    attackCooldown: 1.7,
    ranged: false,
    knockback: 7,
    score: 40,
    color: '#8b3fd4',
    spawnTime: 0.9,
  },
}

let nextId = 1
export function resetEnemyIds() { nextId = 1 }

export function makeEnemy(type, x, z) {
  const t = ENEMY_TYPES[type]
  return {
    id: `e${nextId++}`,
    type,
    x, z,
    hp: t.hp,
    maxHp: t.hp,
    state: 'spawning',
    stateT: 0,          // 현재 상태에 머문 시간
    cooldown: 0,        // 다음 공격까지
    facing: 0,          // 바라보는 방향(라디안) — 렌더링이 쓴다
    hitFlash: 0,        // 맞은 직후 잠깐 밝아지는 연출용
    age: 0,
    avoidSide: 0,       // 벽을 돌아갈 때 정한 방향(+1/-1)
    avoidT: 0,          // 그 방향을 유지할 남은 시간
  }
}

/* 막혔을 때 어느 쪽으로 돌지. 적마다 고정이라 두 마리가 같은 기둥에
   붙어도 서로 반대로 갈라진다 — 매 프레임 무작위로 고르면 제자리에서
   덜덜 떨기만 한다. */
function sidePreference(id) {
  return hash32(id) % 2 === 0 ? 1 : -1
}

/* 길이 트인 뒤에도 우회 방향을 기억하는 시간. 모서리를 돌 때
   한두 프레임 트였다 다시 막히는 구간에서 방향이 뒤집히지 않게
   붙잡아 둔다. 이 시간이 지나도록 트여 있으면 그때 잊는다. */
const AVOID_MEMORY = 0.4

const ATTACK_EXIT_SLACK = 1.18   // 사거리 경계에서 상태가 깜빡이지 않게

/* 적 하나의 한 프레임.

   반환: { enemy, events }
   events 는 이번 프레임에 벌어진 일 — 공격했다, 죽었다 등.
   호출자가 이걸 보고 소리를 내거나 점수를 준다. */
export function tickEnemy(enemy, ctx, dt) {
  const t = ENEMY_TYPES[enemy.type]
  const events = []
  const e = { ...enemy }

  e.age += dt
  e.stateT += dt
  e.cooldown = Math.max(0, e.cooldown - dt)
  e.hitFlash = Math.max(0, e.hitFlash - dt * 4)

  if (e.state === 'dead') {
    return { enemy: e, events }
  }

  /* 체력 확인은 다른 무엇보다 먼저. 죽은 프레임에 공격까지 하고
     죽으면, 마지막 한 발로 죽였는데도 피해를 입는다. */
  if (e.hp <= 0) {
    e.hp = 0
    e.state = 'dead'
    e.stateT = 0
    events.push({ type: 'died', enemy: e })
    return { enemy: e, events }
  }

  const dx = ctx.player.x - e.x
  const dz = ctx.player.z - e.z
  const dist = Math.hypot(dx, dz)
  if (dist > 1e-4) e.facing = Math.atan2(dx, dz)

  if (e.state === 'spawning') {
    if (e.stateT >= t.spawnTime) {
      e.state = 'chasing'
      e.stateT = 0
    }
    return { enemy: e, events }
  }

  /* 원거리 적은 벽 너머로는 못 쏜다. 시야가 막히면 사거리 안이라도
     계속 접근한다 — 엄폐물이 실제로 몸을 가려 줘야 의미가 있다.

     시선을 눈높이가 아니라 몸 한가운데에서 낸다. 플레이어가 겨누는
     지점이 바로 거기이기 때문이다. 눈높이로 재면 "나는 보이는데 너는
     나를 못 맞히는" 자리가 생긴다 — 모서리 너머에서 머리만 내민
     트루퍼가 그렇다. 그러면 플레이어는 반격할 방법이 없는데 계속
     맞고, 적은 그 자리에서 나올 이유가 없어 교착이 된다.

     같은 두 점을 잇는 같은 선분을 양쪽이 쓰게 하면 그런 자리가
     아예 안 생긴다. */
  const centerY = t.height * 0.5
  const canSee = t.ranged
    ? hasLineOfSight(e.x, centerY, e.z, ctx.player.x, ctx.player.eyeY, ctx.player.z, ctx.boxes)
    : true

  const inRange = dist <= t.attackRange && canSee

  if (e.state === 'chasing') {
    if (inRange) {
      e.state = 'attacking'
      e.stateT = 0
    }
  } else if (e.state === 'attacking') {
    if (dist > t.attackRange * ATTACK_EXIT_SLACK || !canSee) {
      e.state = 'chasing'
      e.stateT = 0
    }
  }

  /* 이동 — 공격 중이라도 원거리 적은 선호 거리까지 좁히거나 벌린다 */
  let moveScale = 0
  if (e.state === 'chasing') {
    moveScale = 1
  } else if (e.state === 'attacking' && t.ranged) {
    /* 멀면 다가오되, 가까워도 물러나지 않는다.

       한때는 너무 붙으면 뒷걸음질하게 했는데, 뒤가 엄폐물이면
       그 안으로 파고들어 자리를 잡아 버린다. 트루퍼는 저격수가
       아니라 화력 지원이다. 코앞까지 붙은 트루퍼가 쉬운 표적인 건
       의도한 대가이고, 그 대가를 물리는 건 크롤러의 몫이다. */
    if (dist > t.preferredRange * 1.15) moveScale = 0.7
  }

  if (moveScale !== 0 && dist > 1e-4) {
    /* speedScale 은 후반 웨이브에서 붙는 배율이다. 없으면 1 —
       테스트나 단독 호출에서 굳이 채워 넣지 않아도 되게 한다. */
    const step = t.speed * (e.speedScale || 1) * Math.abs(moveScale) * dt
    const sign = Math.sign(moveScale)
    let mx = (dx / dist) * step * sign
    let mz = (dz / dist) * step * sign

    const moved = resolveMove(e.x, e.z, mx, mz, t.radius, ctx.boxes)

    /* "얼마나 갔나"는 간 거리가 아니라 가려던 방향으로 간 거리다.

       총 이동량으로 재면 벽이 밀어낸 것까지 전진으로 친다. 벽에
       몸이 살짝 파묻힌 적은 매 프레임 앞으로 조금 가고 벽에 뒤로
       더 밀리는데, 총 이동량은 0 이 아니라서 "잘 가고 있다"고
       읽힌다. 그래서 우회가 영영 안 걸리고 제자리에서 떤다.

       가려던 방향에 투영하면 그 경우 값이 음수가 되어 바로 잡힌다. */
    const ux = mx / step
    const uz = mz / step
    const gained = (moved.x - e.x) * ux + (moved.z - e.z) * uz
    const blocked = gained < step * 0.4

    /* 벽에 막혔을 때 — 한쪽 방향을 정해 "한동안 그쪽으로만" 돈다.

       처음엔 매 프레임 좌우를 다 재보고 플레이어에게 더 가까워지는
       쪽을 골랐다. 그러면 벽에 붙어 제자리걸음을 한다. 벽을 따라
       옆으로 가는 건 당장은 플레이어에서 멀어지는 일이라, 한 걸음
       가자마자 "되돌아가는 게 더 가깝다"는 판단이 나오기 때문이다.
       벽의 가장 가까운 지점이 그대로 함정이 된다.

       그래서 한번 막히면 방향을 정하고 avoidT 동안 유지한다. 눈앞이
       트이면 바로 그만두므로, 필요한 만큼만 돈다. 이게 벽 따라가기
       (wall following) 의 최소 형태다.

       A* 격자를 깔 수도 있지만, 기둥 몇 개짜리 아레나에서 이걸로
       충분하다는 걸 "모든 스폰 지점에서 중앙까지 도달하는가" 테스트가
       지킨다. 그게 깨지면 그때 길찾기를 들이면 된다. */
    if (!blocked) {
      /* 길이 트였다. 다만 방향 기억은 곧바로 지우지 않는다 —
         벽 모서리를 돌 때 한두 프레임 트였다가 다시 막히는 일이
         흔한데, 그때마다 방향을 새로 고르면 모서리에서 덜덜 떤다. */
      e.avoidT = Math.max(0, e.avoidT - dt)
      if (e.avoidT <= 0) e.avoidSide = 0
      e.x = moved.x
      e.z = moved.z
    } else {
      const baseAng = Math.atan2(mz, mx)

      /* 막혀 있는 동안에는 처음 정한 방향을 절대 바꾸지 않는다.

         한때는 막힐 때마다 "좌우 중 더 많이 나아가는 쪽"을 다시
         골랐는데, 그러면 벽을 반쯤 돌다가 되돌아온다. 뒤쪽은 늘
         트여 있어서 언제 다시 재도 뒤가 이기기 때문이다. 결국
         벽 앞을 왔다 갔다 하며 영영 도착하지 못한다.

         방향은 "새로 막혔을 때" 한 번만 고른다. 그 뒤로는 트일
         때까지 밀고 간다. */
      if (e.avoidSide === 0) {
        const side = sidePreference(e.id)
        let bestGain = -1
        let bestSide = side
        for (const s of [side, -side]) {
          const a = baseAng + 1.15 * s
          const cand = resolveMove(
            e.x, e.z, Math.cos(a) * step, Math.sin(a) * step, t.radius, ctx.boxes,
          )
          const gain = (cand.x - e.x) * Math.cos(a) + (cand.z - e.z) * Math.sin(a)
          if (gain > bestGain + 1e-6) { bestGain = gain; bestSide = s }
        }
        e.avoidSide = bestSide
      }
      e.avoidT = AVOID_MEMORY

      /* 정한 쪽으로 돌되, 각도를 키워 가며 뚫리는 첫 방향을 쓴다 */
      let done = false
      for (const off of [1.15, 1.6, 2.1, 2.6]) {
        const a = baseAng + off * e.avoidSide
        const cand = resolveMove(
          e.x, e.z, Math.cos(a) * step, Math.sin(a) * step, t.radius, ctx.boxes,
        )
        const got = (cand.x - e.x) * Math.cos(a) + (cand.z - e.z) * Math.sin(a)
        if (got >= step * 0.4) {
          e.x = cand.x
          e.z = cand.z
          done = true
          break
        }
      }
      /* 어느 쪽으로도 못 가면 완전히 낀 것이다. 반대쪽을 다시
         고르도록 기억을 지운다. MIN_GAP 을 지키는 한 안 나오는
         경우지만, 배치를 고치다 실수했을 때 영구히 멈추는 것보다는
         낫다. */
      if (!done) {
        e.avoidSide = -e.avoidSide || 0
        e.x = moved.x
        e.z = moved.z
      }
    }
  }

  /* 공격 */
  if (e.state === 'attacking' && e.cooldown <= 0) {
    e.cooldown = t.attackCooldown
    if (t.ranged) {
      const hit = ctx.rng() < t.accuracy
      events.push({ type: 'shoot', enemy: e, damage: hit ? t.damage : 0, hit })
    } else {
      events.push({ type: 'melee', enemy: e, damage: t.damage, knockback: t.knockback || 0 })
    }
  }

  return { enemy: e, events }
}

/* 피해 적용 — 죽는 순간은 다음 tick 에서 처리한다.
   여기서 바로 dead 로 보내면, 죽음 처리 경로가 두 군데로 갈라진다. */
export function damageEnemy(enemy, amount) {
  if (enemy.state === 'dead') return enemy
  return { ...enemy, hp: Math.max(0, enemy.hp - amount), hitFlash: 1 }
}

/* 시체가 사라지기까지. 바로 지우면 뭘 죽였는지 볼 새가 없다. */
export const CORPSE_LINGER = 1.1

export function shouldRemove(enemy) {
  return enemy.state === 'dead' && enemy.stateT >= CORPSE_LINGER
}
