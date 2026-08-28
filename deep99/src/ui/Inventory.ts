/* ==================================================================
   가방 · 제작 모듈 · 캠프파이어 창

   전부 DOM 이다(§21.1). 캔버스 위에 UI 를 직접 그리면 글자 정렬과
   스크롤을 손으로 만들어야 하는데, 그건 브라우저가 훨씬 잘한다.

   제작 목록은 **잠긴 것도 보여 준다**. 목표가 보여야 모은다 — 5레벨에
   시간 가속기가 있다는 걸 1레벨에서 알아야 운석 파편을 아끼기 시작한다.
   ================================================================== */
import type { GameState } from '../core/GameState.ts'
import { ITEMS, FUELS, itemName, fireLevelDef } from '../data/index.ts'
import { countItem } from '../core/GameState.ts'
import {
  visibleRecipes, craft, upgradeCost, upgradeModule, pressAmmo, cookStew,
} from '../systems/CraftingSystem.ts'
import {
  addFuel, fuelUnlocked, startCooking, heatOf, heatToNextLevel,
} from '../systems/CampfireSystem.ts'
import { grindJunk, storeFuel, withdrawFuel, totalStored, recycle } from '../systems/InventorySystem.ts'
import { eat, useBandage } from '../systems/SurvivalSystem.ts'

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
    const body = this.kind === 'inventory' ? this.inventoryHtml(s)
      : this.kind === 'crafting' ? this.craftingHtml(s)
        : this.campfireHtml(s)
    this.root.innerHTML = `<div class="panel"><div class="panel-inner">${body}</div></div>`
    this.bind(s)
  }

  private bind(s: GameState): void {
    this.root.querySelectorAll<HTMLElement>('[data-act]').forEach((el) => {
      el.addEventListener('click', () => this.act(s, el.dataset.act!, el.dataset.arg ?? ''))
    })
    this.root.querySelector('[data-close]')?.addEventListener('click', () => this.close())
  }

  private act(s: GameState, act: string, arg: string): void {
    switch (act) {
      case 'craft': craft(s, arg); break
      case 'upgrade': upgradeModule(s); break
      case 'grind': grindJunk(s); break
      case 'press': pressAmmo(s); break
      case 'stew': cookStew(s); break
      case 'recycle': recycle(s, arg); break
      case 'fuel': addFuel(s, arg); break
      case 'cook': startCooking(s, arg); break
      case 'eat': eat(s, arg); break
      case 'bandage': useBandage(s); break
      case 'store': storeFuel(s, arg, 25); break
      case 'take': withdrawFuel(s, arg, 25); break
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
      default: break
    }
    this.render(s)
  }

  /* ── 가방 ─────────────────────────────────────────────────── */
  private inventoryHtml(s: GameState): string {
    const rows = s.player.slots.map((slot, i) => {
      if (!slot) return `<div class="card disabled"><div class="name">칸 ${i + 1}</div><div class="desc">비어 있음</div></div>`
      const def = ITEMS[slot.id]
      const acts: string[] = []
      if (def.kind === 'food') acts.push(`<button class="btn" data-act="eat" data-arg="${slot.id}">먹기</button>`)
      if (slot.id === 'bandage') acts.push('<button class="btn" data-act="bandage">사용 (+25)</button>')
      if (def.kind === 'tool' || def.kind === 'gun') acts.push(`<button class="btn" data-act="equip" data-arg="${slot.id}">들기</button>`)
      if (FUELS[slot.id]) acts.push(`<button class="btn" data-act="store" data-arg="${slot.id}">저장고에</button>`)
      if (s.buildings.some((b) => b.type === 'recycler') && def.kind === 'junk') {
        acts.push(`<button class="btn ghost" data-act="recycle" data-arg="${slot.id}">재활용</button>`)
      }
      return `<div class="card">
        <div class="name">${def.icon} ${def.name} ${slot.count > 1 ? `×${slot.count}` : ''}</div>
        <div class="desc">${describe(def.kind)}</div>
        <div class="row" style="margin-top:8px">${acts.join('')}</div>
      </div>`
    }).join('')

    const hasStorage = s.buildings.some((b) => b.type === 'wood_storage')
    const storeRows = hasStorage
      ? Object.keys(FUELS).map((id) => {
        const n = totalStored(s, id)
        return n > 0
          ? `<button class="btn" data-act="take" data-arg="${id}">${itemName(id)} ${n} 꺼내기</button>`
          : ''
      }).join('')
      : ''

    return `
      <h2>가방</h2>
      <div class="sub">잡동사니는 한 칸씩 차지합니다 — 한 번에 다 못 들고 옵니다</div>
      <div class="grid cols-4">${rows}</div>
      ${hasStorage ? `
        <div class="section-title">나무 저장고 · 보관 ${totalStored(s)}</div>
        <div class="row">${storeRows || '<span class="sub" style="margin:0">비어 있습니다</span>'}</div>
        <div class="sub" style="margin-top:6px">저장고 안에서는 썩지 않습니다. 로한이 여기서 연료를 꺼내 씁니다.</div>`
        : `<div class="section-title">경고</div>
        <div class="sub">저장고가 없습니다. 가방 속 통나무는 10분이면 썩습니다.</div>`}
      <div class="row" style="margin-top:22px">
        <div class="spacer"></div><button class="btn ghost" data-close>닫기 (Tab)</button>
      </div>`
  }

  /* ── 제작 모듈 ────────────────────────────────────────────── */
  private craftingHtml(s: GameState): string {
    const groups: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] }

    for (const { id, def, blocked } of visibleRecipes(s)) {
      const costs = Object.entries(def.cost).map(([cid, n]) => {
        const have = cid.startsWith('core_') ? (s.coreParts.includes(cid) ? 1 : 0) : countItem(s, cid)
        return `<span style="color:${have >= n ? 'var(--glow)' : 'var(--warm)'}">${itemName(cid)} ${have}/${n}</span>`
      }).join(' · ')
      const why = blocked === 'level' ? ' · 레벨 부족'
        : blocked === 'max' ? ' · 최대'
          : blocked === 'dockMissing' ? ' · 도크 필요'
            : blocked === 'alreadyBuilt' ? ' · 설치됨'
              : blocked === 'placement' ? ' · 본선 근처에서만' : ''
      groups[def.level].push(`
        <div class="card${blocked === null ? '' : ' disabled'}" ${blocked === null ? `data-act="craft" data-arg="${id}"` : ''}>
          <div class="name">${def.name}${why}</div>
          <div class="desc">${def.desc}</div>
          <div class="cost">${costs}</div>
        </div>`)
    }

    const up = upgradeCost(s.moduleLevel)
    const upCosts = up ? Object.entries(up).map(([cid, n]) => {
      const have = countItem(s, cid)
      return `<span style="color:${have >= n ? 'var(--glow)' : 'var(--warm)'}">${itemName(cid)} ${have}/${n}</span>`
    }).join(' · ') : ''

    const junk = s.player.slots.filter((x) => x && ITEMS[x.id]?.kind === 'junk').length
    const hasPress = s.buildings.some((b) => b.type === 'ammo_press')
    const hasPot = s.buildings.some((b) => b.type === 'cooking_pot')

    return `
      <h2>제작 모듈 <span style="color:var(--glow)">Lv${s.moduleLevel}</span></h2>
      <div class="sub">잠긴 항목도 보여 줍니다 — 무엇을 모아야 할지 알아야 하니까</div>
      <div class="row">
        ${up ? `<button class="btn primary" data-act="upgrade">Lv${s.moduleLevel + 1} 로 업그레이드</button><span class="cost">${upCosts}</span>`
        : '<span class="sub" style="margin:0">최고 레벨입니다</span>'}
        <div class="spacer"></div>
        <button class="btn" data-act="grind" ${junk === 0 ? 'disabled' : ''}>잡동사니 분해 (${junk}칸)</button>
        ${hasPress ? '<button class="btn" data-act="press">탄약 압착 (고철 4 → 6발)</button>' : ''}
        ${hasPot ? '<button class="btn" data-act="stew">스튜 (고기2+채소2)</button>' : ''}
      </div>
      ${[1, 2, 3, 4, 5].map((lv) => groups[lv].length
        ? `<div class="section-title">레벨 ${lv}</div><div class="grid cols-3">${groups[lv].join('')}</div>` : '').join('')}
      <div class="row" style="margin-top:22px">
        <div class="spacer"></div><button class="btn ghost" data-close>닫기 (E)</button>
      </div>`
  }

  /* ── 캠프파이어 ───────────────────────────────────────────── */
  private campfireHtml(s: GameState): string {
    const fuels = Object.keys(FUELS).map((id) => {
      const have = countItem(s, id)
      const unlocked = fuelUnlocked(s, id)
      const disabled = have <= 0 || !unlocked
      const def = FUELS[id]
      const stored = totalStored(s, id)
      return `<div class="card${disabled ? ' disabled' : ''}" ${disabled ? '' : `data-act="fuel" data-arg="${id}"`}>
        <div class="name">${ITEMS[id].icon} ${itemName(id)} ×${have}${stored > 0 ? ` <span style="color:var(--muted)">(저장고 ${stored})</span>` : ''}</div>
        <div class="desc">화력 +${Math.round(heatOf(s, id))}</div>
        ${unlocked ? '' : `<div class="cost">캠프파이어 Lv${def.unlockLevel} 에 닿아야 나타납니다</div>`}
      </div>`
    }).join('')

    const raw = ['meat_small_raw', 'meat_large_raw'].map((id) => {
      const have = countItem(s, id)
      return `<div class="card${have <= 0 ? ' disabled' : ''}" ${have <= 0 ? '' : `data-act="cook" data-arg="${id}"`}>
        <div class="name">${ITEMS[id].icon} ${itemName(id)} ×${have}</div>
        <div class="desc">구우면 회복이 세 배가 되고 우주복이 안 깎입니다</div>
      </div>`
    }).join('')

    const lv = fireLevelDef(s.campfire.level)
    const next = fireLevelDef(s.campfire.level + 1)

    return `
      <h2>캠프파이어 <span style="color:var(--warm)">${s.campfire.extinguished ? '꺼짐' : `Lv${s.campfire.level}`}</span></h2>
      <div class="sub">
        화력 ${Math.round(s.campfire.heat)}
        ${lv ? ` · 초당 -${lv.drain}${s.campfire.drainMultiplier > 1 ? ` ×${s.campfire.drainMultiplier}` : ''}` : ''}
        ${next ? ` · Lv${next.lv} 까지 ${Math.round(heatToNextLevel(s))}` : ' · 최고 레벨'}
      </div>
      <div class="section-title">연료 넣기</div>
      <div class="grid cols-4">${fuels}</div>
      <div class="section-title">굽기</div>
      ${s.campfire.cooking ? `<div class="sub">굽는 중… ${Math.ceil(s.campfire.cooking.remain)}초</div>` : ''}
      <div class="grid cols-2">${raw}</div>
      <div class="row" style="margin-top:22px">
        <div class="spacer"></div><button class="btn ghost" data-close>닫기 (E)</button>
      </div>`
  }
}

function describe(kind: string): string {
  switch (kind) {
    case 'fuel': return '캠프파이어 연료'
    case 'resource': return '자원'
    case 'junk': return '제작 모듈에서 고철로'
    case 'food': return '음식'
    case 'tool': return '도구'
    case 'gun': return '총기'
    case 'ammo': return '탄약'
    case 'gear': return '장비'
    case 'core': return '탈출선 핵심 부품'
    default: return ''
  }
}
