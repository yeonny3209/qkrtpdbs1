/* ==================================================================
   무기

   전부 히트스캔이다 — 방아쇠를 당긴 프레임에 광선을 쏴서 즉시
   맞았는지 정한다. 투사체를 실제로 날리면 프레임 사이를 건너뛰어
   얇은 적을 통과하는 문제(터널링)를 따로 풀어야 하는데, 이 정도
   교전 거리에서 총알 비행시간은 어차피 체감되지 않는다.

   수치는 셋이 서로 다른 거리에서 답이 되도록 잡았다. 권총은 탄이
   무한한 대신 초당 피해가 낮고, 소총은 중거리 주력이지만 탄을 먹고,
   샷건은 코앞에서 압도적이되 멀면 거의 무의미하다.
   ================================================================== */

export const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: '권총',
    icon: '🔫',
    damage: 22,
    pellets: 1,
    rpm: 180,              // 초당 3발
    mag: 12,
    reserve: Infinity,     // 최후의 보루 — 이것마저 떨어지면 할 게 없다
    reload: 1.0,
    spread: 1.0,           // 도(degree), 조준선에서 벌어지는 최대 각
    range: 80,
    auto: false,
    falloffStart: 40,      // 이 거리부터 피해가 준다
    falloffEnd: 80,        // 이 거리에서 최소 배율
    falloffMin: 0.55,
    recoil: 0.9,           // 화면이 튀는 정도(무기 반동 애니메이션용)
  },
  rifle: {
    id: 'rifle',
    name: '돌격소총',
    icon: '🔩',
    damage: 15,
    pellets: 1,
    rpm: 480,              // 초당 8발
    mag: 30,
    reserve: 180,
    reload: 2.0,
    spread: 3.0,
    range: 70,
    auto: true,
    falloffStart: 30,
    falloffEnd: 70,
    falloffMin: 0.6,
    recoil: 0.55,
  },
  shotgun: {
    id: 'shotgun',
    name: '샷건',
    icon: '💥',
    damage: 7.5,           // 알 하나당. 8알 전탄 명중 시 60
    pellets: 8,
    rpm: 72,               // 초당 1.2발
    mag: 6,
    reserve: 36,
    reload: 2.5,
    spread: 12.0,
    range: 28,
    auto: false,
    falloffStart: 8,       // 아주 빨리 죽는다 — 근접 전용이라는 뜻
    falloffEnd: 28,
    falloffMin: 0.2,
    recoil: 2.2,
  },
}

export const WEAPON_ORDER = ['pistol', 'rifle', 'shotgun']

/* 발 사이 최소 간격(초). rpm 을 그대로 두면 연사 판정을 매번
   나눗셈해야 해서, 여기서 한 번만 바꾼다. */
export function shotInterval(weapon) {
  return 60 / weapon.rpm
}

/* 탄창이 빈 채로 방아쇠를 당기면 자동 재장전이 걸려야 한다.
   "왜 안 나가지" 하고 R 을 찾는 순간이 제일 답답하다. */
export function needsReload(ammo) {
  return ammo.inMag <= 0
}

/* 재장전으로 채울 수 있는 양. 예비탄이 모자라면 있는 만큼만. */
export function reloadAmount(weapon, ammo) {
  const room = weapon.mag - ammo.inMag
  if (room <= 0) return 0
  if (ammo.reserve === Infinity) return room
  return Math.min(room, ammo.reserve)
}

/* 무기별 시작 탄약 상태 */
export function initialAmmo() {
  const out = {}
  for (const id of WEAPON_ORDER) {
    const w = WEAPONS[id]
    /* 권총만 들고 시작한다. 나머지는 아레나에서 주워야 하고,
       주우러 나가는 그 순간이 이 게임의 위험 부담이다. */
    out[id] = { inMag: w.mag, reserve: id === 'pistol' ? Infinity : 0, owned: id === 'pistol' }
  }
  return out
}
