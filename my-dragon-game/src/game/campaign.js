/* ==================================================================
   메인 캠페인 "용의 섬" — 10장 × 10스테이지 (총 100)

   스토리 바이블을 그대로 데이터로 옮겼다. 중요한 원칙 하나:

     로드맵 13-3에 따라 1~6장에는 "메타적 균열"(WAVE #___ 같은 시스템
     글리치)을 절대 넣지 않는다. 이 구간엔 정서적 복선 — 루나의 낯익음,
     정령이 절하는 것, 조각상의 얼굴 — 만 배치한다.
     메타 장치는 10장 크레딧에서 처음 등장해야 충격이 산다.

   실제 대사와 선택지는 story.js 가 들고 있다. 여기서는 스테이지에
   스크립트가 붙어 있는지만 표시한다.
   ================================================================== */
import { hasScript } from './story.js'

export const DIFFICULTIES = [
  { id: 'normal', name: '일반', mul: 1.0, expMul: 1.0, goldMul: 1.0 },
  { id: 'hard', name: '어려움', mul: 1.9, expMul: 1.8, goldMul: 1.7 },
  { id: 'hell', name: '지옥', mul: 3.4, expMul: 3.2, goldMul: 2.8 },
]

/* 각 장의 무대 · 적 속성 · 등장 드래곤 · 스토리 비트 */
const CHAPTERS = [
  {
    id: 1, name: '낯선 섬', region: '해변과 마을', enemy: ['wind', 'light'], lv: [1, 6],
    intro: '폭풍에 휩쓸린 당신이 눈을 뜬 곳은, 지도에 없는 섬이었다.',
    boss: { name: '성난 해일 정령', element: 'wind' },
  },
  {
    id: 2, name: '숲의 비밀', region: '거대한 숲', enemy: ['wind', 'earth'], lv: [6, 14],
    intro: '숲의 정령들이 이상 행동을 보인다. 도망치는 게 아니라 — 엎드려 절한다.',
    boss: { name: '뒤틀린 숲의 수호자', element: 'earth' },
  },
  {
    id: 3, name: '화산의 비명', region: '동쪽 화산', enemy: ['fire'], lv: [14, 24],
    intro: '휴면 상태여야 할 화산이 깨어났다. 그 진동은… 어딘가 익숙하다.',
    boss: { name: '화산 심장부의 폭주체', element: 'fire' },
  },
  {
    id: 4, name: '빙하 숲', region: '북쪽 빙하', enemy: ['ice'], lv: [24, 34],
    intro: '따뜻해야 할 북쪽이 얼어붙었다. 화산과 빙하가 동시에 이상한 건 우연이 아니다.',
    boss: { name: '얼음 폭주체', element: 'ice' },
  },
  {
    id: 5, name: '대지의 울음', region: '남쪽 평원과 지하', enemy: ['earth'], lv: [34, 44],
    intro: '지진이 멈추지 않는다. 지하에서 무언가가 깨어나려 한다.',
    boss: { name: '폭주 지룡', element: 'earth' },
  },
  {
    id: 6, name: '신비의 타워', region: '섬 중심의 고대 타워', enemy: ['dark'], lv: [44, 54],
    intro: '모든 이상 현상의 근원. 섬 한가운데 숨겨져 있던 탑.',
    boss: { name: '타워 3층 수호자', element: 'dark' },
  },
  {
    id: 7, name: '타워의 진실', region: '봉인의 탑 4~6층', enemy: ['dark', 'mystic'], lv: [54, 64],
    intro: '탑의 정체가 드러난다. 그리고 루나가 300년간 숨겨온 이야기도.',
    boss: { name: '6층 최종 가디언', element: 'mystic' },
  },
  {
    id: 8, name: '배신자', region: '봉인의 탑 9~10층', enemy: ['light', 'dark'], lv: [64, 74],
    intro: '섬의 지도자 카이든. 그는 배신자인가, 아니면 가장 오래된 벗인가.',
    boss: { name: '카이든의 폭주 파편체', element: 'dark' },
  },
  {
    id: 9, name: '용왕의 각성', region: '봉인의 탑 최상층', enemy: ['dark', 'fire'], lv: [74, 86],
    intro: '봉인이 풀린다. 그리고 용왕은 — 싸우지 않고 무너져 운다.',
    boss: { name: '폭주하는 아르드라 (1단계)', element: 'dark' },
  },
  {
    id: 10, name: '새로운 시대', region: '최종 결전', enemy: ['dark', 'light', 'fire'], lv: [86, 100],
    intro: '모아온 모든 인연이, 무기가 아니라 짐을 나눠 짊어질 손길이 된다.',
    boss: { name: '아르드라 (최종형)', element: 'light' },
  },
]

/* 10장 종료 시 제시되는 3분기 엔딩 (스토리 바이블 4장) */
export const ENDINGS = [
  { id: 'fusion', name: '융합의 결말', icon: '🔗',
    desc: '다시 하나가 되어, 섬을 영원히 지키는 수호자가 된다.',
    text: '두 반쪽이 하나로 돌아갔다. 루나는 예전과 완전히 같지는 않은 "나"를 향해 미소 지으며 작별했다. 가장 슬프지만, 가장 완전한 결말.' },
  { id: 'share', name: '짐을 나누는 결말', icon: '🤝', recommended: true,
    desc: '모두가 조금씩 오염을 나눠 짊어지고, 아르드라는 살아서 남는다.',
    text: '그림자와 파편 드래곤들이, 카이든과 루나가 조금씩 짐을 나눴다. 아르드라는 인간에 가까운 존재로 살아남았다. 당신은 당신으로 남았다.' },
  { id: 'farewell', name: '완전한 작별', icon: '🌊', hidden: true,
    desc: '스스로를 희생해 모든 오염을 짊어지고 사라진다.',
    text: '텅 빈 해변에 다시 폭풍이 몰아치기 시작한다. 루나는 300년을 기다렸던 것처럼, 다시 언젠가의 재회를 기약한다.' },
]

/* ---------------- 스테이지 만들기 ---------------- */
function buildStages(ch) {
  const [lo, hi] = ch.lv
  return Array.from({ length: 10 }, (_, i) => {
    const n = i + 1
    const id = `${ch.id}-${n}`
    const isBoss = n === 10
    const t = i / 9
    const level = Math.round(lo + (hi - lo) * t)
    /* 1~3스는 1:1로 가볍게, 이후 3:3. 보스는 단일 강적 */
    const count = isBoss ? 1 : n <= 3 ? 1 : 3
    return {
      id,
      chapter: ch.id,
      no: n,
      name: isBoss ? `${ch.name} — ${ch.boss.name}` : `${ch.region} ${n}`,
      boss: isBoss,
      level,
      count,
      elements: isBoss ? [ch.boss.element] : ch.enemy,
      /* 보스는 체력·공격이 크게 붙는다 */
      statMul: isBoss ? 2.6 : 1,
      beat: hasScript(id),        // 전투 전에 대화가 붙는 스테이지인가
      exp: Math.round((28 + level * 5.5) * (isBoss ? 3.2 : 1) * count),
      gold: Math.round((18 + level * 3.2) * (isBoss ? 3.0 : 1) * count),
    }
  })
}

export const CAMPAIGN = CHAPTERS.map((ch) => ({ ...ch, stages: buildStages(ch) }))
export const CHAPTER_BY_ID = Object.fromEntries(CAMPAIGN.map((c) => [c.id, c]))
export const ALL_STAGES = CAMPAIGN.flatMap((c) => c.stages)
export const STAGE_BY_ID = Object.fromEntries(ALL_STAGES.map((s) => [s.id, s]))
export const TOTAL_STAGES = ALL_STAGES.length

/* 다음에 도전할 스테이지 (클리어 기록 기준) */
export function nextStage(cleared) {
  return ALL_STAGES.find((s) => !cleared[s.id]) || null
}
export function chapterProgress(chapterId, cleared) {
  const ch = CHAPTER_BY_ID[chapterId]
  const done = ch.stages.filter((s) => cleared[s.id]).length
  return { done, total: ch.stages.length }
}
/* 앞 장을 다 깨야 다음 장이 열린다 */
export function chapterUnlocked(chapterId, cleared) {
  if (chapterId === 1) return true
  const prev = CHAPTER_BY_ID[chapterId - 1]
  return prev.stages.every((s) => cleared[s.id])
}
export function stageUnlocked(stage, cleared) {
  if (!chapterUnlocked(stage.chapter, cleared)) return false
  if (stage.no === 1) return true
  return !!cleared[`${stage.chapter}-${stage.no - 1}`]
}
