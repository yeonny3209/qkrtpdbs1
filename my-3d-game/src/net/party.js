/* ==================================================================
   파티 — 순수 상태 로직 (React·네트워크 비의존, Node에서 테스트 가능)

   [규칙 — 사용자 확정]
   · 처음 파티 초대를 보낸 사람이 파티장이 된다
   · 초대받은 사람이 수락하면 파티원이 된다
   · 던전은 1~6명, 레이드는 4~10명
   · 파티원 전원이 준비 완료를 보내면 파티장이 시작할 수 있다
     (파티장 본인은 시작 버튼이 곧 준비이므로 ready 체크에서 제외)

   [소유권]
   파티 명단의 진실은 파티장이 갖는다. 파티장이 변경 때마다 스냅샷을
   브로드캐스트하고(pSnap), 나머지는 받은 명단을 그대로 쓴다.
   파티장이 나가면 파티는 해산된다.
   ================================================================== */

export const PARTY_LIMIT = { dungeon: { min: 1, max: 6 }, raid: { min: 4, max: 10 } }

/* 첫 초대 시 파티장 스스로 만든다 */
export function partyCreate(leader) {
  return {
    id: 'pt_' + leader.id + '_' + Date.now().toString(36),
    leaderId: leader.id,
    members: [{ id: leader.id, nick: leader.nick, cls: leader.cls, level: leader.level, ready: false }],
  }
}

/* 수락한 사람을 넣는다 — 최대 인원(레이드 상한)과 중복을 막는다 */
export function partyAdd(party, member) {
  if (party.members.some((m) => m.id === member.id)) return { ok: false, reason: '이미 파티에 있습니다' }
  if (party.members.length >= PARTY_LIMIT.raid.max) return { ok: false, reason: '파티가 가득 찼습니다 (최대 10명)' }
  party.members.push({ id: member.id, nick: member.nick, cls: member.cls, level: member.level, ready: false })
  return { ok: true }
}

export function partyRemove(party, id) {
  const i = party.members.findIndex((m) => m.id === id)
  if (i >= 0) party.members.splice(i, 1)
}

export function partySetReady(party, id, ready) {
  const m = party.members.find((x) => x.id === id)
  if (m && m.id !== party.leaderId) m.ready = !!ready
}

/* 시작 가능 판정 — 파티장 제외 전원 ready + 콘텐츠별 인원 규칙 */
export function partyCanStart(party, contentKind) {
  const lim = PARTY_LIMIT[contentKind]
  if (!lim) return { ok: false, reason: '알 수 없는 콘텐츠' }
  const n = party.members.length
  if (n < lim.min) return { ok: false, reason: `최소 ${lim.min}명이 필요합니다 (현재 ${n}명)` }
  if (n > lim.max) return { ok: false, reason: `최대 ${lim.max}명까지입니다 (현재 ${n}명)` }
  const notReady = party.members.filter((m) => m.id !== party.leaderId && !m.ready)
  if (notReady.length > 0) {
    return { ok: false, reason: `준비 안 됨: ${notReady.map((m) => m.nick).join(', ')}` }
  }
  return { ok: true }
}

/* 전송용 — 그대로 직렬화 가능한 형태 유지 */
export function partySnapshot(party) {
  return { id: party.id, leaderId: party.leaderId, members: party.members.map((m) => ({ ...m })) }
}
