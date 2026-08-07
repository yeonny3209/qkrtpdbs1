/* ==================================================================
   튜토리얼 — 순수 로직

   화면에 뭘 그릴지는 여기서 정하지 않는다. "지금 몇 번째 단계이고,
   그 단계가 무엇을 기다리는가" 만 다룬다. 렌더링과 떼어 놓아야
   진행 조건을 화면 없이도 검사할 수 있다.

   [단계 하나의 생김새]
     id      단계 식별자
     title   말풍선 제목
     body    설명 (\n 으로 줄바꿈)
     screen  이 단계가 보여야 하는 화면 (없으면 아무 화면에서나)
     spot    강조할 요소의 표식 — UI 가 data-tut 속성으로 달아 둔다
     need    다음으로 넘어가는 조건
             { type: 'tap' }               말풍선을 눌러 넘긴다
             { type: 'screen', to }        그 화면으로 이동하면 넘어간다
             { type: 'event', name }       게임에서 그 일이 일어나면 넘어간다
     reward  이 단계를 마칠 때 주는 것 (선택)

   [왜 event 가 필요한가]
   "소환을 눌러 보세요" 를 탭으로 넘기면 실제로 눌러보지 않고도
   튜토리얼이 끝난다. 진짜 그 행동을 했을 때만 넘어가야 배운다.
   ================================================================== */

export const TUTORIAL_VERSION = 1

/* 게임 쪽에서 올려 주는 사건 이름들 — 오타를 막으려고 모아 둔다 */
export const TUT_EVENTS = {
  battleStarted: 'battleStarted',
  battleWon: 'battleWon',
  skillUsed: 'skillUsed',
  pulled: 'pulled',
  orbFed: 'orbFed',
  gearEquipped: 'gearEquipped',
}

export const STEPS = [
  {
    id: 'welcome',
    title: '섬에 온 걸 환영해',
    body: '나는 루나야.\n네가 뭘 해야 하는지 하나씩 알려줄게.\n\n(아무 데나 눌러서 넘겨)',
    need: { type: 'tap' },
  },
  {
    id: 'home',
    title: '여기가 거점이야',
    body: '위쪽에 보석과 골드가 있어.\n아래 칸들이 갈 수 있는 곳이고.\n\n하나씩 열어줄 테니 천천히 봐.',
    screen: 'home',
    spot: 'currency',
    need: { type: 'tap' },
  },
  {
    id: 'go-campaign',
    title: '먼저 싸워보자',
    body: '캠페인은 이야기를 따라가는 곳이야.\n1장 1스테이지부터 시작해.\n\n캠페인을 눌러 봐.',
    screen: 'home',
    spot: 'campaign',
    need: { type: 'screen', to: 'campaign' },
  },
  {
    id: 'pick-stage',
    title: '스테이지를 골라',
    body: '잠긴 스테이지는 앞을 깨야 열려.\n지금은 1-1만 열려 있을 거야.\n\n눌러서 들어가 봐.',
    screen: 'campaign',
    spot: 'stage',
    need: { type: 'event', name: TUT_EVENTS.battleStarted },
  },
  {
    id: 'battle-turn',
    title: '전투는 턴제야',
    body: '아래 스킬 버튼을 눌러 공격해.\n\n1스킬은 홀수 턴, 2스킬은 짝수 턴에만 쓸 수 있어.\n궁극기는 쓰고 나면 5턴을 기다려야 해.',
    screen: 'battle',
    spot: 'skills',
    need: { type: 'event', name: TUT_EVENTS.skillUsed },
  },
  {
    id: 'battle-element',
    title: '속성이 중요해',
    body: '화염은 자연에 강하고, 자연은 물에,\n물은 화염에 강해.\n\n빛과 어둠은 서로 강해.\n상성이 맞으면 피해가 크게 늘어.',
    screen: 'battle',
    spot: 'enemy',
    need: { type: 'tap' },
  },
  {
    id: 'battle-win',
    title: '이겨 보자',
    body: '적을 전부 쓰러뜨리면 이겨.\n\n위험하면 나가기 자리의 도주 버튼을 눌러도 돼.\n대신 보상은 없어.',
    screen: 'battle',
    need: { type: 'event', name: TUT_EVENTS.battleWon },
  },
  {
    id: 'orbs',
    title: '경험 구슬로 키워',
    body: '전투에서 얻은 구슬을 드래곤에게 먹이면 레벨이 올라.\n\n스테이지를 깨는 것만으로는 레벨이 안 올라.\n반드시 구슬을 먹여야 해.',
    screen: 'home',
    spot: 'roster',
    need: { type: 'event', name: TUT_EVENTS.orbFed },
    reward: { orbs: { small: 12 } },
  },
  {
    id: 'gear',
    title: '장비도 챙겨',
    body: '무기·방어구·장신구를 끼우면 능력치가 올라.\n\n같은 장비를 겹쳐 강화할 수도 있어.\n50층부터는 룬도 붙일 수 있고.',
    screen: 'roster',
    spot: 'gear',
    need: { type: 'tap' },
  },
  {
    id: 'summon',
    title: '새 드래곤을 데려와',
    body: '보석으로 소환할 수 있어.\n한정 소환은 80번 안에 반드시 레전드가 나와.\n\n보석을 조금 줄게. 한 번 뽑아 봐.',
    screen: 'home',
    spot: 'gacha',
    need: { type: 'event', name: TUT_EVENTS.pulled },
    reward: { gems: 3000 },
  },
  {
    id: 'team',
    title: '편성은 최대 셋',
    body: '드래곤 화면에서 편성을 바꿀 수 있어.\n\n속성을 섞어 두면 어떤 적을 만나도 대응이 돼.',
    screen: 'home',
    spot: 'roster',
    need: { type: 'tap' },
  },
  {
    id: 'extras',
    title: '나머지도 열려 있어',
    body: '던전은 하루 다섯 번, 재료를 줘.\n무한의 탑은 500층까지 있고 올라갈수록 어려워.\n도감에서는 드래곤의 스킬을 미리 볼 수 있어.',
    screen: 'home',
    spot: 'menu',
    need: { type: 'tap' },
  },
  {
    id: 'done',
    title: '여기까지',
    body: '이제 혼자서도 할 수 있을 거야.\n\n…그리고, 뭔가 이상한 게 보여도\n너무 놀라지 마.',
    need: { type: 'tap' },
    reward: { gems: 1000, gold: 5000 },
  },
]

export const STEP_COUNT = STEPS.length
export const stepAt = (i) => STEPS[i] || null
export const stepIndexOf = (id) => STEPS.findIndex((s) => s.id === id)

export const freshTutorial = () => ({ step: 0, done: false, version: TUTORIAL_VERSION })

/* 아직 안 끝났고, 저장본이 지금 버전과 같은가.
   버전이 다르면(단계를 갈아엎었으면) 다시 안 띄운다 — 이미 게임을
   진행 중인 사람에게 튜토리얼이 되살아나면 짜증만 난다. */
export function isRunning(tut) {
  if (!tut) return false
  if (tut.done) return false
  if (tut.version !== TUTORIAL_VERSION) return false
  return tut.step < STEP_COUNT
}

/* 지금 단계가 이 화면에서 보여야 하는가 */
export function visibleOn(tut, screen) {
  if (!isRunning(tut)) return false
  const s = stepAt(tut.step)
  if (!s) return false
  return !s.screen || s.screen === screen
}

/* 화면을 눌러 넘길 수 있는 단계인가 */
export function isTappable(tut) {
  const s = isRunning(tut) ? stepAt(tut.step) : null
  return !!s && s.need.type === 'tap'
}

/* 한 단계 진행. 넘어갔으면 { tut, reward }, 아니면 그대로 돌려준다. */
export function advance(tut) {
  if (!isRunning(tut)) return { tut, reward: null }
  const s = stepAt(tut.step)
  return { tut: { ...tut, step: tut.step + 1, done: tut.step + 1 >= STEP_COUNT }, reward: s.reward || null }
}

/* 화면이 바뀌었다 — 그걸 기다리던 단계면 넘어간다 */
export function onScreen(tut, screen) {
  if (!isRunning(tut)) return { tut, reward: null }
  const s = stepAt(tut.step)
  if (s.need.type === 'screen' && s.need.to === screen) return advance(tut)
  return { tut, reward: null }
}

/* 게임에서 어떤 일이 일어났다 */
export function onEvent(tut, name) {
  if (!isRunning(tut)) return { tut, reward: null }
  const s = stepAt(tut.step)
  if (s.need.type === 'event' && s.need.name === name) return advance(tut)
  return { tut, reward: null }
}

/* 건너뛰기 */
export const skipAll = (tut) => ({ ...(tut || freshTutorial()), step: STEP_COUNT, done: true })

/* 다시 보기 — 설정에서 부른다 */
export const restart = () => freshTutorial()

/* 진행률 (0~1) */
export const progressOf = (tut) =>
  !tut ? 0 : Math.min(1, (tut.done ? STEP_COUNT : tut.step) / STEP_COUNT)
