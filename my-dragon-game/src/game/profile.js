/* ==================================================================
   플레이어 이름 — 한 번 정하면 못 바꾼다

   못 바꾸는 값이므로 정하는 순간에 제대로 걸러야 한다. 나중에
   "이상한 이름이니 바꿔 달라"는 요청을 받아 줄 방법이 없다.

   [스토리와의 관계]
   이 게임에서 아무도 주인공의 이름을 부르지 않는다는 게 복선이다.
   플레이어가 정한 이름은 화면 UI 에만 쓰고, 대사에는 넣지 않는다.
   ================================================================== */

export const NAME_MIN = 2
export const NAME_MAX = 12

/* 앞뒤 공백을 털고 안쪽 연속 공백을 하나로 줄인다.
   "ㄱ    ㄴ" 과 "ㄱ ㄴ" 이 다른 이름이 되면 헷갈린다. */
export const normalizeName = (raw) => String(raw ?? '').trim().replace(/\s+/g, ' ')

/* 쓸 수 있는 글자 — 한글·영문·숫자·공백만.
   특수문자를 허용하면 화면이 깨지거나 남을 사칭하기 쉬워진다. */
const ALLOWED = /^[가-힣a-zA-Z0-9 ]+$/
/* 자모만 쓴 이름(ㅋㅋㅋ, ㅇㅇ)은 막는다 */
const JAMO_ONLY = /^[ㄱ-ㅎㅏ-ㅣ\s]+$/

const BANNED = ['운영자', '관리자', 'admin', 'gm', '개발자', 'system', '시스템']

export function validateName(raw) {
  const name = normalizeName(raw)
  if (!name) return { ok: false, why: '이름을 입력해 주세요' }
  if (JAMO_ONLY.test(name)) return { ok: false, why: '자음·모음만으로는 정할 수 없어요' }
  if (name.length < NAME_MIN) return { ok: false, why: `${NAME_MIN}글자 이상이어야 해요` }
  if (name.length > NAME_MAX) return { ok: false, why: `${NAME_MAX}글자까지만 돼요` }
  if (!ALLOWED.test(name)) return { ok: false, why: '한글·영문·숫자만 쓸 수 있어요' }
  const low = name.toLowerCase().replace(/\s/g, '')
  if (BANNED.some((b) => low.includes(b))) return { ok: false, why: '쓸 수 없는 이름이에요' }
  return { ok: true, why: null, name }
}

export const hasName = (profile) => !!profile?.name
export const freshProfile = () => ({ name: null, since: null })

/* 이름을 정한다. 이미 정해져 있으면 절대 덮어쓰지 않는다 —
   "바꿀 수 없다"는 약속을 저장 시점에서 지킨다. */
export function setName(profile, raw, now = Date.now()) {
  const cur = profile || freshProfile()
  if (cur.name) return { profile: cur, ok: false, why: '이름은 바꿀 수 없어요' }
  const v = validateName(raw)
  if (!v.ok) return { profile: cur, ok: false, why: v.why }
  return { profile: { ...cur, name: v.name, since: now }, ok: true, why: null }
}
