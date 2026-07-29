/* ==================================================================
   useRoom — 방을 React에 연결한다.

   useFrame(60Hz) 안에서 리렌더 없이 읽어야 하므로 room 객체는 ref로,
   화면에 그려야 하는 참가자 목록·호스트 여부는 state로 각각 제공한다.
   ================================================================== */
import { useCallback, useEffect, useRef, useState } from 'react'
import { LocalTransport } from './transport.js'
import { createRoom, HEARTBEAT_MS } from './room.js'

export function useRoom() {
  const roomRef = useRef(null)
  const [code, setCode] = useState(null)
  const [members, setMembers] = useState([])
  const [isHost, setIsHost] = useState(false)
  /* 호스트 여부는 매 프레임 읽히므로 ref로도 들고 있는다 */
  const hostRef = useRef(false)

  const leave = useCallback(() => {
    if (roomRef.current) { roomRef.current.close(); roomRef.current = null }
    hostRef.current = false
    setIsHost(false)
    setMembers([])
    setCode(null)
  }, [])

  const join = useCallback((roomCode, identity) => {
    if (roomRef.current) leave()
    const transport = LocalTransport(roomCode)
    const room = createRoom({ transport, me: identity })
    roomRef.current = room
    /* 혼자 있는 동안에도 호스트다 — 오프라인과 같은 동작이 보장된다 */
    hostRef.current = true
    setIsHost(true)
    setCode(roomCode)
    setMembers(room.members())
    room.tick()
    return room
  }, [leave])

  /* 하트비트 · 참가자 목록 갱신 */
  useEffect(() => {
    if (!code) return
    const iv = setInterval(() => {
      const room = roomRef.current
      if (!room) return
      room.tick()
      const h = room.isHost()
      if (h !== hostRef.current) { hostRef.current = h; setIsHost(h) }
      const list = room.members()
      setMembers((prev) => {
        /* 내용이 같으면 리렌더를 일으키지 않는다 */
        if (prev.length === list.length && prev.every((p, i) => p.id === list[i].id && p.nick === list[i].nick)) return prev
        return list
      })
    }, HEARTBEAT_MS / 2)
    return () => clearInterval(iv)
  }, [code])

  /* 탭이 닫힐 때 방에 알린다 */
  useEffect(() => {
    const onBye = () => { if (roomRef.current) roomRef.current.close() }
    window.addEventListener('pagehide', onBye)
    return () => {
      window.removeEventListener('pagehide', onBye)
      if (roomRef.current) { roomRef.current.close(); roomRef.current = null }
    }
  }, [])

  return { roomRef, hostRef, code, members, isHost, join, leave, connected: !!code }
}
