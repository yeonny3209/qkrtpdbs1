/* ==================================================================
   턴 기반 전투 엔진 — 순수 로직 (Node에서 그대로 검증 가능)

   기획서 5장:
     · 1:1 또는 3:3
     · 턴 순서는 AGI 기반
     · 행동: 기본 공격 / 스킬 / 도주
     · MP 매 턴 15 충전, 궁극기 100
     · 명중률 70~100%, 크리티컬 기본 5%
     · 5턴 이상 아무 피해가 없으면 자동 무승부

   전투는 "라운드" 단위로 돈다. 라운드가 시작될 때 살아있는 유닛을
   AGI 순으로 줄 세우고, 그 순서대로 한 번씩 행동한다.
   ================================================================== */
import { statsOf } from './dragons.js'
import { skillsOf, MP_MAX, MP_PER_TURN, BASE_CRIT, CRIT_MUL } from './skills.js'

export const DRAW_ROUNDS = 5           // 이만큼 피해가 전혀 없으면 무승부
/* 피해 최소값이 1이라 "피해 0"만으로는 교착이 안 잡힌다.
   서로 긁기만 하는 무한 전투를 확실히 끊기 위한 상한. */
export const MAX_ROUNDS = 50

/* 결정적 난수 — 같은 시드면 같은 전투가 재현된다 */
export function makeRng(seed) {
  let a = (seed >>> 0) || 1
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/* ---------------- 유닛 ---------------- */
function makeUnit(entry, side, idx) {
  const raw = statsOf(entry.dragon, entry.level ?? 1, entry.evo ?? 0)
  /* 보스·난이도 배율. 능력치마다 따로 줄 수 있다.
     전부 같은 배수로 올리면 공격과 방어가 동시에 곱해져
     체감 난이도가 배율의 제곱처럼 뛴다 (보스가 이길 수 없게 된다). */
  const m = entry.statMul ?? 1
  const mulOf = (k) => (typeof m === 'number' ? m : (m[k] ?? 1))
  const st = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Math.max(1, Math.round(v * mulOf(k)))]))
  return {
    uid: `${side}${idx}`,
    side,
    dragon: entry.dragon,
    level: entry.level ?? 1,
    evo: entry.evo ?? 0,
    base: st,
    maxHp: st.hp,
    hp: st.hp,
    mp: entry.mp ?? 0,
    statuses: [],       // { key, turns, value }
    cds: {},            // skillId -> 남은 턴
    alive: true,
  }
}

/* 상태이상을 반영한 실제 능력치 */
export function effStat(unit, key) {
  let v = unit.base[key]
  for (const s of unit.statuses) {
    if (s.key === 'atkDown' && (key === 'atk' || key === 'matk')) v *= (1 - s.value)
    if (s.key === 'defDown' && (key === 'def' || key === 'mdef')) v *= (1 - s.value)
    if (s.key === 'haste' && key === 'agi') v *= (1 + s.value)
  }
  return Math.max(1, Math.round(v))
}
export const hasStatus = (unit, key) => unit.statuses.some((s) => s.key === key)
const statusValue = (unit, key) =>
  unit.statuses.filter((s) => s.key === key).reduce((a, s) => a + (s.value || 0), 0)

/* ---------------- 전투 생성 ---------------- */
export function createBattle({ allies, enemies, seed = 1, escapable = true }) {
  const units = [
    ...allies.map((e, i) => makeUnit(e, 'ally', i)),
    ...enemies.map((e, i) => makeUnit(e, 'enemy', i)),
  ]
  const state = {
    units, round: 0, order: [], turnIndex: 0,
    log: [], done: null, quietRounds: 0, escapable,
    rng: makeRng(seed),
  }
  startRound(state)
  return state
}

export const aliveOf = (state, side) => state.units.filter((u) => u.side === side && u.alive)
export const unitById = (state, uid) => state.units.find((u) => u.uid === uid)
export const currentUnit = (state) => (state.done ? null : unitById(state, state.order[state.turnIndex]))

function startRound(state) {
  state.round += 1
  /* AGI 높은 순. 같으면 아군이 먼저 (플레이어 유리하게) */
  state.order = state.units
    .filter((u) => u.alive)
    .sort((a, b) => effStat(b, 'agi') - effStat(a, 'agi') || (a.side === 'ally' ? -1 : 1))
    .map((u) => u.uid)
  state.turnIndex = 0
  skipDeadOrIncapacitated(state)
}

/* 죽었거나 행동 불가(빙결·감전)면 건너뛴다 */
function skipDeadOrIncapacitated(state) {
  let guard = 0
  while (state.turnIndex < state.order.length && guard++ < 50) {
    const u = unitById(state, state.order[state.turnIndex])
    if (!u || !u.alive) { state.turnIndex++; continue }
    if (hasStatus(u, 'freeze') || hasStatus(u, 'stun')) {
      const which = hasStatus(u, 'freeze') ? '빙결' : '감전'
      state.log.push({ t: 'skip', uid: u.uid, text: `${u.dragon.name}은(는) ${which} 상태라 움직이지 못했다` })
      endTurn(state)
      continue
    }
    break
  }
}

/* ---------------- 피해 계산 ---------------- */
function rollDamage(state, atk, def, skill, hitIndex = 0) {
  const stat = skill.stat === 'matk' ? 'matk' : 'atk'
  const defKey = skill.stat === 'matk' ? 'mdef' : 'def'
  const power = effStat(atk, stat) * skill.power
  const defense = effStat(def, defKey)
  /* 방어는 감쇠식 — 수치가 올라도 무한히 단단해지지 않는다.
     기준값(K)이 작으면 방어가 조금만 높아도 피해가 급감해 전투가 한없이
     길어진다. HP는 최대 5000인데 공격은 최대 500이라 원래도 비율이 큰데,
     여기서 더 깎으면 보스전이 40라운드를 넘어간다. K=200이 적당하다. */
  const K = 200
  let dmg = power * (K / (K + defense))
  const crit = state.rng() * 100 < BASE_CRIT
  if (crit) dmg *= CRIT_MUL
  dmg *= 0.92 + state.rng() * 0.16          // ±8% 변동
  void hitIndex
  return { dmg: Math.max(1, Math.round(dmg)), crit }
}

function applyDamage(state, target, amount) {
  /* 보호막이 먼저 흡수한다 */
  const sh = statusValue(target, 'shield')
  let dealt = amount
  if (sh > 0) {
    const absorb = Math.round(amount * Math.min(0.8, sh))
    dealt = Math.max(1, amount - absorb)
  }
  target.hp = clamp(target.hp - dealt, 0, target.maxHp)
  if (target.hp === 0) {
    target.alive = false
    state.log.push({ t: 'down', uid: target.uid, text: `${target.dragon.name} 쓰러짐!` })
  }
  return dealt
}

function applyHeal(state, target, amount) {
  const before = target.hp
  target.hp = clamp(target.hp + amount, 0, target.maxHp)
  return target.hp - before
}

function addStatus(state, target, spec) {
  if (!spec) return false
  if (state.rng() * 100 >= spec.chance) return false
  /* 같은 상태는 갱신 (중첩 대신 지속시간 리셋) */
  const found = target.statuses.find((s) => s.key === spec.key)
  if (found) { found.turns = Math.max(found.turns, spec.turns); found.value = spec.value ?? found.value }
  else target.statuses.push({ key: spec.key, turns: spec.turns, value: spec.value ?? 0 })
  return true
}

/* ---------------- 대상 고르기 ---------------- */
export function targetsFor(state, actor, skill) {
  const foes = aliveOf(state, actor.side === 'ally' ? 'enemy' : 'ally')
  const friends = aliveOf(state, actor.side)
  switch (skill.target) {
    case 'enemyAll': return foes
    case 'selfAll': return friends
    case 'self': return [actor]
    case 'ally': return friends
    default: return foes
  }
}
export const needsPick = (skill) => skill.target === 'enemy' || skill.target === 'ally'

/* ---------------- 행동 ---------------- */
export function canUse(unit, skill) {
  if (!unit || !skill) return false
  if (unit.mp < skill.mp) return false
  if ((unit.cds[skill.id] || 0) > 0) return false
  return true
}

export function castSkill(state, skillId, targetUid) {
  const actor = currentUnit(state)
  if (!actor || state.done) return state
  const skill = skillsOf(actor.dragon).find((s) => s.id === skillId)
  if (!skill || !canUse(actor, skill)) return state

  actor.mp -= skill.mp
  if (skill.cd > 0) actor.cds[skill.id] = skill.cd + 1   // 이번 턴 포함해서 감소하므로 +1

  let picked = targetsFor(state, actor, skill)
  if (needsPick(skill) && targetUid) {
    const t = unitById(state, targetUid)
    if (t && t.alive) picked = [t]
  }
  if (!picked.length) { endTurn(state); return state }

  state.log.push({ t: 'skill', uid: actor.uid, text: `${actor.dragon.name} — ${skill.name}` })

  const hits = skill.hits || 1
  let totalDealt = 0

  for (const target of picked) {
    /* 회복 스킬 */
    if (skill.heal) {
      const amount = Math.round(effStat(actor, 'matk') * skill.heal)
      const healed = applyHeal(state, target, amount)
      state.log.push({ t: 'heal', uid: target.uid, value: healed, text: `${target.dragon.name} +${healed}` })
    }
    /* 공격 스킬 */
    if (skill.power > 0) {
      for (let h = 0; h < hits; h++) {
        if (!target.alive) break
        /* 명중 판정 — 실명이면 명중률이 깎인다 */
        const acc = skill.acc * (1 - statusValue(actor, 'blind'))
        if (state.rng() * 100 >= acc) {
          state.log.push({ t: 'miss', uid: target.uid, text: `${target.dragon.name}에게 빗나갔다` })
          continue
        }
        const { dmg, crit } = rollDamage(state, actor, target, skill, h)
        const dealt = applyDamage(state, target, dmg)
        totalDealt += dealt
        state.log.push({ t: 'hit', uid: target.uid, value: dealt, crit, text: `${target.dragon.name} -${dealt}${crit ? ' 치명타!' : ''}` })
        if (skill.drain) {
          const back = applyHeal(state, actor, Math.round(dealt * skill.drain))
          if (back > 0) state.log.push({ t: 'heal', uid: actor.uid, value: back, text: `${actor.dragon.name} +${back} 흡혈` })
        }
      }
    }
    /* 상태이상 부여 */
    if (skill.status && target.alive) {
      if (addStatus(state, target, skill.status)) {
        state.log.push({ t: 'status', uid: target.uid, key: skill.status.key })
      }
    }
  }

  state.quietRounds = totalDealt > 0 ? 0 : state.quietRounds
  endTurn(state)
  return state
}

export function flee(state) {
  const actor = currentUnit(state)
  if (!actor || actor.side !== 'ally' || !state.escapable) return state
  /* 도주는 민첩 차이로 성공률이 갈린다 */
  const foes = aliveOf(state, 'enemy')
  const mine = effStat(actor, 'agi')
  const theirs = foes.reduce((a, u) => a + effStat(u, 'agi'), 0) / Math.max(1, foes.length)
  const chance = clamp(40 + (mine - theirs) * 0.6, 15, 90)
  if (state.rng() * 100 < chance) {
    state.done = 'flee'
    state.log.push({ t: 'flee', text: '도주 성공!' })
  } else {
    state.log.push({ t: 'flee', text: '도주 실패…' })
    endTurn(state)
  }
  return state
}

/* ---------------- 턴 종료 · 라운드 진행 ---------------- */
function tickStatuses(state, unit) {
  const keep = []
  for (const s of unit.statuses) {
    if (s.key === 'burn') {
      const dmg = Math.max(1, Math.round(unit.maxHp * s.value))
      unit.hp = clamp(unit.hp - dmg, 0, unit.maxHp)
      state.log.push({ t: 'hit', uid: unit.uid, value: dmg, text: `${unit.dragon.name} 화상 -${dmg}` })
      if (unit.hp === 0) { unit.alive = false; state.log.push({ t: 'down', uid: unit.uid, text: `${unit.dragon.name} 쓰러짐!` }) }
    }
    if (s.key === 'regen' && unit.alive) {
      const heal = Math.max(1, Math.round(unit.maxHp * s.value))
      applyHeal(state, unit, heal)
      state.log.push({ t: 'heal', uid: unit.uid, value: heal, text: `${unit.dragon.name} 재생 +${heal}` })
    }
    s.turns -= 1
    if (s.turns > 0) keep.push(s)
  }
  unit.statuses = keep
}

function endTurn(state) {
  const u = unitById(state, state.order[state.turnIndex])
  if (u && u.alive) {
    tickStatuses(state, u)
    for (const k of Object.keys(u.cds)) u.cds[k] = Math.max(0, u.cds[k] - 1)
  }
  state.turnIndex += 1

  if (checkEnd(state)) return
  if (state.turnIndex >= state.order.length) {
    /* 라운드 종료 — MP 충전 후 다음 라운드 */
    for (const unit of state.units) {
      if (unit.alive) unit.mp = Math.min(MP_MAX, unit.mp + MP_PER_TURN)
    }
    state.quietRounds += 1
    if (state.quietRounds >= DRAW_ROUNDS || state.round >= MAX_ROUNDS) {
      state.done = 'draw'
      state.log.push({ t: 'end', text: '승부가 나지 않았다 — 무승부' })
      return
    }
    startRound(state)
    return
  }
  skipDeadOrIncapacitated(state)
}

function checkEnd(state) {
  if (state.done) return true
  if (!aliveOf(state, 'enemy').length) {
    state.done = 'win'
    state.log.push({ t: 'end', text: '승리!' })
    return true
  }
  if (!aliveOf(state, 'ally').length) {
    state.done = 'lose'
    state.log.push({ t: 'end', text: '패배…' })
    return true
  }
  return false
}

/* ---------------- 적 AI ----------------
   1) 궁극기가 차 있으면 쓴다
   2) 회복형이고 아군이 위험하면 회복
   3) 쓸 수 있는 가장 강한 공격기
   4) 없으면 기본 공격 */
export function enemyAction(state) {
  const actor = currentUnit(state)
  if (!actor || actor.side !== 'enemy') return state
  const list = skillsOf(actor.dragon).filter((s) => canUse(actor, s))
  const foes = aliveOf(state, 'ally')
  const friends = aliveOf(state, 'enemy')

  const hurt = friends.some((f) => f.hp / f.maxHp < 0.55)
  /* 궁극기는 아끼지 않는다 — 단, 회복 궁극기는 다칠 때만.
     아무도 안 다쳤는데 회복 궁극기를 계속 쓰면 전투가 영원히 끝나지 않는다. */
  const ult = list.find((s) => s.mp >= MP_MAX && (s.power > 0 || hurt))
  if (ult) return castSkill(state, ult.id, pickTarget(state, actor, ult, foes, friends))

  const healer = list.find((s) => s.heal && s.power === 0 && hurt)
  if (healer) return castSkill(state, healer.id, pickTarget(state, actor, healer, foes, friends))

  const attacks = list.filter((s) => s.power > 0).sort((a, b) => b.power - a.power)
  const pick = attacks[0] || list[0]
  return castSkill(state, pick.id, pickTarget(state, actor, pick, foes, friends))
}

function pickTarget(state, actor, skill, foes, friends) {
  if (skill.target === 'ally') {
    const hurt = [...friends].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
    return hurt ? hurt.uid : actor.uid
  }
  if (skill.target === 'enemy') {
    /* 가장 약해진 적을 노린다 */
    const weak = [...foes].sort((a, b) => a.hp - b.hp)[0]
    return weak ? weak.uid : null
  }
  return null
}

/* 화면 표시용 요약 */
export const battleSummary = (state) => ({
  round: state.round,
  done: state.done,
  ally: aliveOf(state, 'ally').length,
  enemy: aliveOf(state, 'enemy').length,
})
