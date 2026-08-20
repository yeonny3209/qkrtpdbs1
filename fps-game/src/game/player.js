/* ==================================================================
   플레이어

   이동·점프·사격·재장전이 전부 여기 순수 함수로 있다. 입력은
   {forward, back, left, right, jump, sprint} 같은 뜻 단위로 받는다 —
   키 코드를 여기까지 들이면, 키 배치를 바꾸는 순간 게임 규칙을
   건드려야 한다.
   ================================================================== */
import { resolveMove, groundHeightAt, ceilingAt } from './collide.js'
import {
  WEAPONS, WEAPON_ORDER, WEAPONS_BY_SLOT, SLOTS,
  shotInterval, reloadAmount, initialAmmo, initialSlots, DEFAULT_LOADOUT,
} from './weapons.js'

export const PLAYER = {
  radius: 0.36,
  eyeHeight: 1.62,
  height: 1.78,          // 머리끝 — 통로 밑을 지날 때 천장 판정에 쓴다
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

  /* ── 체력 회복 ──────────────────────────────────────────────
     한동안 안 맞으면 서서히 찬다.

     이게 없으면 앞 웨이브에서 깎인 체력이 그대로 쌓여, 열 번째
     웨이브의 난이도가 열 번째 웨이브의 실력이 아니라 첫 웨이브에서
     실수했는지로 정해진다. 회복이 있으면 한 번의 실수가 판 전체를
     망치지 않고, "지금 물러나서 숨을 돌릴까"라는 판단이 생긴다.

     교전 중에는 안 찬다 — 맞으면서 버티는 게 통하면 안 된다. */
  regenDelay: 6.0,       // 마지막 피격 후 이만큼 지나야 시작
  regenRate: 9,          // 초당 회복량
}

export function initialPlayer(x = 0, z = 0, opts = {}) {
  const loadout = opts.loadout || DEFAULT_LOADOUT
  return {
    x, z,
    y: 0,                 // 발 높이. 바닥이 평면이라 0 이 곧 착지 상태
    vy: 0,
    onGround: true,
    hp: PLAYER.maxHp,
    invuln: 0,
    sinceHit: PLAYER.regenDelay,   // 시작하자마자 회복 대기 없이 만피
    yaw: 0,               // 좌우 시점 — 렌더링 쪽 카메라와 동기화
    pitch: 0,
    /* 로비에서 고른 것으로 시작한다 */
    weapon: initialSlots(loadout).primary,
    slots: initialSlots(loadout),
    ammo: initialAmmo(loadout),
    /* 난이도가 회복 속도를 조절한다. 0 이면 아예 안 찬다(신화). */
    regenMul: opts.regenMul ?? 1,
    cooldown: 0,          // 다음 발사까지
    reloading: 0,         // 남은 재장전 시간, 0 이면 안 하는 중
    recoil: 0,            // 무기 반동 애니메이션 진행도
    bob: 0,               // 걸을 때 화면 흔들림 위상
    knock: { x: 0, z: 0 },// 브루트에게 맞아 밀리는 속도

    /* ── 발사 방식별 상태 ──────────────────────────────────────
       세 가지 방아쇠가 각자 조금씩 기억할 것이 있다. */
    burstLeft: 0,         // 점사 — 이번 누름에서 남은 발수
    spin: 0,              // 예열 — 0..1, 1 이면 최대 연사
    charge: 0,            // 차지 — 0..1, 1 이면 최대 배율
    charging: false,      // 차지 — 지금 모으는 중인가
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

  /* 발밑 높이를 기준으로 무엇이 벽인지 정한다. 낮은 턱은 통과시켜
     걸어 올라가게 하고, 머리 위 구조물도 통과시킨다. */
  const vert = { feetY: s.y, headY: s.y + PLAYER.height }
  const moved = resolveMove(s.x, s.z, dx, dz, PLAYER.radius, boxes, 8, vert)
  s.x = moved.x
  s.z = moved.z

  // ── 수직 ─────────────────────────────────────────────────────
  if (input.jump && s.onGround) {
    s.vy = PLAYER.jumpSpeed
    s.onGround = false
  }
  s.vy -= PLAYER.gravity * dt
  s.y += s.vy * dt

  /* 밟을 곳 — 계단 한 칸이든 통로든 아레나 바닥이든.
     떨어지는 중일 때만 착지시킨다. 올라가는 중에 붙잡으면 점프가
     시작하자마자 취소된다. */
  const ground = groundHeightAt(s.x, s.z, PLAYER.radius, boxes, s.y)
  if (s.vy <= 0 && s.y <= ground) {
    s.y = ground
    s.vy = 0
    s.onGround = true
  } else if (s.y > ground + 1e-6) {
    s.onGround = false
  }

  /* 머리를 찧으면 거기서 멈춘다 — 통로를 뚫고 올라가지 않게 */
  if (s.vy > 0) {
    const ceil = ceilingAt(s.x, s.z, PLAYER.radius, boxes, s.y)
    if (s.y + PLAYER.height > ceil) {
      s.y = Math.max(ground, ceil - PLAYER.height)
      s.vy = 0
    }
  }


  // ── 연출용 위상 ──────────────────────────────────────────────
  const movedDist = Math.hypot(moved.x - p.x, moved.z - p.z)
  s.bob = s.onGround ? s.bob + movedDist * (sprinting ? 5.5 : 4.2) : s.bob
  s.sprinting = sprinting

  s.invuln = Math.max(0, s.invuln - dt)
  s.cooldown = Math.max(0, s.cooldown - dt)
  s.recoil = Math.max(0, s.recoil - dt * 6)

  // ── 체력 회복 ────────────────────────────────────────────────
  s.sinceHit += dt
  const regen = PLAYER.regenRate * (s.regenMul ?? 1)
  if (regen > 0 && s.sinceHit >= PLAYER.regenDelay && s.hp > 0 && s.hp < PLAYER.maxHp) {
    s.hp = Math.min(PLAYER.maxHp, s.hp + regen * dt)
  }

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
  /* 근접무기는 탄창이 0 이다. 탄약으로 재면 영영 못 휘두른다. */
  if (WEAPONS[p.weapon].noAmmo) return true
  return p.ammo[p.weapon].inMag > 0
}

/* ── 예열 · 차지 ────────────────────────────────────────────────
   방아쇠를 잡고 있는 동안 자라는 값들. 매 프레임 갱신한다. */
export function tickTrigger(p, holding, dt) {
  const w = WEAPONS[p.weapon]
  const s = { ...p }

  // 예열 — 잡고 있으면 오르고 놓으면 식는다
  if (w.spinUp) {
    s.spin = holding
      ? Math.min(1, s.spin + dt / w.spinUp)
      : Math.max(0, s.spin - dt / (w.spinDown || w.spinUp))
  } else if (s.spin !== 0) {
    s.spin = 0
  }

  // 차지 — 잡고 있으면 모인다. 놓는 순간은 session 이 본다.
  if (w.charge) {
    if (holding && canFire(s)) {
      s.charging = true
      s.charge = Math.min(1, s.charge + dt / w.charge)
    } else if (!holding) {
      s.charging = false
    }
  } else if (s.charge !== 0 || s.charging) {
    s.charge = 0
    s.charging = false
  }

  return s
}

/* 무기를 바꾸거나 죽었을 때 방아쇠 상태를 비운다.
   안 비우면 미니건을 돌려 놓고 칼로 바꿨다가 다시 꺼냈을 때
   공짜로 최대 연사가 된다. */
export function resetTrigger(p) {
  return { ...p, burstLeft: 0, spin: 0, charge: 0, charging: false }
}

/* 한 발 소비. 실제 명중 판정은 combat.fireShot 이 한다 — 여기서는
   탄약과 쿨다운만 만진다. */
export function consumeShot(p) {
  const w = WEAPONS[p.weapon]
  const ammo = p.ammo[p.weapon]

  /* 근접무기는 쓸 탄이 없다. 이걸 빠뜨리면 탄창이 음수로 내려간다. */
  if (w.noAmmo) {
    return { ...p, cooldown: shotInterval(w, p.spin), recoil: 1 }
  }

  const next = {
    ...p,
    cooldown: shotInterval(w, p.spin),
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

/* 무기 전환 — 가진 것만, 재장전 중이면 취소하고 바꾼다.
   드는 데 잠깐 걸린다. 즉시 바꿔 쏠 수 있으면 재장전 대신 무기를
   번갈아 꺼내는 것이 언제나 이득이 되어 재장전이 무의미해진다. */
export function switchWeapon(p, id) {
  if (!WEAPONS[id]) return p
  if (!p.ammo[id]?.owned) return p
  if (p.weapon === id) return p
  const slot = WEAPONS[id].slot
  return {
    ...resetTrigger(p),
    weapon: id,
    slots: { ...p.slots, [slot]: id },
    reloading: 0,
    cooldown: Math.max(p.cooldown, 0.25),
  }
}

/* 숫자키로 슬롯을 꺼낸다.

   이미 그 슬롯을 들고 있는데 또 누르면, 같은 슬롯 안의 다음 무기로
   넘어간다 — 주무기 자리를 소총과 샷건이 나눠 쓰기 때문이다. 샷건을
   주웠다고 소총을 잃는 것은 억울하고, 그렇다고 슬롯을 넷으로 늘리면
   1·2·3 이 역할을 가리킨다는 규칙이 깨진다. */
export function switchSlot(p, slot) {
  if (!SLOTS.includes(slot)) return p
  const owned = (WEAPONS_BY_SLOT[slot] || []).filter((id) => p.ammo[id]?.owned)
  if (owned.length === 0) return p

  const cur = WEAPONS[p.weapon]?.slot === slot ? p.weapon : null
  if (!cur) return switchWeapon(p, p.slots[slot] || owned[0])
  if (owned.length === 1) return p
  return switchWeapon(p, owned[(owned.indexOf(cur) + 1) % owned.length])
}

/* 휠로 돌릴 때는 슬롯 순서대로 — 가진 무기만 거친다 */
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
    sinceHit: 0,                   // 맞았으니 회복 시계를 처음부터
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
    /* 처음 줍는 무기는 그 슬롯에 넣고 바로 손에 쥐여 준다 */
    const first = !prev.owned
    return {
      ...p,
      ammo,
      slots: first ? { ...p.slots, [w.slot]: pickup.weapon } : p.slots,
      weapon: first ? pickup.weapon : p.weapon,
    }
  }

  if (pickup.kind === 'ammo') {
    const ammo = { ...p.ammo }
    for (const id of WEAPON_ORDER) {
      const w = WEAPONS[id]
      /* 근접무기와 권총은 채울 것이 없다 */
      if (w.noAmmo || !ammo[id].owned || ammo[id].reserve === Infinity) continue
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
