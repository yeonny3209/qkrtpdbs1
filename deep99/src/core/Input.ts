/* ==================================================================
   입력 — §19.1 그대로

   눌린 상태(held)와 이번 프레임에 눌린 것(pressed)을 나눈다. 이동은
   held 로, "E 로 상호작용" 같은 것은 pressed 로 봐야 한 번 누르고
   있는 동안 열 번 열리지 않는다.

   코드는 물리 키(KeyW)로 본다. 한글 자판에서도 손 모양이 같은 자리에
   오게 하려는 것이다.
   ================================================================== */

export type Keys = {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  run: boolean
}

const BLOCK = new Set([
  'Space', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8',
])

export class Input {
  private held = new Set<string>()
  private pressedThisFrame = new Set<string>()
  private consumed = new Set<string>()

  mouseX = 0
  mouseY = 0
  mouseDown = false
  mouseRight = false
  mouseClicked = false

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return
    if (!e.ctrlKey && !e.metaKey && BLOCK.has(e.code)) e.preventDefault()
    this.held.add(e.code)
    this.pressedThisFrame.add(e.code)
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code)
  }

  private onBlur = () => {
    /* 탭을 벗어나면 키가 눌린 채로 남는다. 돌아왔을 때 혼자 달리고
       있으면 배고픔이 3배로 빠져 있다. */
    this.held.clear()
    this.mouseDown = false
    this.mouseRight = false
  }

  attach(target: HTMLElement): void {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    target.addEventListener('mousemove', (e) => {
      const r = target.getBoundingClientRect()
      this.mouseX = e.clientX - r.left
      this.mouseY = e.clientY - r.top
    })
    target.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true
        this.mouseClicked = true
      }
      if (e.button === 2) this.mouseRight = true
    })
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false
      if (e.button === 2) this.mouseRight = false
    })
    target.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  isDown(code: string): boolean {
    return this.held.has(code)
  }

  /** 이번 프레임에 새로 눌렸는가. 한 번 읽으면 소비된다. */
  pressed(code: string): boolean {
    if (!this.pressedThisFrame.has(code) || this.consumed.has(code)) return false
    this.consumed.add(code)
    return true
  }

  keys(): Keys {
    return {
      up: this.isDown('KeyW') || this.isDown('ArrowUp'),
      down: this.isDown('KeyS') || this.isDown('ArrowDown'),
      left: this.isDown('KeyA') || this.isDown('ArrowLeft'),
      right: this.isDown('KeyD') || this.isDown('ArrowRight'),
      run: this.isDown('ShiftLeft') || this.isDown('ShiftRight'),
    }
  }

  hotbarPressed(): number {
    for (let i = 1; i <= 8; i++) {
      if (this.pressed(`Digit${i}`)) return i - 1
    }
    return -1
  }

  endFrame(): void {
    this.pressedThisFrame.clear()
    this.consumed.clear()
    this.mouseClicked = false
  }
}
