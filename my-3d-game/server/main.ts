/* ==================================================================
   공유 사냥터 릴레이 서버 — Deno Deploy용 (server/main.ts)

   하는 일은 단 하나: 같은 방(room) 코드로 접속한 소켓들에게
   받은 메시지를 그대로 전달한다. 게임 규칙(호스트 선출·막타·하트비트)은
   전부 클라이언트의 room.js가 처리하므로 서버는 우체부일 뿐이다.

   [배포 방법 — Deno Deploy 플레이그라운드]
   1. https://dash.deno.com 에서 GitHub로 로그인
   2. "New Playground" 클릭
   3. 이 파일 내용을 통째로 붙여넣고 Save & Deploy
   4. 생기는 주소(예: https://xxx.deno.dev)를 게임의 WS_URL에 넣는다
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
