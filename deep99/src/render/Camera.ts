/* ==================================================================
   카메라

   플레이어를 따라가되 곧바로 붙지 않는다. 살짝 늦게 따라오면 이동에
   무게가 생기고, 방향을 급히 바꿀 때 화면이 튀지 않는다.

   맵 가장자리에서는 카메라를 가둔다. 안 그러면 화면 절반이 허공이다.
   ================================================================== */
import { TILE, TILES } from '../world/Tilemap.ts'

export class Camera {
  x = 0
  z = 0
  private w = 0
  private h = 0

  resize(w: number, h: number): void {
    this.w = w
    this.h = h
  }

  snapTo(x: number, z: number): void {
    this.x = x
    this.z = z
  }

  follow(targetX: number, targetZ: number, dt: number): void {
    /* 지수 감쇠 — 프레임률이 달라져도 따라가는 느낌이 같다 */
    const k = 1 - Math.exp(-9 * dt)
    this.x += (targetX - this.x) * k
    this.z += (targetZ - this.z) * k
    this.clamp()
  }

  private clamp(): void {
    const halfW = this.w / 2 / TILE
    const halfH = this.h / 2 / TILE
    if (TILES > halfW * 2) this.x = Math.min(TILES - halfW, Math.max(halfW, this.x))
    if (TILES > halfH * 2) this.z = Math.min(TILES - halfH, Math.max(halfH, this.z))
  }

  toScreenX(x: number): number { return (x - this.x) * TILE + this.w / 2 }
  toScreenY(z: number): number { return (z - this.z) * TILE + this.h / 2 }
  toWorldX(px: number): number { return (px - this.w / 2) / TILE + this.x }
  toWorldZ(py: number): number { return (py - this.h / 2) / TILE + this.z }

  /** 화면 밖은 안 그린다. 나무만 수백 그루라 이게 없으면 못 쓴다. */
  visibleBounds(margin = 2): { x0: number; z0: number; x1: number; z1: number } {
    const halfW = this.w / 2 / TILE
    const halfH = this.h / 2 / TILE
    return {
      x0: this.x - halfW - margin,
      z0: this.z - halfH - margin,
      x1: this.x + halfW + margin,
      z1: this.z + halfH + margin,
    }
  }
}
