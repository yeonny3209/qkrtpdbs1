/* ==================================================================
   순수 로직 검증 — 브라우저 없이 Node 에서 돈다

   §부록B 가 "먼저 깨질 것 같다"고 지목한 여섯 가지를 우선으로 본다.
   특히 1번(화력 감소 속도)과 4번(대원 AI가 너무 쉽게 만드는가)은
   짐작으로 답할 수 없어서 실제로 시간을 재고 시뮬레이션한다.
   ================================================================== */
import { makeRng, streamOf, hash32, normalizeSeed } from '../src/core/RNG.ts'
import {
  type GameState, type Phase,
  addItem, removeItem, countItem, freeSlots, hasAll, payAll, distance, inCampfire, hasCrew,
} from '../src/core/GameState.ts'
import {
  BALANCE, CAMPFIRE, FIRE_LEVELS, FUELS, ITEMS, RECIPES, ENEMIES,
  CREW, JOBS, MODIFIERS, CACHES, levelForHeat, fireLevelDef, zoneAt,
} from '../src/data/index.ts'
import * as Campfire from '../src/systems/CampfireSystem.ts'
import * as ZoneGate from '../src/world/ZoneGate.ts'
import * as TimeSystem from '../src/systems/TimeSystem.ts'
import * as Survival from '../src/systems/SurvivalSystem.ts'
import * as Weather from '../src/systems/WeatherSystem.ts'
import * as Crafting from '../src/systems/CraftingSystem.ts'
import * as Inv from '../src/systems/InventorySystem.ts'
import * as Decay from '../src/systems/DecaySystem.ts'
import * as Labs from '../src/systems/LabSystem.ts'
import * as Raid from '../src/systems/RaidSystem.ts'
import * as Run from '../src/systems/RunSystem.ts'
import * as Combat from '../src/systems/CombatSystem.ts'
import * as Spider from '../src/entities/Spider.ts'
import * as Animals from '../src/entities/Animal.ts'
import * as Raiders from '../src/entities/Raider.ts'
import * as Crew from '../src/entities/Crew.ts'
import * as Bullets from '../src/entities/Projectile.ts'
import * as Asteroid from '../src/minigame/AsteroidDodge.ts'
import * as Salvage from '../src/minigame/Salvage.ts'
import { ZONE_PLANS } from '../src/world/Spawner.ts'
import { CENTER, TILES, pushOut, segmentBlocked } from '../src/world/Tilemap.ts'
import { exploredCount, markExplored } from '../src/world/FogOfWar.ts'

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
function section(n: string): void { process.stdout.write(`\n── ${n}\n`) }

/* 시스템이 phase 를 바꾸는 것을 타입이 모른다 */
function phaseOf(s: GameState): Phase { return s.phase }

const DT = 1 / 60
const newRun = (seed = 'TEST', job = 'pilot', mod = 'calm') =>
  Run.startRun({ seed, jobId: job, modifierId: mod })

/** 불을 원하는 레벨까지 즉시 올린다 — 검사 준비용 */
function light(s: GameState, level: number): void {
  const def = fireLevelDef(level)
  s.campfire.heat = def ? def.min + 5 : 0
  Campfire.update(s, 0.0001)
}

// ══════════════════════════════════════════════════════
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

  /* 갈래가 다르면 독립. 맵 생성기를 고쳐도 전리품이 안 밀려야 한다. */
  const m1 = streamOf('X', 'map')
  const l1 = streamOf('X', 'loot')
  let same = 0
  for (let i = 0; i < 200; i++) if (m1() === l1()) same++
  eq(same, 0, '갈래가 다르면 수열도 다르다')

  eq(hash32('abc'), hash32('abc'), 'hash32 결정적')
  ok(hash32('abc') !== hash32('abd'), 'hash32 충돌 아님')
  eq(normalizeSeed('ab-cd 12'), 'ABCD12', '시드 정규화')
  eq(normalizeSeed('').length, 8, '빈 시드는 무작위로 채운다')

  const w1 = newRun('SAMEWORLD').state
  const w2 = newRun('SAMEWORLD').state
  eq(w1.trees.length, w2.trees.length, '같은 시드 같은 나무 수')
  eq(w1.caches.length, w2.caches.length, '같은 시드 같은 보급함 수')
  for (let i = 0; i < w1.labs.length; i++) {
    near(w1.labs[i].x, w2.labs[i].x, 1e-9, '같은 시드 같은 연구소 위치')
  }
  const w3 = newRun('OTHERWORLD').state
  ok(w1.labs[0].x !== w3.labs[0].x || w1.labs[0].z !== w3.labs[0].z, '다른 시드 다른 배치')
}

// ══════════════════════════════════════════════════════
section('데이터 — JSON 이 서로 아귀가 맞는가')
{
  for (const [id, def] of Object.entries(RECIPES)) {
    for (const cid of Object.keys(def.cost)) {
      ok(cid.startsWith('core_') || ITEMS[cid] !== undefined, `${id} 의 재료 ${cid} 가 실재한다`)
    }
    for (const gid of Object.keys(def.gives ?? {})) {
      ok(ITEMS[gid] !== undefined, `${id} 가 주는 ${gid} 가 실재한다`)
    }
    ok(def.level >= 1 && def.level <= 5, `${id} 레벨이 1~5`)
    ok(def.name.length > 0 && def.desc.length > 0, `${id} 에 이름과 설명이 있다`)
  }
  for (const [id, def] of Object.entries(ENEMIES)) {
    for (const did of Object.keys(def.drops)) {
      ok(ITEMS[did] !== undefined, `${id} 의 전리품 ${did} 가 실재한다`)
    }
  }
  for (const id of Object.keys(FUELS)) {
    ok(ITEMS[id] !== undefined, `연료 ${id} 가 아이템으로도 있다`)
    eq(ITEMS[id].kind, 'fuel', `${id} 의 종류가 연료다`)
  }
  for (const c of CREW) {
    ok(ITEMS[c.core] !== undefined, `대원 ${c.id} 의 핵심 부품이 실재한다`)
    ok(c.labTier >= 1 && c.labTier <= 4, `대원 ${c.id} 의 연구소 단계가 1~4`)
  }
  for (const j of JOBS) {
    for (const iid of Object.keys(j.effects.startItems ?? {})) {
      ok(ITEMS[iid] !== undefined, `직책 ${j.id} 의 지급품 ${iid} 가 실재한다`)
    }
  }
  eq(new Set(MODIFIERS.map((m) => m.id)).size, MODIFIERS.length, '행성 변수 아이디가 서로 다르다')
  eq(new Set(JOBS.map((j) => j.id)).size, JOBS.length, '직책 아이디가 서로 다르다')
  eq(new Set(CREW.map((c) => c.id)).size, CREW.length, '대원 아이디가 서로 다르다')
  eq(new Set(CREW.map((c) => c.labTier)).size, CREW.length, '대원마다 연구소가 하나씩')

  /* §10.1 의 숫자 */
  eq(ENEMIES.rabbit.hp, 40, '토끼 40')
  eq(ENEMIES.wolf.hp, 100, '늑대 100')
  eq(ENEMIES.mutant_wolf.hp, 300, '변이 늑대 300')
  eq(ENEMIES.bear.hp, 800, '곰 800')
  eq(ENEMIES.tiger.hp, 1500, '호랑이 1500')
  eq(ENEMIES.abyssal.hp, 2500, '심연 개체 2500')
  eq(ENEMIES.raider_giant.hp, 900, '거대 약탈자 900')

  /* §12.1 의 총 HP — 구성에서 저절로 나와야 한다 */
  eq(Labs.labTotalHp(1), 600, '연구소 1단계 총 600')
  eq(Labs.labTotalHp(2), 900, '연구소 2단계 총 900')
  eq(Labs.labTotalHp(3), 2400, '연구소 3단계 총 2400')
  eq(Labs.labTotalHp(4), 4800, '연구소 4단계 총 4800')

  /* §3.1 테이블 */
  eq(FIRE_LEVELS.length, 6, '캠프파이어 6레벨')
  const expected = [
    [1, 1, 0.5, 8, 25], [2, 100, 0.8, 12, 45], [3, 250, 1.2, 16, 65],
    [4, 500, 1.8, 20, 85], [5, 900, 2.4, 25, 105], [6, 1500, 3.0, 30, 999],
  ]
  expected.forEach(([lv, min, drain, safe, open], i) => {
    const l = FIRE_LEVELS[i]
    eq(l.lv, lv, `Lv${lv} 번호`)
    eq(l.min, min, `Lv${lv} 최소 화력`)
    eq(l.drain, drain, `Lv${lv} 감소`)
    eq(l.safeRadius, safe, `Lv${lv} 안전반경`)
    eq(l.openRadius, open, `Lv${lv} 개방반경`)
  })
  eq(FUELS.log.heat, 10, '통나무 +10')
  eq(FUELS.coal.heat, 40, '석탄 +40')
  eq(FUELS.oildrum.heat, 120, '기름 통 +120')
  eq(FUELS.gastank.heat, 350, '가스 통 +350')
}

// ══════════════════════════════════════════════════════
section('속도 — 밤의 긴장을 만드는 네 숫자')
{
  const P = BALANCE.player
  const S = BALANCE.spider
  /* §10.2 의 관계. 하나라도 뒤집히면 게임의 정체성이 바뀐다. */
  ok(S.speed < P.walkSpeed, `평시 거미(${S.speed})는 걷기(${P.walkSpeed})보다도 느리다`)
  ok(S.speedHungry > P.runSpeed, `굶주린 거미(${S.speedHungry})는 달리기(${P.runSpeed})보다 빠르다`)
  ok(ENEMIES.tiger.speed < P.runSpeed, '호랑이도 달리기보다는 느리다 (간신히)')
  ok(ENEMIES.tiger.speed > P.walkSpeed, '호랑이에게서 걸어서는 못 도망친다')
  ok(P.hungerRunMultiplier === 3, '달리면 배고픔 3배(§5)')
}

// ══════════════════════════════════════════════════════
section('★ 캠프파이어 — 게임의 심장 (§3)')
{
  const { state: s } = newRun()
  s.campfire.heat = 0
  Campfire.update(s, DT)
  eq(s.campfire.level, 0, '처음엔 꺼져 있다')
  ok(s.campfire.extinguished, '꺼짐 상태')
  eq(s.campfire.safeRadius, 0, '안전반경 0')
  eq(ZoneGate.openRadiusOf(s), 0, '개방 반경 0')

  /* 연료를 넣으면 화력이 오른다 */
  addItem(s, 'log', 10)
  ok(Campfire.addFuel(s, 'log'), '통나무를 넣는다')
  eq(s.campfire.heat, 10, '화력 +10')
  Campfire.update(s, DT)
  eq(s.campfire.level, 1, 'Lv1')
  eq(s.campfire.safeRadius, 8, '안전반경 8')
  eq(ZoneGate.openRadiusOf(s), 25, '개방 반경 25')
  ok(!s.campfire.extinguished, '불이 붙었다')

  /* 레벨 경계 */
  eq(levelForHeat(0), 0, '0 은 꺼짐')
  eq(levelForHeat(1), 1, '1 은 Lv1')
  eq(levelForHeat(99), 1, '99 는 Lv1')
  eq(levelForHeat(100), 2, '100 은 Lv2')
  eq(levelForHeat(1499), 5, '1499 는 Lv5')
  eq(levelForHeat(1500), 6, '1500 은 Lv6')
  eq(levelForHeat(99999), 6, '넘쳐도 Lv6')

  /* ★ 상위 연료는 불을 키워 본 뒤에 나타난다(§3.2) */
  ok(Campfire.fuelUnlocked(s, 'log'), '통나무는 언제나')
  ok(Campfire.fuelUnlocked(s, 'coal'), 'Lv1 이면 석탄이 열린다')
  ok(!Campfire.fuelUnlocked(s, 'oildrum'), '기름은 아직')
  ok(!Campfire.fuelUnlocked(s, 'gastank'), '가스는 아직')
  light(s, 2)
  ok(Campfire.fuelUnlocked(s, 'oildrum'), 'Lv2 면 기름이 열린다')
  light(s, 3)
  ok(Campfire.fuelUnlocked(s, 'gastank'), 'Lv3 이면 가스가 열린다')

  /* ★★ §3.3 확정 — 개방 반경은 최고 도달 레벨 기준이라 안 줄어든다 */
  light(s, 5)
  eq(s.campfire.maxReachedLevel, 5, '최고 도달 5')
  eq(ZoneGate.openRadiusOf(s), 105, '개방 반경 105')
  s.campfire.heat = 5
  Campfire.update(s, DT)
  eq(s.campfire.level, 1, '화력이 떨어져 Lv1')
  eq(s.campfire.safeRadius, 8, '안전반경은 지금 레벨 기준이라 줄어든다')
  eq(s.campfire.maxReachedLevel, 5, '최고 도달은 그대로')
  eq(ZoneGate.openRadiusOf(s), 105, '개방 반경은 안 줄어든다 — 억울한 죽음 방지')

  /* 감소 속도 — 레벨이 높을수록 빨리 샌다 */
  for (const lv of [1, 2, 3, 4, 5, 6]) {
    const { state: t } = newRun()
    light(t, lv)
    near(Campfire.drainRate(t), fireLevelDef(lv)!.drain, 1e-9, `Lv${lv} 감소 ${fireLevelDef(lv)!.drain}/초`)
  }

  /* 습격 실패 페널티 — 2배(§13.3) */
  const { state: pen } = newRun()
  light(pen, 4)
  const base = Campfire.drainRate(pen)
  pen.campfire.drainMultiplier = CAMPFIRE.raidFailMultiplier
  near(Campfire.drainRate(pen), base * 2, 1e-9, '습격 실패면 2배로 샌다')

  /* 산성비 1.5배, 중첩된다(§15) */
  pen.weather.kind = 'acid_rain'
  pen.weather.remain = 60
  near(Campfire.drainRate(pen), base * 2 * 1.5, 1e-9, '습격 실패 + 산성비는 곱해진다')
  /* 기상 안정기가 산성비를 무효로 만든다(§8.6) */
  pen.buildings.push({ id: 999, type: 'weather_stabilizer', x: CENTER, z: CENTER })
  near(Campfire.drainRate(pen), base * 2, 1e-9, '안정기가 산성비를 막는다')

  /* ★ §부록B-1 — Lv6 유지가 8분마다 가스 5개인가 */
  {
    const { state: t } = newRun()
    light(t, 6)
    t.campfire.heat = 1500 + 350 * 5
    let sec = 0
    while (t.campfire.level >= 6 && sec < 3000) {
      Campfire.update(t, 1)
      sec++
    }
    process.stdout.write(`   Lv6 · 가스 5개(1750 화력) 유지 시간: ${sec}초 (${(sec / 60).toFixed(1)}분)\n`)
    ok(sec > 300 && sec < 800, `Lv6 유지가 5~13분 사이 — ${sec}초`)
  }

  /* 꺼짐 판정.

     ★ 여기서 버그를 하나 잡았다. 예전에는 extinguished 를 heat <= 0 으로
     봤는데, Lv1 문턱(1) 아래로 떨어진 잔불(예: 0.3)은 레벨이 0이라
     drain 도 0이 되어 영영 안 줄었다. 안전반경은 0인데 "꺼졌다"로는 안
     읽혀서, 거미가 굶주리지 않는 유령 상태가 만들어졌다. */
  const { state: out } = newRun()
  light(out, 1)
  ok(!out.campfire.extinguished, '먼저 불을 붙인다')
  out.events.length = 0
  out.banner = null
  out.campfire.heat = 0.3
  Campfire.update(out, 1)
  eq(out.campfire.heat, 0, '문턱 아래 잔불은 0 으로 지워진다')
  ok(out.campfire.extinguished, '화력이 문턱 아래면 꺼진 것이다')
  eq(out.campfire.safeRadius, 0, '꺼지면 안전반경이 없다')
  ok(out.events.includes('fireOut'), '꺼짐 이벤트')
  ok(out.banner !== null, '붉은 경고가 뜬다')

  /* ★ 이미 레벨 0 인데 화력이 0 이 아닌 상태 — 이게 갇히는 자리다.
     레벨이 0이면 drain 도 0이라 스스로는 절대 안 줄어든다. */
  const { state: stuck } = newRun()
  light(stuck, 1)
  stuck.campfire.heat = 1.2
  Campfire.update(stuck, 1)          // 1.2 - 0.5 = 0.7 → 레벨 0
  eq(stuck.campfire.level, 0, '0.7 이면 레벨 0')
  eq(stuck.campfire.heat, 0, '문턱 아래 잔불은 즉시 0 으로 지워진다')
  ok(stuck.campfire.extinguished, '꺼진 것으로 읽힌다')
  Campfire.update(stuck, 10)
  eq(stuck.campfire.heat, 0, '10초를 더 굴려도 0 에 머문다 (갇히지 않는다)')

  /* ★ HUD·캠프파이어 창이 읽는 세 함수. 화면에만 쓰여서 지금까지
     한 번도 안 쟀는데, 여기가 틀리면 플레이어가 보는 숫자가 전부
     틀린다 — 불이 얼마나 남았는지가 이 게임의 유일한 계기판이다. */
  const { state: gauge } = newRun()
  light(gauge, 2)                      // Lv2 구간(100~250)
  gauge.campfire.heat = 150
  Campfire.update(gauge, 0)
  eq(gauge.campfire.level, 2, 'Lv2')
  eq(Campfire.heatToNextLevel(gauge), 100, 'Lv3(250)까지 100 남았다')
  near(Campfire.levelProgress(gauge), (150 - 100) / (250 - 100), 1e-9, '구간 진행도')
  near(Campfire.secondsLeft(gauge), 150 / 0.8, 1e-9, 'Lv2 는 초당 0.8 → 187.5초')

  gauge.campfire.heat = 1500           // 최고 레벨
  Campfire.update(gauge, 0)
  eq(gauge.campfire.level, 6, 'Lv6')
  eq(Campfire.heatToNextLevel(gauge), 0, '최고 레벨이면 다음이 없다')
  eq(Campfire.levelProgress(gauge), 1, '최고 레벨의 게이지는 꽉 찬다')

  const outFire = newRun().state
  eq(Campfire.secondsLeft(outFire), 0, '꺼진 불은 0초 — 0 나누기가 새지 않는다')

  /* 처음부터 꺼져 있던 불은 "꺼졌다"고 알리지 않는다 */
  const { state: never } = newRun()
  Campfire.update(never, 1)
  ok(never.campfire.extinguished, '시작은 꺼진 상태')
  ok(!never.events.includes('fireOut'), '붙은 적 없는 불은 꺼짐 알림이 안 뜬다')

  /* 굽기 */
  const { state: cook } = newRun()
  light(cook, 1)
  addItem(cook, 'meat_large_raw', 1)
  ok(Campfire.startCooking(cook, 'meat_large_raw'), '굽기 시작')
  for (let i = 0; i < 36 * 60; i++) Campfire.update(cook, DT)
  eq(countItem(cook, 'meat_large_cooked'), 1, '35초 뒤 익는다')

  /* 직책 화부 — 화력 +30% */
  const stoker = newRun('S', 'stoker').state
  near(Campfire.heatOf(stoker, 'log'), 13, 1e-9, '화부는 통나무가 +13')
  eq(countItem(stoker, 'coal'), 5, '화부는 석탄 5개로 시작')
}

// ══════════════════════════════════════════════════════
section('★ 에너지 장벽 — 불이 곧 지도다 (§3.3)')
{
  const { state: s } = newRun()
  light(s, 1)
  eq(ZoneGate.openRadiusOf(s), 25, 'Lv1 은 25타일')

  /* 밖으로 못 나간다 */
  const far = ZoneGate.clampInside(s, CENTER + 60, CENTER, 0)
  ok(far.blocked, '반경 밖은 막힌다')
  near(distance(far.x, far.z, CENTER, CENTER), 25, 0.01, '경계에 붙잡힌다')

  const inside = ZoneGate.clampInside(s, CENTER + 10, CENTER, 0)
  ok(!inside.blocked, '반경 안은 자유롭다')

  ok(ZoneGate.isOpen(s, CENTER + 20, CENTER), '20타일은 열려 있다')
  ok(!ZoneGate.isOpen(s, CENTER + 30, CENTER), '30타일은 아직 막혔다')

  /* 레벨이 오르면 넓어진다 */
  light(s, 3)
  eq(ZoneGate.openRadiusOf(s), 65, 'Lv3 은 65타일')
  ok(ZoneGate.isOpen(s, CENTER + 60, CENTER), '60타일이 열렸다')

  /* Lv6 은 맵 전체 */
  light(s, 6)
  ok(ZoneGate.openRadiusOf(s) >= TILES, 'Lv6 은 맵 전체')

  /* 플레이어를 실제로 가둔다 */
  const { state: p } = newRun()
  light(p, 1)
  p.player.x = CENTER + 80
  p.player.z = CENTER
  ZoneGate.update(p)
  ok(distance(p.player.x, p.player.z, CENTER, CENTER) <= 25, '플레이어가 장벽 안으로 끌려온다')

  ok(p.events.includes('barrier'), '장벽에 닿으면 알린다')

  /* ★ 안내는 접촉당 한 번이다.

     W 를 누른 채 장벽에 기대면 매 프레임 붙잡힌다. 래치가 없으면
     초당 60번 토스트가 뜨어 화면이 통째로 덮인다. 아래는 그 상황을
     그대로 흉내 낸다 — 밖으로 밀고, 붙잡히고, 다시 밀고. */
  const push = (st: typeof p, frames: number) => {
    for (let i = 0; i < frames; i++) {
      st.player.x += 4 * (1 / 60)          // 바깥쪽으로 계속 걷는다
      ZoneGate.update(st)
    }
  }
  p.events.length = 0
  push(p, 120)                              // 2초 동안 기대고 있는다
  eq(p.events.filter((e) => e === 'barrier').length, 0, '기대고 있는 동안은 한 번도 더 안 알린다')

  /* 떨어졌다 다시 닿으면 다시 알린다 — 다음 지대에 갔을 때도 안내가 나와야 한다 */
  p.player.x = CENTER
  p.player.z = CENTER
  ZoneGate.update(p)                        // 되무장
  p.events.length = 0
  p.player.x = CENTER + 80
  ZoneGate.update(p)
  eq(p.events.filter((e) => e === 'barrier').length, 1, '떨어졌다 다시 닿으면 딱 한 번 알린다')

  /* 다음 관문 안내 */
  const info = ZoneGate.nextGateInfo(p)
  ok(info !== null && info.level === 2 && info.radius === 45, '다음 관문은 Lv2 의 45타일')
}

// ══════════════════════════════════════════════════════
section('시간 — 빠를수록 위험하다 (§4)')
{
  const { state: s } = newRun()
  eq(s.day, 1, '1일에 시작')
  eq(s.phase, 'day', '낮에 시작')

  let warned = false
  let fell = false
  for (let t = 0; t < 181; t += DT) {
    for (const ev of TimeSystem.update(s, DT)) {
      if (ev.type === 'nightWarning') warned = true
      if (ev.type === 'nightFall') fell = true
    }
  }
  ok(warned, '170초에 경고')
  ok(fell, '180초에 밤')

  let rose = 0
  for (let t = 0; t < 121; t += DT) {
    for (const ev of TimeSystem.update(s, DT)) if (ev.type === 'sunrise') rose = ev.to
  }
  eq(rose, 2, '침대가 없으면 하루씩')

  /* §4.1 공식 */
  eq(TimeSystem.dayRate(s), 1, '기본 +1')
  s.buildings.push({ id: 1, type: 'bed', x: CENTER, z: CENTER })
  s.buildings.push({ id: 2, type: 'bed_scrap', x: CENTER, z: CENTER })
  eq(TimeSystem.dayRate(s), 3, '침대 둘이면 +3')
  s.crew.push('rohan', 'mira')
  eq(TimeSystem.dayRate(s), 5, '대원 둘이 더해진다')
  s.buildings.push({ id: 3, type: 'time_accelerator', x: CENTER, z: CENTER })
  eq(TimeSystem.dayRate(s), 8, '시간 가속기는 +3')

  /* §4.1 표의 값 */
  const table: [number, number, boolean, number][] = [
    [0, 0, false, 1], [2, 0, false, 3], [4, 2, false, 7], [4, 4, false, 9], [4, 4, true, 12],
  ]
  for (const [beds, crew, accel, want] of table) {
    const t = newRun('RATE').state
    for (let i = 0; i < beds; i++) t.buildings.push({ id: i, type: 'bed', x: CENTER, z: CENTER })
    for (let i = 0; i < crew; i++) t.crew.push(CREW[i].id)
    if (accel) t.buildings.push({ id: 99, type: 'time_accelerator', x: CENTER, z: CENTER })
    eq(TimeSystem.dayRate(t), want, `침대 ${beds} + 대원 ${crew}${accel ? ' + 가속기' : ''} = +${want}일`)
  }

  /* ★ §14.2 — 소행성은 고정 마일스톤이라 건너뛰어지지 않는다 */
  eq(TimeSystem.crossedAsteroidDays(1, 2, []).length, 0, '1→2 는 없음')
  eq(TimeSystem.crossedAsteroidDays(20, 26, []).join(','), '25', '20→26 은 25일')
  eq(TimeSystem.crossedAsteroidDays(20, 55, []).join(','), '25,50', '20→55 는 두 개를 한 번에')
  eq(TimeSystem.crossedAsteroidDays(1, 99, []).join(','), '25,50,75,99', '1→99 는 넷 전부')
  eq(TimeSystem.crossedAsteroidDays(20, 30, [25]).length, 0, '이미 한 것은 다시 안 한다')

  /* 날짜가 12씩 뛰어도 전부 잡힌다 — 이게 v1 의 버그를 고친 부분 */
  {
    let day = 1
    const done: number[] = []
    let count = 0
    while (day < 99) {
      const to = day + 12
      const crossed = TimeSystem.crossedAsteroidDays(day, to, done)
      done.push(...crossed)
      count += crossed.length
      day = to
    }
    eq(count, 4, '+12일씩 뛰어도 소행성 밤을 네 번 다 만난다')
  }

  /* 1일차는 튜토리얼 */
  const { state: tut } = newRun()
  ok(TimeSystem.isTutorialDay(tut), '1일차는 튜토리얼')
  tut.day = 2
  ok(!TimeSystem.isTutorialDay(tut), '2일차부터는 아니다')
}

// ══════════════════════════════════════════════════════
section('생존 — 우주복이 곧 체력이다 (§5)')
{
  const P = BALANCE.player
  const { state: s } = newRun()
  s.player.x = CENTER + 20
  s.campfire.heat = 0
  Campfire.update(s, DT)

  let t = 0
  while (s.player.oxygen > 0 && t < 600) {
    Survival.update(s, DT)
    t += DT
  }
  near(t, P.maxOxygen / P.oxygenDrain, 2, '산소가 4분 만에 마른다')

  const before = s.player.suit
  for (let i = 0; i < 60; i++) Survival.update(s, DT)
  near(before - s.player.suit, P.suitDrainNoOxygen, 0.2, '산소가 없으면 초당 2씩 우주복이 깎인다')

  while (s.player.suit > 0 && t < 900) {
    Survival.update(s, DT)
    t += DT
  }
  eq(phaseOf(s), 'dead', '우주복이 0이면 죽는다')
  eq(s.death.cause, 'oxygen', '사인은 산소 고갈')

  /* 캠프 안에서 회복 */
  const { state: s2 } = newRun()
  light(s2, 1)
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

  /* ★ 불이 꺼지면 캠프 안이어도 산소가 안 찬다(§3.4) */
  const { state: s3 } = newRun()
  light(s3, 2)
  s3.player.x = CENTER
  s3.player.z = CENTER
  s3.player.oxygen = 50
  s3.campfire.heat = 0
  Campfire.update(s3, DT)
  const oxyBefore = s3.player.oxygen
  for (let i = 0; i < 120; i++) Survival.update(s3, DT)
  ok(s3.player.oxygen < oxyBefore, '불이 꺼지면 캠프 안에서도 산소가 준다')

  /* 우주복은 캠프에서 안 낫는다 */
  const { state: s4 } = newRun()
  light(s4, 1)
  s4.player.x = CENTER
  s4.player.z = CENTER
  s4.player.suit = 40
  for (let i = 0; i < 600; i++) Survival.update(s4, DT)
  eq(s4.player.suit, 40, '캠프 안이어도 우주복은 안 낫는다')
  Survival.healFull(s4)
  eq(s4.player.suit, s4.player.maxSuit, '회복 캡슐만이 우주복을 고친다')

  /* ★ 달리면 배고픔 3배(§5) */
  const { state: h } = newRun()
  h.player.hunger = 100
  h.player.running = false
  for (let i = 0; i < 600; i++) Survival.update(h, DT)
  const walkLoss = 100 - h.player.hunger
  const { state: h2 } = newRun()
  h2.player.hunger = 100
  h2.player.stamina = 99999
  for (let i = 0; i < 600; i++) {
    h2.player.running = true
    h2.player.stamina = 100
    Survival.update(h2, DT)
  }
  const runLoss = 100 - h2.player.hunger
  near(runLoss / walkLoss, 3, 0.05, `달리면 배고픔이 3배 — ${(runLoss / walkLoss).toFixed(2)}배`)

  /* 음식 */
  const { state: f } = newRun()
  f.player.hunger = 20
  f.player.suit = 100
  addItem(f, 'meat_small_raw', 1)
  ok(Survival.eat(f, 'meat_small_raw'), '날고기를 먹는다')
  eq(f.player.hunger, 30, '배고픔 +10')
  eq(f.player.suit, 95, '날고기는 우주복 -5')

  addItem(f, 'stew', 1)
  f.player.oxygen = 50
  Survival.eat(f, 'stew')
  eq(f.player.hunger, f.player.maxHunger, '스튜는 배고픔 +100')
  eq(f.player.oxygen, 70, '스튜는 산소도 +20')

  addItem(f, 'bandage', 1)
  f.player.suit = 50
  ok(Survival.useBandage(f), '붕대를 쓴다')
  eq(f.player.suit, 75, '붕대는 우주복 +25')

  /* 직책 생명유지사 */
  const life = newRun('L', 'lifesupport').state
  eq(life.player.maxOxygen, 140, '생명유지사는 산소 140')
  near(Survival.oxygenFactor(life), 0.8, 1e-9, '소모 -20%')
}

// ══════════════════════════════════════════════════════
section('★ 거미 — 불이 꺼지면 캠프까지 들어온다 (§10.2)')
{
  const { state: s, solids } = newRun()
  s.day = 5
  s.phase = 'night'
  light(s, 2)
  Spider.spawnForNight(s)

  eq(s.spiders.length, 1, '평시엔 한 마리')
  ok(!Spider.isHungry(s), '불이 있으면 안 굶주린다')
  eq(Spider.spiderSpeed(s), 3.6, '평시 속도 3.6')
  const d0 = distance(s.spiders[0].x, s.spiders[0].z, s.player.x, s.player.z)
  ok(d0 >= BALANCE.spider.spawnDistance - 0.5, `30타일 밖에서 나온다 — ${d0.toFixed(1)}`)

  /* 1일차는 안 나온다(§18) */
  const { state: tut } = newRun()
  tut.phase = 'night'
  light(tut, 1)
  Spider.spawnForNight(tut)
  eq(tut.spiders.length, 0, '튜토리얼 날에는 거미가 없다')

  /* ★ 불이 꺼지면 굶주린다 */
  s.campfire.heat = 0
  Campfire.update(s, DT)
  ok(Spider.isHungry(s), '불이 꺼지면 굶주린다')
  eq(Spider.spiderSpeed(s), 6.5, '굶주리면 6.5')
  Spider.spawnForNight(s)
  eq(s.spiders.length, 2, '굶주리면 두 마리')

  /* ★★ 굶주리면 캠프 안까지 들어온다 — §3.4 의 핵심 */
  const { state: inv, solids: is } = newRun()
  inv.day = 5
  inv.phase = 'night'
  light(inv, 3)
  inv.player.x = CENTER + 6
  inv.player.z = CENTER
  inv.spiders = [{ id: 1, x: CENTER + 25, z: CENTER, stunT: 0, rollT: 0 }]
  for (let i = 0; i < 60 * 30 && phaseOf(inv) !== 'dead'; i++) Spider.update(inv, DT, is)
  ok(phaseOf(inv) !== 'dead', '불이 켜져 있으면 캠프 안에서 안 죽는다')
  ok(distance(inv.spiders[0].x, inv.spiders[0].z, CENTER, CENTER) >= 16 - 0.6, '경계 밖에서 배회한다')

  const { state: hun, solids: hs } = newRun()
  hun.day = 5
  hun.phase = 'night'
  light(hun, 3)
  hun.campfire.heat = 0
  Campfire.update(hun, DT)
  /* 본선 한가운데(CENTER)에 세우면 안 된다 — 배가 장애물이라 적이
     배를 빙빙 돌기만 하고 영영 못 닿는다. 실제로는 물리가 사람을
     배 밖으로 밀어내므로 설 수 없는 자리다. */
  hun.player.x = CENTER + 6
  hun.player.z = CENTER
  hun.spiders = [{ id: 1, x: CENTER + 22, z: CENTER, stunT: 0, rollT: 0 }]
  let died = false
  for (let i = 0; i < 60 * 30; i++) {
    Spider.update(hun, DT, hs)
    if (phaseOf(hun) === 'dead') { died = true; break }
  }
  ok(died, '★ 불이 꺼지면 캠프 안까지 들어와 죽인다')
  eq(hun.death.cause, 'spider_hungry', '사인은 굶주린 거미')

  /* ★ 굶주리면 안전반경 자체를 무시한다.

     실전에서는 불이 꺼지면 safeRadius 도 0이 되어 이 조건이 겉으로
     드러나지 않는다. 그래서 안전반경이 남아 있는 상태를 손으로 만들어
     규칙만 따로 잰다 — 나중에 누가 "꺼져도 반경은 남기자"고 고쳐도
     거미가 다시 막히지 않도록. */
  const { state: ig, solids: igs } = newRun()
  ig.day = 5
  ig.phase = 'night'
  light(ig, 3)
  ig.campfire.extinguished = true          // 굶주림만 켜고
  ig.campfire.safeRadius = 16              // 반경은 남겨 둔다
  ig.player.x = CENTER + 6
  ig.player.z = CENTER
  ig.spiders = [{ id: 1, x: CENTER + 22, z: CENTER, stunT: 0, rollT: 0 }]
  let ignored = false
  for (let i = 0; i < 60 * 20; i++) {
    Spider.update(ig, DT, igs)
    if (phaseOf(ig) === 'dead') { ignored = true; break }
  }
  ok(ignored, '굶주린 거미는 안전반경이 남아 있어도 뚫고 들어온다')

  const { state: blk, solids: bks } = newRun()
  blk.day = 5
  blk.phase = 'night'
  light(blk, 3)
  blk.player.x = CENTER + 6
  blk.player.z = CENTER
  blk.spiders = [{ id: 1, x: CENTER + 22, z: CENTER, stunT: 0, rollT: 0 }]
  for (let i = 0; i < 60 * 20 && phaseOf(blk) !== 'dead'; i++) Spider.update(blk, DT, bks)
  ok(phaseOf(blk) !== 'dead', '불이 켜져 있으면 같은 상황에서 막힌다')

  /* 접촉 즉사 */
  const { state: k, solids: ks } = newRun()
  k.day = 5
  k.phase = 'night'
  light(k, 1)
  k.spiders = [{ id: 1, x: k.player.x + 0.4, z: k.player.z, stunT: 0, rollT: 0 }]
  Spider.update(k, DT, ks)
  eq(phaseOf(k), 'dead', '닿으면 즉사')
  eq(k.death.cause, 'spider', '평시 사인은 거미')

  /* 손전등 60도 콘 */
  const { state: fl } = newRun()
  fl.player.flashlightOn = true
  fl.player.facing = 0
  ok(Spider.inFlashlightCone(fl, { id: 1, x: fl.player.x + 5, z: fl.player.z, stunT: 0, rollT: 0 }), '앞은 비춘다')
  ok(!Spider.inFlashlightCone(fl, { id: 2, x: fl.player.x - 5, z: fl.player.z, stunT: 0, rollT: 0 }), '뒤는 못 비춘다')
  ok(!Spider.inFlashlightCone(fl, { id: 3, x: fl.player.x + 40, z: fl.player.z, stunT: 0, rollT: 0 }), '사거리 밖은 못 비춘다')
  fl.player.flashlightOn = false
  ok(!Spider.inFlashlightCone(fl, { id: 1, x: fl.player.x + 5, z: fl.player.z, stunT: 0, rollT: 0 }), '꺼져 있으면 안 비춘다')

  /* ★ 평시에는 콘 안에서 완전히 멈춘다 */
  const { state: st, solids: ss } = newRun()
  st.day = 5
  st.phase = 'night'
  light(st, 1)
  st.player.flashlightOn = true
  st.player.facing = 0
  st.spiders = [{ id: 1, x: st.player.x + 6, z: st.player.z, stunT: 0, rollT: 0 }]
  const sx0 = st.spiders[0].x
  for (let i = 0; i < 60; i++) Spider.update(st, DT, ss)
  near(st.spiders[0].x, sx0, 1e-6, '평시에는 손전등 앞에서 완전히 멈춘다')

  /* 굶주림 상태에서는 절반만 통한다 — 결국 다가온다 */
  const { state: hf, solids: hfs } = newRun()
  hf.day = 5
  hf.phase = 'night'
  hf.campfire.heat = 0
  Campfire.update(hf, DT)
  hf.player.flashlightOn = true
  hf.player.facing = 0
  hf.spiders = [{ id: 1, x: hf.player.x + 10, z: hf.player.z, stunT: 0, rollT: 0 }]
  const hx0 = hf.spiders[0].x
  for (let i = 0; i < 60 * 3 && phaseOf(hf) !== 'dead'; i++) Spider.update(hf, DT, hfs)
  ok(hf.spiders.length === 0 || hf.spiders[0].x < hx0 - 0.5 || phaseOf(hf) === 'dead',
    '굶주리면 손전등을 비춰도 다가온다')

  /* 횃불 — 반경 6타일 5초 확정 */
  const { state: tt } = newRun()
  tt.player.torchCharges = 5
  tt.spiders = [
    { id: 1, x: tt.player.x + 3, z: tt.player.z, stunT: 0, rollT: 0 },
    { id: 2, x: tt.player.x + 20, z: tt.player.z, stunT: 0, rollT: 0 },
  ]
  ok(Spider.useTorch(tt), '횃불을 쓴다')
  eq(tt.player.torchCharges, 4, '한 번 소모')
  eq(tt.spiders[0].stunT, 5, '가까운 거미는 5초 정지')
  eq(tt.spiders[1].stunT, 0, '먼 거미는 안 걸린다')
  tt.player.torchCharges = 0
  ok(!Spider.useTorch(tt), '없으면 못 쓴다')

  /* 억제 송신기 */
  const { state: sup } = newRun()
  light(sup, 1)
  sup.buildings.push({ id: 1, type: 'spider_suppressor', x: CENTER, z: CENTER })
  near(Spider.spiderSpeed(sup), 3.6 * 0.65, 1e-9, '송신기가 35% 늦춘다')

  /* 굶주린 밤 모디파이어 */
  const hungry = newRun('H', 'pilot', 'hungry_night').state
  light(hungry, 1)
  eq(Spider.spiderCount(hungry), 2, '굶주린 밤은 불이 있어도 두 마리')

  void solids
}

// ══════════════════════════════════════════════════════
section('★ 습격 — 밤에 할 일이 생긴다 (§13)')
{
  const { state: s } = newRun()
  eq(s.raid.nextDay, 4, '첫 습격은 4일')
  ok(!Raid.isRaidDay(s), '1일은 습격일이 아니다')
  s.day = 4
  ok(Raid.isRaidDay(s), '4일은 습격일')

  /* 예고 */
  Raid.announceMorning(s)
  ok(s.banner !== null, '아침에 예고한다')
  ok(s.raid.announced, '예고 표시')

  /* 스폰 */
  Raid.beginNight(s)
  ok(s.raid.active, '습격 시작')
  eq(s.raiders.length, 2, '1차는 도끼 둘(§13.2)')
  for (const r of s.raiders) {
    near(distance(r.x, r.z, CENTER, CENTER), BALANCE.raid.spawnRadius, 0.01, '캠프 바깥 원주에서 나온다')
  }

  /* ★ 아침까지 못 잡으면 화력 감소 2배(§13.3) */
  s.day = 5
  Raid.resolveMorning(s)
  ok(s.raid.failed, '실패로 기록')
  eq(s.campfire.drainMultiplier, 2, '화력 감소 2배')
  eq(s.raid.nextDay, 9, '다음 습격은 4일 뒤')

  /* 다음 습격을 막으면 풀린다 — 죽음의 나선에서 나올 길(§부록B-6) */
  s.day = 9
  Raid.beginNight(s)
  s.raiders = []
  s.day = 10
  Raid.resolveMorning(s)
  ok(!s.raid.failed, '전멸시키면 실패가 풀린다')
  eq(s.campfire.drainMultiplier, 1, '화력 감소가 정상으로')

  /* 회차별 구성(§13.2) */
  eq(Raid.waveFor(1).axe, 2, '1차: 도끼 2')
  eq(Raid.waveFor(2).spear, 4, '2차: 창 4')
  eq(Raid.waveFor(2).bow, 2, '2차: 석궁 2')
  eq(Raid.waveFor(4).giant, 0, '5차까지는 거대 약탈자 없음')
  eq(Raid.waveFor(6).giant, 1, '6차부터 거대 약탈자 1')
  eq(Raid.waveFor(13).giant, 2, '13차부터 둘')

  /* 잦은 습격 모디파이어 */
  const freq = newRun('F', 'pilot', 'frequent_raids').state
  eq(Raid.raidStride(freq), 3, '잦은 습격은 3일마다')

  /* 약탈자가 벽을 부순다 */
  const { state: w, solids: ws } = newRun()
  w.buildings.push({ id: 1, type: 'wall_wood', x: CENTER + 5, z: CENTER, hp: 200, maxHp: 200 })
  Raiders.spawnRaider(w, 'raider_axe', CENTER + 5.5, CENTER)
  for (let i = 0; i < 60 * 6; i++) Raiders.updateAll(w, DT, ws)
  eq(w.buildings.filter((b) => b.type === 'wall_wood').length, 0, '나무 벽(HP200)이 부서진다')

  /* 강철 벽은 더 오래 버틴다 */
  const { state: w2, solids: ws2 } = newRun()
  w2.buildings.push({ id: 1, type: 'wall_steel', x: CENTER + 5, z: CENTER, hp: 600, maxHp: 600 })
  Raiders.spawnRaider(w2, 'raider_axe', CENTER + 5.5, CENTER)
  for (let i = 0; i < 60 * 6; i++) Raiders.updateAll(w2, DT, ws2)
  ok(w2.buildings.some((b) => b.type === 'wall_steel'), '강철 벽(HP600)은 6초로는 안 부서진다')

  /* 석궁은 화살을 날린다 */
  const { state: b, solids: bs } = newRun()
  Raiders.spawnRaider(b, 'raider_bow', b.player.x + 8, b.player.z)
  for (let i = 0; i < 30; i++) Raiders.updateAll(b, DT, bs)
  ok(b.bullets.some((x) => !x.fromPlayer), '석궁이 화살을 쏜다')

  /* ★ §13.5 — 습격 중에도 거미는 온다 */
  const { state: both, solids: bos } = newRun()
  both.day = 4
  both.phase = 'night'
  light(both, 2)
  Raid.beginNight(both)
  Spider.spawnForNight(both)
  ok(both.raiders.length > 0 && both.spiders.length > 0, '약탈자와 거미가 함께 있다')
  Spider.update(both, DT, bos)
  Raiders.updateAll(both, DT, bos)
  ok(true, '둘이 같이 돌아도 안 터진다')
}

// ══════════════════════════════════════════════════════
section('날씨 (§15)')
{
  const { state: s } = newRun()
  eq(Weather.effective(s), 'clear', '처음엔 맑음')
  near(Weather.visionFactor(s), 1, 1e-9, '시야 정상')
  ok(!Weather.navDisabled(s), '나침반 정상')

  s.weather.kind = 'spore_fog'
  s.weather.remain = 60
  near(Weather.visionFactor(s), 0.5, 1e-9, '포자 안개는 시야 50%')

  s.weather.kind = 'magnetic_storm'
  ok(Weather.navDisabled(s), '자기폭풍은 나침반을 막는다')

  /* ★ 낙뢰는 자기폭풍 중 + 5초 이상 정지 + 예고 뒤에만(§15) */
  const { state: st } = newRun()
  st.weather.kind = 'magnetic_storm'
  st.weather.remain = 200
  st.player.stillT = 0
  st.player.suit = 100
  for (let i = 0; i < 60 * 4; i++) Weather.update(st, DT)
  eq(st.player.suit, 100, '4초 서 있어도 안 떨어진다')

  st.player.stillT = 6
  Weather.update(st, DT)
  ok(st.player.stormWarnT > 0, '5초를 넘기면 예고가 뜬다')
  ok(st.events.includes('stormWarn'), '예고 이벤트')
  for (let i = 0; i < 60 * 2; i++) {
    st.player.stillT = 6
    Weather.update(st, DT)
  }
  ok(st.player.suit < 100, '예고 뒤에 낙뢰가 떨어진다')

  /* 움직이면 안 맞는다 */
  const { state: mv } = newRun()
  mv.weather.kind = 'magnetic_storm'
  mv.weather.remain = 200
  mv.player.suit = 100
  for (let i = 0; i < 60 * 20; i++) {
    mv.player.stillT = 0
    Weather.update(mv, DT)
  }
  eq(mv.player.suit, 100, '계속 움직이면 낙뢰를 안 맞는다')

  /* 산성비는 우주복을 깎는다 */
  const { state: ac } = newRun()
  ac.weather.kind = 'acid_rain'
  ac.weather.remain = 200
  for (let i = 0; i < 60 * 10; i++) Weather.update(ac, DT)
  near(100 - ac.player.suit, BALANCE.weather.acidSuitDrain * 10, 0.2, '산성비는 초당 0.3')

  /* 기상 안정기가 둘을 무효로 만든다 */
  const { state: stab } = newRun()
  stab.buildings.push({ id: 1, type: 'weather_stabilizer', x: CENTER, z: CENTER })
  stab.weather.kind = 'acid_rain'
  stab.weather.remain = 200
  eq(Weather.effective(stab), 'clear', '안정기가 산성비를 막는다')
  stab.weather.kind = 'magnetic_storm'
  eq(Weather.effective(stab), 'clear', '안정기가 자기폭풍을 막는다')
  stab.weather.kind = 'spore_fog'
  eq(Weather.effective(stab), 'spore_fog', '안개는 안정기로 못 막는다 — 시야 문제라서')

  /* 날씨는 끝난다 */
  const { state: end } = newRun()
  end.weather.kind = 'acid_rain'
  end.weather.remain = 1
  for (let i = 0; i < 120; i++) Weather.update(end, DT)
  eq(end.weather.kind, 'clear', '시간이 지나면 갠다')
}

// ══════════════════════════════════════════════════════
section('★ 잔해 채취 — 무한 고철 (§7.4)')
{
  const { state: s } = newRun()
  ok(s.salvageNodes.length > 0, '채취장이 있다')
  Salvage.begin(s, s.salvageNodes[0].id)
  ok(s.salvage.active, '채취 시작')

  /* 표시가 왕복한다 */
  const marks: number[] = []
  for (let i = 0; i < 200; i++) {
    Salvage.update(s, DT)
    marks.push(s.salvage.marker)
  }
  ok(Math.max(...marks) > 0.8 && Math.min(...marks) < 0.9, '표시가 움직인다')
  ok(marks.every((m) => m >= 0 && m <= 1), '표시가 범위를 안 벗어난다')

  /* 정확히 가운데면 Perfect */
  s.salvage.marker = 0.5
  s.salvage.cooldown = 0
  eq(Salvage.strike(s), 'perfect', '가운데는 PERFECT')
  eq(countItem(s, 'scrap'), 4, 'Perfect 는 고철 4')

  /* Good 구간 */
  const w = Salvage.windows(s)
  s.salvage.marker = 0.5 + w.good / 2 - 0.005
  s.salvage.cooldown = 0
  eq(Salvage.strike(s), 'good', 'Good 구간')
  eq(countItem(s, 'scrap'), 6, 'Good 은 고철 2 추가')

  /* 빗나가면 쿨다운 */
  s.salvage.marker = 0.02
  s.salvage.cooldown = 0
  eq(Salvage.strike(s), 'miss', '멀면 MISS')
  eq(s.salvage.cooldown, BALANCE.salvage.missCooldown, '3초 쿨다운')
  eq(Salvage.strike(s), null, '쿨다운 중에는 못 친다')

  /* 숙련도가 오르면 판정이 넓어진다 */
  const { state: lv } = newRun()
  Salvage.begin(lv, 1)
  const w0 = Salvage.windows(lv)
  for (let i = 0; i < 12; i++) {
    lv.salvage.marker = 0.5
    lv.salvage.cooldown = 0
    Salvage.strike(lv)
  }
  eq(lv.salvage.level, 1, '12회 성공이면 2단계')
  const w1 = Salvage.windows(lv)
  ok(w1.perfect > w0.perfect, '판정 구간이 넓어진다')

  /* 직책 고철상은 판정이 두 배 */
  const scr = newRun('SC', 'scrapper').state
  Salvage.begin(scr, 1)
  const ws = Salvage.windows(scr)
  near(ws.perfect, w0.perfect * 2, 1e-9, '고철상은 판정 구간 2배')
  eq(countItem(scr, 'scrap'), 30, '고철상은 고철 30으로 시작')

  /* ★ §7.4 — 분당 40~50 고철이 나오는가 */
  {
    const { state: t } = newRun()
    Salvage.begin(t, 1)
    let scrapGained = 0
    let sec = 0
    /* 숙련자를 흉내낸다 — 표시가 가운데에 올 때 친다 */
    while (sec < 60) {
      Salvage.update(t, DT)
      sec += DT
      if (t.salvage.cooldown <= 0 && Math.abs(t.salvage.marker - 0.5) < 0.02) {
        const before = countItem(t, 'scrap')
        Salvage.strike(t)
        scrapGained += countItem(t, 'scrap') - before
      }
    }
    process.stdout.write(`   숙련자 기준 분당 고철: ${scrapGained}\n`)
    ok(scrapGained >= 25 && scrapGained <= 90, `분당 고철이 기획 범위 안 — ${scrapGained}`)
  }
}

// ══════════════════════════════════════════════════════
section('제작 모듈 — 5레벨 (§8)')
{
  const { state: s } = newRun()
  eq(s.moduleLevel, 1, '1레벨에서 시작')

  ok(!Crafting.canCraft(s, 'bed'), '재료가 없으면 못 만든다')
  addItem(s, 'log', 20)
  s.player.x = CENTER
  s.player.z = CENTER
  ok(Crafting.craft(s, 'bed'), '침대 제작')
  eq(TimeSystem.dayRate(s), 2, '날짜 증가량이 오른다')

  /* 침대는 본선 근처에만 */
  addItem(s, 'log', 20)
  s.player.x = CENTER + 40
  eq(Crafting.blockedReason(s, 'bed'), 'placement', '멀면 못 놓는다')
  s.player.x = CENTER

  /* ★ 침대 최대 4개 — 다른 레시피로도 우회 불가 */
  for (let i = 0; i < 8; i++) {
    addItem(s, 'log', 20)
    Crafting.craft(s, 'bed')
  }
  eq(TimeSystem.bedCount(s), 4, '침대는 4개가 최대')
  eq(Crafting.blockedReason(s, 'bed'), 'max', '더는 못 놓는다')
  s.moduleLevel = 5
  for (const alt of ['bed_scrap', 'bed_alloy']) {
    addItem(s, 'scrap', 60)
    addItem(s, 'log', 30)
    eq(Crafting.blockedReason(s, alt), 'max', `${alt} 로도 우회할 수 없다`)
  }
  eq(TimeSystem.bedCount(s), 4, '우회를 시도해도 4개')

  /* 레벨 게이트 */
  const { state: l } = newRun()
  eq(Crafting.blockedReason(l, 'recovery_capsule'), 'level', '2레벨 물건은 잠겨 있다')
  eq(Crafting.blockedReason(l, 'time_accelerator'), 'level', '5레벨 물건도 잠겨 있다')
  addItem(l, 'log', 10)
  addItem(l, 'scrap', 5)
  ok(Crafting.upgradeModule(l), 'Lv2 로 올린다')
  eq(l.moduleLevel, 2, 'Lv2')

  /* 업그레이드 비용(§8.1) */
  eq(Crafting.upgradeCost(1)?.log, 10, '1→2 통나무 10')
  eq(Crafting.upgradeCost(2)?.scrap, 15, '2→3 고철 15')
  eq(Crafting.upgradeCost(3)?.scrap, 40, '3→4 고철 40')
  eq(Crafting.upgradeCost(4)?.meteorite, 2, '4→5 는 운석 파편 2')
  eq(Crafting.upgradeCost(5), null, '5가 끝')

  /* ★ §8.6 — 5레벨의 존재 이유는 시간 가속기, 그리고 운석 파편이 필요하다 */
  const { state: acc } = newRun()
  acc.moduleLevel = 5
  addItem(acc, 'scrap', 100)
  eq(Crafting.blockedReason(acc, 'time_accelerator'), 'cost', '운석 파편이 없으면 못 만든다')
  addItem(acc, 'meteorite', 3)
  eq(Crafting.blockedReason(acc, 'time_accelerator'), null, '파편이 있으면 만든다')
  ok(Crafting.craft(acc, 'time_accelerator'), '시간 가속기 제작')
  eq(TimeSystem.dayRate(acc), 4, '가속기는 +3')

  /* ★ 도크가 없으면 탈출 장비를 못 만든다 */
  const { state: e } = newRun()
  e.moduleLevel = 4
  e.coreParts.push('core_radar')
  addItem(e, 'scrap', 60)
  addItem(e, 'log', 40)
  eq(Crafting.blockedReason(e, 'escape_radar'), 'dockMissing', '도크가 먼저다')
  e.dockBuilt = true
  eq(Crafting.blockedReason(e, 'escape_radar'), null, '도크가 있으면 만든다')
  ok(Crafting.craft(e, 'escape_radar'), '레이더 제작')
  eq(e.coreParts.length, 0, '핵심 부품이 소모된다')
  eq(Crafting.blockedReason(e, 'escape_radar'), 'alreadyBuilt', '두 번은 못 만든다')

  /* 우주복 업그레이드는 최대치만 */
  const { state: u } = newRun()
  u.moduleLevel = 3
  addItem(u, 'scrap', 30)
  addItem(u, 'log', 15)
  u.player.suit = 50
  Crafting.craft(u, 'suit_upgrade')
  eq(u.player.maxSuit, 150, '최대치가 150')
  eq(u.player.suit, 50, '지금 값은 안 채운다 — 회복 캡슐 전용 규칙')

  /* 스튜 */
  const { state: pot } = newRun()
  pot.buildings.push({ id: 1, type: 'cooking_pot', x: CENTER, z: CENTER })
  addItem(pot, 'meat_large_cooked', 2)
  addItem(pot, 'carrot', 2)
  ok(Crafting.cookStew(pot), '스튜를 만든다')
  eq(countItem(pot, 'stew'), 1, '스튜 1개')
  eq(countItem(pot, 'carrot'), 0, '채소가 소모된다')

  /* 직책 정비공 */
  const mech = newRun('M', 'mechanic').state
  eq(mech.moduleLevel, 2, '정비공은 Lv2 로 시작')
  eq(countItem(mech, 'axe_iron'), 1, '철 도끼도 받는다')
}

// ══════════════════════════════════════════════════════
section('★ 보급함 — 불 레벨이 곧 상자 등급 (§9)')
{
  const { state: s } = newRun()
  ok(s.caches.length > 0, '보급함이 배치된다')
  const red = s.caches.filter((c) => c.tier === 'red')
  eq(red.length, 2, '적색 보급함은 맵 전체에 둘')

  /* 등급마다 필요한 불 레벨 */
  for (const t of CACHES) {
    if (t.id === 'red') continue
    ok(t.fireLevel >= 2 && t.fireLevel <= 6, `${t.name} 은 Lv${t.fireLevel} 필요`)
  }
  const byTier = new Map(CACHES.map((t) => [t.id, t]))
  eq(byTier.get('common')!.fireLevel, 2, '일반은 Lv2')
  eq(byTier.get('gold')!.fireLevel, 6, '금은 Lv6')
  eq(byTier.get('red')!.fireLevel, 0, '적색은 불 레벨 무관')

  /* 전초기지를 깨면 적색 보급함이 하나 더 */
  const before = s.caches.filter((c) => c.tier === 'red').length
  ok(Raid.clearOutpost(s, s.outposts[0].id), '전초기지 제압')
  eq(s.caches.filter((c) => c.tier === 'red').length, before + 1, '적색 보급함이 생긴다')
  ok(!Raid.clearOutpost(s, s.outposts[0].id), '두 번은 안 된다')
}

// ══════════════════════════════════════════════════════
section('연구소 & 대원 (§12)')
{
  const { state: s } = newRun()
  eq(s.labs.length, 4, '연구소 넷')
  eq(new Set(s.labs.map((l) => l.tier)).size, 4, '단계가 하나씩')
  eq(new Set(s.labs.map((l) => l.crew)).size, 4, '대원이 하나씩')

  const lab = s.labs.find((l) => l.tier === 1)!
  s.player.x = lab.x
  s.player.z = lab.z
  ok(Labs.enter(s, lab), '진입')
  ok(s.activeLab !== null, '교전 중')
  eq(Labs.remaining(s), 6, '늑대 여섯')

  /* ★ 안에서는 시간이 안 흐른다 */
  const before = s.phaseT
  for (let i = 0; i < 60 * 10; i++) TimeSystem.update(s, DT)
  eq(s.phaseT, before, '10초를 굴려도 시간이 안 간다')

  /* 밖으로 못 나간다 */
  s.player.x = lab.x + 40
  Labs.update(s)
  near(distance(s.player.x, s.player.z, lab.x, lab.z), Labs.LAB_RADIUS, 0.01, '경계에 붙잡힌다')

  /* ★ 한 마리라도 남으면 안 열린다 */
  s.player.x = lab.x
  s.player.z = lab.z
  for (let i = 0; i < s.beasts.length - 1; i++) s.beasts[i].hp = 0
  s.beasts = s.beasts.filter((b) => b.hp > 0)
  eq(Labs.remaining(s), 1, '한 마리 남았다')
  Labs.update(s)
  ok(s.activeLab !== null, '한 마리라도 남으면 문이 안 열린다')
  eq(s.crew.length, 0, '보상도 아직 없다')

  /* 전멸시키면 대원 + 핵심 부품 */
  s.beasts = []
  Labs.update(s)
  eq(s.activeLab, null, '문이 열린다')
  ok(lab.cleared, '공략 완료')
  eq(s.crew.length, 1, '대원 구출')
  eq(s.coreParts.length, 1, '핵심 부품 획득')
  eq(TimeSystem.dayRate(s), 2, '날짜 증가량 +1')

  /* 나침반 */
  const target = Labs.compassTarget(s)
  ok(target !== null && !target.cleared, '미공략만 가리킨다')
  s.weather.kind = 'magnetic_storm'
  s.weather.remain = 60
  eq(Labs.compassTarget(s), null, '자기폭풍 중에는 나침반이 안 듣는다')
  s.weather.kind = 'clear'
  for (const l of s.labs) l.cleared = true
  eq(Labs.compassTarget(s), null, '다 깨면 가리킬 것이 없다')
}

// ══════════════════════════════════════════════════════
section('★ 대원 AI — §부록B-4 가 의심하는 부분')
{
  /* 로한 — 저장고에서 꺼내 불에 넣는다 */
  const { state: s } = newRun()
  light(s, 1)
  s.crew.push('rohan')
  s.crewT.rohan = 0
  s.buildings.push({ id: 1, type: 'wood_storage', x: CENTER, z: CENTER, store: [{ id: 'log', count: 10 }] })
  const heat0 = s.campfire.heat
  for (let i = 0; i < 60 * 31; i++) Crew.updateAll(s, DT)
  ok(s.campfire.heat > heat0, '로한이 연료를 넣는다')
  eq(Inv.totalStored(s, 'log'), 9, '저장고에서 하나 빠진다')

  /* ★ 저장고가 비면 아무것도 못 한다 — 압박이 "연료 모으기"로 옮겨 갈 뿐 */
  const { state: empty } = newRun()
  light(empty, 1)
  empty.crew.push('rohan')
  empty.crewT.rohan = 0
  empty.buildings.push({ id: 1, type: 'wood_storage', x: CENTER, z: CENTER, store: [] })
  const h0 = empty.campfire.heat
  for (let i = 0; i < 60 * 90; i++) Crew.updateAll(empty, DT)
  ok(empty.campfire.heat <= h0, '저장고가 비면 로한도 못 넣는다')

  /* 로한이 캠프파이어 압박을 없애는가 — 실제로 재 본다 */
  {
    const { state: t } = newRun()
    light(t, 4)
    t.crew.push('rohan')
    t.crewT.rohan = 0
    t.buildings.push({
      id: 1, type: 'wood_storage', x: CENTER, z: CENTER,
      store: [{ id: 'log', count: 25 }],
    })
    let sec = 0
    while (t.campfire.level >= 4 && sec < 2000) {
      Campfire.update(t, 1)
      Crew.updateAll(t, 1)
      sec++
    }
    process.stdout.write(`   로한 + 저장고 25통나무로 Lv4 유지: ${sec}초\n`)
    /* 통나무 25개 = 250 화력. Lv4 는 초당 1.8 이라 로한이 30초에 10씩
       넣어도(초당 0.33) 못 버틴다. 압박이 사라지지 않는다. */
    ok(sec < 900, `로한이 있어도 Lv4 는 오래 못 버틴다 — ${sec}초`)
  }

  /* 미라 — 밭 주기 단축 + 자동 수확 */
  const { state: m } = newRun()
  eq(Crew.farmGrowDays(m), 2, '기본 2일')
  m.crew.push('mira')
  eq(Crew.farmGrowDays(m), 1.5, '미라가 있으면 1.5일')
  m.buildings.push({ id: 1, type: 'farm', x: CENTER, z: CENTER, crop: 'carrot', timerDays: 0 })
  Crew.autoHarvest(m)
  eq(countItem(m, 'carrot'), 1, '미라가 자동으로 거둔다')

  /* 카이 — 캠프 근처의 적을 쏜다 */
  const { state: k } = newRun()
  k.crew.push('kai')
  k.crewT.kai = 99
  const pos = Crew.crewPosition(0, 1)
  Raiders.spawnRaider(k, 'raider_axe', pos.x + 3, pos.z)
  const hp0 = k.raiders[0].hp
  for (let i = 0; i < 60 * 3; i++) Crew.updateAll(k, DT)
  ok(k.raiders.length === 0 || k.raiders[0].hp < hp0, '카이가 약탈자를 쏜다')

  /* 엘렌 — 지도 공개 */
  const { state: e } = newRun()
  ok(!Crew.revealsMap(e), '엘렌이 없으면 안 보인다')
  e.crew.push('ellen')
  ok(Crew.revealsMap(e), '엘렌이 있으면 보인다')

  /* 직책 관제사 — 대원 하나로 시작 */
  const ctrl = newRun('C', 'controller').state
  eq(ctrl.crew.length, 1, '관제사는 대원 하나로 시작')
  ok(hasCrew(ctrl, 'rohan'), '로한이 이미 있다')
  eq(TimeSystem.dayRate(ctrl), 2, '시작부터 +2일')
}

// ══════════════════════════════════════════════════════
section('자원 — 캐면 사라지고, 들고 있으면 썩는다 (§7)')
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
  eq(countItem(s, 'log'), 3, '통나무 3개')
  eq(countItem(s, 'sapling'), 1, '묘목 1개')

  /* 도끼 티어(§7.2) */
  eq(Inv.chopsNeeded(s, 'tree_small'), 13, '낡은 도끼 13타')
  s.player.equipped = 'axe_iron'
  eq(Inv.chopsNeeded(s, 'tree_small'), 6, '철 도끼 6타')
  s.player.equipped = 'axe_alloy'
  eq(Inv.chopsNeeded(s, 'tree_small'), 3, '합금 도끼 3타')
  s.player.equipped = 'cutter'
  eq(Inv.chopsNeeded(s, 'tree_small'), 1, '절단기 1타')
  eq(Inv.chopsNeeded(s, 'tree_large'), 3, '절단기는 큰 나무도 3타')

  /* 낡은 도끼는 60타에 부러진다 */
  const { state: d } = newRun()
  d.player.equipped = 'axe_old'
  d.player.axeDurability = 60
  let swings = 0
  for (let i = 0; i < 60; i++) {
    d.trees.push({ id: 90000 + i, kind: 'tree_large', x: d.player.x, z: d.player.z, hits: 0, growT: 0 })
    if (Inv.chop(d)) swings++
  }
  eq(swings, 60, '60번 팼다')
  eq(d.player.equipped, null, '60타 뒤 부러진다')

  /* 큰 나무는 묘목이 없다 */
  const { state: b } = newRun()
  const big = b.trees.find((t) => t.kind === 'tree_large')!
  b.player.x = big.x
  b.player.z = big.z
  b.player.equipped = 'axe_alloy'
  for (let i = 0; i < 7; i++) Inv.chop(b)
  eq(countItem(b, 'log'), 15, '큰 나무는 통나무 15')
  eq(countItem(b, 'sapling'), 0, '묘목은 안 나온다')

  /* ★ 부패 — 10분 */
  const { state: r } = newRun()
  addItem(r, 'log', 20)
  for (let i = 0; i < 60 * 599; i++) Decay.update(r, DT)
  eq(countItem(r, 'log'), 20, '9분 59초까지는 멀쩡하다')
  for (let i = 0; i < 60 * 3; i++) Decay.update(r, DT)
  eq(countItem(r, 'log'), 0, '10분이면 전부 썩는다')

  /* 나중에 주운 것은 나중에 썩는다 */
  const { state: r2 } = newRun()
  addItem(r2, 'log', 5)
  for (let i = 0; i < 60 * 300; i++) Decay.update(r2, DT)
  addItem(r2, 'log', 7)
  for (let i = 0; i < 60 * 301; i++) Decay.update(r2, DT)
  eq(countItem(r2, 'log'), 7, '먼저 주운 다섯만 썩는다')

  /* 저장고 안은 안전하다 */
  const { state: st } = newRun()
  st.buildings.push({ id: 1, type: 'wood_storage', x: CENTER, z: CENTER, store: [] })
  addItem(st, 'log', 25)
  Decay.update(st, DT)
  eq(Inv.storeFuel(st, 'log', 25), 25, '25개를 넣는다')
  eq(countItem(st, 'log'), 0, '가방에서는 빠진다')
  for (let i = 0; i < 60 * 1200; i++) Decay.update(st, DT)
  eq(Inv.totalStored(st, 'log'), 25, '20분이 지나도 저장고 안은 안 썩는다')
  eq(Decay.trackedLogs(st), 0, '저장고로 옮긴 것은 더 안 센다')
  eq(Inv.withdrawFuel(st, 'log', 25), 25, '다시 꺼낸다')

  /* 저장고 용량 25 */
  const { state: cap } = newRun()
  cap.buildings.push({ id: 1, type: 'wood_storage', x: CENTER, z: CENTER, store: [] })
  addItem(cap, 'log', 50)
  eq(Inv.storeFuel(cap, 'log', 50), 25, '저장고 하나에 25개까지')

  /* 상위 연료도 저장고에 들어간다 — 로한이 쓸 수 있어야 한다 */
  const { state: gs } = newRun()
  gs.buildings.push({ id: 1, type: 'wood_storage', x: CENTER, z: CENTER, store: [] })
  addItem(gs, 'gastank', 3)
  eq(Inv.storeFuel(gs, 'gastank', 3), 3, '가스 통도 저장된다')
  eq(Inv.takeBestFuelFromStorage(gs), 'gastank', '로한은 가장 좋은 것부터 꺼낸다')

  /* 묘목은 5분 뒤 자란다 */
  const { state: sap } = newRun()
  addItem(sap, 'sapling', 1)
  ok(Inv.plantSapling(sap), '묘목을 심는다')
  const planted = sap.trees[sap.trees.length - 1]
  for (let i = 0; i < 60 * 301; i++) Decay.update(sap, DT)
  eq(planted.kind, 'tree_small', '5분 뒤 작은 나무가 된다')

  /* 잡동사니 분해 */
  const { state: g } = newRun()
  for (let i = 0; i < g.player.slots.length; i++) g.player.slots[i] = null
  addItem(g, 'junk_screw', 1)
  addItem(g, 'junk_tire', 1)
  addItem(g, 'junk_engine', 1)
  eq(Inv.grindJunk(g), 8, '나사1 + 타이어3 + 엔진4 = 8')

  /* 잡동사니는 한 칸씩 */
  for (const [id, def] of Object.entries(ITEMS)) {
    if (def.kind === 'junk') eq(def.stack, 1, `${id} 는 한 칸씩 차지한다`)
  }
  const { state: inv } = newRun()
  for (let i = 0; i < inv.player.slots.length; i++) inv.player.slots[i] = null
  const slots = inv.player.slots.length
  eq(addItem(inv, 'junk_tire', 20), 20 - slots, `타이어는 ${slots}개까지만`)
  eq(freeSlots(inv), 0, '가방이 꽉 찬다')

  /* 인벤토리 기본 */
  const { state: iv } = newRun()
  for (let i = 0; i < iv.player.slots.length; i++) iv.player.slots[i] = null
  addItem(iv, 'scrap', 50)
  ok(removeItem(iv, 'scrap', 20), '덜어내기')
  eq(countItem(iv, 'scrap'), 30, '남은 개수')
  ok(!removeItem(iv, 'scrap', 99), '없는 만큼은 못 덜어낸다')
  eq(countItem(iv, 'scrap'), 30, '실패해도 안 줄어든다')
  ok(hasAll(iv, { scrap: 30 }), '있으면 있다고 한다')
  ok(payAll(iv, { scrap: 30 }), '값을 치른다')
  eq(countItem(iv, 'scrap'), 0, '치른 만큼 빠진다')
}

// ══════════════════════════════════════════════════════
section('몹 — 불 레벨이 스폰을 정한다 (§3.3)')
{
  const { state: s } = newRun()
  s.campfire.maxReachedLevel = 0
  ok(Animals.unlocked(s, 'rabbit'), 'Lv0 이면 토끼')
  ok(!Animals.unlocked(s, 'wolf'), 'Lv0 에는 늑대가 없다')
  s.campfire.maxReachedLevel = 2
  ok(Animals.unlocked(s, 'wolf'), 'Lv2 면 늑대')
  ok(!Animals.unlocked(s, 'mutant_wolf'), 'Lv2 에는 변이 늑대가 없다')
  s.campfire.maxReachedLevel = 5
  ok(Animals.unlocked(s, 'tiger'), 'Lv5 면 호랑이')
  ok(!Animals.unlocked(s, 'abyssal'), 'Lv5 에는 심연 개체가 없다')
  s.campfire.maxReachedLevel = 6
  ok(Animals.unlocked(s, 'abyssal'), 'Lv6 이면 심연 개체')

  /* 심연 개체가 운석 파편을 준다 — 소행성 말고 다른 경로 */
  eq(ENEMIES.abyssal.drops.meteorite, 1, '심연 개체는 운석 파편을 떨군다')

  /* 캠프 안의 플레이어는 못 건드린다 */
  const { state: safe, solids: sfs } = newRun()
  light(safe, 3)
  safe.player.x = CENTER + 6
  safe.player.z = CENTER
  safe.beasts = []
  Animals.spawnBeast(safe, 'bear', CENTER + 7, CENTER)
  safe.beasts[0].state = 'chase'
  const suit0 = safe.player.suit
  for (let i = 0; i < 60 * 10; i++) Animals.updateAll(safe, DT, sfs)
  eq(safe.player.suit, suit0, '캠프 안에서는 짐승도 못 건드린다')

  /* ★ 불이 꺼지면 짐승도 들어온다 */
  safe.campfire.heat = 0
  Campfire.update(safe, DT)
  for (let i = 0; i < 60 * 5; i++) Animals.updateAll(safe, DT, sfs)
  ok(safe.player.suit < suit0, '불이 꺼지면 짐승도 캠프 안에서 문다')

  /* 밀렵꾼은 고기 2배 */
  const po = newRun('P', 'poacher').state
  for (let i = 0; i < po.player.slots.length; i++) po.player.slots[i] = null
  const rabbit = Animals.spawnBeast(po, 'rabbit', 0, 0)
  Animals.damageBeast(po, rabbit, 999)
  eq(countItem(po, 'meat_small_raw'), 4, '밀렵꾼은 고기 2배')
}

// ══════════════════════════════════════════════════════
section('전투 (§11)')
{
  const { state: s } = newRun()
  s.player.equipped = 'axe_iron'
  eq(Combat.meleeDamage(s), 30, '철 도끼 근접 30')
  const beast = Animals.spawnBeast(s, 'rabbit', s.player.x + 1, s.player.z)
  s.player.facing = 0
  ok(Combat.swing(s) !== null, '앞의 적을 벤다')

  const { state: b } = newRun()
  b.player.facing = 0
  Animals.spawnBeast(b, 'rabbit', b.player.x - 1, b.player.z)
  eq(Combat.swing(b), null, '뒤는 못 벤다')

  /* 총 */
  const { state: g, solids: gs } = newRun()
  addItem(g, 'pistol', 1)
  addItem(g, 'ammo_pistol', 12)
  g.player.gun = 'pistol'
  g.player.magazine = 6
  g.player.facing = 0
  ok(Bullets.fire(g, 'pistol'), '권총 발사')
  eq(g.player.magazine, 5, '탄창이 준다')
  eq(g.bullets.length, 1, '총알 하나')
  ok(!Bullets.fire(g, 'pistol'), '쿨다운 중에는 못 쏜다')

  const target = Animals.spawnBeast(g, 'wolf', g.player.x + 3, g.player.z)
  for (let i = 0; i < 30; i++) Bullets.update(g, DT, gs)
  ok(target.hp < 100 || g.beasts.length === 0, '총알이 맞는다')

  /* 샷건은 펠릿 10 */
  const { state: sg } = newRun()
  sg.player.gun = 'shotgun'
  sg.player.magazine = 3
  Bullets.fire(sg, 'shotgun')
  eq(sg.bullets.length, 10, '샷건은 펠릿 10발')

  /* 재장전 */
  const { state: r } = newRun()
  addItem(r, 'ammo_pistol', 12)
  r.player.gun = 'pistol'
  r.player.magazine = 0
  ok(Survival.startReload(r), '재장전 시작')
  for (let i = 0; i < 60 * 2; i++) Survival.update(r, DT)
  eq(r.player.magazine, 6, '탄창이 찬다')
  eq(countItem(r, 'ammo_pistol'), 6, '예비탄이 준다')

  /* 탄약 압착기 */
  const { state: pr } = newRun()
  pr.buildings.push({ id: 1, type: 'ammo_press', x: CENTER, z: CENTER })
  pr.player.gun = 'rifle'
  addItem(pr, 'scrap', 4)
  ok(Crafting.pressAmmo(pr), '고철 4 → 탄약 6')
  eq(countItem(pr, 'ammo_rifle'), 6, '소총 탄약 6발')

  /* 포탑은 고철을 먹는다 */
  const { state: t } = newRun()
  t.buildings.push({ id: 1, type: 'turret', x: CENTER, z: CENTER, cooldown: 0 })
  addItem(t, 'scrap', 5)
  /* 죽지 않을 만큼 단단한 놈으로 잰다. 죽으면 전리품(고철 3)이 들어와
     "포탑이 고철을 썼는가"를 못 본다 — 총량이 오히려 늘어난다. */
  const tough = Raiders.spawnRaider(t, 'raider_giant', CENTER + 3, CENTER)
  for (let i = 0; i < 60 * 5; i++) Combat.updateStructures(t, DT)
  eq(countItem(t, 'scrap'), 4, '포탑이 고철을 하나 쓴다')
  ok(tough.hp < 900, '포탑이 실제로 때린다')

  /* ★ 시체를 계속 때려도 전리품이 복사되지 않는다 */
  const { state: dup } = newRun()
  for (let i = 0; i < dup.player.slots.length; i++) dup.player.slots[i] = null
  const corpse = Raiders.spawnRaider(dup, 'raider_axe', 0, 0)
  Raiders.damageRaider(dup, corpse, 999)
  const once = countItem(dup, 'scrap')
  for (let i = 0; i < 50; i++) Raiders.damageRaider(dup, corpse, 999)
  eq(countItem(dup, 'scrap'), once, '시체를 50번 더 때려도 전리품은 한 번뿐')

  const { state: dup2 } = newRun()
  for (let i = 0; i < dup2.player.slots.length; i++) dup2.player.slots[i] = null
  const corpse2 = Animals.spawnBeast(dup2, 'wolf', 0, 0)
  Animals.damageBeast(dup2, corpse2, 999)
  const once2 = countItem(dup2, 'meat_large_raw')
  for (let i = 0; i < 50; i++) Animals.damageBeast(dup2, corpse2, 999)
  eq(countItem(dup2, 'meat_large_raw'), once2, '짐승 시체도 마찬가지')

  /* 덫 */
  const { state: tr } = newRun()
  tr.buildings.push({ id: 1, type: 'rabbit_trap', x: CENTER, z: CENTER, armed: true })
  Animals.spawnBeast(tr, 'rabbit', CENTER, CENTER)
  Combat.updateStructures(tr, DT)
  eq(countItem(tr, 'meat_small_raw'), 3, '토끼 덫은 고기 3개')
  eq(tr.buildings.filter((x) => x.type === 'rabbit_trap').length, 0, '발동한 덫은 사라진다')

  void beast
}

// ══════════════════════════════════════════════════════
section('소행성 밤 (§14)')
{
  const { state: s } = newRun()
  Asteroid.begin(s, 25)
  eq(s.phase, 'asteroid', '미니게임으로 넘어간다')
  eq(s.asteroid.tier, 1, '25일은 1단계')
  eq(Asteroid.tierForDay(50), 2, '50일은 2단계')
  eq(Asteroid.tierForDay(75), 3, '75일은 3단계')
  eq(Asteroid.tierForDay(99), 4, '99일은 4단계')

  const still = { up: false, down: false, left: false, right: false }
  s.allowedFailures = 9999
  let t = 0
  while (s.asteroid.active && t < 200) {
    Asteroid.update(s, DT, still)
    t += DT
  }
  near(t, BALANCE.asteroid.durationSeconds, 1, '90초')
  ok(phaseOf(s) !== 'dead', '버텨서 끝난 것')
  eq(countItem(s, 'meteorite'), 2, '★ 운석 파편 2개 — 제작 Lv5 로 가는 유일한 길')

  /* 단계가 오르면 빽빽하고 빨라진다 */
  const spawned: number[] = []
  const speeds: number[] = []
  for (const day of [25, 50, 75, 99]) {
    const { state: a } = newRun('AST')
    Asteroid.begin(a, day)
    a.allowedFailures = 9999
    const seen = new Set<object>()
    let sum = 0
    for (let i = 0; i < 60 * 30; i++) {
      Asteroid.update(a, DT, still)
      for (const r of a.asteroid.rocks) {
        if (!seen.has(r)) {
          seen.add(r)
          sum += Math.hypot(r.vx, r.vy)
        }
      }
    }
    spawned.push(seen.size)
    speeds.push(sum / Math.max(1, seen.size))
  }
  for (let i = 1; i < spawned.length; i++) {
    ok(spawned[i] > spawned[i - 1], `${i + 1}단계가 더 많이 쏟아진다 — ${spawned[i - 1]} → ${spawned[i]}`)
    ok(speeds[i] > speeds[i - 1], `${i + 1}단계가 더 빠르다`)
  }

  /* 누적 5회면 죽는다 */
  const { state: f } = newRun()
  Asteroid.begin(f, 50)
  f.asteroidFailures = 4
  f.asteroid.rocks = [{ x: f.asteroid.shipX, y: f.asteroid.shipY, vx: 0, vy: 0, r: 20 }]
  Asteroid.update(f, DT, still)
  eq(f.asteroidFailures, 5, '피격 누적')
  eq(phaseOf(f), 'dead', '5회면 죽는다')

  /* ★ 직책 조종사 — 판정이 실제로 작아지는가.

     데이터에 0.75 가 적혀 있는지만 보면 코드가 그 값을 안 읽어도 통과한다.
     같은 자리에 같은 돌을 놓고 맞는지 아닌지로 잰다. */
  const AST = BALANCE.asteroid
  const hitTest = (job: string, gap: number): boolean => {
    const { state: a } = newRun('HIT', job)
    Asteroid.begin(a, 25)
    a.allowedFailures = 9999
    a.asteroid.rocks = [{
      x: a.asteroid.shipX + AST.shipRadius + gap, y: a.asteroid.shipY,
      vx: 0, vy: 0, r: 1,
    }]
    a.asteroid.spawnT = 999
    Asteroid.update(a, DT, still)
    return a.asteroidFailures > 0
  }
  ok(hitTest('mechanic', 0), '정비공은 코앞의 돌에 맞는다')
  ok(!hitTest('pilot', 0), '조종사는 같은 돌을 피한다')
  ok(hitTest('pilot', -5), '조종사도 더 파고들면 맞는다')
}

// ══════════════════════════════════════════════════════
section('로그라이크 구조 (§16, §17)')
{
  /* §16.3 원칙 — 전투력을 직접 주지 않는다 */
  for (const j of JOBS) {
    const e = j.effects as Record<string, unknown>
    ok(e.damageBonus === undefined && e.hpBonus === undefined,
      `${j.name} 은 전투력을 직접 주지 않는다`)
  }

  /* §18 화폐 가성비 — 1런에 200~500 */
  {
    const { state: mid } = newRun()
    mid.day = 40
    mid.crew = ['rohan', 'mira']
    mid.moduleLevel = 3
    mid.campfire.maxReachedLevel = 4
    const gain = Run.blackboxGain(mid)
    const bb = BALANCE.blackbox
    /* §16.2 공식을 그대로 잰다. 범위만 보면 항 하나가 통째로 빠져도
       우연히 범위 안에 들어와 통과한다. */
    const want = Math.round(
      (40 * bb.perDay + 2 * bb.perCrew + 3 * bb.perCraftLevel + 4 * bb.perFireLevel)
      * mid.modifier.multiplier,
    )
    eq(gain, want, '도달일×2 + 대원×60 + 제작레벨×25 + 불레벨×20')
    process.stdout.write(`   중간 정도 런(40일·대원2·제작3·불4)의 블랙박스: ${gain}\n`)
    ok(gain >= 200 && gain <= 500, `1런에 200~500 — ${gain}`)

    mid.phase = 'escaped'
    eq(
      Run.blackboxGain(mid),
      Math.round((40 * bb.perDay + 2 * bb.perCrew + 3 * bb.perCraftLevel
        + 4 * bb.perFireLevel + bb.escapeBonus) * mid.modifier.multiplier),
      '탈출하면 +400',
    )
  }

  eq(Run.rankFor(40), 'S', '40분 S')
  eq(Run.rankFor(50), 'A', '50분 A')
  eq(Run.rankFor(70), 'B', '70분 B')
  eq(Run.rankFor(90), 'C', '90분 C')
  eq(Run.rankFor(120), 'D', '120분 D')

  /* §17.1 궤도 창 */
  eq(Run.currentWindow(50), 99, '아직 99일 창')
  eq(Run.currentWindow(99), 99, '99일 창')
  eq(Run.currentWindow(100), 124, '놓치면 124일')
  eq(Run.currentWindow(125), 149, '또 놓치면 149일')

  /* §17.2 엔딩 분기 */
  const { state: full } = newRun()
  full.day = 99
  full.crew = CREW.map((c) => c.id)
  eq(Run.endingFor(full), 'full', '정시 + 전원 = 완전 귀환')
  full.crew = ['rohan']
  eq(Run.endingFor(full), 'partial', '정시 + 일부 = 부분 귀환')
  full.day = 124
  eq(Run.endingFor(full), 'late', '124일 = 지연 귀환')

  /* 탈출 조건 */
  const { state: esc } = newRun()
  esc.day = 99
  ok(!Run.escapeReady(esc), '장비가 없으면 준비 안 됨')
  esc.toasts.length = 0
  ok(!Run.checkEscape(esc), '이륙 못 한다')
  /* ★ 99일 아침에 장비가 없으면 창이 그냥 지나간다. 아무 말도 없으면
     플레이어는 다음이 언제인지 모른 채 25일을 보낸다. */
  ok(esc.toasts.some((t) => t.text.includes('25일')), '99일에 놓치면 다음 창까지 25일이라고 알린다')

  const miss = newRun().state
  miss.day = 100
  miss.toasts.length = 0
  ok(!Run.checkEscape(miss), '100일에도 이륙 못 한다')
  ok(miss.toasts.some((t) => t.text.includes('24일')), '100일이면 24일 남았다')

  eq(Run.nextWindowIn(esc), 0, '99일에는 오늘이 창이다')
  eq(Run.nextWindowIn(miss), 24, '100일에는 24일 뒤')

  esc.dockBuilt = true
  esc.escapeBuilt = [...Run.ESCAPE_PARTS]
  ok(Run.escapeReady(esc), '장비가 다 있으면 준비됨')
  ok(Run.checkEscape(esc), '이륙')
  eq(phaseOf(esc), 'escaped', '탈출')

  /* 모디파이어가 보상 배율을 곱한다 */
  const calm = newRun('X', 'pilot', 'calm').state
  const hard = newRun('X', 'pilot', 'hungry_night').state
  calm.day = hard.day = 30
  ok(Run.blackboxGain(hard) > Run.blackboxGain(calm), '어려운 행성이 더 준다')

  /* 모디파이어가 세계를 바꾼다 */
  const rich = newRun('M', 'pilot', 'abundance').state
  const poor = newRun('M', 'pilot', 'metal_poor').state
  const plain = newRun('M', 'pilot', 'calm').state
  ok(rich.trees.length > plain.trees.length, '풍요는 자원이 많다')
  ok(poor.junk.length < plain.junk.length, '금속 결핍은 고철이 적다')
  const longDay = newRun('M', 'pilot', 'long_day').state
  eq(longDay.daySeconds, 240, '긴 낮 240초')
  const damp = newRun('M', 'pilot', 'damp_fuel').state
  light(damp, 3)
  near(Campfire.drainRate(damp), 1.2 * 1.4, 1e-9, '축축한 연료는 1.4배로 샌다')
}

// ══════════════════════════════════════════════════════
section('충돌 · 안개')
{
  const solids = [{ x: 50, z: 50, r: 1 }]
  const out = pushOut(50.2, 50, 0.38, solids)
  ok(Math.hypot(out.x - 50, out.z - 50) >= 1.38 - 1e-6, '겹치면 밀려난다')
  const exact = pushOut(50, 50, 0.38, solids)
  ok(Number.isFinite(exact.x) && Number.isFinite(exact.z), '정확히 겹쳐도 안 터진다')
  near(pushOut(80, 80, 0.38, solids).x, 80, 1e-9, '안 겹치면 안 움직인다')
  /* 맵 밖으로는 못 나간다 */
  const edge = pushOut(-100, -100, 0.38, [])
  ok(edge.x >= 2 && edge.z >= 2, '왼쪽 위 경계에서 잘린다')
  const edge2 = pushOut(99999, 99999, 0.38, [])
  ok(edge2.x <= TILES - 2 && edge2.z <= TILES - 2, '오른쪽 아래 경계에서 잘린다')

  ok(segmentBlocked(40, 50, 60, 50, 0.1, solids), '선분이 막힌다')
  ok(!segmentBlocked(40, 70, 60, 70, 0.1, solids), '비껴가면 안 막힌다')

  const rng = makeRng('collide')
  const many = Array.from({ length: 30 }, () => ({
    x: rng.range(20, 220), z: rng.range(20, 220), r: rng.range(0.5, 1.5),
  }))
  for (let i = 0; i < 3000; i++) {
    const p = pushOut(rng.range(20, 220), rng.range(20, 220), 0.38, many, 6)
    let inside = false
    for (const sd of many) {
      if (Math.hypot(p.x - sd.x, p.z - sd.z) < sd.r + 0.38 - 0.02) inside = true
    }
    ok(!inside, '어디로 밀어도 지형 안에 남지 않는다')
  }

  /* ★ 안개 — 장벽이 열려도 밟아야 기록된다(§6.2) */
  const { state: s } = newRun()
  eq(exploredCount(s), 0, '처음엔 아무것도 모른다')
  light(s, 6)
  eq(exploredCount(s), 0, '불을 최대로 키워도 지도는 안 그려진다')
  markExplored(s)
  const after = exploredCount(s)
  ok(after > 0, '밟으면 기록된다')
  s.player.x += 50
  markExplored(s)
  ok(exploredCount(s) > after, '걸어가면 늘어난다')
}

// ══════════════════════════════════════════════════════
section('★ 부록B-2 — 고철 470 / 통나무 290 / 파편 7 이 모이는가')
{
  const { state: s } = newRun('BALANCE')

  let logAvailable = 0
  for (const t of s.trees) logAvailable += t.kind === 'tree_small' ? 3 : t.kind === 'tree_large' ? 15 : 0
  let scrapAvailable = 0
  for (const j of s.junk) scrapAvailable += ITEMS[j.item].scrapValue ?? 0

  process.stdout.write(`   맵 매장량: 통나무 ${logAvailable} · 고철 ${scrapAvailable}\n`)

  const perZone: Record<number, { log: number; scrap: number }> = {}
  for (const p of ZONE_PLANS) perZone[p.zone] = { log: 0, scrap: 0 }
  for (const t of s.trees) {
    const z = zoneAt(distance(t.x, t.z, CENTER, CENTER)).id
    perZone[z].log += t.kind === 'tree_small' ? 3 : 15
  }
  for (const j of s.junk) {
    const z = zoneAt(distance(j.x, j.z, CENTER, CENTER)).id
    perZone[z].scrap += ITEMS[j.item].scrapValue ?? 0
  }
  for (const [z, v] of Object.entries(perZone)) {
    process.stdout.write(`   ${z}지대: 통나무 ${v.log} · 고철 ${v.scrap}\n`)
  }

  /* 런 전체 수요 = 탈출 장비 + 도크 + 모듈 업그레이드 + 침대 */
  const NEED_SCRAP = 470 + 80 + 140
  const NEED_LOG = 290 + 60 + 130 + 80
  const logRatio = logAvailable / NEED_LOG
  const scrapRatio = scrapAvailable / NEED_SCRAP
  process.stdout.write(`   런 전체 수요 대비: 통나무 ×${logRatio.toFixed(1)} · 고철 ×${scrapRatio.toFixed(1)}\n`)

  ok(logRatio >= 1.2, `통나무가 수요를 넘는다 — ×${logRatio.toFixed(1)}`)
  ok(scrapRatio >= 0.6, `노드만으로도 고철 수요의 절반은 된다 — ×${scrapRatio.toFixed(1)}`)
  /* 나머지는 잔해 채취가 메운다 — 그게 §7.4 의 존재 이유다 */
  ok(s.salvageNodes.length >= 5, `잔해 채취장이 충분하다 — ${s.salvageNodes.length}곳`)

  /* ★ 1지대만으로는 절대 안 된다 — 불을 키워야 하는 이유 */
  ok(perZone[1].scrap < NEED_SCRAP * 0.3, '1지대 고철로는 어림도 없다')
  ok(perZone[1].log < NEED_LOG * 0.5, '1지대 통나무도 모자란다')

  /* 운석 파편 7개 — 소행성 4회 × 2 = 8, 그리고 심연 개체·적색 보급함 */
  const fromAsteroids = BALANCE.asteroid.days.length * BALANCE.asteroid.fragmentReward
  process.stdout.write(`   소행성 밤으로 얻는 파편: ${fromAsteroids}개 (목표 7)\n`)
  ok(fromAsteroids >= 7, `소행성만으로 파편 7개가 된다 — ${fromAsteroids}`)

  /* ★ §부록B-2 — 지대별 왕복 시간 */
  const run = BALANCE.player.runSpeed
  for (const zone of BALANCE.zones) {
    const mid = (zone.innerRadius + Math.min(zone.outerRadius, 120)) / 2
    const roundTrip = (mid * 2) / run
    const farm = BALANCE.time.daySeconds - roundTrip
    process.stdout.write(`   ${zone.id}지대 왕복 ${roundTrip.toFixed(0)}초 → 파밍 ${farm.toFixed(0)}초\n`)
  }
  const z5 = BALANCE.zones[4]
  const far = (z5.innerRadius * 2) / run
  ok(far < BALANCE.time.daySeconds, `가장 먼 지대도 낮 안에 다녀온다 — ${far.toFixed(0)}초`)
}

// ══════════════════════════════════════════════════════
section('통합 — 한 판을 오래 굴려도 깨지지 않는가')
{
  const { state: s, solids } = newRun('SOAK')
  light(s, 3)

  let frames = 0
  const LIMIT = 60 * 60 * 12
  for (; frames < LIMIT; frames++) {
    /* 죽지 않게만 최소한으로 돌본다 — 여기서 보는 건 난이도가 아니라
       "값이 깨지거나 멈추지 않는가"다. */
    s.player.suit = s.player.maxSuit
    s.player.oxygen = s.player.maxOxygen
    s.player.hunger = s.player.maxHunger
    if (s.campfire.heat < 300) s.campfire.heat = 600

    for (const ev of TimeSystem.update(s, DT)) {
      if (ev.type === 'nightFall') {
        Spider.spawnForNight(s)
        Raid.beginNight(s)
      }
      if (ev.type === 'sunrise') {
        Raid.resolveMorning(s)
        Decay.harvestFarms(s)
        Animals.repopulate(s)
        Weather.rollForDay(s)
        Raid.announceMorning(s)
      }
    }
    if (s.phase === 'asteroid') {
      s.phase = 'day'
      s.asteroid.active = false
    }
    Campfire.update(s, DT)
    ZoneGate.update(s)
    Survival.update(s, DT)
    Weather.update(s, DT)
    Spider.update(s, DT, solids)
    Animals.updateAll(s, DT, solids)
    Raiders.updateAll(s, DT, solids)
    Crew.updateAll(s, DT)
    Bullets.update(s, DT, solids)
    Combat.updateStructures(s, DT)
    Decay.update(s, DT)
    Labs.update(s)
    s.events.length = 0

    if (frames % 900 === 0) {
      ok(Number.isFinite(s.player.x) && Number.isFinite(s.player.z), '플레이어 좌표가 유한')
      ok(s.player.x >= 0 && s.player.x <= TILES, '맵 안에 있다')
      for (const b of [...s.beasts, ...s.raiders]) {
        ok(Number.isFinite(b.x) && Number.isFinite(b.z), '적 좌표가 유한')
        ok(b.hp > 0, '죽은 적이 안 남아 있다')
      }
      for (const sp of s.spiders) ok(Number.isFinite(sp.x), '거미 좌표가 유한')
      ok(s.beasts.length < 400, `짐승이 무한히 늘지 않는다 — ${s.beasts.length}`)
      ok(s.raiders.length < 100, `약탈자가 무한히 늘지 않는다 — ${s.raiders.length}`)
      ok(s.campfire.level >= 0 && s.campfire.level <= 6, '캠프 레벨이 범위 안')
      ok(s.bullets.length < 500, '총알이 안 샌다')
    }
  }
  process.stdout.write(
    `   (12분 · ${s.day}일 · 짐승 ${s.beasts.length} · 약탈자 ${s.raiders.length} · 나무 ${s.trees.length})\n`,
  )
  ok(s.day > 1, '날짜가 흘렀다')
  ok(phaseOf(s) !== 'dead', '돌보는 동안은 안 죽는다')
}

// ══════════════════════════════════════════════════════
section('결과')
const MAX_SHOWN = Number(process.env.SHOW_FAILS || 30)
if (fail) {
  for (const f of fails.slice(0, MAX_SHOWN)) console.log('  ✗ ' + f)
  if (fails.length > MAX_SHOWN) console.log(`  ... 외 ${fails.length - MAX_SHOWN}건`)
}
console.log(`\n${fail === 0 ? '✅' : '❌'}  통과 ${pass} / 실패 ${fail}\n`)
process.exit(fail ? 1 : 0)
