/* ==================================================================
   웨이브

   난이도 곡선이 이 게임의 전부다. 승리 조건이 없으니 "몇 웨이브까지
   버텼나"가 곧 점수인데, 곡선이 어느 지점에서 갑자기 튀면 실력이
   아니라 그 지점이 점수를 정해 버린다. 그래서 구성은 웨이브 번호에
   대해 단조증가하고, 각 종류는 상한에서 멈춘다.

   상한을 두는 이유는 실용적이다. 적이 무한히 늘면 언젠가 프레임이
   떨어져서, 게임이 어려워지는 게 아니라 컴퓨터가 느려질 뿐이다.
   대신 웨이브가 오르면 체력·속도 배율이 붙어 계속 빡빡해진다.
   ================================================================== */
import { SPAWN_POINTS } from './arena.js'
import { intOf } from './rng.js'

export const MAX_CRAWLERS = 20
export const MAX_TROOPERS = 12
export const MAX_BRUTES = 6

/* n 번째 웨이브의 구성 */
export function waveComposition(n) {
  const w = Math.max(1, Math.floor(n))
  return {
    crawler: Math.min(4 + w * 2, MAX_CRAWLERS),
    trooper: w >= 2 ? Math.min((w - 1) * 2, MAX_TROOPERS) : 0,
    brute: w >= 3 ? Math.min(Math.floor((w - 2) / 2) + 1, MAX_BRUTES) : 0,
  }
}

export function waveTotal(n) {
  const c = waveComposition(n)
  return c.crawler + c.trooper + c.brute
}

/* 개체수 상한에 걸린 뒤로도 난이도가 오르게 하는 배율.
   10 웨이브부터 서서히 붙어서, 초반에는 순수하게 수로만 는다. */
/* 속도 배율 상한.

   가장 빠른 적(크롤러 4.3)이 이 배율을 받아도 플레이어 이동(5.2)보다
   느려야 한다. 4.3 × 1.18 = 5.07. 적이 더 빨라지는 순간 "물러나며
   쏘기"가 통하지 않게 되고, 그러면 후반이 어려워지는 게 아니라
   대응할 방법 자체가 사라진다. 이 관계는 테스트가 지킨다. */
export const MAX_SPEED_SCALE = 1.18

export function waveScaling(n) {
  const over = Math.max(0, n - 9)
  return {
    hp: 1 + over * 0.12,
    speed: Math.min(MAX_SPEED_SCALE, 1 + over * 0.02),
  }
}

/* 스폰 일정 — 한꺼번에 쏟아내지 않고 시간에 흩는다.

   전부 동시에 나오면 첫 몇 초가 지나면 할 일이 없고, 그 몇 초 안에
   죽거나 안 죽거나로 끝난다. 나눠 보내면 웨이브 내내 압박이 유지된다.

   같은 지점에서 연달아 나오지 않게 직전 지점을 피한다 — 한 곳만
   보고 있으면 되는 상황을 막는다. */
export function spawnSchedule(n, rng) {
  const comp = waveComposition(n)
  const queue = []

  /* 브루트를 먼저, 크롤러를 나중에 섞는다. 느린 놈이 먼저 출발해야
     비슷한 시점에 도착해서 교전이 한 번에 몰린다. */
  for (let i = 0; i < comp.brute; i++) queue.push('brute')
  for (let i = 0; i < comp.trooper; i++) queue.push('trooper')
  for (let i = 0; i < comp.crawler; i++) queue.push('crawler')

  // 종류가 뭉치지 않게 섞되, 씨앗을 받아 재현 가능하게
  for (let i = queue.length - 1; i > 0; i--) {
    const j = intOf(rng, i + 1)
    ;[queue[i], queue[j]] = [queue[j], queue[i]]
  }

  /* 웨이브가 커질수록 간격을 좁힌다. 안 그러면 후반 웨이브가
     길어지기만 하고 밀도는 그대로다. */
  const gap = Math.max(0.28, 1.15 - n * 0.045)

  let last = -1
  return queue.map((type, i) => {
    let idx = intOf(rng, SPAWN_POINTS.length)
    if (idx === last && SPAWN_POINTS.length > 1) {
      idx = (idx + 1 + intOf(rng, SPAWN_POINTS.length - 1)) % SPAWN_POINTS.length
    }
    last = idx
    return { type, at: i * gap, spawnIndex: idx, point: SPAWN_POINTS[idx] }
  })
}

/* 웨이브 사이 쉬는 시간 */
export const WAVE_BREAK = 5.0

/* 무기가 풀리는 순서.

   한 웨이브에 하나씩만 준다. 몰아 주면 고르는 재미가 없고, 무엇이
   달라졌는지도 모른 채 지나간다. 순서는 "쓰기 쉬운 것부터, 판을
   뒤집는 것은 나중에"다 — 저격총과 경기관총이 3웨이브에 나오면
   그 뒤로는 다른 무기를 쥘 이유가 없어진다.

   슬롯을 번갈아 채워서, 한동안 주무기만 늘거나 근접만 늘지 않게 한다. */
export const WEAPON_UNLOCKS = {
  2: 'rifle',      // 주무기 — 첫 화력
  3: 'smg',        // 보조   — 근거리 속사
  4: 'shotgun',    // 주무기 — 코앞 해결책
  5: 'axe',        // 근접   — 브루트가 늘어날 즈음
  6: 'magnum',     // 보조   — 한 방의 무게
  8: 'lmg',        // 주무기 — 무리가 커질 때
  10: 'sniper',    // 주무기 — 판을 정리하는 한 발
}

export function pickupsForWave(n) {
  const out = []
  const unlock = WEAPON_UNLOCKS[n]
  if (unlock) out.push({ kind: 'weapon', weapon: unlock })

  /* 그 뒤로는 탄약이 계속 나와야 한다. 안 나오면 후반에 권총만
     남아서, 실력과 무관하게 벽에 부딪힌다. */
  if (n >= 2 && n % 2 === 0) out.push({ kind: 'ammo' })
  if (n >= 3 && n % 3 === 0) out.push({ kind: 'health' })
  return out
}
