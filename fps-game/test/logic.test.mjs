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
const diffM = await load('difficulty.js')
const mapsM = await load('maps.js')

/* 충돌·이동·적 길찾기 검사는 맵 하나 위에서 돈다. 마흔 장 전부에
   대해서는 위 "맵" 절이 배치 규칙을 보고, 아래 "모든 맵에서 적이
   도달하는가" 절이 길찾기를 본다. 여기서는 대표로 벙커를 쓴다. */
const BUNKER = mapsM.getMap('bunker')
const sessionM = await load('session.js')

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
section('맵 — 마흔 장이 전부 성립하는가')
{
  const { MAPS, getMap, pickMap, DEFAULT_MAP } = mapsM
  const { MIN_GAP, insideArena } = arenaM
  const { STEP_HEIGHT } = collideM
  const { ENEMY_TYPES } = enemiesM
  const { PLAYER } = playerM

  eq(MAPS.length, 40, '맵이 마흔 장')
  eq(new Set(MAPS.map((m) => m.id)).size, MAPS.length, '아이디가 서로 다르다')
  eq(new Set(MAPS.map((m) => m.name)).size, MAPS.length, '이름이 서로 다르다')
  for (const m of MAPS) ok(m.name && m.blurb, `${m.id} 에 이름과 설명이 있다`)
  eq(getMap('없는맵').id, DEFAULT_MAP, '모르는 이름은 기본 맵으로')

  /* 뽑기가 마흔 장을 골고루 뽑는가 — 한두 장만 나오면 마흔 장을 만든
     의미가 없다 */
  {
    const seen = new Map()
    const rng = rngM.makeRng('pick')
    const draws = MAPS.length * 500
    const share = draws / MAPS.length
    for (let i = 0; i < draws; i++) {
      const m = pickMap(rng)
      seen.set(m.id, (seen.get(m.id) || 0) + 1)
    }
    eq(seen.size, MAPS.length, '마흔 장이 모두 뽑힌다')
    for (const [id, n] of seen) {
      ok(n > share * 0.55 && n < share * 1.6, `${id} 가 치우치지 않게 나온다 — ${n}`)
    }
  }

  const widestR = Math.max(...Object.values(ENEMY_TYPES).map((t) => t.radius))
  const jumpApex = (PLAYER.jumpSpeed ** 2) / (2 * PLAYER.gravity)
  const floorReach = jumpApex + STEP_HEIGHT
  const catwalkReach = arenaM.CATWALK_H + floorReach

  for (const map of MAPS) {
    const tag = map.name
    const boxes = map.boxes

    // 담장은 어느 맵이든 같다
    eq(map.wallBoxes.length, 4, `${tag}: 담장 네 짝`)
    for (const b of boxes) {
      ok(b.minX < b.maxX && b.minZ < b.maxZ && b.minY < b.maxY, `${tag}: 상자 min<max`)
    }
    eq(boxes.length, map.wallBoxes.length + map.coverBoxes.length + map.stairBoxes.length,
      `${tag}: 전체 = 담장 + 엄폐물 + 계단`)

    /* ★ 통행 가능한 틈 — 배치가 물리를 깨뜨리지 않는지.

       두 상자가 한 축에서 겹쳐 있으면 다른 축의 틈은 0(붙어 있음)이거나
       MIN_GAP 이상이어야 한다. 그 사이의 어중간한 틈에 낀 것은 양쪽에서
       번갈아 밀려 밀어내기가 수렴하지 못하고 결국 벽을 뚫는다. */
    {
      const G = map.gapChecked
      const overlap = (aMin, aMax, bMin, bMax) => aMin < bMax - 1e-9 && bMin < aMax - 1e-9
      for (let i = 0; i < G.length; i++) {
        for (let j = i + 1; j < G.length; j++) {
          const a = G[i], b = G[j]
          if (overlap(a.minX, a.maxX, b.minX, b.maxX)) {
            const gap = Math.max(b.minZ - a.maxZ, a.minZ - b.maxZ)
            ok(gap <= 0 || gap >= MIN_GAP, `${tag}: z 틈 ${gap.toFixed(2)}`)
          }
          if (overlap(a.minZ, a.maxZ, b.minZ, b.maxZ)) {
            const gap = Math.max(b.minX - a.maxX, a.minX - b.maxX)
            ok(gap <= 0 || gap >= MIN_GAP, `${tag}: x 틈 ${gap.toFixed(2)}`)
          }
          if (!overlap(a.minX, a.maxX, b.minX, b.maxX) &&
              !overlap(a.minZ, a.maxZ, b.minZ, b.maxZ)) {
            const gx = Math.max(b.minX - a.maxX, a.minX - b.maxX)
            const gz = Math.max(b.minZ - a.maxZ, a.minZ - b.maxZ)
            if (gx > 0 && gz > 0) {
              ok(Math.hypot(gx, gz) >= MIN_GAP, `${tag}: 대각선 틈 ${Math.hypot(gx, gz).toFixed(2)}`)
            }
          }
        }
      }
    }

    /* ★ 계단 한 칸은 걸어 오를 수 있어야 하고, 통로까지 이어져야 한다 */
    if (map.stairBoxes.length > 0) {
      const tops = [...new Set(map.stairBoxes.map((b) => +b.maxY.toFixed(4)))].sort((a, b) => a - b)
      let prev = 0
      for (const top of tops) {
        ok(top - prev <= STEP_HEIGHT + 1e-9, `${tag}: 계단 한 칸 ${(top - prev).toFixed(2)}`)
        prev = top
      }
      ok(arenaM.CATWALK_H - prev <= STEP_HEIGHT + 1e-9,
        `${tag}: 마지막 계단에서 통로까지 한 걸음 — ${(arenaM.CATWALK_H - prev).toFixed(2)}`)
    }

    /* ★ 통로는 바닥에서 점프해 못 닿고, 엄폐물은 통로에서도 못 오른다 */
    for (const b of map.coverBoxes) {
      const isWalk = Math.abs(b.maxY - arenaM.CATWALK_H) < 1e-6
      if (isWalk) {
        ok(b.maxY > floorReach, `${tag}: 통로(${b.maxY})가 바닥 점프(${floorReach.toFixed(2)})보다 높다`)
      } else {
        ok(b.maxY > catwalkReach,
          `${tag}: 엄폐물(${b.maxY})이 통로 점프(${catwalkReach.toFixed(2)})보다 높다`)
      }
    }

    /* ★ 스폰 지점 — 아레나 안, 시작점에서 멀리, 지형에 안 낌 */
    ok(map.spawns.length >= 6, `${tag}: 스폰 지점이 넉넉하다 — ${map.spawns.length}`)
    for (const sp of map.spawns) {
      ok(insideArena(sp.x, sp.z, 1), `${tag}: 스폰 (${sp.x},${sp.z}) 아레나 안`)
      const d = Math.hypot(sp.x - map.playerStart.x, sp.z - map.playerStart.z)
      ok(d >= 10, `${tag}: 스폰 (${sp.x},${sp.z}) 시작점에서 10 이상 — ${d.toFixed(1)}`)
      for (const b of boxes) {
        /* 밟고 설 수 있는 낮은 것(계단·통로)은 그 위에서 나와도 된다 */
        if (b.maxY <= arenaM.CATWALK_H + 1e-6) continue
        const nx = Math.max(b.minX, Math.min(sp.x, b.maxX))
        const nz = Math.max(b.minZ, Math.min(sp.z, b.maxZ))
        const gap = Math.hypot(sp.x - nx, sp.z - nz)
        ok(gap >= widestR + 0.3,
          `${tag}: 스폰 (${sp.x},${sp.z}) 이 벽에서 떨어져 있다 — ${gap.toFixed(2)}`)
      }
    }

    /* 플레이어 시작점이 지형 안이 아니어야 한다 */
    for (const b of boxes) {
      if (b.maxY <= arenaM.CATWALK_H + 1e-6) continue
      const nx = Math.max(b.minX, Math.min(map.playerStart.x, b.maxX))
      const nz = Math.max(b.minZ, Math.min(map.playerStart.z, b.maxZ))
      ok(Math.hypot(map.playerStart.x - nx, map.playerStart.z - nz) >= PLAYER.radius + 0.2,
        `${tag}: 시작점이 벽에 안 낀다`)
    }

    /* 보급 자리도 지형 안이면 안 된다 */
    for (const pk of map.pickups) {
      ok(insideArena(pk.x, pk.z, 1), `${tag}: 보급 자리가 아레나 안`)
      for (const b of boxes) {
        if (b.maxY <= arenaM.CATWALK_H + 1e-6) continue
        const nx = Math.max(b.minX, Math.min(pk.x, b.maxX))
        const nz = Math.max(b.minZ, Math.min(pk.z, b.maxZ))
        ok(Math.hypot(pk.x - nx, pk.z - nz) >= 1.0, `${tag}: 보급 (${pk.x},${pk.z}) 이 벽 밖`)
      }
    }
  }
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
    const boxes = BUNKER.boxes
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
    const boxes = BUNKER.boxes
    let x = 0, z = 0
    for (let i = 0; i < 2000; i++) {
      const res = resolveMove(x, z, 0.5, 0, 0.36, boxes)
      x = res.x; z = res.z
    }
    ok(x <= arenaM.ARENA.half, `벽에 막힘 — x=${x.toFixed(2)}`)
  }

  /* ── 높이 · 계단 · 통로 ─────────────────────────────────────── */
  {
    const { groundHeightAt, ceilingAt, STEP_HEIGHT } = collideM
    const r = 0.36
    const boxes = BUNKER.boxes

    ok(STEP_HEIGHT > 0 && STEP_HEIGHT < 1, `걸어 오를 턱 높이가 온당하다 — ${STEP_HEIGHT}`)

    // 아무것도 없는 곳은 바닥
    eq(groundHeightAt(0, 0, r, boxes, 0), 0, '광장 한가운데는 바닥')

    /* ★ 계단 한 칸은 반드시 걸어 오를 수 있어야 한다.
       한 칸이라도 STEP_HEIGHT 를 넘으면 거기서 길이 끊긴다. */
    {
      const stairs = [...BUNKER.stairBoxes].sort((a, b) => a.maxY - b.maxY)
      let prev = 0
      for (const s of stairs) {
        const rise = s.maxY - prev
        if (rise <= 0) continue
        ok(rise <= STEP_HEIGHT + 1e-9,
          `계단 한 칸이 걸어 오를 높이 — ${rise.toFixed(2)} ≤ ${STEP_HEIGHT}`)
        prev = s.maxY
      }
      /* 마지막 칸에서 통로까지도 한 걸음이어야 한다 */
      const top = Math.max(...BUNKER.stairBoxes.map((s) => s.maxY))
      ok(arenaM.CATWALK_H - top <= STEP_HEIGHT + 1e-9,
        `마지막 계단에서 통로까지 한 걸음 — ${(arenaM.CATWALK_H - top).toFixed(2)}`)
    }

    /* ★ 통로는 바닥에서 점프해도 못 올라가야 한다.
       올라가지면 계단이 장식이 되고, 길목이라는 설계가 사라진다. */
    {
      const jumpApex = (playerM.PLAYER.jumpSpeed ** 2) / (2 * playerM.PLAYER.gravity)
      const reach = jumpApex + STEP_HEIGHT
      ok(arenaM.CATWALK_H > reach,
        `통로(${arenaM.CATWALK_H})가 바닥 점프 도달(${reach.toFixed(2)})보다 높다`)
      /* 반대로 통로 위에서 점프해도 엄폐물 위로는 못 올라가야 한다 —
         적이 못 닿는 자리에 올라서면 그 판은 거기서 끝난다 */
      const fromCatwalk = arenaM.CATWALK_H + reach
      for (const b of BUNKER.coverBoxes) {
        if (Math.abs(b.maxY - arenaM.CATWALK_H) < 1e-6) continue   // 통로 자신
        ok(b.maxY > fromCatwalk,
          `엄폐물(${b.maxY})이 통로에서 점프해도 못 닿는 높이(${fromCatwalk.toFixed(2)})`)
      }
    }

    // 통로 위에 서면 발밑이 통로 높이
    {
      const cw = BUNKER.coverBoxes.find((b) => Math.abs(b.maxY - arenaM.CATWALK_H) < 1e-6)
      ok(cw, '통로를 찾았다')
      const cx = (cw.minX + cw.maxX) / 2
      const cz = (cw.minZ + cw.maxZ) / 2
      eq(groundHeightAt(cx, cz, r, boxes, arenaM.CATWALK_H), arenaM.CATWALK_H,
        '통로 위에 서면 발밑이 통로')
      /* 통로 밖으로 나가면 떨어질 곳이 바닥이다 */
      eq(groundHeightAt(0, cz, r, boxes, arenaM.CATWALK_H), 0,
        '통로 밖은 발밑이 바닥 — 떨어진다')
    }

    // 천장이 없으면 무한대
    eq(ceilingAt(0, 0, r, boxes, 0), Infinity, '머리 위가 트여 있다')
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
    const boxes = BUNKER.boxes
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
    DEFAULT_LOADOUT,
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
  /* 관통은 특별해야 한다. 절반이 관통하면 그건 축이 아니라 기본값이다. */
  const piercers = WEAPON_ORDER.filter((id) => WEAPONS[id].pierce)
  ok(piercers.length >= 1, '관통 무기가 있다')
  ok(piercers.length <= 3, `관통은 소수에게만 — ${piercers.join(', ')}`)
  for (const id of piercers) {
    ok(WEAPONS[id].slot === 'primary', `${id} 관통은 주무기 자리에만`)
    ok(WEAPONS[id].pierceFalloff > 0 && WEAPONS[id].pierceFalloff < 1,
      `${id} 는 관통할수록 약해진다`)
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

  /* ★ 근접은 총보다 세면 안 된다.

     너프 전에는 부채꼴 안을 전부, 탄약도 없이 베어서 다섯에
     둘러싸이면 초당 400 이 나왔다. 탄을 먹는 최고 주무기(303)보다
     나았으니, 다른 것을 쥘 이유가 없었다. 아래 셋이 그 재발을 막는다. */
  {
    const gunDps = (w) => (w.damage * w.pellets * w.rpm) / 60
    const bestGun = Math.max(...[...WEAPONS_BY_SLOT.primary, ...WEAPONS_BY_SLOT.secondary]
      .map((id) => gunDps(WEAPONS[id])))

    for (const id of WEAPONS_BY_SLOT.melee) {
      const w = WEAPONS[id]
      ok(w.maxTargets >= 1, `${id} 에 벨 수 있는 수의 상한이 있다`)
      ok(w.maxTargets <= 5, `${id} 상한이 너무 크지 않다 — ${w.maxTargets}`)

      /* 한 대상만 놓고 보면 권총보다도 약해야 한다.

         기준을 최고 총(미니건 303)으로 잡으면 너무 헐거워서, 너프
         전 수치도 통과해 버린다. 근접의 값어치는 화력이 아니라
         "탄약을 안 쓰고 여럿을 동시에 벤다"는 데 있으므로, 단일
         대상에서는 최후의 보루인 권총보다 낮은 게 맞다. */
      const single = (w.damage * w.rpm) / 60
      const pistolDps = gunDps(WEAPONS.pistol)
      ok(single < pistolDps,
        `${id} 단일 DPS(${single.toFixed(0)})가 권총(${pistolDps.toFixed(0)})보다 낮다`)

      /* 상한까지 꽉 채워 베어도 최고 총을 못 넘어야 한다. 이게
         근접이 "몰릴수록 유리하되 총을 대체하지는 않는" 선이다. */
      let mult = 0
      for (let i = 0; i < w.maxTargets; i++) mult += Math.pow(weaponsM.CLEAVE_FALLOFF, i)
      ok(single * mult < bestGun,
        `${id} 최대 상황 DPS(${(single * mult).toFixed(0)})가 최고 총을 안 넘는다`)
    }
    ok(weaponsM.CLEAVE_FALLOFF > 0 && weaponsM.CLEAVE_FALLOFF < 1,
      '두 번째 이후 대상은 덜 아프다')
  }

  // 도끼 — 나이프보다 느리고 무겁고 넓다
  const A = WEAPONS.axe
  ok(A.melee && A.noAmmo, '도끼도 근접이고 탄약이 없다')
  ok(A.damage > K.damage, '도끼가 더 세다')
  ok(A.rpm < K.rpm, '도끼가 더 느리다')
  ok(A.arc > K.arc && A.range > K.range, '도끼가 더 넓고 길게 닿는다')
  ok(K.damage * 2 < enemiesM.ENEMY_TYPES.brute.hp, '나이프로는 브루트를 두 방에 못 잡는다')
  /* 브루트를 두 방에 눕히는 것은 가장 느린 망치의 몫이다 */
  ok(WEAPONS.hammer.damage * 2 >= enemiesM.ENEMY_TYPES.brute.hp, '망치 두 방이면 브루트가 눕는다')
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
  /* 탄창 수치가 어떻든 근접무기는 재장전하지 않는다. 지금은 mag 가
     0 이라 저절로 0 이 나오지만, 그건 우연이지 규칙이 아니다 —
     규칙 쪽을 직접 시험해야 나중에 수치를 바꿔도 안 깨진다. */
  eq(reloadAmount({ noAmmo: true, mag: 30 }, { inMag: 0, reserve: 999 }), 0,
    '탄창이 있어도 근접무기는 재장전하지 않는다')

  const a = initialAmmo()
  /* 기본 구성으로 만들면 그 셋만 소지한다 */
  const owned0 = WEAPON_ORDER.filter((id) => a[id].owned)
  eq(owned0.length, 3, '고른 셋만 가진다')
  for (const slot of SLOTS) ok(a[DEFAULT_LOADOUT[slot]].owned, `${slot} 은 소지`)
  eq(a.pistol.reserve, Infinity, '권총 무한')
  /* 안 고른 것은 예비탄도 0 이라, 주워도 바로 쏠 수 없다 */
  for (const id of WEAPON_ORDER) {
    if (a[id].owned) continue
    eq(a[id].reserve, 0, `${id} 는 안 골랐으니 예비탄 0`)
  }

  /* 슬롯 셋이 로비에서 고른 것으로 채워진다. 빈 자리가 없어야
     한다 — 안 고른 자리가 있으면 그 숫자키가 먹통이 된다. */
  const sl = initialSlots()
  for (const slot of SLOTS) {
    ok(sl[slot], `${slot} 자리가 채워져 있다`)
    eq(WEAPONS[sl[slot]].slot, slot, `${slot} 자리에 그 슬롯 무기가 들어간다`)
  }
  /* 고른 것을 그대로 쓴다 */
  const custom = initialSlots({ primary: 'minigun', secondary: 'magnum', melee: 'hammer' })
  eq(custom.primary, 'minigun', '고른 주무기가 들어간다')
  eq(custom.secondary, 'magnum', '고른 보조무기가 들어간다')
  eq(custom.melee, 'hammer', '고른 근접무기가 들어간다')
  /* 엉뚱한 자리에 넣으면 기본값으로 돌린다 */
  const bad = initialSlots({ primary: 'knife', secondary: 'zzz', melee: 'sniper' })
  for (const slot of SLOTS) {
    eq(WEAPONS[bad[slot]].slot, slot, `${slot} 에 잘못 넣어도 그 슬롯 무기로 고쳐진다`)
  }
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
  /* ★ 높은 곳에 선 적은 그 높이에서 맞아야 한다.

     히트박스를 바닥(0)에 고정해 두면, 통로 위의 적은 눈에 보이는
     몸을 정확히 쏴도 안 맞고, 대신 아무것도 없는 발밑 허공을 쏘면
     맞는다. 높이가 생긴 뒤로 가장 티 안 나게 어긋나기 쉬운 곳이다. */
  {
    const e = makeEnemy('trooper', 0, -8)
    e.state = 'chasing'
    e.y = 2
    const t = enemiesM.ENEMY_TYPES.trooper
    // 올라간 몸통 한가운데를 겨눈다
    const bodyY = e.y + t.height * 0.4
    const hit = raycast({ x: 0, y: bodyY, z: 0 }, { x: 0, y: 0, z: -1 }, [e], [], 80)
    ok(hit && hit.kind === 'enemy', `높이 ${e.y} 에 선 적의 몸통이 맞는다`)
    // 예전 자리(바닥)를 쏘면 이제 아무것도 없어야 한다
    const ghost = raycast({ x: 0, y: 0.6, z: 0 }, { x: 0, y: 0, z: -1 }, [e], [], 80)
    ok(!ghost, '적이 떠난 바닥 높이에는 아무것도 없다')
    // 머리도 같이 올라간다
    const headY = e.y + t.height * 0.9
    const hs = raycast({ x: 0, y: headY, z: 0 }, { x: 0, y: 0, z: -1 }, [e], [], 80)
    ok(hs && hs.isHeadshot, '올라간 적의 머리도 그 높이에 있다')
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
    /* ★ 여러 대상을 벨 때는 가까운 순으로, 뒤로 갈수록 약하게.

       순서가 없으면 배열 순서(스폰 순서)대로 잘려서, 코앞의 적을
       두고 멀리 있는 적을 벤다. 감쇠가 없으면 상한 안에서는 전부
       온전한 피해를 받아 여전히 무리 학살이 된다. */
    {
      const H = WEAPONS.hammer
      const near1 = put('crawler', 0, -1.0)
      const mid = put('crawler', 0.4, -1.8)
      const far1 = put('crawler', -0.4, -2.6)
      const order = [far1, mid, near1]      // 일부러 거꾸로 넣는다
      const r = meleeSwing(H, eye, fwd, order, [])
      eq(r.damages.length, Math.min(3, H.maxTargets), '상한 안에서 셋을 벤다')

      const byId = new Map(r.damages.map((d) => [d.enemy.id, d.damage]))
      const d0 = byId.get(near1.id)
      const d1 = byId.get(mid.id)
      const d2 = byId.get(far1.id)
      ok(d0 > d1 && d1 > d2,
        `가까운 쪽이 더 아프다 — ${d0?.toFixed(0)} > ${d1?.toFixed(0)} > ${d2?.toFixed(0)}`)
      near(d0, H.damage, 1e-9, '맨 앞은 온전한 피해')
      near(d1 / d0, weaponsM.CLEAVE_FALLOFF, 1e-6, '감쇠 비율이 규격대로')
    }

    /* 상한을 넘겨 몰려 있어도 정해진 수만 벤다 */
    {
      const K2 = WEAPONS.knife
      const many = Array.from({ length: 6 }, (_, i) => put('crawler', -0.6 + i * 0.24, -1.2))
      const r = meleeSwing(K2, eye, fwd, many, [])
      eq(r.damages.length, K2.maxTargets,
        `여섯이 몰려도 ${K2.maxTargets} 만 벤다`)
    }

    // 여럿을 한 번에 — 탄약을 안 쓰는 대신 몰려 있을 때 값을 한다
    {
      const a = put('crawler', -0.6, -1.4)
      const b = put('crawler', 0, -1.5)
      const c = put('crawler', 0.6, -1.4)
      eq(meleeSwing(K, eye, fwd, [a, b, c], []).damages.length, K.maxTargets,
        `한 번에 ${K.maxTargets} 까지만 벤다 — 셋이 있어도`)
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

  /* ★ 원거리 적의 사거리는 아레나보다 한참 짧아야 한다.

     맵을 거의 덮는 사거리면 어디로 물러나도 누군가의 사거리 안이라,
     엄폐물을 쓰는 게임이 아니라 맞으면서 버티는 게임이 된다. 물러나서
     벗어날 수 있어야 "지금 물러날까"가 판단이 된다. */
  {
    const span = arenaM.ARENA.half * 2
    const t = ENEMY_TYPES.trooper
    ok(t.attackRange < span * 0.55,
      `트루퍼 사거리(${t.attackRange})가 아레나(${span})의 절반을 넘지 않는다`)
    ok(t.attackRange > 6, '그래도 원거리 적이라 부를 만큼은 된다')
    ok(t.preferredRange < t.attackRange, '선호 거리는 사거리 안쪽')
    /* 근접 적의 사거리는 몸에서 뻗는 길이로 봐야 공평하다 */
    for (const id of ['crawler', 'brute']) {
      const e = ENEMY_TYPES[id]
      ok(e.attackRange - e.radius < 2.2,
        `${id} 가 몸에서 뻗는 거리가 짧다 — ${(e.attackRange - e.radius).toFixed(2)}`)
    }
  }
  ok(ENEMY_TYPES.brute.hp > ENEMY_TYPES.trooper.hp, '브루트가 더 단단')
  ok(ENEMY_TYPES.brute.score > ENEMY_TYPES.crawler.score, '센 놈이 점수 높음')

  const boxes = BUNKER.boxes
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
    for (const sp of BUNKER.spawns) {
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
    const wall = BUNKER.coverBoxes.find((b) => b.cx === 0 && b.cz === 6)
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
    for (const b of BUNKER.coverBoxes) {
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

  /* ── 높은 자리는 유리하되 안전하지는 않다 ────────────────────
     통로에 올라간 것이 이득이어야 만든 보람이 있고, 동시에 적이
     끝내 못 오는 자리면 그 판은 거기서 끝난다. 둘 다 확인한다. */
  {
    const { CATWALK_H } = arenaM
    /* 동쪽 통로 한가운데에 선 플레이어 */
    const onCatwalk = { x: 13, y: CATWALK_H, z: 0, eyeY: CATWALK_H + 1.62 }

    /* ★ 높이 차이만으로 사거리 밖이 되는지 — 딱 그 경계에서 본다.

       아레나 배치에 기대면 우연히 멀어서 통과할 수 있다. 수평으로는
       충분히 가깝고 높이로만 벗어나는 상황을 직접 만들어 확인한다. */
    {
      const slab = [{
        minX: 0, maxX: 4, minY: 0, maxY: 2,
        minZ: -2, maxZ: 2, cx: 2, cz: 0, w: 4, d: 4, h: 2,
      }]
      const above = { x: 0.5, y: 2, z: 0, eyeY: 3.62 }   // 단 위, 가장자리 근처
      let e = makeEnemy('crawler', -1.1, 0)               // 단 아래 바닥, 코앞
      e.state = 'chasing'; e.stateT = 1
      let hits = 0
      for (let i = 0; i < 240; i++) {
        /* 자리를 고정한다. 걷게 두면 배치가 흐트러져서 "수평으로는
           가까운데 높이로 벗어난다"는 상황 자체가 사라진다. */
        e.x = -1.1; e.z = 0; e.y = 0
        const r = tickEnemy(e, { player: above, boxes: slab, rng: rngM.makeRng('h') }, 1 / 60)
        e = r.enemy
        hits += r.events.filter((v) => v.type === 'melee').length
      }
      e.x = -1.1; e.z = 0; e.y = 0
      const flat = Math.hypot(above.x - e.x, above.z - e.z)
      ok(flat < ENEMY_TYPES.crawler.attackRange,
        `수평으로는 사거리 안이다 — ${flat.toFixed(2)} < ${ENEMY_TYPES.crawler.attackRange}`)
      eq(hits, 0, '수평으로 가까워도 높이가 다르면 못 때린다')
      eq(e.y, 0, '아래 적은 아래에 있다')
    }

    /* ★ 바닥에 선 적은 통로 위의 플레이어를 못 때린다.

       출발 자리는 반드시 진짜 바닥이어야 한다. 계단 한가운데에
       "y=0 인 채로" 놓으면 지형 속에 파묻힌 상태라, 밀어내기가
       엉뚱한 곳으로 밀어내며 있을 수 없는 자리에서 때리게 된다.
       그건 게임의 결함이 아니라 시험이 만들어 낸 상황이다. */
    for (const type of ['crawler', 'brute']) {
      for (const [sx, sz] of [[13, 5.6], [13, -5.6], [7.5, 0]]) {
        let e = makeEnemy(type, sx, sz)
        e.state = 'chasing'; e.stateT = 1
        let hits = 0
        for (let i = 0; i < 420; i++) {
          const r = tickEnemy(e, { player: onCatwalk, boxes, rng: rngM.makeRng('v') }, 1 / 60)
          e = r.enemy
          /* 계단을 밟고 올라와 때리는 건 괜찮다 — 거리를 좁힌 것이다.
             막으려는 건 "바닥에 선 채로" 2미터 위를 때리는 것이다. */
          if (e.y < 0.5) hits += r.events.filter((v) => v.type === 'melee').length
        }
        eq(hits, 0, `${type} 가 (${sx},${sz}) 바닥에서 통로 위를 때리지 못한다`)
      }
    }

    /* ★ 그래도 적은 계단으로 올라온다 — 안전지대가 아니다 */
    {
      let e = makeEnemy('crawler', 7.5, 0)
      e.state = 'chasing'; e.stateT = 1
      let reached = false
      for (let i = 0; i < 900 && !reached; i++) {
        e = tickEnemy(e, { player: onCatwalk, boxes, rng: rngM.makeRng('u') }, 1 / 60).enemy
        if (e.y >= CATWALK_H - 1e-6) reached = true
      }
      ok(reached, `크롤러가 계단을 타고 통로까지 올라온다 — y=${e.y.toFixed(2)}`)
    }

    /* 적도 통로 밖으로 나가면 내려온다 — 공중에 서 있지 않는다 */
    {
      let e = makeEnemy('crawler', 13, 0)
      e.y = CATWALK_H
      e.state = 'chasing'; e.stateT = 1
      const ground = { x: 0, y: 0, z: 0, eyeY: 1.62 }
      for (let i = 0; i < 600; i++) {
        e = tickEnemy(e, { player: ground, boxes, rng: rngM.makeRng('d') }, 1 / 60).enemy
      }
      ok(e.y < CATWALK_H, `통로를 벗어난 적은 내려온다 — y=${e.y.toFixed(2)}`)
    }

    /* 적의 발밑 높이는 언제나 밟을 수 있는 곳이다 */
    {
      const rng = rngM.makeRng('ey')
      let e = makeEnemy('trooper', 13.5, 8)
      e.state = 'chasing'; e.stateT = 1
      for (let i = 0; i < 1200; i++) {
        e = tickEnemy(e, { player: { x: 0, y: 0, z: 0, eyeY: 1.62 }, boxes, rng }, 1 / 60).enemy
        ok(e.y >= -1e-6 && e.y <= arenaM.CATWALK_H + 1e-6, `적 높이가 범위 안 — ${e.y}`)
        ok(Number.isFinite(e.y), '적 높이가 유한')
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

// ══════════════════════════════════════════════════════ 길찾기 격자
section('길찾기 격자 — 높이로 읽는 지도')
{
  const nav = await load('navgrid.js')
  const { buildNav, navField, navDistance, navDir, navCol, navCenter, NAV_CELL, NAV_N } = nav
  const { toBox } = arenaM

  /* 검사용 맵 한 장을 손으로 짓는다. 담장은 없다 — 격자가 지형을
     어떻게 읽는지만 보려는 것이라, 바깥이 트여 있어도 상관없다. */
  const mk = (cover, stairs = []) => {
    const coverBoxes = cover.map(toBox)
    const stairBoxes = stairs.map(toBox)
    return { boxes: [...coverBoxes, ...stairBoxes], coverBoxes, stairBoxes }
  }

  eq(NAV_N * NAV_CELL, 30, '격자가 아레나를 덮는다')
  ok(NAV_CELL < collideM.STEP_HEIGHT / 0.4 * 0.6,
    `칸이 계단 한 단보다 촘촘하다 — ${NAV_CELL}`)

  /* ── 높이를 읽는다 ─────────────────────────────────────────── */
  {
    const wall = mk([{ x: 0, z: 0, w: 4, d: 4, h: 3.8 }])
    const g = buildNav(wall, 0.4)
    const at = (x, z) => navCol(z) * NAV_N + navCol(x)
    eq(g.stand[at(0, 0)], 0, '벽 한가운데에는 설 수 없다')
    eq(g.height[at(0, 0)], 3.8, '벽 높이를 그대로 적는다')
    eq(g.stand[at(10, 10)], 1, '빈 데는 설 수 있다')
    eq(g.height[at(10, 10)], 0, '빈 데는 높이 0')

    /* 몸이 굵을수록 벽이 두꺼워 보여야 한다 — 벽에 몸이 걸치는
       자리는 실제로 물리가 밀어내므로 길로 세면 안 된다. */
    const thin = buildNav(wall, 0.2)
    const fat = buildNav(wall, 1.2)
    let thinOpen = 0
    let fatOpen = 0
    for (let i = 0; i < NAV_N * NAV_N; i++) { thinOpen += thin.stand[i]; fatOpen += fat.stand[i] }
    ok(fatOpen < thinOpen, `굵으면 갈 수 있는 칸이 줄어든다 — ${fatOpen} < ${thinOpen}`)
  }

  /* ── 통로는 계단 없이는 못 오른다 ─────────────────────────── */
  {
    const walkOnly = mk([{ x: 0, z: 0, w: 8, d: 8, h: arenaM.CATWALK_H }])
    const g = buildNav(walkOnly, 0.4)
    const f = navField(g, 12, 12)                     // 바닥에서 퍼뜨린다
    ok(!Number.isFinite(navDistance(f, 0, 0)),
      '계단이 없으면 통로 위는 못 간다')
    eq(g.stand[navCol(0) * NAV_N + navCol(0)], 1, '통로 위 자체는 설 수 있는 곳이다')

    /* 계단을 붙이면 이어진다. 이게 붙지 않으면 통로가 있는 맵이
       통째로 막힌다 — 한때 한 걸음보다 낮은 상자를 빼먹어서
       첫 단(0.4)이 사라지는 바람에 실제로 그렇게 됐다. */
    const withStair = mk(
      [{ x: 0, z: 0, w: 8, d: 8, h: arenaM.CATWALK_H }],
      [0, 1, 2, 3].map((i) => ({
        x: 4 + 0.3 + i * 0.6, z: 0, w: 0.6, d: 8,
        h: arenaM.STEP_RISE * (4 - i),
      })),
    )
    const g2 = buildNav(withStair, 0.4)
    const f2 = navField(g2, 12, 0)
    ok(Number.isFinite(navDistance(f2, 0, 0)), '계단을 놓으면 통로 위로 갈 수 있다')
  }

  /* ── 꼭짓점만 맞댄 두 상자 사이로는 못 지난다 ─────────────── */
  {
    const corner = mk([
      { x: -2, z: -2, w: 4, d: 4, h: 3.8 },
      { x: 2, z: 2, w: 4, d: 4, h: 3.8 },
    ])
    const g = buildNav(corner, 0.4)
    const f = navField(g, -6, 6)                      // 왼쪽 아래 구석
    /* 대각선으로 빠져나가는 지름길이 있으면 반대쪽 구석까지 짧게
       닿는다. 격자에서는 틈처럼 보이지만 실제로는 못 지나는 자리다. */
    const straight = Math.hypot(6 - -6, -6 - 6)
    const d = navDistance(f, 6, -6)
    ok(!Number.isFinite(d) || d > straight * 1.3,
      `꼭짓점 사이를 대각선으로 통과하지 않는다 — ${d.toFixed(1)} vs ${straight.toFixed(1)}`)
  }

  /* ── 거리밭이 성립하는가 ──────────────────────────────────── */
  {
    const open = mk([])
    const g = buildNav(open, 0.4)
    const f = navField(g, 0, 0)
    eq(navDistance(f, 0, 0), 0, '목표 자리는 거리 0')

    /* 격자 거리가 직선 거리보다 짧으면 안 된다. 대각선 비용을 1로
       세면 30% 짧게 나오는데, 그러면 "돌아가는 길인가"를 잴 때
       거리를 못 믿는다. */
    let worst = 0
    for (let i = 0; i < 2000; i++) {
      const x = (rngM.makeRng(`x${i}`)() - 0.5) * 28
      const z = (rngM.makeRng(`z${i}`)() - 0.5) * 28
      const straight = Math.hypot(x, z)
      const d = navDistance(f, x, z)
      ok(d >= straight - NAV_CELL * 1.5,
        `격자 거리가 직선보다 짧지 않다 — ${d.toFixed(2)} vs ${straight.toFixed(2)}`)
      worst = Math.max(worst, d - straight)
    }
    ok(worst < 2.5, `트인 데서는 격자 거리가 직선에 가깝다 — 최대 +${worst.toFixed(2)}`)
  }

  /* ── 방향 ─────────────────────────────────────────────────── */
  {
    const open = mk([])
    const g = buildNav(open, 0.4)
    const f = navField(g, 0, 0)
    /* 트인 데서는 곧장 목표를 향해야 한다. 여기서 격자 모양으로
       각지면 아레나에서의 움직임과 그에 맞춰 잰 난이도가 흔들린다. */
    for (let i = 0; i < 400; i++) {
      const a = (i / 400) * Math.PI * 2
      const x = Math.cos(a) * 9
      const z = Math.sin(a) * 9
      const d = navDir(g, f, x, z, 0, 0, 0)
      ok(d !== null, '트인 데서는 방향이 나온다')
      const want = Math.atan2(-z, -x)
      const got = Math.atan2(d.z, d.x)
      let off = Math.abs(want - got)
      if (off > Math.PI) off = Math.PI * 2 - off
      ok(off < 0.45, `트인 데서는 목표를 곧장 가리킨다 — ${(off * 57.3).toFixed(0)}도`)
    }

    /* 벽 너머는 우회해야 한다. 벽을 향해 곧장 가리키면 안 된다. */
    const split = mk([{ x: 0, z: 0, w: 1.5, d: 20, h: 3.8 }])
    const g2 = buildNav(split, 0.4)
    const f2 = navField(g2, -6, 0)
    const d2 = navDir(g2, f2, 6, 0, -6, 0, 0)
    ok(d2 !== null && Math.abs(d2.z) > 0.3,
      `벽이 가로막으면 옆으로 돌아간다 — ${d2 ? d2.z.toFixed(2) : 'null'}`)
  }

  /* ── 갇힌 곳은 갇혔다고 말한다 ────────────────────────────── */
  {
    const sealed = mk([
      { x: 0, z: -3, w: 6, d: 1.5, h: 3.8 },
      { x: 0, z: 3, w: 6, d: 1.5, h: 3.8 },
      { x: -3, z: 0, w: 1.5, d: 6, h: 3.8 },
      { x: 3, z: 0, w: 1.5, d: 6, h: 3.8 },
    ])
    const g = buildNav(sealed, 0.4)
    const f = navField(g, 0, 0)                        // 상자 안에서 시작
    ok(!Number.isFinite(navDistance(f, 12, 12)),
      '완전히 닫힌 방 안에서는 밖으로 못 나간다')
  }

  /* ── 같은 입력이면 같은 답 ────────────────────────────────── */
  {
    const m = mapsM.getMap('labyrinth')
    const a = buildNav(m, 0.45)
    const b = buildNav(m, 0.45)
    let same = true
    for (let i = 0; i < NAV_N * NAV_N; i++) {
      if (a.stand[i] !== b.stand[i] || a.height[i] !== b.height[i]) same = false
    }
    ok(same, '같은 맵이면 같은 격자')
    const fa = navField(a, 3, -2)
    const fb = navField(b, 3, -2)
    let sameF = true
    for (let i = 0; i < NAV_N * NAV_N; i++) if (fa[i] !== fb[i]) sameF = false
    ok(sameF, '같은 격자면 같은 거리밭')
  }

  /* ── 마흔 장이 전부 성립하는가 ────────────────────────────── */
  {
    const { MAPS } = mapsM
    const { ENEMY_TYPES } = enemiesM
    const radii = [...new Set(Object.values(ENEMY_TYPES).map((t) => t.radius))]
    for (const m of MAPS) {
      for (const radius of radii) {
        const g = buildNav(m, radius)
        const f = navField(g, m.playerStart.x, m.playerStart.z)

        /* 이게 이 절의 핵심이다. 스폰에서 플레이어까지 길이 없으면
           그 판은 게임이 아니라 기다리기가 된다. 걸려 보는 검사와
           달리 이건 답이 정해져 있어서, 실패했을 때 "AI 가 못 찾은
           것"과 "길이 아예 없는 것"을 갈라 준다. */
        for (const sp of m.spawns) {
          ok(Number.isFinite(navDistance(f, sp.x, sp.z)),
            `${m.name}: 반지름 ${radius} 가 (${sp.x},${sp.z}) 에서 갈 길이 있다`)
        }
      }

      /* 시작 자리와 보급품은 플레이어 몸으로 잰다. 적의 굵기로 재면
         엉뚱한 것을 묻게 된다 — 브루트가 못 비집는 구석이라도 사람은
         지나갈 수 있고, 보급품은 사람이 줍는 것이다. */
      const gp = buildNav(m, playerM.PLAYER.radius)
      const fp = navField(gp, m.playerStart.x, m.playerStart.z)
      ok(gp.stand[navCol(m.playerStart.z) * NAV_N + navCol(m.playerStart.x)] === 1,
        `${m.name}: 시작 자리에 설 수 있다`)
      for (const pu of m.pickups) {
        ok(Number.isFinite(navDistance(fp, pu.x, pu.z)),
          `${m.name}: 보급품 (${pu.x},${pu.z}) 을 주우러 갈 수 있다`)
      }
    }
  }

  /* ── 알려 준 방향으로 실제로 걸어갈 수 있는가 ─────────────── */
  {
    /* 이게 이 모듈에서 가장 미끄러운 부분이다.

       지름길은 "기준 칸"에서 재는데 실제로 걷는 것은 적이 선 자리에서다.
       둘이 어긋나면 기준 칸에서는 뚫려 있는 선이 적에게는 벽을 가로지르는
       선이 된다. 그러면 길찾기는 멀쩡한 답을 내놓는데 적은 벽만 민다 —
       계단 위쪽 모서리에 몸을 붙인 적이 딱 그렇게 갇혔다.

       그래서 자리를 잔뜩 흩뿌려 놓고, 알려 준 방향으로 한 걸음
       내디뎌 본다. 벽에 막혀 못 가면 그 방향은 틀린 것이다. */
    const { resolveMove, groundHeightAt } = collideM
    const radius = enemiesM.ENEMY_TYPES.crawler.radius
    const step = 0.25
    let checked = 0
    let stuck = 0
    for (const id of ['bastion', 'tower', 'terrace', 'bridge', 'labyrinth', 'spiral', 'cloister']) {
      const m = mapsM.getMap(id)
      const g = buildNav(m, radius)
      const f = navField(g, m.playerStart.x, m.playerStart.z)
      const rng = rngM.makeRng('walk-' + id)
      for (let i = 0; i < 900; i++) {
        const x = (rng() - 0.5) * 28
        const z = (rng() - 0.5) * 28
        /* 실제로 설 수 있는 자리만 본다. 지형 속에 파묻힌 자리는
           길찾기가 답할 의무가 없다. */
        const feetY = groundHeightAt(x, z, radius, m.boxes, 0)
        const vert = { feetY, headY: feetY + 1.1 }
        const free = resolveMove(x, z, 0, 0, radius, m.boxes, 8, vert)
        if (Math.hypot(free.x - x, free.z - z) > 1e-6) continue

        const d = navDir(g, f, x, z, m.playerStart.x, m.playerStart.z, feetY)
        if (!d) continue
        checked++

        const moved = resolveMove(x, z, d.x * step, d.z * step, radius, m.boxes, 8, vert)
        const gained = (moved.x - x) * d.x + (moved.z - z) * d.z
        if (gained < step * 0.5) stuck++
      }
    }
    ok(checked > 3000, `걸어 볼 자리가 넉넉하다 — ${checked}`)
    /* 완벽할 수는 없다 — 격자는 반 미터 단위라 모서리에서는 한두
       프레임 스칠 수 있고, 그건 우회 로직이 받아 준다. 다만 드물어야
       한다. 흔해지면 적이 벽을 미는 판이 나온다. */
    ok(stuck / checked < 0.02,
      `알려 준 방향으로 실제로 갈 수 있다 — 막힌 비율 ${(stuck / checked * 100).toFixed(2)}%`)
  }

  void navCenter
}

// ══════════════════════════════════════════════════════ 맵별 길찾기
section('모든 맵에서 적이 플레이어에게 닿는가')
{
  const { MAPS } = mapsM
  const { makeEnemy, tickEnemy, ENEMY_TYPES } = enemiesM
  const { surfaceHeightAt } = collideM
  const { PLAYER } = playerM

  /* ★ 이게 맵을 마흔 장으로 늘리면서 가장 깨지기 쉬운 부분이다.

     배치 규칙(틈·높이)을 다 지켜도 길이 막힐 수 있다. 벽 하나가
     어긋나 통로가 끊기면 적이 영영 못 오고, 그 판은 게임이 아니라
     기다리기가 된다. 화면을 안 띄우고 확인할 수 있는 유일한 방법은
     실제로 걸려 보게 하는 것이다.

     "목적을 이뤘는가"는 종류마다 다르다. 근접 적은 사거리 안에
     들어와야 하고, 원거리 적은 사거리(14)가 아레나 어디서든 닿기
     때문에 대신 "플레이어가 보이는 자리를 잡았는가"로 본다. */
  /* 세션이 적에게 주는 것과 똑같은 길찾기를 붙인다. 이걸 빼고 재면
     실제로 굴러가는 것과 다른 코드를 시험하게 된다. */
  const navM = await load('navgrid.js')

  for (const map of MAPS) {
    const boxes = map.boxes
    const start = map.playerStart
    /* 세션이 하는 것과 똑같이, 시작 자리의 바닥 위에 세운다 —
       탑 맵은 가운데가 단이라 플레이어가 2미터 위에서 시작한다. */
    const startY = surfaceHeightAt(start.x, start.z, PLAYER.radius, boxes)
    const player = {
      x: start.x, y: startY, z: start.z, eyeY: startY + 1.62,
    }
    const reached = (e) => {
      const t = ENEMY_TYPES[e.type]
      if (t.ranged) {
        return collideM.hasLineOfSight(
          e.x, (e.y || 0) + t.height * 0.5, e.z, start.x, startY + 1.62, start.z, boxes,
        )
      }
      /* 게임과 같은 방식으로 높이까지 넣어 잰다 */
      return Math.hypot(e.x - start.x, e.z - start.z, (e.y || 0) - startY) <= t.attackRange
    }

    /* 걸려 보기 전에 격자로 먼저 본다. 이건 근사가 아니라 답이 정해진
       검사다 — 길이 아예 없으면 몇 프레임을 주든 못 온다. 실패했을 때
       "AI 가 못 찾은 것"과 "길이 없는 것"을 갈라 준다. */
    const navByRadius = new Map()
    for (const type of ['crawler', 'trooper', 'brute']) {
      const t = ENEMY_TYPES[type]
      if (navByRadius.has(t.radius)) continue
      const grid = navM.buildNav(map, t.radius)
      navByRadius.set(t.radius, { grid, field: navM.navField(grid, start.x, start.z) })
    }
    for (const sp of map.spawns) {
      for (const [radius, n] of navByRadius) {
        ok(Number.isFinite(navM.navDistance(n.field, sp.x, sp.z)),
          `${map.name}: 반지름 ${radius} 가 (${sp.x},${sp.z}) 에서 갈 길이 아예 없다`)
      }
    }

    const navDir = (x, z, radius, feetY) => {
      const n = navByRadius.get(radius)
      return n ? navM.navDir(n.grid, n.field, x, z, start.x, start.z, feetY) : null
    }

    for (const sp of map.spawns) {
      for (const type of ['crawler', 'trooper', 'brute']) {
        const t = ENEMY_TYPES[type]
        let e = makeEnemy(type, sp.x, sp.z)
        /* 세션이 하는 것과 똑같이, 그 자리의 바닥 위에 세운다 */
        e.y = surfaceHeightAt(sp.x, sp.z, t.radius, boxes)
        e.state = 'chasing'
        e.stateT = 1

        const d0 = Math.hypot(sp.x - start.x, sp.z - start.z)
        /* 곧장 갔을 때의 4배 안에 와야 한다. 에둘러 가는 건 괜찮지만
           벽을 기어다니는 건 안 된다. 맵에 따라 크게 돌아야 하므로
           단일 맵 때(2.5배)보다는 넉넉히 준다. */
        const budget = Math.ceil((d0 / t.speed) * 4 * 60) + 180
        let done = false
        for (let i = 0; i < budget && !done; i++) {
          e = tickEnemy(e, { player, boxes, rng: rngM.makeRng('r'), navDir }, 1 / 60).enemy
          done = reached(e)
        }
        ok(done,
          `${map.name}: ${type} 가 (${sp.x},${sp.z}) 에서 ${budget}프레임 안에 도달 — 지금 (${e.x.toFixed(1)},${e.z.toFixed(1)}) 거리 ${Math.hypot(e.x - start.x, e.z - start.z).toFixed(1)}`)
        ok(Number.isFinite(e.x) && Number.isFinite(e.z) && Number.isFinite(e.y),
          `${map.name}: ${type} 좌표가 유한`)
      }
    }
  }
}

// ══════════════════════════════════════════════════════ waves
section('waves — 난이도 곡선')
{
  const { waveComposition, waveTotal, waveScaling, spawnSchedule, pickupsForWave,
          MAX_CRAWLERS, MAX_TROOPERS, MAX_BRUTES, WAVE_BREAK } = waveM

  /* 첫 웨이브는 조작을 익히는 시간이다. 종류도 하나여야 한다. */
  ok(waveComposition(1).crawler > 0 && waveComposition(1).crawler <= 6,
    `1웨이브는 크롤러 소수 — ${waveComposition(1).crawler}마리`)
  eq(waveComposition(1).trooper, 0, '1웨이브 트루퍼 없음')
  eq(waveComposition(1).brute, 0, '1웨이브 브루트 없음')
  eq(waveComposition(2).trooper, 0, '2웨이브도 크롤러만 — 익힐 틈을 준다')
  ok(waveComposition(3).trooper > 0, '3웨이브부터 트루퍼')
  eq(waveComposition(3).brute, 0, '3웨이브 브루트 아직')
  ok(waveComposition(4).brute > 0, '4웨이브부터 브루트')
  /* 새 종류는 한 번에 하나씩 — 두 종류가 같은 웨이브에 처음 나오면
     무엇에 당했는지 모른 채 죽는다 */
  ok(waveTotal(1) <= 6, '1웨이브가 감당할 만하다')
  ok(waveTotal(3) <= 12, `3웨이브가 감당할 만하다 — ${waveTotal(3)}마리`)

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
    const sched = spawnSchedule(n, rng, BUNKER.spawns)
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
      eq(s.point, BUNKER.spawns[s.spawnIndex], '지점과 인덱스 일치')
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
    const a = JSON.stringify(spawnSchedule(7, rngM.makeRng('same'), BUNKER.spawns))
    const b = JSON.stringify(spawnSchedule(7, rngM.makeRng('same'), BUNKER.spawns))
    eq(a, b, '같은 씨앗이면 같은 일정')
  }
  // 웨이브 길이가 무한정 늘지 않는다
  {
    const dur = (n) => { const s = spawnSchedule(n, rngM.makeRng('d'), BUNKER.spawns); return s[s.length - 1].at }
    ok(dur(30) < 40, `30웨이브 스폰 시간이 40초 미만 — ${dur(30).toFixed(1)}s`)
  }
  ok(WAVE_BREAK > 0, '웨이브 사이 휴식 있음')

  // 픽업
  eq(pickupsForWave(1).length, 0, '1웨이브는 보급 없음')
  {
    let ammoWaves = 0
    for (let n = 1; n <= 30; n++) if (pickupsForWave(n).some((p) => p.kind === 'ammo')) ammoWaves++
    ok(ammoWaves >= 10, `탄약 보급이 꾸준히 나옴 — 30웨이브 중 ${ammoWaves}회`)
  }
  {
    /* ★ 웨이브 보급에는 무기가 없어야 한다.

       무기는 로비에서 고른다. 웨이브 도중에 다른 총이 굴러다니면
       "고른다"는 행위가 두 군데로 쪼개져서 로비의 선택이 가벼워진다.
       그래서 보급은 탄약과 체력뿐이다. */
    const kinds = new Set()
    for (let n = 1; n <= 200; n++) {
      for (const p of pickupsForWave(n)) kinds.add(p.kind)
    }
    ok(!kinds.has('weapon'), '보급으로 무기가 떨어지지 않는다')
    ok(kinds.has('ammo'), '탄약은 떨어진다')
    ok(kinds.has('health'), '체력도 떨어진다')

    /* 탄약이 꾸준히 나와야 한다. 고른 무기로 끝까지 가야 하니
       탄이 마르는 것이 실력이 아니라 운이 되면 안 된다. */
    let ammoWaves2 = 0
    for (let n = 2; n <= 30; n++) {
      if (pickupsForWave(n).some((p) => p.kind === 'ammo')) ammoWaves2++
    }
    ok(ammoWaves2 >= 25, `2웨이브부터는 거의 매번 탄약이 나온다 — ${ammoWaves2}/29`)
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
  const boxes = BUNKER.boxes
  const NONE = { forward: 0, back: 0, left: 0, right: 0, jump: 0, sprint: 0 }
  const IN = (o) => ({ ...NONE, ...o })

  const p0 = initialPlayer()
  eq(p0.hp, PLAYER.maxHp, '시작 체력 최대')
  eq(p0.weapon, weaponsM.DEFAULT_LOADOUT.primary, '고른 주무기를 들고 시작한다')
  eq(p0.slots.secondary, weaponsM.DEFAULT_LOADOUT.secondary, '보조 자리도 채워져 있다')
  eq(p0.slots.melee, weaponsM.DEFAULT_LOADOUT.melee, '근접 자리도 채워져 있다')
  /* 고른 셋만 가진다 — 나머지는 이 판에 없다 */
  {
    const owned = weaponsM.WEAPON_ORDER.filter((id) => p0.ammo[id].owned)
    eq(owned.length, 3, '가진 무기는 셋뿐')
    for (const id of owned) ok(Object.values(p0.slots).includes(id), `${id} 는 고른 것`)
  }
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
    const lowest = Math.min(...BUNKER.coverBoxes.map((b) => b.maxY))
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
  /* ── 계단을 오르내린다 ──────────────────────────────────────── */
  {
    const { CATWALK_H } = arenaM
    /* 계단 앞(광장 쪽)에 서서 통로 쪽으로 걸어 올라간다.
       계단은 x 8.6→11 에서 오르고 통로는 x 11~15 이다. */
    const walkTo = (startX, startZ, yaw, seconds) => {
      let p = { ...initialPlayer(startX, startZ), yaw }
      const steps = Math.round(seconds * 60)
      for (let i = 0; i < steps; i++) p = movePlayer(p, IN({ forward: 1 }), 1 / 60, boxes)
      return p
    }

    // 동쪽: +x 를 보고 걸어 올라간다 (yaw 는 -sin/-cos 기준이라 +x 는 -π/2)
    {
      const p = walkTo(7.5, 0, -Math.PI / 2, 3)
      near(p.y, CATWALK_H, 1e-6, `계단을 걸어 올라 통로에 선다 — y=${p.y.toFixed(2)}`)
      ok(p.x > 11, `통로 위까지 올라갔다 — x=${p.x.toFixed(1)}`)
      ok(p.onGround, '통로 위에 발이 닿아 있다')
    }
    // 서쪽도 대칭으로 올라간다
    {
      const p = walkTo(-7.5, 0, Math.PI / 2, 3)
      near(p.y, CATWALK_H, 1e-6, `서쪽 계단도 올라간다 — y=${p.y.toFixed(2)}`)
      ok(p.x < -11, `서쪽 통로 위 — x=${p.x.toFixed(1)}`)
    }

    /* ★ 통로 밖으로 걸어 나가면 떨어진다. 안 떨어지면 공중을 걷는다 */
    {
      let p = { ...initialPlayer(13, 0), y: CATWALK_H, yaw: Math.PI / 2 }
      for (let i = 0; i < 180; i++) p = movePlayer(p, IN({ forward: 1 }), 1 / 60, boxes)
      near(p.y, 0, 1e-6, `통로를 벗어나면 바닥으로 떨어진다 — y=${p.y.toFixed(2)}`)
      ok(p.onGround, '떨어진 뒤 착지한다')
    }

    /* ★ 턱을 밟고 올라서는 순간에 점프해도 점프가 죽지 않는다.

       착지 판정에 "내려오는 중일 때만"이라는 조건이 없으면, 발밑이
       올라가는 그 프레임에 곧바로 땅에 붙여 버려서 점프가 시작하자마자
       취소된다. 계단 앞에서 뛰려 할 때마다 안 뛰어지는 증상이 된다. */
    {
      const stepEdge = Math.min(...BUNKER.stairBoxes.map((s) => s.minX).filter((v) => v > 0))
      const p0 = { ...initialPlayer(stepEdge - 0.4, 0), yaw: -Math.PI / 2 }
      const p1 = movePlayer(p0, IN({ forward: 1, jump: 1 }), 1 / 60, boxes)
      ok(p1.vy > 0, `턱에 올라서는 순간의 점프가 살아 있다 — vy=${p1.vy.toFixed(2)}`)
      ok(!p1.onGround, '그 프레임에는 공중이다')
    }

    /* ★ 계단이 아닌 곳에서는 점프해도 통로에 못 올라간다.

       계단 옆(통로 북쪽, z=6)에서 통로를 향해 뛰어 본다. 계단 위에서
       뛰면 당연히 올라가지므로 계단을 피해 서야 시험이 성립한다. */
    {
      let p = { ...initialPlayer(13, 6.5), yaw: 0 }   // -z 를 보고 통로 쪽
      let landedMax = 0
      for (let i = 0; i < 300; i++) {
        p = movePlayer(p, IN({ jump: 1, forward: 1 }), 1 / 60, boxes)
        if (p.onGround) landedMax = Math.max(landedMax, p.y)
      }
      ok(landedMax < CATWALK_H,
        `계단 밖에서는 점프로 통로에 못 올라선다 — 최고 착지 ${landedMax.toFixed(2)}`)
    }

    /* 아무 데서나 마구 뛰어다녀도 통로보다 높은 곳에 서지지 않는다.

       공중에 뜬 높이가 아니라 "발이 닿은 높이"로 재야 한다. 통로
       위에서 뛰면 잠깐은 2.87 까지 오르지만 그건 서 있는 게 아니다.
       엄폐물 위에 올라설 수 있는지가 확인하려는 것이다. */
    {
      const rng = rngM.makeRng('climb')
      let p = initialPlayer()
      let standMax = 0
      for (let i = 0; i < 20000; i++) {
        p = { ...p, yaw: p.yaw + (rng() - 0.5) * 0.7 }
        p = movePlayer(p, IN({
          forward: rng() < 0.7 ? 1 : 0,
          left: rng() < 0.3 ? 1 : 0, right: rng() < 0.3 ? 1 : 0,
          jump: rng() < 0.25 ? 1 : 0, sprint: rng() < 0.4 ? 1 : 0,
        }), 1 / 60, boxes)
        if (p.onGround) standMax = Math.max(standMax, p.y)
        ok(Number.isFinite(p.y), '높이가 유한하다')
      }
      ok(standMax <= CATWALK_H + 1e-6,
        `2만 프레임 마구 뛰어도 통로보다 높은 곳엔 못 선다 — 최고 ${standMax.toFixed(2)}`)
    }
  }

  /* ── 체력 회복 ──────────────────────────────────────────────── */
  {
    let p = { ...initialPlayer(), hp: 40 }
    p = hurtPlayer(p, 0, null, 0).player      // 회복 시계를 0 으로
    p = movePlayer(p, NONE, 1, boxes)
    eq(p.hp, 40, '맞은 직후에는 안 찬다')

    // 대기 시간이 지나면 찬다
    let q = { ...initialPlayer(), hp: 40, sinceHit: 0 }
    for (let i = 0; i < 60 * (PLAYER.regenDelay + 3); i++) {
      q = movePlayer(q, NONE, 1 / 60, boxes)
    }
    ok(q.hp > 40, `한동안 안 맞으면 회복한다 — ${q.hp.toFixed(0)}`)
    ok(q.hp <= PLAYER.maxHp, '최대 체력을 넘지 않는다')

    // 계속 맞으면 안 찬다
    let r2 = { ...initialPlayer(), hp: 40 }
    for (let i = 0; i < 600; i++) {
      r2 = movePlayer(r2, NONE, 1 / 60, boxes)
      if (i % 10 === 0) r2 = { ...r2, sinceHit: 0 }   // 계속 맞는 중
    }
    ok(r2.hp <= 41, `교전 중에는 회복이 안 된다 — ${r2.hp.toFixed(0)}`)

    // 죽은 뒤에는 되살아나지 않는다
    let d = { ...initialPlayer(), hp: 0, sinceHit: 0 }
    for (let i = 0; i < 60 * (PLAYER.regenDelay + 5); i++) {
      d = movePlayer(d, NONE, 1 / 60, boxes)
    }
    eq(d.hp, 0, '죽은 뒤에는 회복하지 않는다')
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
    /* 권총 수치를 보려면 보조무기를 꺼내야 한다. 시작 무기는
       로비에서 고른 주무기다. */
    let p = playerM.switchSlot(initialPlayer(), 'secondary')
    p = { ...p, cooldown: 0 }
    eq(p.weapon, 'pistol', '보조무기는 권총')
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
    let p = playerM.switchSlot(initialPlayer(), 'secondary')
    p = { ...p, cooldown: 0 }
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
    let p = playerM.switchSlot(initialPlayer(), 'secondary')
    p = { ...p, cooldown: 0, ammo: { ...p.ammo, pistol: { ...p.ammo.pistol, inMag: 1 } } }
    p = startReload(p)
    const t = p.reloading
    p = tickReload(p, 0.3)
    p = startReload(p)
    ok(p.reloading < t, '재장전이 되감기지 않음')
  }
  // 무기 전환
  {
    let p = initialPlayer()
    const start = p.weapon
    /* 로비에서 안 고른 무기로는 못 바꾼다 */
    const notPicked = weaponsM.WEAPON_ORDER.find((id) => !p.ammo[id].owned)
    ok(notPicked, '안 고른 무기가 있다')
    eq(switchWeapon(p, notPicked).weapon, start, '안 고른 무기로는 못 바꿈')
    eq(switchWeapon(p, 'nope').weapon, start, '없는 아이디는 무시')

    /* 주우면 그때부터 들 수 있다 (지금 규칙에서는 안 쓰이지만
       grantPickup 자체는 살아 있어야 한다) */
    p = grantPickup(p, { kind: 'weapon', weapon: notPicked })
    ok(p.ammo[notPicked].owned, '주우면 소지 표시')
    eq(p.weapon, notPicked, '처음 주운 무기는 바로 손에')
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

  /* ★ 어떤 구성을 골라도 결국 쓸 것이 남는다.

     무기를 로비에서 고르게 된 뒤로, 예비탄이 무한한 것은 권총뿐이다.
     권총을 안 고르면 언젠가 모든 탄이 마르는데, 그때 손이 비면
     게임이 끝난 것도 아니면서 아무것도 못 하는 상태가 된다.
     근접무기가 그 바닥을 받쳐 준다. */
  {
    const { switchSlot } = playerM
    for (const melee of weaponsM.WEAPONS_BY_SLOT.melee) {
      let p = initialPlayer(0, 0, {
        loadout: { primary: 'sniper', secondary: 'magnum', melee },
      })
      // 모든 탄약을 말린다
      const dried = { ...p.ammo }
      for (const id of weaponsM.WEAPON_ORDER) {
        dried[id] = { ...dried[id], inMag: 0, reserve: 0 }
      }
      p = { ...p, ammo: dried, cooldown: 0, reloading: 0 }

      p = switchSlot(p, 'melee')
      p = { ...p, cooldown: 0 }
      eq(p.weapon, melee, `${melee} 로 바꿀 수 있다`)
      ok(canFire(p), `탄이 다 말라도 ${melee} 는 휘두를 수 있다`)
    }
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
    /* 안 고른 무기로 해야 한다. 고른 무기는 예비탄이 이미 꽉 차
       있어서 더 넣어도 안 늘고, 그러면 시험이 아무것도 안 잰다. */
    let p = initialPlayer()
    const id = weaponsM.WEAPON_ORDER.find((w) => !p.ammo[w].owned && !WEAPONS[w].noAmmo)
    p = grantPickup(p, { kind: 'weapon', weapon: id })
    const r1 = p.ammo[id].reserve
    p = grantPickup(p, { kind: 'weapon', weapon: id })
    ok(p.ammo[id].reserve > r1, `중복 획득은 탄약으로 — ${id} ${r1} → ${p.ammo[id].reserve}`)
    ok(p.ammo[id].reserve <= WEAPONS[id].reserve, '예비탄 상한')
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


// ══════════════════════════════════════════════════════ 난이도
section('난이도 — 다섯 단계')
{
  const { DIFFICULTIES, getDifficulty, clampSpeedScale, combinedScaling, SPEED_CEILING } = diffM
  const { PLAYER } = playerM

  eq(DIFFICULTIES.length, 5, '다섯 단계')
  const names = DIFFICULTIES.map((d) => d.name)
  eq(new Set(names).size, 5, '이름이 서로 다르다')
  eq(new Set(DIFFICULTIES.map((d) => d.id)).size, 5, '아이디가 서로 다르다')
  for (const d of DIFFICULTIES) {
    ok(d.name && d.desc && d.color, `${d.id} 에 이름·설명·색이 있다`)
    ok(d.hp > 0 && d.damage > 0 && d.count > 0, `${d.id} 배율이 양수`)
    ok(d.regen >= 0, `${d.id} 회복은 음수가 아니다`)
  }

  /* ★ 단계는 실제로 순서대로 어려워져야 한다. 이름만 다르고 숫자가
     뒤섞여 있으면 "고급"이 "중급"보다 쉬울 수 있다. */
  for (let i = 1; i < DIFFICULTIES.length; i++) {
    const a = DIFFICULTIES[i - 1], b = DIFFICULTIES[i]
    ok(b.hp > a.hp, `${b.name} 이 ${a.name} 보다 단단하다`)
    ok(b.damage > a.damage, `${b.name} 이 ${a.name} 보다 아프다`)
    ok(b.count > a.count, `${b.name} 이 ${a.name} 보다 많이 온다`)
    ok(b.accuracy > a.accuracy, `${b.name} 이 ${a.name} 보다 잘 맞힌다`)
    ok(b.speed >= a.speed, `${b.name} 이 ${a.name} 보다 느리지 않다`)
    ok(b.regen <= a.regen, `${b.name} 이 ${a.name} 보다 회복이 안 된다`)
  }

  /* 기준은 중급 — 전부 1배여야 다른 단계를 여기서 잰다는 말이 산다 */
  const normal = getDifficulty('normal')
  for (const k of ['hp', 'damage', 'speed', 'accuracy', 'count', 'regen']) {
    eq(normal[k], 1, `중급의 ${k} 는 1배`)
  }
  eq(getDifficulty('없는단계').id, 'normal', '모르는 이름은 기준으로')
  eq(getDifficulty(undefined).id, 'normal', '안 고르면 기준으로')

  /* 신화는 회복이 없다 — 그게 그 단계의 정체다 */
  eq(getDifficulty('mythic').regen, 0, '신화는 회복 없음')
  ok(getDifficulty('novice').regen > 1, '초급은 회복이 빠르다')

  /* ★ 어떤 단계에서도 적이 플레이어보다 빠를 수 없다.

     여기가 무너지면 "물러나며 쏘기"가 통하지 않게 되는데, 그건
     어려워지는 게 아니라 대응할 방법이 사라지는 것이다. 웨이브
     배율과 난이도 배율이 곱해지므로 각각은 얌전해도 합치면 넘긴다. */
  const fastest = Math.max(...Object.values(enemiesM.ENEMY_TYPES).map((t) => t.speed))
  for (const d of DIFFICULTIES) {
    for (let n = 1; n <= 400; n++) {
      const sc = combinedScaling(waveM.waveScaling(n), d)
      ok(fastest * sc.speed < PLAYER.speed,
        `${d.name} ${n}웨이브에서도 적(${(fastest * sc.speed).toFixed(2)})이 플레이어(${PLAYER.speed})보다 느리다`)
      ok(sc.hp > 0 && Number.isFinite(sc.hp), '체력 배율이 온당하다')
    }
  }
  ok(clampSpeedScale(999) <= SPEED_CEILING, '천장 위로는 안 올라간다')
  eq(clampSpeedScale(0.5), 0.5, '천장 아래는 그대로')

  /* 난이도가 실제로 세션에 먹히는가 — 같은 씨앗으로 두 판을 만들어
     첫 적의 체력을 비교한다 */
  {
    const mk = (id) => {
      const ss = sessionM.createSession(42, { difficulty: id })
      const input = { forward: false, back: false, left: false, right: false,
        jump: false, sprint: false, fire: false, firePressed: false,
        reload: false, switchSlot: null, cycle: 0, yaw: 0, pitch: 0 }
      for (let i = 0; i < 400; i++) sessionM.stepSession(ss, input, 1 / 60)
      return ss
    }
    const easy = mk('novice')
    const hard = mk('mythic')
    ok(easy.enemies.length > 0 && hard.enemies.length > 0, '두 판 다 적이 나왔다')
    ok(hard.enemies[0].hp > easy.enemies[0].hp,
      `신화의 적이 초급보다 단단하다 — ${easy.enemies[0].hp} vs ${hard.enemies[0].hp}`)
    ok(hard.enemies[0].dmgScale > easy.enemies[0].dmgScale, '신화의 적이 더 아프다')
    eq(easy.player.regenMul, diffM.getDifficulty('novice').regen, '초급 회복 배율이 전달된다')
    eq(hard.player.regenMul, 0, '신화는 회복이 꺼져 있다')
  }
}

// ══════════════════════════════════════════════════════ 방아쇠
section('방아쇠 — 점사 · 예열 · 차지')
{
  const { WEAPONS, fireMode, FIRE_MODE_LABEL, shotInterval, chargeMultiplier } = weaponsM
  const { initialPlayer, tickTrigger, resetTrigger, switchSlot } = playerM

  /* 발사 방식이 골고루 있어야 "다양하다"는 말이 산다 */
  const modes = new Set(Object.values(WEAPONS).map(fireMode))
  ok(modes.size >= 5, `발사 방식이 다섯 갈래 이상 — ${[...modes].join(', ')}`)
  for (const m of modes) ok(FIRE_MODE_LABEL[m], `${m} 에 이름표가 있다`)

  // ── 예열 ──────────────────────────────────────────────────────
  {
    const w = WEAPONS.minigun
    ok(w.spinUp > 0 && w.spinMin > 0 && w.spinMin < 1, '미니건에 예열 수치가 있다')
    /* 안 돌았을 때가 다 돌았을 때보다 느려야 한다 */
    ok(shotInterval(w, 0) > shotInterval(w, 1), '예열 전이 예열 후보다 느리다')
    near(shotInterval(w, 1), 60 / w.rpm, 1e-9, '다 돌면 규격 연사')
    near(shotInterval(w, 0), 60 / (w.rpm * w.spinMin), 1e-9, '안 돌면 최저 연사')

    let p = initialPlayer(0, 0, { loadout: { primary: 'minigun', secondary: 'pistol', melee: 'knife' } })
    eq(p.spin, 0, '처음엔 안 돌아 있다')
    for (let i = 0; i < Math.ceil(w.spinUp * 60) + 5; i++) p = tickTrigger(p, true, 1 / 60)
    near(p.spin, 1, 1e-6, '누르고 있으면 끝까지 돈다')
    for (let i = 0; i < Math.ceil(w.spinDown * 60) + 5; i++) p = tickTrigger(p, false, 1 / 60)
    near(p.spin, 0, 1e-6, '놓으면 식는다')

    /* ★ 무기를 바꾸면 회전이 풀려야 한다. 안 그러면 미니건을 돌려
       놓고 칼로 바꿨다 꺼내는 것만으로 공짜 최대 연사가 된다. */
    let q = initialPlayer(0, 0, { loadout: { primary: 'minigun', secondary: 'pistol', melee: 'knife' } })
    for (let i = 0; i < 200; i++) q = tickTrigger(q, true, 1 / 60)
    ok(q.spin > 0.9, '충분히 돌려 놓았다')
    q = switchSlot({ ...q, cooldown: 0 }, 'melee')
    eq(q.spin, 0, '무기를 바꾸면 회전이 풀린다')
    eq(resetTrigger({ ...q, spin: 1, charge: 1, burstLeft: 3 }).spin, 0, 'resetTrigger 가 비운다')
  }

  // ── 차지 ──────────────────────────────────────────────────────
  {
    const w = WEAPONS.railgun
    ok(w.charge > 0 && w.chargeMax > 1, '레일건에 차지 수치가 있다')
    near(chargeMultiplier(w, 0), 1, 1e-9, '안 모으면 1배')
    near(chargeMultiplier(w, 1), w.chargeMax, 1e-9, '다 모으면 최대 배율')
    ok(chargeMultiplier(w, 0.5) > 1 && chargeMultiplier(w, 0.5) < w.chargeMax, '중간은 중간')
    /* 범위 밖을 넣어도 안 터진다 */
    near(chargeMultiplier(w, -5), 1, 1e-9, '음수는 0 으로 친다')
    near(chargeMultiplier(w, 9), w.chargeMax, 1e-9, '1 을 넘으면 최대로 자른다')
    /* 차지가 아닌 무기는 배율이 없다 */
    near(chargeMultiplier(WEAPONS.rifle, 1), 1, 1e-9, '차지 무기가 아니면 1배')

    let p = initialPlayer(0, 0, { loadout: { primary: 'railgun', secondary: 'pistol', melee: 'knife' } })
    eq(p.charge, 0, '처음엔 안 모여 있다')
    for (let i = 0; i < Math.ceil(w.charge * 60) + 5; i++) p = tickTrigger(p, true, 1 / 60)
    near(p.charge, 1, 1e-6, '누르고 있으면 가득 모인다')
    ok(p.charging, '모으는 중이라고 표시된다')
    p = tickTrigger(p, false, 1 / 60)
    ok(!p.charging, '놓으면 모으기가 끝난다')
  }

  // ── 점사 ──────────────────────────────────────────────────────
  for (const id of ['battle', 'burstpistol']) {
    const w = WEAPONS[id]
    eq(fireMode(w), 'burst', `${id} 는 점사`)
    ok(w.burst >= 2, `${id} 는 두 발 이상 나간다`)
    ok(w.burstGap > 0 && w.burstRest > w.burstGap,
      `${id} 는 점사 안 간격보다 점사 사이 쉼이 길다`)
    ok(!w.auto, `${id} 는 누르고 있는 것만으로 계속 나가지 않는다`)
  }

  /* ★ 점사 사이에는 실제로 쉼이 있어야 한다.

     "세 발 → 쉼 → 세 발"의 박자가 점사의 정체다. 쉼이 없으면
     그냥 연사가 되고, 그러면 점사라는 갈래를 만든 이유가 없다.
     발수만 세는 시험으로는 이걸 못 잡는다 — 시간을 재야 한다. */
  {
    const { createSession, stepSession } = sessionM
    const w = WEAPONS.burstpistol
    const ss = createSession(9, {
      loadout: { primary: 'rifle', secondary: 'burstpistol', melee: 'knife' },
    })
    const input = {
      forward: false, back: false, left: false, right: false, jump: false, sprint: false,
      fire: false, firePressed: false, reload: false, switchSlot: 'secondary', cycle: 0,
      yaw: 0, pitch: 0,
    }
    stepSession(ss, input, 1 / 60)
    input.switchSlot = null
    ss.player.cooldown = 0

    /* 계속 누르고 있으면서 발사 시각을 기록하되, 탄창이 비기 전에
       멈춘다. 재장전이 끼면 그 1.4초가 "가장 긴 간격"이 되어 버려서,
       점사 사이의 쉼이 사라져도 시험이 통과한다 — 재고 싶은 것이
       재장전 시간에 가려진다. */
    const times = []
    let t = 0
    const wanted = w.burst * 3
    for (let i = 0; i < 400 && times.length < wanted; i++) {
      input.fire = true
      input.firePressed = true       // 사람이 연타하는 상황까지 포함
      const evs = stepSession(ss, input, 1 / 60)
      t += 1 / 60
      for (const e of evs) if (e.type === 'shot') times.push(t)
    }
    eq(times.length, wanted, `점사 세 번치가 나갔다 — ${times.length}발`)
    ok(ss.player.reloading <= 0 && ss.player.ammo.burstpistol.inMag > 0,
      '아직 탄창이 남아 있다 — 재장전이 간격을 가리지 않는다')

    /* 간격을 점사 안(gap)과 점사 사이(rest)로 갈라 본다 */
    const gaps = []
    for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1])
    const longest = Math.max(...gaps)
    ok(longest >= w.burstRest - 0.03,
      `점사 사이에 쉼이 있다 — 가장 긴 간격 ${longest.toFixed(3)}s ≥ ${w.burstRest}s`)
    ok(longest > w.burstGap * 2,
      `그 쉼이 점사 안 간격(${w.burstGap}s)보다 확실히 길다`)
  }
}

// ══════════════════════════════════════════════════════ 세션 · 로비
section('세션 — 로비에서 고른 것으로 시작한다')
{
  const { createSession, stepSession, hudSnapshot } = sessionM
  const { WEAPONS, WEAPONS_BY_SLOT, SLOTS, normalizeLoadout, DEFAULT_LOADOUT } = weaponsM

  const blank = () => ({
    forward: false, back: false, left: false, right: false, jump: false, sprint: false,
    fire: false, firePressed: false, reload: false, switchSlot: null, cycle: 0,
    yaw: 0, pitch: 0,
  })

  /* ── 거리밭이 플레이어를 따라온다 ─────────────────────────── */
  {
    /* 길찾기는 플레이어 자리에서 퍼져 나온다. 그 자리가 안 바뀌면
       적은 사람이 떠난 지 오래인 데로 몰려간다. 계산이 비싸다는
       이유로 한 번만 만들고 말기 쉬운 자리라, 따로 못을 박아 둔다. */
    const nav = await load('navgrid.js')
    const s0 = createSession('nav-follow', { map: 'plaza' })
    stepSession(s0, blank(), 1 / 60)

    const radius = enemiesM.ENEMY_TYPES.crawler.radius
    const near = () => nav.navDistance(s0.nav.byRadius.get(radius).field, s0.player.x, s0.player.z)

    ok(near() < 1.5, `처음부터 플레이어 자리에서 퍼진다 — ${near().toFixed(1)}`)

    /* 사람을 맵 반대편으로 옮겨 가며 본다. 옮길 때마다 그 자리가
       다시 거리밭의 한가운데가 되어야 한다. */
    let worst = 0
    for (const [x, z] of [[8, 0], [-8, 0], [0, 9], [0, -9], [6, -6]]) {
      s0.player.x = x
      s0.player.z = z
      stepSession(s0, blank(), 1 / 60)
      worst = Math.max(worst, near())
    }
    ok(worst < 1.5, `옮겨 다녀도 플레이어가 거리밭의 한가운데다 — 최대 ${worst.toFixed(1)}`)

    /* 같은 칸 안에서 꼼지락거릴 때까지 다시 계산하지는 않는다 */
    s0.player.x = 0
    s0.player.z = 0
    stepSession(s0, blank(), 1 / 60)
    const before = s0.nav.byRadius.get(radius).field
    s0.player.x = 0.01
    stepSession(s0, blank(), 1 / 60)
    ok(s0.nav.byRadius.get(radius).field === before,
      '칸을 안 벗어나면 거리밭을 새로 만들지 않는다')
  }

  /* 고른 셋을 그대로 들고 시작한다 */
  {
    const lo = { primary: 'railgun', secondary: 'magnum', melee: 'hammer' }
    const s2 = createSession(1, { difficulty: 'expert', loadout: lo })
    eq(s2.player.weapon, 'railgun', '주무기를 들고 시작')
    for (const slot of SLOTS) eq(s2.player.slots[slot], lo[slot], `${slot} 자리`)
    const owned = weaponsM.WEAPON_ORDER.filter((id) => s2.player.ammo[id].owned)
    eq(owned.length, 3, '고른 셋만 가진다')
    eq(s2.difficulty.id, 'expert', '고른 난이도가 들어간다')
  }

  /* 이상한 구성을 넣어도 게임이 안 깨진다 */
  {
    const s3 = createSession(1, { loadout: { primary: 'knife', secondary: null, melee: 'sniper' } })
    for (const slot of SLOTS) {
      eq(WEAPONS[s3.player.slots[slot]].slot, slot, `${slot} 자리가 올바른 무기로 고쳐진다`)
    }
    ok(WEAPONS[s3.player.weapon], '들고 있는 무기가 실재한다')
  }
  eq(normalizeLoadout({}).primary, DEFAULT_LOADOUT.primary, '빈 구성은 기본값')
  eq(normalizeLoadout(undefined).melee, DEFAULT_LOADOUT.melee, '없어도 기본값')

  /* ★ 모든 조합이 실제로 굴러가야 한다.

     21자루면 조합이 9×7×5 = 315 가지다. 하나라도 세션을 못 만들거나
     첫 몇 초에 터지면, 그 조합을 고른 사람에게만 게임이 고장 난다. */
  {
    let bad = 0
    for (const a of WEAPONS_BY_SLOT.primary) {
      for (const b of WEAPONS_BY_SLOT.secondary) {
        for (const c of WEAPONS_BY_SLOT.melee) {
          try {
            const ss = createSession(7, { loadout: { primary: a, secondary: b, melee: c } })
            const input = blank()
            for (let i = 0; i < 30; i++) {
              input.fire = i % 3 !== 0
              input.firePressed = i % 3 === 1
              stepSession(ss, input, 1 / 60)
            }
            const h = hudSnapshot(ss)
            if (!h || !Number.isFinite(h.hp)) bad++
          } catch { bad++ }
        }
      }
    }
    eq(bad, 0, `주무기×보조×근접 모든 조합이 굴러간다 (${WEAPONS_BY_SLOT.primary.length}×${WEAPONS_BY_SLOT.secondary.length}×${WEAPONS_BY_SLOT.melee.length})`)
  }

  /* ★ 적은 그 맵의 스폰 지점에서 나와야 한다.

     맵마다 막힌 곳이 다른데 스폰 지점이 맵과 따로 놀면, 적이 벽
     속에서 태어나거나 플레이어 코앞에서 튀어나온다. */
  for (const mapId of ['bunker', 'maze', 'colosseum']) {
    const ss = createSession(3, { map: mapId })
    const input = blank()
    /* 갓 태어난 적만 본다. 몇 초 지나면 이미 걸어와 있어서 스폰
       지점과 멀어지는데, 그건 잘 걷고 있다는 뜻이지 흠이 아니다. */
    let checked = 0
    for (let i = 0; i < 600; i++) {
      stepSession(ss, input, 1 / 60)
      for (const e of ss.enemies) {
        if (e.age > 0.1) continue
        const onSpawn = ss.map.spawns.some((sp) => Math.hypot(sp.x - e.x, sp.z - e.z) < 0.6)
        ok(onSpawn,
          `${ss.map.name}: 갓 태어난 적이 스폰 지점에 있다 (${e.x.toFixed(1)},${e.z.toFixed(1)})`)
        checked++
      }
    }
    ok(checked > 0, `${ss.map.name}: 확인한 적이 있다 — ${checked}`)
  }

  /* ★ 통로 위 스폰 지점이면 그 위에서 태어난다.

     발밑 규칙(걸어 오를 수 있는가)을 그대로 쓰면 통로 top(2.0)이
     걸러져 바닥(0)이 나오고, 적이 통로 속에 파묻힌 채로 생겨난다.
     투기장은 가장자리가 통째로 관람석이라 이게 바로 드러난다. */
  {
    const ss = createSession(3, { map: 'colosseum' })
    const input = blank()
    for (let i = 0; i < 400; i++) stepSession(ss, input, 1 / 60)
    ok(ss.enemies.length > 0, '투기장에 적이 나왔다')
    const raised = ss.enemies.filter((e) => e.y > 0.5)
    ok(raised.length > 0,
      `관람석 위에서 태어난 적이 있다 — ${raised.length}/${ss.enemies.length}`)
  }

  /* 시작 자리에 단이 있으면 플레이어도 그 위에서 시작한다 */
  {
    const ss = createSession(3, { map: 'tower' })
    ok(ss.player.y > 1.5, `탑에서는 단 위에서 시작한다 — y=${ss.player.y}`)
    const flat = createSession(3, { map: 'pillars' })
    eq(flat.player.y, 0, '평지 맵은 바닥에서 시작한다')
  }

  /* 점사가 세션에서 실제로 정해진 발수만큼 나가는가 */
  {
    const w = WEAPONS.burstpistol
    const ss = createSession(5, { loadout: { primary: 'rifle', secondary: 'burstpistol', melee: 'knife' } })
    const input = blank()
    input.switchSlot = 'secondary'
    stepSession(ss, input, 1 / 60)
    input.switchSlot = null
    ss.player.cooldown = 0

    const before = ss.player.ammo.burstpistol.inMag
    input.fire = true
    input.firePressed = true
    let fired = 0
    for (let i = 0; i < 40; i++) {
      const evs = stepSession(ss, input, 1 / 60)
      fired += evs.filter((e) => e.type === 'shot').length
      input.firePressed = false          // 한 번만 눌렀다
    }
    eq(fired, w.burst, `한 번 누르면 정확히 ${w.burst} 발`)
    eq(before - ss.player.ammo.burstpistol.inMag, w.burst, '탄도 그만큼 준다')
  }

  /* 차지가 세션에서 실제로 배율을 싣는가 */
  {
    const ss = createSession(5, { loadout: { primary: 'railgun', secondary: 'pistol', melee: 'knife' } })
    const input = blank()
    // 살짝만 눌렀다 놓으면 안 나간다
    input.fire = true
    stepSession(ss, input, 1 / 60)
    input.fire = false
    let evs = stepSession(ss, input, 1 / 60)
    eq(evs.filter((e) => e.type === 'shot').length, 0, '조금만 모으고 놓으면 안 나간다')

    // 충분히 모았다 놓으면 나가고, 배율이 실린다
    input.fire = true
    for (let i = 0; i < Math.ceil(WEAPONS.railgun.charge * 60) + 5; i++) {
      stepSession(ss, input, 1 / 60)
    }
    input.fire = false
    evs = stepSession(ss, input, 1 / 60)
    const shot = evs.find((e) => e.type === 'shot')
    ok(shot, '다 모으고 놓으면 나간다')
    ok(shot.charged > 1, `배율이 실렸다 — ×${shot.charged?.toFixed(2)}`)
    near(shot.charged, WEAPONS.railgun.chargeMax, 0.05, '가득 모았으니 최대 배율에 가깝다')
    eq(ss.player.charge, 0, '쏘고 나면 모은 것이 비워진다')
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
  const boxes = BUNKER.boxes

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
    const sched = spawnSchedule(wave, rng, BUNKER.spawns)
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

      /* 탄이 마르면 다음 자리로 넘어간다.

         로비에서 무기를 고르게 된 뒤로, 주무기 예비탄은 언젠가
         반드시 바닥난다(권총만 무한이다). 안 바꾸는 봇은 그 시점부터
         아무것도 못 잡아서, 게임이 멈춘 것처럼 보이지만 실제로는
         봇이 빈 총을 들고 서 있는 것이다. 사람은 당연히 바꾼다. */
      {
        const dry = (id) => {
          const w = WEAPONS[id]
          if (w.noAmmo) return false
          const a = p.ammo[id]
          return a.inMag <= 0 && a.reserve <= 0
        }
        if (dry(p.weapon) && p.reloading <= 0) {
          const order = ['primary', 'secondary', 'melee']
          for (const slot of order) {
            const id = p.slots[slot]
            if (id && !dry(id) && id !== p.weapon) {
              p = playerM.switchSlot({ ...p, cooldown: 0 }, slot)
              break
            }
          }
        }
      }

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
const MAX_SHOWN = Number(process.env.SHOW_FAILS || 40)
if (fail) {
  for (const f of fails.slice(0, MAX_SHOWN)) console.log('  ✗ ' + f)
  if (fails.length > MAX_SHOWN) console.log(`  ... 외 ${fails.length - MAX_SHOWN}건`)
}
console.log(`\n${fail === 0 ? '✅' : '❌'}  통과 ${pass} / 실패 ${fail}\n`)
process.exit(fail ? 1 : 0)
