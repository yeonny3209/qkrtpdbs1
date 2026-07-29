/* ==================================================================
   공유 사냥터 릴레이 서버 — Node.js 버전 (Render 등 "항상 켜진 단일
   프로세스" 호스팅용)

   server/main.ts(Deno Deploy)와 하는 일은 완전히 같다: 같은 방 코드로
   접속한 소켓들에게 받은 메시지를 그대로 전달한다.

   [Deno Deploy 대신 이 버전을 쓰는 이유]
   Deno Deploy(Playground)는 요청을 여러 인스턴스로 분산시키는데,
   서로 다른 인스턴스에 붙은 두 소켓은 서버의 BroadcastChannel로
   중계해도 실제로는 메시지를 주고받지 못하는 경우가 실측으로 확인됐다.
   Render의 무료 웹 서비스는 "프로세스 하나"가 계속 떠 있는 방식이라
   메모리 안의 Map 하나로 모든 연결을 다루면 되고, 이런 문제 자체가
   생기지 않는다.
   ================================================================== */
import http from 'node:http'
import { WebSocketServer } from 'ws'

const PORT = process.env.PORT || 8787
const rooms = new Map()                 // roomCode -> Set<WebSocket>

/* Render 등 호스팅의 헬스체크(일반 HTTP GET)에 200을 돌려준다.
   WebSocket 업그레이드는 이 서버에 올라타서 처리한다. */
const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
  res.end('yunny-game relay OK')
})
const wss = new WebSocketServer({ server: httpServer })

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x')
  const room = (url.searchParams.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  if (room.length < 3) { ws.close(); return }

  let set = rooms.get(room)
  if (!set) rooms.set(room, set = new Set())
  set.add(ws)

  ws.on('message', (data) => {
    const s = data.toString()
    if (s.length > 64_000) return          // 남용 방지
    for (const peer of set) {
      if (peer !== ws && peer.readyState === 1) peer.send(s)
    }
  })

  const cleanup = () => {
    set.delete(ws)
    if (set.size === 0) rooms.delete(room)
  }
  ws.on('close', cleanup)
  ws.on('error', cleanup)
})

httpServer.listen(PORT, () => {
  console.log(`relay listening on :${PORT}`)
})
