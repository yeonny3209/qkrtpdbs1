/* ==================================================================
   인벤토리 · 크래프팅 · 캠프파이어 창

   전부 DOM 이다(§17.1). 캔버스 위에 UI 를 직접 그리면 글자 정렬과
   스크롤을 손으로 만들어야 하는데, 그건 게임이 아니라 브라우저가
   훨씬 잘하는 일이다.

   크래프팅 목록은 **잠긴 것도 보여 준다**. 목표가 보여야 모은다 —
   4레벨 도크가 있다는 걸 1레벨에서 알아야 고철을 아끼기 시작한다.
   ================================================================== */
import type { GameState } from '../core/GameState.ts'
import { ITEMS, FUEL, itemName } from '../data/index.ts'
import { countItem } from '../core/GameState.ts'
import {
  visibleRecipes, craft, upgradeCost, upgradeMachine, pressAmmo,
} from '../systems/CraftingSystem.ts'
import { addFuel, fuelUnlocked, startCooking } from '../systems/CampfireSystem.ts'
import { grindJunk, storeWood, withdrawWood, totalStoredWood } from '../systems/InventorySystem.ts'
import { eat } from '../systems/SurvivalSystem.ts'

export type PanelKind = 'inventory' | 'crafting' | 'campfire' | null

export class Panels {
  private kind: PanelKind = null

  constructor(private root: HTMLElement, private onClose: () => void) {}

  get open(): PanelKind {
    return this.kind
  }

  show(kind: PanelKind, s: GameState): void {
    this.kind = kind
    if (!kind) {
      this.root.innerHTML = ''
      return
    }
    this.render(s)
  }

  close(): void {
    this.kind = null
    this.root.innerHTML = ''
    this.onClose()
  }

  render(s: GameState): void {
    if (!this.kind) return
    const body =
      this.kind === 'inventory' ? this.inventoryHtml(s)
      : this.kind === 'crafting' ? this.craftingHtml(s)
      : this.campfireHtml(s)

    this.root.innerHTML = `<div class="panel"><div class="panel-inner">${body}</div></div>`
    this.bind(s)
  }

  private bind(s: GameState): void {
    this.root.querySelectorAll<HTMLElement>('[data-act]').forEach((el) => {
      el.addEventListener('click', () => {
        const act = el.dataset.act!
        const arg = el.dataset.arg ?? ''
        this.act(s, act, arg)
      })
    })
    const closeBtn = this.root.querySelector('[data-close]')
    closeBtn?.addEventListener('click', () => this.close())
  }

  private act(s: GameState, act: string, arg: string): void {
    switch (act) {
      case 'craft': craft(s, arg); break
      case 'upgrade': upgradeMachine(s); break
      case 'grind': grindJunk(s); break
      case 'press': pressAmmo(s); break
      case 'fuel': addFuel(s, arg); break
      case 'cook': startCooking(s, arg); break
      case 'eat': eat(s, arg); break
      case 'equip': {
        const def = ITEMS[arg]
        if (def?.kind === 'gun') {
          s.player.gun = arg
          s.player.magazine = 0
        } else {
          s.player.equipped = arg
          if (def?.kind === 'tool') s.player.gun = null
        }
        break
      }
      case 'store': storeWood(s, 25); break
      case 'take': withdrawWood(s, 25); break
      default: break
    }
    this.render(s)
  }

  /* ── 인벤토리 ─────────────────────────────────────────────── */
  private inventoryHtml(s: GameState): string {
    const rows = s.player.slots
      .map((slot, i) => {
        if (!slot) return `<div class="card disabled"><div class="name">칸 ${i + 1}</div><div class="desc">비어 있음</div></div>`
        const def = ITEMS[slot.id]
        const acts: string[] = []
        if (def.kind === 'food') acts.push(`<button class="btn" data-act="eat" data-arg="${slot.id}">먹기</button>`)
        if (def.kind === 'tool' || def.kind === 'gun') acts.push(`<button class="btn" data-act="equip" data-arg="${slot.id}">들기</button>`)
        return `<div class="card">
          <div class="name">${def.icon} ${def.name} ${slot.count > 1 ? `×${slot.count}` : ''}</div>
          <div class="desc">${describe(def.kind)}</div>
          <div class="row" style="margin-top:8px">${acts.join('')}</div>
        </div>`
      })
      .join('')

    const stored = totalStoredWood(s)
    const hasStorage = s.buildings.some((b) => b.type === 'wood_storage')

    return `
      <h2>가방</h2>
      <div class="sub">잡동사니는 한 칸씩 차지합니다 — 한 번에 다 못 들고 옵니다</div>
      <div class="grid cols-4">${rows}</div>
      ${hasStorage ? `
        <div class="section-title">나무 저장고 · 보관 ${stored}</div>
        <div class="row">
          <button class="btn" data-act="store">통나무 넣기</button>
          <button class="btn" data-act="take">통나무 꺼내기</button>
          <span class="sub" style="margin:0">저장고 안에서는 썩지 않습니다</span>
        </div>` : `
        <div class="section-title">경고</div>
        <div class="sub">저장고가 없습니다. 가방 속 통나무는 10분이면 썩습니다.</div>`}
      <div class="row" style="margin-top:22px">
        <div class="spacer"></div>
        <button class="btn ghost" data-close>닫기 (Tab)</button>
      </div>`
  }

  /* ── 크래프팅 ─────────────────────────────────────────────── */
  private craftingHtml(s: GameState): string {
    const groups: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [] }

    for (const { id, def, blocked } of visibleRecipes(s)) {
      const costs = Object.entries(def.cost)
        .map(([cid, n]) => {
          const have = cid.startsWith('core_') ? (s.coreParts.includes(cid) ? 1 : 0) : countItem(s, cid)
          const ok = have >= n
          return `<span style="color:${ok ? 'var(--glow)' : 'var(--warm)'}">${itemName(cid)} ${have}/${n}</span>`
        })
        .join(' · ')
      const cls = blocked === null ? '' : ' disabled'
      const why = blocked === 'level' ? ' · 레벨 부족'
        : blocked === 'max' ? ' · 최대'
        : blocked === 'dockMissing' ? ' · 도크 필요'
        : blocked === 'alreadyBuilt' ? ' · 설치됨'
        : blocked === 'placement' ? ' · 우주선 근처에서만'
        : ''
      groups[def.level].push(`
        <div class="card${cls}" ${blocked === null ? `data-act="craft" data-arg="${id}"` : ''}>
          <div class="name">${def.name}${why}</div>
          <div class="desc">${def.desc}</div>
          <div class="cost">${costs}</div>
        </div>`)
    }

    const up = upgradeCost(s.craftLevel)
    const upCosts = up
      ? Object.entries(up).map(([cid, n]) => {
        const have = countItem(s, cid)
        return `<span style="color:${have >= n ? 'var(--glow)' : 'var(--warm)'}">${itemName(cid)} ${have}/${n}</span>`
      }).join(' · ')
      : ''

    const junk = s.player.slots.filter((x) => x && ITEMS[x.id]?.kind === 'junk').length
    const hasPress = s.buildings.some((b) => b.type === 'ammo_press')

    return `
      <h2>크래프팅 기계 <span style="color:var(--glow)">Lv${s.craftLevel}</span></h2>
      <div class="sub">잠긴 항목도 보여 줍니다 — 무엇을 모아야 할지 알아야 하니까</div>

      <div class="row">
        ${up ? `<button class="btn primary" data-act="upgrade">Lv${s.craftLevel + 1} 로 업그레이드</button><span class="cost">${upCosts}</span>` : '<span class="sub" style="margin:0">최고 레벨입니다</span>'}
        <div class="spacer"></div>
        <button class="btn" data-act="grind" ${junk === 0 ? 'disabled' : ''}>잡동사니 갈기 (${junk}칸)</button>
        ${hasPress ? '<button class="btn" data-act="press">탄약 압착 (고철 4 → 6발)</button>' : ''}
      </div>

      ${[1, 2, 3, 4].map((lv) => groups[lv].length
        ? `<div class="section-title">레벨 ${lv}</div><div class="grid cols-3">${groups[lv].join('')}</div>`
        : '').join('')}

      <div class="row" style="margin-top:22px">
        <div class="spacer"></div>
        <button class="btn ghost" data-close>닫기 (E)</button>
      </div>`
  }

  /* ── 캠프파이어 ───────────────────────────────────────────── */
  private campfireHtml(s: GameState): string {
    const fuels = Object.keys(FUEL).map((id) => {
      const have = countItem(s, id)
      const unlocked = fuelUnlocked(s, id)
      const disabled = have <= 0 || !unlocked
      const def = FUEL[id]
      return `<div class="card${disabled ? ' disabled' : ''}" ${disabled ? '' : `data-act="fuel" data-arg="${id}"`}>
        <div class="name">${ITEMS[id].icon} ${itemName(id)} ×${have}</div>
        <div class="desc">등급 ${def.grade} · ${def.burnSeconds}초 · 안전반경 ${[0, 8, 14, 22, 32][def.grade]}타일</div>
        ${unlocked ? '' : '<div class="cost">캠프파이어를 한 단계 더 키워야 나타납니다</div>'}
      </div>`
    }).join('')

    const raw = ['meat_small_raw', 'meat_large_raw'].map((id) => {
      const have = countItem(s, id)
      return `<div class="card${have <= 0 ? ' disabled' : ''}" ${have <= 0 ? '' : `data-act="cook" data-arg="${id}"`}>
        <div class="name">${ITEMS[id].icon} ${itemName(id)} ×${have}</div>
        <div class="desc">구우면 배고픔 회복이 세 배가 되고 우주복이 안 깎입니다</div>
      </div>`
    }).join('')

    const cooking = s.campfire.cooking
      ? `<div class="sub">굽는 중… ${Math.ceil(s.campfire.cooking.remain)}초</div>`
      : ''

    return `
      <h2>캠프파이어 <span style="color:var(--warm)">Lv${s.campfire.level}</span></h2>
      <div class="sub">지금 타는 연료 중 가장 높은 등급이 곧 레벨입니다. 기름이 다 타면 즉시 내려갑니다.</div>
      <div class="section-title">연료 넣기</div>
      <div class="grid cols-4">${fuels}</div>
      <div class="section-title">굽기</div>
      ${cooking}
      <div class="grid cols-2">${raw}</div>
      <div class="row" style="margin-top:22px">
        <div class="spacer"></div>
        <button class="btn ghost" data-close>닫기 (E)</button>
      </div>`
  }
}

function describe(kind: string): string {
  switch (kind) {
    case 'resource': return '자원'
    case 'fuel': return '캠프파이어 연료'
    case 'junk': return '크래프팅 기계에서 고철로'
    case 'food': return '음식'
    case 'tool': return '도구'
    case 'gun': return '총기'
    case 'ammo': return '탄약'
    case 'gear': return '장비'
    case 'core': return '탈출선 핵심 부품'
    default: return ''
  }
}
