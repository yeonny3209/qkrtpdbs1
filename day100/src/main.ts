/* ==================================================================
   부트스트랩과 게임 루프

   화면 상태(로비 / 컷씬 / 플레이 / 소행성 / 결과)를 여기서만 갈아
   끼운다. 시스템들은 서로를 모르고 GameState 만 고치므로, 무엇이
   언제 도는지는 이 파일 하나만 읽으면 된다.
   ================================================================== */
import './styles/ui.css'

import { BALANCE, ITEMS, FUEL } from './data/index.ts'
import { Loop, FIXED_DT } from './core/Loop.ts'
import { Input } from './core/Input.ts'
import { Audio } from './core/Audio.ts'
import * as Save from './core/SaveData.ts'
import {
  type GameState, type Phase,
  distance, inCampfire, addItem, countItem, removeItem, toast,
} from './core/GameState.ts'
import { CENTER, type Solid } from './world/Tilemap.ts'
import { buildSolids } from './world/MapGen.ts'
import { markExplored } from './world/FogOfWar.ts'

import * as TimeSystem from './systems/TimeSystem.ts'
import * as Survival from './systems/SurvivalSystem.ts'
import * as CampfireSystem from './systems/CampfireSystem.ts'
import * as Decay from './systems/DecaySystem.ts'
import * as Combat from './systems/CombatSystem.ts'
import * as Inv from './systems/InventorySystem.ts'
import * as Labs from './systems/LabSystem.ts'
import * as Run from './systems/RunSystem.ts'

import * as PlayerEntity from './entities/Player.ts'
import * as SpiderEntity from './entities/Spider.ts'
import * as Animals from './entities/Animal.ts'
import * as Bullets from './entities/Projectile.ts'
import * as Asteroid from './minigame/AsteroidDodge.ts'

import { Camera } from './render/Camera.ts'
import { Renderer } from './render/Renderer.ts'
import * as Effects from './render/Effects.ts'
import { HUD, type HudPrompt } from './ui/HUD.ts'
import { Panels } from './ui/Inventory.ts'
import { Lobby } from './ui/Lobby.ts'
import { Cutscene } from './ui/Cutscene.ts'
import { EndScreen } from './ui/DeathScreen.ts'

type Screen = 'lobby' | 'cutscene' | 'play' | 'end'

/* 시스템들이 s.phase 를 바꾼다. 타입스크립트는 그걸 모르고 앞선
   검사로 좁힌 타입을 계속 들고 있어서, 시스템을 부른 뒤의 비교가
   "일어날 수 없는 비교"로 보인다. 함수를 거쳐 읽으면 좁힘이 풀린다 —
   실제로 값이 바뀌었을 수 있다는 사실을 코드로 적어 두는 셈이다. */
function phaseOf(s: GameState): Phase {
  return s.phase
}

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const hudRoot = document.getElementById('hud') as HTMLElement
const overlay = document.getElementById('overlay') as HTMLElement
const asteroidLayer = document.createElement('div')
asteroidLayer.className = 'layer hidden'
document.getElementById('app')!.appendChild(asteroidLayer)

const input = new Input()
const audio = new Audio()
const camera = new Camera()
const renderer = new Renderer(ctx)
const hud = new HUD(hudRoot)
const cutscene = new Cutscene(overlay)
const endScreen = new EndScreen(overlay)

let save = Save.load()
let screen: Screen = 'lobby'
let state: GameState | null = null
let solids: Solid[] = []
let hurtFlash = 0
let shake = 0
let mapExpanded = false

const panels = new Panels(overlay, () => { /* 패널이 닫히면 할 일 없음 */ })

const lobby = new Lobby(
  overlay,
  save,
  (result) => beginRun(result),
  (d) => { save = d; Save.save(d) },
)

/* ── 화면 크기 ─────────────────────────────────────────────────── */
function resize(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  /* 숨겨진 프레임 안에서는 innerWidth 가 0 으로 온다. 그대로 쓰면
     캔버스가 0x0 이 되고, 나중에 보이게 되어도 다시 안 그려진다. */
  const w = Math.max(320, window.innerWidth || 0)
  const h = Math.max(240, window.innerHeight || 0)
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  camera.resize(w, h)
}
window.addEventListener('resize', resize)
resize()

/* ── 화면 전환 ─────────────────────────────────────────────────── */
function showLobby(): void {
  screen = 'lobby'
  state = null
  hudRoot.classList.add('hidden')
  lobby.update(save)
  lobby.show()
}

function beginRun(result: { seed: string; modifierId: string; unlocks: string[] }): void {
  lobby.hide()
  screen = 'cutscene'
  cutscene.play('crash', () => {
    const started = Run.startRun({
      seed: result.seed,
      unlocks: result.unlocks,
      modifierId: result.modifierId,
    })
    state = started.state
    solids = started.solids
    camera.snapTo(state.player.x, state.player.z)
    hudRoot.classList.remove('hidden')
    hud.setExpanded(false)
    screen = 'play'
    /* 시작 물자 — 문서에 없지만 첫 밤을 넘기려면 불을 붙일 수단이
       있어야 한다. 통나무 다섯 개는 "첫 불은 공짜, 두 번째부터는
       네 몫"이라는 뜻이다. */
    addItem(state, 'wood', 5)
    addItem(state, 'torch', 1)
    state.player.torchCharges = BALANCE.spider.torchUsesPerPickup
  })
}

function endRun(): void {
  if (!state) return
  screen = 'end'
  hudRoot.classList.add('hidden')
  save = Run.commitRun(state, save)
  Save.save(save)
  const s = state
  if (s.phase === 'escaped') {
    cutscene.play('escape', () => endScreen.showEscape(s, showLobby))
    screen = 'cutscene'
  } else {
    endScreen.showDeath(s, showLobby)
  }
}

/* ── 상호작용 ──────────────────────────────────────────────────── */
type Interaction = { key: string; text: string; run: () => void } | null

function findInteraction(s: GameState): Interaction {
  const p = s.player
  const R = BALANCE.player.interactRange

  if (s.activeLab) return null

  /* 크래프팅 기계 = 우주선 옆 */
  if (distance(p.x, p.z, CENTER - 2.6, CENTER) <= R + 1.2) {
    return { key: 'E', text: '크래프팅 기계', run: () => panels.show('crafting', s) }
  }
  /* 캠프파이어 */
  if (distance(p.x, p.z, CENTER, CENTER + 2.6) <= R + 1.2) {
    return { key: 'E', text: '캠프파이어', run: () => panels.show('campfire', s) }
  }

  const lab = Labs.nearestLab(s)
  if (lab) {
    return { key: 'E', text: `${lab.tier}단계 연구소 진입`, run: () => Labs.enter(s, lab) }
  }

  for (const a of s.armories) {
    if (!a.opened && distance(p.x, p.z, a.x, a.z) <= R) {
      return { key: 'E', text: '무기고 열기 (소리가 납니다)', run: () => { Inv.openArmory(s) } }
    }
  }

  for (const b of s.buildings) {
    if (distance(p.x, p.z, b.x, b.z) > R) continue
    if (b.type === 'recovery_capsule') {
      const cd = b.cooldown ?? 0
      if (cd > 0) return { key: 'E', text: `캡슐 충전 중 ${Math.ceil(cd)}초`, run: () => {} }
      return {
        key: 'E',
        text: '상태회복 캡슐',
        run: () => {
          Survival.healFull(s)
          b.cooldown = BALANCE.decay.capsuleCooldownSeconds
          toast(s, '우주복과 산소를 회복했습니다', 'good')
        },
      }
    }
    if (b.type === 'farm' && b.crop) {
      const crop = b.crop
      return {
        key: 'E',
        text: `${ITEMS[crop].name} 수확`,
        run: () => {
          addItem(s, crop, 1)
          b.crop = null
        },
      }
    }
    if (b.type === 'wood_storage') {
      return { key: 'E', text: '나무 저장고', run: () => panels.show('inventory', s) }
    }
    if (b.type === 'warp_beacon') {
      return {
        key: 'E',
        text: s.phase === 'night' ? '밤에는 쓸 수 없습니다' : '캠프로 귀환',
        run: () => {
          if (s.phase === 'night') return
          if ((b.cooldown ?? 0) > 0) return
          s.player.x = CENTER
          s.player.z = CENTER + 3
          b.cooldown = BALANCE.decay.warpBeaconCooldownSeconds
        },
      }
    }
  }

  /* 주울 것 */
  for (const j of s.junk) {
    if (distance(p.x, p.z, j.x, j.z) <= BALANCE.player.harvestRange) {
      return { key: 'E', text: ITEMS[j.item].name, run: () => { Inv.pickUp(s) } }
    }
  }
  for (const f of s.fuelNodes) {
    if (distance(p.x, p.z, f.x, f.z) <= BALANCE.player.harvestRange) {
      return { key: 'E', text: ITEMS[f.item].name, run: () => { Inv.pickUp(s) } }
    }
  }

  if (countItem(s, 'sapling') > 0) {
    return { key: 'E', text: '묘목 심기', run: () => { Inv.plantSapling(s) } }
  }
  return null
}

/* ── 한 스텝 ───────────────────────────────────────────────────── */
function step(dt: number): void {
  if (screen === 'cutscene') {
    cutscene.tick(dt)
    if (input.pressed('KeyE') || input.pressed('Space')) cutscene.skip()
    return
  }
  if (screen === 'lobby') {
    if (input.pressed('KeyE')) lobby.start()
    return
  }
  if (screen === 'end') {
    if (input.pressed('KeyE')) showLobby()
    return
  }

  const s = state
  if (!s) return

  /* 소행성 미니게임은 월드를 멈추고 따로 돈다(§13.2) */
  if (s.phase === 'asteroid') {
    const k = input.keys()
    Asteroid.update(s, dt, { up: k.up, down: k.down, left: k.left, right: k.right })
    drain(s)
    if (phaseOf(s) === 'dead') { endRun(); return }
    if (Asteroid.isOver(s)) {
      const ev = TimeSystem.forceSunrise(s)
      afterSunrise(s, ev)
    }
    return
  }

  if (s.phase === 'dead' || s.phase === 'escaped') {
    endRun()
    return
  }

  /* 창이 열려 있으면 시간은 흐르되 조작은 창이 가져간다.
     Esc 로도 안 멈춘다(§3.1) — 긴장을 유지하려는 의도적 선택. */
  const uiOpen = panels.open !== null
  if (uiOpen) {
    if (input.pressed('Tab') || input.pressed('Escape') || input.pressed('KeyE')) panels.close()
  }

  /* 시간 */
  for (const ev of TimeSystem.update(s, dt)) {
    if (ev.type === 'nightWarning') s.events.push('nightWarning')
    if (ev.type === 'nightFall') {
      s.events.push('nightFall')
      SpiderEntity.spawnForNight(s)
    }
    if (ev.type === 'sunrise') afterSunrise(s, ev)
  }
  if (phaseOf(s) === 'asteroid') return

  /* 입력 → 플레이어 */
  const k = input.keys()
  const aimX = camera.toWorldX(input.mouseX)
  const aimZ = camera.toWorldZ(input.mouseY)
  if (!uiOpen) {
    PlayerEntity.update(s, dt, {
      up: k.up, down: k.down, left: k.left, right: k.right, run: k.run,
      aimX, aimZ, aiming: input.mouseRight,
    }, solids)
  }

  Survival.update(s, dt)
  CampfireSystem.update(s, dt)
  Decay.update(s, dt)
  Animals.updateAll(s, dt, solids)
  SpiderEntity.update(s, dt, solids)
  Bullets.update(s, dt, solids)
  Combat.updateStructures(s, dt)
  Labs.update(s)
  markExplored(s)

  /* 행동 */
  if (!uiOpen) handleActions(s)

  drain(s)
  const after = phaseOf(s)
  if (after === 'dead' || after === 'escaped') endRun()
}

function afterSunrise(s: GameState, ev: TimeSystem.TimeEvent): void {
  if (ev.type !== 'sunrise') return
  s.events.push('sunrise')
  Decay.harvestFarms(s)
  Animals.repopulate(s)
  solids = buildSolids(s)

  if (Run.checkEscape(s)) return
  /* 5의 배수를 넘겼으면 그 밤은 소행성이었다. 넘긴 칸수가 난이도다. */
  if (ev.crossings > 0) Asteroid.begin(s, ev.crossings)
}

function handleActions(s: GameState): void {
  const p = s.player

  if (input.pressed('Tab')) { panels.show('inventory', s); return }

  const inter = findInteraction(s)
  if (input.pressed('KeyE') && inter) inter.run()

  if (input.pressed('KeyF')) {
    if (p.flashlightBattery > 0) p.flashlightOn = !p.flashlightOn
    else toast(s, '배터리가 없습니다', 'warn')
  }
  if (input.pressed('KeyQ')) {
    if (p.torchCharges > 0) SpiderEntity.useTorch(s)
    else toast(s, '횃불이 없습니다', 'warn')
  }
  if (input.pressed('KeyR')) Survival.startReload(s)
  if (input.pressed('KeyM') && s.flags.hasMap) {
    mapExpanded = !mapExpanded
    hud.setExpanded(mapExpanded)
  }

  const hot = input.hotbarPressed()
  if (hot >= 0) {
    p.hotbar = hot
    const slot = p.slots[hot]
    if (slot) {
      const def = ITEMS[slot.id]
      if (def.kind === 'gun') { p.gun = slot.id; p.magazine = 0 }
      else if (def.kind === 'tool') { p.equipped = slot.id; p.gun = null }
      else if (def.kind === 'food') Survival.eat(s, slot.id)
      else if (def.kind === 'gear' && slot.id === 'torch') {
        removeItem(s, 'torch', 1)
        p.torchCharges += BALANCE.spider.torchUsesPerPickup
      } else if (def.kind === 'gear' && slot.id === 'battery') {
        removeItem(s, 'battery', 1)
        p.flashlightBattery = p.maxFlashlightBattery
        toast(s, '손전등을 충전했습니다', 'good')
      } else if (FUEL[slot.id] && inCampfire(s)) {
        CampfireSystem.addFuel(s, slot.id)
      }
    }
  }

  /* 좌클릭 — 총이 있으면 쏘고, 없으면 도끼질/채집 */
  if (input.mouseDown) {
    if (p.gun) {
      if (p.magazine <= 0 && p.reloadT <= 0) Survival.startReload(s)
      else Bullets.fire(s, p.gun)
    } else if (input.mouseClicked) {
      if (!Inv.chop(s)) Combat.swing(s)
    }
  }
}

/* 이벤트 큐를 비우며 소리를 낸다 */
function drain(s: GameState): void {
  for (const ev of s.events) {
    audio.play(ev)
    if (ev === 'suitHit' || ev === 'beastHit') hurtFlash = 0.45
    if (ev === 'asteroidHit') shake = 9
    if (ev === 'nightFall') shake = 3
  }
  s.events.length = 0

  for (const t of s.toasts) t.life -= FIXED_DT
  s.toasts = s.toasts.filter((t) => t.life > 0)

  if (hurtFlash > 0) hurtFlash = Math.max(0, hurtFlash - FIXED_DT * 2.2)
  if (shake > 0) shake = Math.max(0, shake - FIXED_DT * 22)

  /* 가장 가까운 거미의 거리 → 마찰음 볼륨 */
  if (s.phase === 'night' && s.spiders.length > 0) {
    let nearest = Infinity
    for (const sp of s.spiders) {
      nearest = Math.min(nearest, distance(s.player.x, s.player.z, sp.x, sp.z))
    }
    audio.spider(nearest)
  } else {
    audio.spider(null)
  }
  audio.setMuffle(Effects.suffocation(s))
}

/* ── 그리기 ────────────────────────────────────────────────────── */
function draw(_alpha: number): void {
  const w = Math.max(320, window.innerWidth || 0)
  const h = Math.max(240, window.innerHeight || 0)

  if (!state || screen === 'lobby' || screen === 'cutscene' || screen === 'end') {
    asteroidLayer.classList.add('hidden')
    ctx.fillStyle = '#0B0E14'
    ctx.fillRect(0, 0, w, h)
    return
  }
  const s = state

  if (s.phase === 'asteroid') {
    drawAsteroid(s, w, h)
    return
  }

  asteroidLayer.classList.add('hidden')
  hudRoot.classList.remove('hidden')
  camera.follow(s.player.x, s.player.z, FIXED_DT)
  const off = Effects.shakeOffset(shake, s.elapsed)
  ctx.save()
  ctx.translate(off.x, off.y)
  renderer.draw(s, camera, w, h, s.modifier.effects.visionFactor ?? 1)
  ctx.restore()

  Effects.drawNightWarning(ctx, s, w, h)
  Effects.drawFrost(ctx, s, w, h)
  Effects.drawDesaturation(ctx, s, w, h)
  Effects.drawHurt(ctx, hurtFlash, w, h)

  const inter = panels.open ? null : findInteraction(s)
  const prompt: HudPrompt = inter ? { key: inter.key, text: inter.text } : null
  hud.sync(s, renderer, prompt)
}

/* 소행성 회피는 완전히 다른 화면이다(§13.2) */
function drawAsteroid(s: GameState, w: number, h: number): void {
  const a = s.asteroid
  const A = BALANCE.asteroid
  const scale = Math.min(w / A.fieldWidth, h / A.fieldHeight)
  const ox = (w - A.fieldWidth * scale) / 2
  const oy = (h - A.fieldHeight * scale) / 2

  ctx.fillStyle = '#08060F'
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  ctx.translate(ox, oy)
  ctx.scale(scale, scale)

  /* 별 — 시드 기반이라 매 프레임 흔들리지 않는다 */
  ctx.fillStyle = 'rgba(200,220,255,0.5)'
  for (let i = 0; i < 90; i++) {
    const x = ((i * 7919) % A.fieldWidth)
    const y = ((i * 104729) % A.fieldHeight)
    ctx.fillRect(x, y, 2, 2)
  }

  for (const r of a.rocks) {
    ctx.fillStyle = '#4A4048'
    ctx.beginPath()
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#5C525A'
    ctx.beginPath()
    ctx.arc(r.x - r.r * 0.25, r.y - r.r * 0.25, r.r * 0.5, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.save()
  ctx.translate(a.shipX, a.shipY)
  ctx.fillStyle = a.hitFlash > 0 ? '#C8235A' : '#C8CDD4'
  ctx.beginPath()
  ctx.moveTo(0, -A.shipRadius)
  ctx.lineTo(A.shipRadius * 0.8, A.shipRadius)
  ctx.lineTo(0, A.shipRadius * 0.5)
  ctx.lineTo(-A.shipRadius * 0.8, A.shipRadius)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#FFB347'
  ctx.fillRect(-3, A.shipRadius * 0.5, 6, 8 + Math.random() * 6)
  ctx.restore()

  ctx.restore()

  overlayAsteroidHud(s)
}

/* 소행성 화면의 표시는 제 레이어를 쓴다. HUD 를 덮어쓰면 돌아올 때
   HUD 를 다시 만들어야 하고, 그러면 미니맵 캔버스 참조가 끊긴다. */
function overlayAsteroidHud(s: GameState): void {
  hudRoot.classList.add('hidden')
  asteroidLayer.classList.remove('hidden')
  asteroidLayer.innerHTML = `
    <div id="asteroid-hud">
      <div class="t">${Math.ceil(s.asteroid.remain)}</div>
      <div style="font-size:12px;color:var(--muted);letter-spacing:.2em">소행성대 통과 · 난이도 ${s.asteroid.tier}단계</div>
      <div class="f">피격 ${s.asteroidFailures} / ${s.allowedFailures}</div>
    </div>`
}

/* ── 시작 ──────────────────────────────────────────────────────── */
input.attach(canvas)
canvas.addEventListener('pointerdown', () => audio.resume(), { once: true })
window.addEventListener('keydown', () => audio.resume(), { once: true })

const loop = new Loop({
  step: (dt) => {
    step(dt)
    input.endFrame()
  },
  draw,
})

showLobby()
loop.start()
