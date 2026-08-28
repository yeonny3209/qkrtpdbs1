/* ==================================================================
   연구소 = 대원이 갇힌 곳 (§12.1)

   이 게임의 메인 목표선이다. 원작에서 아이를 구할 때마다 필요한 밤이
   줄어드는 구조를 계승하되, 연구소 4단계와 탈출 장비를 하나로 묶었다.
   연구소 하나를 깨면 **대원 하나 + 핵심 부품 하나**가 동시에 나온다.

   규칙 둘이 짝이다.

     - 들어가면 문이 잠기고, 전멸시켜야 열린다
       (없으면 그냥 도망치고 끝이라 전투가 아니라 관광이 된다)
     - 안에서는 밤 시간이 흐르지 않는다
       (없으면 3단계 공략 중 밤을 맞고 갇힌 채로 무조건 죽는다)

   지하 내부를 따로 만들지 않고 **원형 교전장**으로 표현한다. 문서가
   내부 구조를 정하지 않았고, 탑다운에서 "못 나가는 원"은 잠긴 문을
   가장 적은 그림으로 보여 준다.
   ================================================================== */
import { BALANCE, ENEMIES, CREW } from '../data/index.ts'
import type { GameState, Lab } from '../core/GameState.ts'
import { distance, toast, banner } from '../core/GameState.ts'
import { spawnBeast } from '../entities/Animal.ts'
import { navDisabled } from './WeatherSystem.ts'

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

/** 나침반이 가리키는 곳. 자기폭풍 중에는 안 듣는다(§15). */
export function compassTarget(s: GameState): Lab | null {
  if (navDisabled(s)) return null
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

  /* 바깥 짐승은 밖에 둔다. 안은 구성표가 전부다. */
  s.beasts = s.beasts.filter((b) => distance(b.x, b.z, lab.x, lab.z) > LAB_RADIUS + 6)

  const rng = s.streams.spawn
  const comp = COMPOSITION[lab.tier] ?? []
  const total = comp.reduce((a, c) => a + c.count, 0)
  let placed = 0
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
  banner(s, `${lab.tier}단계 연구소 — 문이 잠겼습니다`, 3.5)
  return true
}

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

  /* 밖으로 못 나간다. 경계에서 미끄러지게 해서 벽에 붙어 싸울 수
     있게 한다 — 튕겨 내면 조작이 어긋난 것처럼 느껴진다. */
  const p = s.player
  if (distance(p.x, p.z, active.x, active.z) > active.radius) {
    const a = Math.atan2(p.z - active.z, p.x - active.x)
    p.x = active.x + Math.cos(a) * active.radius
    p.z = active.z + Math.sin(a) * active.radius
  }

  if (remaining(s) > 0) return

  const lab = s.labs.find((l) => l.id === active.id)
  if (lab && !lab.cleared) {
    lab.cleared = true
    s.coreParts.push(lab.core)
    s.crew.push(lab.crew)
    s.crewT[lab.crew] = 0
    const def = CREW.find((c) => c.id === lab.crew)
    banner(s, `${def?.name ?? '대원'} 구출 — ${def?.role ?? ''}`, 4)
    toast(s, `${def?.desc ?? ''}`, 'good')
    toast(s, '날짜 증가량이 올랐습니다', 'good')
    s.events.push('crewRescued')
  }
  s.activeLab = null
}
