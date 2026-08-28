/* ==================================================================
   그리기·UI 검증 — 브라우저 없이

   로직이 4만 개 통과해도 화면이 새까맣거나 HUD 가 안 뜨면 게임이
   아니다. 그리고 그런 고장은 대개 "그리다가 예외가 나서 루프가 멈췄다"
   한 줄이다.

   캔버스 대신 **호출을 받아 적는 가짜 컨텍스트**를 물리고, 낮·밤·불
   꺼짐·습격·소행성·연구소·날씨를 한 번씩 그려 본다. UI 는 linkedom 으로
   진짜 DOM 을 세워 HTML 을 만들어 본다(시험용 의존성).
   ================================================================== */
import { parseHTML } from 'linkedom'
import * as Run from '../src/systems/RunSystem.ts'
import * as Campfire from '../src/systems/CampfireSystem.ts'
import * as Raid from '../src/systems/RaidSystem.ts'
import * as Labs from '../src/systems/LabSystem.ts'
import * as Asteroid from '../src/minigame/AsteroidDodge.ts'
import * as Salvage from '../src/minigame/Salvage.ts'
import * as Spider from '../src/entities/Spider.ts'
import * as Effects from '../src/render/Effects.ts'
import * as Lighting from '../src/render/Lighting.ts'
import * as ZoneGate from '../src/world/ZoneGate.ts'
import { Camera } from '../src/render/Camera.ts'
import { Renderer } from '../src/render/Renderer.ts'
import { addItem, type GameState } from '../src/core/GameState.ts'
import { CENTER } from '../src/world/Tilemap.ts'
import { fireLevelDef } from '../src/data/index.ts'

let pass = 0
let fail = 0
const fails: string[] = []
function ok(cond: boolean, msg: string): void {
  if (cond) pass++
  else { fail++; fails.push(msg) }
}
function section(n: string): void { process.stdout.write(`\n── ${n}\n`) }

type Rec = { calls: Record<string, number>; fills: string[] }

function fakeCtx(): { ctx: CanvasRenderingContext2D; rec: Rec } {
  const rec: Rec = { calls: {}, fills: [] }
  const bump = (k: string) => { rec.calls[k] = (rec.calls[k] ?? 0) + 1 }
  const gradient = { addColorStop: () => bump('addColorStop') }
  const target: Record<string, unknown> = {
    save: () => bump('save'), restore: () => bump('restore'),
    beginPath: () => bump('beginPath'), closePath: () => bump('closePath'),
    moveTo: () => bump('moveTo'), lineTo: () => bump('lineTo'),
    arc: () => bump('arc'), ellipse: () => bump('ellipse'),
    rect: () => bump('rect'), roundRect: () => bump('roundRect'),
    fill: () => bump('fill'), stroke: () => bump('stroke'),
    fillRect: () => bump('fillRect'), strokeRect: () => bump('strokeRect'),
    clearRect: () => bump('clearRect'), fillText: () => bump('fillText'),
    translate: () => bump('translate'), rotate: () => bump('rotate'),
    scale: () => bump('scale'), setTransform: () => bump('setTransform'),
    setLineDash: () => bump('setLineDash'),
    createRadialGradient: () => { bump('createRadialGradient'); return gradient },
    createLinearGradient: () => { bump('createLinearGradient'); return gradient },
    measureText: () => ({ width: 10 }),
  }
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
const mk = (seed = 'R') => Run.startRun({ seed, jobId: 'pilot', modifierId: 'calm' })

function light(s: GameState, lv: number): void {
  const def = fireLevelDef(lv)
  s.campfire.heat = def ? def.min + 5 : 0
  Campfire.update(s, 0.0001)
}

function drawOnce(s: GameState, label: string): Rec {
  const { ctx, rec } = fakeCtx()
  const cam = new Camera()
  cam.resize(W, H)
  cam.snapTo(s.player.x, s.player.z)
  const r = new Renderer(ctx)
  let threw = ''
  try {
    r.draw(s, cam, W, H, 1)
    Effects.drawWeather(ctx, s, W, H)
    Effects.drawNightWarning(ctx, s, W, H)
    Effects.drawExtinguished(ctx, s, W, H)
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
  const { state: day } = mk()
  light(day, 2)
  const dayRec = drawOnce(day, '낮')
  ok(dayRec.fills.length > 10, '지표를 칠한다')

  /* 밤 */
  const { state: night } = mk()
  light(night, 3)
  night.day = 5
  night.phase = 'night'
  night.phaseT = 40
  Spider.spawnForNight(night)
  const nightRec = drawOnce(night, '밤')
  ok((nightRec.calls.createRadialGradient ?? 0) > 0, '밤에는 광원 그라디언트를 쓴다')
  ok(Lighting.darkness(night) > 0.9, '밤은 어둡다')
  ok(Lighting.darkness(day) === 0, '낮은 안 어둡다')
  ok(Lighting.collectLights(night).some((l) => l.warm), '불이 있으면 따뜻한 광원')

  /* ★ 불이 꺼진 밤 */
  const { state: out } = mk()
  light(out, 3)
  out.day = 5
  out.phase = 'night'
  out.phaseT = 40
  out.campfire.heat = 0
  Campfire.update(out, 0.0001)
  Spider.spawnForNight(out)
  ok(out.spiders.length === 2, '불이 꺼지면 거미 둘')
  ok(!Lighting.collectLights(out).some((l) => l.warm), '꺼지면 따뜻한 광원이 없다')
  drawOnce(out, '불 꺼진 밤')

  /* 에너지 장벽이 그려지는가 */
  const { state: gate } = mk()
  light(gate, 2)
  const gateRec = drawOnce(gate, '장벽')
  ok((gateRec.calls.setLineDash ?? 0) > 0, '장벽을 점선으로 그린다')
  ok(ZoneGate.openRadiusOf(gate) === 45, '장벽 반경이 맞다')

  /* 밤 예고 */
  const { state: warn } = mk()
  light(warn, 1)
  warn.phase = 'day'
  warn.phaseT = warn.daySeconds - 5
  const warnRec = drawOnce(warn, '밤 예고')
  ok((warnRec.calls.fillText ?? 0) > 0, '경고 문구를 쓴다')

  /* 질식(§20.3) */
  const { state: choke } = mk()
  light(choke, 1)
  ok(Effects.suffocation(choke) === 0, '산소가 가득하면 멀쩡하다')
  choke.player.oxygen = choke.player.maxOxygen * 0.15
  ok(Effects.suffocation(choke) > 0.4, '30% 아래로 떨어지면 반응한다')
  choke.player.oxygen = choke.player.maxOxygen * 0.05
  ok(Effects.desaturationAlpha(choke) > 0, '10% 아래는 채도가 빠진다')
  const chokeRec = drawOnce(choke, '질식')
  ok((chokeRec.calls.stroke ?? 0) > 0, '성에 결정을 그린다')

  /* 날씨 셋 */
  for (const kind of ['acid_rain', 'magnetic_storm', 'spore_fog'] as const) {
    const { state: w } = mk()
    light(w, 2)
    w.weather.kind = kind
    w.weather.remain = 60
    if (kind === 'magnetic_storm') w.player.stormWarnT = 1
    drawOnce(w, `날씨 ${kind}`)
  }

  /* 습격 밤 */
  const { state: raid } = mk()
  light(raid, 3)
  raid.day = 4
  raid.phase = 'night'
  Raid.beginNight(raid)
  ok(raid.raiders.length > 0, '약탈자가 나온다')
  drawOnce(raid, '습격')

  /* 연구소 */
  const { state: lab } = mk()
  light(lab, 3)
  const target = lab.labs[0]
  lab.player.x = target.x
  lab.player.z = target.z
  Labs.enter(lab, target)
  drawOnce(lab, '연구소')
  ok(lab.beasts.length > 0, '연구소에 적이 있다')

  /* 건물 전부 */
  const { state: built } = mk()
  light(built, 4)
  let id = 5000
  for (const type of [
    'farm', 'bed', 'bed_scrap', 'wood_storage', 'recovery_capsule', 'turret',
    'bear_trap', 'rabbit_trap', 'repair_dock', 'wall_wood', 'wall_steel',
    'warp_beacon', 'time_accelerator', 'cooking_pot', 'ammo_press',
  ]) {
    built.buildings.push({
      id: id++, type, x: CENTER + 1, z: CENTER + 1,
      store: [{ id: 'log', count: 7 }], cooldown: 0, armed: true,
      crop: 'carrot', hp: 100, maxHp: 200,
    })
  }
  built.escapeBuilt = ['escape_radar', 'escape_landing']
  const builtRec = drawOnce(built, '건물 열다섯 종')
  ok((builtRec.calls.fillRect ?? 0) > 25, '건물마다 뭔가 그린다')

  /* 대원 */
  const { state: crew } = mk()
  light(crew, 2)
  crew.crew = ['rohan', 'mira', 'kai', 'ellen']
  drawOnce(crew, '대원 넷')

  /* 전투 */
  const { state: fight } = mk()
  light(fight, 3)
  fight.bullets.push(
    { x: CENTER, z: CENTER, vx: 10, vz: 0, life: 0.5, dmg: 60, fromPlayer: true, pierce: false },
    { x: CENTER, z: CENTER, vx: -10, vz: 0, life: 0.5, dmg: 30, fromPlayer: false, pierce: false },
  )
  for (const b of fight.beasts) { b.x = CENTER + 2; b.z = CENTER + 2; b.hp *= 0.5 }
  drawOnce(fight, '전투')

  /* 미니맵 */
  const { ctx: mmCtx, rec: mmRec } = fakeCtx()
  const rr = new Renderer(mmCtx)
  let mmThrew = ''
  try {
    rr.drawMinimap(day, mmCtx, 150, false)
    day.crew.push('ellen')
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

  /* linkedom 의 캔버스에는 getContext 가 없다. innerHTML 로 만들어지는
     것까지 덮으려면 요소 하나가 아니라 프로토타입에 물려야 한다. */
  const { ctx: mmCtx } = fakeCtx()
  const canvasProto = Object.getPrototypeOf(document.createElement('canvas')) as Record<string, unknown>
  canvasProto.getContext = () => mmCtx

  /* ── HUD ─────────────────────────────────────────────────── */
  const hudRoot = mkRoot()
  let hudThrew = ''
  let hud: InstanceType<typeof HUD> | null = null
  try { hud = new HUD(hudRoot) } catch (e) { hudThrew = String(e) }
  ok(hudThrew === '' && hud !== null, `HUD 를 세운다 ${hudThrew}`)
  ok(hudRoot.querySelectorAll('.bar').length === 4, '바가 넷')
  ok(hudRoot.querySelector('#fire') !== null, '★ 캠프파이어 게이지가 있다')

  const { state: s } = mk('UI')
  light(s, 3)
  const rnd = new Renderer(mmCtx)
  let syncThrew = ''
  try { hud!.sync(s, rnd, { key: 'E', text: '제작 모듈' }) } catch (e) { syncThrew = String(e) }
  ok(syncThrew === '', `HUD 를 갱신한다 ${syncThrew}`)

  const hudText = () => hudRoot.textContent ?? ''
  ok(hudText().includes('DAY 001'), '날짜를 보여 준다')
  /* §19.2 는 "DAY 041 / 99" 다. 마감일이 안 보이면 이 게임의 전제가
     화면 어디에도 안 적혀 있게 된다. */
  ok(hudText().includes('DAY 001 / 99'), '★ 마감일(99)을 같이 보여 준다')
  ok(hudText().includes('Lv3'), '캠프파이어 레벨을 보여 준다')
  ok(hudText().includes('제작 모듈'), '상호작용 안내')
  ok(hudRoot.querySelectorAll('.slot').length === 8, '퀵슬롯 여덟 칸')

  /* 시계·지도가 없으면 숨는다 */
  ok(hudRoot.querySelector('#clock')!.classList.contains('hidden'), '시계가 없으면 시간이 숨는다')
  ok(hudRoot.querySelector('#minimap-wrap')!.classList.contains('hidden'), '지도가 없으면 미니맵이 숨는다')
  s.flags.hasClock = true
  s.flags.hasMap = true
  hud!.setExpanded(false)
  hud!.sync(s, rnd, null)
  ok(!hudRoot.querySelector('#clock')!.classList.contains('hidden'), '시계를 만들면 시간이 보인다')
  ok(!hudRoot.querySelector('#minimap-wrap')!.classList.contains('hidden'), '지도를 만들면 미니맵이 보인다')

  /* 자기폭풍이면 미니맵이 다시 숨는다(§15) */
  s.weather.kind = 'magnetic_storm'
  s.weather.remain = 60
  hud!.sync(s, rnd, null)
  ok(hudRoot.querySelector('#minimap-wrap')!.classList.contains('hidden'), '자기폭풍이면 미니맵이 안 보인다')
  ok(hudText().includes('자기폭풍'), '날씨를 알려 준다')
  s.weather.kind = 'clear'

  /* 불이 꺼지면 게이지가 붉어진다 */
  s.campfire.heat = 0
  Campfire.update(s, 0.0001)
  hud!.sync(s, rnd, null)
  ok(hudRoot.querySelector('#fire')!.classList.contains('out'), '꺼지면 게이지가 경고색')
  ok(hudText().includes('꺼짐'), '꺼졌다고 쓴다')
  light(s, 3)

  /* 대원 표시 */
  s.crew = ['rohan', 'kai']
  hud!.sync(s, rnd, null)
  ok(hudText().includes('로한'), '대원을 보여 준다')

  /* 잔해 채취 바 */
  Salvage.begin(s, 1)
  hud!.sync(s, rnd, null)
  ok(hudText().includes('잔해 채취'), '채취 바가 뜬다')
  Salvage.stop(s)

  /* 배너 */
  s.banner = { text: '테스트 배너', life: 3 }
  hud!.sync(s, rnd, null)
  ok(hudText().includes('테스트 배너'), '배너가 뜬다')

  /* ── 패널 ─────────────────────────────────────────────────── */
  const panelRoot = mkRoot()
  const panels = new Panels(panelRoot, () => {})
  for (const kind of ['inventory', 'crafting', 'campfire'] as const) {
    let threw = ''
    try { panels.show(kind, s) } catch (e) { threw = String(e) }
    ok(threw === '', `${kind} 창이 안 터진다 ${threw}`)
    ok((panelRoot.textContent ?? '').length > 40, `${kind} 창에 내용이 있다`)
  }

  panels.show('crafting', s)
  const craftText = panelRoot.textContent ?? ''
  ok(craftText.includes('침대'), '레시피를 보여 준다')
  ok(craftText.includes('레벨 2'), '아직 못 만드는 2레벨도 보인다')

  panels.show('campfire', s)
  const fireText = panelRoot.textContent ?? ''
  ok(fireText.includes('통나무'), '연료를 보여 준다')
  ok(fireText.includes('화력'), '화력 수치를 보여 준다')

  addItem(s, 'meat_large_raw', 2)
  addItem(s, 'gastank', 1)
  panels.show('inventory', s)
  ok((panelRoot.textContent ?? '').includes('큰 고기'), '가진 것을 보여 준다')

  /* ── 로비 ─────────────────────────────────────────────────── */
  const lobbyRoot = mkRoot()
  let started: unknown = null
  const lobby = new Lobby(
    lobbyRoot,
    { blackbox: 600, jobs: ['pilot', 'mechanic'], runs: 3, bestDay: 42, escapes: 0, leaderboard: [] },
    (r) => { started = r },
    () => {},
  )
  let lobbyThrew = ''
  try { lobby.show() } catch (e) { lobbyThrew = String(e) }
  ok(lobbyThrew === '', `로비가 안 터진다 ${lobbyThrew}`)
  const lobbyText = lobbyRoot.textContent ?? ''
  ok(lobbyText.includes('행성에서의 99일'), '제목')
  ok(lobbyText.includes('600'), '블랙박스 잔고')
  ok(lobbyText.includes('정비공'), '직책 목록')
  ok(lobbyText.includes('관제사'), '못 산 직책도 보인다')
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
  s.death = { cause: 'spider_hungry', day: 37 }
  s.phase = 'dead'
  let backed = false
  end.showDeath(s, () => { backed = true })
  const deathText = cinemaRoot.textContent ?? ''
  ok(deathText.includes('신호 두절'), '사망 화면')
  ok(deathText.includes('굶주린 거미'), '사인을 보여 준다')
  ok(deathText.includes('캠프파이어 최고 레벨'), '§17.4 의 형식')
  ;(cinemaRoot.querySelector('#back') as unknown as { click: () => void }).click()
  ok(backed, '로비로 돌아간다')

  /* 엔딩 셋(§17.2) */
  s.phase = 'escaped'
  s.elapsed = 50 * 60
  s.day = 99
  s.crew = ['rohan', 'mira', 'kai', 'ellen']
  end.showEscape(s, () => {})
  ok((cinemaRoot.textContent ?? '').includes('완전 귀환'), '완전 귀환 엔딩')
  s.crew = ['rohan']
  end.showEscape(s, () => {})
  const partial = cinemaRoot.textContent ?? ''
  ok(partial.includes('부분 귀환'), '부분 귀환 엔딩')
  ok(partial.includes('미라'), '남겨진 대원을 이름으로 보여 준다')
  s.day = 124
  end.showEscape(s, () => {})
  ok((cinemaRoot.textContent ?? '').includes('지연 귀환'), '지연 귀환 엔딩')

  /* ── 소행성 ───────────────────────────────────────────────── */
  const { state: ast } = mk('UI2')
  Asteroid.begin(ast, 75)
  ast.allowedFailures = 9999
  for (let i = 0; i < 120; i++) {
    Asteroid.update(ast, 1 / 60, { up: false, down: false, left: true, right: false })
  }
  ok(ast.asteroid.rocks.length > 0, '소행성이 날아온다')
  ok(ast.asteroid.shipX < 450, '조작이 배를 움직인다')
}

// ══════════════════════════════════════════════════════
section('결과')
if (fail) for (const f of fails.slice(0, 30)) console.log('  ✗ ' + f)
console.log(`\n${fail === 0 ? '✅' : '❌'}  그리기·UI 검증: 통과 ${pass} / 실패 ${fail}\n`)
process.exit(fail ? 1 : 0)
