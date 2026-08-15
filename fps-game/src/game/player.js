/* ==================================================================
   플레이어

   이동·점프·사격·재장전이 전부 여기 순수 함수로 있다. 입력은
   {forward, back, left, right, jump, sprint} 같은 뜻 단위로 받는다 —
   키 코드를 여기까지 들이면, 키 배치를 바꾸는 순간 게임 규칙을
   건드려야 한다.
   ================================================================== */
import { resolveMove } from './collide.js'
import { WEAPONS, WEAPON_ORDER, shotInterval, reloadAmount, initialAmmo } from './weapons.js'

export const PLAYER = {
  radius: 0.36,
  eyeHeight: 1.62,
  speed: 5.2,
  sprintMul: 1.55,
  jumpSpeed: 5.6,
  gravity: 18,
  maxHp: 100,
  /* 공중에서는 방향 전환이 잘 안 되어야 한다. 점프로 지그재그를
     그리며 무한히 회피하는 걸 막는다. */
  airControl: 0.35,
  /* 피격 직후 잠깐 무적. 크롤러 세 마리에 둘러싸이면 같은 프레임에
     세 번 맞아서 체력이 순식간에 녹는데, 그건 어려운 게 아니라
     억울한 것이다. */
  invulnAfterHit: 0.28,
}

export function initialPlayer(x = 0, z = 0) {
  return {
    x, z,
    y: 0,                 // 발 높이. 바닥이 평면이라 0 이 곧 착지 상태
    vy: 0,
    onGround: true,
    hp: PLAYER.maxHp,
    invuln: 0,
    yaw: 0,               // 좌우 시점 — 렌더링 쪽 카메라와 동기화
    pitch: 0,
    weapon: 'pistol',
    ammo: initialAmmo(),
    cooldown: 0,          // 다음 발사까지
    reloading: 0,         // 남은 재장전 시간, 0 이면 안 하는 중
    recoil: 0,            // 무기 반동 애니메이션 진행도
    bob: 0,               // 걸을 때 화면 흔들림 위상
    knock: { x: 0, z: 0 },// 브루트에게 맞아 밀리는 속도
  }
}

export function eyeOf(p) {
  return p.y + PLAYER.eyeHeight
}

/* 이동 한 프레임 */
export function movePlayer(p, input, dt, boxes) {
  const s = { ...p }

  // ── 수평 입력을 시점 기준 방향으로 ────────────────────────────
  let ix = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  let iz = (input.back ? 1 : 0) - (input.forward ? 1 : 0)
  const len = Math.hypot(ix, iz)
  if (len > 1) { ix /= len; iz /= len }   // 대각선이 더 빠르면 안 된다

  const sin = Math.sin(s.yaw)
  const cos = Math.cos(s.yaw)
  /* 앞 = aimDir 의 수평 성분 = (-sin yaw, -cos yaw), 오른쪽은 그것을
     위 벡터와 외적한 (cos yaw, -sin yaw).

     이 두 축을 aimDir 과 따로 세우면 안 된다. 부호 하나만 어긋나도
     "보는 쪽과 걷는 쪽이 다른" 게임이 되는데, 화면만 봐서는 시점이
     이상한 건지 이동이 이상한 건지 구별이 안 간다. */
  const wx = ix * cos + iz * sin
  const wz = -ix * sin + iz * cos

  const sprinting = input.sprint && iz < 0 && s.onGround
  let speed = PLAYER.speed * (sprinting ? PLAYER.sprintMul : 1)
  if (!s.onGround) speed *= PLAYER.airControl + (1 - PLAYER.airControl) * 0.85

  let dx = wx * speed * dt
  let dz = wz * speed * dt

  // ── 넉백 — 밀린 뒤 빠르게 잦아든다 ───────────────────────────
  dx += s.knock.x * dt
  dz += s.knock.z * dt
  const decay = Math.exp(-6 * dt)
  s.knock = { x: s.knock.x * decay, z: s.knock.z * decay }

  const moved = resolveMove(s.x, s.z, dx, dz, PLAYER.radius, boxes)
  s.x = moved.x
  s.z = moved.z

  // ── 수직 ─────────────────────────────────────────────────────
  if (input.jump && s.onGround) {
    s.vy = PLAYER.jumpSpeed
    s.onGround = false
  }
  s.vy -= PLAYER.gravity * dt
  s.y += s.vy * dt
  if (s.y <= 0) {
    s.y = 0
    s.vy = 0
    s.onGround = true
  }

  // ── 연출용 위상 ──────────────────────────────────────────────
  const movedDist = Math.hypot(moved.x - p.x, moved.z - p.z)
  s.bob = s.onGround ? s.bob + movedDist * (sprinting ? 5.5 : 4.2) : s.bob
  s.sprinting = sprinting

  s.invuln = Math.max(0, s.invuln - dt)
  s.cooldown = Math.max(0, s.cooldown - dt)
  s.recoil = Math.max(0, s.recoil - dt * 6)

  return s
}

/* 재장전 진행. 끝나면 탄창을 채운다. */
export function tickReload(p, dt) {
  if (p.reloading <= 0) return p
  const left = p.reloading - dt
  if (left > 0) return { ...p, reloading: left }

  const w = WEAPONS[p.weapon]
  const ammo = p.ammo[p.weapon]
  const amount = reloadAmount(w, ammo)
  return {
    ...p,
    reloading: 0,
    ammo: {
      ...p.ammo,
      [p.weapon]: {
        ...ammo,
        inMag: ammo.inMag + amount,
        reserve: ammo.reserve === Infinity ? Infinity : ammo.reserve - amount,
      },
    },
  }
}

export function startReload(p) {
  if (p.reloading > 0) return p
  const w = WEAPONS[p.weapon]
  const ammo = p.ammo[p.weapon]
  if (reloadAmount(w, ammo) <= 0) return p    // 꽉 찼거나 예비탄이 없다
  return { ...p, reloading: w.reload }
}

/* 지금 쏠 수 있는가 */
export function canFire(p) {
  if (p.reloading > 0) return false
  if (p.cooldown > 0) return false
  return p.ammo[p.weapon].inMag > 0
}

/* 한 발 소비. 실제 명중 판정은 combat.fireShot 이 한다 — 여기서는
   탄약과 쿨다운만 만진다. */
export function consumeShot(p) {
  const w = WEAPONS[p.weapon]
  const ammo = p.ammo[p.weapon]
  const next = {
    ...p,
    cooldown: shotInterval(w),
    recoil: 1,
    ammo: { ...p.ammo, [p.weapon]: { ...ammo, inMag: ammo.inMag - 1 } },
  }
  /* 마지막 탄을 쐈으면 알아서 재장전을 건다. R 을 못 찾아서
     빈 총을 딸깍대는 순간이 제일 답답하다. */
  if (next.ammo[p.weapon].inMag <= 0 && reloadAmount(w, next.ammo[p.weapon]) > 0) {
    next.reloading = w.reload
  }
  return next
}

/* 무기 전환 — 가진 것만, 재장전 중이면 취소하고 바꾼다 */
export function switchWeapon(p, id) {
  if (!WEAPONS[id]) return p
  if (!p.ammo[id]?.owned) return p
  if (p.weapon === id) return p
  return { ...p, weapon: id, reloading: 0, cooldown: Math.max(p.cooldown, 0.25) }
}

export function cycleWeapon(p, dir) {
  const owned = WEAPON_ORDER.filter((id) => p.ammo[id]?.owned)
  if (owned.length <= 1) return p
  const i = owned.indexOf(p.weapon)
  const next = owned[(i + dir + owned.length) % owned.length]
  return switchWeapon(p, next)
}

/* 피격 */
export function hurtPlayer(p, amount, knockDir, knockPower = 0) {
  if (p.invuln > 0) return { player: p, blocked: true }
  const s = {
    ...p,
    hp: Math.max(0, p.hp - amount),
    invuln: PLAYER.invulnAfterHit,
  }
  if (knockPower > 0 && knockDir) {
    s.knock = {
      x: p.knock.x + knockDir.x * knockPower,
      z: p.knock.z + knockDir.z * knockPower,
    }
  }
  return { player: s, blocked: false, died: s.hp <= 0 }
}

export function healPlayer(p, amount) {
  return { ...p, hp: Math.min(PLAYER.maxHp, p.hp + amount) }
}

/* 픽업을 먹었을 때 */
export function grantPickup(p, pickup) {
  if (pickup.kind === 'weapon') {
    const w = WEAPONS[pickup.weapon]
    const prev = p.ammo[pickup.weapon]
    const ammo = {
      ...p.ammo,
      [pickup.weapon]: {
        owned: true,
        inMag: prev.owned ? prev.inMag : w.mag,
        /* 이미 가진 무기를 또 주우면 탄약 보급으로 친다 */
        reserve: Math.min(w.reserve, (prev.owned ? prev.reserve : 0) + w.mag * 2),
      },
    }
    /* 처음 줍는 무기는 바로 손에 쥐여 준다 */
    const weapon = prev.owned ? p.weapon : pickup.weapon
    return { ...p, ammo, weapon }
  }

  if (pickup.kind === 'ammo') {
    const ammo = { ...p.ammo }
    for (const id of WEAPON_ORDER) {
      const w = WEAPONS[id]
      if (!ammo[id].owned || ammo[id].reserve === Infinity) continue
      ammo[id] = { ...ammo[id], reserve: Math.min(w.reserve, ammo[id].reserve + w.mag * 2) }
    }
    return { ...p, ammo }
  }

  if (pickup.kind === 'health') return healPlayer(p, 35)
  return p
}

/* 조준 방향 — yaw/pitch 를 단위 벡터로.
   Three.js 카메라 기본 방향(-Z)에 맞춘다. */
export function aimDir(p) {
  const cp = Math.cos(p.pitch)
  return {
    x: -Math.sin(p.yaw) * cp,
    y: Math.sin(p.pitch),
    z: -Math.cos(p.yaw) * cp,
  }
}
