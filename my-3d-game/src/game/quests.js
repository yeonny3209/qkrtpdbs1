/* ==================================================================
   메인 퀘스트 — 마을 이장이 주는 한 줄기 이야기

   순서 (사용자 확정):
   튜토리얼 → 스킬트리 → AI 결투(PVP) → 파티 던전 → 파티 레이드
   전부 끝내면 레벨 10이 보장되고 1차 전직 퀘스트가 열린다.

   진행은 저장 데이터의 `mq`(현재 단계 번호) 하나로만 관리한다.
   각 단계는 done(save)로 완료 여부를 스스로 판정하므로,
   어떤 경로로 조건을 만족했든(예: 그냥 놀다가 던전을 깬 경우)
   이장에게 가면 바로 보고할 수 있다.

   React·DOM 비의존 순수 로직이라 Node에서 그대로 테스트할 수 있다.
   ================================================================== */

export const MQ_GOAL_LEVEL = 10        // 메인 퀘스트를 다 끝내면 도달하는 레벨

export const MAIN_QUESTS = [
  {
    id: 'tutorial',
    title: '첫 걸음',
    icon: '🐰',
    give: '마을 밖 토끼를 사냥해 토끼 간 10개를 모아오게.',
    hint: '토끼를 사냥해 토끼 간 10개 모으기',
    turnIn: '훌륭하네! 이제 자네도 어엿한 모험가일세.',
    reward: { gold: 300, sp: 1 },
    done: (s) => (s.livers || 0) >= 10,
    progress: (s) => `${Math.min(10, s.livers || 0)} / 10`,
  },
  {
    id: 'skilltree',
    title: '힘을 갈고닦다',
    icon: '🕸',
    give: '가진 재능을 다듬어야 하네. 스킬창(K)을 열어 스킬을 하나 익혀보게.',
    hint: 'K를 눌러 스킬트리에서 스킬 1개 배우기',
    turnIn: '좋아, 그 힘이 앞으로 자네를 지켜줄 걸세.',
    reward: { gold: 400, sp: 1, exp: 600 },
    done: (s) => Object.values(s.skills || {}).some((v) => v > 0),
    progress: (s) => (Object.values(s.skills || {}).some((v) => v > 0) ? '완료' : '0 / 1'),
  },
  {
    id: 'pvp',
    title: '겨루어 보게',
    icon: '⚔',
    give: '마을 북쪽 투기장에서 훈련 상대와 겨뤄 한 번 이겨보게.',
    hint: '투기장 포탈(북쪽)에서 AI 상대에게 1승',
    turnIn: '제법이군! 실전 감각이 붙었어.',
    reward: { gold: 700, sp: 1, exp: 1400 },
    done: (s) => (s.pvpKills || 0) >= 1,
    progress: (s) => `${Math.min(1, s.pvpKills || 0)} / 1`,
  },
  {
    id: 'dungeon',
    title: '동료와 함께',
    icon: '🗝',
    give: '혼자 힘으론 넘기 어려운 곳이 있네. 파티창(P)에서 던전에 도전해보게. '
        + '사람이 모자라면 마을 용병들이 함께 가줄 걸세.',
    hint: 'P → 파티 던전 클리어 (동료가 자동으로 채워집니다)',
    turnIn: '동료의 힘을 알았겠지. 그게 이 세계의 이치라네.',
    reward: { gold: 1200, sp: 1, exp: 3000 },
    done: (s) => (s.dungeonClears || 0) >= 1,
    progress: (s) => `${Math.min(1, s.dungeonClears || 0)} / 1`,
  },
  {
    id: 'raid',
    title: '거대한 적',
    icon: '🐉',
    give: '마지막이네. 여럿이 힘을 합쳐야만 쓰러뜨릴 수 있는 존재가 있어. '
        + '초급 레이드에 도전해보게.',
    hint: 'P → 파티 레이드 클리어 (동료가 자동으로 채워집니다)',
    turnIn: '자네는 이제 진정한 모험가일세. 전직할 때가 되었군!',
    reward: { gold: 2500, sp: 2, exp: 8000 },
    done: (s) => (s.raidClears || 0) >= 1,
    progress: (s) => `${Math.min(1, s.raidClears || 0)} / 1`,
  },
]

export const MQ_COUNT = MAIN_QUESTS.length
export const MQ_BY_ID = Object.fromEntries(MAIN_QUESTS.map((q) => [q.id, q]))

/* 지금 진행 중인 퀘스트 (전부 끝났으면 null) */
export function currentQuest(save) {
  const i = save.mq || 0
  return i < MAIN_QUESTS.length ? MAIN_QUESTS[i] : null
}

/* 이장에게 보고할 수 있는가 */
export function canTurnIn(save) {
  const q = currentQuest(save)
  return !!q && q.done(save)
}

export function allQuestsDone(save) {
  return (save.mq || 0) >= MAIN_QUESTS.length
}

/* 이장 머리 위 표시 상태 — 물음표(받을 것) / 느낌표(보고할 것) / 없음 */
export function chiefMarker(save) {
  if (allQuestsDone(save)) return 'done'
  return canTurnIn(save) ? 'ready' : 'active'
}
