/* ==================================================================
   맵별 NPC 사이드 퀘스트 (사용자 확정 규칙)

   · 맵마다 최소 2개, 최대 8개
   · 레벨 제한이 있다
   · 완료하면 경험치를 많이 준다
   · 룬은 상점에서 살 수 없으므로 '룬 퀘스트'로 얻을 수 있게 한다
     (아티팩트는 퀘스트로도 얻을 수 없다 — 40레벨 이상 던전 전용)

   진행 상태는 저장 데이터의 `sq[questId] = { state, base }` 하나로 관리한다.
     state: 'none' | 'active' | 'done'
     base : 수락 시점의 누적 처치 수 (목표 계산 기준)

   순수 데이터·로직이라 Node에서 그대로 테스트할 수 있다.
   ================================================================== */

/* 퀘스트 종류
   kill    — 그 맵의 몬스터를 n마리 처치
   collect — 처치하며 전리품 n개 수집 (확률 드랍)
   boss    — 던전/레이드 클리어 n회
   visit   — 특정 맵에 도달 (레벨 제한이 곧 관문)
*/

let seq = 0
const q = (mapId, o) => ({
  id: `sq${seq++}`,
  mapId,
  type: o.type || 'kill',
  ...o,
})

/* 맵 id → NPC 퀘스트 목록 (2~8개) */
export const SIDE_QUESTS = [
  /* ---------- 0. 초보자 마을 (4개) ---------- */
  q(0, { npc: '농부 톨', icon: '🧑‍🌾', title: '밭을 망치는 토끼', reqLv: 1, need: 8, mob: 'rabbit',
    desc: '토끼 8마리를 잡아주면 밭이 좀 살아날 텐데.', exp: 900, gold: 120 }),
  q(0, { npc: '빨래꾼 소니', icon: '🧺', title: '사라진 빨랫감', reqLv: 2, need: 12, mob: 'rabbit',
    desc: '토끼들이 빨랫감을 물어갔어요. 12마리쯤 잡아주세요.', exp: 1600, gold: 200 }),
  q(0, { npc: '경비병 라스', icon: '💠', title: '마을 순찰', reqLv: 4, need: 20, mob: 'rabbit',
    desc: '마을 주변을 정리해주게. 20마리면 충분하네.', exp: 3200, gold: 380 }),
  q(0, { npc: '수련생 미오', icon: '🎯', title: '첫 던전', reqLv: 3, need: 1, type: 'boss',
    desc: '던전을 한 번 다녀오면 실력이 붙을 거예요.', exp: 5000, gold: 600 }),

  /* ---------- 1. 푸른 초원 (3개) ---------- */
  q(1, { npc: '양치기 벤', icon: '🐑', title: '끈적한 습격자', reqLv: 3, need: 12, mob: 'slime',
    desc: '슬라임이 양들을 놀래켜요. 12마리 부탁해요.', exp: 2400, gold: 260 }),
  q(1, { npc: '약초꾼 리나', icon: '🌿', title: '슬라임 점액', reqLv: 4, need: 6, type: 'collect',
    item: '슬라임 점액', drop: 0.5, desc: '약을 만들려면 점액 6개가 필요해요.', exp: 3600, gold: 340 }),
  q(1, { npc: '떠돌이 학자', icon: '📖', title: '초원의 기록', reqLv: 5, need: 22, mob: 'slime',
    desc: '표본을 위해 22마리를 관찰(처치)해주세요.', exp: 6000, gold: 520 }),

  /* ---------- 2. 야생 들판 (3개) ---------- */
  q(2, { npc: '사냥꾼 고르', icon: '🏹', title: '멧돼지 사냥', reqLv: 5, need: 14, mob: 'boar',
    desc: '멧돼지 14마리. 겨울 식량이 걸린 일이야.', exp: 5200, gold: 480 }),
  q(2, { npc: '가죽공 단', icon: '🧵', title: '질긴 가죽', reqLv: 6, need: 8, type: 'collect',
    item: '멧돼지 가죽', drop: 0.45, desc: '가죽 8장이면 갑옷 하나가 나오지.', exp: 7000, gold: 640 }),
  q(2, { npc: '고물상 페니', icon: '🔧', title: '룬의 조각', reqLv: 7, need: 20, mob: 'boar', rune: true,
    desc: '들판에 룬 조각이 떨어졌다는데… 20마리쯤 뒤지면 나올 거야.', exp: 9000, gold: 700 }),

  /* ---------- 3. 고블린 숲 (4개) ---------- */
  q(3, { npc: '벌목꾼 하른', icon: '🪓', title: '나무를 지켜라', reqLv: 8, need: 16, mob: 'goblin',
    desc: '고블린 16마리를 몰아내주게.', exp: 9000, gold: 780 }),
  q(3, { npc: '정찰병 유나', icon: '🔭', title: '고블린 귀', reqLv: 9, need: 10, type: 'collect',
    item: '고블린 귀', drop: 0.4, desc: '증표로 귀 10개가 필요합니다.', exp: 12000, gold: 950 }),
  q(3, { npc: '대장장이 곰', icon: '🔨', title: '빼앗긴 연장', reqLv: 10, need: 26, mob: 'goblin',
    desc: '연장을 훔친 놈들이야. 26마리는 잡아야 본보기가 되지.', exp: 17000, gold: 1300 }),
  q(3, { npc: '주술사 델', icon: '🕯️', title: '숲의 균형', reqLv: 11, need: 2, type: 'boss',
    desc: '던전을 두 번 정리하면 숲의 기운이 돌아옵니다.', exp: 24000, gold: 1800 }),

  /* ---------- 4. 엘프의 숲 (5개) ---------- */
  q(4, { npc: '엘프 파수꾼', icon: '🧝', title: '숲의 손님', reqLv: 10, need: 1, type: 'visit',
    desc: '이 숲에 발을 들인 것 자체가 시험이었네.', exp: 8000, gold: 500 }),
  q(4, { npc: '요정 라라', icon: '🧚', title: '요정과 놀아주기', reqLv: 10, need: 6, mob: 'fairy',
    desc: '요정 6명과 술래잡기를 해줘! (요정에게 다가가 E)', exp: 14000, gold: 900 }),
  q(4, { npc: '수호목 정령', icon: '🌳', title: '뿌리의 부탁', reqLv: 12, need: 14, mob: 'fairy',
    desc: '길 잃은 요정 14명을 돌려보내주세요.', exp: 22000, gold: 1400 }),
  q(4, { npc: '엘프 현자', icon: '📜', title: '룬의 언어', reqLv: 13, need: 10, mob: 'fairy', rune: true,
    desc: '요정의 말을 새긴 룬을 드리겠습니다.', exp: 30000, gold: 1900 }),
  q(4, { npc: '꽃의 요정', icon: '🌸', title: '이슬 모으기', reqLv: 11, need: 12, type: 'collect',
    item: '아침 이슬', drop: 0.5, desc: '이슬 12방울이면 향수를 만들 수 있어요.', exp: 19000, gold: 1200 }),

  /* ---------- 5. 산적 야영지 (3개) ---------- */
  q(5, { npc: '상인 조합장', icon: '💰', title: '통행세 반환', reqLv: 12, need: 18, mob: 'bandit',
    desc: '산적 18명. 상단의 길을 되찾아주시오.', exp: 26000, gold: 2100 }),
  q(5, { npc: '현상금 사냥꾼', icon: '📌', title: '수배 전단', reqLv: 14, need: 12, type: 'collect',
    item: '산적 인장', drop: 0.4, desc: '인장 12개를 가져오면 현상금을 주지.', exp: 34000, gold: 2800 }),
  q(5, { npc: '탈출한 포로', icon: '⛓️', title: '복수', reqLv: 15, need: 30, mob: 'bandit',
    desc: '30명… 전부 갚아주고 싶습니다.', exp: 48000, gold: 3600 }),

  /* ---------- 6. 거미 굴 (3개) ---------- */
  q(6, { npc: '굴 탐사대장', icon: '🪖', title: '굴 정리', reqLv: 14, need: 20, mob: 'spider',
    desc: '거미 20마리를 정리해 길을 열어주게.', exp: 36000, gold: 2600 }),
  q(6, { npc: '실 장인', icon: '🕸️', title: '질긴 거미줄', reqLv: 15, need: 14, type: 'collect',
    item: '거미줄 다발', drop: 0.42, desc: '거미줄 14다발로 밧줄을 만들겠습니다.', exp: 45000, gold: 3200 }),
  q(6, { npc: '독약상 니케', icon: '🧪', title: '독 채집', reqLv: 16, need: 2, type: 'boss',
    desc: '던전 깊은 곳의 독이 필요해. 두 번 다녀와.', exp: 60000, gold: 4200 }),

  /* ---------- 7. 늑대 협곡 (4개) ---------- */
  q(7, { npc: '협곡 안내인', icon: '🧭', title: '늑대 퇴치', reqLv: 16, need: 22, mob: 'wolf',
    desc: '늑대 22마리. 길이 너무 위험해졌어.', exp: 52000, gold: 3800 }),
  q(7, { npc: '모피상 룬드', icon: '🧥', title: '두꺼운 모피', reqLv: 17, need: 15, type: 'collect',
    item: '늑대 모피', drop: 0.4, desc: '모피 15장이면 겨울을 넘길 수 있소.', exp: 66000, gold: 4600 }),
  q(7, { npc: '늑대 조련사', icon: '🐺', title: '우두머리 표식', reqLv: 18, need: 34, mob: 'wolf',
    desc: '무리를 흩어놓아야 해. 34마리다.', exp: 88000, gold: 6000 }),
  q(7, { npc: '방랑 룬술사', icon: '🔮', title: '협곡의 룬', reqLv: 19, need: 16, mob: 'wolf', rune: true,
    desc: '피가 스민 룬을 정화해 드리겠소.', exp: 100000, gold: 7000 }),

  /* ---------- 8. 마법의 폭포 (5개) ---------- */
  q(8, { npc: '폭포 수행자', icon: '🧘', title: '물살 견디기', reqLv: 20, need: 1, type: 'visit',
    desc: '여기까지 온 자네라면 자격이 있네.', exp: 40000, gold: 2000 }),
  q(8, { npc: '하피 연구자', icon: '🪶', title: '하피 관찰', reqLv: 20, need: 20, mob: 'harpy',
    desc: '하피 20마리의 생태를 기록해주세요.', exp: 92000, gold: 6200 }),
  q(8, { npc: '마력 측정사', icon: '📐', title: '마력이 깃든 깃털', reqLv: 21, need: 14, type: 'collect',
    item: '마력 깃털', drop: 0.4, desc: '깃털 14개로 마력을 측정하겠습니다.', exp: 110000, gold: 7400 }),
  q(8, { npc: '폭포 은둔자', icon: '💧', title: '폭포 안의 소문', reqLv: 22, need: 30, mob: 'harpy',
    desc: '30마리를 잡고 나면… 폭포 안쪽 이야기를 해주지.', exp: 145000, gold: 9000 }),
  q(8, { npc: '고대 룬 학자', icon: '🗿', title: '물에 새긴 룬', reqLv: 23, need: 18, mob: 'harpy', rune: true,
    desc: '물살에 새겨진 룬을 건져 드리겠습니다.', exp: 170000, gold: 10500 }),

  /* ---------- 9. 화염 동굴 (3개) ---------- */
  q(9, { npc: '용암 광부', icon: '⛏️', title: '임프 소탕', reqLv: 26, need: 24, mob: 'imp',
    desc: '임프 24마리. 갱도가 뜨거워 죽겠어.', exp: 190000, gold: 12000 }),
  q(9, { npc: '불의 연금술사', icon: '🔥', title: '불씨 채집', reqLv: 27, need: 16, type: 'collect',
    item: '꺼지지 않는 불씨', drop: 0.38, desc: '불씨 16개면 영구 화로를 만들 수 있소.', exp: 230000, gold: 14000 }),
  q(9, { npc: '화염 사제', icon: '🕯️', title: '심장부의 시험', reqLv: 28, need: 3, type: 'boss',
    desc: '던전을 세 번 정복하면 불의 축복을 내리겠다.', exp: 300000, gold: 18000 }),

  /* ---------- 10. 석상 고원 (3개) ---------- */
  q(10, { npc: '고원 감시자', icon: '👁️', title: '석상 파괴', reqLv: 30, need: 20, mob: 'golem',
    desc: '골렘 20기를 부숴 길을 내주게.', exp: 320000, gold: 20000 }),
  q(10, { npc: '조각가 델타', icon: '🗿', title: '완벽한 핵', reqLv: 31, need: 12, type: 'collect',
    item: '골렘의 핵', drop: 0.35, desc: '핵 12개로 새 석상을 만들겠습니다.', exp: 400000, gold: 24000 }),
  q(10, { npc: '유물 감정사', icon: '🔍', title: '고원의 룬', reqLv: 32, need: 22, mob: 'golem', rune: true,
    desc: '석상 속에 룬이 박혀 있다는 소문이 있소.', exp: 480000, gold: 28000 }),

  /* ---------- 11. 심연의 던전 (4개) ---------- */
  q(11, { npc: '심연 조사관', icon: '🕳️', title: '망령 정화', reqLv: 36, need: 24, mob: 'wraith',
    desc: '망령 24기를 정화해주십시오.', exp: 560000, gold: 32000 }),
  q(11, { npc: '봉인 사제', icon: '⛓️', title: '흐트러진 봉인', reqLv: 37, need: 16, type: 'collect',
    item: '봉인 파편', drop: 0.35, desc: '파편 16개를 모아 봉인을 다시 세웁니다.', exp: 680000, gold: 38000 }),
  q(11, { npc: '심연 도굴꾼', icon: '🪙', title: '깊은 곳의 보물', reqLv: 38, need: 3, type: 'boss',
    desc: '던전 세 번. 그 안에 값나가는 게 있어.', exp: 850000, gold: 46000 }),
  q(11, { npc: '망령 언어학자', icon: '📕', title: '망령의 룬', reqLv: 38, need: 26, mob: 'wraith', rune: true,
    desc: '망령이 남긴 룬을 해독해 드리겠습니다.', exp: 1000000, gold: 52000 }),

  /* ---------- 12. 어둠의 제단 (3개) ---------- */
  q(12, { npc: '제단 지킴이', icon: '🕯️', title: '금단의 땅', reqLv: 38, need: 1, type: 'visit',
    desc: '여기 발을 들인 자에게는… 대가가 따르지.', exp: 300000, gold: 15000 }),
  q(12, { npc: '그림자 상인', icon: '🌑', title: '잔영 사냥', reqLv: 38, need: 26, mob: 'shade',
    desc: '잔영 26개를 걷어내주게.', exp: 1100000, gold: 56000 }),
  q(12, { npc: '검은 사제', icon: '🖤', title: '제사의 준비', reqLv: 40, need: 18, type: 'collect',
    item: '검은 향', drop: 0.33, desc: '검은 향 18개가 있어야 제사를 올릴 수 있다.', exp: 1400000, gold: 66000 }),

  /* ---------- 13. 달의 바다 (4개) ---------- */
  q(13, { npc: '달빛 뱃사공', icon: '🛶', title: '은빛 바다', reqLv: 42, need: 1, type: 'visit',
    desc: '달이 고인 바다에 온 걸 환영하네.', exp: 400000, gold: 18000 }),
  q(13, { npc: '월광 관측자', icon: '🌘', title: '야수 사냥', reqLv: 42, need: 26, mob: 'moonbeast',
    desc: '월광 야수 26마리를 처리해주세요.', exp: 1600000, gold: 72000 }),
  q(13, { npc: '조각 수집가', icon: '🌙', title: '달조각', reqLv: 43, need: 20, type: 'collect',
    item: '달조각', drop: 0.4, desc: '달조각 20개를 모아주시면 사례하겠습니다.', exp: 1900000, gold: 82000 }),
  q(13, { npc: '심연 잠수부', icon: '🌊', title: '달빛 심연', reqLv: 44, need: 3, type: 'boss',
    desc: '바다 아래 던전을 세 번 다녀와주게.', exp: 2300000, gold: 95000 }),

  /* ---------- 14. 리치의 성 (3개) ---------- */
  q(14, { npc: '성문 기사', icon: '🛡️', title: '성 진입', reqLv: 45, need: 22, mob: 'lich',
    desc: '리치의 수하 22기를 쓸어주시오.', exp: 2600000, gold: 105000 }),
  q(14, { npc: '금서 사서', icon: '📚', title: '금서 회수', reqLv: 46, need: 16, type: 'collect',
    item: '금서 낱장', drop: 0.32, desc: '낱장 16개를 회수해 주십시오.', exp: 3100000, gold: 120000 }),
  q(14, { npc: '망자의 룬술사', icon: '💀', title: '뼈에 새긴 룬', reqLv: 47, need: 28, mob: 'lich', rune: true,
    desc: '뼈에 새겨진 룬을 넘겨 드리지.', exp: 3600000, gold: 135000 }),

  /* ---------- 15. 용의 둥지 (4개) ---------- */
  q(15, { npc: '용 사냥꾼 단장', icon: '🗡️', title: '어린 용 토벌', reqLv: 48, need: 24, mob: 'drake',
    desc: '어린 용 24마리. 쉽지 않을 게다.', exp: 4200000, gold: 150000 }),
  q(15, { npc: '비늘 세공사', icon: '🐲', title: '완전한 비늘', reqLv: 49, need: 18, type: 'collect',
    item: '용 비늘', drop: 0.3, desc: '비늘 18장이면 최고의 갑옷이 나옵니다.', exp: 5000000, gold: 175000 }),
  q(15, { npc: '고룡 연구자', icon: '📖', title: '최심부 탐사', reqLv: 50, need: 4, type: 'boss',
    desc: '가장 깊은 던전을 네 번 정복해주시오.', exp: 6500000, gold: 210000 }),
  q(15, { npc: '용의 룬 대가', icon: '✨', title: '용의 룬', reqLv: 52, need: 30, mob: 'drake', rune: true,
    desc: '용의 힘이 깃든 룬을 새겨 드리겠소.', exp: 8000000, gold: 260000 }),
]

export const SQ_BY_ID = Object.fromEntries(SIDE_QUESTS.map((x) => [x.id, x]))
export const questsForMap = (mapId) => SIDE_QUESTS.filter((x) => x.mapId === mapId)

/* 진행 상태 조회 — 저장 데이터에 없으면 'none' */
export function sqState(save, id) {
  const e = (save.sq || {})[id]
  return e ? e.state : 'none'
}

/* 현재 진행량 — 0 이상, 목표치를 넘지 않는다 (UI가 "18 / 8"처럼 새지 않게).
   collect는 별도 카운터, 나머지는 누적값 - 수락 시점 */
export function sqProgress(save, quest) {
  const e = (save.sq || {})[quest.id]
  if (!e || e.state === 'none') return 0
  if (e.state === 'done') return quest.need
  const cap = (v) => Math.max(0, Math.min(quest.need, v))
  if (quest.type === 'collect') return cap(e.got || 0)
  if (quest.type === 'boss') return cap((save.dungeonClears || 0) + (save.raidClears || 0) - (e.base || 0))
  if (quest.type === 'visit') return quest.need
  return cap((save.kills || 0) - (e.base || 0))
}

export const sqComplete = (save, quest) => sqProgress(save, quest) >= quest.need

/* 이 맵에서 지금 받을 수 있는/보고할 수 있는 퀘스트가 있는가 (NPC 표시용) */
export function mapQuestMarker(save, mapId) {
  const list = questsForMap(mapId)
  let hasReady = false, hasNew = false
  for (const x of list) {
    const st = sqState(save, x.id)
    if (st === 'active' && sqComplete(save, x)) hasReady = true
    else if (st === 'none' && (save.level || 1) >= x.reqLv) hasNew = true
  }
  return hasReady ? 'ready' : hasNew ? 'new' : 'none'
}

/* 맵 안 NPC 배치 — 입구 근처에 부채꼴로 세운다.
   퀘스트마다 NPC가 하나씩이므로 맵당 2~8명이 선다. */
export function npcSpotsForMap(mapId, half) {
  const list = questsForMap(mapId)
  const r = Math.max(6, half * 0.42)
  return list.map((q, i) => {
    const spread = Math.PI * 0.9
    const a = -Math.PI / 2 + (list.length === 1 ? 0 : (i / (list.length - 1) - 0.5) * spread)
    return {
      ...q,
      x: Math.cos(a) * r,
      z: Math.sin(a) * r + (mapId === 0 ? 12 : half * 0.55),
      face: Math.atan2(-Math.cos(a), -Math.sin(a)),
    }
  })
}
