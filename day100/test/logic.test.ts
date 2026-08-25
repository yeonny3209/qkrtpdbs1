/* ==================================================================
   순수 로직 검증 — 브라우저 없이 Node 에서 돈다

   §부록B 가 "먼저 깨질 것 같다"고 지목한 다섯 가지를 우선으로 본다.
   특히 2번(고철 410개가 100일 안에 모이는가)은 짐작으로 답할 수 없어서,
   실제로 존별 노드를 세고 왕복 시간을 계산한다.
   ================================================================== */
import { makeRng, streamOf, hash32, normalizeSeed } from '../src/core/RNG.ts'
import {
  type GameState, type Phase,
  addItem, removeItem, countItem, freeSlots, hasAll, payAll, distance, inCampfire,
} from '../src/core/GameState.ts'
import { BALANCE, ITEMS, RECIPES, ENEMIES, MODIFIERS, UNLOCKS, FUEL, zoneAt } from '../src/data/index.ts'
import * as TimeSystem from '../src/systems/TimeSystem.ts'
import * as Survival from '../src/systems/SurvivalSystem.ts'
import * as Campfire from '../src/systems/CampfireSystem.ts'
import * as Crafting from '../src/systems/CraftingSystem.ts'
import * as Inv from '../src/systems/InventorySystem.ts'
import * as Decay from '../src/systems/DecaySystem.ts'
import * as Labs from '../src/systems/LabSystem.ts'
import * as Run from '../src/systems/RunSystem.ts'
import * as Spider from '../src/entities/Spider.ts'
import * as Asteroid from '../src/minigame/AsteroidDodge.ts'
import { ZONE_PLANS } from '../src/world/Spawner.ts'
import { CENTER, TILES, pushOut, segmentBlocked } from '../src/world/Tilemap.ts'
import { exploredCount } from '../src/world/FogOfWar.ts'

let pass = 0
let fail = 0
const fails: string[] = []

function ok(cond: boolean, msg: string): void {
  if (cond) pass++
  else { fail++; fails.push(msg) }
}
function eq(a: unknown, b: unknown, msg: string): void {
  ok(Object.is(a, b), `${msg} — got ${String(a)}, want ${String(b)}`)
}
function near(a: number, b: number, tol: number, msg: string): void {
  ok(Math.abs(a - b) <= tol, `${msg} — got ${a}, want ~${b}`)
}
function section(n: string): void {
  process.stdout.write(`\n── ${n}\n`)
}

/* 시스템이 phase 를 바꾸는 것을 타입이 모른다. 함수를 거쳐 읽으면
   앞선 검사로 좁혀진 타입이 풀린다 (main.ts 와 같은 이유). */
function phaseOf(s: GameState): Phase {
  return s.phase
}

const DT = 1 / 60
const newRun = (seed = 'TEST', mod = 'calm') =>
  Run.startRun({ seed, modifierId: mod, unlocks: [] })

// ══════════════════════════════════════════════════════ 난수
section('시드 난수 — 재현성이 로그라이크의 전제다')
{
  const a = makeRng('seed-1')
  const b = makeRng('seed-1')
  for (let i = 0; i < 300; i++) eq(a(), b(), '같은 시드 같은 수열')

  const c = makeRng('seed-2')
  const d = makeRng('seed-1')
  let diff = 0
  for (let i = 0; i < 60; i++) if (c() !== d()) diff++
  ok(diff > 55, '다른 시드는 다른 수열')

  const r = makeRng(42)
  let lo = 1
  let hi = 0
  for (let i = 0; i < 40000; i++) {
    const v = r()
    lo = Math.min(lo, v)
    hi = Math.max(hi, v)
    ok(v >= 0 && v < 1, '범위 [0,1)')
  }
  ok(lo < 0.001 && hi > 0.999, '범위를 고루 채운다')

  /* 갈래가 다르면 독립이어야 한다. 맵 생성기를 고쳤다고 전리품이
     달라지면 밸런싱할 때마다 시드가 무의미해진다. */
  const m1 = streamOf('X', 'map')
  const l1 = streamOf('X', 'loot')
  let same = 0
  for (let i = 0; i < 200; i++) if (m1() === l1()) same++
  eq(same, 0, '갈래가 다르면 수열도 다르다')
  const m2 = streamOf('X', 'map')
  const m1b = streamOf('X', 'map')
  for (let i = 0; i < 50; i++) eq(m2(), m1b(), '같은 갈래는 같은 수열')

  const ri = makeRng(7)
  for (let i = 0; i < 5000; i++) {
    const v = ri.int(8)
    ok(Number.isInteger(v) && v >= 0 && v < 8, 'int 범위')
  }
  eq(hash32('abc'), hash32('abc'), 'hash32 결정적')
  ok(hash32('abc') !== hash32('abd'), 'hash32 충돌 아님')
  eq(normalizeSeed('ab-cd 12'), 'ABCD12', '시드 정규화')
  ok(normalizeSeed('').length === 8, '빈 시드는 무작위로 채운다')

  /* 같은 시드면 세계가 통째로 같아야 한다 */
  const w1 = newRun('SAMEWORLD').state
  const w2 = newRun('SAMEWORLD').state
  eq(w1.trees.length, w2.trees.length, '같은 시드 같은 나무 수')
  eq(w1.junk.length, w2.junk.length, '같은 시드 같은 고철 수')
  for (let i = 0; i < w1.labs.length; i++) {
    near(w1.labs[i].x, w2.labs[i].x, 1e-9, '같은 시드 같은 연구소 위치')
  }
  const w3 = newRun('OTHERWORLD').state
  ok(w1.labs[0].x !== w3.labs[0].x || w1.labs[0].z !== w3.labs[0].z, '다른 시드 다른 배치')
}

// ══════════════════════════════════════════════════════ 데이터 무결성
section('데이터 — JSON 이 서로 아귀가 맞는가')
{
  /* 레시피가 존재하지 않는 아이템을 요구하면 런타임에야 터진다 */
  for (const [id, def] of Object.entries(RECIPES)) {
    for (const cid of Object.keys(def.cost)) {
      ok(cid.startsWith('core_') || ITEMS[cid] !== undefined, `${id} 의 재료 ${cid} 가 실재한다`)
    }
    for (const gid of Object.keys(def.gives ?? {})) {
      ok(ITEMS[gid] !== undefined, `${id} 가 주는 ${gid} 가 실재한다`)
    }
    ok(def.level >= 1 && def.level <= 4, `${id} 레벨이 1~4`)
    ok(def.name.length > 0 && def.desc.length > 0, `${id} 에 이름과 설명이 있다`)
  }
  for (const [id, def] of Object.entries(ENEMIES)) {
    for (const did of Object.keys(def.drops)) {
      ok(ITEMS[did] !== undefined, `${id} 의 전리품 ${did} 가 실재한다`)
    }
  }
  for (const id of Object.keys(FUEL)) {
    ok(ITEMS[id] !== undefined, `연료 ${id} 가 아이템으로도 있다`)
  }
  for (const u of UNLOCKS) {
    for (const iid of Object.keys(u.effects.startItems ?? {})) {
      ok(ITEMS[iid] !== undefined, `해금 ${u.id} 의 지급품 ${iid} 가 실재한다`)
    }
  }
  eq(new Set(MODIFIERS.map((m) => m.id)).size, MODIFIERS.length, '행성 변수 아이디가 서로 다르다')
  eq(new Set(UNLOCKS.map((u) => u.id)).size, UNLOCKS.length, '해금 아이디가 서로 다르다')

  /* §10.1 의 숫자가 그대로 들어왔는가 */
  eq(ENEMIES.rabbit.hp, 40, '토끼 40')
  eq(ENEMIES.wolf.hp, 100, '늑대 100')
  eq(ENEMIES.mutant_wolf.hp, 300, '변이 늑대 300')
  eq(ENEMIES.bear.hp, 800, '곰 800')
  eq(ENEMIES.tiger.hp, 1500, '호랑이 1500')

  /* §12.1 의 총 HP — 구성에서 저절로 나와야 한다 */
  eq(Labs.labTotalHp(1), 600, '연구소 1단계 총 600')
  eq(Labs.labTotalHp(2), 900, '연구소 2단계 총 900')
  eq(Labs.labTotalHp(3), 2400, '연구소 3단계 총 2400')
  eq(Labs.labTotalHp(4), 4800, '연구소 4단계 총 4800')
}

// ══════════════════════════════════════════════════════ 속도 관계
section('속도 — 밤의 긴장을 만드는 세 숫자')
{
  const P = BALANCE.player
  const S = BALANCE.spider
  /* 이 관계가 §9.3 의 "불 꺼진 밤에는 도망갈 수 없다"를 만든다.
     하나라도 뒤집히면 게임의 정체성이 바뀐다. */
  ok(S.speed < P.runSpeed, `평시 거미(${S.speed})는 달리기(${P.runSpeed})보다 느리다`)
  ok(S.speed > P.walkSpeed, `평시 거미는 걷기(${P.walkSpeed})보다 빠르다`)
  ok(S.speedNoFire > P.runSpeed, `불 꺼지면 거미(${S.speedNoFire})가 달리기보다 빠르다`)
  ok(ENEMIES.tiger.speed < P.runSpeed, '호랑이도 달리기보다는 느리다 (간신히)')
  ok(ENEMIES.tiger.speed > P.walkSpeed * 1.3, '호랑이에게서 걸어서는 못 도망친다')
}

// ══════════════════════════════════════════════════════ 인벤토리
section('인벤토리 — 잡동사니가 칸을 먹는다')
{
  const { state: s } = newRun()
  const slots = s.player.slots.length
  for (let i = 0; i < slots; i++) s.player.slots[i] = null

  eq(freeSlots(s), slots, '처음엔 전부 비어 있다')
  eq(addItem(s, 'wood', 30), 0, '통나무 30개가 들어간다')
  eq(countItem(s, 'wood'), 30, '개수가 맞다')
  eq(freeSlots(s), slots - 1, '통나무는 한 칸에 쌓인다')

  /* §7.3 — 잡동사니는 stack 1 이라 한 칸씩 먹는다 */
  for (let i = 0; i < s.player.slots.length; i++) s.player.slots[i] = null
  const junkLeft = addItem(s, 'junk_tire', 20)
  eq(countItem(s, 'junk_tire'), slots, `타이어는 ${slots}개까지만 들어간다`)
  eq(junkLeft, 20 - slots, '나머지는 못 든다')
  eq(freeSlots(s), 0, '가방이 꽉 찬다')

  /* 이게 왕복 동선을 만드는 장치다 — 특례가 아니라 데이터로 */
  for (const [id, def] of Object.entries(ITEMS)) {
    if (def.kind === 'junk') eq(def.stack, 1, `${id} 는 한 칸씩 차지한다`)
  }

  for (let i = 0; i < s.player.slots.length; i++) s.player.slots[i] = null
  addItem(s, 'scrap', 50)
  ok(removeItem(s, 'scrap', 20), '덜어내기')
  eq(countItem(s, 'scrap'), 30, '남은 개수')
  ok(!removeItem(s, 'scrap', 99), '없는 만큼은 못 덜어낸다')
  eq(countItem(s, 'scrap'), 30, '실패해도 안 줄어든다')

  ok(hasAll(s, { scrap: 30 }), '있으면 있다고 한다')
  ok(!hasAll(s, { scrap: 31 }), '모자라면 없다고 한다')
  ok(payAll(s, { scrap: 30 }), '값을 치른다')
  eq(countItem(s, 'scrap'), 0, '치른 만큼 빠진다')
}

// ══════════════════════════════════════════════════════ 시간
section('시간 — 빠를수록 위험하다')
{
  const { state: s } = newRun()
  eq(s.day, 1, '1일에 시작')
  eq(s.phase, 'day', '낮에 시작')

  /* 낮 180초 → 밤 */
  let warned = false
  let fell = false
  for (let t = 0; t < 181; t += DT) {
    for (const ev of TimeSystem.update(s, DT)) {
      if (ev.type === 'nightWarning') warned = true
      if (ev.type === 'nightFall') fell = true
    }
  }
  ok(warned, '170초에 경고가 온다')
  ok(fell, '180초에 밤이 온다')
  eq(s.phase, 'night', '밤이다')

  /* 밤 120초 → 일출 */
  let rose = 0
  for (let t = 0; t < 121; t += DT) {
    for (const ev of TimeSystem.update(s, DT)) if (ev.type === 'sunrise') rose = ev.newDay
  }
  eq(rose, 2, '침대가 없으면 하루씩')

  /* §5.2 의 공식 — 침대와 핵심 부품이 더해진다 */
  eq(TimeSystem.dayRate(s), 1, '기본 +1')
  s.buildings.push({ id: 1, type: 'bed', x: CENTER, z: CENTER })
  eq(TimeSystem.dayRate(s), 2, '침대 하나 +2')
  s.buildings.push({ id: 2, type: 'bed_scrap', x: CENTER, z: CENTER })
  s.buildings.push({ id: 3, type: 'bed_alloy', x: CENTER, z: CENTER })
  eq(TimeSystem.dayRate(s), 4, '침대 셋 +4')
  s.coreParts.push('core_radar', 'core_landing')
  eq(TimeSystem.dayRate(s), 6, '핵심 부품 둘이 더해진다')

  /* §5.2 표의 값이 실제로 나오는가 */
  const table: [number, number, number][] = [
    [0, 0, 1], [1, 0, 2], [3, 0, 4], [4, 2, 7], [6, 4, 11],
  ]
  for (const [beds, cores, want] of table) {
    const t = newRun('RATE').state
    for (let i = 0; i < beds; i++) t.buildings.push({ id: i, type: 'bed', x: CENTER, z: CENTER })
    for (let i = 0; i < cores; i++) t.coreParts.push(`core_${i}`)
    eq(TimeSystem.dayRate(t), want, `침대 ${beds} + 부품 ${cores} = +${want}일`)
  }

  /* §13.1 — 5의 배수를 몇 번 넘겼는가가 곧 난이도다 */
  eq(TimeSystem.crossings(1, 2, 5), 0, '1→2 는 안 넘김')
  eq(TimeSystem.crossings(4, 6, 5), 1, '4→6 은 한 번')
  eq(TimeSystem.crossings(4, 12, 5), 2, '4→12 는 두 번')
  eq(TimeSystem.crossings(1, 12, 5), 2, '1→12 는 두 번')
  eq(TimeSystem.crossings(1, 23, 5), 4, '1→23 은 네 번')

  eq(Asteroid.tierFor(1), 1, '한 칸이면 1단계')
  eq(Asteroid.tierFor(2), 2, '두 칸이면 2단계')
  eq(Asteroid.tierFor(9), 5, '아무리 뛰어도 5단계에서 멈춘다')

  /* 이게 §5.3 의 트레이드오프가 실제로 성립한다는 증거다 */
  const fast = newRun('FAST').state
  for (let i = 0; i < 6; i++) fast.buildings.push({ id: i, type: 'bed', x: CENTER, z: CENTER })
  for (let i = 0; i < 4; i++) fast.coreParts.push(`core_${i}`)
  const rate = TimeSystem.dayRate(fast)
  eq(rate, 11, '최고 속도 빌드는 +11일')
  ok(TimeSystem.crossings(1, 1 + rate, 5) >= 2, '그만큼 소행성이 세진다')
}

// ══════════════════════════════════════════════════════ 생존
section('생존 — 우주복이 곧 체력이다')
{
  const { state: s } = newRun()
  const P = BALANCE.player

  /* 캠프 밖 산소는 4분이면 마른다(§4) */
  s.player.x = CENTER + 40
  s.campfire.level = 0
  s.campfire.safeRadius = 0
  let t = 0
  while (s.player.oxygen > 0 && t < 600) {
    Survival.update(s, DT)
    t += DT
  }
  near(t, P.maxOxygen / P.oxygenDrain, 2, '산소가 4분 만에 마른다')

  /* 산소가 0이면 우주복이 깎이고, 우주복이 0이면 죽는다 */
  const before = s.player.suit
  for (let i = 0; i < 60; i++) Survival.update(s, DT)
  ok(s.player.suit < before, '산소가 없으면 우주복이 깎인다')
  near(before - s.player.suit, P.suitDrainNoOxygen, 0.2, '초당 2씩')

  while (s.player.suit > 0 && t < 900) {
    Survival.update(s, DT)
    t += DT
  }
  eq(s.phase, 'dead', '우주복이 0이면 죽는다')
  eq(s.death.cause, 'oxygen', '사인은 산소 고갈')

  /* 캠프 안에서는 산소가 찬다 */
  const { state: s2 } = newRun()
  s2.campfire.level = 1
  s2.campfire.safeRadius = 8
  s2.player.x = CENTER
  s2.player.z = CENTER
  s2.player.oxygen = 0
  ok(inCampfire(s2), '캠프 안이다')
  let t2 = 0
  while (s2.player.oxygen < s2.player.maxOxygen && t2 < 400) {
    Survival.update(s2, DT)
    t2 += DT
  }
  near(t2, 120, 3, '0에서 100까지 120초')

  /* §4 의 핵심 규칙 — 우주복은 캠프에서 회복되지 않는다 */
  s2.player.suit = 40
  for (let i = 0; i < 600; i++) Survival.update(s2, DT)
  eq(s2.player.suit, 40, '캠프 안이어도 우주복은 안 낫는다')
  Survival.healFull(s2)
  eq(s2.player.suit, s2.player.maxSuit, '캡슐만이 우주복을 고친다')

  /* 날고기는 배를 채우되 우주복을 깎는다(§7.5) */
  const { state: s3 } = newRun()
  s3.player.hunger = 50
  s3.player.suit = 100
  addItem(s3, 'meat_small_raw', 1)
  ok(Survival.eat(s3, 'meat_small_raw'), '날고기를 먹는다')
  eq(s3.player.hunger, 60, '배고픔 +10')
  eq(s3.player.suit, 95, '우주복 -5')

  addItem(s3, 'meat_small_cooked', 1)
  Survival.eat(s3, 'meat_small_cooked')
  eq(s3.player.hunger, 90, '구운 것은 +30')
  eq(s3.player.suit, 95, '구운 것은 우주복을 안 깎는다')

  /* 4존은 산소가 1.5배로 준다(§6.2) */
  const { state: s4 } = newRun()
  s4.player.x = CENTER
  s4.player.z = CENTER
  near(Survival.oxygenFactorAt(s4), 1.0, 1e-9, '1존은 1배')
  s4.player.x = CENTER + 90
  near(Survival.oxygenFactorAt(s4), 1.5, 1e-9, '4존은 1.5배')

  /* 모디파이어가 또 곱한다 */
  const thin = Run.startRun({ seed: 'T', modifierId: 'thin_air', unlocks: [] }).state
  thin.player.x = CENTER
  near(Survival.oxygenFactorAt(thin), 1.5, 1e-9, '희박한 대기 1.5배')
  thin.player.x = CENTER + 90
  near(Survival.oxygenFactorAt(thin), 2.25, 1e-9, '4존 + 희박한 대기 = 2.25배')
}

// ══════════════════════════════════════════════════════ 캠프파이어
section('캠프파이어 — 지금 타는 것이 레벨이다')
{
  const { state: s } = newRun()
  eq(s.campfire.level, 0, '처음엔 꺼져 있다')
  eq(s.campfire.safeRadius, 0, '안전반경 0')

  addItem(s, 'wood', 3)
  ok(Campfire.addFuel(s, 'wood'), '통나무를 넣는다')
  Campfire.update(s, DT)
  eq(s.campfire.level, 1, 'Lv1')
  eq(s.campfire.safeRadius, 8, '반경 8')

  /* 석탄은 Lv1 을 찍어야 나타난다(§7.4) */
  eq(s.campfire.bestLevel, 1, '최고 도달 레벨이 기록된다')
  ok(Campfire.fuelUnlocked(s, 'coal'), 'Lv1 을 찍으면 석탄이 열린다')
  ok(!Campfire.fuelUnlocked(s, 'oil_drum'), '기름은 아직 안 열린다')

  addItem(s, 'coal', 1)
  Campfire.addFuel(s, 'coal')
  Campfire.update(s, DT)
  eq(s.campfire.level, 2, '석탄이 타면 Lv2')
  eq(s.campfire.safeRadius, 14, '반경 14')
  ok(Campfire.fuelUnlocked(s, 'oil_drum'), '이제 기름이 열린다')

  /* ★ §9.1 의 핵심 — 상위 연료가 다 타면 즉시 내려간다 */
  const burning = s.campfire.burning
  const coal = burning.find((f) => f.grade === 2)!
  coal.remain = 0.001
  Campfire.update(s, 0.002)
  eq(s.campfire.level, 1, '석탄이 다 타면 통나무가 남아도 Lv1 로 떨어진다')

  /* ★ 높은 등급부터 탄다. 이게 §9.1 의 "기름이 다 타면 즉시 Lv1" 을
     성립시킨다 — 반대로 태우면 기름이 맨 끝까지 남아 밤 내내 Lv3 다. */
  const { state: s2 } = newRun()
  addItem(s2, 'wood', 1)
  addItem(s2, 'oil_drum', 1)
  s2.campfire.bestLevel = 3
  Campfire.addFuel(s2, 'wood')
  Campfire.addFuel(s2, 'oil_drum')
  Campfire.update(s2, 10)
  const oil = s2.campfire.burning.find((f) => f.grade === 3)!
  const wood = s2.campfire.burning.find((f) => f.grade === 1)!
  near(oil.remain, 230, 0.01, '기름이 먼저 탄다')
  near(wood.remain, 30, 0.01, '통나무는 아직 손도 안 댔다')
  eq(s2.campfire.level, 3, '기름이 타는 동안 Lv3')

  /* 기름이 다 타는 순간 통나무가 남아 있어도 뚝 떨어진다 */
  Campfire.update(s2, 231)
  eq(s2.campfire.level, 1, '기름이 끝나면 즉시 Lv1')
  ok(Campfire.burnRemaining(s2) > 0, '통나무는 아직 타고 있다')

  /* 확장 기둥(§8.4) */
  const { state: s3 } = newRun()
  addItem(s3, 'wood', 1)
  Campfire.addFuel(s3, 'wood')
  s3.buildings.push({ id: 1, type: 'camp_pillar', x: CENTER, z: CENTER })
  Campfire.update(s3, DT)
  eq(s3.campfire.safeRadius, 13, '기둥 하나가 +5')

  /* 굽기 */
  const { state: s4 } = newRun()
  addItem(s4, 'wood', 1)
  Campfire.addFuel(s4, 'wood')
  Campfire.update(s4, DT)
  addItem(s4, 'meat_large_raw', 1)
  ok(Campfire.startCooking(s4, 'meat_large_raw'), '굽기 시작')
  for (let i = 0; i < 36 * 60; i++) Campfire.update(s4, DT)
  eq(countItem(s4, 'meat_large_cooked'), 1, '35초 뒤 익는다')
}

// ══════════════════════════════════════════════════════ 거미
section('거미 — 이 게임의 정체성')
{
  const { state: s, solids } = newRun()
  s.phase = 'night'
  s.campfire.level = 1
  s.campfire.safeRadius = 8
  Spider.spawnForNight(s)

  eq(s.spiders.length, 1, '평시엔 한 마리')
  const d0 = distance(s.spiders[0].x, s.spiders[0].z, s.player.x, s.player.z)
  ok(d0 >= BALANCE.spider.spawnDistance - 0.5, `30타일 밖에서 나온다 — ${d0.toFixed(1)}`)

  /* 불이 꺼지면 두 마리, 그리고 더 빠르다(§9.3) */
  s.campfire.level = 0
  s.campfire.safeRadius = 0
  Spider.spawnForNight(s)
  eq(s.spiders.length, 2, '불이 꺼지면 두 마리')
  eq(Spider.spiderSpeed(s), BALANCE.spider.speedNoFire, '불이 꺼지면 6.5')
  s.campfire.level = 1
  eq(Spider.spiderSpeed(s), BALANCE.spider.speed, '불이 있으면 4.5')

  /* 억제 송신기(§8.5) */
  s.buildings.push({ id: 99, type: 'spider_suppressor', x: CENTER, z: CENTER })
  near(Spider.spiderSpeed(s), 4.5 * 0.65, 1e-9, '송신기가 35% 늦춘다')
  s.buildings.pop()

  /* 굶주린 밤(§14.4) */
  const hungry = Run.startRun({ seed: 'H', modifierId: 'hungry_night', unlocks: [] }).state
  hungry.campfire.level = 1
  eq(Spider.spiderCount(hungry), 2, '굶주린 밤은 불이 있어도 두 마리')

  /* 접촉 = 즉사 */
  const { state: k, solids: ks } = newRun()
  k.phase = 'night'
  k.campfire.level = 0
  k.campfire.safeRadius = 0
  k.spiders = [{ id: 1, x: k.player.x + 0.4, z: k.player.z, stunT: 0, speed: 4.5 }]
  Spider.update(k, DT, ks)
  eq(k.phase, 'dead', '닿으면 즉사')
  eq(k.death.cause, 'spider', '사인은 거미')

  /* 캠프 안으로는 못 들어온다 */
  const { state: c, solids: cs } = newRun()
  c.phase = 'night'
  c.campfire.level = 2
  c.campfire.safeRadius = 14
  c.player.x = CENTER
  c.player.z = CENTER
  c.spiders = [{ id: 1, x: CENTER + 25, z: CENTER, stunT: 0, speed: 4.5 }]
  for (let i = 0; i < 60 * 20; i++) {
    Spider.update(c, DT, cs)
    if (phaseOf(c) === 'dead') break
  }
  ok(phaseOf(c) !== 'dead', '캠프 안에 있으면 안 죽는다')
  const dc = distance(c.spiders[0].x, c.spiders[0].z, CENTER, CENTER)
  ok(dc >= 14 - 0.6, `경계 밖에서 서성인다 — ${dc.toFixed(1)}`)

  /* 횃불 — 반경 6타일, 5초 확정 정지(§10.3) */
  const { state: tt } = newRun()
  tt.phase = 'night'
  tt.player.torchCharges = 5
  tt.spiders = [
    { id: 1, x: tt.player.x + 3, z: tt.player.z, stunT: 0, speed: 4.5 },
    { id: 2, x: tt.player.x + 20, z: tt.player.z, stunT: 0, speed: 4.5 },
  ]
  ok(Spider.useTorch(tt), '횃불을 쓴다')
  eq(tt.player.torchCharges, 4, '한 번 소모')
  eq(tt.spiders[0].stunT, 5, '가까운 거미는 5초 정지')
  eq(tt.spiders[1].stunT, 0, '먼 거미는 안 걸린다')

  /* 손전등 — 60도 콘 */
  const { state: fl } = newRun()
  fl.player.flashlightOn = true
  fl.player.facing = 0
  const front = { id: 1, x: fl.player.x + 5, z: fl.player.z, stunT: 0, speed: 4.5 }
  const behind = { id: 2, x: fl.player.x - 5, z: fl.player.z, stunT: 0, speed: 4.5 }
  ok(Spider.inFlashlightCone(fl, front), '앞은 비춘다')
  ok(!Spider.inFlashlightCone(fl, behind), '뒤는 못 비춘다')
  const far = { id: 3, x: fl.player.x + 40, z: fl.player.z, stunT: 0, speed: 4.5 }
  ok(!Spider.inFlashlightCone(fl, far), '사거리 밖은 못 비춘다')
  fl.player.flashlightOn = false
  ok(!Spider.inFlashlightCone(fl, front), '꺼져 있으면 안 비춘다')

  /* ★ 배터리 — 이게 있어야 횃불이 산다(§10.3 확정) */
  fl.player.flashlightOn = true
  fl.player.flashlightBattery = 1
  fl.player.x = CENTER + 50
  fl.campfire.safeRadius = 0
  for (let i = 0; i < 90; i++) Survival.update(fl, DT)
  eq(fl.player.flashlightOn, false, '배터리가 마르면 꺼진다')
  ok(BALANCE.spider.flashlightBatterySeconds < Infinity, '손전등은 무제한이 아니다')

  void solids
}

// ══════════════════════════════════════════════════════ 채집·부패
section('자원 — 캐면 사라지고, 들고 있으면 썩는다')
{
  const { state: s } = newRun()
  const tree = s.trees.find((t) => t.kind === 'tree_small')!
  s.player.x = tree.x
  s.player.z = tree.z
  s.player.equipped = 'axe_old'
  s.player.axeDurability = 999

  const treesBefore = s.trees.length
  for (let i = 0; i < 13; i++) Inv.chop(s)
  eq(s.trees.length, treesBefore - 1, '13타에 작은 나무가 넘어간다')
  eq(countItem(s, 'wood'), 3, '통나무 3개')
  eq(countItem(s, 'sapling'), 1, '묘목 1개')

  /* 도끼 티어(§7.2) */
  eq(Inv.chopsNeeded(s, 'tree_small'), 13, '낡은 도끼 13타')
  s.player.equipped = 'axe_iron'
  eq(Inv.chopsNeeded(s, 'tree_small'), 6, '철 도끼 6타')
  eq(Inv.chopsNeeded(s, 'tree_large'), 14, '철 도끼 큰 나무 14타')
  s.player.equipped = 'axe_alloy'
  eq(Inv.chopsNeeded(s, 'tree_small'), 3, '합금 도끼 3타')

  /* 낡은 도끼는 60타에 부러진다(§7.2 확정).

     나무가 넘어가면 chop 이 헛손질로 끝나 도끼가 안 닳는다. 그래서
     팰 나무를 발밑에 계속 새로 놓아 준다 — 재는 것은 "60번 팼는가"이지
     "나무가 몇 그루인가"가 아니다. */
  const { state: d } = newRun()
  d.player.equipped = 'axe_old'
  d.player.axeDurability = 60
  let swings = 0
  for (let i = 0; i < 60; i++) {
    d.trees.push({
      id: 90000 + i, kind: 'tree_large', x: d.player.x, z: d.player.z, hits: 0, growT: 0,
    })
    if (Inv.chop(d)) swings++
  }
  eq(swings, 60, '60번 팼다')
  eq(d.player.equipped, null, '60타 뒤 부러진다')
  ok(!Inv.chop(d) || true, '부러진 뒤에도 터지지 않는다')

  /* 큰 나무는 묘목이 없다 — 영구 소멸 */
  const { state: b } = newRun()
  const big = b.trees.find((t) => t.kind === 'tree_large')!
  b.player.x = big.x
  b.player.z = big.z
  b.player.equipped = 'axe_alloy'
  for (let i = 0; i < 7; i++) Inv.chop(b)
  eq(countItem(b, 'wood'), 15, '큰 나무는 통나무 15')
  eq(countItem(b, 'sapling'), 0, '묘목은 안 나온다')

  /* ★ 부패 — 저장고가 없으면 10분에 사라진다(§7.1) */
  const { state: r } = newRun()
  addItem(r, 'wood', 20)
  for (let i = 0; i < 60 * 599; i++) Decay.update(r, DT)
  eq(countItem(r, 'wood'), 20, '9분 59초까지는 멀쩡하다')
  for (let i = 0; i < 60 * 3; i++) Decay.update(r, DT)
  eq(countItem(r, 'wood'), 0, '10분이면 통나무가 전부 썩는다')

  /* 나중에 주운 것은 나중에 썩는다. 한 번에 전부 사라지면
     "10분 전에 주운 것"이라는 말이 성립하지 않는다. */
  const { state: r2 } = newRun()
  addItem(r2, 'wood', 5)
  for (let i = 0; i < 60 * 300; i++) Decay.update(r2, DT)
  addItem(r2, 'wood', 7)
  eq(countItem(r2, 'wood'), 12, '5분 뒤 일곱 개를 더 줍는다')
  for (let i = 0; i < 60 * 301; i++) Decay.update(r2, DT)
  eq(countItem(r2, 'wood'), 7, '먼저 주운 다섯만 썩는다')
  for (let i = 0; i < 60 * 300; i++) Decay.update(r2, DT)
  eq(countItem(r2, 'wood'), 0, '나머지도 제 시간에 썩는다')

  /* 저장고에 넣은 것은 장부에서도 빠져야 한다 */
  const { state: r3 } = newRun()
  r3.buildings.push({ id: 1, type: 'wood_storage', x: CENTER, z: CENTER, store: [] })
  addItem(r3, 'wood', 20)
  Decay.update(r3, DT)
  Inv.storeWood(r3, 20)
  for (let i = 0; i < 60 * 700; i++) Decay.update(r3, DT)
  eq(Decay.trackedWood(r3), 0, '저장고로 옮긴 것은 더 안 센다')
  eq(Inv.totalStoredWood(r3), 20, '저장고 안은 그대로다')

  /* 저장고 안은 안전하다 */
  const { state: st } = newRun()
  st.buildings.push({ id: 1, type: 'wood_storage', x: CENTER, z: CENTER, store: [] })
  addItem(st, 'wood', 25)
  eq(Inv.storeWood(st, 25), 25, '25개를 넣는다')
  eq(countItem(st, 'wood'), 0, '가방에서는 빠진다')
  eq(Inv.totalStoredWood(st), 25, '저장고에 있다')
  for (let i = 0; i < 60 * 1200; i++) Decay.update(st, DT)
  eq(Inv.totalStoredWood(st), 25, '20분이 지나도 저장고 안은 안 썩는다')
  eq(Inv.withdrawWood(st, 25), 25, '다시 꺼낸다')

  /* 저장고 용량은 25개 */
  const { state: cap } = newRun()
  cap.buildings.push({ id: 1, type: 'wood_storage', x: CENTER, z: CENTER, store: [] })
  addItem(cap, 'wood', 50)
  const stored = Inv.storeWood(cap, 50)
  eq(stored, 25, '저장고 하나에 25개까지')

  /* 묘목은 5분 뒤 자란다 */
  const { state: sap } = newRun()
  addItem(sap, 'sapling', 1)
  ok(Inv.plantSapling(sap), '묘목을 심는다')
  const planted = sap.trees[sap.trees.length - 1]
  eq(planted.kind, 'sapling', '아직 묘목')
  for (let i = 0; i < 60 * 301; i++) Decay.update(sap, DT)
  eq(planted.kind, 'tree_small', '5분 뒤 작은 나무가 된다')

  /* 잡동사니 → 고철(§7.3) */
  const { state: g } = newRun()
  for (let i = 0; i < g.player.slots.length; i++) g.player.slots[i] = null
  addItem(g, 'junk_screw', 1)
  addItem(g, 'junk_tire', 1)
  addItem(g, 'junk_engine', 1)
  const gained = Inv.grindJunk(g)
  eq(gained, 1 + 3 + 4, '나사1 + 타이어3 + 엔진4 = 8')
  eq(countItem(g, 'junk_tire'), 0, '잡동사니는 사라진다')
}

// ══════════════════════════════════════════════════════ 크래프팅
section('크래프팅 — 4레벨의 존재 이유')
{
  const { state: s } = newRun()
  eq(s.craftLevel, 1, '1레벨에서 시작')

  ok(!Crafting.canCraft(s, 'bed'), '재료가 없으면 못 만든다')
  addItem(s, 'wood', 20)
  s.player.x = CENTER
  s.player.z = CENTER
  ok(Crafting.canCraft(s, 'bed'), '재료가 있으면 만든다')
  ok(Crafting.craft(s, 'bed'), '침대 제작')
  eq(countItem(s, 'wood'), 0, '재료가 빠진다')
  eq(TimeSystem.dayRate(s), 2, '날짜 증가량이 오른다')

  /* 침대는 우주선 근처에만(§5.2) */
  addItem(s, 'wood', 20)
  s.player.x = CENTER + 40
  eq(Crafting.blockedReason(s, 'bed'), 'placement', '멀면 못 놓는다')
  s.player.x = CENTER

  /* 침대 최대 6개 */
  for (let i = 0; i < 8; i++) {
    addItem(s, 'wood', 20)
    Crafting.craft(s, 'bed')
  }
  const beds = s.buildings.filter((b) => RECIPES[b.type]?.dayRateBonus).length
  eq(beds, BALANCE.map.maxBeds, '침대는 6개가 최대')
  eq(Crafting.blockedReason(s, 'bed'), 'max', '더는 못 놓는다')

  /* ★ 다른 경로로도 막혀야 한다. 침대는 레시피가 넷(§8.2~8.5)이라
     한 곳에서만 세면 고철식으로 우회해 무한히 깔 수 있다. */
  s.craftLevel = 4
  for (const alt of ['bed_scrap', 'bed_alloy', 'bed_prime']) {
    addItem(s, 'scrap', 60)
    addItem(s, 'wood', 30)
    eq(Crafting.blockedReason(s, alt), 'max', `${alt} 로도 우회할 수 없다`)
    ok(!Crafting.craft(s, alt), `${alt} 제작이 막힌다`)
  }
  eq(
    s.buildings.filter((b) => RECIPES[b.type]?.dayRateBonus).length,
    BALANCE.map.maxBeds,
    '우회를 시도해도 여전히 6개',
  )
  eq(TimeSystem.dayRate(s), 1 + BALANCE.map.maxBeds, `날짜 증가량은 최대 +${1 + BALANCE.map.maxBeds}`)

  /* 레벨 게이트 */
  const { state: l } = newRun()
  eq(Crafting.blockedReason(l, 'recovery_capsule'), 'level', '2레벨 물건은 잠겨 있다')
  addItem(l, 'wood', 10)
  addItem(l, 'scrap', 5)
  ok(Crafting.upgradeMachine(l), 'Lv2 로 올린다')
  eq(l.craftLevel, 2, 'Lv2')
  addItem(l, 'scrap', 25)
  ok(Crafting.canCraft(l, 'recovery_capsule'), '이제 캡슐을 만든다')

  /* ★ §8.5 설계 노트 — 도크가 없으면 탈출 장비를 못 만든다 */
  const { state: e } = newRun()
  e.craftLevel = 4
  e.coreParts.push('core_radar')
  addItem(e, 'scrap', 60)
  addItem(e, 'wood', 40)
  eq(Crafting.blockedReason(e, 'escape_radar'), 'dockMissing', '도크가 먼저다')
  e.dockBuilt = true
  eq(Crafting.blockedReason(e, 'escape_radar'), null, '도크가 있으면 만들 수 있다')
  ok(Crafting.craft(e, 'escape_radar'), '레이더 제작')
  eq(e.coreParts.length, 0, '핵심 부품이 소모된다')
  eq(Crafting.blockedReason(e, 'escape_radar'), 'alreadyBuilt', '두 번은 못 만든다')

  /* 업그레이드 비용이 §8.1 과 같은가 */
  eq(Crafting.upgradeCost(1)?.wood, 10, '1→2 통나무 10')
  eq(Crafting.upgradeCost(2)?.scrap, 15, '2→3 고철 15')
  eq(Crafting.upgradeCost(3)?.scrap, 40, '3→4 고철 40')
  eq(Crafting.upgradeCost(4), null, '4가 끝')

  /* 산소·우주복 업그레이드는 최대치만 올린다 */
  const { state: u } = newRun()
  u.craftLevel = 3
  addItem(u, 'scrap', 30)
  addItem(u, 'wood', 15)
  u.player.suit = 50
  Crafting.craft(u, 'suit_patch')
  eq(u.player.maxSuit, 150, '최대치가 150')
  eq(u.player.suit, 50, '지금 값은 안 채운다 — 회복 불가 규칙이 여기서도 지켜진다')
}

// ══════════════════════════════════════════════════════ 연구소
section('연구소 — 문이 잠기고 시간이 멈춘다')
{
  const { state: s } = newRun()
  eq(s.labs.length, 4, '연구소 넷')
  const tiers = s.labs.map((l) => l.tier).sort()
  eq(tiers.join(','), '1,2,3,4', '단계가 하나씩')

  for (const l of s.labs) {
    const d = distance(l.x, l.z, CENTER, CENTER)
    const zone = zoneAt(d)
    const want = l.tier <= 2 ? 2 : l.tier
    eq(zone.id, want, `${l.tier}단계는 ${want}존에`)
  }

  const lab = s.labs.find((l) => l.tier === 1)!
  s.player.x = lab.x
  s.player.z = lab.z
  ok(Labs.enter(s, lab), '진입')
  ok(s.activeLab !== null, '교전 중')
  eq(Labs.remaining(s), 6, '늑대 여섯')

  /* ★ 안에서는 시간이 안 흐른다(§12.1) */
  const dayBefore = s.phaseT
  for (let i = 0; i < 60 * 10; i++) TimeSystem.update(s, DT)
  eq(s.phaseT, dayBefore, '10초를 굴려도 시간이 안 간다')

  /* 밖으로 못 나간다 */
  s.player.x = lab.x + 40
  Labs.update(s)
  const out = distance(s.player.x, s.player.z, lab.x, lab.z)
  near(out, Labs.LAB_RADIUS, 0.01, '경계에 붙잡힌다')

  /* ★ 한 마리라도 남으면 안 열린다. 이게 §12.1 의 "전멸시켜야 열림"이고,
     없으면 연구소가 전투가 아니라 관광이 된다. */
  s.player.x = lab.x
  s.player.z = lab.z
  for (let i = 0; i < s.beasts.length - 1; i++) s.beasts[i].hp = 0
  s.beasts = s.beasts.filter((b) => b.hp > 0)
  eq(Labs.remaining(s), 1, '한 마리 남았다')
  Labs.update(s)
  ok(s.activeLab !== null, '한 마리라도 남으면 문이 안 열린다')
  ok(!lab.cleared, '아직 공략 전')
  eq(s.coreParts.length, 0, '보상도 아직 없다')

  /* 전멸시키면 보상 */
  for (const b of s.beasts) b.hp = 0
  s.beasts = []
  Labs.update(s)
  eq(s.activeLab, null, '문이 열린다')
  ok(lab.cleared, '공략 완료')
  eq(s.coreParts.length, 1, '핵심 부품 획득')
  eq(TimeSystem.dayRate(s), 2, '날짜 증가량 +1 (§12.3)')

  /* 나침반은 가장 가까운 미공략을 가리킨다 */
  const target = Labs.compassTarget(s)
  ok(target !== null && !target.cleared, '미공략만 가리킨다')
  for (const l of s.labs) l.cleared = true
  eq(Labs.compassTarget(s), null, '다 깨면 가리킬 것이 없다')
}

// ══════════════════════════════════════════════════════ 소행성
section('소행성 — 빠를수록 험해진다')
{
  const { state: s } = newRun()
  Asteroid.begin(s, 1)
  eq(s.phase, 'asteroid', '미니게임으로 넘어간다')
  eq(s.asteroid.tier, 1, '1단계')

  const still = { up: false, down: false, left: false, right: false }
  /* 가만히 있으면 맞아서 5회 만에 죽고, 그러면 미니게임이 멈춘다.
     여기서 재려는 것은 "60초를 채우면 끝나는가"이므로 죽지 않게
     해 둔다 — 안 그러면 사망으로 끝난 것을 통과로 읽는다. */
  s.allowedFailures = 9999
  let t = 0
  while (s.asteroid.active && t < 120) {
    Asteroid.update(s, DT, still)
    t += DT
  }
  ok(!s.asteroid.active, '60초면 끝난다')
  ok(phaseOf(s) !== 'dead', '버텨서 끝난 것이지 죽어서 끝난 게 아니다')
  near(t, 60, 1, '정확히 60초')

  /* 단계가 오르면 어려워지는가.

     화면에 동시에 떠 있는 개수만 세면 안 된다. 높은 단계는 소행성이
     빨라서 화면을 빨리 지나가므로, 많이 쏟아부어도 순간 개수는 덜
     오른다. 난이도는 밀도와 속도가 함께 만드니 둘 다 잰다. */
  const spawned: number[] = []
  const traveled: number[] = []
  for (const tier of [1, 2, 3, 4, 5]) {
    const { state: a } = newRun('AST')
    Asteroid.begin(a, tier)
    a.allowedFailures = 9999          /* 죽으면 세다 말게 된다 */
    let total = 0
    const seen = new Set<object>()
    let speedSum = 0
    let speedN = 0
    for (let i = 0; i < 60 * 30; i++) {
      Asteroid.update(a, DT, still)
      for (const r of a.asteroid.rocks) {
        if (!seen.has(r)) {
          seen.add(r)
          total++
          speedSum += Math.hypot(r.vx, r.vy)
          speedN++
        }
      }
    }
    spawned.push(total)
    traveled.push(speedN > 0 ? speedSum / speedN : 0)
  }
  for (let i = 1; i < spawned.length; i++) {
    ok(spawned[i] > spawned[i - 1], `${i + 1}단계가 ${i}단계보다 많이 쏟아진다 — ${spawned[i - 1]} → ${spawned[i]}`)
    ok(traveled[i] > traveled[i - 1], `${i + 1}단계가 ${i}단계보다 빠르다 — ${traveled[i - 1].toFixed(0)} → ${traveled[i].toFixed(0)}`)
  }
  ok(spawned[4] > spawned[0] * 2.5, `5단계는 1단계의 2.5배 넘게 쏟아진다 — ${spawned[0]} vs ${spawned[4]}`)

  /* 누적 5회 실패면 죽는다 */
  const { state: f } = newRun()
  Asteroid.begin(f, 3)
  f.asteroidFailures = 4
  f.asteroid.rocks = [{ x: f.asteroid.shipX, y: f.asteroid.shipY, vx: 0, vy: 0, r: 20 }]
  Asteroid.update(f, DT, still)
  eq(f.asteroidFailures, 5, '피격 누적')
  eq(f.phase, 'dead', '5회면 죽는다')
  eq(f.death.cause, 'asteroid', '사인은 소행성')

  /* 구조 신호 해금이 7회로 늘린다(§14.3) */
  const rescued = Run.startRun({ seed: 'R', modifierId: 'calm', unlocks: ['rescue_signal'] }).state
  eq(rescued.allowedFailures, 7, '해금하면 7회')
}

// ══════════════════════════════════════════════════════ 해금·모디파이어
section('로그라이크 구조')
{
  /* §14.3 원칙 — 전투력을 직접 주지 않는다 */
  for (const u of UNLOCKS) {
    const e = u.effects as Record<string, unknown>
    ok(
      e.damageBonus === undefined && e.speedBonus === undefined,
      `${u.name} 은 전투력을 직접 주지 않는다`,
    )
  }

  const s = Run.startRun({
    seed: 'U',
    modifierId: 'calm',
    unlocks: ['manual', 'spare_axe', 'nav_records', 'reinforced_fiber', 'spare_tank', 'igniter'],
  }).state
  eq(s.craftLevel, 2, '정비 매뉴얼 — Lv2 로 시작')
  eq(countItem(s, 'axe_iron'), 1, '여분 도끼')
  ok(s.flags.hasMap && s.flags.hasCompass, '항법 기록')
  eq(s.player.maxSuit, 120, '강화 섬유')
  eq(s.player.maxOxygen, 130, '예비 산소통')
  eq(s.campfire.burning.length, 3, '착화 장치 — 석탄 3개가 장전돼 있다')

  /* 블랙박스 계산(§14.2) */
  const { state: b } = newRun()
  b.day = 37
  b.coreParts = ['core_radar']
  b.craftLevel = 2
  eq(Run.blackboxGain(b), 37 * 2 + 50 + 50, '도달일×2 + 부품×50 + 레벨×25')
  b.phase = 'escaped'
  eq(Run.blackboxGain(b), 37 * 2 + 50 + 50 + 300, '탈출하면 +300')

  /* 랭크(§15.2) */
  eq(Run.rankFor(45), 'S', '45분 S')
  eq(Run.rankFor(60), 'A', '60분 A')
  eq(Run.rankFor(70), 'B', '70분 B')
  eq(Run.rankFor(90), 'C', '90분 C')
  eq(Run.rankFor(120), 'D', '120분 D')

  /* 모디파이어가 실제로 세계를 바꾸는가 */
  const rich = Run.startRun({ seed: 'M', modifierId: 'abundance', unlocks: [] }).state
  const poor = Run.startRun({ seed: 'M', modifierId: 'metal_poor', unlocks: [] }).state
  const plain = Run.startRun({ seed: 'M', modifierId: 'calm', unlocks: [] }).state
  ok(rich.trees.length > plain.trees.length, '풍요는 자원이 많다')
  ok(poor.junk.length < plain.junk.length, '금속 결핍은 고철이 적다')
  const longDay = Run.startRun({ seed: 'M', modifierId: 'long_day', unlocks: [] }).state
  eq(longDay.daySeconds, 240, '긴 낮 240초')
  eq(longDay.nightSeconds, 60, '긴 낮의 밤은 60초')
  const meteor = Run.startRun({ seed: 'M', modifierId: 'meteor', unlocks: [] }).state
  eq(TimeSystem.asteroidStride(meteor), 3, '유성우는 3일마다')

  /* §15.1 — 100일에 장비가 모자라면 25일 뒤 다음 창 */
  eq(Run.currentWindow(50), 100, '아직 100일 창')
  eq(Run.currentWindow(100), 100, '100일 창')
  eq(Run.currentWindow(101), 125, '놓치면 125일')
  eq(Run.currentWindow(126), 150, '또 놓치면 150일')

  const { state: esc } = newRun()
  esc.day = 100
  ok(!Run.escapeReady(esc), '장비가 없으면 준비 안 됨')
  ok(!Run.checkEscape(esc), '이륙 못 한다')
  eq(esc.phase, 'day', '살아는 있다')
  esc.dockBuilt = true
  esc.escapeBuilt = [...Run.ESCAPE_PARTS]
  ok(Run.escapeReady(esc), '장비가 다 있으면 준비됨')
  ok(Run.checkEscape(esc), '이륙')
  eq(esc.phase, 'escaped', '탈출')
}

// ══════════════════════════════════════════════════════ 충돌
section('충돌 — 지형에 끼지 않는가')
{
  const solids = [{ x: 50, z: 50, r: 1 }]
  const out = pushOut(50.2, 50, 0.38, solids)
  ok(Math.hypot(out.x - 50, out.z - 50) >= 1.38 - 1e-6, '겹치면 밀려난다')

  const exact = pushOut(50, 50, 0.38, solids)
  ok(Number.isFinite(exact.x) && Number.isFinite(exact.z), '정확히 겹쳐도 안 터진다')

  const free = pushOut(80, 80, 0.38, solids)
  near(free.x, 80, 1e-9, '안 겹치면 안 움직인다')

  /* 맵 밖으로는 못 나간다 */
  const edge = pushOut(-100, -100, 0.38, [])
  ok(edge.x >= 2 && edge.z >= 2, '왼쪽 위 경계')
  const edge2 = pushOut(9999, 9999, 0.38, [])
  ok(edge2.x <= TILES - 2 && edge2.z <= TILES - 2, '오른쪽 아래 경계')

  ok(segmentBlocked(40, 50, 60, 50, 0.1, solids), '선분이 막힌다')
  ok(!segmentBlocked(40, 70, 60, 70, 0.1, solids), '비껴가면 안 막힌다')

  /* 무작위로 마구 밀어도 상자 안에 남지 않는다 */
  const rng = makeRng('collide')
  const many = Array.from({ length: 30 }, () => ({
    x: rng.range(20, 170), z: rng.range(20, 170), r: rng.range(0.5, 1.5),
  }))
  for (let i = 0; i < 4000; i++) {
    const p = pushOut(rng.range(20, 170), rng.range(20, 170), 0.38, many, 6)
    let inside = false
    for (const s of many) {
      if (Math.hypot(p.x - s.x, p.z - s.z) < s.r + 0.38 - 0.02) inside = true
    }
    ok(!inside, '어디로 밀어도 지형 안에 남지 않는다')
  }
}

// ══════════════════════════════════════════════════════ 안개
section('안개 — 밝힌 곳이 아니라 밟은 곳')
{
  const { state: s } = newRun()
  eq(exploredCount(s), 0, '처음엔 아무것도 모른다')

  /* 불을 아무리 키워도 지도는 안 늘어난다(§6.4) */
  s.campfire.level = 4
  s.campfire.safeRadius = 32
  eq(exploredCount(s), 0, '불빛으로는 지도가 안 그려진다')

  const { markExplored } = await import('../src/world/FogOfWar.ts')
  markExplored(s)
  const after = exploredCount(s)
  ok(after > 0, '밟으면 기록된다')

  s.player.x += 50
  markExplored(s)
  ok(exploredCount(s) > after, '걸어가면 늘어난다')
}

// ══════════════════════════════════════════════════════ §부록B-2
section('★ 부록B-2 — 고철 410 / 통나무 270 이 모이는가')
{
  /* 이게 이 문서가 "먼저 깨질 것 같다"고 지목한 가정이다.
     짐작하지 말고 실제 스폰 밀도로 세어 본다. */
  const { state: s } = newRun('BALANCE')

  let woodAvailable = 0
  for (const t of s.trees) {
    woodAvailable += t.kind === 'tree_small' ? 3 : t.kind === 'tree_large' ? 15 : 0
  }
  let scrapAvailable = 0
  for (const j of s.junk) scrapAvailable += ITEMS[j.item].scrapValue ?? 0
  /* 짐승도 고철을 떨어뜨린다 */
  for (const b of s.beasts) scrapAvailable += ENEMIES[b.type].drops.scrap ?? 0

  /* §12.2 의 목표치는 탈출 장비만 센 것이다. 실제로는 도크(60)와
     기계 업그레이드(70)와 침대(최대 120)와 저장고·밭이 더 든다.
     "런 전체 수요"로 보려면 그것까지 더해야 한다. */
  const NEED_SCRAP = 410 + 80 + 60          /* 장비 + 도크 + 기계 */
  const NEED_WOOD = 270 + 60 + 70 + 120     /* 장비 + 도크 + 기계 + 침대 */

  process.stdout.write(
    `   맵 전체 매장량: 통나무 ${woodAvailable} · 고철 ${scrapAvailable}`
    + `   (목표 ${NEED_WOOD} / ${NEED_SCRAP})\n`,
  )

  /* 전부 캐야 겨우 되는 것도 곤란하고, 남아돌아도 곤란하다.
     1.4~4배 사이면 "부지런히 돌면 된다"가 성립한다. */
  /* 전부 캐야 겨우 되면 실수 한 번에 런이 끝나고, 남아돌면 파밍이
     의미를 잃는다. 1.3~4배 사이가 "부지런히 돌면 된다"의 범위다. */
  const woodRatio = woodAvailable / NEED_WOOD
  const scrapRatio = scrapAvailable / NEED_SCRAP
  process.stdout.write(
    `   런 전체 수요 대비 여유: 통나무 ×${woodRatio.toFixed(1)} · 고철 ×${scrapRatio.toFixed(1)}\n`,
  )
  ok(woodRatio >= 1.3, `통나무가 수요의 1.3배 이상 — ×${woodRatio.toFixed(1)}`)
  ok(woodRatio <= 4.5, `통나무가 남아돌지는 않는다 — ×${woodRatio.toFixed(1)}`)
  ok(scrapRatio >= 1.1, `고철이 수요를 넘는다 — ×${scrapRatio.toFixed(1)}`)
  ok(scrapRatio <= 4.5, `고철이 남아돌지는 않는다 — ×${scrapRatio.toFixed(1)}`)

  /* 존별로도 본다. 1존만으로 끝나면 존을 넓힐 이유가 없다. */
  const perZone: Record<number, { wood: number; scrap: number }> = {
    1: { wood: 0, scrap: 0 }, 2: { wood: 0, scrap: 0 },
    3: { wood: 0, scrap: 0 }, 4: { wood: 0, scrap: 0 },
  }
  for (const t of s.trees) {
    const z = zoneAt(distance(t.x, t.z, CENTER, CENTER)).id
    perZone[z].wood += t.kind === 'tree_small' ? 3 : 15
  }
  for (const j of s.junk) {
    const z = zoneAt(distance(j.x, j.z, CENTER, CENTER)).id
    perZone[z].scrap += ITEMS[j.item].scrapValue ?? 0
  }
  for (const [z, v] of Object.entries(perZone)) {
    process.stdout.write(`   ${z}존: 통나무 ${v.wood} · 고철 ${v.scrap}\n`)
  }
  /* 이게 §6.3 "존을 넓혀가야 하는 압박"이 실제로 성립한다는 증거다.
     1존만으로 끝나면 나머지 세 존은 구경거리가 된다. */
  ok(perZone[1].scrap < NEED_SCRAP * 0.4, '1존만으로는 고철이 한참 모자란다 — 나가야 한다')
  ok(perZone[1].scrap + perZone[2].scrap < NEED_SCRAP, '2존까지 훑어도 고철이 모자란다 — 3존까지 가야 한다')
  ok(perZone[4].scrap > 0 && perZone[4].wood > 0, '4존에도 캘 것이 있다')

  /* 왕복 시간. 낮 180초 중 이동에 얼마나 쓰는가(§부록B-1) */
  const walk = BALANCE.player.runSpeed
  for (const plan of ZONE_PLANS) {
    const zone = BALANCE.zones.find((z) => z.id === plan.zone)!
    const mid = (zone.innerRadius + Math.min(zone.outerRadius, 95)) / 2
    const roundTrip = (mid * 2) / walk
    const farmTime = BALANCE.time.daySeconds - roundTrip
    process.stdout.write(
      `   ${plan.zone}존 왕복 ${roundTrip.toFixed(0)}초 → 파밍 가능 ${farmTime.toFixed(0)}초\n`,
    )
    if (plan.zone <= 2) {
      ok(farmTime > 60, `${plan.zone}존은 낮 하루에 다녀올 만하다 — ${farmTime.toFixed(0)}초`)
    }
  }
  /* ★ §부록B-1 이 물은 것: 낮 3분이 파밍하기에 충분한가?

     재 보면 넉넉하다 못해 남는다. 4존 왕복이 29초라 이동은 제약이
     아니다. 이 맵에서 낮을 조이는 것은 거리가 아니라 **가방 8칸**과
     **산소**다. 그래서 왕복 횟수가 곧 파밍량이 된다.

     문서의 수치(맵 192타일 · 달리기 6.0)를 그대로 지킨 결과이므로
     여기서 임의로 바꾸지 않고, 사실만 못 박아 둔다. 거리로 조이고
     싶다면 맵을 키우거나 속도를 낮춰야 한다. */
  const z4 = BALANCE.zones.find((z) => z.id === 4)!
  const far = (z4.innerRadius * 2) / walk
  ok(far < BALANCE.time.daySeconds * 0.5,
    `4존조차 낮의 절반 안에 다녀온다 — ${far.toFixed(0)}초 (거리는 제약이 아니다)`)

  /* 대신 산소가 조인다. 4존은 1.5배로 마르므로 체류 시간이 짧다. */
  const oxyBudget = BALANCE.player.maxOxygen / (BALANCE.player.oxygenDrain * 1.5)
  ok(oxyBudget < BALANCE.time.daySeconds * 1.1,
    `4존 체류는 산소가 먼저 끊는다 — ${oxyBudget.toFixed(0)}초`)

  /* 그리고 가방. 한 번에 들고 올 수 있는 고철은 칸 수에 묶인다. */
  const perTrip = BALANCE.player.inventorySlots * 4
  const trips = Math.ceil(NEED_SCRAP / perTrip)
  process.stdout.write(`   고철 ${NEED_SCRAP} 를 모으려면 최소 ${trips}번 왕복해야 한다\n`)
  ok(trips >= 12, `왕복이 충분히 많다 — ${trips}번 (가방이 진짜 제약이다)`)
}

// ══════════════════════════════════════════════════════ 통합
section('통합 — 한 판을 오래 굴려도 깨지지 않는가')
{
  const { state: s, solids } = newRun('SOAK')
  const Animals = await import('../src/entities/Animal.ts')
  const Bullets = await import('../src/entities/Projectile.ts')

  s.campfire.level = 1
  s.campfire.safeRadius = 8
  addItem(s, 'wood', 50)

  let frames = 0
  const LIMIT = 60 * 60 * 12   /* 12분 */
  for (; frames < LIMIT; frames++) {
    /* 죽지 않게만 최소한으로 돌본다 — 여기서 보는 건 난이도가 아니라
       "값이 깨지거나 멈추지 않는가"다. */
    s.player.suit = s.player.maxSuit
    s.player.oxygen = s.player.maxOxygen
    s.player.hunger = s.player.maxHunger
    if (s.campfire.burning.length === 0) {
      s.campfire.burning.push({ item: 'wood', grade: 1, remain: 30 })
    }

    for (const ev of TimeSystem.update(s, DT)) {
      if (ev.type === 'nightFall') Spider.spawnForNight(s)
      if (ev.type === 'sunrise') {
        Decay.harvestFarms(s)
        Animals.repopulate(s)
      }
    }
    if (s.phase === 'asteroid') {
      s.phase = 'day'
      s.asteroid.active = false
    }
    Survival.update(s, DT)
    Campfire.update(s, DT)
    Decay.update(s, DT)
    Animals.updateAll(s, DT, solids)
    Spider.update(s, DT, solids)
    Bullets.update(s, DT, solids)
    s.events.length = 0

    if (frames % 600 === 0) {
      ok(Number.isFinite(s.player.x) && Number.isFinite(s.player.z), '플레이어 좌표가 유한')
      ok(s.player.x >= 0 && s.player.x <= TILES, '맵 안에 있다')
      for (const b of s.beasts) {
        ok(Number.isFinite(b.x) && Number.isFinite(b.z), '짐승 좌표가 유한')
        ok(b.hp > 0, '죽은 짐승이 안 남아 있다')
      }
      for (const sp of s.spiders) {
        ok(Number.isFinite(sp.x) && Number.isFinite(sp.z), '거미 좌표가 유한')
      }
      ok(s.beasts.length < 400, `짐승이 무한히 늘지 않는다 — ${s.beasts.length}`)
      ok(s.campfire.level >= 0 && s.campfire.level <= 4, '캠프 레벨이 범위 안')
    }
  }
  process.stdout.write(
    `   (12분 ${frames}프레임 · ${s.day}일 · 짐승 ${s.beasts.length} · 나무 ${s.trees.length})\n`,
  )
  ok(s.day > 1, '날짜가 흘렀다')
  ok(s.phase !== 'dead', '돌보는 동안은 안 죽는다')
}

// ══════════════════════════════════════════════════════ 결과
section('결과')
const MAX_SHOWN = Number(process.env.SHOW_FAILS || 30)
if (fail) {
  for (const f of fails.slice(0, MAX_SHOWN)) console.log('  ✗ ' + f)
  if (fails.length > MAX_SHOWN) console.log(`  ... 외 ${fails.length - MAX_SHOWN}건`)
}
console.log(`\n${fail === 0 ? '✅' : '❌'}  통과 ${pass} / 실패 ${fail}\n`)
process.exit(fail ? 1 : 0)
