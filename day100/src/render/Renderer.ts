/* ==================================================================
   그리기

   §16.1 "형광 규조토" — 심해 생물 같은 외계 행성. 스프라이트가 없으므로
   전부 도형으로 그리되, 실루엣만으로 구분되게 만든다(§10.1). 어두운
   방에서 덩치만 보고 "저건 브루트다"가 나와야 한다는 원칙을 여기서는
   "덩치와 색만 보고 곰인지 늑대인지"로 옮겼다.

   자원은 형광(#5FF2C8)으로 칠한다. 어두운 지표 위에서 그것만 빛나면
   플레이어의 눈이 저절로 자원을 따라간다.
   ================================================================== */
import type { GameState } from '../core/GameState.ts'
import { ENEMIES, ZONES } from '../data/index.ts'
import { TILE, TILES, tileTint, distanceFromCenter } from '../world/Tilemap.ts'
import { SHIP } from '../world/MapGen.ts'
import { isExplored } from '../world/FogOfWar.ts'
import type { Camera } from './Camera.ts'
import { skyTint, drawDarkness } from './Lighting.ts'
import { BALANCE } from '../data/index.ts'

export const PALETTE = {
  ground: '#2B3A34',
  skyDay: '#7FA894',
  skyNight: '#141127',
  campLight: '#FFB347',
  glow: '#5FF2C8',
  spider: '#C8235A',
  ink: '#0B0E14',
}

const CENTER = BALANCE.map.centerTile

export class Renderer {
  constructor(private ctx: CanvasRenderingContext2D) {}

  draw(s: GameState, cam: Camera, w: number, h: number, visionFactor: number): void {
    const ctx = this.ctx
    ctx.save()
    ctx.clearRect(0, 0, w, h)

    this.drawGround(s, cam, w, h)
    this.drawCampArea(s, cam)
    this.drawLabZone(s, cam)
    this.drawStructures(s, cam)
    this.drawResources(s, cam)
    this.drawShip(cam)
    this.drawBeasts(s, cam)
    this.drawBullets(s, cam)
    this.drawPlayer(s, cam)
    this.drawSpiders(s, cam)

    drawDarkness(ctx, s, cam, w, h, visionFactor)
    ctx.restore()
  }

  /* ── 지표 ───────────────────────────────────────────────────── */
  private drawGround(s: GameState, cam: Camera, w: number, h: number): void {
    const ctx = this.ctx
    ctx.fillStyle = skyTint(s)
    ctx.fillRect(0, 0, w, h)

    const b = cam.visibleBounds(1)
    const x0 = Math.max(0, Math.floor(b.x0))
    const z0 = Math.max(0, Math.floor(b.z0))
    const x1 = Math.min(TILES - 1, Math.ceil(b.x1))
    const z1 = Math.min(TILES - 1, Math.ceil(b.z1))

    for (let tz = z0; tz <= z1; tz++) {
      for (let tx = x0; tx <= x1; tx++) {
        const zone = ZONES.find((zz) => distanceFromCenter(tx + 0.5, tz + 0.5) < zz.outerRadius) ?? ZONES[ZONES.length - 1]
        const t = tileTint(s.seed, tx, tz)
        ctx.fillStyle = t > 0.82 ? zone.accent : zone.ground
        const sx = cam.toScreenX(tx)
        const sy = cam.toScreenY(tz)
        ctx.fillRect(sx, sy, TILE + 1, TILE + 1)

        /* 포자 — 3존에만. 외계 느낌은 색이 아니라 밀도로 낸다. */
        if (zone.id === 3 && t > 0.965) {
          ctx.fillStyle = 'rgba(95, 242, 200, 0.20)'
          ctx.beginPath()
          ctx.arc(sx + TILE / 2, sy + TILE / 2, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    /* 맵 밖은 확실히 다르게. 여기가 끝이라는 걸 화면으로 알려야 한다. */
    ctx.fillStyle = 'rgba(8, 10, 16, 0.85)'
    const left = cam.toScreenX(0)
    const top = cam.toScreenY(0)
    const right = cam.toScreenX(TILES)
    const bottom = cam.toScreenY(TILES)
    if (left > 0) ctx.fillRect(0, 0, left, h)
    if (top > 0) ctx.fillRect(0, 0, w, top)
    if (right < w) ctx.fillRect(right, 0, w - right, h)
    if (bottom < h) ctx.fillRect(0, bottom, w, h - bottom)
  }

  /* 안전반경을 낮에도 옅게 보여 준다. 밤에 어디까지가 안전인지
     미리 알아야 계획이 선다. */
  private drawCampArea(s: GameState, cam: Camera): void {
    if (s.campfire.safeRadius <= 0) return
    const ctx = this.ctx
    const cx = cam.toScreenX(CENTER)
    const cy = cam.toScreenY(CENTER)
    const r = s.campfire.safeRadius * TILE
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 179, 71, 0.42)'
    ctx.setLineDash([9, 7])
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  private drawLabZone(s: GameState, cam: Camera): void {
    const lab = s.activeLab
    if (!lab) return
    const ctx = this.ctx
    const cx = cam.toScreenX(lab.x)
    const cy = cam.toScreenY(lab.z)
    const r = lab.radius * TILE
    ctx.save()
    ctx.fillStyle = 'rgba(12, 8, 20, 0.35)'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(200, 35, 90, 0.75)'
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.restore()
  }

  private drawShip(cam: Camera): void {
    const ctx = this.ctx
    const x = cam.toScreenX(SHIP.x)
    const y = cam.toScreenY(SHIP.z)
    ctx.save()
    /* 불시착한 배 — 기울어진 선체 */
    ctx.translate(x, y)
    ctx.rotate(0.42)
    ctx.fillStyle = '#4A5560'
    ctx.beginPath()
    ctx.ellipse(0, 0, TILE * 2.0, TILE * 1.15, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#39424C'
    ctx.fillRect(-TILE * 2.4, -TILE * 0.28, TILE * 1.1, TILE * 0.56)
    ctx.fillStyle = 'rgba(95, 242, 200, 0.55)'
    ctx.beginPath()
    ctx.ellipse(TILE * 0.6, -TILE * 0.15, TILE * 0.5, TILE * 0.32, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  private drawCampfire(s: GameState, cam: Camera): void {
    const ctx = this.ctx
    const x = cam.toScreenX(CENTER)
    const y = cam.toScreenY(CENTER + 2.6)
    const lit = s.campfire.level > 0
    ctx.save()
    ctx.fillStyle = '#3A2E22'
    ctx.beginPath()
    ctx.arc(x, y, 11, 0, Math.PI * 2)
    ctx.fill()
    if (lit) {
      const flicker = 0.8 + 0.2 * Math.sin(s.elapsed * 11)
      const g = ctx.createRadialGradient(x, y, 1, x, y, 17 * flicker)
      g.addColorStop(0, '#FFE0A0')
      g.addColorStop(0.45, PALETTE.campLight)
      g.addColorStop(1, 'rgba(255, 120, 40, 0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, 17 * flicker, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  /* ── 자원 ───────────────────────────────────────────────────── */
  private drawResources(s: GameState, cam: Camera): void {
    const ctx = this.ctx
    const b = cam.visibleBounds(2)
    const vis = (x: number, z: number) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1

    for (const t of s.trees) {
      if (!vis(t.x, t.z)) continue
      const x = cam.toScreenX(t.x)
      const y = cam.toScreenY(t.z)
      if (t.kind === 'sapling') {
        ctx.fillStyle = '#4E7A5E'
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, Math.PI * 2)
        ctx.fill()
        continue
      }
      const big = t.kind === 'tree_large'
      const r = big ? 17 : 10
      ctx.fillStyle = big ? '#1E3A30' : '#25473A'
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = big ? '#2F5B48' : '#356A54'
      ctx.beginPath()
      ctx.arc(x - r * 0.22, y - r * 0.24, r * 0.62, 0, Math.PI * 2)
      ctx.fill()
      /* 팬 만큼 표시. 몇 대 남았는지 눈으로 알아야 도끼를 바꿀지 판단한다. */
      if (t.hits > 0) {
        ctx.strokeStyle = 'rgba(255,200,120,0.85)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(x, y, r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, t.hits / 13))
        ctx.stroke()
      }
    }

    for (const j of s.junk) {
      if (!vis(j.x, j.z)) continue
      const x = cam.toScreenX(j.x)
      const y = cam.toScreenY(j.z)
      ctx.fillStyle = '#8A94A0'
      ctx.fillRect(x - 5, y - 4, 10, 8)
      ctx.fillStyle = 'rgba(95, 242, 200, 0.55)'
      ctx.fillRect(x - 5, y - 4, 10, 2)
    }

    for (const f of s.fuelNodes) {
      if (!vis(f.x, f.z)) continue
      const x = cam.toScreenX(f.x)
      const y = cam.toScreenY(f.z)
      const colors: Record<number, string> = { 2: '#3A3A42', 3: '#6B4A22', 4: '#2D5A6B' }
      ctx.fillStyle = colors[f.grade] ?? '#555'
      ctx.beginPath()
      ctx.roundRect(x - 7, y - 9, 14, 18, 3)
      ctx.fill()
      ctx.fillStyle = PALETTE.glow
      ctx.fillRect(x - 7, y + 4, 14, 2)
    }

    for (const a of s.armories) {
      if (a.opened || !vis(a.x, a.z)) continue
      const x = cam.toScreenX(a.x)
      const y = cam.toScreenY(a.z)
      ctx.fillStyle = '#3E4A55'
      ctx.fillRect(x - 13, y - 10, 26, 20)
      ctx.strokeStyle = PALETTE.glow
      ctx.lineWidth = 2
      ctx.strokeRect(x - 13, y - 10, 26, 20)
      ctx.fillStyle = PALETTE.glow
      ctx.font = '12px "Space Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText('무기고', x, y + 24)
    }

    /* 연구소 입구는 지상에서 잘 안 보인다(§12.1). 밟아야 열린다. */
    for (const l of s.labs) {
      if (!vis(l.x, l.z)) continue
      const x = cam.toScreenX(l.x)
      const y = cam.toScreenY(l.z)
      ctx.save()
      ctx.globalAlpha = l.cleared ? 0.35 : 0.85
      ctx.fillStyle = l.cleared ? '#3A4048' : '#1A2530'
      ctx.beginPath()
      ctx.arc(x, y, 15, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = l.cleared ? '#4A5560' : PALETTE.glow
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = l.cleared ? '#6A7480' : PALETTE.glow
      ctx.font = 'bold 13px "Space Mono", monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(l.tier), x, y)
      ctx.restore()
    }
  }

  /* ── 건물 ───────────────────────────────────────────────────── */
  private drawStructures(s: GameState, cam: Camera): void {
    const ctx = this.ctx
    for (const b of s.buildings) {
      const x = cam.toScreenX(b.x)
      const y = cam.toScreenY(b.z)
      switch (b.type) {
        case 'farm': {
          ctx.fillStyle = '#3B3222'
          ctx.fillRect(x - 14, y - 14, 28, 28)
          if (b.crop) {
            ctx.fillStyle = b.crop === 'carrot' ? '#D97A2B' : '#E3C74A'
            ctx.beginPath()
            ctx.arc(x, y, 7, 0, Math.PI * 2)
            ctx.fill()
          }
          break
        }
        case 'bed':
        case 'bed_scrap':
        case 'bed_alloy':
        case 'bed_prime': {
          ctx.fillStyle = '#4A5A6A'
          ctx.fillRect(x - 11, y - 16, 22, 32)
          ctx.fillStyle = '#7FA894'
          ctx.fillRect(x - 11, y - 16, 22, 9)
          break
        }
        case 'wood_storage': {
          const have = (b.store ?? []).reduce((a, v) => a + v.count, 0)
          ctx.fillStyle = '#4A3B28'
          ctx.fillRect(x - 13, y - 11, 26, 22)
          ctx.fillStyle = PALETTE.glow
          ctx.font = '11px "Space Mono", monospace'
          ctx.textAlign = 'center'
          ctx.fillText(String(have), x, y + 4)
          break
        }
        case 'recovery_capsule': {
          ctx.fillStyle = (b.cooldown ?? 0) > 0 ? '#3A4048' : '#2E5A66'
          ctx.beginPath()
          ctx.roundRect(x - 13, y - 20, 26, 40, 12)
          ctx.fill()
          ctx.strokeStyle = (b.cooldown ?? 0) > 0 ? '#55606C' : PALETTE.glow
          ctx.lineWidth = 2
          ctx.stroke()
          break
        }
        case 'turret': {
          ctx.fillStyle = '#4A5560'
          ctx.beginPath()
          ctx.arc(x, y, 11, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = PALETTE.glow
          ctx.lineWidth = 2
          ctx.stroke()
          break
        }
        case 'bear_trap':
        case 'rabbit_trap': {
          ctx.strokeStyle = b.type === 'bear_trap' ? '#9AA4B0' : '#7A6A4A'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(x, y, 8, 0, Math.PI * 2)
          ctx.stroke()
          break
        }
        case 'repair_dock': {
          ctx.fillStyle = '#2E3A46'
          ctx.fillRect(x - 26, y - 20, 52, 40)
          ctx.strokeStyle = PALETTE.glow
          ctx.lineWidth = 3
          ctx.strokeRect(x - 26, y - 20, 52, 40)
          break
        }
        case 'camp_pillar': {
          ctx.fillStyle = '#5A4A38'
          ctx.fillRect(x - 5, y - 18, 10, 36)
          ctx.fillStyle = PALETTE.campLight
          ctx.beginPath()
          ctx.arc(x, y - 20, 5, 0, Math.PI * 2)
          ctx.fill()
          break
        }
        default: {
          ctx.fillStyle = '#46505A'
          ctx.fillRect(x - 9, y - 9, 18, 18)
        }
      }
    }
    this.drawCampfire(s, cam)
  }

  /* ── 생물 ───────────────────────────────────────────────────── */
  private drawBeasts(s: GameState, cam: Camera): void {
    const ctx = this.ctx
    const b = cam.visibleBounds(2)
    for (const beast of s.beasts) {
      if (beast.hp <= 0) continue
      if (beast.x < b.x0 || beast.x > b.x1 || beast.z < b.z0 || beast.z > b.z1) continue
      const def = ENEMIES[beast.type]
      const x = cam.toScreenX(beast.x)
      const y = cam.toScreenY(beast.z)

      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.28)'
      ctx.beginPath()
      ctx.ellipse(x, y + def.size * 0.55, def.size * 0.9, def.size * 0.35, 0, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = def.color
      ctx.beginPath()
      ctx.ellipse(x, y, def.size, def.size * 0.78, 0, 0, Math.PI * 2)
      ctx.fill()

      /* 눈 — 노려보는 방향으로 정체가 읽힌다 */
      const a = Math.atan2(s.player.z - beast.z, s.player.x - beast.x)
      ctx.fillStyle = PALETTE.ink
      ctx.beginPath()
      ctx.arc(x + Math.cos(a) * def.size * 0.45, y + Math.sin(a) * def.size * 0.45, def.size * 0.22, 0, Math.PI * 2)
      ctx.fill()

      if (beast.hp < def.hp) {
        const w = def.size * 2
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(x - w / 2, y - def.size - 9, w, 4)
        ctx.fillStyle = '#5FF2C8'
        ctx.fillRect(x - w / 2, y - def.size - 9, w * Math.max(0, beast.hp / def.hp), 4)
      }
      ctx.restore()
    }
  }

  private drawSpiders(s: GameState, cam: Camera): void {
    if (s.spiders.length === 0) return
    const ctx = this.ctx
    const def = ENEMIES.spider
    for (const sp of s.spiders) {
      const x = cam.toScreenX(sp.x)
      const y = cam.toScreenY(sp.z)
      ctx.save()
      /* 다리 여덟 — 실루엣만으로 "저건 거미다"가 즉시 나와야 한다 */
      ctx.strokeStyle = sp.stunT > 0 ? '#6A5A80' : PALETTE.spider
      ctx.lineWidth = 2.4
      const wob = sp.stunT > 0 ? 0 : Math.sin(s.elapsed * 14) * 0.22
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + wob * (i % 2 ? 1 : -1)
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + Math.cos(a) * def.size * 1.5, y + Math.sin(a) * def.size * 1.5)
        ctx.stroke()
      }
      ctx.fillStyle = sp.stunT > 0 ? '#7A6A90' : PALETTE.spider
      ctx.beginPath()
      ctx.arc(x, y, def.size * 0.62, 0, Math.PI * 2)
      ctx.fill()

      if (sp.stunT > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(x, y, def.size * 1.1, 0, Math.PI * 2 * Math.min(1, sp.stunT / 5))
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  private drawBullets(s: GameState, cam: Camera): void {
    if (s.bullets.length === 0) return
    const ctx = this.ctx
    ctx.save()
    ctx.strokeStyle = '#FFE9A8'
    ctx.lineWidth = 2
    for (const b of s.bullets) {
      const x = cam.toScreenX(b.x)
      const y = cam.toScreenY(b.z)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - b.vx * 0.012 * TILE, y - b.vz * 0.012 * TILE)
      ctx.stroke()
    }
    ctx.restore()
  }

  private drawPlayer(s: GameState, cam: Camera): void {
    const ctx = this.ctx
    const p = s.player
    const x = cam.toScreenX(p.x)
    const y = cam.toScreenY(p.z)

    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath()
    ctx.ellipse(x, y + 9, 12, 5, 0, 0, Math.PI * 2)
    ctx.fill()

    /* 우주복. 내구도가 닳으면 색이 빠진다 — 숫자를 안 봐도 안다. */
    const wear = p.suit / p.maxSuit
    ctx.fillStyle = `rgb(${Math.round(200 - 60 * (1 - wear))},${Math.round(214 - 70 * (1 - wear))},${Math.round(220 - 40 * (1 - wear))})`
    ctx.beginPath()
    ctx.arc(x, y, 11, 0, Math.PI * 2)
    ctx.fill()

    /* 헬멧 바이저 — 바라보는 방향 */
    ctx.fillStyle = '#1A2A38'
    ctx.beginPath()
    ctx.arc(x + Math.cos(p.facing) * 3.5, y + Math.sin(p.facing) * 3.5, 6.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(95, 242, 200, 0.5)'
    ctx.beginPath()
    ctx.arc(x + Math.cos(p.facing) * 4.6, y + Math.sin(p.facing) * 4.6, 2.6, 0, Math.PI * 2)
    ctx.fill()

    /* 든 것 */
    const hx = x + Math.cos(p.facing) * 15
    const hy = y + Math.sin(p.facing) * 15
    if (p.gun) {
      ctx.strokeStyle = '#C8CDD4'
      ctx.lineWidth = 3.4
      ctx.beginPath()
      ctx.moveTo(x + Math.cos(p.facing) * 7, y + Math.sin(p.facing) * 7)
      ctx.lineTo(hx, hy)
      ctx.stroke()
    } else if (p.equipped?.startsWith('axe')) {
      ctx.strokeStyle = '#8A7050'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x + Math.cos(p.facing) * 6, y + Math.sin(p.facing) * 6)
      ctx.lineTo(hx, hy)
      ctx.stroke()
      ctx.fillStyle = '#B8C0C8'
      ctx.beginPath()
      ctx.arc(hx, hy, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  /** 미니맵 — 밟은 곳만(§6.4) */
  drawMinimap(
    s: GameState,
    ctx: CanvasRenderingContext2D,
    size: number,
    expanded: boolean,
  ): void {
    const step = expanded ? 1 : 2
    const scale = size / TILES
    ctx.save()
    ctx.fillStyle = 'rgba(8, 12, 18, 0.88)'
    ctx.fillRect(0, 0, size, size)

    for (let tz = 0; tz < TILES; tz += step) {
      for (let tx = 0; tx < TILES; tx += step) {
        if (!isExplored(s, tx, tz)) continue
        const zone = ZONES.find((zz) => distanceFromCenter(tx, tz) < zz.outerRadius) ?? ZONES[3]
        ctx.fillStyle = zone.ground
        ctx.fillRect(tx * scale, tz * scale, scale * step + 0.6, scale * step + 0.6)
      }
    }

    /* 알고 있는 지형지물만 표시한다 — 안 가 본 연구소는 안 보인다 */
    for (const l of s.labs) {
      if (!isExplored(s, Math.floor(l.x), Math.floor(l.z))) continue
      ctx.fillStyle = l.cleared ? '#4A5560' : PALETTE.glow
      ctx.beginPath()
      ctx.arc(l.x * scale, l.z * scale, expanded ? 5 : 3, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.fillStyle = PALETTE.campLight
    ctx.beginPath()
    ctx.arc(CENTER * scale, CENTER * scale, expanded ? 6 : 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(s.player.x * scale, s.player.z * scale, expanded ? 5 : 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}
