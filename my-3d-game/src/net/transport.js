/* ==================================================================
   전송 계층 — 방 전체에 메시지를 뿌리고 받는다.

   게임 코드는 이 인터페이스에만 의존한다. 지금은 BroadcastChannel로
   같은 브라우저의 탭끼리 통신하지만, 나중에 WsTransport(WebSocket)를
   끼우면 게임 코드를 건드리지 않고 인터넷 멀티가 된다.

     send(msg)      — 방의 나머지 전원에게 전송 (자기 자신에게는 오지 않는다)
     onMessage(cb)  — 수신 콜백 등록. 해제 함수를 반환한다.
     close()        — 연결 종료
   ================================================================== */

/* 같은 브라우저의 탭 간 통신. 서버가 필요 없다.
   BroadcastChannel은 "같은 채널을 연 모든 탭에 브로드캐스트"라는 점에서
   서버의 룸 브로드캐스트와 의미가 같으므로, 여기에 맞춰 짠 게임 코드는
   WebSocket으로 그대로 옮겨진다. */
export function LocalTransport(roomId) {
  const name = `rpg_room_${roomId}`
  let ch = null
  const listeners = new Set()

  try {
    ch = new BroadcastChannel(name)
    ch.onmessage = (e) => {
      for (const cb of listeners) {
        try { cb(e.data) } catch { /* 리스너 하나가 죽어도 나머지는 계속 */ }
      }
    }
  } catch {
    /* BroadcastChannel 미지원 브라우저 — 혼자 하는 방으로 동작한다 */
    ch = null
  }

  return {
    kind: 'local',
    send(msg) {
      if (!ch) return
      try { ch.postMessage(msg) } catch { /* 직렬화 불가 메시지 무시 */ }
    },
    onMessage(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    close() {
      listeners.clear()
      if (ch) { try { ch.close() } catch { /* 무시 */ } }
      ch = null
    },
  }
}

/* 서버를 붙일 때 구현할 자리.
   위와 같은 { send, onMessage, close } 모양만 지키면 room.js는 그대로 쓴다.

   export function WsTransport(roomId, url) { ... }
*/

/* 테스트·오프라인용 — 아무 데도 보내지 않고 아무것도 받지 않는다 */
export function NullTransport() {
  return {
    kind: 'null',
    send() {},
    onMessage() { return () => {} },
    close() {},
  }
}
