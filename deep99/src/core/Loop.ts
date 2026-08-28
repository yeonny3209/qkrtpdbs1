/* ==================================================================
   게임 루프 — §21.4 골격

   로직은 고정 60fps, 그리기는 가변이다.

     - 120Hz 모니터에서 화력이 두 배로 빨리 새지 않는다
     - 시드가 같으면 같은 결과가 나온다

   프레임 시간에 상한(0.25초)을 두는 것도 중요하다. 탭을 다른 데 두었다
   돌아오면 dt 가 몇 초씩 들어오는데, 그대로 밀어 넣으면 한 프레임에
   밤이 통째로 지나가고 캠프파이어가 꺼져 있다.
   ================================================================== */

export const FIXED_DT = 1 / 60
const MAX_FRAME = 0.25

export type LoopHandlers = {
  step: (dt: number) => void
  draw: (alpha: number) => void
}

export class Loop {
  private accumulator = 0
  private last = 0
  private raf = 0
  private running = false
  fps = 60

  constructor(private handlers: LoopHandlers) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    this.accumulator = 0
    this.raf = requestAnimationFrame(this.tick)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  private tick = (now: number): void => {
    if (!this.running) return
    const frameTime = Math.min((now - this.last) / 1000, MAX_FRAME)
    this.last = now
    this.accumulator += frameTime
    if (frameTime > 0) this.fps = this.fps * 0.9 + (1 / frameTime) * 0.1

    /* 한 프레임에 도는 스텝 수에도 상한을 둔다. 아주 느린 기기에서
       따라잡으려다 더 느려지는 죽음의 나선을 막는다. */
    let steps = 0
    while (this.accumulator >= FIXED_DT && steps < 8) {
      this.handlers.step(FIXED_DT)
      this.accumulator -= FIXED_DT
      steps++
    }
    if (steps >= 8) this.accumulator = 0

    this.handlers.draw(this.accumulator / FIXED_DT)
    this.raf = requestAnimationFrame(this.tick)
  }
}
