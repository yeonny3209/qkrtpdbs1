/* ==================================================================
   전투 로그 → 연출 지시서

   전투 엔진은 한 번의 행동을 즉시 계산하고 로그만 남긴다. 화면은
   그 로그를 읽어 "누가 누구를 어떻게 때렸는지"를 알아내 모션을 건다.

   엔진과 화면 사이를 로그 하나로 이어두면, 플레이어 조작이든 적 AI든
   같은 경로로 연출이 붙는다. 연출을 위해 엔진에 콜백을 심지 않아도 된다.
   ================================================================== */

/* 로그의 from 번째부터 끝까지 읽어 한 번의 행동을 요약한다.
   행동이 없었으면 null. */
export function readAction(log, from = 0) {
  const entries = log.slice(from)
  if (!entries.length) return null

  let actor = null
  let skill = null
  let kind = null
  let element = null
  const hits = []      // { uid, value, crit, miss } — 이번 공격의 직접 타격
  const dots = []      // 화상·재생 같은 지속 효과 (같은 순간에 함께 찍힌다)
  const heals = []     // { uid, value }
  const downs = []
  const statuses = []
  let fled = false
  let ended = null

  for (const e of entries) {
    switch (e.t) {
      case 'skill':
        /* 첫 번째 시전만 잡는다. 반격처럼 뒤따라오는 것은 별개 행동이 아니다. */
        if (!actor) { actor = e.uid; skill = e.skill ?? null; kind = e.kind ?? null; element = e.element ?? null }
        break
      /* 화상·재생 같은 지속 효과는 이번 공격에 맞은 것이 아니다.
         구분하지 않으면 엉뚱한 유닛이 피격 모션을 하고, 심지어
         공격한 본인이 자기 화상 때문에 "맞은" 것으로 잡힌다. */
      case 'hit':
        (e.dot ? dots : hits).push({
          uid: e.uid, value: e.value || 0, crit: !!e.crit, reflect: !!e.reflect,
        })
        break
      case 'miss': hits.push({ uid: e.uid, value: 0, miss: true }); break
      case 'heal': (e.dot ? dots : heals).push({ uid: e.uid, value: e.value || 0 }); break
      case 'down': downs.push(e.uid); break
      case 'status': statuses.push({ uid: e.uid, key: e.key }); break
      case 'flee': fled = true; break
      case 'end': ended = e.text || null; break
      default: break
    }
  }

  /* 아무 일도 없었으면 (건너뛰기 같은 것) 모션을 걸지 않는다 */
  if (!actor && !hits.length && !heals.length && !dots.length) return null

  const targets = [...new Set(hits.map((h) => h.uid))]
  const allMissed = hits.length > 0 && hits.every((h) => h.miss)
  return {
    actor,
    skill,
    kind,
    element,
    hits,
    dots,
    heals,
    downs,
    statuses,
    targets,
    allMissed,
    fled,
    ended,
    crit: hits.some((h) => h.crit),
    total: hits.reduce((a, h) => a + (h.value || 0), 0),
  }
}

/* 그 유닛이 이번 연출에서 어떤 역할인가 */
export function roleOf(action, uid) {
  if (!action || !uid) return null
  /* 시전자는 가시 비늘·반격에 되맞았더라도 공격 모션을 유지한다.
     한 번의 행동에 두 모션을 겹치면 어느 쪽도 제대로 안 보인다.
     되맞은 피해는 숫자로만 알린다. */
  if (action.actor === uid) return 'attack'
  if (action.hits.some((h) => h.uid === uid && !h.miss)) return 'hurt'
  if (action.hits.some((h) => h.uid === uid && h.miss)) return 'dodge'
  if (action.heals.some((h) => h.uid === uid && h.value > 0)) return 'heal'
  return null
}

/* 화면 흔들림 세기 — 궁극기와 치명타만 크게 흔든다.
   매 타격마다 흔들면 눈이 피로하고, 정작 중요한 순간이 묻힌다. */
export function shakeStrength(action) {
  if (!action) return 0
  if (action.kind === 'ult') return 1
  if (action.crit) return 0.55
  return 0
}

/* 그 유닛에게 띄울 숫자들 (피해는 음수, 회복은 양수) */
export function popsFor(action, uid) {
  if (!action) return []
  const out = []
  action.hits.filter((h) => h.uid === uid).forEach((h) => {
    out.push(h.miss
      ? { text: 'MISS', miss: true }
      : { text: `-${h.value}`, crit: h.crit, reflect: h.reflect })
  })
  action.heals.filter((h) => h.uid === uid && h.value > 0).forEach((h) => {
    out.push({ text: `+${h.value}`, heal: true })
  })
  /* 지속 피해·재생은 작게 따로 보여준다 — 이번 타격과 섞이면 안 된다 */
  ;(action.dots || []).filter((d) => d.uid === uid && d.value > 0).forEach((d) => {
    out.push({ text: `${d.value}`, dot: true })
  })
  return out
}
