/* ==================================================================
   연출 대기열

   Effects.jsx 는 이걸 읽어서 그리기만 한다. 만드는 쪽(PlayerRig)과
   그리는 쪽이 같은 파일에 있으면, 컴포넌트 파일이 함수도 같이
   내보내게 되어 개발 중 빠른 새로고침이 깨진다.

   미리 정한 개수만 돌려 쓰고 넘치면 오래된 것부터 버린다. 총알이
   쏟아질 때 연출이 한둘 빠지는 건 티가 안 나지만, 매 발마다 새
   객체를 만들면 쓰레기 수집이 프레임을 끊는다.
   ================================================================== */

export const TRACERS = 28
export const SPARKS = 22
export const TRACER_LIFE = 0.075
export const SPARK_LIFE = 0.28

export function createEffects() {
  return {
    tracers: [],
    sparks: [],
    /* 총구에서 착탄점까지 */
    addTracer(from, to) {
      this.tracers.push({ from: { ...from }, to: { ...to }, t: TRACER_LIFE })
      if (this.tracers.length > TRACERS) this.tracers.shift()
    },
    addSpark(at, kind) {
      this.sparks.push({ at: { ...at }, t: SPARK_LIFE, kind })
      if (this.sparks.length > SPARKS) this.sparks.shift()
    },
  }
}
