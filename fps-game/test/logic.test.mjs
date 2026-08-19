/* Bunker Break — 순수 로직 테스트. 브라우저 없이 Node 에서 돈다. */
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/game')
const load = (f) => import(pathToFileURL(path.join(ROOT, f)).href)

const [rngM, arenaM, collideM, weaponsM, combatM, enemiesM, waveM, scoreM, playerM] =
  await Promise.all([
    load('rng.js'), load('arena.js'), load('collide.js'), load('weapons.js'),
    load('combat.js'), load('enemies.js'), load('waveSpawner.js'),
    load('score.js'), load('player.js'),
  ])

let pass = 0, fail = 0
const fails = []
function ok(cond, msg) {
  if (cond) pass++
  else { fail++; fails.push(msg) }
}
function eq(a, b, msg) { ok(Object.is(a, b) || a === b, `${msg} — got ${a}, want ${b}`) }
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, `${msg} — got ${a}, want ~${b}`) }
function section(n) { process.stdout.write(`\n── ${n}\n`) }

// ══════════════════════════════════════════════════════ rng
section('rng — 결정성')
{
  const { makeRng, hash32, variate, intOf } = rngM
  const a = makeRng('seed-1'), b = makeRng('seed-1')
  for (let i = 0; i < 200; i++) eq(a(), b(), '같은 씨앗 같은 수열')
  const c = makeRng('seed-2')
  const d = makeRng('seed-1')
  let diff = 0
  for (let i = 0; i < 50; i++) if (c() !== d()) diff++
  ok(diff > 45, '다른 씨앗은 다른 수열')

  const r = makeRng(42)
  let lo = 1, hi = 0
  for (let i = 0; i < 20000; i++) { const v = r(); lo = Math.min(lo, v); hi = Math.max(hi, v) }
  ok(lo >= 0 && hi < 1, 'rng 범위 [0,1)')
  ok(lo < 0.001 && hi > 0.999, 'rng 가 범위를 고루 채운다')

  eq(hash32('abc'), hash32('abc'), 'hash32 결정적')
  ok(hash32('abc') !== hash32('abd'), 'hash32 충돌 아님')
  ok(variate('e1', 'size') >= -1 && variate('e1', 'size') <= 1, 'variate 범위')
  eq(variate('e1', 'size'), variate('e1', 'size'), 'variate 고정')

  const ri = makeRng(7)
  for (let i = 0; i < 5000; i++) {
    const v = intOf(ri, 8)
    ok(Number.isInteger(v) && v >= 0 && v < 8, 'intOf 범위')
  }
}

// ══════════════════════════════════════════════════════ arena
section('arena — 맵 구조')
{
  const { ARENA, ALL_BOXES, COVER_BOXES, WALL_BOXES, SPAWN_POINTS, PLAYER_START, insideArena } = arenaM
  eq(WALL_BOXES.length, 4, '담장 네 짝')
  ok(COVER_BOXES.length >= 8, '엄폐물 충분')
  eq(ALL_BOXES.length, WALL_BOXES.length + COVER_BOXES.length, '전체 = 담장 + 엄폐물')

  for (const b of ALL_BOXES) {
    ok(b.minX < b.maxX && b.minZ < b.maxZ && b.minY < b.maxY, '상자 min<max')
  }

  // 담장 안쪽 면이 정확히 ±half
  const h = ARENA.half
  for (const b of WALL_BOXES) {
    const nearest = Math.min(
      Math.abs(b.minX), Math.abs(b.maxX), Math.abs(b.minZ), Math.abs(b.maxZ),
    )
    ok(Math.abs(nearest - h) < 1e-9, `담장 안쪽 면이 ±${h}`)
  }

  // 엄폐물이 플레이어 시작점을 덮지 않아야 한다
  for (const b of COVER_BOXES) {
    const covers = PLAYER_START.x >= b.minX - 0.5 && PLAYER_START.x <= b.maxX + 0.5 &&
                   PLAYER_START.z >= b.minZ - 0.5 && PLAYER_START.z <= b.maxZ + 0.5
    ok(!covers, '시작점이 엄폐물에 안 겹침')
  }

  // 스폰 지점: 아레나 안 + 시작점에서 충분히 멀고 + 어떤 적도 안 낀다
  const widestR = Math.max(...Object.values(enemiesM.ENEMY_TYPES).map((t) => t.radius))
  for (const s of SPAWN_POINTS) {
    ok(insideArena(s.x, s.z, 1), `스폰 (${s.x},${s.z}) 아레나 안`)
    const d = Math.hypot(s.x - PLAYER_START.x, s.z - PLAYER_START.z)
    ok(d >= 12, `스폰 (${s.x},${s.z}) 시작점에서 12 이상 — got ${d.toFixed(1)}`)
    for (const b of ALL_BOXES) {
      const nx = Math.max(b.minX, Math.min(s.x, b.maxX))
      const nz = Math.max(b.minZ, Math.min(s.z, b.maxZ))
      const gap = Math.hypot(s.x - nx, s.z - nz)
      ok(gap >= widestR + 0.3,
        `스폰 (${s.x},${s.z}) 이 벽에서 ${(widestR + 0.3).toFixed(2)} 이상 — got ${gap.toFixed(2)}`)
    }
  }
  ok(insideArena(0, 0), '중앙은 안')
  ok(!insideArena(16, 0), '밖은 밖')

  /* ★ 통행 가능한 틈 — 처음 배치를 무너뜨린 버그를 영구히 막는다.

     두 상자가 한 축에서 겹쳐 있으면, 다른 축의 틈은 0(붙어 있음)이거나
     MIN_GAP 이상이어야 한다. 그 사이의 어중간한 틈이 생기면 거기 낀
     것이 양쪽에서 번갈아 밀려 밀어내기가 수렴하지 못하고, 결국 벽을
     뚫는다. 사람 눈으로는 "좀 좁은 골목"으로만 보인다. */
  {
    const { MIN_GAP } = arenaM
    const overlap = (aMin, aMax, bMin, bMax) => aMin < bMax - 1e-9 && bMin < aMax - 1e-9
    for (let i = 0; i < ALL_BOXES.length; i++) {
      for (let j = i + 1; j < ALL_BOXES.length; j++) {
        const a = ALL_BOXES[i], b = ALL_BOXES[j]
        if (overlap(a.minX, a.maxX, b.minX, b.maxX)) {
          const gap = Math.max(b.minZ - a.maxZ, a.minZ - b.maxZ)
          ok(gap <= 0 || gap >= MIN_GAP, `z 방향 틈이 ${gap.toFixed(2)} (0 이거나 ${MIN_GAP} 이상이어야)`)
        }
        if (overlap(a.minZ, a.maxZ, b.minZ, b.maxZ)) {
          const gap = Math.max(b.minX - a.maxX, a.minX - b.maxX)
          ok(gap <= 0 || gap >= MIN_GAP, `x 방향 틈이 ${gap.toFixed(2)} (0 이거나 ${MIN_GAP} 이상이어야)`)
        }
        // 대각선으로 마주 본 모서리 사이도 마찬가지
        if (!overlap(a.minX, a.maxX, b.minX, b.maxX) && !overlap(a.minZ, a.maxZ, b.minZ, b.maxZ)) {
          const gx = Math.max(b.minX - a.maxX, a.minX - b.maxX)
          const gz = Math.max(b.minZ - a.maxZ, a.minZ - b.maxZ)
          if (gx > 0 && gz > 0) {
            const diag = Math.hypot(gx, gz)
            ok(diag >= MIN_GAP, `대각선 틈이 ${diag.toFixed(2)} — ${MIN_GAP} 이상이어야`)
          }
        }
      }
    }
  }
  ok(arenaM.MIN_GAP > Math.max(...Object.values(enemiesM.ENEMY_TYPES).map((t) => t.radius)) * 2,
    'MIN_GAP 이 가장 뚱뚱한 적의 지름보다 크다')
  ok(arenaM.MIN_GAP > playerM.PLAYER.radius * 2, 'MIN_GAP 이 플레이어 지름보다 크다')
}

// ══════════════════════════════════════════════════════ collide
section('collide — 벽 충돌')
{
  const { pushOut, resolveMove, rayBox, hasLineOfSight } = collideM
  const box = { minX: -1, maxX: 1, minY: 0, maxY: 3, minZ: -1, maxZ: 1 }

  ok(pushOut(5, 0, 0.5, box) === null, '멀면 안 겹침')
  ok(pushOut(1.6, 0, 0.5, box) === null, '딱 밖이면 안 겹침')
  {
    const p = pushOut(1.2, 0, 0.5, box)
    ok(p !== null, '겹침 감지')
    near(p.x, 0.3, 1e-9, '오른쪽으로 0.3 밀림')
    near(p.z, 0, 1e-9, 'z 안 밀림')
  }
  {
    // 중심이 상자 안 — 반드시 빠져나와야
    const p = pushOut(0.2, 0, 0.5, box)
    ok(p !== null, '내부 감지')
    const nx = 0.2 + p.x, nz = 0 + p.z
    const stillIn = nx > box.minX && nx < box.maxX && nz > box.minZ && nz < box.maxZ
    ok(!stillIn, '내부에서 탈출')
  }

  // 벽 통과 금지 — 무작위 대량 시행
  {
    const boxes = arenaM.ALL_BOXES
    const r = 0.36
    const rng = rngM.makeRng('collide')
    let stuck = 0, escaped = 0
    let x = 0, z = 0
    for (let i = 0; i < 25000; i++) {
      const dx = (rng() - 0.5) * 0.9
      const dz = (rng() - 0.5) * 0.9
      const res = resolveMove(x, z, dx, dz, r, boxes)
      x = res.x; z = res.z
      if (!Number.isFinite(x) || !Number.isFinite(z)) { stuck++; break }
      if (Math.abs(x) > arenaM.ARENA.half + 0.01 || Math.abs(z) > arenaM.ARENA.half + 0.01) escaped++
      for (const b of boxes) {
        const nx = Math.max(b.minX, Math.min(x, b.maxX))
        const nz = Math.max(b.minZ, Math.min(z, b.maxZ))
        const d = Math.hypot(x - nx, z - nz)
        if (d < r - 1e-6) { stuck++; break }
      }
    }
    eq(stuck, 0, '2.5만 스텝 무작위 이동 중 벽에 박힌 프레임 없음')
    eq(escaped, 0, '아레나 밖으로 못 나감')
  }

  // 벽을 향해 계속 밀어도 통과 못 함
  {
    const boxes = arenaM.ALL_BOXES
    let x = 0, z = 0
    for (let i = 0; i < 2000; i++) {
      const res = resolveMove(x, z, 0.5, 0, 0.36, boxes)
      x = res.x; z = res.z
    }
    ok(x <= arenaM.ARENA.half, `벽에 막힘 — x=${x.toFixed(2)}`)
  }

  // rayBox
  {
    const t = rayBox(-5, 1, 0, 1, 0, 0, box)
    near(t, 4, 1e-9, '광선이 상자 앞면에 4에서 닿음')
    ok(rayBox(-5, 1, 0, -1, 0, 0, box) === null, '반대로 쏘면 안 맞음')
    ok(rayBox(-5, 10, 0, 1, 0, 0, box) === null, '상자 위로 지나감')
    eq(rayBox(0, 1, 0, 1, 0, 0, box), 0, '내부에서 시작하면 0')
    ok(rayBox(-5, 1, 5, 1, 0, 0, box) === null, '옆으로 빗나감')
  }

  // 시야
  {
    const boxes = arenaM.ALL_BOXES
    ok(hasLineOfSight(-1, 1.6, -1, 1, 1.6, 1, boxes) === false ||
       hasLineOfSight(-1, 1.6, -1, 1, 1.6, 1, boxes) === true, '시야 판정이 값을 냄')
    // 중앙 십자 벽(0,-4.5) 을 사이에 두면 막혀야
    ok(!hasLineOfSight(0, 1.6, -7, 0, 1.6, -2, boxes), '중앙 벽 뒤는 안 보임')
    // 탁 트인 대각선은 보여야
    ok(hasLineOfSight(-2, 1.6, -2, -2, 1.6, 2, boxes), '뚫린 길은 보임')
    ok(hasLineOfSight(0, 1.6, 0, 0, 1.6, 0, boxes), '같은 점은 보임')
  }
}

// ══════════════════════════════════════════════════════ weapons
section('weapons — 무기 수치')
{
  const {
    WEAPONS, WEAPON_ORDER, SLOTS, SLOT_LABEL, SLOT_KEY, WEAPONS_BY_SLOT,
    shotInterval, needsReload, reloadAmount, initialAmmo, initialSlots,
  } = weaponsM

  eq(SLOTS.length, 3, '슬롯 셋 — 주무기 · 보조 · 근접')
  for (const s of SLOTS) {
    ok(SLOT_LABEL[s], `${s} 이름표가 있다`)
    ok(WEAPONS_BY_SLOT[s].length > 0, `${s} 슬롯에 무기가 있다`)
  }
  /* 숫자키 1·2·3 이 슬롯 셋에 하나씩 대응해야 한다. 어긋나면
     손가락이 기억한 자리에서 엉뚱한 무기가 나온다. */
  eq(Object.keys(SLOT_KEY).length, 3, '숫자키 셋')
  eq(new Set(Object.values(SLOT_KEY)).size, 3, '숫자키가 서로 다른 슬롯을 가리킨다')
  for (const s of Object.values(SLOT_KEY)) ok(SLOTS.includes(s), `${s} 는 실제 슬롯`)

  for (const id of WEAPON_ORDER) {
    const w = WEAPONS[id]
    ok(w, `${id} 존재`)
    eq(w.id, id, `${id} id 일치`)
    ok(SLOTS.includes(w.slot), `${id} 가 슬롯에 속한다`)
    ok(w.damage > 0 && w.rpm > 0, `${id} 수치 양수`)
    /* 근접무기는 탄약이라는 개념을 안 쓴다 — 탄창도 재장전도 0 */
    if (w.noAmmo) {
      eq(w.reload, 0, `${id} 는 재장전하지 않는다`)
      eq(w.mag, 0, `${id} 는 탄창이 없다`)
    } else {
      ok(w.mag > 0, `${id} 탄창 크기`)
      ok(w.reload > 0, `${id} 재장전 시간`)
    }
    ok(w.pellets >= 1, `${id} 알 개수`)
    ok(w.falloffStart < w.falloffEnd, `${id} 감쇠 구간`)
    ok(w.falloffMin > 0 && w.falloffMin <= 1, `${id} 최소 배율`)
    ok(w.range > 0, `${id} 사거리`)
  }
  eq(WEAPON_ORDER.length, Object.keys(WEAPONS).length, '표시 순서가 모든 무기를 담는다')

  /* 무기가 아홉이면 그중 몇은 서로 베끼기 쉽다. 슬롯마다 성격이
     실제로 갈리는지 수치로 확인한다 — 같은 자리의 두 무기가 모든
     면에서 같으면 하나는 있으나 마나다. */
  ok(WEAPON_ORDER.length >= 9, `무기가 넉넉하다 — ${WEAPON_ORDER.length}자루`)
  for (const slot of SLOTS) {
    ok(WEAPONS_BY_SLOT[slot].length >= 2, `${slot} 슬롯에 고를 여지가 있다`)
    const ids = WEAPONS_BY_SLOT[slot]
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = WEAPONS[ids[i]], b = WEAPONS[ids[j]]
        const differs = a.damage !== b.damage || a.rpm !== b.rpm ||
          a.mag !== b.mag || a.range !== b.range || a.pellets !== b.pellets ||
          a.spread !== b.spread || !!a.pierce !== !!b.pierce
        ok(differs, `${ids[i]} 와 ${ids[j]} 는 서로 다른 무기다`)
      }
    }
  }
  /* 초당 피해가 슬롯 성격을 지켜야 한다. 보조무기가 주무기보다
     꾸준히 세면 주무기를 주울 이유가 없다. */
  const dps = (w) => (w.damage * w.pellets * w.rpm) / 60
  const bestPrimary = Math.max(...WEAPONS_BY_SLOT.primary.map((id) => dps(WEAPONS[id])))
  const bestSecondary = Math.max(...WEAPONS_BY_SLOT.secondary.map((id) => dps(WEAPONS[id])))
  ok(bestSecondary < bestPrimary,
    `최고 보조무기 DPS(${bestSecondary.toFixed(0)})가 최고 주무기(${bestPrimary.toFixed(0)})보다 낮다`)
  eq(WEAPONS.pistol.reserve, Infinity, '권총만 예비탄이 무한하다')
  for (const id of WEAPON_ORDER) {
    if (id === 'pistol') continue
    ok(WEAPONS[id].reserve !== Infinity, `${id} 는 예비탄이 유한하다`)
  }

  // 관통 무기
  const S = WEAPONS.sniper
  ok(S.pierce > 0, '저격총은 관통한다')
  ok(S.pierceFalloff > 0 && S.pierceFalloff < 1, '관통할수록 약해진다')
  ok(S.damage >= enemiesM.ENEMY_TYPES.trooper.hp, '저격총 한 발에 트루퍼가 죽는다')
  eq(S.spread, 0, '저격총은 탄퍼짐이 없다')
  for (const id of WEAPON_ORDER) {
    if (id === 'sniper') continue
    ok(!WEAPONS[id].pierce, `${id} 는 관통하지 않는다`)
  }

  // 근접무기
  const K = WEAPONS.knife
  ok(K.melee && K.noAmmo, '나이프는 근접이고 탄약이 없다')
  eq(K.slot, 'melee', '나이프는 근접 슬롯')
  ok(K.range < 4, `나이프 사거리가 짧다 — ${K.range}`)
  ok(K.arc > 0 && K.arc < 180, `나이프 부채꼴 각이 온당하다 — ${K.arc}`)
  ok(K.damage >= enemiesM.ENEMY_TYPES.crawler.hp,
    '나이프 한 방에 크롤러가 죽는다 — 붙는 위험을 감수한 값')
  near(falloffOf(K, 0), 1, 1e-9, '나이프는 거리 감쇠가 없다')
  near(falloffOf(K, K.range), 1, 1e-9, '사거리 끝에서도 온전한 피해')
  function falloffOf(w, d) { return combatM.falloffAt(w, d) }

  // 도끼 — 나이프보다 느리고 무겁고 넓다
  const A = WEAPONS.axe
  ok(A.melee && A.noAmmo, '도끼도 근접이고 탄약이 없다')
  ok(A.damage > K.damage, '도끼가 더 세다')
  ok(A.rpm < K.rpm, '도끼가 더 느리다')
  ok(A.arc > K.arc && A.range > K.range, '도끼가 더 넓고 길게 닿는다')
  ok(A.damage * 2 >= enemiesM.ENEMY_TYPES.brute.hp, '도끼 두 방이면 브루트가 눕는다')
  ok(K.damage * 2 < enemiesM.ENEMY_TYPES.brute.hp, '나이프로는 브루트를 두 방에 못 잡는다')
  near(shotInterval(WEAPONS.pistol), 1 / 3, 1e-9, '권총 초당 3발')
  near(shotInterval(WEAPONS.rifle), 1 / 8, 1e-9, '소총 초당 8발')
  near(shotInterval(WEAPONS.shotgun), 1 / 1.2, 1e-9, '샷건 초당 1.2발')
  near(WEAPONS.shotgun.damage * WEAPONS.shotgun.pellets, 60, 1e-9, '샷건 전탄 60')

  ok(needsReload({ inMag: 0 }), '빈 탄창은 재장전 필요')
  ok(!needsReload({ inMag: 1 }), '한 발 남으면 아직')
  eq(reloadAmount(WEAPONS.rifle, { inMag: 30, reserve: 100 }), 0, '꽉 차면 0')
  eq(reloadAmount(WEAPONS.rifle, { inMag: 10, reserve: 100 }), 20, '빈 만큼')
  eq(reloadAmount(WEAPONS.rifle, { inMag: 10, reserve: 5 }), 5, '예비탄이 모자라면 있는 만큼')
  eq(reloadAmount(WEAPONS.pistol, { inMag: 2, reserve: Infinity }), 10, '무한 예비탄')
  eq(reloadAmount(WEAPONS.rifle, { inMag: 10, reserve: 0 }), 0, '예비탄 없음')

  eq(reloadAmount(WEAPONS.knife, { inMag: 0, reserve: 0 }), 0, '나이프는 재장전할 것이 없다')

  const a = initialAmmo()
  ok(a.pistol.owned, '권총 소지')
  ok(a.knife.owned, '나이프 소지')
  ok(!a.rifle.owned && !a.shotgun.owned, '주무기는 주워야')
  eq(a.pistol.reserve, Infinity, '권총 무한')

  const sl = initialSlots()
  eq(sl.primary, null, '주무기 자리는 비어 있다')
  eq(sl.secondary, 'pistol', '보조무기는 권총')
  eq(sl.melee, 'knife', '근접무기는 나이프')
}

// ══════════════════════════════════════════════════════ combat
section('combat — 명중과 피해')
{
  const { applyDamage, falloffAt, raycast, hitboxesOf, spreadDir, fireShot, HEADSHOT_MULTIPLIER } = combatM
  const { WEAPONS } = weaponsM
  const { makeEnemy, resetEnemyIds } = enemiesM
  const P = WEAPONS.pistol

  eq(HEADSHOT_MULTIPLIER, 2.0, '헤드샷 2배')
  near(falloffAt(P, 0), 1, 1e-9, '근거리 감쇠 없음')
  near(falloffAt(P, P.falloffStart), 1, 1e-9, '감쇠 시작점까지 1배')
  near(falloffAt(P, P.falloffEnd), P.falloffMin, 1e-9, '끝점에서 최소')
  near(falloffAt(P, 9999), P.falloffMin, 1e-9, '끝점 너머는 최소 유지')
  near(falloffAt(P, (P.falloffStart + P.falloffEnd) / 2), (1 + P.falloffMin) / 2, 1e-9, '중간은 선형')
  // 단조감소
  {
    let prev = Infinity, mono = true
    for (let d = 0; d <= 100; d += 0.5) { const v = falloffAt(P, d); if (v > prev + 1e-12) mono = false; prev = v }
    ok(mono, '감쇠는 단조감소')
  }

  near(applyDamage(P, false, 0), 22, 1e-9, '근거리 몸통 22')
  near(applyDamage(P, true, 0), 44, 1e-9, '근거리 헤드샷 44')
  eq(applyDamage(P, true, 0) / applyDamage(P, false, 0), 2, '헤드샷은 정확히 2배')
  ok(applyDamage(P, false, 70) < applyDamage(P, false, 10), '멀수록 약함')

  resetEnemyIds()
  // 히트박스: 머리와 몸통이 y 로 안 겹침
  {
    const e = makeEnemy('trooper', 0, 0)
    const { body, head } = hitboxesOf(e)
    ok(head.minY >= body.maxY - 1e-9, '머리 상자가 몸통 위')
    ok(head.maxY <= enemiesM.ENEMY_TYPES.trooper.height + 1e-9, '머리가 키 안')
    ok(head.maxX - head.minX < body.maxX - body.minX, '머리가 몸통보다 좁다')
  }

  // 레이캐스트: 정면의 적을 맞힌다
  {
    const e = makeEnemy('crawler', 0, -10)
    e.state = 'chasing'
    const hit = raycast({ x: 0, y: 0.5, z: 0 }, { x: 0, y: 0, z: -1 }, [e], [], 80)
    ok(hit && hit.kind === 'enemy', '정면 적 명중')
    eq(hit.enemy.id, e.id, '맞은 적이 그 적')
  }
  // 죽은 적은 안 맞는다
  {
    const e = makeEnemy('crawler', 0, -10); e.state = 'dead'
    ok(raycast({ x: 0, y: 0.5, z: 0 }, { x: 0, y: 0, z: -1 }, [e], [], 80) === null, '시체는 안 맞음')
  }
  // 헤드샷 판정
  {
    const e = makeEnemy('trooper', 0, -10); e.state = 'chasing'
    const t = enemiesM.ENEMY_TYPES.trooper
    const headY = t.height * (1 - 0.26 / 2)
    const hit = raycast({ x: 0, y: headY, z: 0 }, { x: 0, y: 0, z: -1 }, [e], [], 80)
    ok(hit && hit.isHeadshot, '머리 높이로 쏘면 헤드샷')
    const bodyHit = raycast({ x: 0, y: 0.6, z: 0 }, { x: 0, y: 0, z: -1 }, [e], [], 80)
    ok(bodyHit && !bodyHit.isHeadshot, '몸통 높이는 헤드샷 아님')
  }
  // ★ 엄폐물 뒤 적은 못 맞힌다
  {
    const e = makeEnemy('crawler', 0, -10); e.state = 'chasing'
    const wall = { minX: -3, maxX: 3, minY: 0, maxY: 3, minZ: -6, maxZ: -5 }
    const hit = raycast({ x: 0, y: 0.5, z: 0 }, { x: 0, y: 0, z: -1 }, [e], [wall], 80)
    ok(hit && hit.kind === 'wall', '벽 뒤 적은 벽에 막힘')
  }
  // 벽보다 앞의 적은 맞는다
  {
    const e = makeEnemy('crawler', 0, -3); e.state = 'chasing'
    const wall = { minX: -3, maxX: 3, minY: 0, maxY: 3, minZ: -6, maxZ: -5 }
    const hit = raycast({ x: 0, y: 0.5, z: 0 }, { x: 0, y: 0, z: -1 }, [e], [wall], 80)
    ok(hit && hit.kind === 'enemy', '벽 앞의 적은 맞음')
  }
  // 가까운 적이 먼 적을 가린다
  {
    const near1 = makeEnemy('crawler', 0, -5); near1.state = 'chasing'
    const far1 = makeEnemy('crawler', 0, -12); far1.state = 'chasing'
    const hit = raycast({ x: 0, y: 0.5, z: 0 }, { x: 0, y: 0, z: -1 }, [far1, near1], [], 80)
    eq(hit.enemy.id, near1.id, '가까운 적이 먼저')
  }
  // 사거리 밖
  {
    const e = makeEnemy('crawler', 0, -50); e.state = 'chasing'
    ok(raycast({ x: 0, y: 0.5, z: 0 }, { x: 0, y: 0, z: -1 }, [e], [], 28) === null, '사거리 밖은 null')
  }

  // 탄퍼짐: 각도 한계 안에 들고, 원 안에 고루 퍼진다
  {
    const rng = rngM.makeRng('spread')
    const dir = { x: 0, y: 0, z: -1 }
    let maxAng = 0
    let innerHalf = 0
    const N = 9000
    for (let i = 0; i < N; i++) {
      const d = spreadDir(dir, 12, rng)
      near(Math.hypot(d.x, d.y, d.z), 1, 1e-9, '탄퍼짐 방향은 단위벡터')
      const ang = Math.acos(Math.max(-1, Math.min(1, -d.z))) * 180 / Math.PI
      maxAng = Math.max(maxAng, ang)
      if (ang <= 12 / Math.SQRT2) innerHalf++
    }
    ok(maxAng <= 12.0001, `최대 각이 12도 이내 — got ${maxAng.toFixed(3)}`)
    ok(maxAng > 11.5, '실제로 끝까지 퍼진다')
    // 면적 절반에 해당하는 반각 안에 대략 절반이 들어와야 (균등 분포)
    const ratio = innerHalf / N
    ok(ratio > 0.45 && ratio < 0.55, `원 안 균등 분포 — 절반 반경에 ${(ratio * 100).toFixed(1)}%`)
  }
  {
    const rng = rngM.makeRng('nospread')
    const d = spreadDir({ x: 0, y: 0, z: -1 }, 0, rng)
    near(d.z, -1, 1e-12, '퍼짐 0 이면 그대로')
  }
  // 바로 위를 볼 때도 축이 무너지지 않아야
  {
    const rng = rngM.makeRng('up')
    for (let i = 0; i < 500; i++) {
      const d = spreadDir({ x: 0, y: 1, z: 0 }, 5, rng)
      ok(Number.isFinite(d.x) && Number.isFinite(d.y) && Number.isFinite(d.z), '수직 조준에서도 유한')
      near(Math.hypot(d.x, d.y, d.z), 1, 1e-9, '수직 조준 단위벡터')
    }
  }

  /* ── 관통 ───────────────────────────────────────────────────── */
  {
    const { raycastAll, fireShot } = combatM
    const S = WEAPONS.sniper
    const eye = { x: 0, y: 0.5, z: 0 }
    const fwd = { x: 0, y: 0, z: -1 }
    /* 가까운 순으로 만들되, 넘길 때는 섞는다.

       실제 세션의 적 배열은 스폰 순서지 거리 순이 아니다. 정렬된
       배열만 넣어 시험하면 "가까운 순으로 정렬한다"는 코드가 있으나
       마나 해도 통과해 버린다 — 관통이 엉뚱한 적을 뚫어도 모른다. */
    const line = (n) => Array.from({ length: n }, (_, i) => {
      const e = makeEnemy('crawler', 0, -4 - i * 3); e.state = 'chasing'; return e
    })
    const shuffled = (arr, seed) => {
      const r = rngM.makeRng(seed)
      const a = [...arr]
      for (let i = a.length - 1; i > 0; i--) {
        const j = rngM.intOf(r, i + 1)
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a
    }

    // 줄지어 선 적을 가까운 순으로 전부 찾는다 — 넣는 순서와 무관하게
    for (const seed of ['s1', 's2', 's3', 's4']) {
      const es = line(5)
      const r = raycastAll(eye, fwd, shuffled(es, seed), [], S.range)
      eq(r.enemies.length, 5, '광선 위의 적을 전부 찾는다')
      for (let i = 1; i < r.enemies.length; i++) {
        ok(r.enemies[i].t > r.enemies[i - 1].t, '가까운 순으로 정렬')
      }
      eq(r.enemies[0].enemy.id, es[0].id, '섞어 넣어도 맨 앞은 가장 가까운 적')
      eq(r.enemies[4].enemy.id, es[4].id, '섞어 넣어도 맨 뒤는 가장 먼 적')
    }
    // 벽 뒤는 못 찾는다
    {
      const es = line(3)
      const wall = { minX: -3, maxX: 3, minY: 0, maxY: 3, minZ: -6, maxZ: -5.5 }
      const r = raycastAll(eye, fwd, es, [wall], S.range)
      eq(r.enemies.length, 1, '벽 앞의 적만 찾는다')
    }
    /* ★ 한 발이 pierce+1 명까지만, 그리고 반드시 "앞에서부터" 뚫는다.

       배열 순서가 아니라 거리 순으로 골라야 한다. 섞어 넣고도 맨
       앞 세 명이 맞아야 관통이 제대로 도는 것이다. */
    for (const seed of ['a', 'b', 'c', 'd']) {
      const es = line(6)
      const r = fireShot(S, eye, fwd, shuffled(es, seed), [], rngM.makeRng('p'))
      eq(r.damages.length, S.pierce + 1, `한 발이 ${S.pierce + 1}명을 맞힌다`)
      const hitIds = new Set(r.damages.map((d) => d.enemy.id))
      for (let i = 0; i <= S.pierce; i++) {
        ok(hitIds.has(es[i].id), `${i + 1}번째로 가까운 적이 맞는다`)
      }
      for (let i = S.pierce + 1; i < es.length; i++) {
        ok(!hitIds.has(es[i].id), `${i + 1}번째로 먼 적은 안 맞는다`)
      }
    }
    // 뒤로 갈수록 약해진다 — 이것도 넣는 순서와 무관해야 한다
    for (const seed of ['x', 'y', 'z']) {
      const es = line(3)
      const r = fireShot(S, eye, fwd, shuffled(es, seed), [], rngM.makeRng('p'))
      const byId = new Map(r.damages.map((d) => [d.enemy.id, d.damage]))
      const d0 = byId.get(es[0].id)
      const d1 = byId.get(es[1].id)
      const d2 = byId.get(es[2].id)
      ok(d0 > d1 && d1 > d2, `관통할수록 피해가 준다 — ${d0?.toFixed(0)} > ${d1?.toFixed(0)} > ${d2?.toFixed(0)}`)
      near(d1 / d0, S.pierceFalloff, 1e-6, '감쇠 비율이 규격대로')
    }
    // 관통 무기가 아닌 총은 첫 적에서 멈춘다
    {
      const es = line(4)
      const r = fireShot(WEAPONS.rifle, eye, fwd, es, [], rngM.makeRng('p'))
      eq(r.damages.length, 1, '소총은 하나만 맞힌다')
      eq(r.damages[0].enemy.id, es[0].id, '맨 앞의 적만')
    }
    // 적이 하나뿐이면 관통 무기도 하나만 맞힌다
    {
      const es = line(1)
      const r = fireShot(S, eye, fwd, es, [], rngM.makeRng('p'))
      eq(r.damages.length, 1, '있는 만큼만 맞힌다')
    }
    // 허공에 쏴도 터지지 않는다
    {
      const r = fireShot(S, eye, fwd, [], [], rngM.makeRng('p'))
      eq(r.damages.length, 0, '아무도 없으면 피해 없음')
    }
    // 죽은 적은 세지 않는다
    {
      const es = line(3)
      es[0].state = 'dead'
      const r = fireShot(S, eye, fwd, es, [], rngM.makeRng('p'))
      ok(!r.damages.some((d) => d.enemy.id === es[0].id), '시체는 관통 대상이 아니다')
    }
  }

  /* ── 근접 공격 ──────────────────────────────────────────────── */
  {
    const { meleeSwing } = combatM
    const K = WEAPONS.knife
    const eye = { x: 0, y: 1.62, z: 0 }
    const fwd = { x: 0, y: 0, z: -1 }
    const put = (type, x, z) => {
      const e = makeEnemy(type, x, z); e.state = 'chasing'; return e
    }

    // 정면 코앞은 벤다
    {
      const e = put('crawler', 0, -1.5)
      const r = meleeSwing(K, eye, fwd, [e], [])
      eq(r.damages.length, 1, '정면의 적을 벤다')
      eq(r.damages[0].damage, K.damage, '피해량은 무기 수치 그대로')
      ok(!r.damages[0].isHeadshot, '근접에는 헤드샷이 없다')
    }
    /* ★ 발밑의 낮은 적도 벤다. 광선으로 재던 시절 눈높이(1.62)에서
       수평으로 쏘면 키 1.05 인 크롤러 위로 넘어가 헛쳤다. */
    {
      const e = put('crawler', 0, -1.0)
      ok(meleeSwing(K, eye, fwd, [e], []).damages.length === 1,
        '눈높이에서 휘둘러도 발밑의 크롤러가 맞는다')
    }
    // 사거리 밖은 안 닿는다
    {
      const e = put('crawler', 0, -(K.range + 3))
      eq(meleeSwing(K, eye, fwd, [e], []).damages.length, 0, '멀면 안 닿는다')
    }
    // 등 뒤는 안 닿는다
    {
      const e = put('crawler', 0, 1.5)
      eq(meleeSwing(K, eye, fwd, [e], []).damages.length, 0, '등 뒤는 안 베인다')
    }
    // 부채꼴 경계 — 각 안은 맞고 밖은 안 맞는다
    {
      const half = (K.arc * Math.PI) / 180 / 2
      const d = 1.6
      const inside = put('crawler', -Math.sin(half * 0.5) * d, -Math.cos(half * 0.5) * d)
      const outside = put('crawler', -Math.sin(half * 1.9) * d, -Math.cos(half * 1.9) * d)
      eq(meleeSwing(K, eye, fwd, [inside], []).damages.length, 1, '부채꼴 안은 벤다')
      eq(meleeSwing(K, eye, fwd, [outside], []).damages.length, 0, '부채꼴 밖은 못 벤다')
    }
    // 여럿을 한 번에 — 탄약을 안 쓰는 대신 몰려 있을 때 값을 한다
    {
      const a = put('crawler', -0.6, -1.4)
      const b = put('crawler', 0, -1.5)
      const c = put('crawler', 0.6, -1.4)
      eq(meleeSwing(K, eye, fwd, [a, b, c], []).damages.length, 3, '부채꼴 안의 셋을 모두 벤다')
    }
    // 죽은 적은 안 벤다
    {
      const e = put('crawler', 0, -1.5); e.state = 'dead'
      eq(meleeSwing(K, eye, fwd, [e], []).damages.length, 0, '시체는 안 벤다')
    }
    // ★ 벽 너머는 못 벤다
    {
      const e = put('crawler', 0, -2.2)
      const wall = { minX: -3, maxX: 3, minY: 0, maxY: 3, minZ: -1.6, maxZ: -1.2 }
      eq(meleeSwing(K, eye, fwd, [e], [wall]).damages.length, 0, '벽 뒤는 못 벤다')
      eq(meleeSwing(K, eye, fwd, [e], []).damages.length, 1, '벽이 없으면 벤다')
    }
    /* 덩치 큰 적은 몸 표면까지로 재야 한다. 중심까지로 재면 브루트가
       몸을 맞대고 있는데도 사거리 밖이 된다. */
    {
      const t = enemiesM.ENEMY_TYPES.brute
      const e = put('brute', 0, -(K.range + t.radius - 0.15))
      eq(meleeSwing(K, eye, fwd, [e], []).damages.length, 1,
        '브루트는 반지름만큼 더 멀리서도 닿는다')
    }
    // fireShot 이 근접무기를 받으면 meleeSwing 으로 넘긴다
    {
      const e = put('crawler', 0, -1.5)
      const r = combatM.fireShot(K, eye, fwd, [e], [], rngM.makeRng('m'))
      eq(r.damages.length, 1, 'fireShot 도 근접을 처리한다')
      eq(r.hits.length, 0, '근접은 예광선용 착탄점을 만들지 않는다')
    }
    /* 위를 보고 있어도 발밑을 벤다 — 수평 성분이 0 이면 각도를 잴
       기준이 없으므로 모두 정면으로 친다 */
    {
      const e = put('crawler', 0, -1.2)
      const up = { x: 0, y: 1, z: 0 }
      const r = meleeSwing(K, eye, up, [e], [])
      ok(r.damages.length === 1, '수직으로 조준해도 코앞은 벤다')
    }
  }

  // 산탄: 같은 적을 여러 알이 맞으면 피해 합산, 항목은 하나
  {
    resetEnemyIds()
    const e = makeEnemy('brute', 0, -3); e.state = 'chasing'
    const rng = rngM.makeRng('shot')
    const res = fireShot(WEAPONS.shotgun, { x: 0, y: 1.2, z: 0 }, { x: 0, y: 0, z: -1 }, [e], [], rng)
    eq(res.damages.length, 1, '적 하나면 항목 하나')
    ok(res.damages[0].damage > WEAPONS.shotgun.damage, '여러 알이 합산됨')
    ok(res.hits.length >= 1, '명중 기록 있음')
  }
}

// ══════════════════════════════════════════════════════ enemies
section('enemies — AI 상태 기계')
{
  const { ENEMY_TYPES, makeEnemy, tickEnemy, damageEnemy, shouldRemove, resetEnemyIds, CORPSE_LINGER } = enemiesM
  resetEnemyIds()

  for (const [id, t] of Object.entries(ENEMY_TYPES)) {
    eq(t.id, id, `${id} id 일치`)
    ok(t.hp > 0 && t.speed > 0 && t.damage > 0, `${id} 수치 양수`)
    ok(t.score > 0, `${id} 점수`)
    ok(t.radius > 0 && t.height > 0, `${id} 크기`)
    ok(t.attackCooldown > 0, `${id} 쿨다운`)
    ok(t.spawnTime > 0, `${id} 등장 시간`)
  }
  ok(ENEMY_TYPES.crawler.speed < playerM.PLAYER.speed, '가장 빠른 적도 플레이어보다 느림')
  ok(ENEMY_TYPES.brute.hp > ENEMY_TYPES.trooper.hp, '브루트가 더 단단')
  ok(ENEMY_TYPES.brute.score > ENEMY_TYPES.crawler.score, '센 놈이 점수 높음')

  const boxes = arenaM.ALL_BOXES
  const ctx = (px, pz) => ({
    player: { x: px, y: 0, z: pz, eyeY: 1.62 },
    boxes, rng: rngM.makeRng('ai'),
  })

  // spawning → chasing
  {
    let e = makeEnemy('crawler', -12, -12)
    eq(e.state, 'spawning', '처음엔 등장 중')
    const t = ENEMY_TYPES.crawler.spawnTime
    let acc = 0
    while (acc < t + 0.02) { e = tickEnemy(e, ctx(0, 0), 1 / 60).enemy; acc += 1 / 60 }
    eq(e.state, 'chasing', '등장이 끝나면 추격')
  }
  // 등장 중에는 안 움직인다
  {
    let e = makeEnemy('crawler', -12, -12)
    const x0 = e.x, z0 = e.z
    e = tickEnemy(e, ctx(0, 0), 0.1).enemy
    near(e.x, x0, 1e-9, '등장 중 x 고정')
    near(e.z, z0, 1e-9, '등장 중 z 고정')
  }
  // 추격 — 실제로 가까워진다
  {
    let e = makeEnemy('crawler', -12, -12)
    e.state = 'chasing'; e.stateT = 1
    const d0 = Math.hypot(e.x, e.z)
    for (let i = 0; i < 240; i++) e = tickEnemy(e, ctx(0, 0), 1 / 60).enemy
    const d1 = Math.hypot(e.x, e.z)
    ok(d1 < d0, `추격으로 거리 감소 ${d0.toFixed(1)} → ${d1.toFixed(1)}`)
  }
  // chasing → attacking → 공격 이벤트
  {
    let e = makeEnemy('crawler', 0, -1.2)
    e.state = 'chasing'; e.stateT = 1
    let attacked = 0
    for (let i = 0; i < 300; i++) {
      const r = tickEnemy(e, ctx(0, 0), 1 / 60)
      e = r.enemy
      for (const ev of r.events) if (ev.type === 'melee') { attacked++; ok(ev.damage > 0, '근접 피해 양수') }
    }
    eq(e.state, 'attacking', '사거리 안이면 공격 상태')
    ok(attacked >= 5, `쿨다운마다 공격 — ${attacked}회`)
  }
  // 공격 쿨다운이 지켜지는가
  {
    let e = makeEnemy('crawler', 0, -1.2)
    e.state = 'chasing'; e.stateT = 1
    const times = []
    let time = 0
    for (let i = 0; i < 600; i++) {
      const r = tickEnemy(e, ctx(0, 0), 1 / 60)
      e = r.enemy; time += 1 / 60
      for (const ev of r.events) if (ev.type === 'melee') times.push(time)
    }
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1]
      ok(gap >= ENEMY_TYPES.crawler.attackCooldown - 0.02, `공격 간격 ${gap.toFixed(2)}s`)
    }
  }
  // ★ 체력 0 이면 죽고, 딱 한 번만 died 이벤트
  {
    let e = makeEnemy('crawler', 0, -5)
    e.state = 'chasing'; e.stateT = 1
    e = damageEnemy(e, ENEMY_TYPES.crawler.hp)
    eq(e.hp, 0, '체력이 0')
    let died = 0
    for (let i = 0; i < 200; i++) {
      const r = tickEnemy(e, ctx(0, 0), 1 / 60)
      e = r.enemy
      died += r.events.filter((v) => v.type === 'died').length
    }
    eq(died, 1, 'died 이벤트는 정확히 한 번')
    eq(e.state, 'dead', '죽은 상태 유지')
  }
  // 체력이 음수로 안 내려간다
  {
    let e = makeEnemy('crawler', 0, -5)
    e = damageEnemy(e, 99999)
    eq(e.hp, 0, '과잉 피해도 0 에서 멈춤')
    e = damageEnemy(e, 50)
    eq(e.hp, 0, '0 아래로 안 감')
  }
  // 죽은 뒤엔 공격 안 한다
  {
    let e = makeEnemy('crawler', 0, -1.0)
    e.state = 'attacking'; e.stateT = 1
    e = damageEnemy(e, 999)
    let attacks = 0
    for (let i = 0; i < 300; i++) {
      const r = tickEnemy(e, ctx(0, 0), 1 / 60)
      e = r.enemy
      attacks += r.events.filter((v) => v.type === 'melee' || v.type === 'shoot').length
    }
    eq(attacks, 0, '시체는 공격 안 함')
  }
  // 시체 제거 타이밍
  {
    let e = makeEnemy('crawler', 0, -5)
    e = damageEnemy(e, 999)
    e = tickEnemy(e, ctx(0, 0), 1 / 60).enemy
    ok(!shouldRemove(e), '죽자마자는 안 지움')
    for (let i = 0; i < Math.ceil(CORPSE_LINGER * 60) + 5; i++) e = tickEnemy(e, ctx(0, 0), 1 / 60).enemy
    ok(shouldRemove(e), '시간이 지나면 지움')
  }
  // 원거리 적: 벽 뒤에서는 안 쏜다
  {
    // 중앙 벽(0,-4.5,폭7,두께1.2) 을 사이에 둔 배치
    let e = makeEnemy('trooper', 0, -8)
    e.state = 'chasing'; e.stateT = 1
    let shots = 0
    for (let i = 0; i < 400; i++) {
      const r = tickEnemy(e, { player: { x: 0, y: 0, z: -2, eyeY: 1.62 }, boxes, rng: rngM.makeRng('r') }, 1 / 60)
      e = r.enemy
      shots += r.events.filter((v) => v.type === 'shoot').length
      if (Math.abs(e.z + 4.5) < 2) break   // 벽을 돌아 나왔으면 그만
    }
    eq(shots, 0, '벽 뒤에서는 발사 안 함')
  }
  // 원거리 적: 뚫린 곳에서는 쏜다
  {
    let e = makeEnemy('trooper', -12, 0)
    e.state = 'chasing'; e.stateT = 1
    let shots = 0, hits = 0
    for (let i = 0; i < 1200; i++) {
      const r = tickEnemy(e, { player: { x: -12, y: 0, z: 6, eyeY: 1.62 }, boxes, rng: rngM.makeRng(`s${i}`) }, 1 / 60)
      e = r.enemy
      for (const ev of r.events) if (ev.type === 'shoot') { shots++; if (ev.hit) hits++ }
    }
    ok(shots > 0, `뚫린 곳에서는 발사 — ${shots}회`)
    ok(hits < shots, '전부 맞지는 않는다(명중률 < 1)')
  }
  /* "목적을 이뤘는가"는 종류마다 다르다.

     근접 적은 사거리 안에 들어와야 한다. 원거리 적은 그렇지 않다 —
     트루퍼 사거리는 22 라 아레나 어디서든 이미 사거리 안이고, 그걸
     성공으로 치면 시험이 아무것도 안 재게 된다. 트루퍼의 목적은
     "플레이어가 보이는 자리를 잡는 것"이므로 그걸로 판정한다. */
  const reachedGoal = (e) => {
    const t = ENEMY_TYPES[e.type]
    if (t.ranged) {
      return collideM.hasLineOfSight(e.x, t.height * 0.5, e.z, 0, 1.62, 0, boxes)
    }
    return Math.hypot(e.x, e.z) <= t.attackRange
  }

  // 적이 벽에 영구히 끼지 않는다 — 모든 스폰 지점에서 출발
  {
    for (const sp of arenaM.SPAWN_POINTS) {
      for (const type of ['crawler', 'trooper', 'brute']) {
        let e = makeEnemy(type, sp.x, sp.z)
        e.state = 'chasing'; e.stateT = 1
        const d0 = Math.hypot(e.x, e.z)
        const budget = Math.ceil((d0 / ENEMY_TYPES[type].speed) * 2.5 * 60) + 60
        let done = false
        for (let i = 0; i < budget && !done; i++) {
          e = tickEnemy(e, { player: { x: 0, y: 0, z: 0, eyeY: 1.62 }, boxes, rng: rngM.makeRng('p') }, 1 / 60).enemy
          done = reachedGoal(e)
        }
        ok(done,
          `${type} 가 (${sp.x},${sp.z}) 에서 ${budget}프레임 안에 목적 달성 — 지금 ${Math.hypot(e.x, e.z).toFixed(1)}`)
        ok(Number.isFinite(e.x) && Number.isFinite(e.z), `${type} 좌표 유한`)
      }
    }
  }
  /* ★ 벽에 파묻힌 채 벽 쪽으로 가려 하면 "막혔다"고 인식해야 한다.

     결과(도달했는가)만 보는 시험으로는 이걸 못 잡는다. 전진량을
     총 이동량으로 재면 적이 멈추는 게 아니라 제 속도의 몇 분의
     일로 기어가는데, 시간을 넉넉히 주면 기어서라도 도착하기
     때문이다. 그래서 결과 대신 판단 자체를 본다 — 우회 상태에
     들어갔는가(avoidSide 가 정해졌는가).

     벽이 밀어낸 거리를 전진으로 세면 이 값이 0 으로 남는다. */
  {
    const wall = arenaM.COVER_BOXES.find((b) => b.cx === 0 && b.cz === 6)
    ok(wall, '북쪽 광장 벽을 찾음')
    for (const type of ['crawler', 'trooper', 'brute']) {
      const t = ENEMY_TYPES[type]
      for (const offX of [-1.6, -0.8, 0, 0.9, 1.7]) {
        let e = makeEnemy(type, offX, wall.maxZ + t.radius - 0.03)
        e.state = 'chasing'; e.stateT = 1
        e = tickEnemy(e, ctx(0, 0), 1 / 60).enemy
        ok(e.avoidSide !== 0,
          `${type} 가 x=${offX} 에서 벽에 낀 걸 인식해 우회에 들어감`)
      }
    }
    // 반대로, 트인 곳에서는 우회가 걸리면 안 된다
    for (const type of ['crawler', 'trooper', 'brute']) {
      let e = makeEnemy(type, 0, 12)
      e.state = 'chasing'; e.stateT = 1
      e = tickEnemy(e, ctx(0, 12 - 3), 1 / 60).enemy
      eq(e.avoidSide, 0, `${type} 는 트인 곳에서 우회하지 않음`)
    }
  }

  /* ★ 벽에 몸이 파묻힌 채로 시작해도 빠져나와 도달한다.

     이게 "전진량을 어떻게 재는가"를 지키는 시험이다. 총 이동량으로
     재면 벽이 밀어낸 것까지 전진으로 쳐서, 벽에 낀 적이 매 프레임
     조금 앞으로 갔다 더 뒤로 밀리면서도 "잘 가고 있다"고 판정된다.
     그러면 우회가 영영 안 걸린다.

     각 엄폐물의 네 면 한가운데에, 반지름보다 살짝 덜 떨어뜨려 —
     즉 일부러 파묻은 채로 — 세워 놓고 중앙까지 오는지 본다. */
  {
    for (const b of arenaM.COVER_BOXES) {
      for (const type of ['crawler', 'trooper', 'brute']) {
        const t = ENEMY_TYPES[type]
        const cx = (b.minX + b.maxX) / 2
        const cz = (b.minZ + b.maxZ) / 2
        const inset = t.radius - 0.03      // 살짝 파묻힌 상태
        const faces = [
          { x: cx, z: b.maxZ + inset },
          { x: cx, z: b.minZ - inset },
          { x: b.maxX + inset, z: cz },
          { x: b.minX - inset, z: cz },
        ]
        for (const f of faces) {
          if (!arenaM.insideArena(f.x, f.z, 0.5)) continue
          let e = makeEnemy(type, f.x, f.z)
          e.state = 'chasing'; e.stateT = 1
          const d0 = Math.hypot(e.x, e.z)

          /* "언젠가는 도착한다"로는 부족하다. 전진량을 잘못 재면 적이
             멈추는 게 아니라 제 속도의 몇 분의 일로 벽을 기어가는데,
             넉넉한 시간을 주면 그것도 결국 도착해 버려서 시험을
             통과한다. 그래서 곧장 갔을 때의 2.5배 안에 오라고 못박는다.
             에둘러 가는 건 괜찮지만 기어가는 건 안 된다. */
          const budget = Math.ceil((d0 / t.speed) * 2.5 * 60) + 60
          let done = false
          for (let i = 0; i < budget && !done; i++) {
            e = tickEnemy(e, { player: { x: 0, y: 0, z: 0, eyeY: 1.62 }, boxes, rng: rngM.makeRng('st') }, 1 / 60).enemy
            done = reachedGoal(e)
          }
          ok(done,
            `${type} 가 (${f.x.toFixed(1)},${f.z.toFixed(1)}) 벽에 낀 채 ${budget}프레임 안에 목적 달성 — ${d0.toFixed(1)} → ${Math.hypot(e.x, e.z).toFixed(1)}`)
        }
      }
    }
  }

  // 적도 벽을 통과하지 않는다
  {
    let e = makeEnemy('brute', 13, 13)
    e.state = 'chasing'; e.stateT = 1
    let bad = 0
    for (let i = 0; i < 1500; i++) {
      e = tickEnemy(e, { player: { x: 0, y: 0, z: 0, eyeY: 1.62 }, boxes, rng: rngM.makeRng('w') }, 1 / 60).enemy
      const r = ENEMY_TYPES.brute.radius
      for (const b of boxes) {
        const nx = Math.max(b.minX, Math.min(e.x, b.maxX))
        const nz = Math.max(b.minZ, Math.min(e.z, b.maxZ))
        if (Math.hypot(e.x - nx, e.z - nz) < r - 1e-6) { bad++; break }
      }
    }
    eq(bad, 0, '적이 벽에 안 박힘')
  }
  // 순수성 — tickEnemy 가 원본을 안 건드린다
  {
    const e = makeEnemy('crawler', 5, 5)
    e.state = 'chasing'; e.stateT = 1
    const snap = JSON.stringify(e)
    tickEnemy(e, ctx(0, 0), 1 / 60)
    eq(JSON.stringify(e), snap, 'tickEnemy 는 입력을 변형하지 않음')
  }
  {
    const e = makeEnemy('crawler', 5, 5)
    const snap = JSON.stringify(e)
    damageEnemy(e, 10)
    eq(JSON.stringify(e), snap, 'damageEnemy 는 입력을 변형하지 않음')
  }
  // 아이디 유일성
  {
    resetEnemyIds()
    const ids = new Set()
    for (let i = 0; i < 5000; i++) ids.add(makeEnemy('crawler', 0, 0).id)
    eq(ids.size, 5000, '적 아이디는 전부 다름')
  }
}

// ══════════════════════════════════════════════════════ waves
section('waves — 난이도 곡선')
{
  const { waveComposition, waveTotal, waveScaling, spawnSchedule, pickupsForWave,
          MAX_CRAWLERS, MAX_TROOPERS, MAX_BRUTES, WAVE_BREAK } = waveM

  eq(waveComposition(1).crawler, 6, '1웨이브 크롤러 6')
  eq(waveComposition(1).trooper, 0, '1웨이브 트루퍼 없음')
  eq(waveComposition(1).brute, 0, '1웨이브 브루트 없음')
  ok(waveComposition(2).trooper > 0, '2웨이브부터 트루퍼')
  eq(waveComposition(2).brute, 0, '2웨이브 브루트 아직')
  ok(waveComposition(3).brute > 0, '3웨이브부터 브루트')

  // ★ 단조증가
  {
    let mono = true
    let prev = 0
    for (let n = 1; n <= 100; n++) {
      const t = waveTotal(n)
      if (t < prev) mono = false
      prev = t
    }
    ok(mono, '총 적 수는 웨이브에 대해 단조증가')
  }
  {
    let monoAll = true
    for (let n = 1; n < 100; n++) {
      const a = waveComposition(n), b = waveComposition(n + 1)
      if (b.crawler < a.crawler || b.trooper < a.trooper || b.brute < a.brute) monoAll = false
    }
    ok(monoAll, '종류별로도 줄지 않음')
  }
  // 상한
  for (let n = 1; n <= 200; n++) {
    const c = waveComposition(n)
    ok(c.crawler <= MAX_CRAWLERS, '크롤러 상한')
    ok(c.trooper <= MAX_TROOPERS, '트루퍼 상한')
    ok(c.brute <= MAX_BRUTES, '브루트 상한')
    ok(waveTotal(n) > 0, '웨이브에 적이 있음')
  }
  eq(waveComposition(1).crawler, waveComposition(1.9).crawler, '소수 웨이브는 내림')
  eq(waveComposition(0).crawler, waveComposition(1).crawler, '0 이하는 1로 취급')
  eq(waveComposition(-5).crawler, waveComposition(1).crawler, '음수도 1로')

  // 배율
  near(waveScaling(1).hp, 1, 1e-9, '초반 체력 배율 1')
  near(waveScaling(9).hp, 1, 1e-9, '9웨이브까지 배율 없음')
  ok(waveScaling(20).hp > 1, '후반 체력 증가')
  ok(waveScaling(999).speed <= 1.35, '속도 배율 상한')
  {
    const maxSpeed = ENEMY_MAX_SPEED()
    ok(maxSpeed < playerM.PLAYER.speed, `최고 배율에서도 적이 플레이어보다 느림 — ${maxSpeed.toFixed(2)} < ${playerM.PLAYER.speed}`)
  }
  function ENEMY_MAX_SPEED() {
    const s = waveScaling(999).speed
    return Math.max(...Object.values(enemiesM.ENEMY_TYPES).map((t) => t.speed)) * s
  }
  {
    let mono = true, prev = 0
    for (let n = 1; n <= 200; n++) { const v = waveScaling(n).hp; if (v < prev) mono = false; prev = v }
    ok(mono, '체력 배율 단조증가')
  }

  // 스폰 일정
  for (let n = 1; n <= 30; n++) {
    const rng = rngM.makeRng(`w${n}`)
    const sched = spawnSchedule(n, rng)
    eq(sched.length, waveTotal(n), `${n}웨이브 일정 개수 = 구성 합`)

    const counts = { crawler: 0, trooper: 0, brute: 0 }
    let lastIdx = -1
    let sameInRow = 0
    let prevAt = -1
    for (const s of sched) {
      counts[s.type]++
      ok(s.at >= 0, '스폰 시각 0 이상')
      ok(s.at >= prevAt, '스폰 시각 오름차순')
      prevAt = s.at
      ok(s.point && Number.isFinite(s.point.x), '스폰 지점 있음')
      eq(s.point, arenaM.SPAWN_POINTS[s.spawnIndex], '지점과 인덱스 일치')
      if (s.spawnIndex === lastIdx) sameInRow++
      lastIdx = s.spawnIndex
    }
    const comp = waveComposition(n)
    eq(counts.crawler, comp.crawler, `${n}웨이브 크롤러 수`)
    eq(counts.trooper, comp.trooper, `${n}웨이브 트루퍼 수`)
    eq(counts.brute, comp.brute, `${n}웨이브 브루트 수`)
    eq(sameInRow, 0, `${n}웨이브: 같은 지점 연속 스폰 없음`)

    const usedPoints = new Set(sched.map((s) => s.spawnIndex))
    ok(usedPoints.size >= 2, `${n}웨이브는 최소 두 지점 사용`)
  }
  // 재현성
  {
    const a = JSON.stringify(spawnSchedule(7, rngM.makeRng('same')))
    const b = JSON.stringify(spawnSchedule(7, rngM.makeRng('same')))
    eq(a, b, '같은 씨앗이면 같은 일정')
  }
  // 웨이브 길이가 무한정 늘지 않는다
  {
    const dur = (n) => { const s = spawnSchedule(n, rngM.makeRng('d')); return s[s.length - 1].at }
    ok(dur(30) < 40, `30웨이브 스폰 시간이 40초 미만 — ${dur(30).toFixed(1)}s`)
  }
  ok(WAVE_BREAK > 0, '웨이브 사이 휴식 있음')

  // 픽업
  ok(pickupsForWave(2).some((p) => p.weapon === 'rifle'), '2웨이브 소총')
  ok(pickupsForWave(4).some((p) => p.weapon === 'shotgun'), '4웨이브 샷건')
  eq(pickupsForWave(1).length, 0, '1웨이브는 보급 없음')
  {
    let ammoWaves = 0
    for (let n = 1; n <= 30; n++) if (pickupsForWave(n).some((p) => p.kind === 'ammo')) ammoWaves++
    ok(ammoWaves >= 10, `탄약 보급이 꾸준히 나옴 — 30웨이브 중 ${ammoWaves}회`)
  }
  {
    /* ★ 모든 무기가 정확히 한 번씩 풀려야 한다.

       무기를 하나 더 넣고 해제 표에 적는 걸 잊으면, 코드 어디에도
       오류가 없는 채로 영영 못 쥐는 무기가 생긴다. 만든 사람만
       있는 줄 아는 무기가 되는 것이다. */
    const seen = new Map()
    for (let n = 1; n <= 200; n++) {
      for (const p of pickupsForWave(n)) {
        if (p.kind !== 'weapon') continue
        seen.set(p.weapon, (seen.get(p.weapon) || 0) + 1)
      }
    }
    const starting = weaponsM.STARTING_WEAPONS
    for (const id of weaponsM.WEAPON_ORDER) {
      if (starting.includes(id)) {
        ok(!seen.has(id), `${id} 는 처음부터 있으므로 안 떨어진다`)
      } else {
        eq(seen.get(id), 1, `${id} 는 정확히 한 번 떨어진다`)
      }
    }
    eq(seen.size, weaponsM.WEAPON_ORDER.length - starting.length,
      '떨어지는 무기 수 = 전체 - 처음부터 가진 것')

    /* 해제 표에 없는 이름이 적혀 있으면 그 웨이브는 아무것도 안 준다 */
    for (const id of Object.values(waveM.WEAPON_UNLOCKS)) {
      ok(weaponsM.WEAPONS[id], `해제 표의 ${id} 가 실제 무기다`)
    }
    /* 한 웨이브에 무기 하나씩 — 몰아 주면 무엇이 달라졌는지 모른다 */
    for (let n = 1; n <= 200; n++) {
      const guns = pickupsForWave(n).filter((p) => p.kind === 'weapon')
      ok(guns.length <= 1, `${n}웨이브에 무기는 많아야 하나`)
    }
    /* 슬롯이 한쪽으로 쏠리지 않게 — 처음 다섯 자루 안에 세 슬롯이
       모두 한 번씩은 나와야 한다 */
    const order = []
    for (let n = 1; n <= 200; n++) {
      for (const p of pickupsForWave(n)) if (p.kind === 'weapon') order.push(p.weapon)
    }
    const firstFive = new Set(order.slice(0, 5).map((id) => weaponsM.WEAPONS[id].slot))
    ok(firstFive.size >= 2, `초반 해제가 한 슬롯에 몰리지 않는다 — ${[...firstFive].join(',')}`)
  }
}

// ══════════════════════════════════════════════════════ score
section('score — 점수와 콤보')
{
  const { initialScore, comboMultiplier, recordKill, recordWaveClear, tickScore,
          COMBO_WINDOW, MAX_COMBO_MULT, HEADSHOT_BONUS, loadBest, saveBest } = scoreM

  const s0 = initialScore()
  eq(s0.points, 0, '시작 점수 0')
  eq(s0.combo, 0, '시작 콤보 0')

  eq(comboMultiplier(0), 1, '콤보 0 은 1배')
  eq(comboMultiplier(1), 1, '첫 처치는 1배')
  ok(comboMultiplier(2) > 1, '2연속부터 배율')
  ok(comboMultiplier(999) <= MAX_COMBO_MULT, '배율 상한')
  {
    let mono = true, prev = 0
    for (let c = 0; c <= 50; c++) { const v = comboMultiplier(c); if (v < prev) mono = false; prev = v }
    ok(mono, '배율 단조증가')
  }

  {
    const s1 = recordKill(s0, 'crawler', false, 10)
    eq(s1.points, 10, '첫 처치 기본 점수')
    eq(s1.kills, 1, '처치 수 1')
    eq(s1.combo, 1, '콤보 1')
    eq(s1.headshots, 0, '헤드샷 아님')
    eq(s0.points, 0, 'recordKill 은 원본 불변')

    const s2 = recordKill(s1, 'crawler', false, 10)
    ok(s2.points > s1.points + 10, '콤보 이어지면 더 받음')
    eq(s2.combo, 2, '콤보 2')

    const sh = recordKill(s0, 'crawler', true, 10)
    eq(sh.points, Math.round(10 * HEADSHOT_BONUS), '헤드샷 보너스')
    eq(sh.headshots, 1, '헤드샷 카운트')
  }
  /* 콤보 창은 "몰아쳐야 이득"이라는 규칙이다. 너무 길면 사실상
     안 끊겨서, 천천히 한 마리씩 잡아도 배율이 계속 붙는다. 상수를
     그대로 써서 검사하면 값을 늘려도 테스트가 같이 늘어나 못 잡으므로,
     여기서는 숫자를 박아 둔다. */
  ok(COMBO_WINDOW <= 6, `콤보 창이 6초 이하 — got ${COMBO_WINDOW}`)
  ok(COMBO_WINDOW >= 1, `콤보 창이 1초 이상 — got ${COMBO_WINDOW}`)
  {
    let s = recordKill(s0, 'crawler', false, 10)
    s = tickScore(s, 6.5)
    eq(s.combo, 0, '6.5초 쉬면 콤보는 반드시 끊긴다')
  }
  // 콤보 창이 지나면 끊긴다
  {
    let s = recordKill(s0, 'crawler', false, 10)
    eq(s.combo, 1, '콤보 시작')
    s = tickScore(s, COMBO_WINDOW + 0.1)
    eq(s.combo, 0, '시간이 지나면 콤보 리셋')
    eq(s.comboT, 0, '타이머도 0')
    const after = recordKill(s, 'crawler', false, 10)
    eq(after.combo, 1, '끊긴 뒤 다시 1부터')
    eq(after.points, s.points + 10, '배율 없이 기본 점수')
  }
  // 창 안이면 유지
  {
    let s = recordKill(s0, 'crawler', false, 10)
    s = tickScore(s, COMBO_WINDOW * 0.5)
    ok(s.comboT > 0, '창 안에서는 유지')
    eq(s.combo, 1, '콤보 유지')
  }
  {
    const s = tickScore(s0, 1)
    eq(s.combo, 0, '콤보 없을 때 tick 은 무해')
  }
  {
    const s = recordWaveClear(s0, 5)
    eq(s.points, 500, '웨이브 클리어 보너스')
  }
  // 점수는 절대 줄지 않는다
  {
    let s = initialScore()
    let prev = 0
    const rng = rngM.makeRng('sc')
    for (let i = 0; i < 3000; i++) {
      if (rng() < 0.5) s = recordKill(s, 'crawler', rng() < 0.3, 10)
      else s = tickScore(s, rng() * 2)
      ok(s.points >= prev, '점수 단조증가')
      ok(Number.isFinite(s.points), '점수 유한')
      ok(Number.isInteger(s.points), '점수 정수')
      prev = s.points
    }
  }
  // localStorage 없는 환경
  {
    const before = globalThis.localStorage
    delete globalThis.localStorage
    const b = loadBest()
    eq(b.points, 0, 'localStorage 없어도 기본값')
    const saved = saveBest(500, 5)
    eq(saved.points, 500, '저장 실패해도 값은 계산')
    if (before) globalThis.localStorage = before
  }
  // localStorage 흉내
  {
    const store = new Map()
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    }
    saveBest(1000, 7)
    let b = loadBest()
    eq(b.points, 1000, '최고 점수 저장')
    eq(b.wave, 7, '최고 웨이브 저장')
    saveBest(500, 3)
    b = loadBest()
    eq(b.points, 1000, '더 낮은 점수는 안 덮어씀')
    eq(b.wave, 7, '더 낮은 웨이브도 안 덮어씀')
    saveBest(2000, 4)
    b = loadBest()
    eq(b.points, 2000, '더 높은 점수는 갱신')
    eq(b.wave, 7, '웨이브는 각각 최대값')
    // 깨진 데이터
    store.set('bunker-break:best', '{{{not json')
    b = loadBest()
    eq(b.points, 0, '깨진 저장값은 기본값으로')
    delete globalThis.localStorage
  }
}

// ══════════════════════════════════════════════════════ player
section('player — 이동·사격·재장전')
{
  const { PLAYER, initialPlayer, movePlayer, aimDir, tickReload, startReload,
          canFire, consumeShot, switchWeapon, cycleWeapon, hurtPlayer, healPlayer,
          grantPickup, eyeOf } = playerM
  const { WEAPONS } = weaponsM
  const boxes = arenaM.ALL_BOXES
  const NONE = { forward: 0, back: 0, left: 0, right: 0, jump: 0, sprint: 0 }
  const IN = (o) => ({ ...NONE, ...o })

  const p0 = initialPlayer()
  eq(p0.hp, PLAYER.maxHp, '시작 체력 최대')
  eq(p0.weapon, 'pistol', '권총으로 시작')
  ok(p0.onGround, '땅에 서서 시작')
  near(eyeOf(p0), PLAYER.eyeHeight, 1e-9, '눈높이')

  // ★ 걷는 방향과 보는 방향이 일치한다
  {
    for (const yaw of [0, 0.3, 1, Math.PI / 2, 2, Math.PI, -1.2, 4.5, -Math.PI / 2]) {
      const p = { ...initialPlayer(), yaw }
      const moved = movePlayer(p, IN({ forward: 1 }), 0.1, [])
      const mx = moved.x - p.x, mz = moved.z - p.z
      const len = Math.hypot(mx, mz)
      ok(len > 0.01, `yaw=${yaw.toFixed(2)} 전진함`)
      const a = aimDir(p)
      const al = Math.hypot(a.x, a.z)
      const dot = (mx / len) * (a.x / al) + (mz / len) * (a.z / al)
      near(dot, 1, 1e-6, `yaw=${yaw.toFixed(2)} 전진 방향 = 조준 방향`)
    }
  }
  // 오른쪽 스트레이프는 조준 방향과 직각, 그리고 실제로 오른쪽
  {
    for (const yaw of [0, 0.7, Math.PI / 2, 3]) {
      const p = { ...initialPlayer(), yaw }
      const moved = movePlayer(p, IN({ right: 1 }), 0.1, [])
      const mx = moved.x - p.x, mz = moved.z - p.z
      const len = Math.hypot(mx, mz)
      const a = aimDir(p)
      const al = Math.hypot(a.x, a.z)
      const dot = (mx / len) * (a.x / al) + (mz / len) * (a.z / al)
      near(dot, 0, 1e-6, `yaw=${yaw.toFixed(2)} 스트레이프는 직각`)
      /* 오른쪽 = cross(forward, up). forward 수평이 (-sin,-cos) 이므로
         오른쪽은 (cos,-sin) = (-a.z, a.x) 정규화. */
      const rx = -a.z / al, rz = a.x / al
      const rdot = (mx / len) * rx + (mz / len) * rz
      near(rdot, 1, 1e-6, `yaw=${yaw.toFixed(2)} 실제로 오른쪽`)
    }
  }
  // 대각선이 더 빠르지 않다
  {
    const p = initialPlayer()
    const f = movePlayer(p, IN({ forward: 1 }), 0.1, [])
    const fd = Math.hypot(f.x - p.x, f.z - p.z)
    const diag = movePlayer(p, IN({ forward: 1, right: 1 }), 0.1, [])
    const dd = Math.hypot(diag.x - p.x, diag.z - p.z)
    near(dd, fd, 1e-9, '대각선 속도 = 직진 속도')
  }
  // 이동 속도가 규격대로
  {
    const p = initialPlayer()
    const m = movePlayer(p, IN({ forward: 1 }), 1, [])
    near(Math.hypot(m.x - p.x, m.z - p.z), PLAYER.speed, 1e-9, '1초에 speed 만큼')
  }
  // 스프린트는 전진에만
  {
    const p = initialPlayer()
    const run = movePlayer(p, IN({ forward: 1, sprint: 1 }), 0.1, [])
    const walk = movePlayer(p, IN({ forward: 1 }), 0.1, [])
    ok(Math.hypot(run.x - p.x, run.z - p.z) > Math.hypot(walk.x - p.x, walk.z - p.z), '스프린트가 빠름')
    const backRun = movePlayer(p, IN({ back: 1, sprint: 1 }), 0.1, [])
    const backWalk = movePlayer(p, IN({ back: 1 }), 0.1, [])
    near(Math.hypot(backRun.x - p.x, backRun.z - p.z),
         Math.hypot(backWalk.x - p.x, backWalk.z - p.z), 1e-9, '후진 스프린트는 없음')
  }
  // 입력 없으면 안 움직인다
  {
    const p = initialPlayer()
    const m = movePlayer(p, NONE, 0.1, boxes)
    near(m.x, p.x, 1e-9, '가만히 있으면 x 그대로')
    near(m.z, p.z, 1e-9, '가만히 있으면 z 그대로')
  }
  // 점프 → 착지
  {
    let p = initialPlayer()
    p = movePlayer(p, IN({ jump: 1 }), 1 / 60, [])
    ok(!p.onGround, '점프하면 공중')
    ok(p.y > 0, '위로 뜸')
    let maxY = 0, frames = 0
    while (!p.onGround && frames < 600) {
      p = movePlayer(p, NONE, 1 / 60, [])
      maxY = Math.max(maxY, p.y)
      frames++
    }
    ok(p.onGround, '반드시 착지')
    eq(p.y, 0, '착지하면 y=0')
    eq(p.vy, 0, '착지하면 수직 속도 0')
    ok(maxY > 0.5 && maxY < 3, `점프 높이 합리적 — ${maxY.toFixed(2)}`)
    // 엄폐물보다 낮게 뛰어야 (올라설 수 없다는 전제)
    const lowest = Math.min(...arenaM.COVER_BOXES.map((b) => b.maxY))
    ok(maxY < lowest, `점프(${maxY.toFixed(2)})가 가장 낮은 엄폐물(${lowest})보다 낮음`)
  }
  // 공중에서 두 번 점프 못 함
  {
    let p = initialPlayer()
    p = movePlayer(p, IN({ jump: 1 }), 1 / 60, [])
    const vy1 = p.vy
    p = movePlayer(p, IN({ jump: 1 }), 1 / 60, [])
    ok(p.vy < vy1, '공중 점프 불가')
  }
  // 플레이어도 벽을 통과 못 한다
  {
    let p = initialPlayer()
    for (let i = 0; i < 3000; i++) p = movePlayer(p, IN({ forward: 1 }), 1 / 60, boxes)
    ok(Math.abs(p.z) <= arenaM.ARENA.half, '아레나 안에 머묾')
    for (const b of boxes) {
      const nx = Math.max(b.minX, Math.min(p.x, b.maxX))
      const nz = Math.max(b.minZ, Math.min(p.z, b.maxZ))
      ok(Math.hypot(p.x - nx, p.z - nz) >= PLAYER.radius - 1e-6, '플레이어가 벽에 안 박힘')
    }
  }
  // 무작위 조작 스트레스 — 절대 아레나를 벗어나지 않는다
  {
    let p = initialPlayer()
    const rng = rngM.makeRng('stress')
    let out = 0
    for (let i = 0; i < 18000; i++) {
      p = { ...p, yaw: p.yaw + (rng() - 0.5) * 0.6 }
      p = movePlayer(p, IN({
        forward: rng() < 0.5 ? 1 : 0, back: rng() < 0.2 ? 1 : 0,
        left: rng() < 0.3 ? 1 : 0, right: rng() < 0.3 ? 1 : 0,
        jump: rng() < 0.05 ? 1 : 0, sprint: rng() < 0.4 ? 1 : 0,
      }), 1 / 60, boxes)
      if (Math.abs(p.x) > arenaM.ARENA.half + 0.01 || Math.abs(p.z) > arenaM.ARENA.half + 0.01) out++
      if (!Number.isFinite(p.x) || !Number.isFinite(p.z) || !Number.isFinite(p.y)) { out += 1000; break }
    }
    eq(out, 0, '1.8만 프레임 무작위 조작에도 맵 밖으로 못 나감')
  }
  // aimDir 은 언제나 단위벡터
  {
    const rng = rngM.makeRng('aim')
    for (let i = 0; i < 5000; i++) {
      const p = { yaw: (rng() - 0.5) * 20, pitch: (rng() - 0.5) * Math.PI * 0.98 }
      const a = aimDir(p)
      near(Math.hypot(a.x, a.y, a.z), 1, 1e-9, 'aimDir 단위벡터')
    }
    near(aimDir({ yaw: 0, pitch: 0 }).z, -1, 1e-12, 'yaw=0 은 -Z')
    near(aimDir({ yaw: 0, pitch: Math.PI / 2 }).y, 1, 1e-9, 'pitch 최대는 위')
  }

  // ── 사격 ──
  {
    let p = initialPlayer()
    ok(canFire(p), '처음엔 쏠 수 있음')
    const before = p.ammo.pistol.inMag
    p = consumeShot(p)
    eq(p.ammo.pistol.inMag, before - 1, '한 발 줄어듦')
    ok(!canFire(p), '쿨다운 중엔 못 쏨')
    near(p.cooldown, 1 / 3, 1e-9, '권총 쿨다운')
    p = movePlayer(p, NONE, 1 / 3 + 0.01, [])
    ok(canFire(p), '쿨다운 지나면 다시 가능')
  }
  // 탄창을 비우면 자동 재장전
  {
    let p = initialPlayer()
    for (let i = 0; i < WEAPONS.pistol.mag; i++) {
      p = consumeShot(p)
      p = { ...p, cooldown: 0 }
    }
    eq(p.ammo.pistol.inMag, 0, '탄창 빔')
    ok(p.reloading > 0, '자동 재장전 시작')
    ok(!canFire(p), '재장전 중엔 못 쏨')
    p = tickReload(p, WEAPONS.pistol.reload + 0.01)
    eq(p.ammo.pistol.inMag, WEAPONS.pistol.mag, '재장전 완료')
    eq(p.reloading, 0, '재장전 끝')
    ok(canFire(p), '다시 쏠 수 있음')
  }
  // 예비탄이 정확히 준다
  {
    let p = initialPlayer()
    p = grantPickup(p, { kind: 'weapon', weapon: 'rifle' })
    p = switchWeapon(p, 'rifle')
    eq(p.weapon, 'rifle', '소총으로 전환')
    p = { ...p, cooldown: 0 }
    for (let i = 0; i < 10; i++) { p = consumeShot(p); p = { ...p, cooldown: 0 } }
    const magBefore = p.ammo.rifle.inMag
    const resBefore = p.ammo.rifle.reserve
    p = startReload(p)
    p = tickReload(p, WEAPONS.rifle.reload + 0.01)
    const filled = p.ammo.rifle.inMag - magBefore
    eq(p.ammo.rifle.reserve, resBefore - filled, '예비탄이 채운 만큼 준다')
    eq(p.ammo.rifle.inMag, WEAPONS.rifle.mag, '탄창 가득')
  }
  // 권총 예비탄은 무한이라 안 준다
  {
    let p = initialPlayer()
    p = { ...p, cooldown: 0 }
    for (let i = 0; i < 5; i++) { p = consumeShot(p); p = { ...p, cooldown: 0 } }
    p = startReload(p)
    p = tickReload(p, 2)
    eq(p.ammo.pistol.reserve, Infinity, '권총 예비탄 무한 유지')
  }
  // 꽉 찬 상태에서 R 은 무시
  {
    const p = initialPlayer()
    eq(startReload(p).reloading, 0, '꽉 차면 재장전 안 함')
  }
  // 재장전 중 R 을 또 눌러도 늘어나지 않는다
  {
    let p = initialPlayer()
    p = { ...p, ammo: { ...p.ammo, pistol: { ...p.ammo.pistol, inMag: 1 } } }
    p = startReload(p)
    const t = p.reloading
    p = tickReload(p, 0.3)
    p = startReload(p)
    ok(p.reloading < t, '재장전이 되감기지 않음')
  }
  // 무기 전환
  {
    let p = initialPlayer()
    eq(switchWeapon(p, 'rifle').weapon, 'pistol', '없는 무기로는 못 바꿈')
    eq(switchWeapon(p, 'nope').weapon, 'pistol', '없는 아이디는 무시')
    p = grantPickup(p, { kind: 'weapon', weapon: 'rifle' })
    eq(p.weapon, 'rifle', '처음 주운 무기는 바로 손에')
    ok(p.ammo.rifle.owned, '소지 표시')
    p = grantPickup(p, { kind: 'weapon', weapon: 'shotgun' })
    eq(p.weapon, 'shotgun', '샷건도 바로')
    p = switchWeapon(p, 'pistol')
    eq(p.weapon, 'pistol', '권총으로 복귀')
    // 순환 — 가진 무기를 전부 한 번씩 거치고 제자리로
    const ownedCount = weaponsM.WEAPON_ORDER.filter((id) => p.ammo[id]?.owned).length
    const seen = new Set()
    let q = p
    for (let i = 0; i < ownedCount; i++) { seen.add(q.weapon); q = cycleWeapon(q, 1) }
    eq(seen.size, ownedCount, `순환이 가진 무기 ${ownedCount}종을 모두 거침`)
    eq(q.weapon, p.weapon, '한 바퀴 돌면 제자리')
  }

  /* ── 슬롯 전환 — 1·2·3 이 역할을 가리킨다 ────────────────────── */
  {
    const { switchSlot } = playerM
    let p = initialPlayer()

    eq(switchSlot(p, 'secondary').weapon, 'pistol', '2 는 언제나 보조무기')
    eq(switchSlot(p, 'melee').weapon, 'knife', '3 은 언제나 근접무기')
    /* 아직 주무기가 없으면 1 은 아무 일도 하지 않아야 한다.
       빈손으로 바뀌면 그 순간 죽는다. */
    eq(switchSlot(p, 'primary').weapon, p.weapon, '주무기가 없으면 1 은 무시')
    eq(switchSlot(p, 'nope').weapon, p.weapon, '없는 슬롯은 무시')

    p = grantPickup(p, { kind: 'weapon', weapon: 'rifle' })
    eq(p.weapon, 'rifle', '주운 주무기를 바로 든다')
    eq(p.slots.primary, 'rifle', '주무기 자리에 들어간다')

    p = switchSlot(p, 'melee')
    eq(p.weapon, 'knife', '근접으로 전환')
    p = switchSlot(p, 'primary')
    eq(p.weapon, 'rifle', '1 을 누르면 아까 그 주무기로 돌아온다')

    /* 주무기 자리를 소총과 샷건이 나눠 쓴다 — 1 을 다시 누르면 교대 */
    p = grantPickup(p, { kind: 'weapon', weapon: 'shotgun' })
    ok(p.ammo.rifle.owned && p.ammo.shotgun.owned, '샷건을 주워도 소총을 잃지 않는다')
    const first = p.weapon
    p = { ...p, cooldown: 0 }
    p = switchSlot(p, 'primary')
    ok(p.weapon !== first, `1 을 다시 누르면 다른 주무기 — ${first} → ${p.weapon}`)
    eq(weaponsM.WEAPONS[p.weapon].slot, 'primary', '여전히 주무기 슬롯')
    p = { ...p, cooldown: 0 }
    p = switchSlot(p, 'primary')
    eq(p.weapon, first, '한 번 더 누르면 원래 것으로')

    /* 슬롯을 오간 뒤에도 각 자리가 마지막에 들던 무기를 기억해야 한다.

       일부러 "그 슬롯의 첫 번째가 아닌" 무기를 들어 둔다. 첫 번째를
       들고 확인하면, 기억을 안 하고 늘 첫 번째를 꺼내는 구현도
       똑같이 통과해 버려서 시험이 아무것도 재지 못한다. */
    const primaries = weaponsM.WEAPONS_BY_SLOT.primary
    const ownedPrimaries = primaries.filter((id) => p.ammo[id]?.owned)
    ok(ownedPrimaries.length >= 2, '주무기를 둘 이상 가지고 있다')
    const notFirst = ownedPrimaries[ownedPrimaries.length - 1]
    for (let i = 0; i < primaries.length && p.weapon !== notFirst; i++) {
      p = switchSlot({ ...p, cooldown: 0 }, 'primary')
    }
    eq(p.weapon, notFirst, `주무기 자리에 ${notFirst} 를 들었다`)
    ok(notFirst !== ownedPrimaries[0], '그 무기는 가진 것 중 첫 번째가 아니다')

    p = switchSlot({ ...p, cooldown: 0 }, 'secondary')
    eq(p.weapon, 'pistol', '보조무기로 옮겼다')
    p = switchSlot({ ...p, cooldown: 0 }, 'primary')
    eq(p.weapon, notFirst, '주무기 자리가 마지막에 들던 것을 기억한다')
  }

  /* ── 근접무기는 탄약을 쓰지 않는다 ───────────────────────────── */
  {
    const { switchSlot } = playerM
    let p = switchSlot(initialPlayer(), 'melee')
    eq(p.weapon, 'knife', '나이프를 들었다')
    p = { ...p, cooldown: 0 }

    const knifeMag0 = p.ammo.knife.inMag
    for (let i = 0; i < 200; i++) {
      ok(canFire(p), `${i}번째 휘두르기 가능 — 탄약이 떨어질 수 없다`)
      p = consumeShot(p)
      eq(p.reloading, 0, '나이프는 자동 재장전에 걸리지 않는다')
      /* 탄창을 아예 안 건드려야 한다. 소비하게 두면 0 에서 음수로
         내려가고, 그러면 탄약으로 재는 곳마다 조용히 어긋난다. */
      eq(p.ammo.knife.inMag, knifeMag0, '나이프 탄창은 변하지 않는다')
      ok(p.ammo.knife.inMag >= 0, '나이프 탄창이 음수가 되지 않는다')
      p = { ...p, cooldown: 0 }
    }
    eq(startReload(p).reloading, 0, 'R 을 눌러도 재장전하지 않는다')
    eq(p.ammo.pistol.inMag, WEAPONS.pistol.mag, '나이프를 휘둘러도 권총 탄창은 그대로')

    // 탄약 보급을 먹어도 나이프 쪽은 건드리지 않는다
    const after = grantPickup(p, { kind: 'ammo' })
    eq(after.ammo.knife.reserve, p.ammo.knife.reserve, '나이프에 탄약을 넣지 않는다')
  }
  // 이미 가진 무기를 또 주우면 탄약 보급
  {
    let p = initialPlayer()
    p = grantPickup(p, { kind: 'weapon', weapon: 'rifle' })
    const r1 = p.ammo.rifle.reserve
    p = grantPickup(p, { kind: 'weapon', weapon: 'rifle' })
    ok(p.ammo.rifle.reserve > r1, '중복 획득은 탄약으로')
    ok(p.ammo.rifle.reserve <= WEAPONS.rifle.reserve, '예비탄 상한')
  }
  // 탄약 픽업
  {
    let p = initialPlayer()
    p = grantPickup(p, { kind: 'weapon', weapon: 'rifle' })
    p = { ...p, ammo: { ...p.ammo, rifle: { ...p.ammo.rifle, reserve: 0 } } }
    p = grantPickup(p, { kind: 'ammo' })
    ok(p.ammo.rifle.reserve > 0, '탄약 보급됨')
    eq(p.ammo.shotgun.reserve, 0, '안 가진 무기엔 안 줌')
    eq(p.ammo.pistol.reserve, Infinity, '무한은 그대로')
  }
  // 체력
  {
    let p = initialPlayer()
    const r1 = hurtPlayer(p, 30, { x: 1, z: 0 }, 0)
    eq(r1.player.hp, 70, '피해 적용')
    ok(!r1.blocked, '첫 피격은 안 막힘')
    // 무적 시간
    const r2 = hurtPlayer(r1.player, 30, { x: 1, z: 0 }, 0)
    ok(r2.blocked, '무적 중 피격 무시')
    eq(r2.player.hp, 70, '체력 그대로')
    // 무적이 풀린 뒤
    let p3 = movePlayer(r1.player, NONE, PLAYER.invulnAfterHit + 0.01, [])
    const r3 = hurtPlayer(p3, 30, { x: 1, z: 0 }, 0)
    ok(!r3.blocked, '무적 풀리면 다시 맞음')
    eq(r3.player.hp, 40, '두 번째 피해')
    // 죽음 — 무적이 풀린 뒤라야 실제로 맞는다
    const ready = movePlayer(r3.player, NONE, PLAYER.invulnAfterHit + 0.01, [])
    const dead = hurtPlayer(ready, 999, null, 0)
    eq(dead.player.hp, 0, '체력 0 에서 멈춤')
    ok(dead.died, '사망 표시')
    ok(!hurtPlayer(ready, 39, null, 0).died, '치명타가 아니면 안 죽음')
    // 치유 상한
    eq(healPlayer(initialPlayer(), 50).hp, PLAYER.maxHp, '최대 체력 초과 안 함')
    eq(healPlayer({ ...initialPlayer(), hp: 10 }, 35).hp, 45, '치유량 적용')
    eq(grantPickup({ ...initialPlayer(), hp: 10 }, { kind: 'health' }).hp, 45, '체력 픽업')
  }
  // 넉백이 실제로 밀고, 잦아든다
  {
    let p = initialPlayer()
    const r = hurtPlayer(p, 10, { x: 1, z: 0 }, 7)
    ok(r.player.knock.x > 0, '넉백 속도 생김')
    p = r.player
    const x0 = p.x
    p = movePlayer(p, NONE, 1 / 60, [])
    ok(p.x > x0, '넉백으로 밀림')
    for (let i = 0; i < 300; i++) p = movePlayer(p, NONE, 1 / 60, [])
    ok(Math.abs(p.knock.x) < 0.01, '넉백이 잦아듦')
    ok(Number.isFinite(p.x), '넉백 후 좌표 유한')
  }
  // 넉백으로도 벽을 못 뚫는다
  {
    let p = initialPlayer()
    p = hurtPlayer(p, 1, { x: 1, z: 0 }, 500).player
    for (let i = 0; i < 600; i++) p = movePlayer(p, NONE, 1 / 60, boxes)
    ok(Math.abs(p.x) <= arenaM.ARENA.half, '강한 넉백도 벽을 못 뚫음')
  }
  // 순수성
  {
    const p = initialPlayer()
    const snap = JSON.stringify(p)
    movePlayer(p, IN({ forward: 1 }), 0.1, boxes)
    consumeShot(p)
    startReload(p)
    hurtPlayer(p, 10, { x: 1, z: 0 }, 5)
    grantPickup(p, { kind: 'weapon', weapon: 'rifle' })
    eq(JSON.stringify(p), snap, 'player 함수들이 입력을 변형하지 않음')
  }
}

// ══════════════════════════════════════════════════════ 통합
section('통합 — 한 판을 끝까지 돌린다')
{
  const { makeEnemy, tickEnemy, damageEnemy, shouldRemove, ENEMY_TYPES, resetEnemyIds } = enemiesM
  const { initialPlayer, movePlayer, aimDir, hurtPlayer, canFire, consumeShot, tickReload, PLAYER } = playerM
  const { fireShot } = combatM
  const { WEAPONS } = weaponsM
  const { spawnSchedule, waveScaling, waveComposition } = waveM
  const { initialScore, recordKill, tickScore, recordWaveClear } = scoreM
  const boxes = arenaM.ALL_BOXES

  /* 가만히 서서 쏘기만 하는 봇으로 8웨이브를 돌린다. 목적은 "이긴다"가
     아니라, 어느 프레임에서도 값이 깨지거나 멈추지 않는지 확인하는 것. */
  resetEnemyIds()
  const rng = rngM.makeRng('sim')
  let p = initialPlayer()
  let score = initialScore()
  let enemies = []
  let events = { died: 0, melee: 0, shoot: 0 }
  let frames = 0
  let maxEnemies = 0
  const dt = 1 / 60

  for (let wave = 1; wave <= 8; wave++) {
    const sched = spawnSchedule(wave, rng)
    const scale = waveScaling(wave)
    let t = 0
    let spawned = 0
    let guard = 0

    /* 웨이브 하나가 이 프레임 수를 넘으면 뭔가 안 끝나고 있다는 뜻이다
       — 대개 적이 벽에 끼어 영영 안 오는 경우. 넉넉히 3분치. */
    const GUARD = 12000
    while ((spawned < sched.length || enemies.some((e) => e.state !== 'dead')) && guard < GUARD) {
      guard++; frames++; t += dt

      while (spawned < sched.length && sched[spawned].at <= t) {
        const s = sched[spawned++]
        const e = makeEnemy(s.type, s.point.x, s.point.z)
        e.hp = Math.round(e.hp * scale.hp)
        e.maxHp = e.hp
        enemies.push(e)
      }
      maxEnemies = Math.max(maxEnemies, enemies.filter((e) => e.state !== 'dead').length)

      // 적 갱신
      const ctx = { player: { x: p.x, y: p.y, z: p.z, eyeY: p.y + PLAYER.eyeHeight }, boxes, rng }
      const next = []
      for (const e of enemies) {
        const r = tickEnemy(e, ctx, dt)
        for (const ev of r.events) {
          events[ev.type] = (events[ev.type] || 0) + 1
          if (ev.type === 'died') {
            score = recordKill(score, ev.enemy.type, false, ENEMY_TYPES[ev.enemy.type].score)
          } else if (ev.damage > 0) {
            const hr = hurtPlayer(p, ev.damage, { x: 0, z: 1 }, ev.knockback || 0)
            p = hr.player
          }
        }
        if (!shouldRemove(r.enemy)) next.push(r.enemy)
      }
      enemies = next

      /* 봇은 무적이고 제자리를 지킨다 — 여기서 보는 건 안정성이지
         난이도가 아니다. 넉백까지 지워야 한다. 안 지우면 브루트에게
         떠밀려 구석으로 조금씩 밀려나고, 결국 아무것도 안 보이는
         자리에서 멈춘 채로 웨이브가 안 끝난다. 게임의 결함이 아니라
         "가만히 서 있는 봇"이라는 전제가 깨진 것이다. */
      p = { ...p, hp: PLAYER.maxHp, invuln: 0, knock: { x: 0, z: 0 } }

      // 가장 가까운 적을 조준해 쏜다
      const alive = enemies.filter((e) => e.state !== 'dead')
      /* 실제 사람처럼, 보이는 적 중 가장 가까운 놈을 쏜다. 벽 뒤
         목표를 붙잡고 벽에 총알을 박고 있으면 시뮬레이션이 게임을
         검증하는 게 아니라 봇의 바보짓을 재는 것이 된다. */
      const eyeNow = p.y + PLAYER.eyeHeight
      const visible = alive.filter((e) =>
        collideM.hasLineOfSight(
          p.x, eyeNow, p.z, e.x, ENEMY_TYPES[e.type].height * 0.5, e.z, boxes,
        ))
      if (visible.length) {
        let best = visible[0], bd = Infinity
        for (const e of visible) {
          const d = Math.hypot(e.x - p.x, e.z - p.z)
          if (d < bd) { bd = d; best = e }
        }
        /* 몸통 한가운데를 겨눈다. 눈높이(1.62)에서 수평으로 쏘면
           키 1.05 인 크롤러 머리 위로 전부 넘어간다 — 처음에 이걸
           빠뜨려서 봇이 한 마리도 못 잡았다. */
        const dx = best.x - p.x
        const dz = best.z - p.z
        const flat = Math.hypot(dx, dz)
        const targetY = ENEMY_TYPES[best.type].height * 0.5
        const eyeY = p.y + PLAYER.eyeHeight
        p = { ...p, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(targetY - eyeY, flat) }
        if (canFire(p)) {
          const origin = { x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z }
          const dir = aimDir(p)
          const w = WEAPONS[p.weapon]
          const res = fireShot(w, origin, dir, alive, boxes, rng)
          for (const d of res.damages) {
            const i = enemies.findIndex((e) => e.id === d.enemy.id)
            if (i >= 0) enemies[i] = damageEnemy(enemies[i], d.damage)
          }
          p = consumeShot(p)
        }
      }
      p = tickReload(p, dt)
      p = movePlayer(p, { forward: 0, back: 0, left: 0, right: 0, jump: 0, sprint: 0 }, dt, boxes)
      score = tickScore(score, dt)

      // 매 프레임 불변식
      if (!Number.isFinite(p.x) || !Number.isFinite(p.z) || !Number.isFinite(p.y)) {
        ok(false, '플레이어 좌표가 깨짐'); break
      }
      for (const e of enemies) {
        if (!Number.isFinite(e.x) || !Number.isFinite(e.z) || e.hp < 0) { ok(false, '적 상태가 깨짐'); break }
      }
    }
    ok(guard < GUARD, `${wave}웨이브가 제한 프레임 안에 끝남`)
    const left = enemies.filter((e) => e.state !== 'dead')
    ok(left.length === 0,
      `${wave}웨이브 전멸 — 남은 ${left.length}${left.length ? ` (예: ${left[0].type} @ ${left[0].x.toFixed(1)},${left[0].z.toFixed(1)})` : ''}`)
    score = recordWaveClear(score, wave)
  }

  const expectedKills = [1, 2, 3, 4, 5, 6, 7, 8].reduce((a, n) => {
    const c = waveComposition(n); return a + c.crawler + c.trooper + c.brute
  }, 0)
  eq(events.died, expectedKills, `8웨이브 총 처치 수 = 스폰 수 (${expectedKills})`)
  eq(score.kills, expectedKills, '점수판 처치 수 일치')
  ok(score.points > 0, '점수가 쌓임')
  ok(Number.isInteger(score.points), '점수 정수')
  ok(maxEnemies <= 40, `동시 등장 적 수가 관리 범위 — 최대 ${maxEnemies}`)
  ok(frames > 0 && frames < 200000, `시뮬레이션 프레임 수 합리적 — ${frames}`)
  process.stdout.write(`   (8웨이브 ${frames}프레임 ≈ ${(frames / 60).toFixed(0)}초, 처치 ${events.died}, 점수 ${score.points}, 동시최대 ${maxEnemies})\n`)
}

// ══════════════════════════════════════════════════════
section('결과')
if (fail) {
  for (const f of fails.slice(0, 40)) console.log('  ✗ ' + f)
  if (fails.length > 40) console.log(`  ... 외 ${fails.length - 40}건`)
}
console.log(`\n${fail === 0 ? '✅' : '❌'}  통과 ${pass} / 실패 ${fail}\n`)
process.exit(fail ? 1 : 0)
