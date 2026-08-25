/* ==================================================================
   시드 난수

   로그라이크에서 시드는 장식이 아니다. "이 시드로 46분에 깼다"가
   성립하려면 같은 시드가 언제나 같은 행성을 만들어야 하고, 그러려면
   Math.random 을 한 번이라도 쓰면 안 된다.

   그래서 난수를 쓰는 쪽마다 제 몫의 흐름을 따로 받는다. 맵 생성이
   난수를 세 번 더 뽑는다고 해서 적 스폰 위치가 밀리면, 밸런스를
   고칠 때마다 시드가 통째로 달라진다. 흐름을 나눠 두면 맵 생성기를
   고쳐도 전리품 표는 그대로다.
   ================================================================== */

/** 문자열을 32비트 정수로. 같은 글자면 언제나 같은 값. */
export function hash32(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

export type Rng = {
  /** [0, 1) */
  (): number
  /** [0, n) 정수 */
  int: (n: number) => number
  /** [lo, hi) 실수 */
  range: (lo: number, hi: number) => number
  /** p 확률로 참 */
  chance: (p: number) => boolean
  /** 배열에서 하나 */
  pick: <T>(arr: readonly T[]) => T
  /** 배열을 뒤섞은 새 배열 */
  shuffle: <T>(arr: readonly T[]) => T[]
}

/* xorshift128. 주기가 충분히 길고 곱셈 하나 없이 도는 데다,
   상태가 32비트 넷이라 그대로 저장하고 이어 쓸 수 있다. */
export function makeRng(seed: string | number): Rng {
  const base = typeof seed === 'number' ? seed >>> 0 : hash32(seed)
  let x = base || 0x9e3779b9
  let y = Math.imul(x, 0x85ebca6b) >>> 0 || 0x243f6a88
  let z = Math.imul(y, 0xc2b2ae35) >>> 0 || 0xb7e15162
  let w = Math.imul(z, 0x27d4eb2f) >>> 0 || 0x9e3779b9

  const next = (): number => {
    const t = x ^ (x << 11)
    x = y
    y = z
    z = w
    w = (w ^ (w >>> 19) ^ (t ^ (t >>> 8))) >>> 0
    return w / 4294967296
  }

  /* 초기 상태의 치우침을 털어낸다. 안 하면 시드가 1 씩 다른 두 판의
     첫 몇 개 값이 비슷하게 나와서, 이웃한 시드끼리 맵이 닮아 보인다. */
  for (let i = 0; i < 16; i++) next()

  const rng = next as Rng
  rng.int = (n) => Math.min(n - 1, Math.floor(next() * n))
  rng.range = (lo, hi) => lo + next() * (hi - lo)
  rng.chance = (p) => next() < p
  rng.pick = (arr) => arr[rng.int(arr.length)]
  rng.shuffle = (arr) => {
    const out = arr.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = rng.int(i + 1)
      const tmp = out[i]
      out[i] = out[j]
      out[j] = tmp
    }
    return out
  }
  return rng
}

/* 한 판의 시드에서 갈래별 흐름을 뽑는다. 갈래 이름이 다르면 서로
   독립이고, 같은 이름이면 언제나 같은 수열이다. */
export function streamOf(seed: string, stream: string): Rng {
  return makeRng(`${seed}::${stream}`)
}

/* 로비에 보여 줄 읽기 좋은 시드. 헷갈리는 글자(0/O, 1/I)는 뺀다 —
   사람이 받아 적어 친구에게 보내는 물건이다. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function randomSeed(): string {
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return out
}

export function normalizeSeed(input: string): string {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return cleaned.length > 0 ? cleaned.slice(0, 16) : randomSeed()
}
