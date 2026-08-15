/* ==================================================================
   입력

   키 코드를 뜻으로 바꿔서 넘긴다. 게임 규칙 쪽에는 "앞으로"만
   전해지고 그게 W 였는지 ↑ 였는지는 알리지 않는다 — 키 배치를
   바꾸는 일이 규칙을 건드리는 일이 되면 안 된다.

   누르고 있는 것(fire)과 이번에 눌린 것(firePressed)을 나눈다.
   연사 무기는 앞을 보고, 단발 무기는 뒤를 본다. 안 나누면 단발
   무기가 꾹 누르는 것만으로 연사된다.
   ================================================================== */
import { useEffect, useRef } from 'react'

const KEY_MAP = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
}

export function createInput() {
  return {
    forward: false, back: false, left: false, right: false,
    jump: false, sprint: false,
    fire: false, firePressed: false,
    reload: false, switchTo: null, cycle: 0,
    yaw: 0, pitch: 0,
  }
}

/* 한 프레임을 소비한 뒤 "이번에 눌림" 류를 지운다. 안 지우면 한 번
   누른 것이 계속 눌린 것으로 읽힌다. */
export function consumeEdges(input) {
  input.firePressed = false
  input.reload = false
  input.switchTo = null
  input.cycle = 0
}

export function useInput(enabledRef) {
  const input = useRef(createInput())

  useEffect(() => {
    const on = () => enabledRef.current

    const keyDown = (e) => {
      if (!on()) return
      const m = KEY_MAP[e.code]
      if (m) { input.current[m] = true; e.preventDefault(); return }
      if (e.code === 'Space') { input.current.jump = true; e.preventDefault() }
      else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.current.sprint = true
      else if (e.code === 'KeyR') input.current.reload = true
      else if (e.code === 'Digit1') input.current.switchTo = 'pistol'
      else if (e.code === 'Digit2') input.current.switchTo = 'rifle'
      else if (e.code === 'Digit3') input.current.switchTo = 'shotgun'
      else if (e.code === 'KeyQ') input.current.cycle = -1
      else if (e.code === 'KeyE') input.current.cycle = 1
    }

    const keyUp = (e) => {
      const m = KEY_MAP[e.code]
      if (m) { input.current[m] = false; return }
      if (e.code === 'Space') input.current.jump = false
      else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.current.sprint = false
    }

    const mouseDown = (e) => {
      if (!on() || e.button !== 0) return
      input.current.fire = true
      input.current.firePressed = true
    }
    const mouseUp = (e) => { if (e.button === 0) input.current.fire = false }
    const wheel = (e) => {
      if (!on()) return
      input.current.cycle = e.deltaY > 0 ? 1 : -1
    }

    /* 창에서 포커스가 나가면 누르고 있던 키가 영원히 눌린 채로
       남는다. Alt+Tab 하고 돌아왔더니 혼자 걸어가는 일이 그것이다. */
    const blur = () => { Object.assign(input.current, createInput()) }

    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('mousedown', mouseDown)
    window.addEventListener('mouseup', mouseUp)
    window.addEventListener('wheel', wheel, { passive: true })
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('mousedown', mouseDown)
      window.removeEventListener('mouseup', mouseUp)
      window.removeEventListener('wheel', wheel)
      window.removeEventListener('blur', blur)
    }
  }, [enabledRef])

  return input
}
