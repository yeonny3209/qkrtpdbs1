/* ==================================================================
   습격 (§13)

   4일마다 온다. **밤에 할 일이 생긴다**는 것이 이 시스템의 전부다.
   거미만 있으면 밤은 100% 도피인데, 약탈자는 죽일 수 있으므로 밤이
   전투가 된다.

   예고를 세 번 한다(§13.1) — 아침, 낮 170초, 밤 시작. 준비할 시간을
   주지 않으면 습격은 난이도가 아니라 사고다.

   ── 실패 페널티가 이 게임에서 가장 무섭다

   아침까지 한 마리라도 남으면 화력 감소가 2배가 된다. Lv6 은 초당 3이
   6이 되어 4분 만에 무너진다. §부록B-6 이 "죽음의 나선에 빠질 수
   있다"고 의심하는 부분이라, 배율은 JSON 한 줄로 빼 두었다.

   ── 습격 중에도 거미는 온다 (§13.5)

   약탈자에게 밀려 안전반경 밖으로 나가면 그대로 즉사다. 그래서 벽이
   "안 뚫리게" 뿐 아니라 "안 밀리게"도 중요해진다.
   ================================================================== */
import { BALANCE, CAMPFIRE } from '../data/index.ts'
import type { GameState } from '../core/GameState.ts'
import { toast, banner } from '../core/GameState.ts'
import { spawnRaider, ringPosition } from '../entities/Raider.ts'

const R = BALANCE.raid

export function raidStride(s: GameState): number {
  return s.modifier.effects.raidEveryDays ?? R.everyDays
}

/** 오늘 밤 습격인가 */
export function isRaidDay(s: GameState): boolean {
  return s.day >= s.raid.nextDay
}

/** 몇 번째 습격인가 (1부터) */
export function raidNumber(s: GameState): number {
  return s.raid.wave + 1
}

export function waveFor(n: number) {
  let chosen = R.waves[0]
  for (const w of R.waves) {
    if (n >= w.from) chosen = w
  }
  return chosen
}

/** 아침에 한 번 — 오늘 밤 온다고 알린다 */
export function announceMorning(s: GameState): void {
  if (!isRaidDay(s) || s.raid.announced) return
  s.raid.announced = true
  banner(s, '사악한 무언가가 캠프로 다가오고 있습니다… 오늘 밤 도착합니다.', 5)
  s.events.push('raidWarn')
}

/** 낮 170초 — 두 번째 예고 */
export function announceDusk(s: GameState): void {
  if (!isRaidDay(s)) return
  toast(s, '오늘 밤 습격당합니다. 캠프파이어로 돌아가십시오.', 'danger')
}

/** 밤 시작 — 실제 스폰 */
export function beginNight(s: GameState): void {
  if (!isRaidDay(s)) return
  const n = raidNumber(s)
  const w = waveFor(n)
  const list: string[] = []
  for (let i = 0; i < w.axe; i++) list.push('raider_axe')
  for (let i = 0; i < w.spear; i++) list.push('raider_spear')
  for (let i = 0; i < w.bow; i++) list.push('raider_bow')
  for (let i = 0; i < w.giant; i++) list.push('raider_giant')

  const rng = s.streams.raid
  const jitter = rng() * Math.PI * 2
  list.forEach((type, i) => {
    const p = ringPosition(i, list.length, R.spawnRadius, jitter)
    spawnRaider(s, type, p.x, p.z)
  })

  s.raid.active = true
  banner(s, '정체불명의 무리가 당신의 불빛을 향해 옵니다…', 4)
  s.events.push('raidStart')
}

/** 일출 — 살아남은 놈이 있으면 페널티(§13.3) */
export function resolveMorning(s: GameState): void {
  if (!s.raid.active) return
  s.raid.active = false
  s.raid.announced = false
  s.raid.wave++
  s.raid.nextDay = s.day + raidStride(s)

  if (s.raiders.length > 0) {
    s.raid.failed = true
    s.campfire.drainMultiplier = CAMPFIRE.raidFailMultiplier
    banner(s, '일부 약탈자가 아직 불 근처에 남아 있습니다.', 5)
    toast(s, '캠프파이어 감소 속도 2배 — 다음 습격까지 지속', 'danger')
    s.events.push('raidFailed')
    /* 남은 놈들은 낮에도 계속 캠프를 노린다 */
  } else if (s.raid.failed) {
    /* 다음 습격을 막아 내면 페널티가 풀린다. 죽음의 나선에서
       빠져나올 길을 하나는 남겨 둔다(§부록B-6). */
    s.raid.failed = false
    s.campfire.drainMultiplier = 1
    toast(s, '약탈자를 전멸시켰습니다 — 화력 감소가 정상으로 돌아옵니다', 'good')
    s.events.push('raidCleared')
  } else {
    s.events.push('raidCleared')
  }
}

/** 전초기지 클리어 — 적색 보급함 확정(§9) */
export function clearOutpost(s: GameState, outpostId: number): boolean {
  const o = s.outposts.find((x) => x.id === outpostId)
  if (!o || o.cleared) return false
  o.cleared = true
  s.caches.push({ id: s.nextId++, x: o.x, z: o.z, tier: 'red', opened: false })
  toast(s, '전초기지 제압 — 적색 보급함이 나타났습니다', 'good')
  s.events.push('outpostCleared')
  return true
}
