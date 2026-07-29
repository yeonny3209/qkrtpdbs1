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

/* ==================================================================
   인터넷 전송 — WebSocket 릴레이 서버(server/main.ts) 경유.

   서버는 같은 방의 나머지 전원에게 메시지를 그대로 전달하므로
   의미상 BroadcastChannel과 같고, room.js는 아무것도 몰라도 된다.

   - 끊기면 지수 백오프로 자동 재접속한다 (1초 → 최대 16초)
   - 접속 전에 보낸 메시지는 잠깐 모아뒀다 열리면 내보낸다
     (입장 직후의 hello가 유실되지 않도록)
   - onStatus로 연결 상태(connecting/open)를 UI에 알린다
   ================================================================== */
export function WsTransport(roomId, url) {
  const listeners = new Set()
  const statusCbs = new Set()
  let ws = null
  let closed = false
  let retry = 0
  let queue = []
  let timer = null

  const setStatus = (s) => {
    for (const cb of statusCbs) { try { cb(s) } catch { /* 무시 */ } }
  }

  const connect = () => {
    if (closed) return
    setStatus('connecting')
    let sock
    try {
      const u = new URL(url)
      u.searchParams.set('room', roomId)
      sock = new WebSocket(u)
    } catch { setStatus('error'); return }
    ws = sock
    sock.onopen = () => {
      if (closed || ws !== sock) return
      retry = 0
      setStatus('open')
      const q = queue; queue = []
      for (const s of q) { try { sock.send(s) } catch { /* 무시 */ } }
    }
    sock.onmessage = (e) => {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }
      for (const cb of listeners) { try { cb(msg) } catch { /* 무시 */ } }
    }
    sock.onclose = () => {
      if (ws === sock) ws = null
      if (closed) return
      setStatus('connecting')
      retry = Math.min(retry + 1, 5)
      timer = setTimeout(connect, 500 * 2 ** retry)   // 1s, 2s, … 최대 16s
    }
    sock.onerror = () => { try { sock.close() } catch { /* 무시 */ } }
  }
  connect()

  return {
    kind: 'ws',
    send(msg) {
      let s
      try { s = JSON.stringify(msg) } catch { return }
      if (ws && ws.readyState === 1) { try { ws.send(s) } catch { /* 무시 */ } }
      else if (queue.length < 50) queue.push(s)       // 재접속 중엔 잠시 보관
    },
    onMessage(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    onStatus(cb) {
      statusCbs.add(cb)
      return () => statusCbs.delete(cb)
    },
    close() {
      closed = true
      if (timer) clearTimeout(timer)
      listeners.clear()
      statusCbs.clear()
      queue = []
      if (ws) { try { ws.close() } catch { /* 무시 */ } }
      ws = null
    },
  }
}

/* 테스트·오프라인용 — 아무 데도 보내지 않고 아무것도 받지 않는다 */
export function NullTransport() {
  return {
    kind: 'null',
    send() {},
    onMessage() { return () => {} },
    close() {},
  }
}
