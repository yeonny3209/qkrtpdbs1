/* ==================================================================
   결정적 난수

   테스트가 "가끔 통과"하면 테스트가 아니다. 웨이브 구성·탄퍼짐·적
   외형 변화처럼 무작위가 필요한 곳은 전부 씨앗을 받는 난수를 쓴다.
   같은 씨앗이면 같은 결과가 나오므로, 실패한 판을 그대로 재현할 수 있다.
   ================================================================== */

/* FNV-1a — 문자열/아이디에서 32비트 정수를 뽑는다.
   용 게임에서 종족별 생김새를 고정할 때 쓴 것과 같은 방식이다. */
export function hash32(str) {
  let h = 0x811c9dc5
  const s = String(str)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/* mulberry32 — 상태 32비트짜리 작은 PRNG.
   Math.random 은 씨앗을 못 주고, 큰 라이브러리를 끌어올 이유는 없다. */
export function makeRng(seed) {
  let a = (typeof seed === 'string' ? hash32(seed) : seed >>> 0) || 1
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* [min, max) 실수 */
export function rangeOf(rng, min, max) {
  return min + rng() * (max - min)
}

/* [0, n) 정수 */
export function intOf(rng, n) {
  return Math.min(n - 1, Math.floor(rng() * n))
}

/* 배열에서 하나 고르기 */
export function pickOf(rng, arr) {
  return arr[intOf(rng, arr.length)]
}

/* 아이디로부터 -1..1 사이 값을 고정적으로 뽑는다.
   같은 적은 언제 다시 그려도 같은 체격·같은 색이어야 한다. */
export function variate(id, salt) {
  return (hash32(`${id}:${salt}`) / 4294967296) * 2 - 1
}
