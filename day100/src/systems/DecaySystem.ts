/* ==================================================================
   부패와 성장

   통나무는 10분이면 썩는다(§7.1). 이게 이 게임에서 제일 얄궂은
   규칙인데, 목적이 분명하다 — **모아 두기를 막는다**. 저장고 없이
   통나무를 쌓아 두는 빌드를 원천봉쇄해서, 고철 2개짜리 저장고가
   탈출 장비만큼 중요한 물건이 되게 한다.

   ── 처음에 틀렸던 방식

   개수에 비례해 조금씩 떼는 방식으로 짰다가 테스트에서 걸렸다.
   "10분에 전부"를 개수로 나눠 떼면 남은 개수가 줄수록 속도도 줄어서,
   20개가 0이 되는 데 36분이 걸렸다. 조화급수라 영영 안 끝난다.

   지금은 **들어온 시각별로 묶어서** 센다. 10분 전에 들어온 묶음이
   통째로 사라진다. 통나무 하나하나에 시각을 달지 않아도 되고,
   "10분 뒤에 사라진다"는 말이 말 그대로 성립한다.

   묶음은 addItem/removeItem 에 갈고리를 걸지 않고 매 프레임 대조해서
   맞춘다. 총량이 늘었으면 새 묶음, 줄었으면 오래된 것부터 뺀다.
   덕분에 인벤토리 코드는 부패를 몰라도 된다.
   ================================================================== */
import { BALANCE } from '../data/index.ts'
import type { GameState } from '../core/GameState.ts'
import { countItem, removeItem, toast } from '../core/GameState.ts'

const D = BALANCE.decay

type Batch = { count: number; age: number }
type DecayState = { batches: Batch[] }

const KEY = '__decay'

function decayOf(s: GameState): DecayState {
  const holder = s as unknown as Record<string, DecayState>
  holder[KEY] ??= { batches: [] }
  return holder[KEY]
}

/** 검사용 — 지금 추적 중인 통나무 총량 */
export function trackedWood(s: GameState): number {
  return decayOf(s).batches.reduce((a, b) => a + b.count, 0)
}

export function update(s: GameState, dt: number): void {
  if (s.phase === 'dead' || s.phase === 'escaped') return
  const st = decayOf(s)

  /* 1. 가방과 장부를 맞춘다 */
  const carried = countItem(s, 'wood')
  const tracked = trackedWood(s)

  if (carried > tracked) {
    st.batches.push({ count: carried - tracked, age: 0 })
  } else if (carried < tracked) {
    /* 오래된 것부터 썼다고 본다. 저장고에 넣거나 제작에 쓴 통나무는
       이미 위험을 넘긴 것부터 나가는 편이 플레이어에게 유리하고,
       실제로도 사람은 먼저 주운 것을 먼저 쓴다. */
    let spend = tracked - carried
    while (spend > 0 && st.batches.length > 0) {
      const head = st.batches[0]
      const take = Math.min(head.count, spend)
      head.count -= take
      spend -= take
      if (head.count <= 0) st.batches.shift()
    }
  }

  /* 2. 나이를 먹이고, 다 된 묶음을 버린다 */
  let rotted = 0
  for (const b of st.batches) b.age += dt
  while (st.batches.length > 0 && st.batches[0].age >= D.woodDecaySeconds) {
    rotted += st.batches[0].count
    st.batches.shift()
  }
  if (rotted > 0) {
    removeItem(s, 'wood', rotted)
    s.events.push('decay')
    toast(s, `통나무 ${rotted}개가 썩었습니다`, 'warn')
  }

  /* 묘목 자라기 */
  for (const t of s.trees) {
    if (t.kind !== 'sapling') continue
    t.growT -= dt
    if (t.growT <= 0) {
      t.kind = 'tree_small'
      t.hits = 0
      s.events.push('grown')
    }
  }

  /* 건물 쿨타임 */
  for (const b of s.buildings) {
    if (b.cooldown !== undefined && b.cooldown > 0) b.cooldown = Math.max(0, b.cooldown - dt)
  }
}

/** 일출마다. 밭은 실시간이 아니라 날짜로 자란다(§7.5). */
export function harvestFarms(s: GameState): void {
  for (const b of s.buildings) {
    if (b.type !== 'farm') continue
    if ((b.timerDays ?? 0) < BALANCE.farm.growDays) continue
    b.timerDays = 0
    /* 이미 열린 작물을 안 거두면 다음 주기에 썩는다 */
    if (b.crop) {
      b.crop = null
      toast(s, '수확하지 않은 작물이 썩었습니다', 'warn')
      continue
    }
    b.crop = s.streams.farm.chance(BALANCE.farm.carrotChance) ? 'carrot' : 'corn'
  }
}
