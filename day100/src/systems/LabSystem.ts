/* ==================================================================
   연구소

   §12.1 의 두 규칙이 전부다.

     - 들어가면 문이 잠기고, 전멸시켜야 열린다
     - 안에서는 밤 시간이 흐르지 않는다

   둘째 규칙이 없으면 3단계(변이 늑대 8마리)를 공략하다 밤을 맞고
   문이 잠긴 채로 무조건 죽는다. 첫째 규칙이 없으면 그냥 도망치고
   끝이라 연구소가 전투가 아니라 관광이 된다. 둘이 짝이다.

   지하 내부를 따로 만들지 않고 **원형 교전장**으로 표현한다. 문서가
   내부 구조를 정하지 않았고, 탑다운에서 "못 나가는 원"은 잠긴 문을
   가장 적은 그림으로 보여 준다.
   ================================================================== */
import type { GameState, Lab } from '../core/GameState.ts'
import { distance, toast } from '../core/GameState.ts'
import { BALANCE, ENEMIES } from '../data/index.ts'
import { spawnBeast } from '../entities/Animal.ts'

export const LAB_RADIUS = 11

/* 단계별 구성(§12.1). 총 HP 는 이 구성에서 저절로 나온다 —
   600 / 900 / 2400 / 4800. */
const COMPOSITION: Record<number, { type: string; count: number }[]> = {
  1: [{ type: 'wolf', count: 6 }],
  2: [{ type: 'wolf', count: 3 }, { type: 'mutant_wolf', count: 2 }],
  3: [{ type: 'mutant_wolf', count: 8 }],
  4: [{ type: 'bear', count: 6 }],
}

export function labTotalHp(tier: number): number {
  let hp = 0
  for (const c of COMPOSITION[tier] ?? []) hp += ENEMIES[c.type].hp * c.count
  return hp
}

export function nearestLab(s: GameState): Lab | null {
  let best: Lab | null = null
  let bd = BALANCE.player.interactRange
  for (const l of s.labs) {
    if (l.cleared) continue
    const d = distance(s.player.x, s.player.z, l.x, l.z)
    if (d < bd) {
      bd = d
      best = l
    }
  }
  return best
}

/** 나침반이 가리키는 곳 — 가장 가까운 미공략 연구소(§8.3). */
export function compassTarget(s: GameState): Lab | null {
  let best: Lab | null = null
  let bd = Infinity
  for (const l of s.labs) {
    if (l.cleared) continue
    const d = distance(s.player.x, s.player.z, l.x, l.z)
    if (d < bd) {
      bd = d
      best = l
    }
  }
  return best
}

export function enter(s: GameState, lab: Lab): boolean {
  if (s.activeLab || lab.cleared) return false

  s.activeLab = { id: lab.id, x: lab.x, z: lab.z, radius: LAB_RADIUS }
  s.player.x = lab.x
  s.player.z = lab.z

  /* 바깥 짐승은 밖에 둔다. 연구소 안은 구성표가 전부다. */
  s.beasts = s.beasts.filter((b) => distance(b.x, b.z, lab.x, lab.z) > LAB_RADIUS + 6)

  const rng = s.streams.spawn
  const comp = COMPOSITION[lab.tier] ?? []
  let placed = 0
  const total = comp.reduce((a, c) => a + c.count, 0)
  for (const c of comp) {
    for (let i = 0; i < c.count; i++) {
      const a = (placed / total) * Math.PI * 2 + rng() * 0.5
      const r = LAB_RADIUS * (0.55 + rng() * 0.35)
      const b = spawnBeast(s, c.type, lab.x + Math.cos(a) * r, lab.z + Math.sin(a) * r)
      b.state = 'chase'
      placed++
    }
  }

  s.events.push('labEnter')
  toast(s, `${lab.tier}단계 연구소 — 문이 잠겼습니다`, 'warn')
  return true
}

/** 안에 남은 적이 있는가. 없으면 문이 열린다. */
export function remaining(s: GameState): number {
  const lab = s.activeLab
  if (!lab) return 0
  let n = 0
  for (const b of s.beasts) {
    if (b.hp > 0 && distance(b.x, b.z, lab.x, lab.z) <= lab.radius + 2) n++
  }
  return n
}

export function update(s: GameState): void {
  const active = s.activeLab
  if (!active) return

  /* 밖으로 못 나간다. 원 경계에서 미끄러지게 해서, 벽에 붙어 싸울 수
     있게 한다 — 튕겨 내면 조작이 어긋난 것처럼 느껴진다. */
  const p = s.player
  const d = distance(p.x, p.z, active.x, active.z)
  if (d > active.radius) {
    const a = Math.atan2(p.z - active.z, p.x - active.x)
    p.x = active.x + Math.cos(a) * active.radius
    p.z = active.z + Math.sin(a) * active.radius
  }

  if (remaining(s) > 0) return

  /* 전멸 — 보상을 주고 문을 연다 */
  const lab = s.labs.find((l) => l.id === active.id)
  if (lab && !lab.cleared) {
    lab.cleared = true
    s.coreParts.push(lab.reward)
    toast(s, '핵심 부품 획득 — 날짜 증가량이 올랐습니다', 'good')
    s.events.push('labClear')
  }
  s.activeLab = null
}

/** 무기고 전리품과 같은 자리에서 쓰는 도우미 — 남은 연구소 수 */
export function labsLeft(s: GameState): number {
  return s.labs.filter((l) => !l.cleared).length
}
