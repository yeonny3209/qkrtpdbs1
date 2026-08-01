/* ==================================================================
   여러 게임이 함께 쓰는 순수 도구 — 수학 · 저장 · 터치 입력 상태

   App.jsx가 10,000줄을 넘어가면서, 새 게임(방탈출)이 같은 damp()를
   다시 만들어 쓰는 일이 없도록 여기로 모았다.
   (컴포넌트는 ui.jsx 로 분리 — 파일 하나가 둘 다 내보내면 HMR이 깨진다)
   ================================================================== */
import { createContext, useContext } from 'react'
import * as THREE from 'three'

/* ---------------- 수학 ---------------- */
export const lerp = THREE.MathUtils.lerp
export const clamp = THREE.MathUtils.clamp
export const smooth = (t) => t * t * (3 - 2 * t)
export const damp = (lambda, dt) => 1 - Math.exp(-lambda * dt)
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz)
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

export function angleDiff(a, b) {
  let d = a - b
  d = ((((d + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI
  return d
}
export function dampAngle(cur, target, lambda, dt) {
  return cur + angleDiff(target, cur) * damp(lambda, dt)
}
export const inZone = (x, z, zone) => dist2(x, z, zone.x, zone.z) <= zone.r

/* ---------------- 저장 ---------------- */
export const loadJSON = (key, fallback) => {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback } catch { return fallback }
}
export const saveJSON = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* 무시 */ }
}

/* ---------------- 기기 · 터치 ---------------- */
export const LS_DEVICE = 'device_mode_v1'

/* 터치 입력 싱글턴.
   조이스틱·버튼이 값을 쓰고, 각 게임의 물리 코드가 키보드 입력과 합쳐 읽는다.
   라우트당 게임이 하나만 마운트되므로 전역 하나로 충분하다. */
export const TOUCH = {
  mx: 0, my: 0,          // 이동 조이스틱 (-1 ~ 1)
  run: false,
  clear() { this.mx = 0; this.my = 0; this.run = false },
}

export const DeviceCtx = createContext('pc')
export const useIsMobile = () => useContext(DeviceCtx) === 'mobile'

/* 기기 자동 추정 — 선택 화면의 '추천' 표시에만 쓴다 (강제하지 않음) */
export function guessMobile() {
  try {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
  } catch { return false }
}
