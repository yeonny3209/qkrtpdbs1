/* ==================================================================
   방 — 참가자 관리 · 호스트 선출 · 메시지 라우팅

   React나 DOM에 의존하지 않는 순수 로직이다. 시계(now)를 주입받으므로
   Node에서 그대로 단위 테스트할 수 있다.

   [호스트 선출]
   서버가 없으므로 투표 프로토콜 대신 "모두가 같은 규칙으로 각자 계산"한다.
   호스트 = 입장 시각(joinedAt)이 가장 이른 사람, 같으면 id 사전순.
   모두가 같은 참가자 목록을 보므로 같은 답에 수렴하고, 호스트가 사라지면
   하트비트 타임아웃으로 목록에서 빠지면서 자동으로 다음 사람이 승계한다.
   ================================================================== */

export const HEARTBEAT_MS = 1000     // 살아있음을 알리는 주기
export const TIMEOUT_MS = 6000       // 이 시간 동안 소식 없으면 나간 것으로 본다
                                     // (인터넷 연결의 순간적인 끊김을 견디도록 여유 있게)

/* 참가자 목록에서 호스트를 고른다. 모든 클라이언트가 같은 결과를 내야 한다. */
export function electHost(members) {
  let best = null
  for (const m of members) {
    if (!best) { best = m; continue }
    if (m.joinedAt < best.joinedAt) { best = m; continue }
    /* 입장 시각이 같으면 id 사전순으로 확정 — 동점에서도 전원이 같은 답을 낸다 */
    if (m.joinedAt === best.joinedAt && m.id < best.id) best = m
  }
  return best ? best.id : null
}

export function createRoom({ transport, me, now = () => Date.now() }) {
  /* me = { id, nick, cls, level, mapId } */
  const joinedAt = now()
  const self = { ...me, joinedAt, lastSeen: joinedAt }

  const members = new Map([[self.id, self]])
  const peerStates = new Map()          // id -> 최근 위치/상태
  const handlers = new Map()            // type -> Set<cb>
  let lastBeat = 0
  let closed = false

  const emit = (type, msg) => {
    const set = handlers.get(type)
    if (!set) return
    for (const cb of set) {
      try { cb(msg) } catch { /* 핸들러 하나가 죽어도 나머지는 계속 */ }
    }
  }

  const send = (msg) => {
    if (closed) return
    transport.send({ ...msg, id: self.id })
  }

  const receive = (msg) => {
    if (closed || !msg || typeof msg !== 'object') return
    const from = msg.id
    if (!from || from === self.id) return          // 자기 메시지는 무시

    const t = now()

    /* 어떤 메시지든 살아있다는 증거로 취급한다 */
    const known = members.get(from)
    if (known) known.lastSeen = t

    if (msg.t === 'hello') {
      if (known) {
        Object.assign(known, {
          nick: msg.nick, cls: msg.cls, level: msg.level,
          mapId: msg.mapId, joinedAt: msg.joinedAt, lastSeen: t,
        })
      } else {
        members.set(from, {
          id: from, nick: msg.nick, cls: msg.cls, level: msg.level,
          mapId: msg.mapId, joinedAt: msg.joinedAt, lastSeen: t,
        })
        /* 처음 보는 사람에게는 내 존재를 즉시 알린다 (다음 하트비트를 기다리지 않게) */
        send({ t: 'hello', nick: self.nick, cls: self.cls, level: self.level, mapId: self.mapId, joinedAt })
        emit('join', { id: from, nick: msg.nick })
      }
    } else if (msg.t === 'bye') {
      members.delete(from)
      peerStates.delete(from)
      emit('leave', { id: from })
    } else if (msg.t === 'state') {
      peerStates.set(from, {
        id: from, x: msg.x, z: msg.z, yaw: msg.yaw, mapId: msg.mapId,
        hp: msg.hp, maxHp: msg.maxHp, moving: msg.moving, swing: msg.swing,
        nick: known ? known.nick : msg.nick, cls: known ? known.cls : msg.cls,
        wtype: msg.wtype, at: t,
      })
      if (known && msg.mapId != null) known.mapId = msg.mapId
    }

    emit(msg.t, msg)
  }

  const off = transport.onMessage(receive)

  return {
    self,
    id: self.id,

    send,

    on(type, cb) {
      if (!handlers.has(type)) handlers.set(type, new Set())
      handlers.get(type).add(cb)
      return () => handlers.get(type)?.delete(cb)
    },

    /* 주기적으로 호출한다. 하트비트를 보내고, 소식 없는 참가자를 정리한다. */
    tick() {
      if (closed) return
      const t = now()
      self.lastSeen = t

      if (t - lastBeat >= HEARTBEAT_MS) {
        lastBeat = t
        send({ t: 'hello', nick: self.nick, cls: self.cls, level: self.level, mapId: self.mapId, joinedAt })
      }

      for (const [id, m] of members) {
        if (id === self.id) continue
        if (t - m.lastSeen > TIMEOUT_MS) {
          members.delete(id)
          peerStates.delete(id)
          emit('leave', { id })
        }
      }
    },

    /* 내 정보가 바뀌면(직업 변경·레벨업·맵 이동) 반영한다 */
    update(patch) {
      Object.assign(self, patch)
    },

    members() { return [...members.values()] },
    peerStates() { return peerStates },
    hostId() { return electHost([...members.values()]) },
    isHost() { return electHost([...members.values()]) === self.id },

    close() {
      if (closed) return
      closed = true
      try { transport.send({ t: 'bye', id: self.id }) } catch { /* 무시 */ }
      off()
      transport.close()
      members.clear()
      peerStates.clear()
      handlers.clear()
    },
  }
}
