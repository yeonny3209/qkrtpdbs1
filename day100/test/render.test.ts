/* ==================================================================
   그리기·UI 검증 — 브라우저 없이

   왜 필요한가: 로직 테스트는 5만 개가 통과해도 화면이 새까맣거나
   HUD 가 안 뜨면 게임이 아니다. 그리고 그런 고장은 대개 "그리다가
   예외가 나서 루프가 멈췄다" 한 줄이다.

   그래서 캔버스 대신 **호출을 받아 적는 가짜 컨텍스트**를 물리고,
   낮·밤·소행성·연구소·사망을 한 번씩 그려 본다. 예외가 안 나고
   실제로 뭔가 그려졌는지를 본다.

   UI 는 linkedom 으로 진짜 DOM 을 세워 HTML 을 만들어 본다. 게임에는
   안 들어가는 시험용 의존성이다.
   ================================================================== */
import { parseHTML } from 'linkedom'
import * as Run from '../src/systems/RunSystem.ts'
import * as Asteroid from '../src/minigame/AsteroidDodge.ts'
import * as Labs from '../src/systems/LabSystem.ts'
import * as Spider from '../src/entities/Spider.ts'
import * as Effects from '../src/render/Effects.ts'
import * as Lighting from '../src/render/Lighting.ts'
import { Camera } from '../src/render/Camera.ts'
import { Renderer } from '../src/render/Renderer.ts'
import { addItem } from '../src/core/GameState.ts'
import { CENTER } from '../src/world/Tilemap.ts'
import type { GameState } from '../src/core/GameState.ts'

let pass = 0
let fail = 0
const fails: string[] = []
function ok(cond: boolean, msg: string): void {
  if (cond) pass++
  else { fail++; fails.push(msg) }
}
function section(n: string): void { process.stdout.write(`\n── ${n}\n`) }

/* ── 받아 적는 캔버스 ─────────────────────────────────────────── */
type Rec = { calls: Record<string, number>; fills: string[] }

function fakeCtx(): { ctx: CanvasRenderingContext2D; rec: Rec } {
  const rec: Rec = { calls: {}, fills: [] }
  const bump = (k: string) => { rec.calls[k] = (rec.calls[k] ?? 0) + 1 }
  const gradient = {
    addColorStop: () => bump('addColorStop'),
  }
  const target: Record<string, unknown> = {
    save: () => bump('save'),
    restore: () => bump('restore'),
    beginPath: () => bump('beginPath'),
    closePath: () => bump('closePath'),
    moveTo: () => bump('moveTo'),
    lineTo: () => bump('lineTo'),
    arc: () => bump('arc'),
    ellipse: () => bump('ellipse'),
    rect: () => bump('rect'),
    roundRect: () => bump('roundRect'),
    fill: () => bump('fill'),
    stroke: () => bump('stroke'),
    fillRect: () => bump('fillRect'),
    strokeRect: () => bump('strokeRect'),
    clearRect: () => bump('clearRect'),
    fillText: () => bump('fillText'),
    translate: () => bump('translate'),
    rotate: () => bump('rotate'),
    scale: () => bump('scale'),
    setTransform: () => bump('setTransform'),
    setLineDash: () => bump('setLineDash'),
    createRadialGradient: () => { bump('createRadialGradient'); return gradient },
    createLinearGradient: () => { bump('createLinearGradient'); return gradient },
    measureText: () => ({ width: 10 }),
  }
  /* 색·폰트 같은 속성은 대입만 받아 둔다. 무엇을 칠했는지 보려는 것. */
  const ctx = new Proxy(target, {
    get: (t, k) => t[k as string],
    set: (t, k, v) => {
      if (k === 'fillStyle' && typeof v === 'string') rec.fills.push(v)
      t[k as string] = v
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, rec }
}

const W = 1280
const H = 720

function drawOnce(s: GameState, label: string): Rec {
  const { ctx, rec } = fakeCtx()
  const cam = new Camera()
  cam.resize(W, H)
  cam.snapTo(s.player.x, s.player.z)
  const r = new Renderer(ctx)
  let threw = ''
  try {
    r.draw(s, cam, W, H, 1)
    Effects.drawNightWarning(ctx, s, W, H)
    Effects.drawFrost(ctx, s, W, H)
    Effects.drawDesaturation(ctx, s, W, H)
    Effects.drawHurt(ctx, 0.5, W, H)
  } catch (e) {
    threw = String(e)
  }
  ok(threw === '', `${label} — 그리다가 예외가 안 난다 ${threw}`)
  ok((rec.calls.fillRect ?? 0) > 0, `${label} — 실제로 뭔가 그린다`)
  return rec
}

// ══════════════════════════════════════════════════════
section('그리기 — 모든 국면을 한 번씩')
{
  /* 낮 */
  const { state: day } = Run.startRun({ seed: 'RENDER', modifierId: 'calm', unlocks: [] })
  const dayRec = drawOnce(day, '낮')
  ok(dayRec.fills.includes('#2B3A34') || dayRec.fills.length > 10, '지표를 칠한다')

  /* 밤 — 어둠이 덮인다 */
  const { state: night } = Run.startRun({ seed: 'RENDER', modifierId: 'calm', unlocks: [] })
  night.phase = 'night'
  night.phaseT = 40
  Spider.spawnForNight(night)
  const nightRec = drawOnce(night, '밤')
  ok((nightRec.calls.createRadialGradient ?? 0) > 0, '밤에는 광원 그라디언트를 쓴다')
  ok(Lighting.darkness(night) > 0.9, '밤은 어둡다')
  ok(Lighting.darkness(day) === 0, '낮은 안 어둡다')

  /* 캠프에 불이 있으면 따뜻한 광원이 생긴다 */
  night.campfire.level = 2
  night.campfire.safeRadius = 14
  const lights = Lighting.collectLights(night)
  ok(lights.some((l) => l.warm), '불이 있으면 따뜻한 광원이 있다')
  night.campfire.level = 0
  night.campfire.safeRadius = 0
  ok(!Lighting.collectLights(night).some((l) => l.warm), '불이 꺼지면 따뜻한 광원이 없다')

  /* 밤 예고 구간 */
  const { state: warn } = Run.startRun({ seed: 'RENDER', modifierId: 'calm', unlocks: [] })
  warn.phase = 'day'
  warn.phaseT = warn.daySeconds - 5
  const warnRec = drawOnce(warn, '밤 예고')
  ok((warnRec.calls.fillText ?? 0) > 0, '경고 문구를 쓴다')

  /* 질식 — 산소가 낮으면 화면이 반응한다(§16.3) */
  const { state: choke } = Run.startRun({ seed: 'RENDER', modifierId: 'calm', unlocks: [] })
  ok(Effects.suffocation(choke) === 0, '산소가 가득하면 멀쩡하다')
  choke.player.oxygen = choke.player.maxOxygen * 0.15
  ok(Effects.suffocation(choke) > 0.4, '30% 아래로 떨어지면 반응한다')
  choke.player.oxygen = choke.player.maxOxygen * 0.05
  ok(Effects.suffocation(choke) > 0.8, '더 떨어지면 더 심해진다')
  ok(Effects.desaturationAlpha(choke) > 0, '10% 아래는 채도가 빠진다')
  const chokeRec = drawOnce(choke, '질식')
  ok((chokeRec.calls.stroke ?? 0) > 0, '성에 결정을 그린다')

  /* 연구소 교전 */
  const { state: lab } = Run.startRun({ seed: 'RENDER', modifierId: 'calm', unlocks: [] })
  const target = lab.labs[0]
  lab.player.x = target.x
  lab.player.z = target.z
  Labs.enter(lab, target)
  drawOnce(lab, '연구소')
  ok(lab.beasts.length > 0, '연구소에 적이 있다')

  /* 건물이 잔뜩 있을 때 */
  const { state: built } = Run.startRun({ seed: 'RENDER', modifierId: 'calm', unlocks: [] })
  let id = 5000
  for (const type of [
    'farm', 'bed', 'wood_storage', 'recovery_capsule', 'turret',
    'bear_trap', 'rabbit_trap', 'repair_dock', 'camp_pillar', 'warp_beacon',
  ]) {
    built.buildings.push({
      id: id++, type, x: CENTER + 1, z: CENTER + 1,
      store: [{ id: 'wood', count: 7 }], cooldown: 0, armed: true, crop: 'carrot',
    })
  }
  const builtRec = drawOnce(built, '건물 열 종')
  ok((builtRec.calls.fillRect ?? 0) > 20, '건물마다 뭔가 그린다')

  /* 총알과 짐승 */
  const { state: combat } = Run.startRun({ seed: 'RENDER', modifierId: 'calm', unlocks: [] })
  combat.bullets.push({ x: CENTER, z: CENTER, vx: 10, vz: 0, life: 0.5, dmg: 60 })
  for (const b of combat.beasts) { b.x = CENTER + 1; b.z = CENTER + 1; b.hp = b.hp * 0.5 }
  drawOnce(combat, '전투')

  /* 미니맵 */
  const { ctx: mmCtx, rec: mmRec } = fakeCtx()
  const rr = new Renderer(mmCtx)
  let mmThrew = ''
  try {
    rr.drawMinimap(day, mmCtx, 148, false)
    rr.drawMinimap(day, mmCtx, 640, true)
  } catch (e) { mmThrew = String(e) }
  ok(mmThrew === '', `미니맵이 안 터진다 ${mmThrew}`)
  ok((mmRec.calls.fillRect ?? 0) > 0, '미니맵을 그린다')
}

// ══════════════════════════════════════════════════════
section('UI — HTML 이 실제로 만들어지는가')
{
  const { document } = parseHTML('<!doctype html><html><body><div id="app"></div></body></html>')
  const g = globalThis as unknown as Record<string, unknown>
  g.document = document
  g.window = { innerWidth: W, innerHeight: H, addEventListener: () => {} }

  const { HUD } = await import('../src/ui/HUD.ts')
  const { Panels } = await import('../src/ui/Inventory.ts')
  const { Lobby } = await import('../src/ui/Lobby.ts')
  const { Cutscene } = await import('../src/ui/Cutscene.ts')
  const { EndScreen } = await import('../src/ui/DeathScreen.ts')

  const mkRoot = () => {
    const el = document.createElement('div')
    document.getElementById('app')!.appendChild(el)
    return el as unknown as HTMLElement
  }

  /* ── HUD ─────────────────────────────────────────────────── */
  /* linkedom 의 캔버스에는 getContext 가 없다. innerHTML 로 만들어지는
     것까지 덮으려면 요소 하나가 아니라 프로토타입에 물려야 한다. */
  const { ctx: mmCtx } = fakeCtx()
  const canvasProto = Object.getPrototypeOf(document.createElement('canvas')) as Record<string, unknown>
  canvasProto.getContext = () => mmCtx

  const hudRoot = mkRoot()
  let hudThrew = ''
  let hud: InstanceType<typeof HUD> | null = null
  try {
    hud = new HUD(hudRoot)
  } catch (e) { hudThrew = String(e) }
  ok(hudThrew === '' && hud !== null, `HUD 를 세운다 ${hudThrew}`)
  ok(hudRoot.querySelectorAll('.bar').length === 4, '바가 넷이다 (산소·우주복·배고픔·기력)')
  ok(hudRoot.querySelector('#day') !== null, '날짜 칸이 있다')

  const { state: s } = Run.startRun({ seed: 'UI', modifierId: 'calm', unlocks: [] })
  const rnd = new Renderer(mmCtx)
  let syncThrew = ''
  try {
    hud!.sync(s, rnd, { key: 'E', text: '크래프팅 기계' })
  } catch (e) { syncThrew = String(e) }
  ok(syncThrew === '', `HUD 를 갱신한다 ${syncThrew}`)

  const hudText = hudRoot.textContent ?? ''
  ok(hudText.includes('DAY 001'), '날짜를 보여 준다')
  ok(hudText.includes('크래프팅 기계'), '상호작용 안내를 보여 준다')
  ok(hudRoot.querySelectorAll('.slot').length === 8, '퀵슬롯 여덟 칸')

  /* ★ 시계가 없으면 시간이 안 보인다(§3.2) — UI 를 감추는 것이
     아이템의 값어치를 만드는 방식이라, 실제로 감춰지는지 본다. */
  ok(hudRoot.querySelector('#clock')!.classList.contains('hidden'), '시계가 없으면 시간이 숨는다')
  ok(hudRoot.querySelector('#minimap-wrap')!.classList.contains('hidden'), '지도가 없으면 미니맵이 숨는다')

  s.flags.hasClock = true
  s.flags.hasMap = true
  hud!.setExpanded(false)
  hud!.sync(s, rnd, null)
  ok(!hudRoot.querySelector('#clock')!.classList.contains('hidden'), '시계를 만들면 시간이 보인다')

  s.flags.hasCompass = true
  hud!.sync(s, rnd, null)
  ok((hudRoot.textContent ?? '').includes('연구소'), '나침반이 연구소 방향을 알려 준다')

  /* ── 패널 ─────────────────────────────────────────────────── */
  const panelRoot = mkRoot()
  const panels = new Panels(panelRoot, () => {})
  for (const kind of ['inventory', 'crafting', 'campfire'] as const) {
    let threw = ''
    try {
      panels.show(kind, s)
    } catch (e) { threw = String(e) }
    ok(threw === '', `${kind} 창이 안 터진다 ${threw}`)
    ok((panelRoot.textContent ?? '').length > 40, `${kind} 창에 내용이 있다`)
  }

  panels.show('crafting', s)
  const craftText = panelRoot.textContent ?? ''
  ok(craftText.includes('침대'), '레시피를 보여 준다')
  /* ★ 잠긴 것도 보여 준다 — 목표가 보여야 모은다 */
  ok(craftText.includes('레벨 2'), '아직 못 만드는 2레벨 항목도 보인다')

  panels.show('campfire', s)
  ok((panelRoot.textContent ?? '').includes('통나무'), '연료를 보여 준다')

  addItem(s, 'meat_large_raw', 2)
  panels.show('inventory', s)
  ok((panelRoot.textContent ?? '').includes('큰 고기'), '가진 것을 보여 준다')

  /* ── 로비 ─────────────────────────────────────────────────── */
  const lobbyRoot = mkRoot()
  let started: unknown = null
  const lobby = new Lobby(
    lobbyRoot,
    { blackbox: 500, unlocks: ['manual'], runs: 3, bestDay: 42, escapes: 0, leaderboard: [] },
    (r) => { started = r },
    () => {},
  )
  let lobbyThrew = ''
  try { lobby.show() } catch (e) { lobbyThrew = String(e) }
  ok(lobbyThrew === '', `로비가 안 터진다 ${lobbyThrew}`)
  const lobbyText = lobbyRoot.textContent ?? ''
  ok(lobbyText.includes('DAY 100'), '제목')
  ok(lobbyText.includes('500'), '블랙박스 잔고')
  ok(lobbyText.includes('정비 매뉴얼'), '해금 목록')
  ok(lobbyRoot.querySelector('#seed-input') !== null, '시드를 입력할 수 있다')
  lobby.start()
  ok(started !== null, '시작을 누르면 런 설정이 넘어온다')

  /* ── 컷씬 / 결과 ──────────────────────────────────────────── */
  const cinemaRoot = mkRoot()
  const cut = new Cutscene(cinemaRoot)
  let done = false
  cut.play('crash', () => { done = true })
  ok(cut.active, '컷씬이 돈다')
  for (let i = 0; i < 40; i++) cut.tick(0.2)
  cut.skip()
  ok(done, '컷씬을 넘기면 끝난다')

  const end = new EndScreen(cinemaRoot)
  s.death = { cause: 'spider', day: 37 }
  s.phase = 'dead'
  let backed = false
  end.showDeath(s, () => { backed = true })
  const deathText = cinemaRoot.textContent ?? ''
  ok(deathText.includes('신호 두절'), '사망 화면')
  ok(deathText.includes('외계 거미'), '사인을 보여 준다')
  ok(deathText.includes('블랙박스'), '얻은 것을 보여 준다')
  ;(cinemaRoot.querySelector('#back') as unknown as { click: () => void }).click()
  ok(backed, '로비로 돌아간다')

  s.phase = 'escaped'
  s.elapsed = 55 * 60
  end.showEscape(s, () => {})
  const escText = cinemaRoot.textContent ?? ''
  ok(escText.includes('지구 귀환'), '엔딩 화면')
  ok(escText.includes('A'), '랭크를 보여 준다')

  /* ── 소행성 화면 ─────────────────────────────────────────── */
  const { state: ast } = Run.startRun({ seed: 'UI', modifierId: 'calm', unlocks: [] })
  Asteroid.begin(ast, 3)
  for (let i = 0; i < 120; i++) Asteroid.update(ast, 1 / 60, { up: false, down: false, left: true, right: false })
  ok(ast.asteroid.rocks.length > 0, '소행성이 날아온다')
  ok(ast.asteroid.shipX < 450, '조작이 배를 움직인다')
}

// ══════════════════════════════════════════════════════
section('결과')
if (fail) for (const f of fails.slice(0, 30)) console.log('  ✗ ' + f)
console.log(`\n${fail === 0 ? '✅' : '❌'}  그리기·UI 검증: 통과 ${pass} / 실패 ${fail}\n`)
process.exit(fail ? 1 : 0)
