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

/* 레벨 구간마다 하나씩 — 사냥터(MAPS)의 요구 레벨과 짝을 맞춘다.
   tier는 보상 등급 계산에 쓰인다 (뒤로 갈수록 후하다). */
export const DUNGEONS = [
  { id: 0, name: '버려진 지하실', icon: '🕯️', reqLv: 3, mob: 'rabbit', tier: 0,
    ground: '#3a3a44', sky: '#16161c', fog: [16, 52], accent: '#94a3b8',
    desc: '마을 아래 잊혀진 창고 — 첫 모험에 알맞다' },
  { id: 1, name: '고블린 소굴', icon: '🏕️', reqLv: 8, mob: 'goblin', tier: 1,
    ground: '#2e4231', sky: '#18231b', fog: [16, 52], accent: '#8bc34a',
    desc: '고블린 무리의 본거지 — 우두머리가 도사린다' },
  { id: 2, name: '늑대 협곡 심부', icon: '🐺', reqLv: 16, mob: 'wolf', tier: 2,
    ground: '#4a4238', sky: '#211d18', fog: [16, 50], accent: '#b8a88a',
    desc: '협곡 깊은 곳, 늑대왕의 사냥터' },
  { id: 3, name: '화염 심장부', icon: '🌋', reqLv: 26, mob: 'imp', tier: 3,
    ground: '#4a2620', sky: '#2a1210', fog: [14, 46], accent: '#ff7043',
    desc: '용암 한가운데, 화염 군주의 옥좌' },
  { id: 4, name: '심연의 미궁', icon: '🕳️', reqLv: 36, mob: 'wraith', tier: 4,
    ground: '#2a2438', sky: '#12101c', fog: [12, 42], accent: '#a78bfa',
    desc: '빛이 닿지 않는 미궁 — 망령의 왕이 기다린다' },
  { id: 5, name: '용의 둥지 심층', icon: '🐲', reqLv: 48, mob: 'drake', tier: 5,
    ground: '#4a2c34', sky: '#241419', fog: [12, 44], accent: '#f43f5e',
    desc: '어린 용들의 둥지 가장 깊은 곳' },
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
   레이드 — 심연의 군주
   ================================================================== */
/* 초급은 메인 퀘스트 도중(레벨 10 이전)에 체험할 수 있어야 하므로 문턱을 낮게 둔다.
   중급·하드는 그 뒤의 성장 목표다. */
export const RAID_DIFFS = [
  { id: 0, name: '초급 레이드', phases: 3, reqLv: 5, icon: '🌑',
    hp: 12000, dmg: 22, color: '#7c6cd6', gold: 2600, exp: 26000, gradeMax: 4 },
  { id: 1, name: '중급 레이드', phases: 4, reqLv: 25, icon: '🌘',
    hp: 90000, dmg: 55, color: '#a052d6', gold: 7000, exp: 90000, gradeMax: 5 },
  { id: 2, name: '하드 레이드', phases: 5, reqLv: 45, icon: '🌒',
    hp: 240000, dmg: 84, color: '#e0409a', gold: 20000, exp: 300000, gradeMax: 5 },
]
export const RAID_BY_ID = Object.fromEntries(RAID_DIFFS.map((r) => [r.id, r]))
export const RAID_HALF = 21        // 레이드 맵 반경
export const RAID_BOSS_ID = 9999   // 보스의 고정 몹 id

/* 인원 비례 보스 체력 (4명 기준 1.0, 10명이면 2.2배) */
export const raidBossHp = (diff, partySize) =>
  Math.round(diff.hp * (1 + 0.2 * (Math.max(4, Math.min(10, partySize)) - 4)))

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
