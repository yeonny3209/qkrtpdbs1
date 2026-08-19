/* ==================================================================
   무기

   슬롯 셋으로 나뉜다 — 주무기 · 보조무기 · 근접무기. 슬롯이 곧
   역할이라, 숫자키 1·2·3 이 언제나 같은 성격의 무기를 꺼낸다.
   손이 기억하는 것은 무기 이름이 아니라 "지금 뭐가 필요한가"다.

   한 슬롯에 여럿이 들어간다. 같은 숫자를 다시 누르면 그 슬롯 안에서
   교대한다 — 새 무기를 주웠다고 쓰던 것을 잃지 않는다.

   ── 아홉 자루가 각자 다른 질문에 답한다 ────────────────────────
     주무기   돌격소총  두루 쓴다. 답이 애매할 때의 답.
              샷건      코앞. 멀면 거의 무의미하다.
              경기관총  탄창 100발. 무리를 눕히되 정밀함은 버린다.
              저격총    한 발이 크고, 줄지어 선 적을 꿰뚫는다.
     보조     권총      예비탄 무한. 모든 게 떨어졌을 때 남는 것.
              기관단총  근거리 속사. 대신 조금만 멀어도 힘이 없다.
              매그넘    여섯 발뿐이지만 한 발이 무겁다.
     근접     나이프    빠르다. 크롤러는 한 방.
              전투도끼  느리고 크게 벤다. 브루트도 두 방.

   총은 전부 히트스캔이다 — 방아쇠를 당긴 프레임에 광선을 쏴서 즉시
   맞았는지 정한다. 투사체를 날리면 프레임 사이를 건너뛰어 얇은 적을
   통과하는 문제(터널링)를 따로 풀어야 하는데, 이 교전 거리에서 총알
   비행시간은 어차피 체감되지 않는다.

   두 가지만 예외다.
     · 근접무기 — 광선 하나로는 발밑의 크롤러를 자꾸 놓친다.
       부채꼴 안을 통째로 벤다. (combat.meleeSwing)
     · 관통 — 저격총은 첫 적에서 멈추지 않고 뒤까지 꿰뚫는다.
       (combat.raycastAll)
   ================================================================== */

export const SLOTS = ['primary', 'secondary', 'melee']

export const SLOT_LABEL = {
  primary: '주무기',
  secondary: '보조무기',
  melee: '근접무기',
}

/* 숫자키 → 슬롯 */
export const SLOT_KEY = { Digit1: 'primary', Digit2: 'secondary', Digit3: 'melee' }

export const WEAPONS = {
  // ── 주무기 ────────────────────────────────────────────────────
  rifle: {
    id: 'rifle',
    slot: 'primary',
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
    slot: 'primary',
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
  lmg: {
    id: 'lmg',
    slot: 'primary',
    name: '경기관총',
    icon: '⛓️',
    damage: 13,
    pellets: 1,
    rpm: 700,
    mag: 100,              // 재장전 없이 오래 버틴다
    reserve: 300,
    reload: 4.2,           // 그 대가로 한 번 비면 아주 오래 무방비다
    spread: 5.5,           // 정밀함은 버렸다
    range: 60,
    auto: true,
    falloffStart: 22,
    falloffEnd: 60,
    falloffMin: 0.5,
    recoil: 0.75,
  },
  sniper: {
    id: 'sniper',
    slot: 'primary',
    name: '대물 저격총',
    icon: '🎯',
    damage: 120,           // 트루퍼는 한 방, 브루트는 두 방
    pellets: 1,
    rpm: 50,               // 볼트액션 — 한 발 쏘고 한참 기다린다
    mag: 5,
    reserve: 40,
    reload: 3.2,
    spread: 0,             // 조준선 그대로 나간다
    range: 100,
    auto: false,
    /* 줄지어 오는 적을 한 발로 꿰뚫는다. 뒤로 갈수록 위력이 줄어
       "무리를 정렬시켜 쏘는" 판단이 값을 하되 무한정 세지지는 않는다. */
    pierce: 2,
    pierceFalloff: 0.72,
    falloffStart: 100,     // 거리로 약해지지 않는다 — 원거리 무기다
    falloffEnd: 101,
    falloffMin: 1,
    recoil: 3.0,
  },

  // ── 보조무기 ──────────────────────────────────────────────────
  pistol: {
    id: 'pistol',
    slot: 'secondary',
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
  smg: {
    id: 'smg',
    slot: 'secondary',
    name: '기관단총',
    icon: '🧨',
    damage: 10,
    pellets: 1,
    rpm: 780,              // 눈 깜짝할 새 탄창이 빈다
    mag: 25,
    reserve: 200,
    reload: 1.6,
    spread: 4.5,
    range: 34,
    auto: true,
    falloffStart: 12,      // 조금만 멀어져도 힘이 빠진다
    falloffEnd: 34,
    falloffMin: 0.35,
    recoil: 0.5,
  },
  magnum: {
    id: 'magnum',
    slot: 'secondary',
    name: '매그넘',
    icon: '🎰',
    damage: 58,            // 크롤러 한 방, 트루퍼 두 방
    pellets: 1,
    rpm: 96,
    mag: 6,
    reserve: 48,
    reload: 2.2,           // 탄알을 하나씩 밀어 넣는 리볼버다
    spread: 1.2,
    range: 75,
    auto: false,
    falloffStart: 45,
    falloffEnd: 75,
    falloffMin: 0.6,
    recoil: 2.6,
  },

  // ── 근접무기 ──────────────────────────────────────────────────
  knife: {
    id: 'knife',
    slot: 'melee',
    name: '전투 나이프',
    icon: '🔪',
    melee: true,
    noAmmo: true,          // 탄창도 예비탄도 재장전도 없다
    damage: 46,            // 크롤러(30)는 한 방, 트루퍼(60)는 두 방
    pellets: 1,
    rpm: 96,               // 초당 1.6번
    /* 탄창도 예비탄도 0 이다. Infinity 를 넣어 "안 떨어지는 탄약"인
       척하는 대신, 탄약이라는 개념을 아예 안 쓴다는 뜻으로 0 을 둔다.
       그래서 canFire 와 consumeShot 이 noAmmo 를 반드시 봐야 하고,
       둘 중 하나라도 빠뜨리면 칼이 즉시 먹통이 된다 — 있으나 마나 한
       방어 코드가 아니라, 없으면 바로 깨지는 코드가 된다. */
    mag: 0,
    reserve: 0,
    reload: 0,
    spread: 0,
    range: 2.5,
    arc: 75,               // 부채꼴 전체 각(도)
    auto: true,            // 누르고 있으면 계속 휘두른다
    falloffStart: 2.5,     // 거리 감쇠 없음 — 닿거나 안 닿거나
    falloffEnd: 2.6,
    falloffMin: 1,
    recoil: 1.4,
  },
  axe: {
    id: 'axe',
    slot: 'melee',
    name: '전투 도끼',
    icon: '🪓',
    melee: true,
    noAmmo: true,
    damage: 95,            // 브루트(150)도 두 번이면 눕는다
    pellets: 1,
    rpm: 48,               // 나이프의 절반 속도
    mag: 0,
    reserve: 0,
    reload: 0,
    spread: 0,
    range: 2.9,            // 더 길게 닿는다
    arc: 100,              // 더 넓게 훑는다
    auto: true,
    falloffStart: 2.9,
    falloffEnd: 3.0,
    falloffMin: 1,
    recoil: 2.4,
  },
}

/* 슬롯별 무기 목록 — 한 슬롯에 여럿이 들어간다 */
export const WEAPONS_BY_SLOT = SLOTS.reduce((acc, s) => {
  acc[s] = Object.values(WEAPONS).filter((w) => w.slot === s).map((w) => w.id)
  return acc
}, {})

/* 표시 순서 — HUD 와 안내문이 같은 순서를 쓴다 */
export const WEAPON_ORDER = SLOTS.flatMap((s) => WEAPONS_BY_SLOT[s])

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

/* 재장전으로 채울 수 있는 양. 예비탄이 모자라면 있는 만큼만.
   근접무기는 채울 것이 없다. */
export function reloadAmount(weapon, ammo) {
  if (weapon.noAmmo) return 0
  const room = weapon.mag - ammo.inMag
  if (room <= 0) return 0
  if (ammo.reserve === Infinity) return room
  return Math.min(room, ammo.reserve)
}

/* 처음부터 들고 시작하는 것들. 나머지는 아레나에서 주워야 하고,
   주우러 나가는 그 순간이 이 게임의 위험 부담이다. */
export const STARTING_WEAPONS = ['pistol', 'knife']

export function initialAmmo() {
  const out = {}
  for (const id of WEAPON_ORDER) {
    const w = WEAPONS[id]
    const start = STARTING_WEAPONS.includes(id)
    out[id] = {
      inMag: w.mag,
      reserve: start ? w.reserve : 0,
      owned: start,
    }
  }
  return out
}

/* 시작 슬롯 구성 — 주무기 자리는 비어 있다 */
export function initialSlots() {
  const out = {}
  for (const s of SLOTS) {
    out[s] = STARTING_WEAPONS.find((id) => WEAPONS[id].slot === s) || null
  }
  return out
}
