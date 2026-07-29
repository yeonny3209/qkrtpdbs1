/* ==================================================================
   공유 사냥터 릴레이 서버 — Deno Deploy용 (server/main.ts)

   ⚠️ 실측 결과 Deno Deploy Playground는 요청을 여러 인스턴스로 분산시켜서,
   다른 인스턴스에 붙은 두 클라이언트가 서로의 메시지를 못 받는 경우가
   확인됐다. 아래의 인스턴스 간 BroadcastChannel 중계로 완화를 시도했지만
   신뢰할 수 있게 동작하지 않았다. 실제 배포에는 대신 ../server/node/
   (Node.js + Render, 프로세스 하나가 계속 떠 있는 방식)를 쓴다.
   이 파일은 Deno로 직접 서버를 운영할 사람을 위한 참고용으로 남겨둔다
   — `deno run --allow-net main.ts`로 단일 프로세스로 띄우면 정상 동작한다.

   하는 일은 단 하나: 같은 방(room) 코드로 접속한 소켓들에게
   받은 메시지를 그대로 전달한다. 게임 규칙(호스트 선출·막타·하트비트)은
   전부 클라이언트의 room.js가 처리하므로 서버는 우체부일 뿐이다.
   ================================================================== */

/* 방 코드별 접속 소켓 집합 (이 인스턴스 안) */
const rooms = new Map<string, Set<WebSocket>>()

/* Deno Deploy는 접속이 여러 인스턴스로 분산될 수 있다.
   서버판 BroadcastChannel로 인스턴스끼리도 중계해 하나의 방이 되게 한다.
   (로컬 deno run에는 없을 수 있으므로 있을 때만 사용) */
const channels = new Map<string, BroadcastChannel>()
function channelFor(room: string): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null
  let ch = channels.get(room)
  if (!ch) {
    ch = new BroadcastChannel(`relay:${room}`)
    ch.onmessage = (e) => {
      for (const s of rooms.get(room) ?? []) {
        if (s.readyState === WebSocket.OPEN) s.send(e.data)
      }
    }
    channels.set(room, ch)
  }
  return ch
}

function dropSocket(room: string, socket: WebSocket) {
  const set = rooms.get(room)
  if (!set) return
  set.delete(socket)
  if (set.size === 0) {
    rooms.delete(room)
    channels.get(room)?.close()
    channels.delete(room)
  }
}

Deno.serve((req: Request) => {
  /* WebSocket 업그레이드가 아니면 상태 확인용 응답 */
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("yunny-game relay OK", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    })
  }

  const url = new URL(req.url)
  const room = (url.searchParams.get("room") || "")
    .toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)
  if (room.length < 3) return new Response("bad room", { status: 400 })

  const { socket, response } = Deno.upgradeWebSocket(req)

  socket.onopen = () => {
    let set = rooms.get(room)
    if (!set) rooms.set(room, set = new Set())
    set.add(socket)
    channelFor(room)          // 다른 인스턴스의 소식도 받도록 구독
  }

  socket.onmessage = (e) => {
    /* 문자열 JSON만, 과대 메시지는 버린다 (남용 방지) */
    if (typeof e.data !== "string" || e.data.length > 64_000) return
    for (const s of rooms.get(room) ?? []) {
      if (s !== socket && s.readyState === WebSocket.OPEN) s.send(e.data)
    }
    channelFor(room)?.postMessage(e.data)   // 다른 인스턴스로도 전달
  }

  socket.onclose = () => dropSocket(room, socket)
  socket.onerror = () => dropSocket(room, socket)

  return response
})
