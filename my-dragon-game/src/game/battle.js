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
import {
  skillsOf, skillsetOf, BASIC_ATTACK, BASE_CRIT, CRIT_MUL,
  turnOpen, passiveEffect, isUlt,
} from './skills.js'
import { finalStats, activeSet } from './equipment.js'
import { runeEffect, runeStatMul } from './runes.js'
/* 난수는 rng.js 로 옮겼지만, 여기서 가져다 쓰던 곳이 많아 그대로 다시 내보낸다 */
import { makeRng } from './rng.js'
export { makeRng }

export const DRAW_ROUNDS = 5           // 이만큼 피해가 전혀 없으면 무승부
/* 피해 최소값이 1이라 "피해 0"만으로는 교착이 안 잡힌다.
   서로 긁기만 하는 무한 전투를 확실히 끊기 위한 상한. */
export const MAX_ROUNDS = 50

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/* ---------------- 유닛 ---------------- */
function makeUnit(entry, side, idx) {
  const items = entry.items || {}
  const rune = entry.rune || null
  /* 레벨·진화 → 장비 → 세트 → 룬 순서로 쌓인 최종 능력치 */
  const raw = finalStats(entry.dragon, entry.level ?? 1, entry.evo ?? 0, items, runeStatMul(rune))
  /* 보스·난이도 배율. 능력치마다 따로 줄 수 있다.
     전부 같은 배수로 올리면 공격과 방어가 동시에 곱해져
     체감 난이도가 배율의 제곱처럼 뛴다 (보스가 이길 수 없게 된다). */
  const m = entry.statMul ?? 1
  const mulOf = (k) => (typeof m === 'number' ? m : (m[k] ?? 1))
  const st = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Math.max(1, Math.round(v * mulOf(k)))]))
  /* 가속 룬은 "전투 시작 시" 붙는 거라 기본값에 미리 반영한다 */
  const haste = runeEffect(rune, 'haste')
  if (haste) st.agi = Math.max(1, Math.round(st.agi * (1 + haste)))
  const set = activeSet(items)
  const passive = skillsetOf(entry.dragon).passive
  /* 바람의 발 — 민첩 패시브도 시작값에 미리 반영한다 */
  const swift = passive?.effect === 'swift' ? passive.value : 0
  if (swift) st.agi = Math.max(1, Math.round(st.agi * (1 + swift)))
  const unit = {
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
    rune,
    set,
    passive,
    vigilUsed: false,   // 불침의 의지를 이미 썼는가
    critAdd: (set?.critAdd ?? 0) + (passive?.effect === 'precision' ? passive.value : 0),
    firstStrike: (set?.firstStrike ?? 0) + (passive?.effect === 'hunter' ? passive.value : 0),
  }
  /* 선천의 방벽 — 전투 시작 시 보호막 */
  if (passive?.effect === 'barrier') {
    unit.statuses.push({ key: 'shield', turns: 99, value: passive.value })
  }
  return unit
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
export function createBattle({ allies, enemies, seed = 1, escapable = true, maxRounds = MAX_ROUNDS }) {
  const units = [
    ...allies.map((e, i) => makeUnit(e, 'ally', i)),
    ...enemies.map((e, i) => makeUnit(e, 'enemy', i)),
  ]
  const state = {
    units, round: 0, order: [], turnIndex: 0,
    log: [], done: null, quietRounds: 0, escapable,
    maxRounds,
    rng: makeRng(seed),
  }
  startRound(state)
  advanceToActor(state)
  return state
}

export const aliveOf = (state, side) => state.units.filter((u) => u.side === side && u.alive)
export const unitById = (state, uid) => state.units.find((u) => u.uid === uid)
export const currentUnit = (state) => (state.done ? null : unitById(state, state.order[state.turnIndex]))

function startRound(state) {
  state.round += 1
  /* 속도형 세트의 "선공 확률" — 매 라운드 굴려서 성공하면
     민첩과 무관하게 그 라운드 맨 앞으로 나온다. */
  const first = new Set()
  for (const u of state.units) {
    if (u.alive && u.firstStrike > 0 && state.rng() * 100 < u.firstStrike) first.add(u.uid)
  }
  /* AGI 높은 순. 같으면 아군이 먼저 (플레이어 유리하게) */
  state.order = state.units
    .filter((u) => u.alive)
    .sort((a, b) =>
      (first.has(b.uid) ? 1 : 0) - (first.has(a.uid) ? 1 : 0)
      || effStat(b, 'agi') - effStat(a, 'agi')
      || (a.side === 'ally' ? -1 : 1))
    .map((u) => u.uid)
  state.turnIndex = 0
}

/* 라운드 사이 처리 — MP 충전과 무승부 판정 */
function nextRound(state) {
  state.quietRounds += 1
  if (state.quietRounds >= DRAW_ROUNDS || state.round >= (state.maxRounds || MAX_ROUNDS)) {
    state.done = 'draw'
    state.log.push({ t: 'end', text: '승부가 나지 않았다 — 무승부' })
    return
  }
  startRound(state)
}

/* 행동할 수 있는 유닛이 나올 때까지 순서를 앞으로 민다.
   죽었거나 얼어붙은 유닛은 건너뛰고, 줄 끝에 닿으면 다음 라운드로 넘어간다.

   예전에는 "줄 끝에 닿는" 경우를 여기서 처리하지 않아서, 순서 맨 뒤의
   유닛이 죽어 있으면 turnIndex 가 끝을 넘어선 채 아무도 다음 라운드를
   시작하지 않아 전투가 그대로 멈췄다. */
function advanceToActor(state) {
  let guard = 0
  while (!state.done && guard++ < 400) {
    if (state.turnIndex >= state.order.length) { nextRound(state); continue }
    const u = unitById(state, state.order[state.turnIndex])
    if (!u || !u.alive) { state.turnIndex++; continue }
    if (hasStatus(u, 'freeze') || hasStatus(u, 'stun')) {
      const which = hasStatus(u, 'freeze') ? '빙결' : '감전'
      state.log.push({ t: 'skip', uid: u.uid, text: `${u.dragon.name}은(는) ${which} 상태라 움직이지 못했다` })
      finishTurn(state)
      if (checkEnd(state)) return
      continue
    }
    return
  }
}

/* ---------------- 피해 계산 ---------------- */
function rollDamage(state, atk, def, skill, hitIndex = 0) {
  const stat = skill.stat === 'matk' ? 'matk' : 'atk'
  const defKey = skill.stat === 'matk' ? 'mdef' : 'def'
  let power = effStat(atk, stat) * skill.power
  /* 불굴 — 몰릴수록 세진다 */
  const resolve = passiveEffect(atk, 'resolve')
  if (resolve && atk.hp / atk.maxHp <= 0.4) power *= (1 + resolve)
  /* 처형자 — 빈사인 적에게 추가 피해 */
  const execute = passiveEffect(atk, 'execute')
  if (execute && def.hp / def.maxHp <= 0.3) power *= (1 + execute)
  /* 저주 룬 — 상대 방어력을 깎고 계산한다 */
  const curse = runeEffect(atk.rune, 'curse')
  const defense = effStat(def, defKey) * (1 - curse)
  /* 방어는 감쇠식 — 수치가 올라도 무한히 단단해지지 않는다.
     기준값(K)이 작으면 방어가 조금만 높아도 피해가 급감해 전투가 한없이
     길어진다. HP는 최대 5000인데 공격은 최대 500이라 원래도 비율이 큰데,
     여기서 더 깎으면 보스전이 40라운드를 넘어간다. K=200이 적당하다. */
  const K = 200
  let dmg = power * (K / (K + defense))
  /* 크리티컬 확률은 기본 5% + 공격형 세트 보정 */
  const crit = state.rng() * 100 < BASE_CRIT + (atk.critAdd || 0)
  /* 공격 강화 룬은 크리티컬 배수를 키운다 */
  if (crit) dmg *= CRIT_MUL + runeEffect(atk.rune, 'critDmg')
  dmg *= 0.92 + state.rng() * 0.16          // ±8% 변동
  void hitIndex
  return { dmg: Math.max(1, Math.round(dmg)), crit }
}

function applyDamage(state, target, amount) {
  /* 보호 룬 · 단단한 껍질 패시브 — 받는 피해를 먼저 줄인다 */
  const cut = runeEffect(target.rune, 'guard') + passiveEffect(target, 'bulwark')
  let dealt = cut > 0 ? Math.max(1, Math.round(amount * Math.max(0.1, 1 - cut))) : amount
  /* 그 다음 보호막이 흡수한다 */
  const sh = statusValue(target, 'shield')
  if (sh > 0) {
    const absorb = Math.round(dealt * Math.min(0.8, sh))
    dealt = Math.max(1, dealt - absorb)
  }
  target.hp = clamp(target.hp - dealt, 0, target.maxHp)
  if (target.hp === 0) {
    /* 불침의 의지 — 전투당 한 번, 체력 1로 버틴다 */
    if (passiveEffect(target, 'vigil') && !target.vigilUsed) {
      target.vigilUsed = true
      target.hp = 1
      state.log.push({ t: 'passive', uid: target.uid, text: `${target.dragon.name} 불침의 의지! 체력 1로 버텼다` })
      return dealt
    }
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
/* 이번 라운드에 쓸 수 있는가.
   1스킬은 홀수 라운드, 2스킬은 짝수 라운드에만 열린다.
   궁극기는 쓴 뒤 쿨타임이 돌아야 한다. */
export function canUse(unit, skill, round) {
  if (!unit || !skill) return false
  if ((unit.cds[skill.id] || 0) > 0) return false
  if (round != null && !turnOpen(skill, round)) return false
  return true
}
/* 화면에서 "왜 못 쓰는지" 알려주려고 따로 뺐다 */
export function lockReason(unit, skill, round) {
  if (!unit || !skill) return null
  if ((unit.cds[skill.id] || 0) > 0) return `${unit.cds[skill.id]}라운드 뒤`
  if (round != null && !turnOpen(skill, round)) {
    return skill.turn === 'odd' ? '홀수 라운드' : '짝수 라운드'
  }
  return null
}

export function castSkill(state, skillId, targetUid) {
  const actor = currentUnit(state)
  if (!actor || state.done) return state
  const skill = skillsOf(actor.dragon).find((s) => s.id === skillId)
  if (!skill || !canUse(actor, skill, state.round)) return state

  if (skill.cd > 0) actor.cds[skill.id] = skill.cd + 1   // 이번 턴 포함해서 감소하므로 +1

  let picked = targetsFor(state, actor, skill)
  if (needsPick(skill) && targetUid) {
    const t = unitById(state, targetUid)
    if (t && t.alive) picked = [t]
  }
  if (!picked.length) { endTurn(state); return state }

  /* 피해는 반드시 상대편에게만, 회복은 반드시 우리 편에게만 간다.
     예전에는 targetsFor 가 준 목록에 피해와 회복을 그대로 다 적용해서,
     아군 전체 대상 지원기에 위력이 붙어 있으면 우리 편을 때리고,
     적 전체 대상 스킬에 회복이 붙어 있으면 적을 치유했다.
     "수호의 서약"으로 아군을 깎고 "여명의 심판"으로 적을 살리던 버그다. */
  const hostile = picked.filter((u) => u.side !== actor.side)
  const friendly = picked.filter((u) => u.side === actor.side)
  const dmgTargets = hostile.length ? hostile : aliveOf(state, actor.side === 'ally' ? 'enemy' : 'ally')
  const healTargets = friendly.length ? friendly : [actor]

  /* 화면이 모션을 고르려면 어떤 스킬인지 알아야 한다 (fx.js 가 읽는다) */
  state.log.push({
    t: 'skill', uid: actor.uid, skill: skill.id, kind: skill.kind,
    element: actor.dragon.element, icon: skill.icon,
    text: `${actor.dragon.name} — ${skill.name}`,
  })

  const hits = skill.hits || 1
  let totalDealt = 0

  /* 회복은 우리 편에게만 */
  if (skill.heal) {
    for (const target of healTargets) {
      if (!target.alive) continue
      const amount = Math.round(effStat(actor, 'matk') * skill.heal)
      const healed = applyHeal(state, target, amount)
      state.log.push({ t: 'heal', uid: target.uid, value: healed, text: `${target.dragon.name} +${healed}` })
    }
  }

  for (const target of (skill.power > 0 ? dmgTargets : [])) {
    /* 공격 스킬 */
    {
      for (let h = 0; h < hits; h++) {
        if (!target.alive) break
        /* 명중 판정 — 실명이면 명중률이 깎이고, 회피 룬이면 더 깎인다 */
        const acc = skill.acc * (1 - statusValue(actor, 'blind')) * (1 - runeEffect(target.rune, 'dodge'))
        if (state.rng() * 100 >= acc) {
          state.log.push({ t: 'miss', uid: target.uid, text: `${target.dragon.name}에게 빗나갔다` })
          continue
        }
        const { dmg, crit } = rollDamage(state, actor, target, skill, h)
        const dealt = applyDamage(state, target, dmg)
        totalDealt += dealt
        state.log.push({ t: 'hit', uid: target.uid, value: dealt, crit, text: `${target.dragon.name} -${dealt}${crit ? ' 치명타!' : ''}` })
        /* 맹독 송곳니 — 때릴 때 화상을 남긴다 */
        const venom = passiveEffect(actor, 'venom')
        if (venom && target.alive && state.rng() * 100 < venom) {
          addStatus(state, target, { key: 'burn', chance: 100, turns: 2, value: 0.05 })
        }
        /* 가시 비늘 — 맞은 쪽이 받은 피해의 일부를 되돌린다.
           반격(룬)과 달리 확률이 아니라 항상 터지므로 수치를 낮게 뒀다. */
        const thorns = passiveEffect(target, 'thorns')
        if (thorns > 0 && actor.alive) {
          const back = Math.max(1, Math.round(dealt * thorns))
          const hurt = applyDamage(state, actor, back)
          state.log.push({ t: 'hit', uid: actor.uid, value: hurt, text: `${target.dragon.name} 가시 비늘! ${actor.dragon.name} -${hurt}` })
        }
        /* 흡혈 — 스킬 · 룬 · 패시브를 함께 적용한다 */
        const drainPct = (skill.drain || 0) + runeEffect(actor.rune, 'drain') + passiveEffect(actor, 'lifesteal')
        if (drainPct > 0) {
          const back = applyHeal(state, actor, Math.round(dealt * drainPct))
          if (back > 0) state.log.push({ t: 'heal', uid: actor.uid, value: back, text: `${actor.dragon.name} +${back} 흡혈` })
        }
        /* 반격 룬 — 맞은 쪽이 즉시 되받아친다.
           반격에 또 반격이 걸리면 끝없이 튕기므로 여기서 한 번만 계산한다. */
        const counter = runeEffect(target.rune, 'counter')
        if (counter > 0 && target.alive && actor.alive && state.rng() < counter) {
          const back = rollDamage(state, target, actor, BASIC_ATTACK, 0)
          const hurt = applyDamage(state, actor, back.dmg)
          state.log.push({ t: 'hit', uid: actor.uid, value: hurt, text: `${target.dragon.name} 반격! ${actor.dragon.name} -${hurt}` })
        }
      }
    }
  }

  /* 상태이상 — 이로운 것은 우리 편에게, 해로운 것은 상대편에게 */
  if (skill.status) {
    const good = skill.status.key === 'shield' || skill.status.key === 'regen' || skill.status.key === 'haste'
    for (const target of (good ? healTargets : dmgTargets)) {
      if (!target.alive) continue
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
  /* 재생 룬 · 느린 회복 패시브 — 자기 턴이 끝날 때마다 회복한다 */
  const regen = runeEffect(unit.rune, 'regen') + passiveEffect(unit, 'mend')
  if (regen > 0 && unit.alive) {
    const heal = applyHeal(state, unit, Math.max(1, Math.round(unit.maxHp * regen)))
    if (heal > 0) state.log.push({ t: 'heal', uid: unit.uid, value: heal, text: `${unit.dragon.name} 재생 +${heal}` })
  }
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

/* 지금 유닛의 턴을 마무리한다 — 상태이상 경과와 쿨타임 감소 */
function finishTurn(state) {
  const u = unitById(state, state.order[state.turnIndex])
  if (u && u.alive) {
    tickStatuses(state, u)
    for (const k of Object.keys(u.cds)) u.cds[k] = Math.max(0, u.cds[k] - 1)
  }
  state.turnIndex += 1
}

function endTurn(state) {
  finishTurn(state)
  if (checkEnd(state)) return
  advanceToActor(state)
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
   1) 궁극기가 열려 있으면 쓴다
   2) 회복형이고 아군이 위험하면 회복
   3) 쓸 수 있는 가장 강한 공격기
   4) 없으면 기본 공격 */
export function enemyAction(state) {
  const actor = currentUnit(state)
  if (!actor || actor.side !== 'enemy') return state
  const list = skillsOf(actor.dragon).filter((s) => canUse(actor, s, state.round))
  const foes = aliveOf(state, 'ally')
  const friends = aliveOf(state, 'enemy')

  const hurt = friends.some((f) => f.hp / f.maxHp < 0.55)
  /* 궁극기는 아끼지 않는다 — 단, 회복 궁극기는 다칠 때만.
     아무도 안 다쳤는데 회복 궁극기를 계속 쓰면 전투가 영원히 끝나지 않는다. */
  const ult = list.find((s) => isUlt(s) && (s.power > 0 || hurt))
  if (ult) return castSkill(state, ult.id, pickTarget(state, actor, ult, foes, friends))

  const healer = list.find((s) => s.heal && s.power === 0 && hurt)
  if (healer) return castSkill(state, healer.id, pickTarget(state, actor, healer, foes, friends))

  const attacks = list.filter((s) => s.power > 0).sort((a, b) => b.power - a.power)
  const pick = attacks[0] || list[0] || BASIC_ATTACK
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
