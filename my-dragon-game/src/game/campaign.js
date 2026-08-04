/* ==================================================================
   메인 캠페인 "용의 섬" — 10장 × 10스테이지 (총 100)

   스토리 바이블을 그대로 데이터로 옮겼다. 중요한 원칙 하나:

     로드맵 13-3에 따라 1~6장에는 "메타적 균열"(WAVE #___ 같은 시스템
     글리치)을 절대 넣지 않는다. 이 구간엔 정서적 복선 — 루나의 낯익음,
     정령이 절하는 것, 조각상의 얼굴 — 만 배치한다.
     메타 장치는 10장 크레딧에서 처음 등장해야 충격이 산다.

   그래서 각 스테이지의 beat(연출 대사)는 kind로 구분해 둔다.
     'story'  일반 서사      'omen'  정서적 복선 (1~6장 허용)
     'glitch' 메타적 균열    (10장 엔딩 이후에만 — 여기서는 미사용)
   ================================================================== */

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
    beats: {
      1: { kind: 'omen', who: '???', text: '당신이 섬에 발을 딛는 순간, 파도와 바람이 한순간 멈춘다. 아무도 그 이유를 설명하지 못한다.' },
      2: { kind: 'story', who: '루나', text: '…정말, 정말 오랜만이야.' },
      3: { kind: 'story', who: '나', text: '(오랜만이라니? 우린 방금 처음 만났는데.)' },
      6: { kind: 'omen', who: '해설', text: '에밀은 다른 야생 드래곤과 달리, 당신을 보자마자 전혀 경계하지 않고 다가온다.' },
      8: { kind: 'omen', who: '루나', text: '(혼잣말) …이번엔, 얼마나 기억할까.' },
      10: { kind: 'omen', who: '해설', text: '밤하늘에 붉은 균열이 잠깐 비쳤다가 사라진다.' },
    },
  },
  {
    id: 2, name: '숲의 비밀', region: '거대한 숲', enemy: ['wind', 'earth'], lv: [6, 14],
    intro: '숲의 정령들이 이상 행동을 보인다. 도망치는 게 아니라 — 엎드려 절한다.',
    boss: { name: '뒤틀린 숲의 수호자', element: 'earth' },
    beats: {
      4: { kind: 'omen', who: '숲의 정령', text: '돌아오셨군요, 반쪽…! (화들짝 놀라 도망친다)' },
      5: { kind: 'story', who: '나', text: '(반쪽? 무슨 뜻이지.)' },
      7: { kind: 'omen', who: '해설', text: '에린드가 당신의 손을 스치자 잠시 멈칫하더니, 이유 모를 눈물을 흘린다.' },
      8: { kind: 'story', who: '루나', text: '…그 얘긴 나중에 하자. 지금은 숲이 먼저야.' },
      10: { kind: 'omen', who: '해설', text: '숲 심연에서 고대 문양을 발견했다 — 사람 형상 두 개가 하나로 겹쳐진 모습.' },
    },
  },
  {
    id: 3, name: '화산의 비명', region: '동쪽 화산', enemy: ['fire'], lv: [14, 24],
    intro: '휴면 상태여야 할 화산이 깨어났다. 그 진동은… 어딘가 익숙하다.',
    boss: { name: '화산 심장부의 폭주체', element: 'fire' },
    beats: {
      5: { kind: 'omen', who: '학자', text: '화산의 맥동이… 마치 살아있는 심장 같군.' },
      6: { kind: 'omen', who: '해설', text: '라그나가 공격을 멈추고 낮게 울부짖는다. 오랜만에 주인을 만난 짐승처럼.' },
      9: { kind: 'omen', who: '나', text: '(윽…!) 원인 모를 흉통에 잠시 무릎을 꿇는다.' },
      10: { kind: 'omen', who: '해설', text: '화면이 붉게 물들며 짧은 환영 — 낯선 이의 뒷모습이 스쳐 지나간다.' },
    },
  },
  {
    id: 4, name: '빙하 숲', region: '북쪽 빙하', enemy: ['ice'], lv: [24, 34],
    intro: '따뜻해야 할 북쪽이 얼어붙었다. 화산과 빙하가 동시에 이상한 건 우연이 아니다.',
    boss: { name: '얼음 폭주체', element: 'ice' },
    beats: {
      4: { kind: 'story', who: '해설', text: '얼어붙은 폐허에서 300년 전의 "작별의 제단" 전설을 듣는다.' },
      6: { kind: 'omen', who: '루나', text: '(눈물을 보이며) …이게, 그때의 네 얼굴이었구나.' },
      7: { kind: 'omen', who: '프로스트린', text: '폐하—… 아, 아닙니다. 제가 무슨 말을…' },
      9: { kind: 'story', who: '루나', text: '다음 장부터는… 너에게 전부 말해줘야 할지도 몰라.' },
      10: { kind: 'omen', who: '해설', text: '조각상이 부서지며 낡은 목걸이가 나왔다. 당신이 처음부터 목에 걸고 있던 것과 같은 문양이다.' },
    },
  },
  {
    id: 5, name: '대지의 울음', region: '남쪽 평원과 지하', enemy: ['earth'], lv: [34, 44],
    intro: '지진이 멈추지 않는다. 지하에서 무언가가 깨어나려 한다.',
    boss: { name: '폭주 지룡', element: 'earth' },
    beats: {
      4: { kind: 'story', who: '해설', text: '벽화를 발견했다 — 왕관을 쓴 존재가 자신의 가슴에서 빛나는 구슬을 꺼내 폭풍 속으로 떠나보내는 장면.' },
      7: { kind: 'omen', who: '해설', text: '테라스가 벽화 속 왕과 당신을 번갈아 바라본다.' },
      8: { kind: 'story', who: '학자', text: '이건 전설이 아니라 기록이야… 실제로 있었던 일이라고?' },
      9: { kind: 'omen', who: '나', text: '(…벽화 속 저 사람, 왜 나랑 닮았지.)' },
      10: { kind: 'story', who: '루나', text: '…다음 탑에서, 전부 알게 될 거야.' },
    },
  },
  {
    id: 6, name: '신비의 타워', region: '섬 중심의 고대 타워', enemy: ['dark'], lv: [44, 54],
    intro: '모든 이상 현상의 근원. 섬 한가운데 숨겨져 있던 탑.',
    boss: { name: '타워 3층 수호자', element: 'dark' },
    beats: {
      4: { kind: 'story', who: '해설', text: '탑 벽에 새겨진 이름을 처음으로 읽는다 — "아르드라".' },
      5: { kind: 'omen', who: '해설', text: '그림자가 공격해온다. 그런데 당신이 위험해질 때마다, 결정적인 순간에 물러선다.' },
      7: { kind: 'omen', who: '그림자', text: '(인간의 목소리로) …미안하다.' },
      8: { kind: 'omen', who: '해설', text: '봉인의 마법진이 당신의 존재만으로 반응해 빛난다.' },
      10: { kind: 'story', who: '루나', text: '네 진짜 이름을 말해줄게. 하지만 그전에… 카이든을 만나야 해.' },
    },
  },
  {
    id: 7, name: '타워의 진실', region: '봉인의 탑 4~6층', enemy: ['dark', 'mystic'], lv: [54, 64],
    intro: '탑의 정체가 드러난다. 그리고 루나가 300년간 숨겨온 이야기도.',
    boss: { name: '6층 최종 가디언', element: 'mystic' },
    beats: {
      3: { kind: 'story', who: '루나', text: '나는 인간이 아니야. 아르드라를 보좌하던 정령이고… 그날을 본 유일한 생존자야.' },
      4: { kind: 'story', who: '루나', text: '아르드라는 재앙이 아니야. 재앙을 막으려다, 스스로 재앙이 될 위기에 처한 존재야.' },
      6: { kind: 'story', who: '루나', text: '그리고 너는… 그가 스스로에게서 떼어낸, 마지막 인간의 마음이야.' },
      7: { kind: 'story', who: '나', text: '(…거짓말이야. 그럴 리가 없어.)' },
      9: { kind: 'story', who: '루나', text: '그림자는 그의 슬픔이 흘러나온 조각이야. 널 해치지 못해. 널 해치는 게, 자기 자신을 해치는 거니까.' },
    },
  },
  {
    id: 8, name: '배신자', region: '봉인의 탑 9~10층', enemy: ['light', 'dark'], lv: [64, 74],
    intro: '섬의 지도자 카이든. 그는 배신자인가, 아니면 가장 오래된 벗인가.',
    boss: { name: '카이든의 폭주 파편체', element: 'dark' },
    beats: {
      3: { kind: 'story', who: '카이든', text: '나는 그를 죽이려는 게 아니다. 놓아주려는 거다.' },
      4: { kind: 'story', who: '해설', text: '그는 300년 전 아르드라의 장군이었다. 봉인 속에서 왕이 매일 조금씩 자아를 잃어가는 것을, 가장 가까이서 지켜봐 왔다.' },
      6: { kind: 'story', who: '카이든', text: '네가 나타난 순간부터 알았다. 봉인이 곧 무너진다는 걸. 나는… 그가 완전한 괴물이 되어 네 손에 죽는 꼴을 보고 싶지 않을 뿐이다.' },
      9: { kind: 'story', who: '카이든', text: '(미소 지으며) …어쩌면, 네가 나보다 나은 답을 찾을지도 모르지.' },
    },
  },
  {
    id: 9, name: '용왕의 각성', region: '봉인의 탑 최상층', enemy: ['dark', 'fire'], lv: [74, 86],
    intro: '봉인이 풀린다. 그리고 용왕은 — 싸우지 않고 무너져 운다.',
    boss: { name: '폭주하는 아르드라 (1단계)', element: 'dark' },
    beats: {
      3: { kind: 'omen', who: '해설', text: '결계가 스스로 부서진다. 아르드라가 아니라, 당신과 공명해서 열린 것이다.' },
      4: { kind: 'story', who: '아르드라', text: '(무릎을 꿇고 당신의 얼굴을 어루만지며) …돌아왔구나.' },
      5: { kind: 'story', who: '아르드라', text: '너를 떠나보낸 날, 나는 내가 무너질 걸 알면서도 웃었다. 적어도 네 마음만은, 이 저주에서 지켜냈으니까.' },
      6: { kind: 'story', who: '해설', text: '에밀, 에린드, 라그나, 프로스트린, 테라스… 그동안 만난 모든 드래곤이 아르드라 곁으로 모여든다. 전부 그가 나눠 봉인해둔 힘의 파편이었다.' },
      8: { kind: 'story', who: '해설', text: '아르드라를 벨 때마다, 당신의 몸에도 똑같은 상처가 새겨진다.' },
      10: { kind: 'story', who: '아르드라', text: '네가 나를 완전히 없애줘. 그게… 유일한 방법이야.' },
    },
  },
  {
    id: 10, name: '새로운 시대', region: '최종 결전', enemy: ['dark', 'light', 'fire'], lv: [86, 100],
    intro: '모아온 모든 인연이, 무기가 아니라 짐을 나눠 짊어질 손길이 된다.',
    boss: { name: '아르드라 (최종형)', element: 'light' },
    beats: {
      3: { kind: 'story', who: '그림자', text: '남은 오염은… 내가 가져가겠다.' },
      4: { kind: 'story', who: '해설', text: '지금까지 만난 모든 드래곤이 한 마리씩 자신의 힘을 나눠준다.' },
      6: { kind: 'story', who: '해설', text: '아르드라는 끝까지 완전히 잠식되지 않는다. 마지막 순간마다, 당신을 다치게 하지 않으려 스스로 움직임을 늦춘다.' },
      7: { kind: 'story', who: '아르드라', text: '…고맙다. 네가 있어서, 나는 끝까지 나로 남을 수 있었다.' },
      10: { kind: 'story', who: '해설', text: '선택의 순간이다.' },
    },
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
    const isBoss = n === 10
    const t = i / 9
    const level = Math.round(lo + (hi - lo) * t)
    /* 1~3스는 1:1로 가볍게, 이후 3:3. 보스는 단일 강적 */
    const count = isBoss ? 1 : n <= 3 ? 1 : 3
    return {
      id: `${ch.id}-${n}`,
      chapter: ch.id,
      no: n,
      name: isBoss ? `${ch.name} — ${ch.boss.name}` : `${ch.region} ${n}`,
      boss: isBoss,
      level,
      count,
      elements: isBoss ? [ch.boss.element] : ch.enemy,
      /* 보스는 체력·공격이 크게 붙는다 */
      statMul: isBoss ? 2.6 : 1,
      beat: ch.beats[n] || null,
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
