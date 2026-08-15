/* ==================================================================
   무기

   슬롯 셋으로 나뉜다 — 주무기 · 보조무기 · 근접무기. 슬롯이 곧
   역할이라, 숫자키 1·2·3 이 언제나 같은 성격의 무기를 꺼낸다.
   손이 기억하는 것은 무기 이름이 아니라 "지금 뭐가 필요한가"다.

     · 주무기(1)   화력. 탄을 먹는다. 주워야 생긴다.
                   돌격소총과 샷건이 이 자리를 나눠 쓴다 — 둘 다
                   가지고 있으면 1 을 다시 눌러 번갈아 꺼낸다.
     · 보조무기(2) 권총. 탄이 무한해서 최후의 보루가 된다.
     · 근접무기(3) 나이프. 탄이 아예 없고 코앞에서만 닿는다.

   총은 전부 히트스캔이다 — 방아쇠를 당긴 프레임에 광선을 쏴서 즉시
   맞았는지 정한다. 투사체를 실제로 날리면 프레임 사이를 건너뛰어
   얇은 적을 통과하는 문제(터널링)를 따로 풀어야 하는데, 이 정도
   교전 거리에서 총알 비행시간은 어차피 체감되지 않는다.

   근접무기만 다르다. 광선 하나로는 코앞의 적을 자꾸 놓친다 — 크롤러가
   발밑까지 붙으면 조준선이 그 위를 지나간다. 그래서 부채꼴 안에 있는
   것을 전부 벤다. 자세한 건 combat.meleeSwing 에 적어 두었다.
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
}

/* 슬롯별 무기 목록 — 주무기처럼 한 슬롯에 여럿인 경우가 있다 */
export const WEAPONS_BY_SLOT = SLOTS.reduce((acc, s) => {
  acc[s] = Object.values(WEAPONS).filter((w) => w.slot === s).map((w) => w.id)
  return acc
}, {})

/* 표시 순서 — HUD 와 안내문이 같은 순서를 쓴다 */
export const WEAPON_ORDER = ['rifle', 'shotgun', 'pistol', 'knife']

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

/* 무기별 시작 탄약 상태.

   권총과 나이프만 들고 시작한다. 주무기는 아레나에서 주워야 하고,
   주우러 나가는 그 순간이 이 게임의 위험 부담이다. */
export function initialAmmo() {
  const out = {}
  for (const id of WEAPON_ORDER) {
    const w = WEAPONS[id]
    const start = id === 'pistol' || id === 'knife'
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
  return { primary: null, secondary: 'pistol', melee: 'knife' }
}
