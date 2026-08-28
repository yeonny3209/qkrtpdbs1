/* ==================================================================
   부트스트랩과 게임 루프

   §21.4 의 각주가 이 파일에서 가장 중요한 규칙이다 —
   **CampfireSystem 이 Spider 보다 먼저 돌아야 한다.** 같은 프레임 안에서
   "불이 꺼짐 → 거미 굶주림 전환"이 반영되어야, 화력이 0이 되는 그
   프레임부터 거미가 캠프로 들어온다. 순서가 뒤바뀌면 한 프레임 늦고,
   그 한 프레임이 "왜 안 들어오지?"가 된다.

   ZoneGate 는 CampfireSystem 바로 뒤다. 최고 도달 레벨이 오른 즉시
   장벽이 넓어져야 하기 때문이다.
   ================================================================== */
import './styles/ui.css'

import { BALANCE, ITEMS, FUELS, CACHES, CACHE_CONF } from './data/index.ts'
import { Loop, FIXED_DT } from './core/Loop.ts'
import { Input } from './core/Input.ts'
import { Audio } from './core/Audio.ts'
import * as Save from './core/SaveData.ts'
import {
  type GameState, type Phase,
  distance, inCampfire, addItem, countItem, removeItem, toast, banner,
} from './core/GameState.ts'
import { CENTER, type Solid } from './world/Tilemap.ts'
import { buildSolids } from './world/MapGen.ts'
import { markExplored } from './world/FogOfWar.ts'
import * as ZoneGate from './world/ZoneGate.ts'

import * as TimeSystem from './systems/TimeSystem.ts'
import * as Campfire from './systems/CampfireSystem.ts'
import * as Survival from './systems/SurvivalSystem.ts'
import * as Weather from './systems/WeatherSystem.ts'
import * as Decay from './systems/DecaySystem.ts'
import * as Combat from './systems/CombatSystem.ts'
import * as Inv from './systems/InventorySystem.ts'
import * as Labs from './systems/LabSystem.ts'
import * as Raid from './systems/RaidSystem.ts'
import * as Run from './systems/RunSystem.ts'

import * as PlayerEntity from './entities/Player.ts'
import * as SpiderEntity from './entities/Spider.ts'
import * as Animals from './entities/Animal.ts'
import * as Raiders from './entities/Raider.ts'
import * as CrewEntity from './entities/Crew.ts'
import * as Bullets from './entities/Projectile.ts'
import * as Asteroid from './minigame/AsteroidDodge.ts'
import * as Salvage from './minigame/Salvage.ts'

import { Camera } from './render/Camera.ts'
import { Renderer } from './render/Renderer.ts'
import * as Effects from './render/Effects.ts'
import { HUD, type HudPrompt } from './ui/HUD.ts'
import { Panels } from './ui/Inventory.ts'
import { Lobby } from './ui/Lobby.ts'
import { Cutscene } from './ui/Cutscene.ts'
import { wire as wireOverlayGate } from './ui/OverlayGate.ts'
import { EndScreen } from './ui/DeathScreen.ts'

type Screen = 'lobby' | 'cutscene' | 'play' | 'end'

/* 시스템들이 s.phase 를 바꾼다. 타입스크립트는 그걸 모르고 앞선 검사로
   좁힌 타입을 계속 들고 있어서, 시스템을 부른 뒤의 비교가 "일어날 수
   없는 비교"로 보인다. 함수를 거쳐 읽으면 좁힘이 풀린다. */
function phaseOf(s: GameState): Phase {
  return s.phase
}

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const hudRoot = document.getElementById('hud') as HTMLElement
const overlay = document.getElementById('overlay') as HTMLElement
wireOverlayGate(overlay)
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

const panels = new Panels(overlay, () => { /* 닫히면 할 일 없음 */ })
const lobby = new Lobby(overlay, save, (r) => beginRun(r), (d) => { save = d; Save.save(d) })

/* ── 화면 크기 ─────────────────────────────────────────────────── */
function viewSize(): { w: number; h: number } {
  /* 숨겨진 프레임 안에서는 innerWidth 가 0 으로 온다. 그대로 쓰면
     캔버스가 0x0 이 되고 나중에 보여도 다시 안 그려진다. */
  return {
    w: Math.max(320, window.innerWidth || 0),
    h: Math.max(240, window.innerHeight || 0),
  }
}

function resize(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const { w, h } = viewSize()
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

function beginRun(result: { seed: string; jobId: string; modifierId: string }): void {
  lobby.hide()
  screen = 'cutscene'
  cutscene.play('crash', () => {
    const started = Run.startRun(result)
    state = started.state
    solids = started.solids
    camera.snapTo(state.player.x, state.player.z)
    hudRoot.classList.remove('hidden')
    hud.setExpanded(false)

    /* 런 사이에 남는 것들을 여기서 전부 되돌린다.

       모듈 수준 변수는 새 GameState 를 만들어도 안 지워진다. 창을 열어
       둔 채 죽으면 panels 가 열린 것으로 남아, 다음 런이 화면에 아무것도
       없는데 움직이지도 않는 상태로 시작한다 — 무슨 일인지 알 길이 없다. */
    panels.close()
    mapExpanded = false
    hurtFlash = 0
    shake = 0
    screen = 'play'

    /* 1일차는 튜토리얼이다(§18). 첫 불은 강제로 붙여 주고 통나무를
       조금 쥐어 준다 — 원작의 "튜토리얼 없음" 문제를 피한다. */
    addItem(state, 'log', 8)
    addItem(state, 'torch', 1)
    state.campfire.heat = 30
    banner(state, '캠프파이어에 통나무를 넣어 불을 키우세요', 5)
    toast(state, '불 레벨이 갈 수 있는 거리를 정합니다', 'info')
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

  if (s.salvage.active) {
    return { key: 'E', text: '채취 그만두기', run: () => Salvage.stop(s) }
  }

  if (distance(p.x, p.z, CENTER - 3.2, CENTER) <= R + 1.4) {
    return { key: 'E', text: '제작 모듈', run: () => panels.show('crafting', s) }
  }
  if (distance(p.x, p.z, CENTER, CENTER + 3) <= R + 1.4) {
    return { key: 'E', text: '캠프파이어', run: () => panels.show('campfire', s) }
  }

  const node = Salvage.nearestNode(s)
  if (node) {
    return { key: 'E', text: '잔해 채취', run: () => Salvage.begin(s, node.id) }
  }

  const lab = Labs.nearestLab(s)
  if (lab) {
    return { key: 'E', text: `${lab.tier}단계 연구소 진입`, run: () => Labs.enter(s, lab) }
  }

  for (const c of s.caches) {
    if (c.opened || distance(p.x, p.z, c.x, c.z) > R) continue
    const tier = CACHES.find((t) => t.id === c.tier)!
    const locked = tier.fireLevel > 0 && s.campfire.maxReachedLevel < tier.fireLevel
    if (locked) {
      return { key: 'E', text: `${tier.name} — 캠프파이어 Lv${tier.fireLevel} 필요`, run: () => {} }
    }
    return { key: 'E', text: `${tier.name} 열기 (소리가 납니다)`, run: () => openCache(s, c.id) }
  }

  for (const o of s.outposts) {
    if (o.cleared || distance(p.x, p.z, o.x, o.z) > R + 1) continue
    const near = s.raiders.filter((r) => distance(r.x, r.z, o.x, o.z) < 14).length
    if (near > 0) return { key: 'E', text: `전초기지 — 남은 약탈자 ${near}`, run: () => {} }
    return { key: 'E', text: '전초기지 제압', run: () => Raid.clearOutpost(s, o.id) }
  }

  for (const b of s.buildings) {
    if (distance(p.x, p.z, b.x, b.z) > R) continue
    if (b.type === 'recovery_capsule') {
      const cd = b.cooldown ?? 0
      if (cd > 0) return { key: 'E', text: `캡슐 충전 중 ${Math.ceil(cd)}초`, run: () => {} }
      return {
        key: 'E',
        text: '회복 캡슐',
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
        run: () => { addItem(s, crop, 1); b.crop = null },
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
          if (s.phase === 'night' || (b.cooldown ?? 0) > 0) return
          s.player.x = CENTER
          s.player.z = CENTER + 4
          b.cooldown = BALANCE.decay.warpBeaconCooldownSeconds
        },
      }
    }
  }

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

/** 보급함 열기 — 소음이 나고 40타일 안의 적이 몰려온다(§9) */
function openCache(s: GameState, id: number): void {
  const c = s.caches.find((x) => x.id === id)
  if (!c || c.opened) return
  const tier = CACHES.find((t) => t.id === c.tier)
  if (!tier) return
  c.opened = true

  const rng = s.streams.loot
  for (const entry of tier.loot) {
    for (const [key, val] of Object.entries(entry)) {
      if (key === 'gun') {
        const gun = rng.pick(val as string[])
        addItem(s, gun, 1)
        addItem(s, `ammo_${gun}`, 6)
      } else if (key === 'ammo') {
        const n = (val as number[])[0]
        const gun = s.player.gun ?? 'pistol'
        addItem(s, `ammo_${gun}`, n)
      } else {
        const [lo, hi] = val as number[]
        addItem(s, key, lo + rng.int(Math.max(1, hi - lo + 1)))
      }
    }
  }
  for (const b of s.beasts) {
    if (distance(b.x, b.z, c.x, c.z) <= CACHE_CONF.aggroRadius) {
      b.state = 'chase'
      b.stateT = 0
    }
  }
  toast(s, `${tier.name} 개방 — 소리를 들었습니다`, 'warn')
  s.events.push('cacheOpen')
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

  /* 소행성 밤은 월드를 멈추고 따로 돈다(§14.1) */
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

  const uiOpen = panels.open !== null
  if (uiOpen && (input.pressed('Tab') || input.pressed('Escape') || input.pressed('KeyE'))) {
    panels.close()
  }

  /* ── §21.4 의 순서 ──────────────────────────────────────────── */
  for (const ev of TimeSystem.update(s, dt)) {
    if (ev.type === 'nightWarning') {
      s.events.push('nightWarning')
      toast(s, '밤이 오고 있습니다. 캠프로 돌아가세요', 'warn')
      Raid.announceDusk(s)
    }
    if (ev.type === 'nightFall') {
      s.events.push('nightFall')
      SpiderEntity.spawnForNight(s)
      Raid.beginNight(s)
    }
    if (ev.type === 'sunrise') afterSunrise(s, ev)
  }
  if (phaseOf(s) === 'asteroid') return

  /* CampfireSystem 이 Spider 보다 먼저 — 같은 프레임에 굶주림이 반영된다 */
  Campfire.update(s, dt)
  ZoneGate.update(s)
  Survival.update(s, dt)
  Weather.update(s, dt)

  const k = input.keys()
  const aimX = camera.toWorldX(input.mouseX)
  const aimZ = camera.toWorldZ(input.mouseY)
  if (!uiOpen && !s.salvage.active) {
    PlayerEntity.update(s, dt, {
      up: k.up, down: k.down, left: k.left, right: k.right, run: k.run,
      aimX, aimZ, aiming: input.mouseRight,
    }, solids)
  }

  SpiderEntity.update(s, dt, solids)
  Animals.updateAll(s, dt, solids)
  Raiders.updateAll(s, dt, solids)
  CrewEntity.updateAll(s, dt)
  Bullets.update(s, dt, solids)
  Combat.updateStructures(s, dt)
  Decay.update(s, dt)
  Salvage.update(s, dt)
  Labs.update(s)
  markExplored(s)

  if (!uiOpen) handleActions(s)

  drain(s)
  const after = phaseOf(s)
  if (after === 'dead' || after === 'escaped') endRun()
}

function afterSunrise(s: GameState, ev: TimeSystem.TimeEvent): void {
  if (ev.type !== 'sunrise') return
  s.events.push('sunrise')
  Raid.resolveMorning(s)
  Decay.harvestFarms(s)
  CrewEntity.autoHarvest(s)
  Animals.repopulate(s)
  Weather.rollForDay(s)
  Raid.announceMorning(s)
  solids = buildSolids(s)

  if (Run.checkEscape(s)) return
  /* 25 / 50 / 75 / 99일 — 넘어선 마일스톤이 있으면 소행성 밤(§14) */
  if (ev.asteroids.length > 0) {
    const day = ev.asteroids[0]
    s.asteroidDone.push(...ev.asteroids)
    Asteroid.begin(s, day)
  }
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
      else if (slot.id === 'bandage') Survival.useBandage(s)
      else if (slot.id === 'torch') {
        removeItem(s, 'torch', 1)
        p.torchCharges += BALANCE.spider.torchUsesPerPickup
      } else if (slot.id === 'battery') {
        removeItem(s, 'battery', 1)
        p.flashlightBattery = p.maxFlashlightBattery
        toast(s, '손전등을 충전했습니다', 'good')
      } else if (FUELS[slot.id] && inCampfire(s)) {
        Campfire.addFuel(s, slot.id)
      }
    }
  }

  /* 좌클릭 — 채취 중이면 타이밍, 총이 있으면 사격, 없으면 도끼질 */
  if (s.salvage.active) {
    if (input.mouseClicked) Salvage.strike(s)
    return
  }
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
    if (ev === 'suitHit' || ev === 'beastHit' || ev === 'raiderHit') hurtFlash = 0.45
    if (ev === 'asteroidHit' || ev === 'lightning') shake = 9
    if (ev === 'nightFall' || ev === 'fireOut') shake = 3
  }
  s.events.length = 0

  for (const t of s.toasts) t.life -= FIXED_DT
  s.toasts = s.toasts.filter((t) => t.life > 0)
  if (s.banner) {
    s.banner.life -= FIXED_DT
    if (s.banner.life <= 0) s.banner = null
  }

  if (hurtFlash > 0) hurtFlash = Math.max(0, hurtFlash - FIXED_DT * 2.2)
  if (shake > 0) shake = Math.max(0, shake - FIXED_DT * 22)

  /* 거미 마찰음 — 가장 가까운 놈의 거리로 볼륨을 정한다 */
  if (s.phase === 'night' && s.spiders.length > 0) {
    let nearest = Infinity
    for (const sp of s.spiders) {
      nearest = Math.min(nearest, distance(s.player.x, s.player.z, sp.x, sp.z))
    }
    audio.spider(nearest)
  } else audio.spider(null)

  /* 습격 밤의 북 — 가까울수록 빨라진다(§20.5) */
  if (s.raid.active && s.raiders.length > 0) {
    let nearest = Infinity
    for (const r of s.raiders) {
      nearest = Math.min(nearest, distance(s.player.x, s.player.z, r.x, r.z))
    }
    audio.drums(true, Math.max(0, 1 - nearest / 34), FIXED_DT)
  } else audio.drums(false, 0, FIXED_DT)

  audio.setMuffle(Effects.suffocation(s))
}

/* ── 그리기 ────────────────────────────────────────────────────── */
function draw(): void {
  const { w, h } = viewSize()

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
  renderer.draw(s, camera, w, h, Weather.visionFactor(s))
  ctx.restore()

  Effects.drawWeather(ctx, s, w, h)
  Effects.drawNightWarning(ctx, s, w, h)
  Effects.drawExtinguished(ctx, s, w, h)
  Effects.drawFrost(ctx, s, w, h)
  Effects.drawDesaturation(ctx, s, w, h)
  Effects.drawHurt(ctx, hurtFlash, w, h)

  const inter = panels.open ? null : findInteraction(s)
  const prompt: HudPrompt = inter ? { key: inter.key, text: inter.text } : null
  hud.sync(s, renderer, prompt)
}

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

  ctx.fillStyle = 'rgba(200,220,255,0.5)'
  for (let i = 0; i < 90; i++) {
    ctx.fillRect((i * 7919) % A.fieldWidth, (i * 104729) % A.fieldHeight, 2, 2)
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

  hudRoot.classList.add('hidden')
  asteroidLayer.classList.remove('hidden')
  asteroidLayer.innerHTML = `
    <div id="asteroid-hud">
      <div class="t">${Math.ceil(a.remain)}</div>
      <div style="font-size:12px;color:var(--muted);letter-spacing:.2em">소행성대 통과 · ${a.tier}단계</div>
      <div class="f">피격 ${s.asteroidFailures} / ${s.allowedFailures}</div>
    </div>`
}

/* ── 시작 ──────────────────────────────────────────────────────── */
input.attach(canvas)
/* 캔버스가 아니라 창에 건다. 로비 버튼은 오버레이 위에 있어서
   캔버스까지 안 내려온다 — 버튼으로 시작하면 소리가 안 켜졌다. */
window.addEventListener('pointerdown', () => audio.resume(), { once: true })
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
