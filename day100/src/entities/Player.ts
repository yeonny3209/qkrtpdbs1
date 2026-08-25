/* ==================================================================
   플레이어 이동

   속도 4.0 / 달리기 6.0 (타일/초). 거미가 4.5 라 평시엔 달려서
   따돌릴 수 있고, 불이 꺼지면 6.5 라 못 따돌린다. 이 세 숫자의
   관계가 밤의 긴장을 통째로 만든다 — 함부로 건드리면 안 된다.

   조준(우클릭) 중에는 30% 느려진다. 총을 쏘려면 느려진다는 뜻이고,
   짐승에게 둘러싸였을 때 "쏠까 뛸까"가 판단이 된다.
   ================================================================== */
import { BALANCE } from '../data/index.ts'
import type { GameState } from '../core/GameState.ts'
import { pushOut, type Solid } from '../world/Tilemap.ts'

const P = BALANCE.player

export type MoveInput = {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  run: boolean
  /** 화면상 마우스가 가리키는 월드 좌표 */
  aimX: number
  aimZ: number
  aiming: boolean
}

export function speedOf(s: GameState): number {
  const p = s.player
  let v = p.running ? P.runSpeed : P.walkSpeed
  if (p.aiming) v *= P.aimSlowFactor
  return v
}

export function update(s: GameState, dt: number, input: MoveInput, solids: readonly Solid[]): void {
  if (s.phase === 'dead' || s.phase === 'escaped' || s.phase === 'asteroid') return
  const p = s.player

  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  let dz = (input.down ? 1 : 0) - (input.up ? 1 : 0)

  const moving = dx !== 0 || dz !== 0
  /* 스태미나가 바닥나면 달릴 수 없고, 조금 차야 다시 달릴 수 있다.
     안 그러면 0 근처에서 달렸다 걸었다 하며 덜덜 떤다. */
  p.running = input.run && moving && p.stamina > P.staminaMinToRun
  p.aiming = input.aiming

  if (moving) {
    const len = Math.hypot(dx, dz)
    dx /= len
    dz /= len
    const v = speedOf(s)
    const moved = pushOut(p.x + dx * v * dt, p.z + dz * v * dt, P.radius, solids)
    p.x = moved.x
    p.z = moved.z
  }

  /* 바라보는 방향은 언제나 마우스 쪽이다. 탑다운에서 이동 방향으로
     바꾸면 뒤로 물러나며 쏘는 것이 불가능해진다. */
  const ax = input.aimX - p.x
  const az = input.aimZ - p.z
  if (Math.hypot(ax, az) > 0.05) p.facing = Math.atan2(az, ax)
}
