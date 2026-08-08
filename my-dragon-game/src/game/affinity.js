/* ==================================================================
   속성 상성

   속성이 여덟이나 되는데 지금까지 겉모습과 능력치 성향만 갈랐다.
   스테이지마다, 탑 층마다, 던전마다 적 속성을 정해뒀는데 전투가 그
   값을 한 번도 읽지 않았다. 그래서 편성이 "가진 것 중 제일 센 셋"으로
   끝났다 — 고를 것이 없으면 고르는 재미도 없다.

   상성표는 외우게 만들면 진다. 규칙이 짧아야 머리에 남는다. 그래서
   가위바위보 고리 두 개로 끝냈다 — 표를 펴지 않아도 말로 옮길 수 있다.

     · 자연 다섯 고리
         화염 → 빙결 → 뇌전 → 대지 → 풍 → 화염
     · 신성 세 고리
         빛 → 암흑 → 신비 → 빛

   화살표마다 현실의 이유를 하나씩 붙였다 (AFF_REASON). 이유가 있으면
   표를 안 보고도 떠올릴 수 있다.

   두 고리는 서로 엮이지 않는다. 자연과 신성이 섞이는 순간 "한 줄로
   설명되던 규칙"이 무너지고, 결국 표를 외워야 하는 게임이 된다.

   5 + 3 = 8. 여덟 속성이 하나씩 찌르고 하나씩 찔린다 — 어느 쪽도
   공짜로 이득 보지 않는다.

   처음에는 빛과 암흑이 서로를 무는 "맞대결"로 두려 했다. 그런데
   양쪽 다 1.5배면 어느 쪽을 꺼내도 유불리가 같아서, 고를 이유가
   없는 선택지가 된다. 상성을 넣는 이유가 편성을 고민하게 만드는
   것인데 그걸 스스로 지우는 설계였다.
   ================================================================== */

/* 유리할 때 곱, 불리할 때 곱.
   1.5 / 0.65 는 "상성을 맞추면 눈에 띄게 빨리 끝나지만, 틀려도 이길
   수는 있는" 폭이다. 2.0 / 0.5 로 벌리면 상성이 안 맞는 판은 아예
   포기하게 되고, 1.2 / 0.85 로 좁히면 맞춰봐야 티가 안 나 아무도
   신경 쓰지 않는다. */
export const AFF_STRONG = 1.5
export const AFF_WEAK = 0.65
export const AFF_EVEN = 1

/* 고리를 그대로 적는다. 표를 손으로 펴 놓으면 언젠가 화살표 하나가
   어긋나는데, 고리로 두면 그럴 자리가 없다. */
export const WHEELS = [
  { id: 'nature', name: '자연', ring: ['fire', 'ice', 'thunder', 'earth', 'wind'] },
  { id: 'divine', name: '신성', ring: ['light', 'dark', 'mystic'] },
]

/* 각 속성이 "때릴 때 유리한" 상대 — 고리에서 자동으로 편다 */
export const STRONG_AGAINST = Object.fromEntries(
  WHEELS.flatMap(({ ring }) => ring.map((el, i) => [el, [ring[(i + 1) % ring.length]]])),
)

/* 왜 유리한지 — 화면에서 그대로 보여준다.
   표만 보여주면 외워야 하지만, 이유를 보여주면 이해하고 넘어간다. */
export const AFF_REASON = {
  fire: '불길이 얼음을 녹인다',
  ice: '얼음은 전기를 통하지 않아 뇌격을 잠재운다',
  thunder: '벼락이 바위를 쪼갠다',
  earth: '산이 바람을 막아선다',
  wind: '바람이 불길을 흩어버린다',
  light: '빛이 어둠을 몰아낸다',
  dark: '어둠이 주문을 집어삼킨다',
  mystic: '신비가 빛을 굴절시켜 흩는다',
}

/* 자기를 때릴 때 유리한 상대 — STRONG_AGAINST 를 뒤집어 만든다.
   손으로 두 표를 관리하면 언젠가 반드시 어긋난다. */
export const WEAK_TO = Object.fromEntries(
  Object.keys(STRONG_AGAINST).map((el) => [
    el,
    Object.keys(STRONG_AGAINST).filter((other) => STRONG_AGAINST[other].includes(el)),
  ]),
)

export const counters = (el) => STRONG_AGAINST[el] || []
export const counteredBy = (el) => WEAK_TO[el] || []

/* 공격 속성 → 방어 속성 피해 배수 */
export function affinity(atkEl, defEl) {
  if (!atkEl || !defEl) return AFF_EVEN
  if (counters(atkEl).includes(defEl)) return AFF_STRONG
  if (counteredBy(atkEl).includes(defEl)) return AFF_WEAK
  return AFF_EVEN
}

/* 'strong' | 'weak' | 'even' — 화면이 색과 화살표를 고를 때 쓴다 */
export function matchup(atkEl, defEl) {
  const m = affinity(atkEl, defEl)
  return m > 1 ? 'strong' : m < 1 ? 'weak' : 'even'
}

/* 전투 로그에 남길 한 줄. 상성이 없으면 null 이라 아무 말도 안 한다 —
   매 타격마다 "보통이다"가 뜨면 정작 중요한 순간이 묻힌다. */
export const MATCHUP_TEXT = { strong: '효과가 굉장하다!', weak: '효과가 별로다…', even: null }
export const MATCHUP_MARK = { strong: '▲', weak: '▼', even: '' }
export const matchupText = (atkEl, defEl) => MATCHUP_TEXT[matchup(atkEl, defEl)]

/* ------------------------------------------------------------------
   편성 미리보기 — 이 팀으로 저 적을 상대하면 어떤가

   전투에 들어가기 전에 알려주지 않으면 상성은 그냥 "졌는데 이유를
   모르겠는" 장치가 된다. 내 쪽이 때릴 때 유리한 짝과, 맞을 때 불리한
   짝을 따로 센다 — 둘은 다른 이야기다. 상대를 찌르면서 동시에 찔리는
   편성은 빨리 끝나지만 위험하고, 그 사실이 화면에 보여야 한다.
   ------------------------------------------------------------------ */
export function teamMatchup(myElements = [], foeElements = []) {
  let adv = 0      // 내가 때릴 때 유리한 짝
  let dis = 0      // 적이 때릴 때 유리한 짝 (내가 아픈 쪽)
  for (const me of myElements) {
    for (const foe of foeElements) {
      if (affinity(me, foe) > 1) adv++
      if (affinity(foe, me) > 1) dis++
    }
  }
  const total = Math.max(1, myElements.length * foeElements.length)
  /* 유불리를 하나의 값으로 눌러 화면이 색 하나만 고르게 한다 */
  const score = (adv - dis) / total
  return {
    adv,
    dis,
    score,
    verdict: score > 0.08 ? 'good' : score < -0.08 ? 'bad' : 'even',
  }
}

/* 저 적들에게 유리한 속성은 무엇인가 — 편성 화면의 추천에 쓴다.
   많이 찌르는 속성이 앞에 온다. */
export function recommendedAgainst(foeElements = []) {
  const score = {}
  for (const el of Object.keys(STRONG_AGAINST)) {
    const hits = foeElements.filter((f) => affinity(el, f) > 1).length
    const risk = foeElements.filter((f) => affinity(f, el) > 1).length
    if (hits > risk) score[el] = hits - risk
  }
  return Object.keys(score).sort((a, b) => score[b] - score[a])
}
