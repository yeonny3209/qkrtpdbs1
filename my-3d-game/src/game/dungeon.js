/* ==================================================================
   파티 던전 · 레이드 — 순수 정의와 웨이브 생성 (테스트 가능)

   [던전 — 사용자 확정 규칙]
   5웨이브 구성: 1~3웨이브 일반 몬스터 여러 마리,
   4웨이브 엘리트 몬스터 2마리, 5웨이브 보스 몬스터.
   파티 1~6명. 몬스터 수·체력은 인원수에 비례해 늘어난다.

   [레이드 — 사용자 확정 규칙]
   강력한 단일 보스. 초급 3페이즈 / 중급 4페이즈 / 하드 5페이즈.
   파티 4~10명. 페이즈가 오를수록 기믹이 추가된다.
   ================================================================== */

/* 레벨 구간마다 1~3개씩 (사용자 확정).
   tier는 보상 등급 계산에 쓰인다 (뒤로 갈수록 후하다). */
export const DUNGEONS = [
  /* --- Lv3 (2개) --- */
  { id: 0, name: '버려진 지하실', icon: '🕯️', reqLv: 3, mob: 'rabbit', tier: 0,
    ground: '#3a3a44', sky: '#16161c', fog: [16, 52], accent: '#94a3b8',
    desc: '마을 아래 잊혀진 창고 — 첫 모험에 알맞다' },
  { id: 1, name: '이끼 낀 우물', icon: '🪣', reqLv: 3, mob: 'slime', tier: 0,
    ground: '#2f4a42', sky: '#14211d', fog: [16, 50], accent: '#5eead4',
    desc: '마을 우물 아래 슬라임이 고인 좁은 공간' },
  /* --- Lv5 (2개) --- */
  { id: 2, name: '들판 사냥터', icon: '🐗', reqLv: 5, mob: 'boar', tier: 0,
    ground: '#4f5a34', sky: '#232a17', fog: [16, 52], accent: '#b08968',
    desc: '멧돼지 떼가 몰려드는 울타리 안쪽' },
  { id: 3, name: '허물어진 사당', icon: '⛩️', reqLv: 5, mob: 'slime', tier: 1,
    ground: '#4a4436', sky: '#221f18', fog: [16, 50], accent: '#d6c48a',
    desc: '오래 전 버려진 사당 — 무언가 잠들어 있다' },
  /* --- Lv8 (3개) --- */
  { id: 4, name: '고블린 소굴', icon: '🏕️', reqLv: 8, mob: 'goblin', tier: 1,
    ground: '#2e4231', sky: '#18231b', fog: [16, 52], accent: '#8bc34a',
    desc: '고블린 무리의 본거지 — 우두머리가 도사린다' },
  { id: 5, name: '고블린 광산', icon: '⛏️', reqLv: 8, mob: 'goblin', tier: 1,
    ground: '#3b352a', sky: '#1a1712', fog: [15, 48], accent: '#a3a35c',
    desc: '고블린들이 파헤친 갱도 — 좁고 어둡다' },
  { id: 6, name: '숲의 옛 무덤', icon: '🪦', reqLv: 8, mob: 'spider', tier: 1,
    ground: '#33402f', sky: '#161c14', fog: [15, 46], accent: '#7f8c6a',
    desc: '숲 깊은 곳의 무덤 — 거미가 둥지를 텄다' },
  /* --- Lv12 (2개) --- */
  { id: 7, name: '산적 은거지', icon: '🗡️', reqLv: 12, mob: 'bandit', tier: 2,
    ground: '#4a3f30', sky: '#1f1a14', fog: [16, 50], accent: '#c08a5a',
    desc: '산적 두목이 숨어 있는 비밀 은거지' },
  { id: 8, name: '거미 여왕의 방', icon: '🕷️', reqLv: 12, mob: 'spider', tier: 2,
    ground: '#3a3542', sky: '#191620', fog: [14, 44], accent: '#8b8b9e',
    desc: '거미줄로 뒤덮인 여왕의 산실' },
  /* --- Lv16 (2개) --- */
  { id: 9, name: '늑대 협곡 심부', icon: '🐺', reqLv: 16, mob: 'wolf', tier: 2,
    ground: '#4a4238', sky: '#211d18', fog: [16, 50], accent: '#b8a88a',
    desc: '협곡 깊은 곳, 늑대왕의 사냥터' },
  { id: 10, name: '얼어붙은 골짜기', icon: '❄️', reqLv: 16, mob: 'wolf', tier: 3,
    ground: '#5a6a78', sky: '#243040', fog: [18, 56], accent: '#bae6fd',
    desc: '눈보라가 몰아치는 얼음 골짜기' },
  /* --- Lv20 (3개) --- */
  { id: 11, name: '폭포 뒤 동굴', icon: '💧', reqLv: 20, mob: 'harpy', tier: 3,
    ground: '#2f5560', sky: '#132328', fog: [16, 50], accent: '#67e8f9',
    desc: '마법의 폭포 뒤에 숨겨진 동굴' },
  { id: 12, name: '하피 절벽', icon: '🪶', reqLv: 20, mob: 'harpy', tier: 3,
    ground: '#4a4a56', sky: '#20202a', fog: [16, 52], accent: '#a5f3fc',
    desc: '하피들이 둥지를 튼 아찔한 절벽' },
  { id: 13, name: '수몰된 신전', icon: '🌊', reqLv: 20, mob: 'spider', tier: 3,
    ground: '#2a4450', sky: '#111d22', fog: [14, 44], accent: '#7dd3fc',
    desc: '물에 잠긴 고대 신전의 내부' },
  /* --- Lv26 (2개) --- */
  { id: 14, name: '화염 심장부', icon: '🌋', reqLv: 26, mob: 'imp', tier: 4,
    ground: '#4a2620', sky: '#2a1210', fog: [14, 46], accent: '#ff7043',
    desc: '용암 한가운데, 화염 군주의 옥좌' },
  { id: 15, name: '재의 회랑', icon: '🔥', reqLv: 26, mob: 'imp', tier: 4,
    ground: '#3d2b26', sky: '#1c1310', fog: [14, 44], accent: '#fb923c',
    desc: '타고 남은 재가 무릎까지 쌓인 회랑' },
  /* --- Lv30 (2개) --- */
  { id: 16, name: '석상의 무덤', icon: '🗿', reqLv: 30, mob: 'golem', tier: 4,
    ground: '#5c5e64', sky: '#26282c', fog: [16, 52], accent: '#cbd5e1',
    desc: '깨어난 석상들이 침입자를 짓누른다' },
  { id: 17, name: '무너진 채석장', icon: '🪨', reqLv: 30, mob: 'golem', tier: 5,
    ground: '#4e4a44', sky: '#211f1c', fog: [16, 50], accent: '#a8a29e',
    desc: '붕괴한 채석장 깊은 갱' },
  /* --- Lv36 (3개) --- */
  { id: 18, name: '심연의 미궁', icon: '🕳️', reqLv: 36, mob: 'wraith', tier: 5,
    ground: '#2a2438', sky: '#12101c', fog: [12, 42], accent: '#a78bfa',
    desc: '빛이 닿지 않는 미궁 — 망령의 왕이 기다린다' },
  { id: 19, name: '망령의 회랑', icon: '👻', reqLv: 36, mob: 'wraith', tier: 5,
    ground: '#26243a', sky: '#100f1a', fog: [12, 40], accent: '#c4b5fd',
    desc: '끝없이 이어지는 망령들의 복도' },
  { id: 20, name: '봉인된 지하묘', icon: '⚰️', reqLv: 36, mob: 'shade', tier: 5,
    ground: '#221c2c', sky: '#0e0b14', fog: [12, 38], accent: '#8b5cf6',
    desc: '봉인이 풀리기 시작한 지하 묘실' },
  /* --- Lv40 (2개) — 여기서부터 아티팩트가 나온다 --- */
  { id: 21, name: '그림자 심층', icon: '🌑', reqLv: 40, mob: 'shade', tier: 6,
    ground: '#1e1828', sky: '#0b0910', fog: [12, 38], accent: '#7c3aed',
    desc: '그림자가 실체를 가지는 가장 깊은 층' },
  { id: 22, name: '달빛 심연', icon: '🌘', reqLv: 40, mob: 'moonbeast', tier: 6,
    ground: '#243052', sky: '#0f1428', fog: [14, 44], accent: '#c7d2fe',
    desc: '달의 바다 아래 잠긴 심연' },
  /* --- Lv45 (2개) --- */
  { id: 23, name: '리치의 지하실', icon: '💀', reqLv: 45, mob: 'lich', tier: 7,
    ground: '#333a2a', sky: '#151810', fog: [14, 44], accent: '#a3e635',
    desc: '리치가 실험을 벌이는 비밀 지하실' },
  { id: 24, name: '뼈의 왕좌', icon: '🦴', reqLv: 45, mob: 'lich', tier: 7,
    ground: '#3e3a30', sky: '#1a1814', fog: [14, 42], accent: '#e7e5e4',
    desc: '수많은 뼈로 쌓아올린 왕좌의 방' },
  /* --- Lv48 (3개) --- */
  { id: 25, name: '용의 둥지 심층', icon: '🐲', reqLv: 48, mob: 'drake', tier: 8,
    ground: '#4a2c34', sky: '#241419', fog: [12, 44], accent: '#f43f5e',
    desc: '어린 용들의 둥지 가장 깊은 곳' },
  { id: 26, name: '용암 산란장', icon: '🥚', reqLv: 48, mob: 'drake', tier: 8,
    ground: '#52281f', sky: '#26120c', fog: [12, 42], accent: '#fb7185',
    desc: '용의 알이 용암에 반쯤 잠겨 있다' },
  { id: 27, name: '고룡의 안식처', icon: '🐉', reqLv: 48, mob: 'drake', tier: 9,
    ground: '#3a2230', sky: '#1a0f18', fog: [12, 40], accent: '#e879f9',
    desc: '가장 오래된 용이 잠든 최심부' },
]
export const DUNGEON_BY_ID = Object.fromEntries(DUNGEONS.map((d) => [d.id, d]))

export const DG_WAVES = 5          // 총 웨이브 수
export const DG_HALF = 17          // 던전 맵 반경

/* 웨이브별 스폰 명세.
   반환: [{ rank: 'normal'|'elite'|'boss', hpMul, dmgMul, scale }]
   좌표는 호출자(파티장)가 정한다 — 여기는 규칙만. */
export function dungeonWave(wave, partySize) {
  const n = Math.max(1, Math.min(6, partySize))
  const partyHp = 1 + 0.4 * (n - 1)          // 인원 비례 체력
  if (wave <= 3) {
    const count = 3 + wave + Math.ceil(n / 2)
    return Array.from({ length: count }, () => ({
      rank: 'normal',
      hpMul: (1 + 0.25 * (wave - 1)) * partyHp,
      dmgMul: 1 + 0.15 * (wave - 1),
      scale: 1,
    }))
  }
  if (wave === 4) {
    /* 엘리트 2마리 — 사용자 확정 */
    return [0, 1].map(() => ({ rank: 'elite', hpMul: 5.5 * partyHp, dmgMul: 2.1, scale: 1.55 }))
  }
  /* 5웨이브 — 보스 1마리 */
  return [{ rank: 'boss', hpMul: 16 * partyHp, dmgMul: 2.8, scale: 2.3 }]
}

/* 웨이브 클리어 보상 — 파티 전원에게 동일 지급 (협동 콘텐츠) */
export function dungeonWaveReward(dungeonId, wave) {
  const base = [0, 340, 480, 640, 1100, 2400][wave] || 0     // 경험치
  const goldBase = [0, 30, 42, 56, 100, 220][wave] || 0
  const t = DUNGEON_BY_ID[dungeonId] ? DUNGEON_BY_ID[dungeonId].tier : dungeonId
  const mul = 1 + t * 1.6                                    // 상위 던전일수록 후하게
  return { exp: Math.round(base * mul), gold: Math.round(goldBase * mul) }
}

/* ==================================================================
   레이드 — 심연의 군주 + 30종 추가 레이드
   ================================================================== */
/* 초급은 메인 퀘스트 도중(레벨 10 이전)에 체험할 수 있어야 하므로 문턱을 낮게 둔다.
   중급·하드는 그 뒤의 성장 목표다.

   추가 30종의 체력·공격력·보상은 이 세 기준점(Lv5→12000, Lv25→90000, Lv45→240000 등)을
   그대로 지나는 2차 함수로 계산한다 — 레벨대가 올라갈수록 매끄럽게 강해지고,
   기존 세 레이드와 이어 붙여도 성장 곡선이 끊기지 않는다. */
const raidHpAt = (lv) => 90 * lv * lv + 1200 * lv + 3750
const raidDmgAt = (lv) => -0.005 * lv * lv + 1.8 * lv + 13.125
const raidGoldAt = (lv) => 10.75 * lv * lv - 102.5 * lv + 2843.75
const raidExpAt = (lv) => 182.5 * lv * lv - 2275 * lv + 32812.5
const raidPhasesAt = (lv) => (lv < 20 ? 3 : lv < 40 ? 4 : 5)
const raidGradeMaxAt = (lv) => (lv >= 25 ? 5 : 4)

/* 레벨 구간마다 3종씩(사용자 확정 취지 — 던전처럼 골고루) — 이름·아이콘·색만 다르고
   같은 구간이면 강함은 동일하다 (구간이 오르면 공식에 따라 확실히 더 강해진다). */
const EXTRA_RAID_BANDS = [8, 12, 16, 20, 30, 35, 40, 48, 54, 58]
const EXTRA_RAID_FLAVOR = [
  ['늪지 히드라의 굴', '🐍', '#4ade80'], ['안개 낀 폐허', '🌫️', '#94a3b8'], ['불타는 전차의 무덤', '🔥', '#f97316'],
  ['얼어붙은 왕좌', '❄️', '#7dd3fc'], ['가시 정원', '🌵', '#84cc16'], ['잊혀진 등대', '🏮', '#fbbf24'],
  ['핏빛 콜로세움', '🩸', '#dc2626'], ['균열의 협곡', '⚡', '#a78bfa'], ['모래바다의 스핑크스', '🏜️', '#eab308'],
  ['철갑 요새', '⚙️', '#64748b'], ['악몽의 온실', '🥀', '#c026d3'], ['달빛 늑대의 소굴', '🌕', '#e2e8f0'],
  ['불꽃 도가니', '🔨', '#ea580c'], ['수정 동굴', '💎', '#38bdf8'], ['타락한 성소', '⛪', '#7c3aed'],
  ['폭풍의 첨탑', '🌪️', '#0ea5e9'], ['해골 군단의 진지', '☠️', '#d4d4d8'], ['용암 협곡', '🌋', '#ef4444'],
  ['그림자 회랑', '🌑', '#6d28d9'], ['천공의 파편', '☁️', '#93c5fd'], ['심해의 제단', '🐙', '#0891b2'],
  ['불사조의 둥지', '🔥', '#fb923c'], ['백골의 사막', '🦴', '#e7e5e4'], ['거울 미궁', '🪞', '#f0abfc'],
  ['천둥새 봉우리', '🐦', '#facc15'], ['악령의 성채', '👹', '#991b1b'], ['별빛 폐허', '✨', '#818cf8'],
  ['혼돈의 균열', '🌀', '#db2777'], ['종언의 제단', '⚰️', '#312e81'], ['태초의 어둠', '🕳️', '#020617'],
]

/* 기존 세 레이드 + 추가 30종을 한데 모아 레벨순으로 정렬한다.
   (레벨대가 뒤섞이면 "올라갈수록 강해진다"는 규칙이 깨진다) */
const RAID_UNSORTED = [
  { name: '초급 레이드', phases: 3, reqLv: 5, icon: '🌑',
    hp: 12000, dmg: 22, color: '#7c6cd6', gold: 2600, exp: 26000, gradeMax: 4 },
  { name: '중급 레이드', phases: 4, reqLv: 25, icon: '🌘',
    hp: 90000, dmg: 55, color: '#a052d6', gold: 7000, exp: 90000, gradeMax: 5 },
  { name: '하드 레이드', phases: 5, reqLv: 45, icon: '🌒',
    hp: 240000, dmg: 84, color: '#e0409a', gold: 20000, exp: 300000, gradeMax: 5 },
  ...EXTRA_RAID_BANDS.flatMap((lv, bi) => [0, 1, 2].map((k) => {
    const [name, icon, color] = EXTRA_RAID_FLAVOR[bi * 3 + k]
    return {
      name, icon, color, reqLv: lv,
      phases: raidPhasesAt(lv), gradeMax: raidGradeMaxAt(lv),
      hp: Math.round(raidHpAt(lv)), dmg: Math.round(raidDmgAt(lv)),
      gold: Math.round(raidGoldAt(lv)), exp: Math.round(raidExpAt(lv)),
    }
  })),
]
export const RAID_DIFFS = RAID_UNSORTED
  .sort((a, b) => a.reqLv - b.reqLv)
  .map((r, i) => ({ id: i, ...r }))
export const RAID_BY_ID = Object.fromEntries(RAID_DIFFS.map((r) => [r.id, r]))
export const RAID_HALF = 21        // 레이드 맵 반경
export const RAID_BOSS_ID = 9999   // 보스의 고정 몹 id

/* 인원 비례 보스 체력 (4명 기준 1.0, 10명이면 2.2배) */
export const raidBossHp = (diff, partySize) =>
  Math.round(diff.hp * (1 + 0.2 * (Math.max(4, Math.min(10, partySize)) - 4)))

/* ---- 솔로 레이드(사용자 확정) ----
   혼자 들어가는 대신 보스가 약해진다. 파티 인원 보정(위 함수)은 아예 적용하지 않고,
   기준 체력·공격력에 이 배율만 곱한다. */
export const SOLO_RAID_HP_MUL = 0.42
export const SOLO_RAID_DMG_MUL = 0.7
export const soloRaidBossHp = (diff) => Math.round(diff.hp * SOLO_RAID_HP_MUL)
export const soloRaidDmg = (diff) => Math.round(diff.dmg * SOLO_RAID_DMG_MUL)

/* 현재 HP 비율 → 페이즈 (1부터). 페이즈 수만큼 균등 분할.
   예: 3페이즈면 100~67% P1, 67~33% P2, 33~0% P3 */
export function raidPhase(hpRatio, phases) {
  const r = Math.max(0, Math.min(1, hpRatio))
  const p = phases - Math.min(phases - 1, Math.floor(r * phases))
  return p
}

/* 페이즈별 활성 기믹 — 페이즈가 오를수록 누적된다.
   slam: 내려찍기 광역   volley: 투사체 일제사격
   adds: 부하 소환       zones: 화염 장판     enrage: 광폭화 */
export function raidMechanics(phase) {
  return {
    slam: true,
    volley: phase >= 2,
    adds: phase >= 3,
    zones: phase >= 4,
    enrage: phase >= 5,
  }
}
