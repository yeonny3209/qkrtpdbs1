/* ==================================================================
   룬 시스템 (기획서 4.4)

   드래곤당 딱 1개만 장착한다. 등급이 스탯 증가율을, 능력이 전투 중
   특수 효과를 담당한다.

   등급별 드롭 층 (무한의 탑)
     커먼    50~60층    +5%
     레어    60~70층    +10%
     에픽    70~85층    +15%
     레전더리 85층 이상  +25%

   능력 8종은 전부 battle.js 가 실제로 읽어서 동작한다. 여기서
   정의만 하고 전투가 무시하면 "설명만 있는 장식"이 되므로,
   각 능력에 battle 쪽에서 조회할 키(effect)를 반드시 붙인다.
   ================================================================== */
export const RUNE_GRADES = [
  { id: 'common', name: '커먼', color: '#4ade80', statMul: 0.05, floor: [50, 60] },
  { id: 'rare', name: '레어', color: '#38bdf8', statMul: 0.10, floor: [60, 70] },
  { id: 'epic', name: '에픽', color: '#c084fc', statMul: 0.15, floor: [70, 85] },
  { id: 'legendary', name: '레전더리', color: '#fbbf24', statMul: 0.25, floor: [85, 500] },
]
export const RUNE_GRADE_BY_ID = Object.fromEntries(RUNE_GRADES.map((g) => [g.id, g]))
export const RUNE_GRADE_IDS = RUNE_GRADES.map((g) => g.id)
export const runeGradeRank = (id) => RUNE_GRADE_IDS.indexOf(id)

/* 첫 룬이 나오는 층 */
export const RUNE_FIRST_FLOOR = 50

/* ---------------- 능력 8종 (기획서 예시 그대로) ----------------
   value 는 커먼 기준이고, 등급이 오르면 scale 배로 커진다. */
export const RUNE_ABILITIES = [
  { id: 'critDmg', icon: '⚔', name: '공격 강화 룬', effect: 'critDmg',
    value: 0.30, desc: (v) => `크리티컬 데미지 +${Math.round(v * 100)}%` },
  { id: 'regen', icon: '🌿', name: '재생 룬', effect: 'regen',
    value: 0.05, desc: (v) => `매 턴 최대 HP의 ${Math.round(v * 100)}% 회복` },
  { id: 'counter', icon: '↩', name: '반격 룬', effect: 'counter',
    value: 0.30, desc: (v) => `피격 시 ${Math.round(v * 100)}% 확률로 반격` },
  { id: 'haste', icon: '💨', name: '가속 룬', effect: 'haste',
    value: 0.30, desc: (v) => `전투 시작 시 AGI +${Math.round(v * 100)}%` },
  { id: 'guard', icon: '🛡', name: '보호 룬', effect: 'guard',
    value: 0.15, desc: (v) => `받는 데미지 -${Math.round(v * 100)}%` },
  { id: 'drain', icon: '🩸', name: '흡혈 룬', effect: 'drain',
    value: 0.20, desc: (v) => `준 데미지의 ${Math.round(v * 100)}% 회복` },
  { id: 'dodge', icon: '🌀', name: '회피 룬', effect: 'dodge',
    value: 0.25, desc: (v) => `회피율 +${Math.round(v * 100)}%` },
  { id: 'curse', icon: '💀', name: '저주 룬', effect: 'curse',
    value: 0.20, desc: (v) => `상대방 방어력 -${Math.round(v * 100)}%` },
]
export const ABILITY_BY_ID = Object.fromEntries(RUNE_ABILITIES.map((a) => [a.id, a]))

/* 등급이 오르면 능력 수치도 함께 오른다.
   커먼 1.0 → 레전더리 1.6. 스탯만 오르고 능력은 그대로면
   높은 등급 룬을 노릴 이유가 절반밖에 안 생긴다. */
export const abilityScale = (gradeId) => 1 + runeGradeRank(gradeId) * 0.2

export function runeInfo(rune) {
  if (!rune) return null
  const grade = RUNE_GRADE_BY_ID[rune.grade]
  const ability = ABILITY_BY_ID[rune.ability]
  const value = Number((ability.value * abilityScale(rune.grade)).toFixed(3))
  return {
    grade,
    ability,
    value,
    statMul: grade.statMul,
    name: ability.name,
    icon: ability.icon,
    desc: ability.desc(value),
  }
}

/* 층수에 맞는 룬 등급. 50층 미만은 안 나온다. */
export function runeGradeForFloor(floor) {
  if (floor < RUNE_FIRST_FLOOR) return null
  /* 뒤에서부터 찾아야 85층 이상이 레전더리로 잡힌다 */
  for (let i = RUNE_GRADES.length - 1; i >= 0; i--) {
    if (floor >= RUNE_GRADES[i].floor[0]) return RUNE_GRADES[i].id
  }
  return 'common'
}

export function rollRune(rng, gradeId) {
  const ability = RUNE_ABILITIES[Math.floor(rng() * RUNE_ABILITIES.length)]
  return {
    uid: `r${Math.floor(rng() * 0xffffffff).toString(36)}${Date.now().toString(36).slice(-4)}`,
    grade: gradeId,
    ability: ability.id,
  }
}

/* 전투가 조회하는 값 — 장착한 룬이 그 능력이면 수치를, 아니면 0 */
export function runeEffect(rune, effect) {
  const info = runeInfo(rune)
  if (!info || info.ability.effect !== effect) return 0
  return info.value
}
export const runeStatMul = (rune) => (rune ? RUNE_GRADE_BY_ID[rune.grade].statMul : 0)

/* 분해 — 되돌려받는 진화석 */
export const salvageStones = (rune) => 10 + runeGradeRank(rune.grade) * 15
