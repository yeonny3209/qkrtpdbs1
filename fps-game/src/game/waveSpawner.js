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
import { intOf } from './rng.js'

export const MAX_CRAWLERS = 18
export const MAX_TROOPERS = 10
export const MAX_BRUTES = 5

/* n 번째 웨이브의 구성.

   처음보다 완만하게 낮췄다. 예전 곡선은 3웨이브에 이미 15마리,
   5웨이브에 24마리였는데, 무기가 소총 하나뿐인 시점에 감당할 수
   있는 양이 아니었다. 지금은 같은 자리에서 8마리, 16마리다.

   종류가 나오는 시점도 한 칸씩 미뤘다. 트루퍼는 3웨이브, 브루트는
   4웨이브 — 새 적을 하나씩 익힐 틈을 준다. */
export function waveComposition(n) {
  const w = Math.max(1, Math.floor(n))
  return {
    crawler: Math.min(3 + Math.floor(w * 1.5), MAX_CRAWLERS),
    trooper: w >= 3 ? Math.min(Math.floor((w - 2) * 1.5), MAX_TROOPERS) : 0,
    brute: w >= 4 ? Math.min(Math.floor((w - 3) / 2) + 1, MAX_BRUTES) : 0,
  }
}

export function waveTotal(n) {
  const c = waveComposition(n)
  return c.crawler + c.trooper + c.brute
}

/* 개체수 상한에 걸린 뒤로도 난이도가 오르게 하는 배율.
   초반에는 순수하게 수로만 늘고, 수가 상한에 닿은 뒤에 붙는다.

   속도 배율 상한.

   가장 빠른 적(크롤러 4.3)이 이 배율을 받아도 플레이어 이동(5.2)보다
   느려야 한다. 4.3 × 1.18 = 5.07. 적이 더 빨라지는 순간 "물러나며
   쏘기"가 통하지 않게 되고, 그러면 후반이 어려워지는 게 아니라
   대응할 방법 자체가 사라진다. 이 관계는 테스트가 지킨다. */
export const MAX_SPEED_SCALE = 1.18

export function waveScaling(n) {
  /* 배율이 붙기 시작하는 웨이브를 9 → 12 로 미뤘고 증가폭도 줄였다.
     개체수 상한에 닿기도 전에 체력까지 붇던 것이, 중반부터 갑자기
     안 죽는 느낌의 원인이었다. */
  const over = Math.max(0, n - 12)
  return {
    hp: 1 + over * 0.09,
    speed: Math.min(MAX_SPEED_SCALE, 1 + over * 0.015),
  }
}

/* 스폰 일정 — 한꺼번에 쏟아내지 않고 시간에 흩는다.

   전부 동시에 나오면 첫 몇 초가 지나면 할 일이 없고, 그 몇 초 안에
   죽거나 안 죽거나로 끝난다. 나눠 보내면 웨이브 내내 압박이 유지된다.

   같은 지점에서 연달아 나오지 않게 직전 지점을 피한다 — 한 곳만
   보고 있으면 되는 상황을 막는다.

   스폰 지점은 맵마다 다르므로 인자로 받는다. 예전처럼 모듈 상수를
   쓰면 맵을 바꿔도 적이 늘 같은 자리에서 나온다 — 벽 속에서. */
export function spawnSchedule(n, rng, spawnPoints) {
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
  const gap = Math.max(0.38, 1.25 - n * 0.04)

  const points = spawnPoints
  let last = -1
  return queue.map((type, i) => {
    let idx = intOf(rng, points.length)
    if (idx === last && points.length > 1) {
      idx = (idx + 1 + intOf(rng, points.length - 1)) % points.length
    }
    last = idx
    return { type, at: i * gap, spawnIndex: idx, point: points[idx] }
  })
}

/* 웨이브 사이 쉬는 시간 */
export const WAVE_BREAK = 7.0

/* 보급품.

   무기는 더 이상 떨어지지 않는다 — 로비에서 세 자루를 골라 들고
   들어오기 때문이다. 웨이브 도중에 다른 총이 굴러다니면 "고른다"는
   행위가 두 군데로 쪼개져서, 로비에서 한 선택이 가벼워진다.

   대신 탄약이 더 자주 나온다. 고른 무기로 끝까지 가야 하니, 탄이
   마르는 것이 실력이 아니라 운이 되면 안 된다. */
export function pickupsForWave(n) {
  const out = []
  if (n >= 2) out.push({ kind: 'ammo' })
  if (n >= 4 && n % 2 === 0) out.push({ kind: 'ammo' })   // 후반엔 두 개씩
  if (n >= 3 && n % 3 === 0) out.push({ kind: 'health' })
  return out
}
