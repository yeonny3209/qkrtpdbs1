/* ==================================================================
   인터넷 멀티플레이 설정

   WS_URL에 릴레이 서버(server/main.ts를 Deno Deploy 등에 올린 것)의
   주소를 적으면, 같은 방 코드로 다른 기기의 가족·친구와 연결된다.
   비워두면 같은 브라우저의 탭끼리만 이어지는 로컬 모드로 동작한다.
   ================================================================== */
export const WS_URL = import.meta.env.VITE_WS_URL || 'https://qkrtpdbs1.onrender.com'

/* http(s) 주소를 붙여넣어도 ws(s)로 바로잡는다 */
function toWsUrl(raw) {
  const u = (raw || '').trim().replace(/\/+$/, '')
  if (!u) return ''
  if (u.startsWith('https://')) return 'wss://' + u.slice(8)
  if (u.startsWith('http://')) return 'ws://' + u.slice(7)
  if (!/^wss?:\/\//.test(u)) return 'wss://' + u
  return u
}

/* 빌드 없이 시험할 수 있게 localStorage('rpg_ws_url')로 덮어쓸 수 있다.
   'off'를 넣으면 서버가 설정돼 있어도 강제로 로컬 모드가 된다. */
export function getWsUrl() {
  let raw = WS_URL
  try {
    const over = localStorage.getItem('rpg_ws_url')
    if (over) raw = over === 'off' ? '' : over
  } catch { /* 무시 */ }
  return toWsUrl(raw)
}
