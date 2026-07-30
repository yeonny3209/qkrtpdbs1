/* ==================================================================
   쿠폰 코드 · 관리자 잠금

   [숨김에 대한 정직한 한계]
   이 게임은 브라우저에서 도는 클라이언트 프로그램이라, 코드를 어떤 식으로
   넣어도 파일 자체는 사용자에게 전달된다. 그래서 원문을 그대로 두지 않고
   단방향 해시(FNV-1a)만 저장한다.
     · 번들을 문자열 검색해도 '0826', 'wpem' 같은 원문이 나오지 않는다
     · 다만 해시를 무차별 대입하면 짧은 코드는 뚫릴 수 있다
   정말로 새어나가면 안 되는 값이라면 서버에서 검증해야 한다.
   ================================================================== */

/* FNV-1a 32bit — 짧고 의존성이 없다 */
export function hashCode(str) {
  let x = 0x811c9dc5
  const t = String(str || '').trim()
  for (let i = 0; i < t.length; i++) {
    x ^= t.charCodeAt(i)
    x = Math.imul(x, 0x01000193) >>> 0
  }
  return x.toString(36)
}

/* 보상 코드 — 계정당 한 번씩만 쓸 수 있다 */
export const REWARD_CODES = [
  { h: '1jfubwp', id: 'lv2', label: '레벨 +2', apply: (s) => { s.level += 2; s.exp = 0 } },
  { h: 'j1mjej', id: 'gold300', label: '골드 +300', apply: (s) => { s.gold += 300 } },
  { h: 'mc1ttv', id: 'sp1', label: '스킬 포인트 +1', apply: (s) => { s.sp += 1 } },
]

/* 관리자 — 아이디를 친 뒤 비밀번호까지 맞아야 열린다 */
const ADMIN_ID_H = 'y4x153'
const ADMIN_PW_H = 'svlb2g'
export const isAdminId = (v) => hashCode(v) === ADMIN_ID_H
export const isAdminPw = (v) => hashCode(v) === ADMIN_PW_H

/* 입력값이 무엇인지 판정한다 — 어떤 것도 아니면 null */
export function classifyCode(raw) {
  const v = String(raw || '').trim()
  if (!v) return null
  if (isAdminId(v)) return { kind: 'adminId' }
  const h = hashCode(v)
  const r = REWARD_CODES.find((c) => c.h === h)
  return r ? { kind: 'reward', code: r } : { kind: 'unknown' }
}
