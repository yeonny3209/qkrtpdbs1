/* ==================================================================
   화면 비율에 맞는 카메라 거리 계산

   거리를 상수로 박아두면 가로 화면에서는 멀쩡한데 세로(모바일) 화면에서
   날개가 잘린다. 세로 fov는 그대로여도 가로 시야는 aspect에 비례해
   좁아지기 때문이다. 담아야 할 상자 크기를 주면 알아서 물러선다.
   ================================================================== */
/* 날개를 위로 45도쯤 든 상태의 실측 크기 (등급 최대 배율 1.16 반영) */
export const DRAGON_BOX = { w: 5.4, h: 3.4 }

export function fitDistance(camera, box = DRAGON_BOX, margin = 1.0) {
  const vFov = (camera.fov * Math.PI) / 180
  const half = Math.tan(vFov / 2)
  const forHeight = (box.h / 2) / half
  const forWidth = (box.w / 2) / (half * Math.max(0.0001, camera.aspect))
  return Math.max(forHeight, forWidth) * margin
}
