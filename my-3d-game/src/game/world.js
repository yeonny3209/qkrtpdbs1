/* ==================================================================
   세계 — 몬스터 종류와 사냥터(맵)

   히든 직업 전직 장소가 맵으로 들어 있다 (사용자 확정):
     마법의 폭포 — 폭포 안으로 들어가면 마검사
     엘프의 숲   — 요정 10마리를 모으면 요정술사 (마법사 전직관에서 완료)
     어둠의 제단 — 도적으로 PVP 한방 5번 뒤 제사를 드리면 어둠의 암살자
     달의 바다   — 달의 사제로 달조각 1000개 뒤 구덩이에서 스킬 3개 사용
   ================================================================== */

export const MOB_TYPES = {
  /* name, lv, hp, dmg, exp, gold, spd, aggro, color, range, cool, windup */
  rabbit: { name: '토끼', lv: 1, hp: 22, dmg: 0, exp: 60, gold: 6, spd: 0, aggro: false, color: '#ffffff', range: 0, cool: 0, windup: 0 },
  fairy: { name: '숲의 요정', lv: 6, hp: 40, dmg: 0, exp: 220, gold: 14, spd: 2.2, aggro: false, color: '#a7f3d0', range: 0, cool: 0, windup: 0 },
  slime: { name: '푸른 슬라임', lv: 4, hp: 55, dmg: 5, exp: 130, gold: 11, spd: 2.2, aggro: true, color: '#5eead4', range: 2.0, cool: 2.0, windup: 0.6 },
  boar: { name: '들판 멧돼지', lv: 6, hp: 90, dmg: 9, exp: 210, gold: 18, spd: 4.6, aggro: true, color: '#b08968', range: 2.2, cool: 1.8, windup: 0.55 },
  goblin: { name: '고블린', lv: 10, hp: 130, dmg: 12, exp: 300, gold: 24, spd: 3.5, aggro: true, color: '#6f9440', range: 2.4, cool: 1.6, windup: 0.5 },
  bandit: { name: '산적', lv: 13, hp: 190, dmg: 17, exp: 480, gold: 36, spd: 4.4, aggro: true, color: '#8d6e63', range: 2.4, cool: 1.4, windup: 0.45 },
  spider: { name: '동굴 거미', lv: 15, hp: 210, dmg: 19, exp: 560, gold: 40, spd: 5.0, aggro: true, color: '#4b5563', range: 2.2, cool: 1.25, windup: 0.35 },
  wolf: { name: '굶주린 늑대', lv: 18, hp: 240, dmg: 21, exp: 680, gold: 44, spd: 5.4, aggro: true, color: '#7d7d8c', range: 2.4, cool: 1.2, windup: 0.38 },
  harpy: { name: '폭포 하피', lv: 22, hp: 330, dmg: 27, exp: 1000, gold: 62, spd: 5.6, aggro: true, color: '#67e8f9', range: 2.6, cool: 1.15, windup: 0.4 },
  imp: { name: '화염 임프', lv: 28, hp: 420, dmg: 32, exp: 1400, gold: 78, spd: 4.4, aggro: true, color: '#e2603a', range: 2.6, cool: 1.1, windup: 0.42 },
  golem: { name: '석상 골렘', lv: 31, hp: 620, dmg: 40, exp: 1900, gold: 96, spd: 3.0, aggro: true, color: '#9ca3af', range: 2.8, cool: 1.5, windup: 0.7 },
  wraith: { name: '심연 망령', lv: 38, hp: 700, dmg: 46, exp: 2800, gold: 130, spd: 4.8, aggro: true, color: '#8b6ad6', range: 2.8, cool: 1.0, windup: 0.4 },
  shade: { name: '그림자 잔영', lv: 40, hp: 780, dmg: 52, exp: 3300, gold: 150, spd: 6.0, aggro: true, color: '#4c1d95', range: 2.6, cool: 0.95, windup: 0.32 },
  moonbeast: { name: '월광 야수', lv: 43, hp: 900, dmg: 58, exp: 4100, gold: 180, spd: 5.2, aggro: true, color: '#c7d2fe', range: 2.8, cool: 1.0, windup: 0.38 },
  lich: { name: '리치', lv: 46, hp: 1050, dmg: 62, exp: 4800, gold: 210, spd: 4.0, aggro: true, color: '#a3e635', range: 3.0, cool: 1.1, windup: 0.45 },
  drake: { name: '어린 용', lv: 50, hp: 1200, dmg: 66, exp: 5600, gold: 240, spd: 5.0, aggro: true, color: '#c04a3c', range: 3.2, cool: 1.15, windup: 0.5 },
}

/* 몬스터 크기 배율 */
export const MOB_SCALE = {
  rabbit: 1, fairy: 0.75, slime: 0.9, boar: 1.1, goblin: 1, bandit: 1.05,
  spider: 1, wolf: 1.1, harpy: 1.05, imp: 1, golem: 1.5, wraith: 1.15,
  shade: 1.1, moonbeast: 1.2, lich: 1.2, drake: 1.35,
}

/* ------------------------------------------------------------------
   사냥터 — 요구 레벨 순서대로 이어진다.
   special: 히든 직업 전직 장소 표시 (맵 안에 상호작용 지점이 생긴다)
   ------------------------------------------------------------------ */
export const MAPS = [
  { id: 0, name: '초보자 마을', reqLv: 1, town: true, half: 30,
    ground: '#57a355', sky: '#8fd3f4', fog: [40, 120], mob: 'rabbit', count: 9,
    desc: '모든 모험이 시작되는 평화로운 마을' },
  { id: 1, name: '푸른 초원', reqLv: 3, half: 26,
    ground: '#6cb86a', sky: '#a8e0f7', fog: [34, 100], mob: 'slime', count: 9,
    desc: '슬라임이 통통 튀어다니는 완만한 초원' },
  { id: 2, name: '야생 들판', reqLv: 5, half: 26,
    ground: '#9aa85a', sky: '#cfe8a0', fog: [32, 96], mob: 'boar', count: 9,
    desc: '멧돼지가 돌진하는 거친 들판' },
  { id: 3, name: '고블린 숲', reqLv: 8, half: 26,
    ground: '#3d6b43', sky: '#7fae8c', fog: [30, 90], mob: 'goblin', count: 8,
    desc: '고블린 무리가 우글거리는 어두운 숲' },
  { id: 4, name: '엘프의 숲', reqLv: 10, half: 26, special: 'fairy_grove',
    ground: '#2f7d5b', sky: '#bff5dd', fog: [28, 92], mob: 'fairy', count: 10,
    desc: '요정들이 노니는 신비한 숲 — 요정을 모을 수 있다' },
  { id: 5, name: '산적 야영지', reqLv: 12, half: 26,
    ground: '#7a6a52', sky: '#b7a184', fog: [30, 88], mob: 'bandit', count: 8,
    desc: '길을 막고 통행세를 뜯는 산적들의 야영지' },
  { id: 6, name: '거미 굴', reqLv: 14, half: 24,
    ground: '#4a4550', sky: '#2b2833', fog: [22, 70], mob: 'spider', count: 9,
    desc: '거미줄이 뒤덮인 축축한 굴' },
  { id: 7, name: '늑대 협곡', reqLv: 16, half: 26,
    ground: '#8a7a5e', sky: '#c9b98a', fog: [30, 90], mob: 'wolf', count: 8,
    desc: '굶주린 늑대들이 배회하는 바위 협곡' },
  { id: 8, name: '마법의 폭포', reqLv: 20, half: 26, special: 'magic_falls',
    ground: '#3c6f7a', sky: '#9fe3f0', fog: [28, 88], mob: 'harpy', count: 8,
    desc: '마력이 흐르는 폭포 — 물살 안쪽에 무언가 있다' },
  { id: 9, name: '화염 동굴', reqLv: 26, half: 24,
    ground: '#6b3327', sky: '#d9744a', fog: [24, 74], mob: 'imp', count: 8,
    desc: '용암이 흐르는 뜨거운 지하 동굴' },
  { id: 10, name: '석상 고원', reqLv: 30, half: 26,
    ground: '#7d7f86', sky: '#a8adb8', fog: [26, 82], mob: 'golem', count: 7,
    desc: '움직이는 석상들이 지키는 황량한 고원' },
  { id: 11, name: '심연의 던전', reqLv: 36, half: 24,
    ground: '#332e46', sky: '#231f33', fog: [22, 66], mob: 'wraith', count: 8,
    desc: '빛이 닿지 않는 심연. 망령이 떠돈다' },
  { id: 12, name: '어둠의 제단', reqLv: 38, half: 24, special: 'dark_altar',
    ground: '#241a2e', sky: '#150f1c', fog: [18, 58], mob: 'shade', count: 8,
    desc: '검은 제단이 놓인 금단의 땅 — 제사를 드릴 수 있다' },
  { id: 13, name: '달의 바다', reqLv: 42, half: 26, special: 'moon_sea',
    ground: '#2b3557', sky: '#8b9dd6', fog: [26, 84], mob: 'moonbeast', count: 8,
    desc: '달빛이 고인 은빛 바다 — 한가운데 깊은 구덩이가 있다' },
  { id: 14, name: '리치의 성', reqLv: 45, half: 24,
    ground: '#3b4232', sky: '#5b6647', fog: [22, 70], mob: 'lich', count: 7,
    desc: '죽음의 마법사가 다스리는 폐허의 성' },
  { id: 15, name: '용의 둥지', reqLv: 48, half: 24,
    ground: '#5c3340', sky: '#8f5560', fog: [22, 70], mob: 'drake', count: 7,
    desc: '어린 용들이 둥지를 튼 최종 사냥터' },
]
export const MAP_BY_ID = Object.fromEntries(MAPS.map((m) => [m.id, m]))
export const MAP_COUNT = MAPS.length

/* 히든 직업 전직 지점의 맵 안 좌표 */
export const SPECIAL_SPOTS = {
  fairy_grove: { x: 0, z: -14, r: 3.2, icon: '🧚', label: '요정 무리' },
  magic_falls: { x: 0, z: -16, r: 3.0, icon: '💧', label: '폭포 안쪽' },
  dark_altar: { x: 0, z: -14, r: 3.0, icon: '🕯️', label: '검은 제단' },
  moon_sea: { x: 0, z: -14, r: 3.4, icon: '🌘', label: '달의 구덩이' },
}
