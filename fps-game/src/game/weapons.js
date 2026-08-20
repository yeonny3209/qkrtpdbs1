/* ==================================================================
   무기

   슬롯 셋으로 나뉜다 — 주무기 · 보조무기 · 근접무기. 슬롯이 곧
   역할이라, 숫자키 1·2·3 이 언제나 같은 성격의 무기를 꺼낸다.
   손이 기억하는 것은 무기 이름이 아니라 "지금 뭐가 필요한가"다.

   스물한 자루가 있다. 수치만 조금씩 다른 총을 늘리면 고를 것이
   많아지는 게 아니라 고르기 귀찮아질 뿐이라, 방아쇠를 당겼을 때
   벌어지는 일 자체를 다섯 갈래로 나눴다.

     · 단발/연사   방아쇠 한 번에 한 발. 가장 흔한 것.
     · 점사(burst) 한 번에 정해진 발수가 나간다. 누르는 박자가 다르다.
     · 예열(spin)  누르고 있으면 점점 빨라진다. 미리 돌려 두는 판단.
     · 차지(charge)누르고 있다가 놓는다. 언제 놓을지가 실력이 된다.
     · 근접        부채꼴 안을 벤다. 탄약이 없다.

   총은 전부 히트스캔이다 — 방아쇠를 당긴 프레임에 광선을 쏴서 즉시
   맞았는지 정한다. 투사체를 날리면 프레임 사이를 건너뛰어 얇은 적을
   통과하는 문제(터널링)를 따로 풀어야 하는데, 이 교전 거리에서 총알
   비행시간은 어차피 체감되지 않는다.

   두 가지만 예외다.
     · 근접무기 — 광선 하나로는 발밑의 크롤러를 자꾸 놓친다.
       부채꼴 안을 통째로 벤다. (combat.meleeSwing)
     · 관통 — 저격총·레일건은 첫 적에서 멈추지 않고 뒤까지 꿰뚫는다.
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

/* 발사 방식 — 로비에서 이 이름으로 성격을 미리 알려 준다 */
export const FIRE_MODE_LABEL = {
  single: '단발',
  auto: '연사',
  burst: '점사',
  spin: '예열',
  charge: '차지',
  melee: '근접',
}

export function fireMode(w) {
  if (w.melee) return 'melee'
  if (w.charge) return 'charge'
  if (w.spinUp) return 'spin'
  if (w.burst) return 'burst'
  return w.auto ? 'auto' : 'single'
}

export const WEAPONS = {
  // ══════════════════ 주무기 ══════════════════
  carbine: {
    id: 'carbine', slot: 'primary', name: '카빈', icon: '🔫',
    blurb: '가볍고 정확하다. 한 발은 가볍지만 잘 맞는다',
    damage: 12, pellets: 1, rpm: 600, mag: 24, reserve: 168, reload: 1.7,
    spread: 1.8, range: 68, auto: true,
    falloffStart: 34, falloffEnd: 68, falloffMin: 0.62, recoil: 0.42,
  },
  rifle: {
    id: 'rifle', slot: 'primary', name: '돌격소총', icon: '🔩',
    blurb: '두루 쓴다. 답이 애매할 때의 답',
    damage: 15, pellets: 1, rpm: 480, mag: 30, reserve: 180, reload: 2.0,
    spread: 3.0, range: 70, auto: true,
    falloffStart: 30, falloffEnd: 70, falloffMin: 0.6, recoil: 0.55,
  },
  battle: {
    id: 'battle', slot: 'primary', name: '배틀라이플', icon: '🎖️',
    blurb: '3점사. 한 번 누를 때마다 묵직한 세 발',
    damage: 26, pellets: 1, rpm: 700, mag: 21, reserve: 147, reload: 2.3,
    spread: 1.5, range: 80, auto: false,
    /* 점사 — 한 번 누르면 burst 발이 burstGap 간격으로 나가고,
       그 뒤 burstRest 만큼 쉰다. 연사보다 박자가 또렷하다. */
    burst: 3, burstGap: 0.075, burstRest: 0.34,
    falloffStart: 40, falloffEnd: 80, falloffMin: 0.66, recoil: 1.1,
  },
  shotgun: {
    id: 'shotgun', slot: 'primary', name: '샷건', icon: '💥',
    blurb: '코앞에서 압도적. 멀면 거의 무의미하다',
    damage: 7.5, pellets: 8, rpm: 72, mag: 6, reserve: 36, reload: 2.5,
    spread: 12.0, range: 28, auto: false,
    falloffStart: 8, falloffEnd: 28, falloffMin: 0.2, recoil: 2.2,
  },
  autoshotgun: {
    id: 'autoshotgun', slot: 'primary', name: '자동샷건', icon: '🌪️',
    blurb: '샷건인데 연사된다. 한 발의 무게는 덜하다',
    damage: 6, pellets: 6, rpm: 180, mag: 10, reserve: 60, reload: 3.0,
    spread: 9.0, range: 26, auto: true,
    falloffStart: 8, falloffEnd: 26, falloffMin: 0.24, recoil: 1.5,
  },
  lmg: {
    id: 'lmg', slot: 'primary', name: '경기관총', icon: '⛓️',
    blurb: '탄창 100발. 무리를 눕히되 정밀함은 버린다',
    damage: 13, pellets: 1, rpm: 700, mag: 100, reserve: 300, reload: 4.2,
    spread: 5.5, range: 60, auto: true,
    falloffStart: 22, falloffEnd: 60, falloffMin: 0.5, recoil: 0.75,
  },
  minigun: {
    id: 'minigun', slot: 'primary', name: '미니건', icon: '🌀',
    blurb: '돌기 시작하면 멈출 수 없다. 다만 도는 데 시간이 걸린다',
    damage: 11, pellets: 1, rpm: 1200, mag: 200, reserve: 400, reload: 5.5,
    spread: 6.5, range: 55, auto: true,
    /* 예열 — 누르고 있으면 spinUp 초에 걸쳐 최대 연사에 이른다.
       손을 떼면 spinDown 초에 걸쳐 식는다. 미리 돌려 두는 판단이
       생기는 게 이 무기의 전부다. */
    spinUp: 1.15, spinDown: 0.8, spinMin: 0.28,
    falloffStart: 18, falloffEnd: 55, falloffMin: 0.45, recoil: 0.5,
  },
  sniper: {
    id: 'sniper', slot: 'primary', name: '대물 저격총', icon: '🎯',
    blurb: '한 발이 크고, 줄지어 선 셋까지 꿰뚫는다',
    damage: 120, pellets: 1, rpm: 50, mag: 5, reserve: 40, reload: 3.2,
    spread: 0, range: 100, auto: false,
    pierce: 2, pierceFalloff: 0.72,
    falloffStart: 100, falloffEnd: 101, falloffMin: 1, recoil: 3.0,
  },
  railgun: {
    id: 'railgun', slot: 'primary', name: '레일건', icon: '⚡',
    blurb: '눌러 모았다가 놓는다. 다 모으면 한 줄을 통째로 지운다',
    damage: 70, pellets: 1, rpm: 40, mag: 4, reserve: 24, reload: 3.6,
    spread: 0, range: 120, auto: false,
    /* 차지 — 누르고 있으면 charge 초에 걸쳐 배율이 1 → chargeMax.
       chargeMin 만큼도 안 모으고 놓으면 안 나간다(오발 방지). */
    charge: 1.15, chargeMax: 3.4, chargeMin: 0.18,
    pierce: 99, pierceFalloff: 0.88,
    falloffStart: 120, falloffEnd: 121, falloffMin: 1, recoil: 3.4,
  },

  // ══════════════════ 보조무기 ══════════════════
  pistol: {
    id: 'pistol', slot: 'secondary', name: '권총', icon: '🔫',
    blurb: '예비탄 무한. 모든 게 떨어졌을 때 남는 것',
    damage: 22, pellets: 1, rpm: 180, mag: 12, reserve: Infinity, reload: 1.0,
    spread: 1.0, range: 80, auto: false,
    falloffStart: 40, falloffEnd: 80, falloffMin: 0.55, recoil: 0.9,
  },
  silenced: {
    id: 'silenced', slot: 'secondary', name: '소음권총', icon: '🤫',
    blurb: '조용하고 거의 안 흔들린다. 침착하게 맞히는 총',
    damage: 20, pellets: 1, rpm: 220, mag: 15, reserve: 150, reload: 1.2,
    spread: 0.35, range: 85, auto: false,
    falloffStart: 45, falloffEnd: 85, falloffMin: 0.6, recoil: 0.3,
  },
  burstpistol: {
    id: 'burstpistol', slot: 'secondary', name: '점사권총', icon: '📌',
    blurb: '3점사. 한 번 누르면 세 발이 나간다',
    damage: 16, pellets: 1, rpm: 800, mag: 18, reserve: 144, reload: 1.4,
    spread: 1.6, range: 60, auto: false,
    burst: 3, burstGap: 0.06, burstRest: 0.28,
    falloffStart: 26, falloffEnd: 60, falloffMin: 0.5, recoil: 0.7,
  },
  magnum: {
    id: 'magnum', slot: 'secondary', name: '매그넘', icon: '🎰',
    blurb: '여섯 발뿐이지만 한 발이 무겁다',
    damage: 58, pellets: 1, rpm: 96, mag: 6, reserve: 48, reload: 2.2,
    spread: 1.2, range: 75, auto: false,
    falloffStart: 45, falloffEnd: 75, falloffMin: 0.6, recoil: 2.6,
  },
  dualpistol: {
    id: 'dualpistol', slot: 'secondary', name: '쌍권총', icon: '✌️',
    blurb: '양손에 하나씩. 두 배로 쏟아붓고 두 배로 빨리 빈다',
    damage: 19, pellets: 1, rpm: 420, mag: 24, reserve: 168, reload: 2.0,
    spread: 3.2, range: 55, auto: true,
    falloffStart: 22, falloffEnd: 55, falloffMin: 0.45, recoil: 0.6,
  },
  smg: {
    id: 'smg', slot: 'secondary', name: '기관단총', icon: '🧨',
    blurb: '근거리 속사. 조금만 멀어도 힘이 없다',
    damage: 10, pellets: 1, rpm: 780, mag: 25, reserve: 200, reload: 1.6,
    spread: 4.5, range: 34, auto: true,
    falloffStart: 12, falloffEnd: 34, falloffMin: 0.35, recoil: 0.5,
  },
  machinepistol: {
    id: 'machinepistol', slot: 'secondary', name: '자동권총', icon: '💨',
    blurb: '눈 깜짝할 새 탄창이 빈다. 코앞에서만 쓸 것',
    damage: 8, pellets: 1, rpm: 950, mag: 20, reserve: 180, reload: 1.5,
    spread: 6.5, range: 26, auto: true,
    falloffStart: 9, falloffEnd: 26, falloffMin: 0.3, recoil: 0.45,
  },

  // ══════════════════ 근접무기 ══════════════════
  /* 탄창도 예비탄도 0 이다. Infinity 를 넣어 "안 떨어지는 탄약"인
     척하는 대신, 탄약이라는 개념을 아예 안 쓴다는 뜻으로 0 을 둔다.
     그래서 canFire 와 consumeShot 이 noAmmo 를 반드시 봐야 하고,
     둘 중 하나라도 빠뜨리면 즉시 먹통이 된다 — 있으나 마나 한
     방어 코드가 아니라, 없으면 바로 깨지는 코드가 된다. */
  knife: {
    id: 'knife', slot: 'melee', name: '전투 나이프', icon: '🔪',
    blurb: '빠르다. 크롤러는 한 방',
    melee: true, noAmmo: true,
    damage: 46, pellets: 1, rpm: 96, mag: 0, reserve: 0, reload: 0,
    spread: 0, range: 2.5, arc: 75, auto: true,
    falloffStart: 2.5, falloffEnd: 2.6, falloffMin: 1, recoil: 1.4,
  },
  katana: {
    id: 'katana', slot: 'melee', name: '카타나', icon: '⚔️',
    blurb: '멀리서부터 벤다. 빠르기와 길이를 함께 가진다',
    melee: true, noAmmo: true,
    damage: 62, pellets: 1, rpm: 78, mag: 0, reserve: 0, reload: 0,
    spread: 0, range: 3.2, arc: 95, auto: true,
    falloffStart: 3.2, falloffEnd: 3.3, falloffMin: 1, recoil: 1.7,
  },
  pipe: {
    id: 'pipe', slot: 'melee', name: '쇠파이프', icon: '🪈',
    blurb: '어디서 주웠는지 모를 쇳덩이. 무난하게 아프다',
    melee: true, noAmmo: true,
    damage: 58, pellets: 1, rpm: 84, mag: 0, reserve: 0, reload: 0,
    spread: 0, range: 2.7, arc: 85, auto: true,
    falloffStart: 2.7, falloffEnd: 2.8, falloffMin: 1, recoil: 1.9,
  },
  axe: {
    id: 'axe', slot: 'melee', name: '전투 도끼', icon: '🪓',
    blurb: '느리고 크게 벤다. 브루트도 두 방',
    melee: true, noAmmo: true,
    damage: 95, pellets: 1, rpm: 48, mag: 0, reserve: 0, reload: 0,
    spread: 0, range: 2.9, arc: 100, auto: true,
    falloffStart: 2.9, falloffEnd: 3.0, falloffMin: 1, recoil: 2.4,
  },
  hammer: {
    id: 'hammer', slot: 'melee', name: '대형 망치', icon: '🔨',
    blurb: '아주 느리다. 대신 닿는 것은 전부 한 번에 눕는다',
    melee: true, noAmmo: true,
    damage: 132, pellets: 1, rpm: 34, mag: 0, reserve: 0, reload: 0,
    spread: 0, range: 3.0, arc: 120, auto: true,
    falloffStart: 3.0, falloffEnd: 3.1, falloffMin: 1, recoil: 3.2,
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
   나눗셈해야 해서, 여기서 한 번만 바꾼다.

   예열 무기는 지금 회전수(spin 0..1)에 따라 간격이 줄어든다. */
export function shotInterval(weapon, spin = 1) {
  if (!weapon.spinUp) return 60 / weapon.rpm
  const frac = weapon.spinMin + (1 - weapon.spinMin) * Math.max(0, Math.min(1, spin))
  return 60 / (weapon.rpm * frac)
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

/* 차지 배율 — 0 이면 1배, 다 모으면 chargeMax 배 */
export function chargeMultiplier(weapon, charge) {
  if (!weapon.charge) return 1
  const c = Math.max(0, Math.min(1, charge))
  return 1 + (weapon.chargeMax - 1) * c
}

/* 로비에서 고른 것으로 시작한다. 아무것도 안 고르면 이 기본값. */
export const DEFAULT_LOADOUT = { primary: 'rifle', secondary: 'pistol', melee: 'knife' }

/* 고른 무기가 진짜 그 슬롯의 무기인지 확인해 정리한다.
   저장된 값이 낡았거나 손으로 건드렸을 때 게임이 안 깨지게 한다. */
export function normalizeLoadout(loadout = {}) {
  const out = {}
  for (const slot of SLOTS) {
    const id = loadout[slot]
    out[slot] = (WEAPONS[id] && WEAPONS[id].slot === slot) ? id : DEFAULT_LOADOUT[slot]
  }
  return out
}

export function initialAmmo(loadout = DEFAULT_LOADOUT) {
  const picked = new Set(Object.values(normalizeLoadout(loadout)))
  const out = {}
  for (const id of WEAPON_ORDER) {
    const w = WEAPONS[id]
    const start = picked.has(id)
    out[id] = { inMag: w.mag, reserve: start ? w.reserve : 0, owned: start }
  }
  return out
}

export function initialSlots(loadout = DEFAULT_LOADOUT) {
  return normalizeLoadout(loadout)
}
