/* ==================================================================
   구출한 대원 (§12.2)

   원작은 협동 게임이라 팀원이 캠프를 지키고 연료를 넣어 준다. 싱글
   플레이에서 그 역할을 AI 대원이 대신한다. 덕분에 **"파밍하러 나갔더니
   불이 꺼져 있더라"** 는 초반의 좌절이 중반부터 해소되고, 위험을
   무릅쓰고 연구소에 들어갈 강한 동기가 생긴다.

   ── 로한이 이 게임을 너무 쉽게 만드는가 (§부록B-4)

   기획서가 직접 의심하는 부분이다. 연료 자동 투입은 캠프파이어 압박을
   통째로 없앨 수 있다. 그래서 두 가지로 묶어 두었다.

     1. 투입 주기 30초는 crew.json 한 줄이다 (60초로 늘릴 여지)
     2. **저장고에 연료가 있을 때만** 넣는다. 채워 두는 것은 여전히
        사람 몫이라, 압박이 사라지는 게 아니라 "연료를 모으는 일"로
        옮겨 간다

   대원은 캠프 근처에 머문다. 따라다니게 하면 밖에서 죽고, 죽으면
   §12.2 의 효과가 사라져 억울하다. 상주가 규칙이다.
   ================================================================== */
import { CREW, BALANCE } from '../data/index.ts'
import type { GameState } from '../core/GameState.ts'
import { distance, addItem, toast, hasCrew } from '../core/GameState.ts'
import { CENTER } from '../world/Tilemap.ts'
import { addFuelDirect } from '../systems/CampfireSystem.ts'
import { takeBestFuelFromStorage } from '../systems/InventorySystem.ts'
import { damageRaider } from './Raider.ts'
import { damageBeast } from './Animal.ts'

export function crewDef(id: string) {
  return CREW.find((c) => c.id === id)
}

/** 대원이 서 있는 자리 — 캠프파이어 둘레에 고르게 */
export function crewPosition(index: number, total: number): { x: number; z: number } {
  const a = (index / Math.max(1, total)) * Math.PI * 2 + 0.6
  const r = 3.4
  return { x: CENTER + Math.cos(a) * r, z: CENTER + Math.sin(a) * r }
}

/** 미라가 있으면 밭 주기가 짧아진다(§12.2) */
export function farmGrowDays(s: GameState): number {
  return hasCrew(s, 'mira') ? BALANCE.farm.growDaysWithBotanist : BALANCE.farm.growDays
}

export function updateAll(s: GameState, dt: number): void {
  if (s.crew.length === 0) return
  if (s.phase === 'dead' || s.phase === 'escaped' || s.phase === 'asteroid') return

  for (const id of s.crew) {
    const def = crewDef(id)
    if (!def) continue
    s.crewT[id] = (s.crewT[id] ?? 0) + dt

    /* 로한 — 화부. 저장고에서 꺼내 불에 넣는다. */
    if (id === 'rohan') {
      const period = def.stokeSeconds ?? 30
      if (s.crewT[id] >= period) {
        s.crewT[id] = 0
        const fuel = takeBestFuelFromStorage(s)
        if (fuel) {
          addFuelDirect(s, fuel)
          s.events.push('crewStoke')
        }
      }
    }

    /* 카이 — 경비. 캠프 근처의 적을 쏜다. */
    if (id === 'kai') {
      const cd = def.guardCooldown ?? 0.9
      if (s.crewT[id] >= cd) {
        const pos = crewPosition(s.crew.indexOf(id), s.crew.length)
        const range = def.guardRange ?? 12
        let shot = false
        for (const list of [s.raiders, s.beasts]) {
          for (const t of list) {
            if (t.hp <= 0) continue
            if (distance(pos.x, pos.z, t.x, t.z) > range) continue
            if (list === s.raiders) damageRaider(s, t, def.guardDamage ?? 60)
            else damageBeast(s, t, def.guardDamage ?? 60)
            s.events.push('crewShot')
            shot = true
            break
          }
          if (shot) break
        }
        if (shot) s.crewT[id] = 0
      }
    }
  }
}

/** 일출마다 — 미라가 밭을 대신 거둔다(§12.2) */
export function autoHarvest(s: GameState): void {
  if (!hasCrew(s, 'mira')) return
  let got = 0
  for (const b of s.buildings) {
    if (b.type !== 'farm' || !b.crop) continue
    if (addItem(s, b.crop, 1) === 0) {
      b.crop = null
      got++
    }
  }
  if (got > 0) toast(s, `미라가 작물 ${got}개를 거뒀습니다`, 'good')
}

/** 엘렌이 있으면 보급함·연구소가 지도에 뜬다(§12.2) */
export function revealsMap(s: GameState): boolean {
  return hasCrew(s, 'ellen')
}
