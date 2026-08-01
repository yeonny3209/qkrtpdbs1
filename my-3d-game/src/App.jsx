import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Billboard, RoundedBox } from '@react-three/drei'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import {
  lerp, clamp, smooth, damp, dist2, pick, angleDiff, dampAngle, inZone,
  loadJSON, saveJSON,
  LS_DEVICE, TOUCH, DeviceCtx, useIsMobile, guessMobile,
} from './shared/util.js'
import { VirtualJoystick, TouchBtn } from './shared/ui.jsx'
import EscapeGame from './EscapeGame.jsx'
import { useRoom } from './net/useRoom.js'
import { getWsUrl } from './net/config.js'
import { encodeMobs, decodeMobs, sameIds, isMyKill } from './net/mobSync.js'
import { partyCreate, partyAdd, partyRemove, partySetReady, partySnapshot } from './net/party.js'
import { SKILL_SUFFIX, CLASS_ARCH_OF, SKILL_NAMES, skillTierAt, MOON_BASIC, MOON_SKILL_DMG_MUL, MOONLORD_MULT, SPELLBLADE_COMBO, FAIRY_CAP, FAIRY_GATHER_SEC, DARK_PASSIVE } from './game/skills.js'
import { MOB_TYPES, MOB_SCALE, MAPS, MAP_BY_ID, SPECIAL_SPOTS } from './game/world.js'
import { MAIN_QUESTS, MQ_COUNT, MQ_GOAL_LEVEL, currentQuest, canTurnIn, allQuestsDone } from './game/quests.js'
import {
  MAX_GRADE, clampInt, gradeOf, rollDrop, sellPrice,
  RUNE_DROP, ARTIFACT_DROP, artifactAllowed,
} from './game/loot.js'
import { classifyCode, isAdminPw } from './game/codes.js'
import {
  SQ_BY_ID, questsForMap, npcSpotsForMap, sqState, sqProgress, sqComplete,
} from './game/sidequests.js'
import {
  DUNGEONS, DUNGEON_BY_ID, DG_WAVES, DG_HALF, dungeonWave, dungeonWaveReward,
  RAID_DIFFS, RAID_BY_ID, RAID_HALF, RAID_BOSS_ID, raidBossHp, raidPhase, raidMechanics,
  soloRaidBossHp, soloRaidDmg,
} from './game/dungeon.js'

/* ==================================================================
   [3D 하드코어 액션 RPG — 세계관 · 튜토리얼 · 전직 시스템]
   · 튜토리얼: 이장에게 '토끼 간' 10개 → 완료 전까지 전 콘텐츠 잠금
   · 넓은 맵 · 구역별 NPC(이장 / 상인 / 9직업 전직관)
   · 10레벨 단위 6차 전직 → 스킬트리 확장 + 스킬 레벨 상한 증가
   · 9직업 영구 성장 기믹 (1회 성공당 +0.01 — 극한의 노가다)
   · 우클릭 오빗 카메라 · 카메라 기준 이동 · 인벤토리 · PVP 투기장 유지
   ================================================================== */

/* ---------------- 저장 키 ---------------- */
const LS_ACCOUNT = 'rpg_world_account_v3'
const LS_NICKS = 'rpg_world_nicks_v3'
const LS_SAVE = 'rpg_world_save_v3'

/* ---------------- 이동 · 카메라 ---------------- */
const WALK_SPEED = 6
const RUN_SPEED = 10
const ACCEL = 12
const TURN_LAMBDA = 16
const CAM_LAMBDA = 10
const CAM_DIST = 9
const CAM_MIN_PITCH = 0.18
const CAM_MAX_PITCH = 1.32
const CAM_SENS = 0.006
const LOOK_HEIGHT = 1.4
const FIELD_HALF = 30           // 넓어진 맵
const ARENA_HALF = 11
const TUTORIAL_RADIUS = 15      // 튜토리얼 중 이동 가능 반경 (맵 탐험 잠금)

/* ---------------- 전투 ---------------- */
const SWING_TIME = 0.5
const IMPACT_AT = 0.22
const ATTACK_RANGE = 3.0
const ATTACK_ARC = 1.2
const HIT_FLASH = 0.3
const DIE_TIME = 0.9
const RESPAWN_TIME = 2.2
const BASE_HP = 120
const PLAYER_IFRAME = 0.6
const ARROW_SPEED = 26
const ARROW_LIFE = 1.4
const BASE_ATK = 12

/* ---------------- 성장 ---------------- */
const MAX_LEVEL = 60                       // 6차 전직(60Lv)까지
const EXP_FOR = (l) => l * l * l * 100
const GROWTH_STEP = 0.01                   // 기믹 1회 성공 = +0.01 (고정)
const LIVER_DROP = 0.70                    // 튜토리얼 '토끼 간' 드랍률 (사용자 확정)
const LIVER_NEED = 10

/* ==================================================================
   9개 직업 — 영구 성장 기믹 (전부 1회당 +0.01)
   ================================================================== */
const CLASSES = [
  { id: 'swordsman', name: '검사', weapon: 'sword', icon: '🗡️', color: '#60a5fa', mode: 'melee', fx: 'slash',
    role: '수련형 근접', statKey: 'atkBonus', statLabel: '수련 공격력',
    growHint: '수련관에서 검을 휘두를 때마다 공격력 +0.01 (영구)' },
  { id: 'mage', name: '마법사', weapon: 'staff', icon: '🔮', color: '#a78bfa', mode: 'spell', fx: 'spell',
    role: '연산 마법', statKey: 'atkBonus', statLabel: '마력',
    growHint: '좌클릭 수학 문제 정답 시 마력 +0.01 · 3정답마다 서클(1~7) 상승' },
  { id: 'warrior', name: '전사', weapon: 'greatsword', icon: '⚔️', color: '#f87171', mode: 'melee', fx: 'slash',
    role: '피격 성장', statKey: 'atkBonus', statLabel: '분노',
    growHint: '적에게 피격당할 때마다 공격력 +0.01 (영구)' },
  { id: 'archer', name: '궁수', weapon: 'bow', icon: '🏹', color: '#4ade80', mode: 'arrow', fx: 'arrow',
    role: '원거리 정밀', statKey: 'atkBonus', statLabel: '명중',
    growHint: '수련관 과녁을 화살로 맞힐 때마다 공격력 +0.01 (영구)' },
  { id: 'assassin', name: '도적', weapon: 'dagger', icon: '🔪', color: '#94a3b8', mode: 'melee', fx: 'slash',
    role: 'PVP 성장', statKey: 'atkBonus', statLabel: '처형',
    growHint: 'PVP 투기장에서 적을 처치할 때마다 공격력 +0.01 (영구)' },
  { id: 'priest', name: '성직자', weapon: 'cross', icon: '✝️', color: '#fbbf24', mode: 'melee', fx: 'spell',
    role: '축복 버퍼', statKey: 'buffCoef', statLabel: '축복 계수',
    growHint: '신전 제단에서 설교를 들을 때마다 축복 계수 +0.01 (영구)' },
  { id: 'moon', name: '달의 사제', weapon: 'moonstaff', icon: '🌙', color: '#818cf8', mode: 'melee', fx: 'spell',
    role: '저주 디버퍼', statKey: 'debuffPower', statLabel: '저주 위력',
    growHint: '필드의 달조각을 주울 때마다 저주 위력 +0.01 (영구)' },
  { id: 'healer', name: '힐러', weapon: 'wand', icon: '💖', color: '#f472b6', mode: 'heal', fx: 'spell',
    role: '회복 지원', statKey: 'healPower', statLabel: '치유력',
    growHint: '아군 더미를 치유할 때마다 치유력 +0.01 (영구)' },
  { id: 'reaper', name: '낫술사', weapon: 'scythe', icon: '☠️', color: '#34d399', mode: 'melee', fx: 'slash',
    role: '광역 수확', statKey: 'atkBonus', statLabel: '수확',
    growHint: '한 번의 낫질로 2명 이상 동시에 벨 때마다 공격력 +0.01 (영구)' },
]

/* ==================================================================
   히든 직업 — 시작 시 고를 수 없고, 특정 행동으로만 얻는다 (사용자 확정)

   from   : 이 직업(들)이어야 전직할 수 있다 (null = 아무 직업이나)
   how    : 획득 조건 설명
   where  : 조건을 만족시키는 장소 (world.js의 special 키)
   ================================================================== */
const HIDDEN_CLASSES = [
  { id: 'spellblade', name: '마검사', weapon: 'sword', icon: '🗡️✨', color: '#818cf8', mode: 'melee', fx: 'slash',
    role: '검·마법 병행 (극난이도)', statKey: 'atkBonus', statLabel: '검마 숙련',
    hidden: true, from: null, where: 'magic_falls',
    how: '마법의 폭포에서 폭포 안으로 들어간다',
    growHint: '검과 마법을 번갈아 써야 위력이 오른다 — 익히기 매우 어렵다',
    note: '충분히 강해지면 압도적이지만, 그 전까지 성장이 더뎌 포기하기 쉽다' },
  { id: 'fairymancer', name: '요정술사', weapon: 'wand', icon: '🧚', color: '#5eead4', mode: 'spell', fx: 'spell',
    role: '요정 소환 (자동 사냥)', statKey: 'atkBonus', statLabel: '교감',
    hidden: true, from: null, where: 'fairy_grove',
    how: '엘프의 숲에서 요정 10명을 모아 마법사 전직관에게 간다',
    growHint: '요정의 레벨을 올리면 요정들이 알아서 사냥한다',
    note: '자신을 지킬 수단이 거의 없어 도적·암살자 계열에 매우 취약하다' },
  { id: 'darkassassin', name: '어둠의 암살자', weapon: 'dagger', icon: '🌑🔪', color: '#7c3aed', mode: 'melee', fx: 'slash',
    role: '은신 암살 (스킬 5개)', statKey: 'atkBonus', statLabel: '암살',
    hidden: true, from: ['assassin'], where: 'dark_altar',
    how: '도적으로 PVP를 한방에 5번 끝낸 뒤 어둠의 제단에서 제사를 드린다',
    growHint: '가만히 있다가 움직이면 은신한다 — 은신에서 시작하는 연계가 핵심',
    note: '능력이 단 5가지지만 하나하나가 결정적이다' },
  { id: 'moonlord', name: '달의 권위자', weapon: 'moonstaff', icon: '🌘👑', color: '#a5b4fc', mode: 'melee', fx: 'spell',
    role: '저주 극대화 (전 스킬 각성)', statKey: 'debuffPower', statLabel: '권위',
    hidden: true, from: ['moon'], where: 'moon_sea',
    how: '달의 사제로 달조각 1000개를 모아 달의 바다 구덩이에서 스킬 3개를 쓴다',
    growHint: '저주 위력이 100배가 되고 모든 스킬이 각성 스킬이 된다',
    note: '마지막 스킬은 달을 떨어뜨려 모든 저주를 걸고 빈사의 적을 처형한다' },
  { id: 'novice', name: '초초보자', weapon: 'sword', icon: '🌱', color: '#facc15', mode: 'melee', fx: 'slash',
    role: '전 직업 융합', statKey: 'atkBonus', statLabel: '융합',
    hidden: true, from: null, where: null,
    how: '15레벨이 될 때까지 한 번도 전직하지 않는다',
    growHint: '모든 직업의 무기와 스킬을 섞어 쓸 수 있다',
    note: '이론상 모든 스킬을 쓰는 최강이 될 수 있다' },
]
const HIDDEN_BY_ID = Object.fromEntries(HIDDEN_CLASSES.map((c) => [c.id, c]))
const ALL_CLASSES = [...CLASSES, ...HIDDEN_CLASSES]
const CLASS_BY_ID = Object.fromEntries(ALL_CLASSES.map((c) => [c.id, c]))


/* 히든 직업 해금 조건 판정 — 저장 데이터만 보고 결정한다 */
function hiddenUnlockable(save, clsId, hid) {
  const h = HIDDEN_BY_ID[hid]
  if (!h) return false
  if ((save.hidden || {})[hid]) return false                 // 이미 얻음
  if (h.from && !h.from.includes(clsId)) return false         // 선행 직업 조건
  switch (hid) {
    case 'spellblade': return true                            // 폭포 안에 들어가면 즉시
    case 'fairymancer': return (save.fairies || 0) >= 10
    case 'darkassassin': return (save.oneShotPvp || 0) >= 5
    case 'moonlord': return (save.fragments || 0) >= 1000
    case 'novice': return (save.level || 1) >= 15 && (save.tier || 0) === 0
    default: return false
  }
}

/* ==================================================================
   무기 — 종류 · 한손/두손 · 직업 제한
   ================================================================== */
const WEAPON_TYPES = {
  sword: { name: '검', hands: 1, classes: ['swordsman'], atk: 8 },
  greatsword: { name: '대검', hands: 2, classes: ['warrior'], atk: 14 },
  staff: { name: '지팡이', hands: 2, classes: ['mage'], atk: 12 },
  bow: { name: '활', hands: 2, classes: ['archer'], atk: 11 },
  dagger: { name: '단검', hands: 1, classes: ['assassin'], atk: 7 },
  cross: { name: '십자가', hands: 1, classes: ['priest'], atk: 8 },
  moonstaff: { name: '초승달 지팡이', hands: 2, classes: ['moon'], atk: 12 },
  wand: { name: '마법봉', hands: 1, classes: ['healer'], atk: 6 },
  scythe: { name: '거대한 낫', hands: 2, classes: ['reaper'], atk: 15 },
}
const WEAPON_KEYS = Object.keys(WEAPON_TYPES)

/* ==================================================================
   등급
   ================================================================== */
/* 등급·확률·거래가는 game/loot.js 가 소유한다 (단위 테스트 대상) */
function rollGrade(max = MAX_GRADE, luck = 1) {
  const g = rollDrop(luck)
  return Math.min(max, g == null ? 0 : g)
}

/* ==================================================================
   룬 · 방어구 · 아티팩트
   ================================================================== */
const RUNE_OPTS = [
  { key: 'atk', name: '공격력', base: 4, unit: '', desc: '공격력 증가' },
  { key: 'critRate', name: '크리티컬 확률', base: 3, unit: '%', desc: '치명타 확률 증가' },
  { key: 'critDmg', name: '크리티컬 피해', base: 8, unit: '%', desc: '치명타 피해 증가' },
  { key: 'maxHp', name: '최대 체력', base: 14, unit: '', desc: '최대 체력 증가' },
  { key: 'moveSpd', name: '이동속도', base: 2.5, unit: '%', desc: '이동속도 증가' },
  { key: 'defense', name: '방어력', base: 5, unit: '', desc: '방어력 증가' },
  { key: 'regen', name: '체력 재생', base: 0.8, unit: '/s', desc: '초당 체력 회복' },
  { key: 'dmgReduce', name: '피해 감소', base: 1.6, unit: '%', desc: '받는 피해 감소' },
  { key: 'dodge', name: '회피율', base: 1.8, unit: '%', desc: '공격 회피 확률' },
  { key: 'goldGain', name: '골드 획득', base: 6, unit: '%', desc: '골드 획득량 증가' },
]
const RUNE_SLOTS = 10
const RUNE_PREFIX = ['무딘', '예리한', '고대의', '신성한']

const ARMOR_SLOTS = [
  { key: 'hat', name: '모자', stat: 'regen', base: 1.2, unit: '/s', icon: '🎩', desc: '생명력 회복력' },
  { key: 'top', name: '상의', stat: 'dmgReduce', base: 2.5, unit: '%', icon: '👕', desc: '피해 감소' },
  { key: 'bottom', name: '하의', stat: 'defense', base: 7, unit: '', icon: '👖', desc: '방어력' },
  { key: 'shoes', name: '신발', stat: 'moveSpd', base: 4, unit: '%', icon: '👟', desc: '이동속도' },
]
const ARMOR_SLOT_BY_KEY = Object.fromEntries(ARMOR_SLOTS.map((s) => [s.key, s]))
const ARMOR_SETS = {
  novice: { name: '초보자의', color: '#94a3b8',
    b2: { key: 'maxHp', value: 20, label: '최대 체력 +20' },
    b4: { key: 'regen', value: 1.5, label: '체력 재생 +1.5/s' } },
  steel: { name: '강철의', color: '#60a5fa',
    b2: { key: 'defense', value: 12, label: '방어력 +12' },
    b4: { key: 'dmgReduce', value: 8, label: '피해 감소 +8%' } },
  abyss: { name: '심연의', color: '#a78bfa',
    b2: { key: 'atk', value: 10, label: '공격력 +10' },
    b4: { key: 'critRate', value: 12, label: '크리티컬 확률 +12%' } },
}
const ARMOR_SET_KEYS = Object.keys(ARMOR_SETS)

const ARTIFACT_EFFECTS = [
  { key: 'moveSurge', name: '질풍의 인장', stat: 'moveSpd', base: 12, unit: '%', desc: '이동속도 대폭 증가' },
  { key: 'atkSurge', name: '파멸의 인장', stat: 'atk', base: 18, unit: '', desc: '공격력 대폭 증가' },
  { key: 'invincible', name: '불멸의 인장', stat: 'dodge', base: 7, unit: '%', desc: '무적 회피 확률' },
  { key: 'critMaster', name: '처형자의 인장', stat: 'critRate', base: 9, unit: '%', desc: '크리티컬 확률 대폭 증가' },
  { key: 'hpSurge', name: '거인의 인장', stat: 'maxHp', base: 60, unit: '', desc: '최대 체력 대폭 증가' },
  { key: 'lifesteal', name: '흡혈의 인장', stat: 'lifesteal', base: 5, unit: '%', desc: '피해의 일부를 체력으로 흡수' },
  { key: 'thorns', name: '가시의 인장', stat: 'thorns', base: 15, unit: '%', desc: '받은 피해를 반사' },
  { key: 'swift', name: '신속의 인장', stat: 'atkSpd', base: 8, unit: '%', desc: '공격 속도 증가' },
  { key: 'midas', name: '황금의 인장', stat: 'goldGain', base: 25, unit: '%', desc: '골드 획득량 대폭 증가' },
  { key: 'sage', name: '현자의 인장', stat: 'expGain', base: 25, unit: '%', desc: '경험치 획득량 대폭 증가' },
]

/* ==================================================================
   전직 단계 (6차) — 10레벨 단위
   ================================================================== */
const JOB_TIERS = [
  { tier: 0, name: '견습', reqLv: 1, cost: 0, title: '기본', unlock: '기본 스킬' },
  { tier: 1, name: '숙련', reqLv: 10, cost: 800, title: '1차 전직', unlock: '기본 스킬 연계 스킬 해금' },
  { tier: 2, name: '정예', reqLv: 20, cost: 2500, title: '2차 전직', unlock: '완전히 새로운 신규 스킬 해금' },
  { tier: 3, name: '영웅', reqLv: 30, cost: 7000, title: '3차 전직', unlock: '스킬 범위 · 데미지 강화 패시브' },
  { tier: 4, name: '전설', reqLv: 40, cost: 18000, title: '4차 전직', unlock: '여러 연계가 섞인 콤보 스킬' },
  { tier: 5, name: '신화', reqLv: 50, cost: 45000, title: '5차 전직', unlock: '직업 고유 전설 스킬' },
  { tier: 6, name: '초월', reqLv: 60, cost: 120000, title: '6차 전직', unlock: '궁극의 각성 — 이펙트 변화 · 패시브 극대화' },
]
const MAX_TIER = 6
/* 전직 퀘스트 — 난이도 상향 (사용자 확정).
   처치 수 요구가 훨씬 커지고, 던전 클리어도 함께 요구한다. */
const jobQuestNeed = (tier) => 40 + tier * 60
const jobQuestDungeons = (tier) => Math.max(1, tier)

/* 스킬 정의 생성 (직업 × 11 = 99개)
   각 티어의 첫 스킬 id는 예전 체계의 `${cls}_t${tier}`를 그대로 써서
   기존 세이브의 투자 레벨이 자동으로 이어진다. */
function buildSkills() {
  const out = {}
  ALL_CLASSES.forEach((c) => {
    const arch = CLASS_ARCH_OF(c.id)
    let prevTier = -1, idxInTier = 0
    out[c.id] = arch.map((a, i) => {
      const tier = skillTierAt(c.id, i)
      idxInTier = tier === prevTier ? idxInTier + 1 : 0
      prevTier = tier
      const nm = SKILL_NAMES[c.id][i]
      return {
        id: `${c.id}_t${tier}${SKILL_SUFFIX[idxInTier]}`,
        cls: c.id, tier, slot: i + 1,
        name: nm[0], desc: nm[1],
        type: 'active', kind: a.kind,
        cd: a.cd, dmgMul: a.mul, dmgPer: a.per,
        range: a.range, arc: a.arc, hits: a.hits, dur: a.dur,
        buffs: a.buffs, debs: a.debs, aoe: a.aoe,
        heal: a.heal, healPer: a.per, hot: a.hot, shield: a.shield, revive: a.revive,
        fx: c.fx, color: c.color,
      }
    })
  })
  return out
}
const SKILLS = buildSkills()
const SKILL_BY_ID = {}
Object.values(SKILLS).forEach((list) => list.forEach((s) => { SKILL_BY_ID[s.id] = s }))

/* 스킬 레벨 상한 — 전직할수록 기존 스킬의 상한이 올라간다 */
const skillMaxLv = (skill, tier) => (tier < skill.tier ? 0 : 3 + (tier - skill.tier))

/* ------------------------------------------------------------------
   버프 — 각자 자기 live.buffs에 얹고 자기 시계로 소멸시킨다.
   (지속 상태를 브로드캐스트하지 않아 트래픽이 없다 — 렉 최소화)
   ------------------------------------------------------------------ */
function addBuff(L, k, p, durSec) {
  L.buffs.push({ k, p, until: performance.now() + durSec * 1000 })
  if (L.buffs.length > 40) L.buffs.splice(0, L.buffs.length - 40)
}
function buffSum(L, k) {
  const now = performance.now()
  let v = 0
  for (const b of L.buffs) if (b.k === k && b.until > now) v += b.p
  return v
}
function pruneBuffs(L) {
  const now = performance.now()
  L.buffs = L.buffs.filter((b) => b.until > now && !(b.k === 'shield' && b.p <= 0))
}
/* 보호막이 먼저 피해를 흡수하고, 뚫린 만큼만 돌려준다 */
function absorbShield(L, dmg) {
  const now = performance.now()
  let left = dmg
  for (const b of L.buffs) {
    if (left <= 0) break
    if (b.k !== 'shield' || b.until <= now || b.p <= 0) continue
    const use = Math.min(b.p, left)
    b.p -= use
    left -= use
  }
  return left
}
/* 공격 시점의 유효 스탯 — 버프를 반영한 얕은 사본 (호출 빈도 낮아 저비용) */
function withBuffs(st, L) {
  const atkP = buffSum(L, 'atkP')
  const critF = buffSum(L, 'critF')
  const lsP = buffSum(L, 'lsP')
  if (!atkP && !critF && !lsP) return st
  return {
    ...st,
    atk: st.atk * (1 + atkP / 100),
    critRate: Math.min(100, st.critRate + critF),
    lifesteal: (st.lifesteal || 0) + lsP,
  }
}

/* 몹 디버프 비트 (전송·시각화용) */
const DEB_BITS = { slow: 1, weak: 2, vuln: 4, dot: 8, root: 16, blind: 32 }
function debuffBits(debuffs) {
  if (!debuffs) return 0
  const now = performance.now()
  let bits = 0
  for (const k in debuffs) if (debuffs[k].until > now) bits |= DEB_BITS[k] || 0
  return bits
}
function debuffVal(debuffs, k) {
  if (!debuffs) return 0
  const d = debuffs[k]
  return d && d.until > performance.now() ? d.p : 0
}

/* ==================================================================
   구역 · NPC 배치
   ================================================================== */
const TRAIN_ZONE = { x: -19, z: -17, r: 7.5 }     // 수련관
const TEMPLE = { x: 19, z: -17 }                   // 신전
const MAGE_TOWER = { x: -22, z: 15 }               // 마법탑
const MOON_ALTAR = { x: 22, z: 15 }                // 달 제단
const ARCHERY = { x: -8, z: 22 }                   // 사격장
const SHADOW_ALLEY = { x: 12, z: 22 }              // 그림자 골목
const PVP_PORTAL = { x: 0, z: -25 }
const DUMMY_SPOTS = [{ x: 17, z: -10 }, { x: 21, z: -9 }, { x: 19, z: -6 }]
const TARGET_SPOTS = [{ x: -22, z: -20 }, { x: -19, z: -21 }, { x: -16, z: -20 }]

const NPCS = [
  { id: 'chief', role: 'chief', name: '마을 이장', region: '마을 광장', icon: '🧑‍🌾', color: '#f59e0b', x: 0, z: -5, face: 0 },
  { id: 'merchant', role: 'merchant', name: '떠돌이 상인 로한', region: '마을 광장', icon: '💰', color: '#eab308', x: 6, z: -3, face: -0.8 },
  { id: 'changer', role: 'changer', name: '직업 변경관 실비아', region: '마을 광장', icon: '🔄', color: '#22d3ee', x: -6, z: -3, face: 0.8 },
  { id: 'jm_swordsman', role: 'job', cls: 'swordsman', name: '검술 사범 가론', region: '수련관', icon: '🗡️', color: '#60a5fa', x: -16, z: -12, face: 2.6 },
  { id: 'jm_warrior', role: 'job', cls: 'warrior', name: '투기장 노장 브렉', region: '수련관', icon: '⚔️', color: '#f87171', x: -22, z: -12, face: 2.6 },
  { id: 'jm_reaper', role: 'job', cls: 'reaper', name: '수확자 모르가', region: '수련관', icon: '☠️', color: '#34d399', x: -19, z: -23, face: 0 },
  { id: 'jm_priest', role: 'job', cls: 'priest', name: '대주교 이레아', region: '신전', icon: '✝️', color: '#fbbf24', x: 17, z: -12, face: -2.6 },
  { id: 'jm_healer', role: 'job', cls: 'healer', name: '치유원장 뮤렌', region: '신전', icon: '💖', color: '#f472b6', x: 22, z: -12, face: -2.6 },
  { id: 'jm_mage', role: 'job', cls: 'mage', name: '마탑주 아르카나', region: '마법탑', icon: '🔮', color: '#a78bfa', x: -22, z: 11, face: 3.0 },
  { id: 'jm_moon', role: 'job', cls: 'moon', name: '월신관 셀레네', region: '달 제단', icon: '🌙', color: '#818cf8', x: 22, z: 11, face: 3.0 },
  { id: 'jm_archer', role: 'job', cls: 'archer', name: '사격장주 리엔', region: '사격장', icon: '🏹', color: '#4ade80', x: -8, z: 18, face: 3.14 },
  { id: 'jm_assassin', role: 'job', cls: 'assassin', name: '그림자 두목 카를', region: '그림자 골목', icon: '🔪', color: '#94a3b8', x: 12, z: 18, face: 3.14 },
]
const NPC_BY_ID = Object.fromEntries(NPCS.map((n) => [n.id, n]))
const jobMasterFor = (clsId) => NPCS.find((n) => n.role === 'job' && n.cls === clsId)

/* 상인 판매 목록
   룬과 아티팩트는 상점에서 살 수 없다 (사용자 확정 규칙)
   — 룬은 사냥·룬 퀘스트로만, 아티팩트는 40레벨 이상 던전에서만 나온다. */
const SHOP_STOCK = [
  { key: 'armor', name: '방어구 꾸러미', desc: '무작위 방어구 1개 (일반~에픽)', price: 1800, icon: '🛡️', gradeMax: 2 },
  { key: 'weapon', name: '무기 상자', desc: '내 직업 전용 무기 1개 (일반~에픽)', price: 2600, icon: '⚔️', gradeMax: 2 },
  { key: 'sp', name: '깨달음의 서', desc: '스킬 포인트 +1', price: 2500, icon: '📖' },
]

/* ==================================================================
   PVP AI 난이도 6단계
   ================================================================== */
const AI_DIFFS = [
  { id: 0, name: '수련생', color: '#4ade80', hp: 60, dmg: 5, spd: 3.4, cool: 2.0, windup: 0.75, gold: 20, exp: 80, star: '★' },
  { id: 1, name: '병사', color: '#60a5fa', hp: 95, dmg: 9, spd: 4.3, cool: 1.4, windup: 0.55, gold: 40, exp: 180, star: '★★' },
  { id: 2, name: '기사', color: '#a78bfa', hp: 140, dmg: 14, spd: 5.1, cool: 1.05, windup: 0.45, gold: 70, exp: 340, star: '★★★' },
  { id: 3, name: '챔피언', color: '#fbbf24', hp: 210, dmg: 20, spd: 5.8, cool: 0.85, windup: 0.36, gold: 120, exp: 620, star: '★★★★' },
  { id: 4, name: '군주', color: '#f472b6', hp: 320, dmg: 28, spd: 6.5, cool: 0.7, windup: 0.3, gold: 200, exp: 1100, star: '★★★★★' },
  { id: 5, name: '지옥', color: '#ef4444', hp: 480, dmg: 38, spd: 7.4, cool: 0.55, windup: 0.24, gold: 340, exp: 2000, star: '★★★★★★' },
]

/* ==================================================================
   다중 맵(사냥터) — 레벨별로 입장하는 별도의 맵
   ================================================================== */


/* 맵별 포탈 배치 — 빛나는 기둥 */
function portalsFor(mapId) {
  const out = []
  const m = MAP_BY_ID[mapId]
  if (!m) return out
  if (mapId > 0) out.push({ to: mapId - 1, x: -9, z: -(m.half - 5), label: MAP_BY_ID[mapId - 1].name, color: '#38bdf8' })
  if (mapId < MAPS.length - 1) out.push({ to: mapId + 1, x: 9, z: -(m.half - 5), label: MAP_BY_ID[mapId + 1].name, color: '#f59e0b' })
  return out
}

/* ==================================================================
   거미줄 스킬트리 — 방사형 노드 레이어
   중앙(기본 스킬) → 전직할 때마다 바깥 테두리(레이어)가 해금된다.
   각 레이어 = [메인 스킬 노드, 특성 노드 ×2]
   ================================================================== */
const WEB_STATS = [
  /* tier 1 */[{ k: 'atk', name: '예리함', stat: 'atk', per: 3, unit: '' }, { k: 'hp', name: '강인함', stat: 'maxHp', per: 14, unit: '' }],
  /* tier 2 */[{ k: 'crit', name: '통찰', stat: 'critRate', per: 2, unit: '%' }, { k: 'def', name: '견고함', stat: 'defense', per: 6, unit: '' }],
  /* tier 3 */[{ k: 'cdmg', name: '잔혹함', stat: 'critDmg', per: 12, unit: '%' }, { k: 'red', name: '불굴', stat: 'dmgReduce', per: 2, unit: '%' }],
  /* tier 4 */[{ k: 'spd', name: '질풍', stat: 'moveSpd', per: 3, unit: '%' }, { k: 'reg', name: '재생', stat: 'regen', per: 0.7, unit: '/s' }],
  /* tier 5 */[{ k: 'dodge', name: '환영', stat: 'dodge', per: 2.5, unit: '%' }, { k: 'ls', name: '흡혈', stat: 'lifesteal', per: 2, unit: '%' }],
  /* tier 6 */[{ k: 'atk2', name: '초월의 힘', stat: 'atk', per: 8, unit: '' }, { k: 'hp2', name: '초월의 육체', stat: 'maxHp', per: 40, unit: '' }],
]
const WEB_STAT_MAX = 3          // 특성 노드 최대 레벨
const webStatId = (clsId, tier, k) => `${clsId}_w${tier}_${k}`

/* 특성 id로 정의를 되찾는다 (스킬트리 투자 시 사용) */
function findWebStat(clsId, id) {
  for (let t = 1; t <= MAX_TIER; t++) {
    const s = WEB_STATS[t - 1].find((x) => webStatId(clsId, t, x.k) === id)
    if (s) return { id, tier: t, stat: s }
  }
  return null
}

/* 유틸 · 터치 입력은 shared/ui.jsx 로 옮겨 방탈출 게임과 함께 쓴다 */

/* ==================================================================
   공유 사냥터 — 여러 명이 같은 필드에서 함께 논다.

   [진실의 소유자]
   호스트(방에 가장 먼저 들어온 사람)만 몬스터 AI를 돌리고 HP를 소유한다.
   나머지는 받은 좌표·HP를 따라 그린다. 그래야 "내 화면에선 죽었는데
   친구 화면에선 살아있는" 상태가 생기지 않는다.

   [혼자 할 때]
   방에 들어가지 않으면 world.current.net === null 이고, 모든 분기가
   호스트 경로를 타므로 기존 단독 플레이와 완전히 동일하게 동작한다.
   ================================================================== */
const NET_STATE_HZ = 15        // 내 위치를 보내는 빈도
const NET_MOB_HZ = 10          // 호스트가 몬스터 상태를 뿌리는 빈도
const PEER_TIMEOUT = 8000      // 이 시간 동안 소식 없는 캐릭터는 지운다
                               // (인터넷 순간 끊김에 캐릭터가 깜빡이지 않도록 여유 있게)

const makePlayerId = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/* 네트워크에서 나를 구분하는 id — 탭마다 다르다.
   localStorage는 탭끼리 공유되므로 저장 데이터에 id를 두면 같은 브라우저의
   두 탭이 한 사람으로 취급된다. sessionStorage는 탭별로 분리되고
   새로고침해도 유지되므로 여기에 둔다. */
const SS_PEER_ID = 'rpg_peer_id_v1'
function getPeerId() {
  try {
    let v = sessionStorage.getItem(SS_PEER_ID)
    if (!v) { v = makePlayerId(); sessionStorage.setItem(SS_PEER_ID, v) }
    return v
  } catch { return makePlayerId() }
}

/* 세상은 하나다 — 접속하면 코드 입력 없이 모두 같은 월드로 들어온다.
   맵 구분은 zone(아래 zoneOf)이 이미 해주므로 방을 나눌 이유가 없다. */
const WORLD_ROOM = 'WORLD'

/* zone — 오픈 필드는 맵 id, 던전/레이드/결투는 인스턴스 id로 구분한다.
   같은 zone에 있는 사람끼리만 서로 보이고 같은 몹을 공유한다. */
const zoneOf = (inst, mapId) => inst || 'm' + mapId

/* 이 피어가 나와 같은 zone에 있는가 */
function peerInZone(p, inst, mapId) {
  if (inst) return p.inst === inst
  return !p.inst && !p.arena && p.mapId === mapId
}

/* 몬스터가 노릴 대상 — 나와 접속자 중 가장 가까운 사람.
   혼자일 때는 나 자신만 후보이므로 기존 동작과 같다. */
function nearestTarget(w, x, z) {
  let best = w.player
  let bd = dist2(x, z, w.player.x, w.player.z)
  if (w.peers) {
    for (const p of w.peers.values()) {
      if (!peerInZone(p, w.inst, w.mapId) || p.dead || !p.alive) continue
      const d = dist2(x, z, p.x, p.z)
      if (d < bd) { bd = d; best = p }
    }
  }
  return best
}

/* 몬스터의 공격을 대상에게 전달한다. 피어가 맞았으면 그 사람에게 알린다. */
function deliverMobHit(w, target, dmg) {
  if (target && target.peerId) {
    if (w.net) w.net.room.send({ t: 'mobHit', target: target.peerId, dmg })
    return
  }
  if (w.hitPlayer) w.hitPlayer(dmg)
}

/* 달의 사제 디버프를 몹 레지스트리에 적용 — 몹 시뮬레이션 소유자만 호출한다 */
function applyMobDebuffs(w, ids, debs, durSec, casterId) {
  const until = performance.now() + durSec * 1000
  ids.forEach((id) => {
    const m = w.mobs.get(id)
    if (!m || !m.alive) return
    if (!m.debuffs) m.debuffs = {}
    debs.forEach(([k, p]) => {
      if (k === 'root') m.debuffs.root = { p, until: performance.now() + p * 1000 }
      else if (k === 'dot') m.debuffs.dot = { p, until, next: 0, by: casterId }
      else m.debuffs[k] = { p, until }
    })
  })
}

/* 모바일 지원(TOUCH · 조이스틱 · 터치 버튼)도 shared/ui.jsx 로 옮겼다 */

/* ------------------------------------------------------------------
   기기 선택 화면 — 접속 시 한 번 물어보고 저장한다
   ------------------------------------------------------------------ */
function DeviceSelectScreen({ onPick }) {
  const guessed = useMemo(() => guessMobile(), [])
  const opts = [
    {
      id: 'pc', icon: '🖥️', title: '컴퓨터', sub: 'PC · 노트북',
      desc: '키보드와 마우스로 조작합니다',
      keys: ['WASD 이동', '마우스 시점', '클릭 · 스페이스'],
      accent: '#6366f1', glow: 'rgba(99,102,241,.35)',
    },
    {
      id: 'mobile', icon: '📱', title: '모바일', sub: '스마트폰 · 태블릿',
      desc: '화면의 조이스틱과 버튼으로 조작합니다',
      keys: ['가상 조이스틱', '화면 드래그로 시점', '터치 버튼'],
      accent: '#f59e0b', glow: 'rgba(245,158,11,.35)',
    },
  ]
  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#070912]">
      <div className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,.2), transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(245,158,11,.13), transparent 55%)' }} />
      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-5 py-12">
        <div className="text-center">
          <div className="text-[11px] tracking-[0.5em] text-indigo-300/70">SELECT YOUR DEVICE</div>
          <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">어떤 기기로 플레이하나요?</h1>
          <p className="mt-3 text-sm text-slate-400">기기에 맞는 조작 방식으로 게임이 준비됩니다</p>
        </div>

        <div className="mt-10 grid w-full gap-4 sm:grid-cols-2">
          {opts.map((o) => (
            <button
              key={o.id}
              onClick={() => onPick(o.id)}
              className="group relative overflow-hidden rounded-3xl border border-white/12 bg-white/[0.03] p-7 text-left transition-all duration-300 hover:-translate-y-1.5 hover:bg-white/[0.06]"
              style={{ borderColor: 'rgba(255,255,255,.12)' }}
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: o.glow }} />
              <div className="relative">
                <div className="flex items-start justify-between">
                  <span className="text-5xl">{o.icon}</span>
                  {guessed === (o.id === 'mobile') && (
                    <span className="rounded-full border px-2.5 py-1 text-[10px] font-bold"
                      style={{ borderColor: o.accent + '80', color: o.accent, background: o.accent + '1a' }}>
                      추천
                    </span>
                  )}
                </div>
                <h2 className="mt-4 text-2xl font-black text-white">{o.title}</h2>
                <div className="mt-0.5 text-xs font-bold text-white/50">{o.sub}</div>
                <p className="mt-3 text-[13px] leading-relaxed text-slate-300">{o.desc}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {o.keys.map((k) => (
                    <span key={k} className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] text-slate-300">{k}</span>
                  ))}
                </div>
                <div className="mt-6 flex items-center gap-2 text-sm font-black transition-transform duration-300 group-hover:translate-x-1"
                  style={{ color: o.accent }}>
                  이걸로 시작 <span className="text-lg">→</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-9 text-center text-[11px] text-slate-600">
          나중에 로비 우측 상단에서 언제든 바꿀 수 있습니다
        </div>
      </div>
    </div>
  )
}


/* 몬스터 자리 뽑기 — 구역·NPC와 겹치지 않게 */
function pickSpot(others, avoid, nearVillage) {
  const R = nearVillage ? TUTORIAL_RADIUS - 2 : FIELD_HALF - 4
  for (let i = 0; i < 40; i++) {
    const x = (Math.random() * 2 - 1) * R
    const z = (Math.random() * 2 - 1) * R
    if (nearVillage && Math.hypot(x, z) > R) continue
    if (inZone(x, z, TRAIN_ZONE)) continue
    if (dist2(x, z, TEMPLE.x, TEMPLE.z) < 6) continue
    if (dist2(x, z, PVP_PORTAL.x, PVP_PORTAL.z) < 6) continue
    if (dist2(x, z, MAGE_TOWER.x, MAGE_TOWER.z) < 5) continue
    if (dist2(x, z, MOON_ALTAR.x, MOON_ALTAR.z) < 5) continue
    if (NPCS.some((n) => dist2(x, z, n.x, n.z) < 4.5)) continue
    if (avoid && dist2(x, z, avoid.x, avoid.z) < 5) continue
    if (others.some((o) => dist2(x, z, o.x, o.z) < 3.5)) continue
    return { x, z }
  }
  const a = Math.random() * Math.PI * 2
  const r = 6 + Math.random() * 5
  return { x: Math.cos(a) * r, z: Math.sin(a) * r }
}

/* ==================================================================
   저장 구조
   ================================================================== */
const emptyEquip = () => ({
  weapon: null, hat: null, top: null, bottom: null, shoes: null,
  runes: Array(RUNE_SLOTS).fill(null), artifact: null,
})
const defaultSave = () => ({
  v: 3,
  gold: 80, level: 1, exp: 0, sp: 0,
  tier: 0,                       // 전직 단계 0~6
  /* 튜토리얼 · 콘텐츠 해금 */
  tutorial: 'none',              // none → active → done
  livers: 0,                     // 토끼 간
  unlocked: false,               // 전 콘텐츠 해금 여부
  /* 메인 퀘스트 — 이장에게 받는 한 줄기 이야기 (현재 단계 번호) */
  mq: 0,
  dungeonClears: 0, raidClears: 0,
  /* 맵별 NPC 사이드 퀘스트 — { questId: { state, base, got } } */
  sq: {},
  /* 쿠폰 코드 — 계정당 1회 */
  usedCodes: {},
  /* 히든 직업 — 얻은 것 기록 + 조건 카운터 */
  hidden: {},                    // { classId: true }
  fairies: 0,                    // 엘프의 숲에서 모은 요정 수
  oneShotPvp: 0,                 // 한방에 끝낸 PVP 횟수 (어둠의 암살자 조건)
  /* 관리자 (코드로 해금) */
  admin: false,
  adminBoost: { exp: 1, drop: 1, gold: 1 },   // 경험치·확률·골드 배율 (관리자 패널 토글)
  /* 스킬 */
  skills: {},                    // { skillId: level }
  jobQuest: {},                  // { npcId: { state, base } } 전직 퀘스트
  /* 직업 성장 (1회 성공당 +0.01) */
  atkBonus: 0, buffCoef: 0, debuffPower: 0, healPower: 0, circle: 1, mageCorrect: 0,
  dmgTaken: 0, targetsHit: 0, pvpKills: 0, sermons: 0, fragments: 0, heals: 0, trainSwings: 0,
  kills: 0, reaperMulti: 0,
  /* 아이템 */
  bag: [], equip: emptyEquip(), uid: 1,
  /* PVP */
  aiDiff: 1, bestDiff: -1,
  /* 다중 맵 */
  map: 0, bestMap: 0,
})
/* ==================================================================
   아이템 생성
   ================================================================== */
/* exact=true 면 gradeMax를 "확정 등급"으로 쓴다 (드랍 판정이 이미 끝난 경우) */
function makeRune(save, gradeMax = MAX_GRADE, exact) {
  const opt = pick(RUNE_OPTS)
  const g = exact ? clampInt(gradeMax, 0, MAX_GRADE) : rollGrade(gradeMax)
  const gr = gradeOf(g)
  const value = +(opt.base * gr.mult).toFixed(1)
  return {
    uid: save.uid++, kind: 'rune', grade: g, stat: opt.key, value,
    name: `${RUNE_PREFIX[Math.min(3, g)]} ${opt.name} 룬`,
  }
}
function makeArmor(save, gradeMax = MAX_GRADE, exact) {
  const slot = pick(ARMOR_SLOTS)
  const setKey = pick(ARMOR_SET_KEYS)
  const g = exact ? clampInt(gradeMax, 0, MAX_GRADE) : rollGrade(gradeMax)
  const gr = gradeOf(g)
  const value = +(slot.base * gr.mult).toFixed(1)
  return {
    uid: save.uid++, kind: 'armor', grade: g, slot: slot.key, set: setKey,
    stat: slot.stat, value,
    name: `${ARMOR_SETS[setKey].name} ${slot.name}`,
  }
}
function makeWeapon(save, gradeMax = MAX_GRADE, wtypeForce, exact) {
  const wtype = wtypeForce || pick(WEAPON_KEYS)
  const wt = WEAPON_TYPES[wtype]
  const g = exact ? clampInt(gradeMax, 0, MAX_GRADE) : rollGrade(gradeMax)
  const gr = gradeOf(g)
  const atk = Math.round(wt.atk * gr.mult)
  return {
    uid: save.uid++, kind: 'weapon', grade: g, wtype, atk,
    name: `${gradeOf(g).name} ${wt.name}`,
  }
}
function makeArtifact(save, gradeMax = MAX_GRADE, exact) {
  const eff = pick(ARTIFACT_EFFECTS)
  const g = exact ? clampInt(gradeMax, 0, MAX_GRADE) : rollGrade(gradeMax)
  const gr = gradeOf(g)
  // 등급이 오를수록 기하급수적으로 강해진다
  const value = +(eff.base * gr.mult).toFixed(1)
  return {
    uid: save.uid++, kind: 'artifact', grade: g, eff: eff.key, stat: eff.stat, value,
    name: `${gradeOf(g).name} ${eff.name}`,
  }
}

/* 아이템 설명 문자열 */
function itemStatLine(it) {
  if (it.kind === 'weapon') return `공격력 +${it.atk}`
  if (it.kind === 'rune') {
    const o = RUNE_OPTS.find((r) => r.key === it.stat)
    return `${o.name} +${it.value}${o.unit}`
  }
  if (it.kind === 'armor') {
    const s = ARMOR_SLOT_BY_KEY[it.slot]
    return `${s.desc} +${it.value}${s.unit}`
  }
  const e = ARTIFACT_EFFECTS.find((a) => a.key === it.eff)
  return `${e.desc} +${it.value}${e.unit}`
}


/* ==================================================================
   스탯 집계 — 직업성장(+0.01) + 스킬 패시브 + 무기 + 방어구(세트) + 룬 + 아티팩트
   ================================================================== */
function emptyStats() {
  return {
    atk: 0, maxHp: BASE_HP, critRate: 5, critDmg: 150, moveSpd: 0, defense: 0,
    regen: 2, dmgReduce: 0, dodge: 0, goldGain: 0, expGain: 0,
    lifesteal: 0, thorns: 0, atkSpd: 0,
    skillRange: 0, skillDmg: 0,     // 티어3 패시브
  }
}
function addStat(st, key, v) { if (key in st) st[key] += v }

/* 직업 고유 성장 (기믹 1회 = +0.01) */
function classGrowth(cls, save) {
  switch (cls.id) {
    case 'swordsman': case 'warrior': case 'archer': case 'assassin': case 'reaper':
      return { atk: save.atkBonus, mult: 1 }
    case 'mage': return { atk: save.atkBonus, mult: 1.5 * (1 + (save.circle - 1) * 0.35) }
    case 'priest': return { atk: 0, mult: 1 + save.buffCoef }
    case 'moon': return { atk: save.debuffPower, mult: 1 }
    case 'healer': return { atk: save.healPower, mult: 0.5 }
    default: return { atk: 0, mult: 1 }
  }
}

function computeStats(cls, save) {
  const st = emptyStats()
  const eq = save.equip

  /* 1) 거미줄 특성 노드 (스킬은 이제 전부 액티브 — 패시브 없음) */
  for (let t = 1; t <= MAX_TIER; t++) {
    WEB_STATS[t - 1].forEach((s) => {
      const lv = save.skills[webStatId(cls.id, t, s.k)] || 0
      if (lv) addStat(st, s.stat, s.per * lv)
    })
  }

  /* 2) 무기 */
  if (eq.weapon) st.atk += eq.weapon.atk

  /* 3) 방어구 + 세트 시너지 */
  const setCount = {}
  ARMOR_SLOTS.forEach((s) => {
    const it = eq[s.key]
    if (!it) return
    addStat(st, it.stat, it.value)
    setCount[it.set] = (setCount[it.set] || 0) + 1
  })
  const activeSets = []
  Object.entries(setCount).forEach(([key, n]) => {
    const set = ARMOR_SETS[key]
    if (n >= 2) { addStat(st, set.b2.key, set.b2.value); activeSets.push({ key, n, tier: 2, label: set.b2.label }) }
    if (n >= 4) { addStat(st, set.b4.key, set.b4.value); activeSets.push({ key, n, tier: 4, label: set.b4.label }) }
  })

  /* 4) 룬 · 5) 아티팩트 */
  eq.runes.forEach((it) => { if (it) addStat(st, it.stat, it.value) })
  if (eq.artifact) addStat(st, eq.artifact.stat, eq.artifact.value)

  /* 6) 직업 성장 */
  const g = classGrowth(cls, save)
  st.atk += g.atk
  st.atk = (BASE_ATK + st.atk) * g.mult

  /* 어둠의 암살자는 전직하는 순간부터 이동속도가 영구히 +300% (사용자 확정) */
  if (cls.id === 'darkassassin') st.moveSpd += 300

  /* 7) 각성 패시브 극대화 */
  if (st.awakenAtk) st.atk *= (1 + st.awakenAtk)
  if (st.awakenHp) st.maxHp *= (1 + st.awakenHp)

  st.atk = Math.round(st.atk * 100) / 100
  st.maxHp = Math.round(st.maxHp)
  st.critRate = Math.min(100, st.critRate)
  st.dodge = Math.min(75, st.dodge)
  st.dmgReduce = Math.min(80, st.dmgReduce)
  st.setBonuses = activeSets
  st.awakened = (save.skills[`${cls.id}_t6`] || 0) > 0
  return st
}

const defReduce = (def) => def / (def + 100)

function rollDamage(st, mul = 1) {
  const crit = Math.random() * 100 < st.critRate
  const dmg = st.atk * mul * (1 + st.skillDmg) * (crit ? st.critDmg / 100 : 1)
  return { dmg: Math.max(1, Math.round(dmg)), crit }
}

/* 관리자 배율 — 기본 1배, 패널에서 켠 값만큼 적용된다.
   한 곳에서만 곱해서 모든 exp/골드/드랍 경로에 자동으로 반영되게 한다. */
const adminMul = (save, key) => (save.adminBoost && save.adminBoost[key]) || 1

/* 레벨업 — 튜토리얼 완료(unlocked) 전에는 경험치가 쌓이지 않는다 */
function applyExp(save, amount) {
  const events = []
  if (!save.unlocked) return events
  save.exp += Math.max(0, Math.round(amount * adminMul(save, 'exp')))
  while (save.level < MAX_LEVEL && save.exp >= EXP_FOR(save.level)) {
    save.exp -= EXP_FOR(save.level)
    save.level += 1
    save.sp += 1
    events.push(`⬆ 레벨 업! Lv.${save.level} — SP +1`)
    const nt = JOB_TIERS.find((t) => t.reqLv === save.level)
    if (nt && nt.tier > save.tier) events.push(`★ ${nt.title} 가능! 전직관을 찾아가세요`)
  }
  if (save.level >= MAX_LEVEL) save.exp = Math.min(save.exp, EXP_FOR(MAX_LEVEL))
  return events
}

/* 전직 가능 여부 */
function canAdvance(save) {
  if (save.tier >= MAX_TIER) return null
  const next = JOB_TIERS[save.tier + 1]
  return save.level >= next.reqLv ? next : null
}

/* ==================================================================
   수학 문제 (마법사)
   ================================================================== */
function makeMathProblem(circle) {
  const lv = clamp(circle, 1, 7)
  let a, b, op, ans, text
  if (lv <= 2) {
    a = 2 + Math.floor(Math.random() * (8 + lv * 4))
    b = 2 + Math.floor(Math.random() * (8 + lv * 4))
    op = Math.random() < 0.5 ? '+' : '-'
    if (op === '-' && b > a) { const t = a; a = b; b = t }
    ans = op === '+' ? a + b : a - b
    text = `${a} ${op} ${b}`
  } else if (lv <= 4) {
    a = 2 + Math.floor(Math.random() * (6 + lv * 2))
    b = 2 + Math.floor(Math.random() * 9)
    ans = a * b
    text = `${a} × ${b}`
  } else {
    a = 3 + Math.floor(Math.random() * (5 + lv))
    b = 2 + Math.floor(Math.random() * 9)
    const c = 1 + Math.floor(Math.random() * (10 + lv * 3))
    ans = a * b + c
    text = `${a} × ${b} + ${c}`
  }
  return { text, ans }
}
/* ==================================================================
   키보드 입력 — e.code (한글 IME에서도 안전)
   ================================================================== */
function useKeys() {
  const keys = useRef({ f: false, b: false, l: false, r: false, run: false })
  useEffect(() => {
    const MAP = {
      KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b',
      KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
      ShiftLeft: 'run', ShiftRight: 'run',
    }
    const onDown = (e) => {
      const k = MAP[e.code]; if (!k) return
      if (e.code.startsWith('Arrow')) e.preventDefault()
      keys.current[k] = true
    }
    const onUp = (e) => { const k = MAP[e.code]; if (k) keys.current[k] = false }
    const onBlur = () => { for (const k in keys.current) keys.current[k] = false }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
  return keys
}

/* ==================================================================
   휘두르기 자세
   ================================================================== */
const DEFAULT_POSE = { rest: -0.85, back: 1.95, chop: -1.15 }
const POSES = { scythe: { rest: -0.95, back: 2.2, chop: -1.4 } }
const poseOf = (wtype) => POSES[wtype] || DEFAULT_POSE
function swingAngleFor(pose, p) {
  if (p < 0.22) return lerp(pose.rest, pose.back, smooth(p / 0.22))
  if (p < 0.5) return lerp(pose.back, pose.chop, smooth((p - 0.22) / 0.28))
  return lerp(pose.chop, pose.rest, smooth((p - 0.5) / 0.5))
}

/* ==================================================================
   무기 모델 — 손(원점) 기준, 손잡이는 -Y로 뻗는다.
   장착한 무기의 wtype 으로 실시간 교체된다.
   ================================================================== */
const GOLD = { color: '#f2c14e', roughness: 0.3, metalness: 0.75 }
const BLADE = { color: '#eef3f8', roughness: 0.25, metalness: 0.45 }
const WOOD = { color: '#5b3a24', roughness: 0.85 }

function SwordW({ accent }) {
  return (
    <group>
      <mesh position={[0, 0.09, 0]} castShadow><sphereGeometry args={[0.075, 12, 10]} /><meshStandardMaterial {...GOLD} /></mesh>
      <mesh position={[0, -0.06, 0]} castShadow><cylinderGeometry args={[0.05, 0.05, 0.26, 10]} /><meshStandardMaterial {...WOOD} /></mesh>
      <mesh position={[0, -0.22, 0]} castShadow><boxGeometry args={[0.46, 0.08, 0.12]} /><meshStandardMaterial {...GOLD} /></mesh>
      <mesh position={[0, -0.5, 0]} castShadow><boxGeometry args={[0.14, 0.5, 0.045]} /><meshStandardMaterial color={accent || BLADE.color} roughness={0.25} metalness={0.45} /></mesh>
      <mesh position={[0, -0.83, 0]} rotation={[Math.PI, Math.PI / 4, 0]} castShadow><coneGeometry args={[0.099, 0.18, 4]} /><meshStandardMaterial {...BLADE} /></mesh>
    </group>
  )
}
function GreatswordW({ accent }) {
  return (
    <group>
      <mesh position={[0, 0.1, 0]} castShadow><sphereGeometry args={[0.09, 12, 10]} /><meshStandardMaterial {...GOLD} /></mesh>
      <mesh position={[0, -0.08, 0]} castShadow><cylinderGeometry args={[0.055, 0.055, 0.3, 10]} /><meshStandardMaterial {...WOOD} /></mesh>
      <mesh position={[0, -0.29, 0]} castShadow><boxGeometry args={[0.62, 0.1, 0.15]} /><meshStandardMaterial color="#8b95a3" roughness={0.4} metalness={0.7} /></mesh>
      <mesh position={[0, -0.29, 0.1]} castShadow><sphereGeometry args={[0.06, 12, 10]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} roughness={0.3} /></mesh>
      <mesh position={[0, -0.72, 0]} castShadow><boxGeometry args={[0.25, 0.68, 0.055]} /><meshStandardMaterial {...BLADE} /></mesh>
      <mesh position={[0, -1.17, 0]} rotation={[Math.PI, Math.PI / 4, 0]} castShadow><coneGeometry args={[0.177, 0.26, 4]} /><meshStandardMaterial {...BLADE} /></mesh>
    </group>
  )
}
function StaffW({ accent }) {
  return (
    <group>
      <mesh position={[0, -0.48, 0]} castShadow><cylinderGeometry args={[0.045, 0.055, 1.1, 10]} /><meshStandardMaterial color="#6b4b2a" roughness={0.85} /></mesh>
      <mesh position={[0, -1.12, 0]} castShadow><sphereGeometry args={[0.15, 20, 16]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.8} roughness={0.25} /></mesh>
      <mesh position={[0, -1.12, 0]} rotation-x={Math.PI / 2} castShadow><torusGeometry args={[0.21, 0.02, 8, 24]} /><meshStandardMaterial {...GOLD} /></mesh>
    </group>
  )
}
function BowW() {
  return (
    <group>
      <mesh position={[0, 0, -0.55]} rotation={[0, Math.PI / 2, Math.PI / 2]} castShadow><torusGeometry args={[0.55, 0.035, 8, 32, Math.PI]} /><meshStandardMaterial color="#7a5230" roughness={0.8} /></mesh>
      <mesh position={[0, 0, -0.55]} castShadow><cylinderGeometry args={[0.012, 0.012, 1.1, 6]} /><meshStandardMaterial color="#e5e7eb" roughness={0.4} /></mesh>
      <mesh castShadow><cylinderGeometry args={[0.05, 0.05, 0.24, 10]} /><meshStandardMaterial {...WOOD} /></mesh>
      <mesh position={[0, 0, -0.08]} rotation-x={Math.PI / 2} castShadow><cylinderGeometry args={[0.018, 0.018, 0.9, 6]} /><meshStandardMaterial color="#8a6a3f" roughness={0.8} /></mesh>
      <mesh position={[0, 0, 0.42]} rotation-x={Math.PI / 2} castShadow><coneGeometry args={[0.05, 0.14, 6]} /><meshStandardMaterial color="#c7ced6" metalness={0.7} roughness={0.3} /></mesh>
      <mesh position={[0, 0, -0.46]}><boxGeometry args={[0.025, 0.1, 0.12]} /><meshStandardMaterial color="#e0554e" roughness={0.7} /></mesh>
    </group>
  )
}
function DaggerW({ accent }) {
  return (
    <group>
      <mesh position={[0, 0.07, 0]} castShadow><sphereGeometry args={[0.055, 12, 10]} /><meshStandardMaterial color="#2f3744" roughness={0.5} metalness={0.6} /></mesh>
      <mesh position={[0, -0.05, 0]} castShadow><cylinderGeometry args={[0.045, 0.045, 0.2, 10]} /><meshStandardMaterial color="#2f3744" roughness={0.7} /></mesh>
      <mesh position={[0, -0.17, 0]} castShadow><boxGeometry args={[0.3, 0.06, 0.1]} /><meshStandardMaterial color="#8b95a3" roughness={0.4} metalness={0.7} /></mesh>
      <mesh position={[0, -0.36, 0]} castShadow><boxGeometry args={[0.11, 0.32, 0.04]} /><meshStandardMaterial color={accent || '#c7ced6'} roughness={0.2} metalness={0.9} /></mesh>
      <mesh position={[0, -0.56, 0]} rotation={[Math.PI, Math.PI / 4, 0]} castShadow><coneGeometry args={[0.078, 0.14, 4]} /><meshStandardMaterial color="#c7ced6" roughness={0.2} metalness={0.9} /></mesh>
    </group>
  )
}
function CrossW() {
  return (
    <group>
      <mesh position={[0, -0.09, 0]} castShadow><cylinderGeometry args={[0.04, 0.04, 0.22, 10]} /><meshStandardMaterial {...WOOD} /></mesh>
      <mesh position={[0, -0.52, 0]} castShadow><boxGeometry args={[0.11, 0.64, 0.07]} /><meshStandardMaterial {...GOLD} emissive="#f2c14e" emissiveIntensity={0.45} /></mesh>
      <mesh position={[0, -0.38, 0]} castShadow><boxGeometry args={[0.4, 0.11, 0.07]} /><meshStandardMaterial {...GOLD} emissive="#f2c14e" emissiveIntensity={0.45} /></mesh>
    </group>
  )
}
function MoonStaffW() {
  return (
    <group>
      <mesh position={[0, -0.46, 0]} castShadow><cylinderGeometry args={[0.04, 0.05, 1.05, 10]} /><meshStandardMaterial color="#3b4666" roughness={0.6} metalness={0.4} /></mesh>
      <mesh position={[0, -1.08, 0]} rotation-z={2.5} castShadow><torusGeometry args={[0.2, 0.05, 8, 28, 4.4]} /><meshStandardMaterial color="#dbe7ff" emissive="#7ea8ff" emissiveIntensity={0.8} roughness={0.3} /></mesh>
    </group>
  )
}
function WandW({ accent }) {
  return (
    <group>
      <mesh position={[0, -0.28, 0]} castShadow><cylinderGeometry args={[0.035, 0.035, 0.6, 10]} /><meshStandardMaterial color="#f8fafc" roughness={0.4} /></mesh>
      <mesh position={[0, -0.62, 0]} castShadow><sphereGeometry args={[0.09, 16, 12]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.9} roughness={0.25} /></mesh>
      <mesh position={[0, -0.62, 0]}><boxGeometry args={[0.22, 0.035, 0.035]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.6} /></mesh>
      <mesh position={[0, -0.62, 0]}><boxGeometry args={[0.035, 0.22, 0.035]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.6} /></mesh>
    </group>
  )
}
function ScytheW({ accent }) {
  /* 사신의 낫 — 주먹은 자루 아랫부분(날에서 1.45, 자루끝에서 0.5)을 쥔다.
     날은 자루 끝(-1.42)에 90도로, 휘두르는 평면(YZ)에 눕혀 앞을 벤다. */
  return (
    <group>
      <mesh position={[0, -0.475, 0]} castShadow><cylinderGeometry args={[0.042, 0.05, 1.95, 12]} /><meshStandardMaterial color="#6b4a2b" roughness={0.85} /></mesh>
      <mesh position={[0, 0.5, 0]} castShadow><cylinderGeometry args={[0.055, 0.045, 0.08, 10]} /><meshStandardMaterial color="#3a2a18" roughness={0.8} /></mesh>
      <mesh position={[0, 0, 0.001]} castShadow><cylinderGeometry args={[0.055, 0.055, 0.22, 10]} /><meshStandardMaterial color="#2f2318" roughness={0.95} /></mesh>
      <mesh position={[0, -0.34, 0]} castShadow><cylinderGeometry args={[0.052, 0.052, 0.16, 10]} /><meshStandardMaterial color="#2f2318" roughness={0.95} /></mesh>
      <mesh position={[0, -1.36, 0]} castShadow><cylinderGeometry args={[0.065, 0.07, 0.14, 10]} /><meshStandardMaterial color="#2f3744" roughness={0.4} metalness={0.7} /></mesh>
      <mesh position={[0, -1.36, 0]} castShadow><sphereGeometry args={[0.055, 12, 10]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} roughness={0.3} /></mesh>
      <group position={[0, -1.42, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0.62, 0, 0]} rotation-z={Math.PI - 1.6} scale={[1, 1, 0.22]} castShadow>
          <torusGeometry args={[0.62, 0.055, 8, 40, 1.6]} /><meshStandardMaterial color="#c9d3dd" roughness={0.22} metalness={0.8} />
        </mesh>
        <mesh position={[0.62, 0, 0]} rotation-z={Math.PI - 1.58} scale={[1, 1, 0.22]}>
          <torusGeometry args={[0.585, 0.018, 6, 40, 1.56]} /><meshStandardMaterial color="#ffffff" roughness={0.15} metalness={0.6} />
        </mesh>
      </group>
    </group>
  )
}
const WEAPON_MODELS = {
  sword: SwordW, greatsword: GreatswordW, staff: StaffW, bow: BowW,
  dagger: DaggerW, cross: CrossW, moonstaff: MoonStaffW, wand: WandW, scythe: ScytheW,
}


/* ==================================================================
   각성 오라 — 6차 전직(각성) 시 캐릭터 이펙트 변화
   ================================================================== */
function AwakenAura({ color }) {
  const ring = useRef(); const ring2 = useRef(); const orbs = useRef()
  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1)
    const t = state.clock.elapsedTime
    if (ring.current) { ring.current.rotation.z += dt * 1.4; ring.current.material.opacity = 0.5 + Math.sin(t * 3) * 0.2 }
    if (ring2.current) { ring2.current.rotation.z -= dt * 2.1; ring2.current.material.opacity = 0.4 + Math.sin(t * 4) * 0.2 }
    if (orbs.current) { orbs.current.rotation.y += dt * 1.6; orbs.current.position.y = 1.3 + Math.sin(t * 2) * 0.18 }
  })
  return (
    <group>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.06, 0]}>
        <ringGeometry args={[1.15, 1.5, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={ring2} rotation-x={-Math.PI / 2} position={[0, 0.09, 0]}>
        <ringGeometry args={[0.75, 0.95, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <group ref={orbs} position={[0, 1.3, 0]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[Math.cos(i * 1.256) * 1.25, Math.sin(i * 2.1) * 0.35, Math.sin(i * 1.256) * 1.25]}>
            <octahedronGeometry args={[0.14]} />
            <meshBasicMaterial color={color} transparent opacity={0.95} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <pointLight color={color} intensity={7} distance={9} position={[0, 1.4, 0]} />
    </group>
  )
}

/* ==================================================================
   캐릭터 몸체 — 플레이어와 PVP 봇이 공유. wtype으로 무기 실시간 교체.
   ================================================================== */
function CharacterBody({ cls, wtype, armPivot, tint, gradeColor, awakened }) {
  const steel = tint ? { color: '#b45a5a', roughness: 0.45, metalness: 0.55 } : { color: '#9fb3c8', roughness: 0.45, metalness: 0.55 }
  const dark = { color: '#3d4a5c', roughness: 0.6, metalness: 0.3 }
  const W = WEAPON_MODELS[wtype] || SwordW
  const bodyColor = tint ? '#7f1d1d' : cls.color
  const accent = gradeColor || cls.color
  return (
    <>
      {awakened && <AwakenAura color={cls.color} />}
      <RoundedBox args={[0.34, 0.72, 0.36]} radius={0.07} smoothness={3} position={[-0.24, 0.36, 0]} castShadow><meshStandardMaterial {...dark} /></RoundedBox>
      <RoundedBox args={[0.34, 0.72, 0.36]} radius={0.07} smoothness={3} position={[0.24, 0.36, 0]} castShadow><meshStandardMaterial {...dark} /></RoundedBox>
      <RoundedBox args={[0.95, 0.95, 0.55]} radius={0.12} smoothness={3} position={[0, 1.2, 0]} castShadow>
        <meshStandardMaterial color={bodyColor} roughness={0.5} metalness={0.25}
          emissive={awakened ? cls.color : '#000000'} emissiveIntensity={awakened ? 0.5 : 0} />
      </RoundedBox>
      <mesh position={[0, 1.22, 0.29]} castShadow><boxGeometry args={[0.26, 0.34, 0.04]} /><meshStandardMaterial {...GOLD} /></mesh>
      <mesh position={[0, 1.76, 0]} castShadow><cylinderGeometry args={[0.16, 0.18, 0.16, 12]} /><meshStandardMaterial {...dark} /></mesh>
      <RoundedBox args={[0.62, 0.6, 0.6]} radius={0.14} smoothness={4} position={[0, 2.14, 0]} castShadow><meshStandardMaterial {...steel} /></RoundedBox>
      <mesh position={[0, 2.14, 0.31]}><boxGeometry args={[0.42, 0.1, 0.03]} /><meshStandardMaterial color="#10151f" /></mesh>
      <mesh position={[0, 2.56, -0.04]} rotation-x={0.25} castShadow>
        <coneGeometry args={[0.11, awakened ? 0.62 : 0.42, 8]} />
        <meshStandardMaterial color={cls.color} roughness={0.7} emissive={awakened ? cls.color : '#000000'} emissiveIntensity={awakened ? 0.8 : 0} />
      </mesh>
      <group position={[-0.62, 1.55, 0]} rotation-x={-0.2}>
        <RoundedBox args={[0.26, 0.78, 0.26]} radius={0.08} smoothness={3} position={[0, -0.36, 0]} castShadow><meshStandardMaterial {...steel} /></RoundedBox>
      </group>
      <group ref={armPivot} position={[0.62, 1.55, 0]}>
        <RoundedBox args={[0.26, 0.78, 0.26]} radius={0.08} smoothness={3} position={[0, -0.36, 0]} castShadow><meshStandardMaterial {...steel} /></RoundedBox>
        <mesh position={[0, -0.8, 0.02]} castShadow><boxGeometry args={[0.22, 0.18, 0.24]} /><meshStandardMaterial color="#6b5a44" roughness={0.8} /></mesh>
        <group position={[0, -0.86, 0.03]}><W accent={accent} /></group>
      </group>
    </>
  )
}

/* ==================================================================
   플레이어 — 카메라 기준 이동 + 우클릭 오빗 카메라 + 무기 스윙
   튜토리얼 중에는 마을 반경(TUTORIAL_RADIUS) 밖으로 나갈 수 없다.
   ================================================================== */
function Player({ cls, wtype, gradeColor, awakened, swing, world, live, camRef, controlRef, statsRef }) {
  const root = useRef()
  const armPivot = useRef()
  const keys = useKeys()
  const camera = useThree((s) => s.camera)
  const pose = poseOf(wtype)

  const vel = useMemo(() => new THREE.Vector3(), [])
  const want = useMemo(() => new THREE.Vector3(), [])
  const camGoal = useMemo(() => new THREE.Vector3(), [])
  const lookAt = useMemo(() => new THREE.Vector3(), [])
  const yaw = useRef(0)
  const snapped = useRef(false)

  useFrame((state, rawDelta) => {
    const g = root.current
    if (!g) return
    const dt = Math.min(rawDelta, 0.1)
    const k = keys.current
    const L = live.current
    const cam = camRef.current
    const st = statsRef.current

    const tp = world.current.teleport
    if (tp) {
      g.position.set(tp.x, 0, tp.z)
      if (tp.yaw != null) yaw.current = tp.yaw
      vel.set(0, 0, 0)
      snapped.current = false
      world.current.teleport = null
    }

    const cy = cam.yaw
    const fwdX = -Math.sin(cy), fwdZ = -Math.cos(cy)
    const rgtX = Math.cos(cy), rgtZ = -Math.sin(cy)
    const locked = L.dead || controlRef.current.lock
    let ix = 0, iz = 0
    if (!locked) {
      /* 키보드 + 터치 조이스틱 (조이스틱은 아날로그) */
      const fwd = clamp((k.f ? 1 : 0) - (k.b ? 1 : 0) - TOUCH.my, -1, 1)
      const str = clamp((k.r ? 1 : 0) - (k.l ? 1 : 0) + TOUCH.mx, -1, 1)
      ix = fwdX * fwd + rgtX * str
      iz = fwdZ * fwd + rgtZ * str
    }
    /* 돌진 스킬 — 카메라가 보는 방향으로 즉시 파고든다 */
    if (L.dashReq) {
      const dist = L.dashReq.dist || 4.5
      L.dashReq = null
      g.position.x = clamp(g.position.x + fwdX * dist, -world.current.half, world.current.half)
      g.position.z = clamp(g.position.z + fwdZ * dist, -world.current.half, world.current.half)
      vel.set(fwdX * 6, 0, fwdZ * 6)
    }

    const burstActive = L.burst && performance.now() < L.burst.until
    if (L.burst && !burstActive) L.burst = null
    const spdMul = 1 + (st.moveSpd || 0) / 100 + buffSum(L, 'spdP') / 100 + (burstActive ? 5 : 0)
    want.set(ix, 0, iz)
    const mag = Math.min(1, want.length())
    if (mag > 0.001) want.normalize().multiplyScalar((k.run || TOUCH.run ? RUN_SPEED : WALK_SPEED) * spdMul * mag)
    else want.set(0, 0, 0)
    vel.lerp(want, damp(ACCEL, dt))

    g.position.addScaledVector(vel, dt)
    const half = world.current.half
    g.position.x = clamp(g.position.x, -half, half)
    g.position.z = clamp(g.position.z, -half, half)
    /* 튜토리얼 중 맵 탐험 잠금 — 마을 반경 안으로 되돌린다 */
    if (world.current.tutorLock) {
      const d = Math.hypot(g.position.x, g.position.z)
      if (d > TUTORIAL_RADIUS) {
        g.position.x = (g.position.x / d) * TUTORIAL_RADIUS
        g.position.z = (g.position.z / d) * TUTORIAL_RADIUS
        if (!L.edgeWarn || performance.now() - L.edgeWarn > 3000) {
          L.edgeWarn = performance.now()
          if (world.current.onEdge) world.current.onEdge()
        }
      }
    }

    const speed = vel.length()
    if (speed > 0.4) yaw.current = dampAngle(yaw.current, Math.atan2(vel.x, vel.z), TURN_LAMBDA, dt)
    g.rotation.y = yaw.current
    g.rotation.x = L.dead ? lerp(g.rotation.x, -Math.PI / 2 + 0.2, damp(6, dt)) : lerp(g.rotation.x, 0, damp(10, dt))

    const s = swing.current
    const swingTime = SWING_TIME / (1 + (st.atkSpd || 0) / 100)
    if (armPivot.current) {
      if (s.t >= 0) {
        s.t += dt
        if (!s.hitDone && s.t >= IMPACT_AT * (swingTime / SWING_TIME)) { s.hitDone = true; if (s.impact) s.impact() }
        const p = s.t / swingTime
        if (p >= 1) { s.t = -1; armPivot.current.rotation.x = pose.rest }
        else armPivot.current.rotation.x = swingAngleFor(pose, p)
      } else {
        armPivot.current.rotation.x = pose.rest + Math.sin(state.clock.elapsedTime * 1.6) * 0.05
      }
    }

    const wp = world.current.player
    wp.x = g.position.x; wp.z = g.position.z; wp.yaw = yaw.current

    /* 관전 중이면 카메라만 상대에게 옮긴다 (관리자 기능) */
    const spec = world.current.spectate ? world.current.peers.get(world.current.spectate) : null
    const fx2 = spec ? (spec.rx ?? spec.x) : g.position.x
    const fy2 = spec ? 0 : g.position.y
    const fz2 = spec ? (spec.rz ?? spec.z) : g.position.z

    const horiz = Math.cos(cam.pitch) * CAM_DIST
    camGoal.set(
      fx2 + Math.sin(cy) * horiz,
      fy2 + LOOK_HEIGHT + Math.sin(cam.pitch) * CAM_DIST,
      fz2 + Math.cos(cy) * horiz,
    )
    if (!snapped.current) { camera.position.copy(camGoal); snapped.current = true }
    else camera.position.lerp(camGoal, damp(CAM_LAMBDA, dt))
    lookAt.set(fx2, fy2 + LOOK_HEIGHT, fz2)
    camera.lookAt(lookAt)
  })

  return (
    <group ref={root}>
      <CharacterBody cls={cls} wtype={wtype} armPivot={armPivot} tint={false} gradeColor={gradeColor} awakened={awakened} />
    </group>
  )
}

/* ==================================================================
   다른 플레이어 — 네트워크로 받은 좌표를 향해 부드럽게 따라간다.

   초당 15번만 위치를 받으므로 그대로 그리면 뚝뚝 끊겨 보인다.
   damp()로 보간해 60fps처럼 움직이게 만든다.
   ================================================================== */

/* 이름표를 캔버스로 그려 텍스처로 쓴다 — 폰트 파일을 받아올 필요가 없다 */
function makeLabelTexture(text) {
  const font = 'bold 44px system-ui, -apple-system, sans-serif'
  const measure = document.createElement('canvas').getContext('2d')
  measure.font = font
  const w = Math.min(420, Math.ceil(measure.measureText(text).width) + 28)
  const c = document.createElement('canvas')
  c.width = Math.max(8, w); c.height = 64
  const g = c.getContext('2d')
  g.font = font
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillStyle = 'rgba(8,12,24,.62)'
  g.beginPath(); g.roundRect(0, 0, c.width, c.height, 14); g.fill()
  g.fillStyle = '#ffffff'
  g.fillText(text, c.width / 2, c.height / 2 + 2)
  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  return { tex, aspect: c.width / c.height }
}

function RemotePlayer({ peerId, nick, clsId, wtype, world }) {
  const root = useRef()
  const armPivot = useRef()
  const hpFg = useRef()
  const cls = CLASS_BY_ID[clsId] || CLASSES[0]
  const pose = poseOf(wtype || cls.weapon)
  const swingT = useRef(-1)
  const label = useMemo(() => makeLabelTexture(nick || '???'), [nick])
  useEffect(() => () => label.tex.dispose(), [label])

  useFrame((state, rawDelta) => {
    const g = root.current
    if (!g) return
    const dt = Math.min(rawDelta, 0.1)
    const p = world.current.peers.get(peerId)
    /* 은신 중인 어둠의 암살자는 남에게 보이지 않는다 */
    if (!p || p.stealth) { g.visible = false; return }
    g.visible = true

    /* 수신 좌표를 향해 보간 — 15Hz 입력을 60fps로 펴준다 */
    p.rx = lerp(p.rx ?? p.x, p.x, damp(11, dt))
    p.rz = lerp(p.rz ?? p.z, p.z, damp(11, dt))
    p.ryaw = dampAngle(p.ryaw ?? p.yaw, p.yaw, 10, dt)

    g.position.x = p.rx
    g.position.z = p.rz
    g.position.y = p.dead ? 0 : Math.abs(Math.sin(state.clock.elapsedTime * 3)) * 0.04
    g.rotation.y = p.ryaw
    /* 쓰러진 모습 */
    g.rotation.x = p.dead
      ? lerp(g.rotation.x, -Math.PI / 2 + 0.2, damp(6, dt))
      : lerp(g.rotation.x, 0, damp(10, dt))

    if (hpFg.current && p.maxHp > 0) {
      const r = clamp(p.hp / p.maxHp, 0, 1)
      hpFg.current.scale.x = Math.max(0.001, r)
      hpFg.current.position.x = -0.6 * (1 - r)
      hpFg.current.material.color.set(r > 0.6 ? '#4ade80' : r > 0.34 ? '#facc15' : '#f87171')
    }

    /* 공격 모션 — 상대가 휘둘렀다는 신호를 받으면 한 번 재생 */
    if (p.swingSeq !== p.playedSeq) { p.playedSeq = p.swingSeq; swingT.current = 0 }
    if (armPivot.current) {
      if (swingT.current >= 0) {
        swingT.current += dt
        const q = swingT.current / SWING_TIME
        if (q >= 1) { swingT.current = -1; armPivot.current.rotation.x = pose.rest }
        else armPivot.current.rotation.x = swingAngleFor(pose, q)
      } else {
        armPivot.current.rotation.x = pose.rest + Math.sin(state.clock.elapsedTime * 1.6) * 0.05
      }
    }
  })

  return (
    <group ref={root}>
      <CharacterBody cls={cls} wtype={wtype || cls.weapon} armPivot={armPivot} tint={false} />
      <Billboard position={[0, 3.05, 0]}>
        {/* 이름표 */}
        <mesh position={[0, 0.3, 0]}>
          <planeGeometry args={[label.aspect * 0.42, 0.42]} />
          <meshBasicMaterial map={label.tex} transparent depthWrite={false} />
        </mesh>
        {/* HP바 */}
        <mesh><planeGeometry args={[1.25, 0.16]} /><meshBasicMaterial color="#111827" transparent opacity={0.85} /></mesh>
        <mesh ref={hpFg} position={[0, 0, 0.001]}><planeGeometry args={[1.2, 0.1]} /><meshBasicMaterial color="#4ade80" /></mesh>
      </Billboard>
    </group>
  )
}

/* 같은 맵에 있는 접속자만 그린다 */
function RemotePlayers({ roster, world }) {
  return roster.map((p) => (
    <RemotePlayer key={p.id} peerId={p.id} nick={p.nick} clsId={p.cls} wtype={p.wtype} world={world} />
  ))
}

/* ==================================================================
   잔상 — 어둠의 암살자가 남기는 "흐릿한 자기 자신"

   world.current.afterimages 배열을 매 프레임 읽어 고정 풀에 그린다.
   React state를 쓰면 10개가 동시에 뜨고 사라질 때 리렌더가 몰리므로,
   ref 배열 + useFrame으로 처리한다.

   entry = { x, z, yaw, born, life,
             cx, cz, a, r0 }   ← cx가 있으면 중심으로 파고드는 돌진 잔상
   ================================================================== */
const AFTERIMAGE_POOL = 12

function AfterimageSlot({ index, world, cls, wtype }) {
  const root = useRef()
  const armPivot = useRef()
  const mats = useRef(null)

  useFrame((state, rawDelta) => {
    const g = root.current
    if (!g) return
    /* 재질은 인스턴스마다 새로 만들어지므로 한 번만 모아서 반투명으로 바꾼다 */
    if (!mats.current) {
      const list = []
      g.traverse((o) => {
        if (!o.isMesh || !o.material) return
        const m = o.material
        m.transparent = true
        m.depthWrite = false
        if (m.emissive) { m.emissive.set('#7c3aed'); m.emissiveIntensity = 0.45 }
        list.push(m)
      })
      mats.current = list
    }

    const e = world.current.afterimages[index]
    if (!e) { if (g.visible) g.visible = false; return }

    const t = (performance.now() - e.born) / e.life        // 0 → 1
    if (t >= 1) { if (g.visible) g.visible = false; return }
    g.visible = true

    if (e.cx != null) {
      /* 돌진 잔상 — 원주에서 중심으로 파고든다 */
      const r = e.r0 * (1 - t)
      g.position.x = e.cx + Math.cos(e.a) * r
      g.position.z = e.cz + Math.sin(e.a) * r
      g.rotation.y = -e.a + Math.PI / 2                    // 중심을 바라본다
    } else {
      g.position.x = e.x
      g.position.z = e.z
      g.rotation.y = e.yaw
    }
    /* 나타날 때 살짝 떠오르고, 사라질 때 흐려진다 */
    g.position.y = Math.sin(state.clock.elapsedTime * 3 + index) * 0.04
    const op = 0.42 * (1 - t * t)
    for (const m of mats.current) m.opacity = op
    void rawDelta
  })

  return (
    <group ref={root} visible={false}>
      <CharacterBody cls={cls} wtype={wtype} armPivot={armPivot} tint={false} />
    </group>
  )
}

function Afterimages({ world, cls, wtype }) {
  return Array.from({ length: AFTERIMAGE_POOL }, (_, i) => (
    <AfterimageSlot key={i} index={i} world={world} cls={cls} wtype={wtype} />
  ))
}

/* ==================================================================
   네트워크 펌프 — 주기적으로 내 상태를 보내고, 호스트면 몬스터 상태를 뿌린다.

   [왜 useFrame이 아니라 타이머인가]
   브라우저는 배경 탭의 requestAnimationFrame을 아예 멈춘다. 렌더 루프에
   네트워크를 얹으면 호스트가 다른 탭을 보는 순간 모두의 세계가 정지한다.
   타이머는 배경에서 느려질 뿐 멈추지 않으므로 방이 유지된다.
   전송 주기가 프레임률에 좌우되지 않는다는 점도 이쪽이 옳다.
   ================================================================== */
function useNetPump({ world, live, netRef, mapIdRef, modeRef, identityRef, onMobList, onRoster, onSweep, active }) {
  const cbRef = useRef({})
  cbRef.current = { onMobList, onRoster, onSweep }

  useEffect(() => {
    if (!active) return
    const r2 = (v) => Math.round(v * 100) / 100

    const sendState = () => {
      const net = netRef.current
      if (!net) return
      const w = world.current
      const id = identityRef.current
      net.room.send({
        t: 'state',
        x: r2(w.player.x), z: r2(w.player.z), yaw: r2(w.player.yaw),
        mapId: mapIdRef.current, md: modeRef.current, in: w.inst || undefined,
        hp: Math.round(live.current.hp), maxHp: Math.round(live.current.maxHp),
        dead: !!live.current.dead,
        nick: id.nick, cls: id.cls, wtype: id.wtype,
        sw: net.swingSeq | 0,
        /* 은신 중이면 남들 화면에서 사라진다 (어둠의 암살자) */
        hid: live.current.stealth ? 1 : undefined,
      })
    }

    const pumpMobs = () => {
      const net = netRef.current
      if (!net) return
      if (net.simOwner) {
        /* 내 zone의 몬스터 진실은 내가 갖고 있다.
           투기장(AI전)에서는 필드 몬스터가 언마운트되므로 빈 목록을
           보내지 않는다 — 팔로워는 마지막 상태로 멈춰서 기다린다. */
        if (modeRef.current === 'arena') return
        net.room.send({
          t: 'mobs', mapId: mapIdRef.current, in: world.current.inst || undefined,
          list: encodeMobs(world.current.mobs),
        })
      } else if (net.pendingMobs) {
        /* 팔로워 — 구성이 바뀌었을 때만 컴포넌트를 다시 만든다 */
        const list = net.pendingMobs
        net.pendingMobs = null
        cbRef.current.onMobList(list)
      }
    }

    /* 내 zone의 시뮬 소유자 판정.
       필드 = 같은 맵 필드에 있는 사람 중 방에 가장 먼저 들어온 사람.
       인스턴스(던전/레이드) = 파티장. 모두가 같은 데이터로 같은 답을 낸다. */
    const computeSimOwner = () => {
      const net = netRef.current
      if (!net) return
      const w = world.current
      if (w.inst) { net.simOwner = w.instLeader === net.myId; return }
      if (modeRef.current !== 'field') { net.simOwner = false; return }
      const eligible = new Set([net.myId])
      for (const p of w.peers.values()) {
        if (!p.inst && !p.arena && p.md === 'field' && p.mapId === mapIdRef.current) eligible.add(p.peerId)
      }
      let best = null
      for (const m of net.room.members()) {
        if (!eligible.has(m.id)) continue
        if (!best || m.joinedAt < best.joinedAt || (m.joinedAt === best.joinedAt && m.id < best.id)) best = m
      }
      net.simOwner = !best || best.id === net.myId
    }

    const sweep = () => {
      if (!netRef.current) return
      const now = performance.now()
      const peers = world.current.peers
      for (const [id, p] of peers) if (now - p.at > PEER_TIMEOUT) peers.delete(id)
      computeSimOwner()
      cbRef.current.onRoster()
      cbRef.current.onSweep?.()
    }

    const a = setInterval(sendState, 1000 / NET_STATE_HZ)
    const b = setInterval(pumpMobs, 1000 / NET_MOB_HZ)
    const c = setInterval(sweep, 400)
    return () => { clearInterval(a); clearInterval(b); clearInterval(c) }
  }, [active, world, live, netRef, mapIdRef, modeRef, identityRef])
}

/* ==================================================================
   몬스터 — 맵마다 종류·레벨·스펙이 다르다.
   토끼는 비공격, 나머지는 플레이어를 추격해 공격하는 AI를 가진다.
   ================================================================== */
function MobModel({ type, mat, ears, inner }) {
  if (type === 'rabbit') {
    return (
      <group ref={inner} position={[0, 0.42, 0]}>
        <mesh material={mat} castShadow scale={[1, 0.92, 1.08]}><sphereGeometry args={[0.42, 20, 16]} /></mesh>
        <group ref={ears} position={[0, 0.3, -0.06]}>
          <mesh material={mat} castShadow position={[-0.15, 0.34, 0]} scale={[0.9, 2.4, 0.55]}><sphereGeometry args={[0.13, 12, 10]} /></mesh>
          <mesh material={mat} castShadow position={[0.15, 0.34, 0]} scale={[0.9, 2.4, 0.55]}><sphereGeometry args={[0.13, 12, 10]} /></mesh>
        </group>
        <mesh position={[-0.15, 0.1, 0.36]}><sphereGeometry args={[0.05, 8, 6]} /><meshStandardMaterial color="#1c2430" /></mesh>
        <mesh position={[0.15, 0.1, 0.36]}><sphereGeometry args={[0.05, 8, 6]} /><meshStandardMaterial color="#1c2430" /></mesh>
      </group>
    )
  }
  if (type === 'goblin') {
    return (
      <group ref={inner} position={[0, 0.5, 0]}>
        <mesh material={mat} castShadow scale={[1, 1.1, 0.8]}><sphereGeometry args={[0.38, 14, 12]} /></mesh>
        <mesh material={mat} castShadow position={[0, 0.62, 0]}><sphereGeometry args={[0.3, 14, 12]} /></mesh>
        {/* 큰 귀 */}
        <mesh material={mat} castShadow position={[-0.32, 0.66, 0]} rotation-z={0.7} scale={[0.5, 1, 0.35]}><coneGeometry args={[0.16, 0.42, 6]} /></mesh>
        <mesh material={mat} castShadow position={[0.32, 0.66, 0]} rotation-z={-0.7} scale={[0.5, 1, 0.35]}><coneGeometry args={[0.16, 0.42, 6]} /></mesh>
        <mesh position={[-0.11, 0.68, 0.25]}><sphereGeometry args={[0.05, 8, 6]} /><meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.7} /></mesh>
        <mesh position={[0.11, 0.68, 0.25]}><sphereGeometry args={[0.05, 8, 6]} /><meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.7} /></mesh>
        {/* 몽둥이 */}
        <mesh castShadow position={[0.42, 0.05, 0.16]} rotation-z={-0.5}><cylinderGeometry args={[0.06, 0.08, 0.75, 6]} /><meshStandardMaterial color="#6b4b2a" roughness={0.9} /></mesh>
        {/* 다리 */}
        <mesh material={mat} castShadow position={[-0.16, -0.44, 0]}><cylinderGeometry args={[0.09, 0.09, 0.36, 6]} /></mesh>
        <mesh material={mat} castShadow position={[0.16, -0.44, 0]}><cylinderGeometry args={[0.09, 0.09, 0.36, 6]} /></mesh>
      </group>
    )
  }
  if (type === 'wolf') {
    return (
      <group ref={inner} position={[0, 0.55, 0]}>
        <mesh material={mat} castShadow scale={[1, 0.85, 1.7]}><sphereGeometry args={[0.42, 16, 12]} /></mesh>
        <mesh material={mat} castShadow position={[0, 0.16, 0.7]} scale={[0.8, 0.8, 0.9]}><sphereGeometry args={[0.3, 14, 12]} /></mesh>
        <mesh material={mat} castShadow position={[0, 0.02, 1.02]} scale={[0.6, 0.5, 1]}><coneGeometry args={[0.16, 0.36, 8]} rotation-x={Math.PI / 2} /></mesh>
        <mesh material={mat} castShadow position={[-0.16, 0.42, 0.62]} rotation-z={0.3} scale={[0.5, 1, 0.4]}><coneGeometry args={[0.12, 0.3, 6]} /></mesh>
        <mesh material={mat} castShadow position={[0.16, 0.42, 0.62]} rotation-z={-0.3} scale={[0.5, 1, 0.4]}><coneGeometry args={[0.12, 0.3, 6]} /></mesh>
        <mesh position={[-0.13, 0.22, 0.92]}><sphereGeometry args={[0.05, 8, 6]} /><meshStandardMaterial color="#facc15" emissive="#eab308" emissiveIntensity={0.9} /></mesh>
        <mesh position={[0.13, 0.22, 0.92]}><sphereGeometry args={[0.05, 8, 6]} /><meshStandardMaterial color="#facc15" emissive="#eab308" emissiveIntensity={0.9} /></mesh>
        <mesh material={mat} castShadow position={[0, 0.1, -0.85]} rotation-x={-0.6}><cylinderGeometry args={[0.06, 0.12, 0.6, 6]} /></mesh>
        {[[-0.24, 0.46], [0.24, 0.46], [-0.24, -0.42], [0.24, -0.42]].map(([x, z], i) => (
          <mesh key={i} material={mat} castShadow position={[x, -0.44, z]}><cylinderGeometry args={[0.08, 0.07, 0.42, 6]} /></mesh>
        ))}
      </group>
    )
  }
  if (type === 'imp') {
    return (
      <group ref={inner} position={[0, 0.9, 0]}>
        <mesh material={mat} castShadow><sphereGeometry args={[0.38, 16, 12]} /></mesh>
        <mesh material={mat} castShadow position={[-0.2, 0.34, 0]} rotation-z={0.5}><coneGeometry args={[0.08, 0.32, 6]} /></mesh>
        <mesh material={mat} castShadow position={[0.2, 0.34, 0]} rotation-z={-0.5}><coneGeometry args={[0.08, 0.32, 6]} /></mesh>
        <mesh position={[-0.12, 0.06, 0.31]}><sphereGeometry args={[0.06, 8, 6]} /><meshBasicMaterial color="#fff3c4" /></mesh>
        <mesh position={[0.12, 0.06, 0.31]}><sphereGeometry args={[0.06, 8, 6]} /><meshBasicMaterial color="#fff3c4" /></mesh>
        {/* 날개 */}
        <mesh material={mat} castShadow position={[-0.44, 0.08, -0.1]} rotation-y={0.6} scale={[1, 1, 0.16]}><coneGeometry args={[0.3, 0.62, 4]} /></mesh>
        <mesh material={mat} castShadow position={[0.44, 0.08, -0.1]} rotation-y={-0.6} scale={[1, 1, 0.16]}><coneGeometry args={[0.3, 0.62, 4]} /></mesh>
        <pointLight color="#f97316" intensity={3} distance={4} />
      </group>
    )
  }
  if (type === 'wraith') {
    return (
      <group ref={inner} position={[0, 1.0, 0]}>
        {/* 후드 */}
        <mesh material={mat} castShadow position={[0, 0.28, 0]}><coneGeometry args={[0.42, 0.7, 10]} /></mesh>
        <mesh material={mat} castShadow position={[0, -0.3, 0]}><coneGeometry args={[0.5, 1.1, 10]} rotation-x={Math.PI} /></mesh>
        {/* 빛나는 눈 */}
        <mesh position={[-0.11, 0.2, 0.28]}><sphereGeometry args={[0.055, 8, 6]} /><meshBasicMaterial color="#e9d5ff" /></mesh>
        <mesh position={[0.11, 0.2, 0.28]}><sphereGeometry args={[0.055, 8, 6]} /><meshBasicMaterial color="#e9d5ff" /></mesh>
        {/* 유령 팔 */}
        <mesh material={mat} castShadow position={[-0.46, 0.02, 0.06]} rotation-z={0.6}><cylinderGeometry args={[0.06, 0.03, 0.55, 6]} /></mesh>
        <mesh material={mat} castShadow position={[0.46, 0.02, 0.06]} rotation-z={-0.6}><cylinderGeometry args={[0.06, 0.03, 0.55, 6]} /></mesh>
        <pointLight color="#a855f7" intensity={4} distance={5} />
      </group>
    )
  }
  /* drake */
  return (
    <group ref={inner} position={[0, 0.8, 0]}>
      <mesh material={mat} castShadow scale={[1, 0.9, 1.6]}><sphereGeometry args={[0.52, 16, 12]} /></mesh>
      <mesh material={mat} castShadow position={[0, 0.3, 0.78]} scale={[0.8, 0.8, 1]}><sphereGeometry args={[0.34, 14, 12]} /></mesh>
      <mesh material={mat} castShadow position={[0, 0.18, 1.16]} rotation-x={Math.PI / 2} scale={[0.7, 1, 0.6]}><coneGeometry args={[0.2, 0.44, 8]} /></mesh>
      <mesh material={mat} castShadow position={[-0.16, 0.56, 0.72]} rotation-z={0.4}><coneGeometry args={[0.07, 0.3, 6]} /></mesh>
      <mesh material={mat} castShadow position={[0.16, 0.56, 0.72]} rotation-z={-0.4}><coneGeometry args={[0.07, 0.3, 6]} /></mesh>
      <mesh position={[-0.15, 0.36, 1.0]}><sphereGeometry args={[0.06, 8, 6]} /><meshBasicMaterial color="#fde68a" /></mesh>
      <mesh position={[0.15, 0.36, 1.0]}><sphereGeometry args={[0.06, 8, 6]} /><meshBasicMaterial color="#fde68a" /></mesh>
      {/* 날개 */}
      <mesh material={mat} castShadow position={[-0.8, 0.42, -0.1]} rotation={[0, 0.5, 0.35]} scale={[1, 1, 0.14]}><coneGeometry args={[0.5, 1.1, 4]} /></mesh>
      <mesh material={mat} castShadow position={[0.8, 0.42, -0.1]} rotation={[0, -0.5, -0.35]} scale={[1, 1, 0.14]}><coneGeometry args={[0.5, 1.1, 4]} /></mesh>
      {/* 꼬리 */}
      <mesh material={mat} castShadow position={[0, 0.02, -1.0]} rotation-x={-0.5}><cylinderGeometry args={[0.08, 0.16, 0.8, 6]} /></mesh>
      {[[-0.28, 0.5], [0.28, 0.5], [-0.28, -0.5], [0.28, -0.5]].map(([x, z], i) => (
        <mesh key={i} material={mat} castShadow position={[x, -0.5, z]}><cylinderGeometry args={[0.1, 0.09, 0.5, 6]} /></mesh>
      ))}
      <pointLight color="#ef4444" intensity={3} distance={6} />
    </group>
  )
}

function Monster({ entry, world, live, onKill, onRespawn }) {
  const T = MOB_TYPES[entry.type]
  const group = useRef(); const inner = useRef(); const ears = useRef()
  const hpBar = useRef(); const hpFg = useRef()
  const phase = useRef('alive')
  /* 던전 몹은 엔트리에 배율이 실려 온다 (일반 필드는 1) */
  const maxHp = Math.round(T.hp * (entry.hpMul || 1))
  const hp = useRef(maxHp)
  const flash = useRef(0); const dieT = useRef(0); const goneT = useRef(0)
  const fired = useRef({ kill: false, resp: false })
  const knock = useRef({ x: 0, z: 1, t: 0 })
  const dieDir = useRef({ x: 0, z: 1 })
  const killerRef = useRef(null)      // 막타를 넣은 사람 (보상 귀속)
  const meRef = useRef(null)
  const pos = useRef({ x: entry.x, z: entry.z })
  const face = useRef(Math.random() * Math.PI * 2)
  const ai = useRef({ mode: 'idle', t: 0, cool: 0.6 + Math.random() * 1.2 })

  const base = useMemo(() => new THREE.Color(T.color), [T.color])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: T.color, roughness: 0.6, emissive: new THREE.Color('#ff2d20'), emissiveIntensity: 0,
  }), [T.color])
  useEffect(() => () => mat.dispose(), [mat])
  const red = useMemo(() => new THREE.Color('#ff5a4d'), [])

  /* attackerId: 누가 때렸는가. 없으면 나(로컬 플레이어).
     막타를 넣은 사람만 보상을 받으므로 처치 순간에 이 값을 기록해 둔다. */
  const onHit = useCallback((dir, dmg, attackerId) => {
    if (phase.current !== 'alive') return
    flash.current = HIT_FLASH
    knock.current = { x: dir.x, z: dir.z, t: 0.18 }

    const w = world.current
    const net = w.net
    /* 시뮬 소유자가 아니면 HP를 직접 깎지 않는다 — 소유자에게 의도만 보내고
       타격 이펙트만 즉시 보여준다(반응성). HP는 소유자 값을 따른다.
       소유자의 스냅샷이 내 zone으로 흐르지 않으면 내 로컬 세계이므로 직접 처리. */
    if (net && !net.simOwner && net.snapZone === zoneOf(w.inst, w.mapId)) {
      net.room.send({ t: 'hit', mobId: entry.id, dmg, dx: dir.x, dz: dir.z })
      return
    }

    /* 취약(달의 사제) — 받는 피해 증폭. 시뮬 소유자만 실제 HP를 깎으므로 여기서 판정 */
    const me0 = meRef.current
    const vuln = me0 ? debuffVal(me0.debuffs, 'vuln') : 0
    if (vuln > 0) dmg = Math.round(dmg * (1 + vuln / 100))

    hp.current -= dmg
    if (T.aggro) ai.current.cool = Math.min(ai.current.cool, 0.3)   // 맞으면 즉각 반응
    if (hp.current <= 0) {
      phase.current = 'dying'; dieDir.current = dir; dieT.current = 0
      killerRef.current = attackerId || (net ? net.myId : null)
      const me = meRef.current
      if (me) { me.phase = 'dying'; me.killerId = killerRef.current }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [T.aggro, entry.id, world])
  const onHitRef = useRef(onHit); onHitRef.current = onHit

  useEffect(() => {
    const reg = world.current.mobs
    const me = {
      id: entry.id, x: entry.x, z: entry.z, alive: true,
      type: entry.type, scale: entry.scale || 1, rank: entry.rank || 'normal',
      hp: maxHp, maxHp, phase: 'alive', killerId: null,
      debuffs: null, dbits: 0,
      hit: (dir, dmg, attackerId) => onHitRef.current(dir, dmg, attackerId),
    }
    reg.set(entry.id, me); meRef.current = me
    return () => { reg.delete(entry.id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1)
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime
    if (flash.current > 0) flash.current = Math.max(0, flash.current - dt)
    const fk = Math.min(1, (flash.current / HIT_FLASH) * 1.4)
    let teleK = 0
    if (phase.current === 'alive' && T.aggro && ai.current.mode === 'windup') teleK = Math.min(1, ai.current.t / T.windup)
    if (fk > 0) { mat.color.copy(base).lerp(red, fk); mat.emissive.set('#ff2d20'); mat.emissiveIntensity = fk * 0.9 }
    else { mat.color.copy(base); mat.emissive.set('#ff8c00'); mat.emissiveIntensity = teleK * 0.8 }
    /* 저주받은 몹은 보랏빛으로 물든다 (호스트·팔로워 공통 시각 효과) */
    const meC = meRef.current
    if (fk <= 0 && meC && meC.dbits) { mat.emissive.set('#8b5cf6'); mat.emissiveIntensity = 0.5 }

    if (hpFg.current) {
      const r = Math.max(0, hp.current) / maxHp
      hpFg.current.scale.x = Math.max(0.001, r)
      hpFg.current.position.x = -0.43 * (1 - r)
      hpFg.current.material.color.set(r > 0.6 ? '#4ade80' : r > 0.34 ? '#facc15' : '#f87171')
    }
    if (hpBar.current) hpBar.current.visible = phase.current === 'alive'

    if (phase.current === 'alive') {
      const P = pos.current
      const w = world.current
      const net = w.net
      /* 시뮬 소유자의 스냅샷이 내 zone으로 흐를 때만 팔로워가 된다.
         아니면(소유자가 다른 곳에 있으면) 내 zone의 몬스터는 내가 직접 돌린다. */
      const follower = !!net && !net.simOwner && net.snapZone === zoneOf(w.inst, w.mapId)

      /* 팔로워 — AI를 돌리지 않고 호스트가 보낸 좌표·HP를 따라간다 */
      if (follower) {
        const snap = net.mobSnap.get(entry.id)
        if (snap) {
          P.x = lerp(P.x, snap.x, damp(12, dt))
          P.z = lerp(P.z, snap.z, damp(12, dt))
          hp.current = snap.hp
          if (snap.phase !== 'alive') {
            /* 호스트가 죽었다고 하면 죽는 연출로 넘어간다 */
            killerRef.current = snap.killerId
            phase.current = 'dying'; dieT.current = 0
            const me0 = meRef.current
            if (me0) { me0.phase = 'dying'; me0.killerId = snap.killerId }
          }
        }
        if (knock.current.t > 0) knock.current.t = Math.max(0, knock.current.t - dt)
        const kk0 = smooth(knock.current.t / 0.18) * 0.4
        const bob0 = entry.type === 'rabbit' ? Math.abs(Math.sin(t * 4.2)) * 0.3
          : entry.type === 'imp' || entry.type === 'wraith' ? Math.sin(t * 1.8) * 0.16
          : Math.abs(Math.sin(t * 3)) * 0.06
        g.position.x = P.x + knock.current.x * kk0
        g.position.z = P.z + knock.current.z * kk0
        g.position.y = bob0
        if (entry.type !== 'rabbit') {
          const tg0 = nearestTarget(w, P.x, P.z)
          face.current = dampAngle(face.current, Math.atan2(tg0.x - P.x, tg0.z - P.z), 7, dt)
          g.rotation.y = face.current
        }
        const meF = meRef.current
        if (meF) {
          meF.x = g.position.x; meF.z = g.position.z; meF.alive = true; meF.hp = hp.current
          if (snap) meF.dbits = snap.dbits || 0
        }
        return
      }

      /* 여기부터는 시뮬 소유자(호스트/파티장/혼자) — AI 실행 */
      const me1 = meRef.current
      const D = me1 ? me1.debuffs : null

      /* 지속 피해(달의 사제) — 0.6초마다 틱, 막타는 시전자에게 귀속 */
      if (D && D.dot && D.dot.until > performance.now()) {
        if (!D.dot.next || performance.now() >= D.dot.next) {
          D.dot.next = performance.now() + 600
          onHitRef.current({ x: 0, z: 1 }, Math.max(1, Math.round(D.dot.p * 0.6)), D.dot.by)
        }
      }
      if (me1) me1.dbits = debuffBits(D)

      const pl = nearestTarget(w, P.x, P.z)
      const dx = pl.x - P.x, dz = pl.z - P.z
      const d = Math.hypot(dx, dz)
      if (knock.current.t > 0) knock.current.t = Math.max(0, knock.current.t - dt)
      const kk = smooth(knock.current.t / 0.18) * 0.4

      /* 노리는 대상이 죽어 있으면 쉰다. 혼자일 때는 예전과 같은 조건이다. */
      const targetDown = pl.peerId ? !!pl.dead : live.current.dead
      if (T.aggro && !targetDown) {
        const A = ai.current
        if (A.cool > 0) A.cool -= dt
        face.current = dampAngle(face.current, Math.atan2(dx, dz), 7, dt)
        /* 디버프 반영 — 둔화/속박은 이동을, 약화/실명은 공격을 깎는다 */
        const rooted = debuffVal(D, 'root') > 0
        const spd = T.spd * (entry.spdMul || 1) * (1 - Math.min(70, debuffVal(D, 'slow')) / 100)
        if (A.mode === 'idle') {
          if (!rooted && d < (entry.aggroR || 14) && d > T.range) {
            const half = world.current.half
            P.x = clamp(P.x + (dx / (d || 1)) * spd * dt, -half, half)
            P.z = clamp(P.z + (dz / (d || 1)) * spd * dt, -half, half)
          } else if (d <= T.range && A.cool <= 0) { A.mode = 'windup'; A.t = 0 }
        } else if (A.mode === 'windup') {
          A.t += dt
          if (A.t >= T.windup) {
            A.mode = 'idle'; A.cool = T.cool
            const dd = Math.hypot(pl.x - P.x, pl.z - P.z)
            if (dd <= T.range + 0.6) {
              if (Math.random() * 100 < debuffVal(D, 'blind')) {
                /* 실명 — 공격이 빗나간다 */
              } else {
                const baseDmg = T.dmg * (entry.dmgMul || 1)
                const weak = 1 - Math.min(70, debuffVal(D, 'weak')) / 100
                deliverMobHit(w, pl, Math.max(1, Math.round((baseDmg + Math.random() * Math.max(1, baseDmg * 0.25)) * weak)))
              }
            }
          }
        }
      }

      const bob = entry.type === 'rabbit' ? Math.abs(Math.sin(t * 4.2)) * 0.3
        : entry.type === 'imp' || entry.type === 'wraith' ? Math.sin(t * 1.8) * 0.16
        : Math.abs(Math.sin(t * 3)) * 0.06
      g.position.x = P.x + knock.current.x * kk
      g.position.z = P.z + knock.current.z * kk
      g.position.y = bob
      g.rotation.y = entry.type === 'rabbit' ? 0 : face.current
      if (T.aggro && ai.current.mode === 'windup') g.position.x += Math.sin(t * 55) * 0.04
      if (inner.current && entry.type === 'rabbit') inner.current.scale.set(1, 1 - Math.sin(t * 8.4) * 0.05, 1)
      if (ears.current) ears.current.rotation.z = Math.sin(t * 4.2) * 0.12
      const me = meRef.current
      if (me) { me.x = g.position.x; me.z = g.position.z; me.alive = true; me.hp = hp.current }
      return
    }

    if (phase.current === 'dying') {
      const me = meRef.current; if (me) { me.alive = false; me.hp = 0 }
      dieT.current += dt
      const p = Math.min(1, dieT.current / DIE_TIME)
      const fly = smooth(Math.min(1, p * 1.1))
      g.position.x = pos.current.x + dieDir.current.x * 2.2 * fly
      g.position.z = pos.current.z + dieDir.current.z * 2.2 * fly
      g.position.y = Math.sin(Math.min(1, p * 1.1) * Math.PI) * 1.4
      g.rotation.x -= dt * 11; g.rotation.y += dt * 3.5
      g.scale.setScalar((p > 0.65 ? lerp(1, 0.04, smooth((p - 0.65) / 0.35)) : 1) * (entry.scale || 1))
      if (p >= 1) {
        g.visible = false; phase.current = 'gone'; goneT.current = 0
        if (!fired.current.kill) {
          fired.current.kill = true
          /* 막타를 넣은 사람만 보상을 받는다. 혼자일 때는 net이 없으므로
             killer 판정을 거치지 않고 예전처럼 바로 지급된다. */
          const net = world.current.net
          if (!net || isMyKill(killerRef.current, net.myId)) onKill(entry)
        }
      }
      return
    }
    goneT.current += dt
    /* 리스폰은 이 몬스터의 시뮬레이션을 소유한 쪽만 결정한다.
       팔로워는 소유자의 스냅샷으로 새 개체를 받는다. */
    if (goneT.current >= RESPAWN_TIME && !fired.current.resp) {
      const net = world.current.net
      if (!net || net.simOwner || net.snapZone !== zoneOf(world.current.inst, world.current.mapId)) {
        fired.current.resp = true; onRespawn(entry.id)
      }
    }
  })

  const sc = entry.scale || 1
  return (
    <group ref={group} position={[entry.x, 0, entry.z]} scale={sc}>
      <MobModel type={entry.type} mat={mat} ears={ears} inner={inner} />
      <Billboard ref={hpBar} position={[0, entry.type === 'rabbit' ? 1.35 : 2.0, 0]}>
        <mesh><planeGeometry args={[0.95, 0.13]} /><meshBasicMaterial color="#111827" transparent opacity={0.85} /></mesh>
        <mesh ref={hpFg} position={[0, 0, 0.001]}><planeGeometry args={[0.9, 0.08]} /><meshBasicMaterial color="#4ade80" /></mesh>
      </Billboard>
    </group>
  )
}

/* ==================================================================
   포탈 — 빛나는 기둥 형태. 닿으면 다음 맵으로 이동.
   ================================================================== */
function PortalPillar({ x, z, color, locked }) {
  const beam = useRef(); const ringA = useRef(); const ringB = useRef(); const motes = useRef()
  const col = locked ? '#64748b' : color
  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1)
    const t = state.clock.elapsedTime
    if (beam.current) beam.current.material.opacity = 0.28 + Math.sin(t * 2.2) * 0.1
    if (ringA.current) { ringA.current.rotation.y += dt * 1.1; ringA.current.position.y = 1.2 + Math.sin(t * 1.6) * 0.25 }
    if (ringB.current) { ringB.current.rotation.y -= dt * 1.7; ringB.current.position.y = 2.6 + Math.sin(t * 1.6 + 1) * 0.25 }
    if (motes.current) motes.current.rotation.y += dt * 0.8
  })
  return (
    <group position={[x, 0, z]}>
      {/* 받침 */}
      <mesh position={[0, 0.1, 0]} receiveShadow><cylinderGeometry args={[1.5, 1.75, 0.2, 24]} /><meshStandardMaterial color="#3b3652" roughness={0.8} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.21, 0]}>
        <ringGeometry args={[1.15, 1.45, 32]} /><meshBasicMaterial color={col} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      {/* 빛 기둥 */}
      <mesh ref={beam} position={[0, 4, 0]}>
        <cylinderGeometry args={[0.95, 1.15, 8, 24, 1, true]} />
        <meshBasicMaterial color={col} transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[0.35, 0.45, 8, 16, 1, true]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* 회전 고리 */}
      <mesh ref={ringA} position={[0, 1.2, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[1.05, 0.07, 8, 28]} /><meshStandardMaterial color={col} emissive={col} emissiveIntensity={1.1} roughness={0.3} />
      </mesh>
      <mesh ref={ringB} position={[0, 2.6, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.78, 0.05, 8, 24]} /><meshStandardMaterial color="#ffffff" emissive={col} emissiveIntensity={1.3} roughness={0.3} />
      </mesh>
      {/* 떠다니는 입자 */}
      <group ref={motes}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh key={i} position={[Math.cos(i * 1.05) * 1.3, 0.7 + (i % 3) * 0.9, Math.sin(i * 1.05) * 1.3]}>
            <octahedronGeometry args={[0.1]} /><meshBasicMaterial color={col} transparent opacity={0.9} />
          </mesh>
        ))}
      </group>
      <pointLight position={[0, 2.4, 0]} color={col} intensity={locked ? 3 : 10} distance={13} />
      <Billboard position={[0, 5.4, 0]}>
        <mesh><planeGeometry args={[3.4, 0.6]} /><meshBasicMaterial color="#0b1020" transparent opacity={0.75} /></mesh>
      </Billboard>
    </group>
  )
}
function Target({ entry, world, onHitTarget }) {
  const ring = useRef(); const flash = useRef(0)
  useEffect(() => {
    const reg = world.current.targets
    reg.set(entry.id, { x: entry.x, z: entry.z, hit: () => { flash.current = 0.4; onHitTarget() } })
    return () => { reg.delete(entry.id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1)
    if (flash.current > 0) flash.current = Math.max(0, flash.current - dt)
    if (ring.current) ring.current.rotation.z = flash.current * 14
  })
  return (
    <group position={[entry.x, 0, entry.z]}>
      <mesh position={[0, 1.1, 0]} castShadow><cylinderGeometry args={[0.06, 0.06, 2.2, 8]} /><meshStandardMaterial color="#6b4b2a" roughness={0.9} /></mesh>
      <group ref={ring} position={[0, 2, 0]}>
        <mesh rotation-x={Math.PI / 2}><cylinderGeometry args={[0.62, 0.62, 0.12, 20]} /><meshStandardMaterial color="#f8fafc" roughness={0.7} /></mesh>
        <mesh position={[0, 0, 0.07]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.42, 0.42, 0.04, 20]} /><meshStandardMaterial color="#ef4444" /></mesh>
        <mesh position={[0, 0, 0.1]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.2, 0.2, 0.04, 16]} /><meshStandardMaterial color="#fbbf24" /></mesh>
        <mesh position={[0, 0, 0.13]}><sphereGeometry args={[0.08, 10, 8]} /><meshStandardMaterial color="#111827" /></mesh>
      </group>
    </group>
  )
}

function Dummy({ entry, world, onHealDummy }) {
  const hp = useRef(60 + Math.random() * 20)
  const flash = useRef(0); const bar = useRef()
  const maxHp = 100
  useEffect(() => {
    const reg = world.current.dummies
    reg.set(entry.id, {
      x: entry.x, z: entry.z,
      heal: (amt) => {
        const before = hp.current
        hp.current = Math.min(maxHp, hp.current + amt)
        const gained = hp.current - before
        if (gained > 0.5) { flash.current = 0.4; onHealDummy(gained) }
        return gained
      },
    })
    return () => { reg.delete(entry.id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1)
    hp.current = Math.max(8, hp.current - dt * 3)
    if (flash.current > 0) flash.current = Math.max(0, flash.current - dt)
    if (bar.current) {
      const r = hp.current / maxHp
      bar.current.scale.x = Math.max(0.001, r)
      bar.current.position.x = -0.43 * (1 - r)
    }
  })
  return (
    <group position={[entry.x, 0, entry.z]}>
      <mesh position={[0, 0.4, 0]} castShadow><cylinderGeometry args={[0.35, 0.45, 0.8, 6]} /><meshStandardMaterial color="#8a6a3f" roughness={0.9} /></mesh>
      <mesh position={[0, 1.15, 0]} castShadow><boxGeometry args={[0.7, 0.9, 0.35]} /><meshStandardMaterial color="#a98b5e" roughness={0.9} /></mesh>
      <mesh position={[0, 1.85, 0]} castShadow><sphereGeometry args={[0.28, 12, 10]} /><meshStandardMaterial color="#c8a978" roughness={0.9} /></mesh>
      <mesh position={[-0.5, 1.2, 0]} rotation-z={0.6} castShadow><cylinderGeometry args={[0.08, 0.08, 0.7, 6]} /><meshStandardMaterial color="#8a6a3f" /></mesh>
      <mesh position={[0.5, 1.2, 0]} rotation-z={-0.6} castShadow><cylinderGeometry args={[0.08, 0.08, 0.7, 6]} /><meshStandardMaterial color="#8a6a3f" /></mesh>
      <Billboard position={[0, 2.4, 0]}>
        <mesh><planeGeometry args={[0.9, 0.1]} /><meshBasicMaterial color="#111827" transparent opacity={0.85} /></mesh>
        <mesh ref={bar} position={[0, 0, 0.001]}><planeGeometry args={[0.86, 0.06]} /><meshBasicMaterial color="#f472b6" /></mesh>
      </Billboard>
    </group>
  )
}

function Fragment({ x, z }) {
  const g = useRef()
  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1)
    if (g.current) {
      g.current.rotation.y += dt * 1.5
      g.current.position.y = 0.7 + Math.sin(state.clock.elapsedTime * 2.5) * 0.15
    }
  })
  return (
    <group ref={g} position={[x, 0.7, z]}>
      <mesh castShadow><octahedronGeometry args={[0.32]} /><meshStandardMaterial color="#c7d2fe" emissive="#818cf8" emissiveIntensity={0.9} roughness={0.2} metalness={0.4} /></mesh>
      <mesh rotation-x={Math.PI / 2}><torusGeometry args={[0.5, 0.02, 8, 24]} /><meshBasicMaterial color="#a5b4fc" transparent opacity={0.6} /></mesh>
      <pointLight color="#818cf8" intensity={3} distance={4} />
    </group>
  )
}

function Altar({ glow }) {
  const orb = useRef()
  useFrame((state) => {
    if (orb.current) {
      orb.current.position.y = 1.7 + Math.sin(state.clock.elapsedTime * 1.8) * 0.12
      orb.current.rotation.y = state.clock.elapsedTime * 0.8
    }
  })
  return (
    <group position={[TEMPLE.x, 0, TEMPLE.z]}>
      <mesh position={[0, 0.15, 0]} receiveShadow><cylinderGeometry args={[2.4, 2.6, 0.3, 24]} /><meshStandardMaterial color="#e7e2d6" roughness={0.9} /></mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} castShadow position={[Math.cos(i * Math.PI / 2) * 1.9, 1.4, Math.sin(i * Math.PI / 2) * 1.9]}>
          <cylinderGeometry args={[0.22, 0.24, 2.6, 12]} /><meshStandardMaterial color="#f2ede0" roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, 0.85, 0]} castShadow><boxGeometry args={[1.1, 1.1, 1.1]} /><meshStandardMaterial color="#d9cfb8" roughness={0.8} /></mesh>
      <mesh ref={orb} position={[0, 1.7, 0]}><sphereGeometry args={[0.32, 20, 16]} /><meshStandardMaterial color="#fff7d6" emissive="#fbbf24" emissiveIntensity={glow ? 1.4 : 0.7} roughness={0.2} /></mesh>
      <pointLight position={[0, 2, 0]} color="#fbbf24" intensity={glow ? 8 : 4} distance={9} />
    </group>
  )
}

function Portal({ position, color = '#a855f7' }) {
  const ring = useRef(); const ring2 = useRef(); const disc = useRef()
  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1)
    if (ring.current) ring.current.rotation.z += dt * 0.9
    if (ring2.current) ring2.current.rotation.z -= dt * 1.5
    if (disc.current) disc.current.material.opacity = 0.4 + Math.sin(state.clock.elapsedTime * 3) * 0.12
  })
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh position={[0, 0.08, 0]} receiveShadow><cylinderGeometry args={[1.5, 1.65, 0.16, 24]} /><meshStandardMaterial color="#3b2652" roughness={0.7} /></mesh>
      <group position={[0, 2.1, 0]}>
        <mesh ref={ring} castShadow><torusGeometry args={[1.25, 0.1, 10, 40]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} roughness={0.35} /></mesh>
        <mesh ref={ring2}><torusGeometry args={[0.95, 0.05, 8, 36]} /><meshStandardMaterial color="#f0abfc" emissive="#e879f9" emissiveIntensity={1.3} roughness={0.3} /></mesh>
        <mesh ref={disc}><circleGeometry args={[0.9, 28]} /><meshBasicMaterial color={color} transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      </group>
      <pointLight position={[0, 2.2, 0.6]} color={color} intensity={8} distance={10} />
    </group>
  )
}

function TrainingFloor() {
  return (
    <group position={[TRAIN_ZONE.x, 0, TRAIN_ZONE.z]}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} receiveShadow>
        <circleGeometry args={[TRAIN_ZONE.r, 40]} /><meshStandardMaterial color="#caa15a" roughness={0.95} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <ringGeometry args={[TRAIN_ZONE.r - 0.25, TRAIN_ZONE.r, 40]} /><meshBasicMaterial color="#8a6a3f" />
      </mesh>
    </group>
  )
}

/* ==================================================================
   퀘스트 NPC — 머리 위 마커가 상태를 알려준다 (! 수락가능 / ? 완료가능)
   ================================================================== */
function QuestNPC({ npc, state }) {
  const mark = useRef()
  useFrame((s) => {
    if (mark.current) mark.current.position.y = 2.9 + Math.sin(s.clock.elapsedTime * 2.4 + npc.x) * 0.14
  })
  const markColor = state === 'none' ? '#facc15' : state === 'active' ? '#94a3b8' : state === 'ready' ? '#4ade80' : null
  return (
    <group position={[npc.x, 0, npc.z]} rotation-y={npc.face}>
      {/* 로브 */}
      <mesh position={[0, 0.75, 0]} castShadow><cylinderGeometry args={[0.32, 0.55, 1.5, 12]} /><meshStandardMaterial color={npc.color} roughness={0.8} /></mesh>
      <mesh position={[0, 0.9, 0]} castShadow><torusGeometry args={[0.38, 0.05, 8, 20]} /><meshStandardMaterial color="#3f3a2f" roughness={0.85} /></mesh>
      {/* 머리 */}
      <mesh position={[0, 1.78, 0]} castShadow><sphereGeometry args={[0.32, 18, 14]} /><meshStandardMaterial color="#e8c39a" roughness={0.75} /></mesh>
      <mesh position={[-0.11, 1.83, 0.28]}><sphereGeometry args={[0.04, 8, 8]} /><meshStandardMaterial color="#1c2430" /></mesh>
      <mesh position={[0.11, 1.83, 0.28]}><sphereGeometry args={[0.04, 8, 8]} /><meshStandardMaterial color="#1c2430" /></mesh>
      {/* 모자 */}
      <mesh position={[0, 2.12, 0]} castShadow><coneGeometry args={[0.36, 0.42, 12]} /><meshStandardMaterial color={npc.color} roughness={0.8} /></mesh>
      {/* 팔 */}
      <mesh position={[-0.42, 1.1, 0]} rotation-z={0.35} castShadow><cylinderGeometry args={[0.09, 0.09, 0.75, 8]} /><meshStandardMaterial color={npc.color} roughness={0.8} /></mesh>
      <mesh position={[0.42, 1.1, 0]} rotation-z={-0.35} castShadow><cylinderGeometry args={[0.09, 0.09, 0.75, 8]} /><meshStandardMaterial color={npc.color} roughness={0.8} /></mesh>
      {/* 퀘스트 마커 */}
      {markColor && (
        <Billboard ref={mark} position={[0, 2.9, 0]}>
          <mesh position={[0, 0.16, 0]}><boxGeometry args={[0.13, 0.38, 0.13]} /><meshBasicMaterial color={markColor} /></mesh>
          <mesh position={[0, -0.2, 0]}><sphereGeometry args={[0.08, 10, 8]} /><meshBasicMaterial color={markColor} /></mesh>
        </Billboard>
      )}
    </group>
  )
}

/* ==================================================================
   지형 · 구역 건축물
   ================================================================== */
function Ground({ color }) {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[130, 130]} /><meshStandardMaterial color={color} roughness={1} />
    </mesh>
  )
}
function Tree({ position, s = 1, leaf = '#2f7a3e' }) {
  return (
    <group position={position} scale={s}>
      <mesh position={[0, 0.9, 0]} castShadow><cylinderGeometry args={[0.18, 0.26, 1.8, 6]} /><meshStandardMaterial color="#6b4b2a" roughness={0.9} /></mesh>
      <mesh position={[0, 2.4, 0]} castShadow><coneGeometry args={[1.1, 2.4, 7]} /><meshStandardMaterial color={leaf} roughness={0.85} /></mesh>
    </group>
  )
}
function House({ position, ry = 0, wall = '#cdb59b', roof = '#a4553f' }) {
  return (
    <group position={position} rotation-y={ry}>
      <mesh position={[0, 1, 0]} castShadow receiveShadow><boxGeometry args={[3, 2, 2.6]} /><meshStandardMaterial color={wall} roughness={0.9} /></mesh>
      <mesh position={[0, 2.6, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[2.35, 1.4, 4]} /><meshStandardMaterial color={roof} roughness={0.85} /></mesh>
      <mesh position={[0, 0.7, 1.31]}><boxGeometry args={[0.7, 1.4, 0.05]} /><meshStandardMaterial color="#5b3a24" roughness={0.9} /></mesh>
    </group>
  )
}

/* 마법탑 */
function MageTower() {
  const orb = useRef()
  useFrame((s) => { if (orb.current) { orb.current.rotation.y = s.clock.elapsedTime; orb.current.position.y = 7.4 + Math.sin(s.clock.elapsedTime * 1.5) * 0.2 } })
  return (
    <group position={[MAGE_TOWER.x, 0, MAGE_TOWER.z]}>
      <mesh position={[0, 3, 0]} castShadow receiveShadow><cylinderGeometry args={[1.8, 2.3, 6, 16]} /><meshStandardMaterial color="#5b5470" roughness={0.85} /></mesh>
      <mesh position={[0, 6.6, 0]} castShadow><coneGeometry args={[2.5, 2.2, 16]} /><meshStandardMaterial color="#6d28d9" roughness={0.7} /></mesh>
      <mesh ref={orb} position={[0, 7.4, 0]}><octahedronGeometry args={[0.5]} /><meshStandardMaterial color="#c4b5fd" emissive="#8b5cf6" emissiveIntensity={1.3} roughness={0.2} /></mesh>
      <mesh position={[0, 1.2, 2.2]}><boxGeometry args={[0.9, 1.8, 0.12]} /><meshStandardMaterial color="#3b2652" /></mesh>
      <pointLight position={[0, 7.4, 0]} color="#8b5cf6" intensity={9} distance={16} />
    </group>
  )
}

/* 달 제단 */
function MoonAltar() {
  const moon = useRef()
  useFrame((s, rd) => { const dt = Math.min(rd, 0.1); if (moon.current) { moon.current.rotation.z += dt * 0.4; moon.current.position.y = 3.6 + Math.sin(s.clock.elapsedTime * 1.2) * 0.25 } })
  return (
    <group position={[MOON_ALTAR.x, 0, MOON_ALTAR.z]}>
      <mesh position={[0, 0.16, 0]} receiveShadow><cylinderGeometry args={[3.2, 3.5, 0.32, 28]} /><meshStandardMaterial color="#c8cfe4" roughness={0.85} /></mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} castShadow position={[Math.cos(i * Math.PI / 3) * 2.6, 1.3, Math.sin(i * Math.PI / 3) * 2.6]}>
          <cylinderGeometry args={[0.18, 0.2, 2.4, 10]} /><meshStandardMaterial color="#dbe1f0" roughness={0.8} />
        </mesh>
      ))}
      <mesh ref={moon} position={[0, 3.6, 0]} rotation-z={2.5}>
        <torusGeometry args={[0.75, 0.16, 10, 32, 4.3]} />
        <meshStandardMaterial color="#dbe7ff" emissive="#818cf8" emissiveIntensity={1.2} roughness={0.3} />
      </mesh>
      <pointLight position={[0, 3.4, 0]} color="#818cf8" intensity={8} distance={14} />
    </group>
  )
}

/* 사격장 */
function ArcheryRange() {
  return (
    <group position={[ARCHERY.x, 0, ARCHERY.z]}>
      <mesh position={[0, 0.03, 0]} rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[13, 9]} /><meshStandardMaterial color="#b99a5e" roughness={0.95} /></mesh>
      {[-6, 6].map((x, i) => (
        <mesh key={i} position={[x, 0.9, -4.2]} castShadow><cylinderGeometry args={[0.12, 0.14, 1.8, 8]} /><meshStandardMaterial color="#6b4b2a" roughness={0.9} /></mesh>
      ))}
      <mesh position={[0, 1.7, -4.2]} castShadow><boxGeometry args={[12.2, 0.18, 0.18]} /><meshStandardMaterial color="#6b4b2a" roughness={0.9} /></mesh>
      <mesh position={[0, 1.2, 4.4]} castShadow><boxGeometry args={[5, 2.2, 0.3]} /><meshStandardMaterial color="#8a6a3f" roughness={0.9} /></mesh>
    </group>
  )
}

/* 그림자 골목 */
function ShadowAlley() {
  return (
    <group position={[SHADOW_ALLEY.x, 0, SHADOW_ALLEY.z]}>
      <mesh position={[0, 0.03, 0]} rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[11, 9]} /><meshStandardMaterial color="#3b3646" roughness={0.95} /></mesh>
      <mesh position={[-4.6, 1.8, 0]} castShadow><boxGeometry args={[0.7, 3.6, 8.6]} /><meshStandardMaterial color="#2f2b38" roughness={0.9} /></mesh>
      <mesh position={[4.6, 1.8, 0]} castShadow><boxGeometry args={[0.7, 3.6, 8.6]} /><meshStandardMaterial color="#2f2b38" roughness={0.9} /></mesh>
      {[[-2.6, 2.2], [2.4, -2.6], [1.2, 3.2]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.42, z]} castShadow><boxGeometry args={[0.85, 0.85, 0.85]} /><meshStandardMaterial color="#4a4358" roughness={0.9} /></mesh>
      ))}
      <pointLight position={[0, 2.6, 0]} color="#818cf8" intensity={3} distance={9} />
    </group>
  )
}

/* 상점 가판대 */
function ShopStall() {
  return (
    <group position={[6, 0, -3]} rotation-y={-0.8}>
      <mesh position={[0, 0.95, 0]} castShadow><boxGeometry args={[2.6, 0.16, 1.3]} /><meshStandardMaterial color="#8a6a3f" roughness={0.9} /></mesh>
      {[[-1.15, -0.5], [1.15, -0.5], [-1.15, 0.5], [1.15, 0.5]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.45, z]} castShadow><cylinderGeometry args={[0.08, 0.08, 0.9, 6]} /><meshStandardMaterial color="#6b4b2a" /></mesh>
      ))}
      <mesh position={[0, 2, 0]} rotation-x={0.25} castShadow><boxGeometry args={[3, 0.1, 1.8]} /><meshStandardMaterial color="#c2410c" roughness={0.85} /></mesh>
      {[[-1.4, 0], [1.4, 0]].map(([x], i) => (
        <mesh key={i} position={[x, 1.5, -0.7]} castShadow><cylinderGeometry args={[0.06, 0.06, 1.1, 6]} /><meshStandardMaterial color="#6b4b2a" /></mesh>
      ))}
    </group>
  )
}

function WorldScenery() {
  return (
    <group>
      {/* 마을 */}
      <House position={[-7, 0, -6]} ry={0.4} />
      <House position={[8, 0, -8]} ry={-0.5} />
      <House position={[-9, 0, 4]} ry={1.2} />
      <ShopStall />
      {/* 원거리 숲 */}
      <Tree position={[-30, 0, -6]} s={1.2} /><Tree position={[-29, 0, 12]} s={1} />
      <Tree position={[30, 0, -4]} s={1.1} /><Tree position={[29, 0, 20]} s={0.9} />
      <Tree position={[-4, 0, 30]} s={1.05} /><Tree position={[10, 0, 30]} s={1.15} />
      <Tree position={[-14, 0, -29]} s={0.95} /><Tree position={[16, 0, -28]} s={1} />
      <Tree position={[-27, 0, 26]} s={1.1} /><Tree position={[27, 0, -26]} s={1.05} />
      <Tree position={[-12, 0, 12]} s={1} /><Tree position={[13, 0, 6]} s={0.95} />
      {/* 구역 */}
      <MageTower />
      <MoonAltar />
      <ArcheryRange />
      <ShadowAlley />
    </group>
  )
}

/* ==================================================================
   사냥터별 배경 — 맵마다 분위기가 다르다
   ================================================================== */
function Rock({ position, s = 1, color = '#8b8b93' }) {
  return (
    <mesh position={position} scale={s} rotation={[0.3, position[0], 0.15]} castShadow>
      <dodecahedronGeometry args={[0.7, 0]} /><meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  )
}
function Crystal({ position, s = 1, color = '#a855f7' }) {
  return (
    <group position={position} scale={s}>
      <mesh castShadow><octahedronGeometry args={[0.6]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} roughness={0.25} /></mesh>
      <pointLight color={color} intensity={3} distance={6} />
    </group>
  )
}
function LavaPool({ position, s = 1 }) {
  const m = useRef()
  useFrame((st) => { if (m.current) m.current.material.emissiveIntensity = 1.1 + Math.sin(st.clock.elapsedTime * 1.6) * 0.35 })
  return (
    <mesh ref={m} position={position} rotation-x={-Math.PI / 2} scale={s}>
      <circleGeometry args={[2.2, 20]} />
      <meshStandardMaterial color="#ff7a1a" emissive="#ff5500" emissiveIntensity={1.2} roughness={0.5} />
    </mesh>
  )
}
function Bones({ position, ry = 0 }) {
  return (
    <group position={position} rotation-y={ry}>
      <mesh castShadow position={[0, 0.12, 0]} rotation-z={1.5}><cylinderGeometry args={[0.09, 0.09, 1.2, 6]} /><meshStandardMaterial color="#e8e2d0" roughness={0.9} /></mesh>
      <mesh castShadow position={[0.5, 0.16, 0.3]}><sphereGeometry args={[0.26, 10, 8]} /><meshStandardMaterial color="#e8e2d0" roughness={0.9} /></mesh>
    </group>
  )
}

function MapScenery({ mapId }) {
  if (mapId === 0) return <WorldScenery />
  if (mapId === 1) {
    return (
      <group>
        {[[-18, -6], [-14, 9], [16, -8], [19, 10], [-6, 17], [8, 16], [-9, -17], [12, -16], [-20, 18], [21, -18]].map(([x, z], i) => (
          <Tree key={i} position={[x, 0, z]} s={1 + (i % 3) * 0.18} leaf="#245c33" />
        ))}
        {[[-11, 3], [10, -3], [3, 11], [-4, -11]].map(([x, z], i) => <Rock key={i} position={[x, 0.4, z]} s={1 + (i % 2) * 0.4} color="#6b7a5e" />)}
      </group>
    )
  }
  if (mapId === 2) {
    return (
      <group>
        {[[-19, -5], [-15, 11], [17, -9], [20, 12], [-7, 18], [9, 17], [-10, -18], [13, -15], [4, 6], [-5, -6]].map(([x, z], i) => (
          <Rock key={i} position={[x, 0.5, z]} s={1.3 + (i % 3) * 0.5} color="#9a8b6e" />
        ))}
        {[[-12, 4], [11, -4], [2, 13]].map(([x, z], i) => <Bones key={i} position={[x, 0, z]} ry={i} />)}
      </group>
    )
  }
  if (mapId === 3) {
    return (
      <group>
        {[[-13, -7], [12, 8], [0, 14], [-6, 4]].map(([x, z], i) => <LavaPool key={i} position={[x, 0.04, z]} s={0.8 + (i % 3) * 0.3} />)}
        {[[-18, -4], [16, -10], [18, 11], [-8, 16], [10, 15], [-16, 12]].map(([x, z], i) => (
          <Rock key={i} position={[x, 0.5, z]} s={1.4 + (i % 2) * 0.5} color="#4a2c22" />
        ))}
      </group>
    )
  }
  if (mapId === 4) {
    return (
      <group>
        {[[-16, -6], [14, 7], [-5, 14], [7, -13], [17, -12], [-17, 13]].map(([x, z], i) => (
          <Crystal key={i} position={[x, 0.8, z]} s={1 + (i % 3) * 0.4} color="#8b5cf6" />
        ))}
        {[[-10, 3], [9, -3], [2, 11], [-3, -10]].map(([x, z], i) => <Bones key={i} position={[x, 0, z]} ry={i * 1.3} />)}
        {[[-19, 0], [19, 2]].map(([x, z], i) => <Rock key={i} position={[x, 0.5, z]} s={1.8} color="#2c2740" />)}
      </group>
    )
  }
  return (
    <group>
      {[[-15, -7], [13, 8], [-6, 15], [8, -14], [18, -11], [-18, 12]].map(([x, z], i) => (
        <Crystal key={i} position={[x, 0.8, z]} s={1.1 + (i % 2) * 0.5} color="#f87171" />
      ))}
      {[[-11, 2], [10, -2], [1, 12], [-2, -11], [15, 14], [-16, -14]].map(([x, z], i) => <Bones key={i} position={[x, 0, z]} ry={i * 0.9} />)}
      {[[-20, 4], [20, -4]].map(([x, z], i) => <Rock key={i} position={[x, 0.6, z]} s={2} color="#5c3340" />)}
    </group>
  )
}

/* ==================================================================
   GameLogic — 화살 · 달조각 · 포탈 · 상호작용 · 재생 · 설교
   ================================================================== */
function GameLogic({ world, live, mode, mapId, statsRef, bumpHud, onFragment, onSermon, onPortal }) {
  const acc = useRef(0)
  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1)
    const L = live.current
    const st = statsRef.current
    const now = performance.now()
    L.iframe = Math.max(0, L.iframe - dt)
    L.hurtT = Math.max(0, L.hurtT - dt)
    L.portalCd = Math.max(0, (L.portalCd || 0) - dt)
    L.maxHp = st.maxHp
    if (L.hp > st.maxHp) L.hp = st.maxHp
    if (!L.dead && now - L.lastHurt > 3000) L.hp = Math.min(st.maxHp, L.hp + (st.regen || 2) * dt)
    /* 재생 버프(성직자 기도·힐러 지속 치유) — 전투 중에도 차오른다 */
    const buffRegen = buffSum(L, 'regen')
    if (!L.dead && buffRegen > 0) L.hp = Math.min(st.maxHp, L.hp + buffRegen * dt)
    if (!L.buffPruneT || now - L.buffPruneT > 1000) { L.buffPruneT = now; pruneBuffs(L) }

    /* ---- 어둠의 암살자 패시브 · 지속 상태 ---- */
    if (L.isDark) {
      const pl2 = world.current.player
      const moved = Math.hypot(pl2.x - (L.lastX ?? pl2.x), pl2.z - (L.lastZ ?? pl2.z)) > 0.02
      L.lastX = pl2.x; L.lastZ = pl2.z
      if (moved) {
        /* 충분히 가만히 있었다면 움직이는 순간 은신 */
        if ((L.stillT || 0) >= DARK_PASSIVE.stillNeed && !L.stealth) {
          L.stealth = true
          if (world.current.onStealth) world.current.onStealth(true)
        }
        L.stillT = 0
      } else {
        L.stillT = (L.stillT || 0) + dt
      }
      /* 빙의 중이면 대상 위치를 따라간다 */
      if (L.possess) {
        if (now >= L.possess.until) {
          /* 5초가 다하면 자동으로 튀어나온다 — 재사용했을 때와 똑같이 잔상이 돌진한다 */
          const { x: bx, z: bz, burst } = L.possess
          L.possess = null
          L.possessRecast = now + 4000        // 자동 해제 뒤에도 은신 돌진으로 이을 수 있다
          if (burst) burst(bx, bz)
        } else {
          const tgt = L.possess.mob || (L.possess.peerId ? world.current.peers.get(L.possess.peerId) : null)
          if (tgt) { L.possess.x = tgt.x; L.possess.z = tgt.z }
          world.current.teleport = { x: L.possess.x, z: L.possess.z }
        }
      }
      /* 파고든 직후 잠깐 상대를 따라붙는다 */
      if (L.followFoe) {
        if (now >= L.followFoe.until) L.followFoe = null
        else {
          const tgt = L.followFoe.mob || (L.followFoe.peerId ? world.current.peers.get(L.followFoe.peerId) : null)
          if (tgt && tgt.alive !== false) world.current.teleport = { x: tgt.x - 1.1, z: tgt.z }
        }
      }
      /* 잔상 수명 — 순간이동에 쓰지 않고 흘려보냈으면 그때 쿨타임이 들어간다 */
      if (L.mirror && now >= L.mirror.until) {
        if (L.mirror.skId) L.cd[L.mirror.skId] = L.mirror.cd || 10
        L.mirror = null
      }
    }

    for (const k in L.cd) { if (L.cd[k] > 0) L.cd[k] = Math.max(0, L.cd[k] - dt) }

    const pl = world.current.player
    const inTown = mode === 'field' && mapId === 0
    if (inTown && inZone(pl.x, pl.z, TRAIN_ZONE)) L.trainStay += dt
    else L.trainStay = 0

    if (L.sermon.active) {
      if (!inTown || dist2(pl.x, pl.z, TEMPLE.x, TEMPLE.z) > 4.2) {
        L.sermon.active = false; L.sermon.t = 0; bumpHud()
      } else {
        L.sermon.t += dt
        if (L.sermon.t >= L.sermon.dur) { L.sermon.active = false; L.sermon.t = 0; onSermon() }
      }
    }

    /* 화살 */
    const A = L.arrows
    for (let i = A.length - 1; i >= 0; i--) {
      const a = A[i]
      a.x += a.vx * dt; a.z += a.vz * dt; a.life -= dt
      let consumed = false
      world.current.targets.forEach((tg) => {
        if (consumed) return
        if (Math.hypot(a.x - tg.x, a.z - tg.z) < 0.9) { tg.hit(); consumed = true }
      })
      if (!consumed) {
        world.current.mobs.forEach((m) => {
          if (consumed || !m.alive) return
          if (Math.hypot(a.x - m.x, a.z - m.z) < 1.1) {
            const dd = Math.max(0.001, Math.hypot(m.x - pl.x, m.z - pl.z))
            m.hit({ x: (m.x - pl.x) / dd, z: (m.z - pl.z) / dd }, a.dmg); consumed = true
            /* 달빛 투사체는 맞은 적을 둔화시킨다 */
            if (a.moon) applyMobDebuffs(world.current, [m.id], [['slow', MOON_BASIC.slow]], MOON_BASIC.slowDur, null)
          }
        })
      }
      if (!consumed && world.current.bot && world.current.bot.alive) {
        const b = world.current.bot
        if (Math.hypot(a.x - b.x, a.z - b.z) < 1.2) {
          const dd = Math.max(0.001, Math.hypot(b.x - pl.x, b.z - pl.z))
          b.hit({ x: (b.x - pl.x) / dd, z: (b.z - pl.z) / dd }, a.dmg); consumed = true
        }
      }
      if (consumed || a.life <= 0 || Math.abs(a.x) > 40 || Math.abs(a.z) > 40) A.splice(i, 1)
    }

    if (inTown) {
      world.current.fragments.forEach((f, id) => {
        if (Math.hypot(pl.x - f.x, pl.z - f.z) < 1.5) onFragment(id)
      })
    }

    /* 포탈 — 닿으면 맵 이동 */
    if (mode === 'field' && !L.dead && L.portalCd <= 0) {
      const ps = world.current.portals || []
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i]
        if (Math.hypot(pl.x - p.x, pl.z - p.z) < 2.2) { L.portalCd = 1.5; onPortal(p.to); break }
      }
    }

    /* 상호작용 (마을에서만) */
    let prompt = null
    if (!L.dead && inTown) {
      let best = 3.6
      NPCS.forEach((n) => {
        const d = dist2(pl.x, pl.z, n.x, n.z)
        if (d < best) { best = d; prompt = { kind: 'npc', id: n.id } }
      })
      if (!prompt) {
        if (dist2(pl.x, pl.z, TEMPLE.x, TEMPLE.z) < 4.0) prompt = { kind: 'altar' }
        else if (dist2(pl.x, pl.z, PVP_PORTAL.x, PVP_PORTAL.z) < 3.2) prompt = { kind: 'portal' }
      }
    }
    /* 사이드 퀘스트 NPC · 히든 직업 지점 — 필드 어디서나 */
    let atHidden = null
    if (!L.dead && mode === 'field') {
      const hs = world.current.hiddenSpot
      if (hs && dist2(pl.x, pl.z, hs.x, hs.z) <= hs.r) atHidden = hs
      if (!prompt) {
        let best = 3.6
        for (const sp of (world.current.sqSpots || [])) {
          const d = dist2(pl.x, pl.z, sp.x, sp.z)
          if (d < best) { best = d; prompt = { kind: 'sq', id: sp.id } }
        }
        if (atHidden) prompt = { kind: 'hidden', id: atHidden.key }
      }
    }

    /* 요정 모으기 — 엘프의 숲 요정 무리 안에서 E를 꾹 누르면 10초당 1마리 */
    if (atHidden && atHidden.key === 'fairy_grove' && L.eHeld && !L.dead) {
      L.gatherT = (L.gatherT || 0) + dt
      if (L.gatherT >= FAIRY_GATHER_SEC) {
        L.gatherT = 0
        if (world.current.onFairy) world.current.onFairy()
      }
    } else if (L.gatherT) {
      L.gatherT = 0
    }
    L.gatherPct = atHidden && atHidden.key === 'fairy_grove' && L.eHeld
      ? (L.gatherT || 0) / FAIRY_GATHER_SEC : 0
    const sig = prompt ? prompt.kind + (prompt.id || '') : ''
    if (sig !== L.promptSig) { L.prompt = prompt; L.promptSig = sig; bumpHud() }

    acc.current += dt
    if (acc.current >= 0.12) { acc.current = 0; bumpHud() }
  })
  return null
}

/* 맵별 몬스터 스폰 위치 — 마을은 구역/NPC를 피하고, 사냥터는 포탈만 피한다 */
function pickSpotMap(others, avoid, mapId, near) {
  if (mapId === 0) return pickSpot(others, avoid, near)
  const md = MAP_BY_ID[mapId]
  const R = md.half - 3
  const ps = portalsFor(mapId)
  for (let i = 0; i < 40; i++) {
    const x = (Math.random() * 2 - 1) * R
    const z = (Math.random() * 2 - 1) * R
    if (ps.some((p) => dist2(x, z, p.x, p.z) < 6)) continue
    if (avoid && dist2(x, z, avoid.x, avoid.z) < 6) continue
    if (others.some((o) => dist2(x, z, o.x, o.z) < 4)) continue
    return { x, z }
  }
  const a = Math.random() * Math.PI * 2
  return { x: Math.cos(a) * (R * 0.6), z: Math.sin(a) * (R * 0.6) }
}
/* ==================================================================
   전투 이펙트
   ================================================================== */
function SlashFx({ fx, onDone }) {
  const g = useRef(); const m1 = useRef(); const m2 = useRef()
  const t = useRef(0); const done = useRef(false)
  const life = fx.wide ? 0.5 : 0.35
  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1)
    t.current += dt
    const p = Math.min(1, t.current / life)
    if (g.current) { const s = lerp(0.45, 1.5, smooth(p)); g.current.scale.set(s, 1, s) }
    if (m1.current) m1.current.material.opacity = 0.9 * (1 - p)
    if (m2.current) m2.current.material.opacity = 0.6 * (1 - p)
    if (p >= 1 && !done.current) { done.current = true; onDone(fx.id) }
  })
  return (
    <group position={[fx.x, 0.6, fx.z]} rotation-y={fx.yaw}>
      <group ref={g}>
        <mesh ref={m1} rotation={[-Math.PI / 2, 0, -Math.PI / 2 - fx.arc / 2]}>
          <torusGeometry args={[fx.range * 0.55, 0.1, 8, 40, fx.arc]} />
          <meshBasicMaterial color={fx.color} transparent opacity={0.9} depthWrite={false} />
        </mesh>
        <mesh ref={m2} rotation={[-Math.PI / 2, 0, -Math.PI / 2 - fx.arc / 2]} position={[0, 0.12, 0]}>
          <torusGeometry args={[fx.range * 0.42, 0.055, 8, 36, fx.arc]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}
function SpellFx({ fx, onDone }) {
  const ring = useRef(); const pillar = useRef()
  const t = useRef(0); const done = useRef(false)
  const life = 0.9
  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1)
    t.current += dt
    const p = Math.min(1, t.current / life)
    if (ring.current) { ring.current.rotation.z += dt * 3; ring.current.material.opacity = 0.85 * (1 - p) }
    if (pillar.current) {
      pillar.current.scale.set(1, lerp(0.2, 1, smooth(Math.min(1, p * 2))), 1)
      pillar.current.material.opacity = 0.8 * (1 - smooth(p))
    }
    if (p >= 1 && !done.current) { done.current = true; onDone(fx.id) }
  })
  return (
    <group position={[fx.x, 0.05, fx.z]}>
      <mesh ref={ring} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[fx.range * 0.7, fx.range, 40]} />
        <meshBasicMaterial color={fx.color} transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={pillar} position={[0, 3, 0]}>
        <cylinderGeometry args={[fx.range * 0.6, fx.range * 0.75, 6, 24, 1, true]} />
        <meshBasicMaterial color={fx.color} transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 2, 0]} color={fx.color} intensity={9} distance={11} />
    </group>
  )
}
function HealFx({ fx, onDone }) {
  const g = useRef(); const t = useRef(0); const done = useRef(false)
  const life = 0.8
  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1)
    t.current += dt
    const p = Math.min(1, t.current / life)
    if (g.current) {
      g.current.position.y = lerp(0.4, 2.4, smooth(p))
      g.current.children.forEach((c) => { if (c.material) c.material.opacity = 0.9 * (1 - p) })
      g.current.rotation.y += dt * 3
    }
    if (p >= 1 && !done.current) { done.current = true; onDone(fx.id) }
  })
  return (
    <group ref={g} position={[fx.x, 0.4, fx.z]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.cos(i * 1.6) * 0.4, i * 0.18, Math.sin(i * 1.6) * 0.4]}>
          <boxGeometry args={[0.12, 0.12, 0.12]} /><meshBasicMaterial color="#34d399" transparent opacity={0.9} depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[0, 0.9, 0]}><boxGeometry args={[0.1, 0.5, 0.1]} /><meshBasicMaterial color="#a7f3d0" transparent opacity={0.9} depthWrite={false} /></mesh>
      <mesh position={[0, 0.9, 0]} rotation-z={Math.PI / 2}><boxGeometry args={[0.1, 0.5, 0.1]} /><meshBasicMaterial color="#a7f3d0" transparent opacity={0.9} depthWrite={false} /></mesh>
      <pointLight color="#34d399" intensity={4} distance={4} />
    </group>
  )
}

const ARROW_MAX = 20
function ArrowPool({ live }) {
  const meshes = useRef([])
  useFrame(() => {
    const A = live.current.arrows
    for (let i = 0; i < ARROW_MAX; i++) {
      const m = meshes.current[i]
      if (!m) continue
      const a = A[i]
      if (a) { m.visible = true; m.position.set(a.x, 0.9, a.z); m.rotation.y = Math.atan2(a.vx, a.vz) }
      else m.visible = false
    }
  })
  return (
    <group>
      {Array.from({ length: ARROW_MAX }, (_, i) => (
        <group key={i} ref={(el) => { meshes.current[i] = el }} visible={false}>
          <mesh rotation-x={Math.PI / 2}><cylinderGeometry args={[0.03, 0.03, 0.8, 6]} /><meshStandardMaterial color="#8a6a3f" /></mesh>
          <mesh position={[0, 0, 0.45]} rotation-x={Math.PI / 2}><coneGeometry args={[0.06, 0.16, 6]} /><meshStandardMaterial color="#c7ced6" metalness={0.7} roughness={0.3} /></mesh>
        </group>
      ))}
    </group>
  )
}

/* ==================================================================
   PVP 봇 — 난이도 6단계로 체력·피해·속도·선딜이 달라진다
   ================================================================== */
function Bot({ botCls, diff, world, live, onDead }) {
  const root = useRef(); const armPivot = useRef()
  const wtype = botCls.weapon
  const pose = poseOf(wtype)
  const maxHp = diff.hp
  const hp = useRef(diff.hp)
  const phase = useRef('alive')
  const flash = useRef(0)
  const swing = useRef({ t: -1, hitDone: true })
  const ai = useRef({ mode: 'chase', t: 0, cool: 1 })
  const yaw = useRef(0); const dieT = useRef(0)
  const fired = useRef(false)
  const pos = useRef({ x: 0, z: 8 })
  const hpFg = useRef(); const meRef = useRef(null)

  useEffect(() => {
    const me = {
      x: 0, z: 8, alive: true,
      hit: (dir, dmg) => {
        if (phase.current !== 'alive') return
        flash.current = HIT_FLASH
        hp.current -= dmg
        if (hp.current <= 0) { phase.current = 'dying'; dieT.current = 0; me.alive = false }
      },
    }
    const w = world.current
    w.bot = me; meRef.current = me
    return () => { if (w.bot === me) w.bot = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1)
    const g = root.current
    if (!g) return
    if (flash.current > 0) flash.current = Math.max(0, flash.current - dt)
    if (hpFg.current) {
      const r = Math.max(0, hp.current) / maxHp
      hpFg.current.scale.x = Math.max(0.001, r)
      hpFg.current.position.x = -0.6 * (1 - r)
    }
    if (phase.current === 'dying') {
      dieT.current += dt
      g.rotation.x = lerp(g.rotation.x, -Math.PI / 2 + 0.2, damp(6, dt))
      g.position.y = Math.sin(Math.min(1, dieT.current / 0.7) * Math.PI) * 0.6
      if (dieT.current > 0.9 && !fired.current) { fired.current = true; onDead() }
      return
    }
    if (live.current.dead) return

    const P = pos.current
    const pl = world.current.player
    const dx = pl.x - P.x, dz = pl.z - P.z
    const d = Math.hypot(dx, dz)
    yaw.current = dampAngle(yaw.current, Math.atan2(dx, dz), 8, dt)
    const A = ai.current
    if (A.cool > 0) A.cool -= dt

    if (A.mode === 'chase') {
      if (d > 2.0) {
        P.x = clamp(P.x + (dx / (d || 1)) * diff.spd * dt, -ARENA_HALF, ARENA_HALF)
        P.z = clamp(P.z + (dz / (d || 1)) * diff.spd * dt, -ARENA_HALF, ARENA_HALF)
      } else if (A.cool <= 0) { A.mode = 'windup'; A.t = 0 }
    } else if (A.mode === 'windup') {
      A.t += dt
      if (A.t >= diff.windup) { A.mode = 'swing'; A.t = 0; swing.current.t = 0; swing.current.hitDone = false }
    } else if (A.mode === 'swing') {
      const s = swing.current
      s.t += dt
      if (!s.hitDone && s.t >= IMPACT_AT) {
        s.hitDone = true
        const dd = Math.hypot(pl.x - P.x, pl.z - P.z)
        if (dd < 2.8 && Math.abs(angleDiff(Math.atan2(pl.x - P.x, pl.z - P.z), yaw.current)) < 1.2) {
          world.current.hitPlayer(diff.dmg + Math.floor(Math.random() * Math.max(1, diff.dmg * 0.3)))
        }
      }
      if (s.t >= SWING_TIME) { s.t = -1; A.mode = 'chase'; A.cool = diff.cool }
    }

    g.position.x = P.x; g.position.z = P.z
    g.position.y = Math.abs(Math.sin(state.clock.elapsedTime * 3)) * 0.04
    g.rotation.y = yaw.current
    const me = meRef.current; if (me) { me.x = P.x; me.z = P.z }

    if (armPivot.current) {
      const s = swing.current
      if (s.t >= 0) armPivot.current.rotation.x = swingAngleFor(pose, Math.min(1, s.t / SWING_TIME))
      else if (A.mode === 'windup') armPivot.current.rotation.x = lerp(armPivot.current.rotation.x, pose.back, damp(10, dt))
      else armPivot.current.rotation.x = lerp(armPivot.current.rotation.x, pose.rest, damp(8, dt))
    }
  })

  return (
    <group ref={root} position={[0, 0, 8]}>
      <CharacterBody cls={botCls} wtype={wtype} armPivot={armPivot} tint />
      <Billboard position={[0, 3, 0]}>
        <mesh><planeGeometry args={[1.25, 0.16]} /><meshBasicMaterial color="#111827" transparent opacity={0.85} /></mesh>
        <mesh ref={hpFg} position={[0, 0, 0.001]}><planeGeometry args={[1.2, 0.1]} /><meshBasicMaterial color={diff.color} /></mesh>
      </Billboard>
    </group>
  )
}

/* ==================================================================
   메인 게임 화면
   ================================================================== */
function GameScreen({ account, cls, addToast, onChangeClass, onResetCharacter }) {
  const isMobile = useIsMobile()
  const rpgSetVec = useCallback((x, y) => { TOUCH.mx = x; TOUCH.my = y }, [])
  /* 모바일 달리기 토글 — 키보드의 Shift와 동등한 기능을 터치로 제공한다 */
  const [runOn, setRunOn] = useState(false)
  const toggleRun = useCallback(() => { TOUCH.run = !TOUCH.run; setRunOn(TOUCH.run) }, [])
  /* ---------- 영구 저장 ---------- */
  const S = useRef(null)
  if (S.current === null) {
    const raw = loadJSON(LS_SAVE, null)
    const base = defaultSave()
    S.current = raw
      ? { ...base, ...raw, equip: { ...emptyEquip(), ...(raw.equip || {}) }, skills: raw.skills || {}, jobQuest: raw.jobQuest || {} }
      : base
    if (!Array.isArray(S.current.equip.runes) || S.current.equip.runes.length !== RUNE_SLOTS) S.current.equip.runes = Array(RUNE_SLOTS).fill(null)
    if (!Array.isArray(S.current.bag)) S.current.bag = []
  }
  const [saveUI, setSaveUI] = useState(() => JSON.parse(JSON.stringify(S.current)))
  const commit = useCallback(() => {
    setSaveUI(JSON.parse(JSON.stringify(S.current)))
    saveJSON(LS_SAVE, S.current)
  }, [])

  const stats = useMemo(() => computeStats(cls, saveUI), [cls, saveUI])
  const statsRef = useRef(stats); statsRef.current = stats
  const unlocked = saveUI.unlocked

  /* ---------- 실시간 ---------- */
  const live = useRef({
    hp: stats.maxHp, maxHp: stats.maxHp, dead: false,
    iframe: 0, hurtT: 0, lastHurt: -99999, prompt: null, promptSig: '', edgeWarn: 0,
    arrows: [], trainStay: 0, sermon: { active: false, t: 0, dur: 2.5 }, cd: {},
    buffs: [], dashReq: null,
  })
  const world = useRef({
    player: { x: 0, z: 3, yaw: 0 },
    mobs: new Map(), targets: new Map(), dummies: new Map(), fragments: new Map(),
    bot: null, half: MAP_BY_ID[S.current.map || 0].half, teleport: null,
    tutorLock: !S.current.unlocked, onEdge: null, portals: portalsFor(S.current.map || 0),
    /* 공유 사냥터 — 방에 들어가기 전에는 net이 null이라 혼자 하던 것과 같다 */
    peers: new Map(), net: null, mapId: S.current.map || 0,
    inst: null, instLeader: null,      // 던전/레이드/결투 인스턴스
    afterimages: [],                   // 어둠의 암살자 잔상 (Afterimages가 매 프레임 읽는다)
  })
  const camRef = useRef({ yaw: Math.PI, pitch: 0.62 })
  const swing = useRef({ t: -1, hitDone: true, impact: null })
  const controlRef = useRef({ lock: false })

  /* ---------- 공유 사냥터 ---------- */
  const room = useRoom()
  const netRef = useRef(null)
  const supportRef = useRef({})     // 버프/힐 수신 시 쓸 콜백 모음 (아래에서 채운다)

  /* ---------- 채팅 ---------- */
  const [chatOpen, setChatOpen] = useState(false)
  const chatMsgs = useRef([])
  const [, setChatTick] = useState(0)
  const chatInputRef = useRef(null)
  const chatListRef = useRef(null)
  const pushChat = useCallback((entry) => {
    chatMsgs.current.push({ ...entry, at: Date.now() })
    if (chatMsgs.current.length > 60) chatMsgs.current.splice(0, chatMsgs.current.length - 60)
    setChatTick((n) => n + 1)
    /* 새 메시지가 오면 목록을 맨 아래로 */
    setTimeout(() => { const el = chatListRef.current; if (el) el.scrollTop = el.scrollHeight }, 30)
  }, [])
  /* ---------- 쿠폰 코드 · 관리자 ----------
     채팅창 위의 작은 입력칸. 보상 코드는 계정당 한 번만 쓸 수 있고,
     관리자 아이디를 치면 비밀번호를 한 번 더 물어본다. */
  const [codeOpen, setCodeOpen] = useState(false)
  const [codeMsg, setCodeMsg] = useState(null)
  const [askPw, setAskPw] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [spectate, setSpectate] = useState(null)   // 관전 중인 상대 id
  const codeInputRef = useRef(null)

  const submitCode = useCallback((raw) => {
    const v = String(raw || '').trim()
    if (!v) return
    const s = S.current

    /* 비밀번호 확인 단계 */
    if (askPw) {
      setAskPw(false)
      if (isAdminPw(v)) {
        s.admin = true
        commit()
        setAdminOpen(true)
        setCodeMsg({ ok: true, txt: '관리자 모드가 열렸습니다' })
      } else {
        setCodeMsg({ ok: false, txt: '비밀번호가 올바르지 않습니다' })
      }
      return
    }

    const r = classifyCode(v)
    if (!r || r.kind === 'unknown') { setCodeMsg({ ok: false, txt: '존재하지 않는 코드입니다' }); return }
    if (r.kind === 'adminId') {
      setAskPw(true)
      setCodeMsg({ ok: true, txt: '비밀번호를 입력하세요' })
      return
    }
    /* 보상 코드 — 중복 사용 방지 */
    const used = s.usedCodes || {}
    if (used[r.code.id]) { setCodeMsg({ ok: false, txt: '이미 사용한 코드입니다' }); return }
    r.code.apply(s)
    s.usedCodes = { ...used, [r.code.id]: true }
    if (s.level > MAX_LEVEL) s.level = MAX_LEVEL
    commit()
    setCodeMsg({ ok: true, txt: `${r.code.label} 지급 완료!` })
    addToast(`🎁 코드 보상 — ${r.code.label}`)
  }, [askPw, commit, addToast])

  /* ---- 관리자 기능 ---- */
  const adminAct = useCallback((what, arg) => {
    const s = S.current
    if (!s.admin) return
    if (what === 'gold') { s.gold += 10000; addToast('🛠 골드 +10,000') }
    else if (what === 'levelup') { s.level = Math.min(MAX_LEVEL, s.level + 1); s.exp = 0; addToast(`🛠 레벨 ${s.level}`) }
    else if (what === 'maxlevel') { s.level = MAX_LEVEL; s.exp = 0; addToast(`🛠 만렙 ${MAX_LEVEL} 달성`) }
    else if (what === 'sp') { s.sp += 10; addToast('🛠 SP +10') }
    else if (what === 'nick') {
      const nn = String(arg || '').trim()
      if (nn.length < 2 || nn.length > 10) { addToast('닉네임은 2~10자'); return }
      const acc = { ...loadJSON(LS_ACCOUNT, {}), nick: nn }
      saveJSON(LS_ACCOUNT, acc)
      addToast(`🛠 닉네임 변경 — ${nn} (새로고침 후 적용)`)
    } else if (what === 'newchar') {
      addToast('🛠 캐릭터를 새로 만듭니다 — 직업 선택으로 이동')
      onResetCharacter({ admin: s.admin, usedCodes: s.usedCodes })
      return                              // 화면이 곧 바뀌므로 commit()은 의미 없다
    } else if (what === 'boost') {
      /* arg = { kind: 'exp'|'drop'|'gold', mul } — 다시 누르면 꺼진다(토글) */
      const { kind, mul } = arg || {}
      if (!kind) return
      const cur = s.adminBoost || { exp: 1, drop: 1, gold: 1 }
      const next = cur[kind] === mul ? 1 : mul
      s.adminBoost = { ...cur, [kind]: next }
      const label = kind === 'exp' ? '경험치' : kind === 'drop' ? '아이템 확률' : '골드 획득'
      addToast(next === 1 ? `🛠 ${label} 배율 해제` : `🛠 ${label} ×${next} 적용`)
      /* 방 전체에 방송 — 나뿐 아니라 접속한 모든 플레이어에게 적용된다 */
      netRef.current?.room.send({ t: 'srvBoost', boost: s.adminBoost })
    }
    commit()
  }, [commit, addToast, onResetCharacter])

  const sendChat = useCallback((raw) => {
    const txt = (raw || '').trim().slice(0, 120)
    if (!txt) return
    const r = netRef.current
    if (!r) return
    r.room.send({ t: 'chat', nick: account.nick, txt })
    pushChat({ nick: account.nick, txt, me: true })
  }, [account.nick, pushChat])

  /* ---------- 파티 ----------
     파티장이 명단의 진실을 갖고 스냅샷을 뿌린다. 나머지는 받은 것을 쓴다. */
  const [party, setPartyUI] = useState(null)
  const partyRef = useRef(null)
  const [partyOpen, setPartyOpen] = useState(false)
  const [pInvite, setPInvite] = useState(null)          // 받은 초대 팝업
  /* 인스턴스·거래·결투 상태 — uiOpen이 아래에서 참조하므로 여기서 선언한다 */
  const [inst, setInst] = useState(null)   // { kind, cid, inst, leaderId, size, wave, phase, done }
  const [trade, setTrade] = useState(null)
  const [tradeReq, setTradeReq] = useState(null)
  const [duelReq, setDuelReq] = useState(null)
  const [contentSel, setContentSel] = useState({ kind: 'dungeon', id: 0 })
  const contentSelRef = useRef(contentSel); contentSelRef.current = contentSel
  const enterInstanceRef = useRef(null)                 // 던전/레이드 입장 함수 (아래에서 채운다)

  const syncParty = useCallback(() => {
    const p = partyRef.current
    world.current.party = p
    setPartyUI(p ? partySnapshot(p) : null)
  }, [])

  const partyBroadcastSnap = useCallback(() => {
    const net = netRef.current
    const p = partyRef.current
    if (!net || !p || p.leaderId !== net.myId) return
    net.room.send({ t: 'pSnap', party: partySnapshot(p) })
  }, [])

  const inviteToParty = useCallback((targetId, targetNick) => {
    const net = netRef.current
    if (!net) return
    let p = partyRef.current
    if (p && p.leaderId !== net.myId) { addToast('파티장만 초대할 수 있습니다'); return }
    if (!p) {
      /* 처음 초대를 보내는 사람이 파티장이 된다 (사용자 확정 규칙) */
      p = partyCreate({ id: net.myId, nick: account.nick, cls: cls.id, level: S.current.level })
      partyRef.current = p
      syncParty()
    }
    if (p.members.length >= 10) { addToast('파티가 가득 찼습니다 (최대 10명)'); return }
    net.room.send({ t: 'pInv', to: targetId, nick: account.nick })
    addToast(`📨 ${targetNick}님에게 파티 초대를 보냈습니다`)
  }, [account.nick, cls.id, addToast, syncParty])

  const acceptInvite = useCallback(() => {
    const inv = pInvite
    setPInvite(null)
    const net = netRef.current
    if (!net || !inv) return
    net.room.send({ t: 'pAcc', to: inv.from, nick: account.nick, cls: cls.id, level: S.current.level })
  }, [pInvite, account.nick, cls.id])

  const declineInvite = useCallback(() => {
    const inv = pInvite
    setPInvite(null)
    const net = netRef.current
    if (net && inv) net.room.send({ t: 'pDec', to: inv.from, nick: account.nick })
  }, [pInvite, account.nick])

  const leaveParty = useCallback(() => {
    const net = netRef.current
    const p = partyRef.current
    if (!p) return
    if (net) net.room.send({ t: 'pLeave', pid: p.id, leader: p.leaderId === net.myId })
    partyRef.current = null
    syncParty()
    addToast('파티에서 나왔습니다')
  }, [addToast, syncParty])

  const toggleReady = useCallback(() => {
    const net = netRef.current
    const p = partyRef.current
    if (!net || !p) return
    const me = p.members.find((m) => m.id === net.myId)
    if (!me || p.leaderId === net.myId) return
    net.room.send({ t: 'pReady', pid: p.id, ready: !me.ready })
  }, [])

  const startParty = useCallback((solo) => {
    const net = netRef.current
    if (!net) return
    const { kind, id } = contentSelRef.current

    /* 솔로 레이드 — 파티 없이 혼자 들어간다. 대신 보스가 약해진다 (사용자 확정).
       인원 요구·용병 채움 로직을 전부 건너뛰는 별도 경로다. */
    if (solo) {
      if (kind !== 'raid') return
      if (partyRef.current && partyRef.current.members.length > 1) {
        addToast('⚠ 파티원이 있으면 솔로 레이드를 시작할 수 없습니다 — 파티를 나가주세요')
        return
      }
      const reqLv = RAID_BY_ID[id].reqLv
      if (S.current.level < reqLv) { addToast(`⚠ Lv.${reqLv} 이상 필요`); return }
      const inst = 'rd_' + Date.now().toString(36)
      net.room.send({ t: 'pStart', pid: net.myId, kind: 'raid', cid: id, inst, size: 1, ai: 0, solo: true })
      if (enterInstanceRef.current) enterInstanceRef.current('raid', id, inst, net.myId, 1, 0, true)
      setPartyOpen(false)
      return
    }

    /* 파티가 없어도 혼자 들어갈 수 있다 — 모자란 자리는 AI 동료가 채운다 */
    let p = partyRef.current
    if (!p) {
      p = partyCreate({ id: net.myId, nick: account.nick, cls: cls.id, level: S.current.level })
      partyRef.current = p
      syncParty()
    }
    if (p.leaderId !== net.myId) return
    /* 준비 상태만 확인하고, 인원 미달은 AI로 메운다 */
    const notReady = p.members.filter((m) => m.id !== p.leaderId && !m.ready)
    if (notReady.length) { addToast(`⚠ 준비 안 됨: ${notReady.map((m) => m.nick).join(', ')}`); return }
    const max = kind === 'dungeon' ? 6 : 10
    if (p.members.length > max) { addToast(`⚠ ${kind === 'dungeon' ? '던전' : '레이드'}는 최대 ${max}명입니다`); return }
    const reqLv = kind === 'dungeon' ? DUNGEON_BY_ID[id].reqLv : RAID_BY_ID[id].reqLv
    const under = p.members.filter((m) => (m.level || 1) < reqLv)
    if (under.length) { addToast(`⚠ 레벨 부족: ${under.map((m) => m.nick).join(', ')} (Lv.${reqLv} 필요)`); return }

    /* 용병은 메인 퀘스트를 진행하는 동안에만 자리를 채운다 (사용자 확정).
       퀘스트를 다 끝낸 뒤에는 사람을 모아야 한다. */
    const questNeedsAlly = !allQuestsDone(S.current)
    const minNeed = kind === 'raid' ? 4 : 1
    const shortfall = Math.max(0, minNeed - p.members.length)
    if (shortfall > 0 && !questNeedsAlly) {
      addToast(`⚠ ${kind === 'raid' ? '레이드' : '던전'}는 ${minNeed}명이 필요합니다 — 용병은 메인 퀘스트 중에만 도와줍니다`)
      return
    }
    const aiCount = questNeedsAlly ? shortfall : 0
    const inst = (kind === 'dungeon' ? 'dg_' : 'rd_') + Date.now().toString(36)
    const size = p.members.length + aiCount
    net.room.send({ t: 'pStart', pid: p.id, kind, cid: id, inst, size, ai: aiCount })
    if (enterInstanceRef.current) enterInstanceRef.current(kind, id, inst, p.leaderId, size, aiCount)
    setPartyOpen(false)
  }, [addToast, account.nick, cls.id, syncParty])

  /* ---- 파티 메시지 수신 처리 (wiring effect에서 supportRef로 호출) ---- */
  const onPartyAccept = useCallback((m) => {
    const net = netRef.current
    const p = partyRef.current
    if (!net || !p || p.leaderId !== net.myId) return
    const res = partyAdd(p, { id: m.id, nick: m.nick, cls: m.cls, level: m.level })
    if (!res.ok) { net.room.send({ t: 'pDec', to: m.id, nick: account.nick, busy: false }); addToast('⚠ ' + res.reason); return }
    syncParty()
    partyBroadcastSnap()
    addToast(`🎉 ${m.nick}님이 파티에 들어왔습니다`)
    pushChat({ sys: true, txt: `${m.nick}님이 파티에 합류했습니다` })
  }, [account.nick, addToast, syncParty, partyBroadcastSnap, pushChat])

  const onPartySnap = useCallback((m) => {
    const net = netRef.current
    if (!net || !m.party || m.party.leaderId !== m.id) return   // 파티장 본인의 스냅샷만 신뢰
    const mine = m.party.members.some((x) => x.id === net.myId)
    const p = partyRef.current
    if (mine) { partyRef.current = m.party; syncParty() }
    else if (p && p.id === m.party.id) { partyRef.current = null; syncParty(); addToast('파티에서 제외되었습니다') }
  }, [syncParty, addToast])

  const onPartyReady = useCallback((m) => {
    const net = netRef.current
    const p = partyRef.current
    if (!net || !p || p.leaderId !== net.myId || m.pid !== p.id) return
    if (!p.members.some((x) => x.id === m.id)) return
    partySetReady(p, m.id, m.ready)
    syncParty()
    partyBroadcastSnap()
  }, [syncParty, partyBroadcastSnap])

  const onPartyLeave = useCallback((m) => {
    const net = netRef.current
    const p = partyRef.current
    if (!net || !p || m.pid !== p.id) return
    if (m.leader || m.id === p.leaderId) {
      partyRef.current = null
      syncParty()
      addToast('👋 파티장이 나가서 파티가 해산되었습니다')
      return
    }
    if (p.leaderId === net.myId) {
      partyRemove(p, m.id)
      syncParty()
      partyBroadcastSnap()
      addToast('👋 파티원이 나갔습니다')
    }
  }, [syncParty, partyBroadcastSnap, addToast])

  const onPartyStart = useCallback((m) => {
    const net = netRef.current
    const p = partyRef.current
    if (!net || !p || m.pid !== p.id || m.id !== p.leaderId) return
    if (enterInstanceRef.current) enterInstanceRef.current(m.kind, m.cid, m.inst, p.leaderId, m.size, m.ai || 0, !!m.solo)
  }, [])

  /* 파티장이 소리 없이 사라지면(하트비트 유실) 파티를 정리한다 */
  const checkPartyLeader = useCallback(() => {
    const net = netRef.current
    const p = partyRef.current
    if (!net || !p || p.leaderId === net.myId) return
    if (!net.room.members().some((m) => m.id === p.leaderId)) {
      partyRef.current = null
      syncParty()
      addToast('👋 파티장의 연결이 끊겨 파티가 해산되었습니다')
    }
  }, [syncParty, addToast])
  const [roster, setRoster] = useState([])       // 같은 맵에 있는 접속자 (렌더용)
  const [allPlayers, setAllPlayers] = useState([])   // 방 전체 접속자 (다른 맵 포함 — 관리자 관전용)
  const [roomOpen, setRoomOpen] = useState(false)
  const identityRef = useRef({ nick: account.nick, cls: cls.id, wtype: null })

  const [, setTick] = useState(0)
  const bumpHud = useCallback(() => setTick((t) => t + 1), [])

  const [mode, setMode] = useState('field')
  const modeRef = useRef(mode); modeRef.current = mode
  const [mapId, setMapId] = useState(() => S.current.map || 0)
  const mapIdRef = useRef(mapId); mapIdRef.current = mapId
  world.current.mapId = mapId
  const mapDef = MAP_BY_ID[mapId]
  const [botCls, setBotCls] = useState(null)
  const [botDiff, setBotDiff] = useState(null)
  const [mathModal, setMathModal] = useState(null)
  const [death, setDeath] = useState(null)
  const [invOpen, setInvOpen] = useState(false)
  const [treeOpen, setTreeOpen] = useState(false)
  const [npcModal, setNpcModal] = useState(null)
  const [diffModal, setDiffModal] = useState(false)
  const [fx, setFx] = useState([])
  const fxId = useRef(0)
  const [fragments, setFragments] = useState([])
  const fragId = useRef(1)

  const uiOpen = !!mathModal || !!death || invOpen || treeOpen || !!npcModal || diffModal
    || partyOpen || !!trade || !!tradeReq || !!duelReq || !!pInvite || roomOpen
  controlRef.current.lock = uiOpen
  const uiOpenRef = useRef(uiOpen); uiOpenRef.current = uiOpen

  const pushFx = useCallback((f) => setFx((l) => [...l.slice(-10), { id: ++fxId.current, ...f }]), [])
  const fxDone = useCallback((id) => setFx((l) => l.filter((f) => f.id !== id)), [])

  const equippedWeapon = saveUI.equip.weapon
  const wtype = equippedWeapon ? equippedWeapon.wtype : cls.weapon
  const weaponGradeColor = equippedWeapon ? gradeOf(equippedWeapon.grade).color : null

  /* 콘텐츠 잠금 안내 */
  const lockedNotice = useCallback(() => {
    addToast('🔒 이장의 튜토리얼(토끼 간 10개)을 먼저 완료하세요')
  }, [addToast])
  world.current.onEdge = useCallback(() => {
    addToast('🔒 아직 마을 밖은 위험합니다 — 튜토리얼을 완료하세요')
  }, [addToast])
  useEffect(() => { world.current.tutorLock = !unlocked && mapId === 0 }, [unlocked, mapId])

  /* ---------- 몬스터 ---------- */
  const nextMobId = useRef(1)
  const spawnForMap = useCallback((mid) => {
    const md = MAP_BY_ID[mid]
    const near = mid === 0 && !S.current.unlocked
    const list = []
    for (let i = 0; i < md.count; i++) {
      const spot = pickSpotMap(list, { x: 0, z: 3 }, mid, near)
      list.push({ id: nextMobId.current++, type: md.mob, scale: MOB_SCALE[md.mob] || 1, ...spot })
    }
    return list
  }, [])
  const [mobs, setMobs] = useState(() => spawnForMap(S.current.map || 0))
  const onMobRespawn = useCallback((deadId) => {
    setMobs((ms) => ms.map((m) => {
      if (m.id !== deadId) return m
      const others = ms.filter((x) => x.id !== deadId)
      const spot = pickSpotMap(others, world.current.player, mapIdRef.current, mapIdRef.current === 0 && !S.current.unlocked)
      return { ...m, id: nextMobId.current++, ...spot }
    }))
  }, [])

  const addItem = useCallback((item, silent) => {
    S.current.bag.push(item)
    if (!silent) addToast(`🎁 [${gradeOf(item.grade).name}] ${item.name} 획득!`)
  }, [addToast])

  /* ---------- 맵별 사이드 퀘스트 ---------- */
  const [sqModal, setSqModal] = useState(null)      // 열려 있는 NPC 퀘스트 id
  const sqSpots = useMemo(() => npcSpotsForMap(mapId, MAP_BY_ID[mapId].half), [mapId])
  world.current.sqSpots = mode === 'field' ? sqSpots : []

  const acceptSq = useCallback((id) => {
    const s = S.current
    const q = SQ_BY_ID[id]
    if (!q) return
    if (s.level < q.reqLv) { addToast(`🔒 Lv.${q.reqLv} 이상이어야 받을 수 있습니다`); return }
    s.sq = { ...(s.sq || {}), [id]: {
      state: 'active',
      base: q.type === 'boss' ? (s.dungeonClears || 0) + (s.raidClears || 0) : s.kills,
      got: 0,
    } }
    commit()
    addToast(`📜 [${q.title}] 수락 — ${q.desc}`)
  }, [commit, addToast])

  const turnInSq = useCallback((id) => {
    const s = S.current
    const q = SQ_BY_ID[id]
    if (!q || !sqComplete(s, q)) return
    s.sq = { ...(s.sq || {}), [id]: { state: 'done', base: 0, got: 0 } }
    s.gold += Math.round(q.gold * adminMul(s, 'gold'))
    const ev = applyExp(s, q.exp * (1 + statsRef.current.expGain / 100))
    /* 룬 퀘스트 — 상점에서 살 수 없는 룬을 여기서 확정 지급한다 */
    if (q.rune) addItem(makeRune(s, Math.min(MAX_GRADE, 1 + Math.floor(q.reqLv / 12))))
    commit()
    addToast(`✅ [${q.title}] 완료! +${q.exp.toLocaleString()} EXP, +${q.gold.toLocaleString()} G`)
    ev.forEach(addToast)
    setSqModal(null)
  }, [commit, addToast, addItem])

  /* ---------- 히든 직업 지점 상호작용 ---------- */
  const onHiddenSpot = useCallback((key) => {
    const s = S.current
    if (key === 'magic_falls') {
      /* 폭포 안으로 들어가면 즉시 마검사 (사용자 확정) */
      if ((s.hidden || {}).spellblade) { addToast('이미 마검사의 길을 걸었습니다'); return }
      becomeHiddenRef.current('spellblade')
    } else if (key === 'fairy_grove') {
      if ((s.fairies || 0) >= FAIRY_CAP) {
        addToast(`🧚 요정 ${FAIRY_CAP}명을 다 모았습니다 — 마을 마법사 전직관으로 가세요`)
        return
      }
      /* E를 꾹 누르고 있으면 10초에 1마리씩 모인다 */
      addToast(`🧚 E를 꾹 누르고 있으세요 — ${FAIRY_GATHER_SEC}초당 1마리`)
    } else if (key === 'dark_altar') {
      if ((s.oneShotPvp || 0) < 5) {
        addToast(`🕯️ 제사에는 한방 승리 5회가 필요합니다 (현재 ${s.oneShotPvp || 0}회)`)
        return
      }
      becomeHiddenRef.current('darkassassin')
    } else if (key === 'moon_sea') {
      if ((s.fragments || 0) < 1000) {
        addToast(`🌘 달조각 1000개가 필요합니다 (현재 ${Math.floor(s.fragments || 0)}개)`)
        return
      }
      /* 구덩이 안에서 스킬 3개를 쓰면 전직 — 여기서는 안내만 */
      const used = (live.current.moonRite || new Set()).size
      addToast(`🌘 구덩이 안에서 서로 다른 스킬 3개를 사용하세요 (${used}/3)`)
    }
  }, [addToast])
  const hiddenSpotRef = useRef(onHiddenSpot); hiddenSpotRef.current = onHiddenSpot
  const becomeHiddenRef = useRef(null)

  /* 이 맵의 히든 직업 지점 (있으면) */
  const hiddenSpot = useMemo(() => {
    const key = MAP_BY_ID[mapId].special
    if (!key) return null
    const sp = SPECIAL_SPOTS[key]
    return sp ? { ...sp, key } : null
  }, [mapId])
  world.current.hiddenSpot = mode === 'field' ? hiddenSpot : null

  /* 요정 1마리 획득 */
  world.current.onFairy = useCallback(() => {
    const s = S.current
    if ((s.fairies || 0) >= FAIRY_CAP) return
    s.fairies = (s.fairies || 0) + 1
    commit()
    addToast(`🧚 요정이 따라옵니다 (${s.fairies}/${FAIRY_CAP})`)
    if (s.fairies >= FAIRY_CAP) addToast('✨ 요정을 다 모았습니다 — 마을 마법사 전직관으로!')
  }, [commit, addToast])


  const onMobKill = useCallback((entry) => {
    const s = S.current
    const st = statsRef.current
    s.kills += 1
    const mt = MOB_TYPES[(entry && entry.type) || 'rabbit']
    s.gold += Math.round((mt.gold + Math.floor(Math.random() * (mt.gold * 0.4 + 2))) * (1 + st.goldGain / 100) * adminMul(s, 'gold'))
    /* 튜토리얼: 토끼 간 */
    if (s.tutorial === 'active' && s.livers < LIVER_NEED && Math.random() < LIVER_DROP) {
      s.livers += 1
      addToast(`🥩 토끼 간 획득! (${s.livers}/${LIVER_NEED})`)
      if (s.livers >= LIVER_NEED) addToast('📜 다 모았다 — 이장에게 돌아가자!')
    }
    /* 진행 중인 수집형 사이드 퀘스트 — 이 맵의 것만 확률로 쌓인다 */
    if (s.sq) {
      let picked = null
      for (const q of questsForMap(mapIdRef.current)) {
        const e = s.sq[q.id]
        if (!e || e.state !== 'active' || q.type !== 'collect') continue
        if ((e.got || 0) >= q.need) continue
        if (Math.random() < Math.min(1, (q.drop || 0.4) * adminMul(s, 'drop'))) {
          e.got = (e.got || 0) + 1
          picked = `${q.item} (${e.got}/${q.need})`
          if (e.got >= q.need) picked += ' — 다 모았다!'
        }
      }
      if (picked) addToast(`📦 ${picked}`)
    }
    const ev = applyExp(s, mt.exp * (1 + st.expGain / 100))
    if (s.unlocked) {
      const luck = (1 + (st.luck || 0) / 100) * adminMul(s, 'drop')
      /* 룬은 사냥에서만, 아주 드물게 (상점에서는 살 수 없다) */
      if (Math.random() < RUNE_DROP * luck) addItem(makeRune(s, MAX_GRADE))
      else {
        /* 무기·방어구 — 등급별 확률로 판정, 아무것도 안 나오는 게 대부분 */
        const g = rollDrop(luck)
        if (g != null) addItem(Math.random() < 0.5 ? makeArmor(s, g, true) : makeWeapon(s, g, undefined, true))
      }
    }
    commit()
    ev.forEach(addToast)
  }, [commit, addToast, addItem])

  /* ---------- 직업 성장 기믹 (1회 = +0.01) ---------- */
  const growTraining = useCallback(() => {
    if (!S.current.unlocked) return
    const s = S.current
    s.atkBonus += GROWTH_STEP; s.trainSwings += 1
    commit()
    if (s.trainSwings % 10 === 0) addToast(`🗡 수련 ${s.trainSwings}회 — 공격력 +${(s.trainSwings * GROWTH_STEP).toFixed(2)}`)
  }, [commit, addToast])
  const onTargetHit = useCallback(() => {
    if (cls.id !== 'archer' || !S.current.unlocked) return
    S.current.atkBonus += GROWTH_STEP; S.current.targetsHit += 1; commit()
    if (S.current.targetsHit % 10 === 0) addToast(`🎯 명중 ${S.current.targetsHit}회 — 공격력 +${(S.current.targetsHit * GROWTH_STEP).toFixed(2)}`)
  }, [cls, commit, addToast])
  const onHealDummy = useCallback(() => {
    if (cls.id !== 'healer' || !S.current.unlocked) return
    S.current.healPower += GROWTH_STEP; S.current.heals += 1; commit()
    if (S.current.heals % 10 === 0) addToast(`💖 치유 ${S.current.heals}회 — 치유력 +${(S.current.heals * GROWTH_STEP).toFixed(2)}`)
  }, [cls, commit, addToast])
  const onSermon = useCallback(() => {
    bumpHud()
    if (!S.current.unlocked) { lockedNotice(); return }
    if (cls.id !== 'priest') { addToast('설교를 들었다'); return }
    S.current.buffCoef += GROWTH_STEP; S.current.sermons += 1; commit()
    addToast(`✝️ 설교 ${S.current.sermons}회 — 축복 계수 +${(S.current.sermons * GROWTH_STEP).toFixed(2)}`)
  }, [cls, commit, addToast, bumpHud, lockedNotice])
  const onFragment = useCallback((id) => {
    if (!world.current.fragments.has(id)) return
    world.current.fragments.delete(id)
    setFragments((l) => l.filter((f) => f.id !== id))
    if (cls.id === 'moon' && S.current.unlocked) {
      S.current.debuffPower += GROWTH_STEP; S.current.fragments += 1; commit()
      addToast(`🌙 달조각 ${S.current.fragments}개 — 저주 위력 +${(S.current.fragments * GROWTH_STEP).toFixed(2)}`)
    }
  }, [cls, commit, addToast])

  useEffect(() => {
    const m = world.current.fragments
    m.clear()
    fragments.forEach((f) => m.set(f.id, { x: f.x, z: f.z }))
  }, [fragments])
  useEffect(() => {
    if (cls.id !== 'moon') return
    const iv = setInterval(() => {
      if (modeRef.current !== 'field' || !S.current.unlocked) return
      setFragments((l) => {
        if (l.length >= 4) return l
        const spot = pickSpot([], world.current.player, false)
        return [...l, { id: fragId.current++, x: spot.x, z: spot.z }]
      })
    }, 6000)
    return () => clearInterval(iv)
  }, [cls])

  /* ---------- 피격 · 사망 ---------- */
  const hitPlayer = useCallback((rawDmg) => {
    const L = live.current
    const st = statsRef.current
    if (L.dead || L.iframe > 0) return
    /* 어둠의 암살자는 빙의 중에는 몸이 없는 것과 같다 — 피해를 받지 않는다 (사용자 확정) */
    if (L.possess) return
    /* 어둠의 암살자 — F 폭주 중에는 받는 피해가 완전히 무효화된다 (사용자 확정) */
    if (L.burst && performance.now() < L.burst.until) return
    if (Math.random() * 100 < st.dodge) { addToast('✨ 회피!'); return }
    /* 성직자 축복 반영 — 방어력 보정치와 피해 감소 버프 */
    const defF = buffSum(L, 'defF')
    const redP = Math.min(80, st.dmgReduce + buffSum(L, 'redP'))
    let dmg = rawDmg * (1 - defReduce(st.defense + defF)) * (1 - redP / 100)
    dmg = Math.max(1, Math.round(dmg))
    /* 보호막이 먼저 흡수한다 */
    dmg = absorbShield(L, dmg)
    if (dmg <= 0) { L.iframe = PLAYER_IFRAME * 0.5; bumpHud(); return }
    L.hp = Math.max(0, L.hp - dmg); L.iframe = PLAYER_IFRAME; L.hurtT = 0.5; L.lastHurt = performance.now()
    if (st.thorns > 0 && world.current.bot && world.current.bot.alive) {
      world.current.bot.hit({ x: 0, z: 1 }, Math.max(1, Math.round(dmg * st.thorns / 100)))
    }
    if (cls.id === 'warrior' && S.current.unlocked) {
      S.current.atkBonus += GROWTH_STEP; S.current.dmgTaken += dmg; commit()
    }
    bumpHud()
    if (L.hp <= 0) {
      L.dead = true
      /* 결투에서 지면 골드를 잃지 않는다 — 상대에게 패배를 알린다 */
      if (duelRef.current) { endDuelRef.current(false); return }
      /* 던전·레이드에서는 골드를 잃지 않고 부활을 기다린다 */
      if (world.current.inst) { setDeath({ lost: 0, inst: true }); return }
      const lost = Math.floor(S.current.gold * 0.1)
      S.current.gold -= lost; commit()
      setDeath({ lost, arena: modeRef.current === 'arena' })
    }
  }, [cls, commit, bumpHud, addToast])
  world.current.hitPlayer = hitPlayer
  world.current.playerMaxHp = stats.maxHp
  world.current.spectate = spectate
  live.current.isDark = cls.id === 'darkassassin'
  /* AI 동료(힐러·성직자)가 나를 치유할 때 쓰는 통로 */
  world.current.healAlly = useCallback((amount) => {
    const L = live.current
    if (L.dead) return
    L.hp = Math.min(statsRef.current.maxHp, L.hp + amount)
    setFx((l) => [...l.slice(-10), { id: ++fxId.current, kind: 'heal', x: world.current.player.x, z: world.current.player.z }])
    bumpHud()
  }, [bumpHud])

  /* ---------- 멀티플레이 배선 ----------
     방에 들어가 있는 동안에만 world.current.net이 채워진다.
     나가면 즉시 null이 되어 혼자 하던 동작으로 돌아간다. */
  const roomRef = room.roomRef
  const roomConnected = room.connected
  const roomIsHost = room.isHost

  useEffect(() => {
    const w = world.current            // 게임이 사는 동안 바뀌지 않는 객체
    const r = roomRef.current
    if (!roomConnected || !r) {
      w.net = null
      netRef.current = null
      w.peers.clear()
      setRoster([])
      return
    }
    const net = {
      room: r, myId: r.id, isHost: true, mobSnap: new Map(), pendingMobs: null, swingSeq: 0,
      /* simOwner: 지금 내 zone의 몹 시뮬레이션을 내가 소유하는가.
         필드 = 그 맵 필드에 있는 사람 중 최선임, 인스턴스 = 파티장. */
      simOwner: true, snapZone: null,
    }
    netRef.current = net
    w.net = net

    /* 다른 사람의 위치 수신 */
    const offState = r.on('state', (m) => {
      let p = w.peers.get(m.id)
      if (!p) { p = { peerId: m.id, alive: true, rx: m.x, rz: m.z, ryaw: m.yaw, playedSeq: m.sw }; w.peers.set(m.id, p) }
      p.x = m.x; p.z = m.z; p.yaw = m.yaw; p.mapId = m.mapId
      p.hp = m.hp; p.maxHp = m.maxHp; p.dead = !!m.dead
      p.md = m.md
      p.inst = m.in || null
      p.arena = m.md === 'arena' && !m.in   // 혼자 AI 투기장에 있는 동안은 필드에서 빠진다
      p.nick = m.nick; p.cls = m.cls; p.wtype = m.wtype
      p.swingSeq = m.sw
      p.stealth = !!m.hid            // 은신 중이면 그리지 않는다
      p.at = performance.now()
    })

    /* 다른 사람의 공격 의도 — 그 zone의 시뮬 소유자만 실제 HP에 반영한다 */
    const offHit = r.on('hit', (m) => {
      if (!net.simOwner) return
      const mob = w.mobs.get(m.mobId)
      if (mob && mob.alive) mob.hit({ x: m.dx, z: m.dz }, m.dmg, m.id)
    })

    /* 호스트가 "네가 몬스터에게 맞았다"고 알려온 경우 */
    const offMobHit = r.on('mobHit', (m) => {
      if (m.target !== net.myId) return
      if (w.hitPlayer) w.hitPlayer(m.dmg)
    })

    /* 시뮬 소유자가 뿌린 몬스터 상태 */
    const offMobs = r.on('mobs', (m) => {
      if (net.simOwner) return                   // 내가 소유자면 내 것이 진실
      net.snapZone = m.in || 'm' + m.mapId       // 어느 zone의 스냅샷이 흐르는지 기록
      if (net.snapZone !== zoneOf(w.inst, mapIdRef.current)) return   // 내 zone이 아니면 무시
      const list = decodeMobs(m.list)
      net.mobSnap.clear()
      for (const x of list) net.mobSnap.set(x.id, x)
      net.pendingMobs = list
    })

    const offLeave = r.on('leave', ({ id }) => { w.peers.delete(id) })

    /* 같은 zone에서 온 메시지인가 */
    const fromMyZone = (m) => zoneOf(m.in || null, m.mapId) === zoneOf(w.inst, mapIdRef.current)

    /* 성직자 축복 — 시전 지점 반경 안에 있으면 내 버프에 얹는다 */
    const offBuff = r.on('buff', (m) => {
      if (!fromMyZone(m)) return
      if (dist2(w.player.x, w.player.z, m.x, m.z) > m.r) return
      supportRef.current.applyBuffList?.(m.list, m.dur)
      addToast(`🕊️ ${m.nick || '아군'}의 축복을 받았다`)
    })

    /* 힐러 회복 — 죽어 있으면 부활 스킬만 듣는다 */
    const offHeal = r.on('heal', (m) => {
      if (!fromMyZone(m)) return
      if (dist2(w.player.x, w.player.z, m.x, m.z) > m.r) return
      if (live.current.dead) {
        if (m.revive) { supportRef.current.reviveInPlace?.(0.5); addToast(`💗 ${m.nick || '힐러'}가 당신을 되살렸다!`) }
        return
      }
      supportRef.current.selfHeal?.(m.amount, m.hot, m.shield)
    })

    /* 달의 사제 저주 — 몹 시뮬 소유자만 실제로 적용한다 */
    const offMobDebuff = r.on('mobDebuff', (m) => {
      if (!fromMyZone(m)) return
      if (!net.simOwner) return
      applyMobDebuffs(w, m.ids, m.debs, m.dur, m.id)
    })

    /* 채팅 — 방 전체 공용 (zone 무관) */
    const offChat = r.on('chat', (m) => {
      if (typeof m.txt !== 'string') return
      supportRef.current.pushChat?.({ nick: m.nick || '???', txt: m.txt.slice(0, 120) })
    })

    /* 관리자 서버 전체 버프 — 받는 즉시 내 세이브에도 적용된다 (방 전체 공용) */
    const offSrvBoost = r.on('srvBoost', (m) => {
      if (!m.boost) return
      S.current.adminBoost = m.boost
      commit()
    })

    /* 새로 들어온 사람에게는 현재 켜진 서버 버프를 다시 알려준다 (늦게 접속해도 놓치지 않도록) */
    const offJoin = r.on('join', () => {
      const b = S.current.admin && S.current.adminBoost
      if (b && (b.exp > 1 || b.drop > 1 || b.gold > 1)) {
        r.send({ t: 'srvBoost', boost: b })
      }
    })

    /* ---------- 파티 메시지 ---------- */
    const offPInv = r.on('pInv', (m) => {
      if (m.to !== net.myId) return
      if (supportRef.current.hasParty?.()) {
        r.send({ t: 'pDec', to: m.id, nick: identityRef.current.nick, busy: true })
        return
      }
      supportRef.current.setPInvite?.({ from: m.id, nick: m.nick || '???' })
    })

    const offPAcc = r.on('pAcc', (m) => {
      if (m.to !== net.myId) return
      supportRef.current.onPartyAccept?.(m)
    })

    const offPDec = r.on('pDec', (m) => {
      if (m.to !== net.myId) return
      addToast(m.busy ? `💤 ${m.nick || '상대'}님은 이미 파티 중입니다` : `🙅 ${m.nick || '상대'}님이 초대를 거절했습니다`)
    })

    const offPSnap = r.on('pSnap', (m) => {
      supportRef.current.onPartySnap?.(m)
    })

    const offPReady = r.on('pReady', (m) => {
      supportRef.current.onPartyReady?.(m)
    })

    const offPLeave = r.on('pLeave', (m) => {
      supportRef.current.onPartyLeave?.(m)
    })

    const offPStart = r.on('pStart', (m) => {
      supportRef.current.onPartyStart?.(m)
    })

    /* ---------- 던전 · 레이드 진행 (파티장이 보낸다) ---------- */
    const inMyInst = (m) => w.inst && m.inst === w.inst && m.id === w.instLeader
    const offDgWave = r.on('dgWave', (m) => { if (inMyInst(m)) supportRef.current.onInstWave?.(m) })
    const offDgPhase = r.on('dgPhase', (m) => { if (inMyInst(m)) supportRef.current.onInstPhase?.(m) })
    const offDgEnd = r.on('dgEnd', (m) => { if (inMyInst(m)) supportRef.current.onInstEnd?.(m) })
    /* 보스 광역기 — 파티장이 판정해 맞은 사람에게 알린다 */
    const offDgAoe = r.on('dgAoe', (m) => { if (inMyInst(m)) supportRef.current.onInstAoe?.(m) })

    /* ---------- 거래 ---------- */
    const mine = (m) => m.to === net.myId
    const offTrReq = r.on('trReq', (m) => { if (mine(m)) supportRef.current.onTradeReq?.(m) })
    const offTrAcc = r.on('trAcc', (m) => { if (mine(m)) supportRef.current.onTradeAcc?.(m) })
    const offTrOffer = r.on('trOffer', (m) => { if (mine(m)) supportRef.current.onTradeOffer?.(m) })
    const offTrLock = r.on('trLock', (m) => { if (mine(m)) supportRef.current.onTradeLock?.(m) })
    const offTrConf = r.on('trConfirm', (m) => { if (mine(m)) supportRef.current.onTradeConfirm?.(m) })
    const offTrCancel = r.on('trCancel', (m) => { if (mine(m)) supportRef.current.onTradeCancel?.(m) })

    /* ---------- 결투 ---------- */
    const offDlReq = r.on('dlReq', (m) => { if (mine(m)) supportRef.current.onDuelReq?.(m) })
    const offDlAcc = r.on('dlAcc', (m) => { if (mine(m)) supportRef.current.onDuelAcc?.(m) })
    const offDlDec = r.on('dlDec', (m) => { if (mine(m)) addToast(`🙅 ${m.nick || '상대'}님이 결투를 거절했습니다`) })
    const offDlHit = r.on('dlHit', (m) => { if (mine(m)) supportRef.current.onDuelHit?.(m) })
    const offDlEnd = r.on('dlEnd', (m) => { if (mine(m)) supportRef.current.onDuelEnd?.(m) })

    return () => {
      offDgWave(); offDgPhase(); offDgEnd(); offDgAoe()
      offTrReq(); offTrAcc(); offTrOffer(); offTrLock(); offTrConf(); offTrCancel()
      offDlReq(); offDlAcc(); offDlDec(); offDlHit(); offDlEnd()
      offState(); offHit(); offMobHit(); offMobs(); offLeave()
      offBuff(); offHeal(); offMobDebuff(); offChat(); offSrvBoost(); offJoin()
      offPInv(); offPAcc(); offPDec(); offPSnap(); offPReady(); offPLeave(); offPStart()
      w.net = null
      netRef.current = null
      w.peers.clear()
      setRoster([])
    }
  }, [roomConnected, roomRef, addToast, commit])

  /* 호스트 승계는 언제든 일어날 수 있다 — 매 프레임 읽히는 ref에 반영 */
  useEffect(() => {
    if (netRef.current) netRef.current.isHost = roomIsHost
  }, [roomIsHost])

  /* 내 정보가 바뀌면 방에 알린다 */
  useEffect(() => {
    identityRef.current = { nick: account.nick, cls: cls.id, wtype }
    if (roomRef.current) roomRef.current.update({ cls: cls.id, level: saveUI.level, mapId })
  }, [account.nick, cls.id, wtype, saveUI.level, mapId, roomRef])

  /* 화면에 그릴 접속자 명단 — 나와 같은 zone에 있는 사람만 (파티·거래·대결용) */
  const refreshRoster = useCallback(() => {
    const here = []
    for (const p of world.current.peers.values()) {
      if (peerInZone(p, world.current.inst, mapIdRef.current)) here.push({ id: p.peerId, nick: p.nick, cls: p.cls, wtype: p.wtype })
    }
    setRoster((prev) => {
      if (prev.length === here.length && prev.every((x, i) => x.id === here[i].id && x.cls === here[i].cls && x.wtype === here[i].wtype)) return prev
      return here
    })

    /* 관리자 관전용 — 맵이 달라도 방에 있는 사람 전원을 본다 */
    const all = []
    for (const p of world.current.peers.values()) {
      all.push({
        id: p.peerId, nick: p.nick, cls: p.cls,
        mapId: p.mapId, mapName: MAP_BY_ID[p.mapId] ? MAP_BY_ID[p.mapId].name : '?',
        inst: p.inst || null, arena: !!p.arena, dead: !!p.dead,
      })
    }
    setAllPlayers((prev) => {
      if (prev.length === all.length && prev.every((x, i) => x.id === all[i].id && x.mapId === all[i].mapId
        && x.inst === all[i].inst && x.dead === all[i].dead)) return prev
      return all
    })
  }, [])

  /* 호스트가 보낸 몬스터 구성으로 교체 (팔로워 전용) */
  const applyRemoteMobs = useCallback((list) => {
    setMobs((prev) => (sameIds(prev, list) ? prev : list.map((m) => ({
      id: m.id, type: m.type, scale: m.scale, x: m.x, z: m.z, rank: m.rank,
      hpMul: m.maxHp && MOB_TYPES[m.type] ? m.maxHp / MOB_TYPES[m.type].hp : 1,
    }))))
  }, [])

  /* 혼자 하기를 직접 고른 경우에만 자동 접속을 멈춘다 */
  const soloRef = useRef(false)

  const joinRoom = useCallback((silent) => {
    soloRef.current = false
    room.join(WORLD_ROOM, {
      id: getPeerId(), nick: account.nick, cls: cls.id, level: S.current.level, mapId: mapIdRef.current,
    })
    if (!silent) { setRoomOpen(false); addToast('🌐 월드에 접속했습니다') }
  }, [room, account.nick, cls.id, addToast])

  const leaveRoom = useCallback(() => {
    soloRef.current = true
    room.leave()
    addToast('🌐 혼자 하기로 전환했습니다')
  }, [room, addToast])

  /* 맵에 들어오면 코드 입력 없이 곧바로 월드에 연결한다 */
  useEffect(() => {
    if (roomConnected || soloRef.current) return
    joinRoom(true)
  }, [roomConnected, joinRoom])

  useNetPump({
    world, live, netRef, mapIdRef, modeRef, identityRef,
    onMobList: applyRemoteMobs, onRoster: refreshRoster, onSweep: checkPartyLeader,
    active: roomConnected,
  })

  /* 방에서 나가면 파티도 정리한다 */
  useEffect(() => {
    if (roomConnected) return
    partyRef.current = null
    world.current.party = null
    setPartyUI(null)
    setPInvite(null)
  }, [roomConnected])

  const revive = useCallback(() => {
    const L = live.current
    L.hp = statsRef.current.maxHp; L.dead = false; L.iframe = 2; L.arrows.length = 0
    if (modeRef.current === 'arena') {
      setBotCls(null); setBotDiff(null); setMode('field')
      world.current.half = MAP_BY_ID[mapIdRef.current].half; world.current.bot = null
      world.current.portals = portalsFor(mapIdRef.current)
      world.current.teleport = { x: PVP_PORTAL.x, z: PVP_PORTAL.z + 4, yaw: Math.PI }
      addToast('결투에서 패배했다...')
    } else {
      world.current.teleport = { x: 0, z: 3, yaw: 0 }
      addToast('마을에서 다시 일어났다')
    }
    setDeath(null)
  }, [addToast])

  /* ---------- 기본 공격 ---------- */
  const doHeal = useCallback((p, st) => {
    let best = null, bestD = 99
    world.current.dummies.forEach((d) => {
      const dx = d.x - p.x, dz = d.z - p.z, dd = Math.hypot(dx, dz)
      if (dd < 3.4 && Math.abs(angleDiff(Math.atan2(dx, dz), p.yaw)) < 1.4 && dd < bestD) { best = d; bestD = dd }
    })
    if (best) {
      const g = best.heal(20 + S.current.healPower * 40)
      if (g > 0) pushFx({ kind: 'heal', x: best.x, z: best.z })
    }
    const roll = rollDamage(st)
    world.current.mobs.forEach((m) => {
      if (!m.alive) return
      const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz)
      if (d <= ATTACK_RANGE && Math.abs(angleDiff(Math.atan2(dx, dz), p.yaw)) <= ATTACK_ARC) m.hit({ x: dx / d, z: dz / d }, roll.dmg)
    })
    const b = world.current.bot
    if (b && b.alive) {
      const dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz)
      if (d <= ATTACK_RANGE && Math.abs(angleDiff(Math.atan2(dx, dz), p.yaw)) <= ATTACK_ARC) b.hit({ x: dx / d, z: dz / d }, roll.dmg)
    }
  }, [pushFx])

  /* 광역 피해 적용 (스킬·기본공격 공용) */
  const applyArea = useCallback((p, range, arc, dmg) => {
    let hits = 0
    world.current.mobs.forEach((m) => {
      if (!m.alive) return
      const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz)
      if (d > range) return
      if (arc < Math.PI && Math.abs(angleDiff(Math.atan2(dx, dz), p.yaw)) > arc) return
      m.hit(d < 0.001 ? { x: 0, z: 1 } : { x: dx / d, z: dz / d }, dmg); hits++
    })
    const b = world.current.bot
    if (b && b.alive) {
      const dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz)
      if (d <= range && (arc >= Math.PI || Math.abs(angleDiff(Math.atan2(dx, dz), p.yaw)) <= arc)) {
        b.hit({ x: dx / d, z: dz / d }, dmg); hits++
      }
    }
    /* 결투 중이면 상대 플레이어도 타격 대상이다 — 피해는 맞는 쪽이 적용한다 */
    const duel = duelRef.current
    if (duel) {
      const op = world.current.peers.get(duel.peerId)
      const net = netRef.current
      if (op && !op.dead && net) {
        const dx = op.x - p.x, dz = op.z - p.z, d = Math.hypot(dx, dz)
        if (d <= range && (arc >= Math.PI || Math.abs(angleDiff(Math.atan2(dx, dz), p.yaw)) <= arc)) {
          net.room.send({ t: 'dlHit', to: duel.peerId, dmg }); hits++
          /* 몇 번 때려서 이겼는지 세어 '한방 승리'를 판정한다 */
          live.current.duelHits = (live.current.duelHits || 0) + 1
        }
      }
    }
    return hits
  }, [])

  const onImpact = useCallback(() => {
    const p = world.current.player
    const L = live.current
    const st = withBuffs(statsRef.current, L)   // 공격·치명·흡혈 버프 반영

    /* 달의 사제·달의 권위자 — 기본 공격이 달빛 투사체이고, 맞은 적은 둔화된다
       (사용자 확정: 대신 스킬 직접 피해는 매우 낮다) */
    if (cls.id === 'moon' || cls.id === 'moonlord') {
      const cy = camRef.current.yaw
      const ax = -Math.sin(cy), az = -Math.cos(cy)
      const lordMul = cls.id === 'moonlord' ? MOONLORD_MULT * 0.05 : 1
      const roll = rollDamage(st, MOON_BASIC.dmgMul * lordMul)
      L.arrows.push({
        x: p.x + ax * 0.7, z: p.z + az * 0.7,
        vx: ax * ARROW_SPEED * 0.8, vz: az * ARROW_SPEED * 0.8,
        life: ARROW_LIFE * 1.2, dmg: roll.dmg,
        moon: true,                       // 맞으면 둔화를 건다
      })
      pushFx({ kind: 'spell', x: p.x + ax * 1.4, z: p.z + az * 1.4, range: 1.1, color: cls.color })
      return
    }

    /* 어둠의 암살자 — 기본 공격은 은신을 푼다. 잔상이 있으면 같은 공격을 복제한다. */
    if (cls.id === 'darkassassin') {
      const roll = rollDamage(st)
      applyArea(p, ATTACK_RANGE, ATTACK_ARC, roll.dmg)
      pushFx({ kind: 'slash', x: p.x, z: p.z, yaw: p.yaw, range: ATTACK_RANGE, arc: ATTACK_ARC, color: '#7c3aed' })
      if (L.mirror) {
        const m = L.mirror
        darkHitRef.current(m.x, m.z, m.yaw, ATTACK_RANGE, ATTACK_ARC, Math.round(roll.dmg * 0.6))
        pushFx({ kind: 'slash', x: m.x, z: m.z, yaw: m.yaw, range: ATTACK_RANGE, arc: ATTACK_ARC, color: '#a78bfa' })
      }
      L.stealth = false
      return
    }

    if (cls.mode === 'melee') {
      const isReaper = cls.id === 'reaper'
      const range = isReaper ? 3.7 : ATTACK_RANGE
      const arc = isReaper ? 1.5 : ATTACK_ARC
      const roll = rollDamage(st)
      const hits = applyArea(p, range, arc, roll.dmg)
      if (st.lifesteal > 0 && hits > 0) L.hp = Math.min(st.maxHp, L.hp + roll.dmg * hits * st.lifesteal / 100)
      pushFx({ kind: 'slash', x: p.x, z: p.z, yaw: p.yaw, range, arc, wide: isReaper, color: roll.crit ? '#fbbf24' : cls.color })
      if (cls.id === 'swordsman' && inZone(p.x, p.z, TRAIN_ZONE)) growTraining()
      if (cls.id === 'reaper' && hits >= 2 && S.current.unlocked) {
        S.current.atkBonus += GROWTH_STEP; S.current.reaperMulti += 1; commit()
        if (S.current.reaperMulti % 5 === 0) addToast(`☠️ 동시 수확 ${S.current.reaperMulti}회 — 공격력 +${(S.current.reaperMulti * GROWTH_STEP).toFixed(2)}`)
      }
    } else if (cls.mode === 'arrow') {
      const cy = camRef.current.yaw
      const ax = -Math.sin(cy), az = -Math.cos(cy)
      const roll = rollDamage(st)
      L.arrows.push({ x: p.x + ax * 0.7, z: p.z + az * 0.7, vx: ax * ARROW_SPEED, vz: az * ARROW_SPEED, life: ARROW_LIFE, dmg: roll.dmg })
    } else if (cls.mode === 'heal') {
      doHeal(p, st)
    }
  }, [cls, pushFx, growTraining, doHeal, applyArea, commit, addToast])
  swing.current.impact = onImpact

  /* ---------- 스킬 시전 ---------- */
  /* ---------- 지원 스킬 (버프 · 회복 · 디버프) ----------
     위력은 직업 성장 기믹(축복 계수·저주 위력·치유력)에도 비례한다 */
  const supportPower = useCallback(() => {
    const s = S.current
    if (cls.id === 'priest') return 1 + s.buffCoef
    if (cls.id === 'moon') return 1 + s.debuffPower
    /* 달의 권위자 — 저주 위력 100배 (사용자 확정) */
    if (cls.id === 'moonlord') return (1 + s.debuffPower) * MOONLORD_MULT
    if (cls.id === 'healer') return 1 + s.healPower * 2
    return 1
  }, [cls])

  const applyBuffList = useCallback((list, dur) => {
    const L = live.current
    list.forEach(([k, p]) => addBuff(L, k, p, dur))
    bumpHud()
  }, [bumpHud])

  /* 회복/보호막/지속회복을 자신에게 적용 — 원격 힐 수신도 같은 경로를 쓴다 */
  const selfHeal = useCallback((amount, hot, shieldAmt) => {
    const L = live.current
    if (L.dead) return
    if (amount) L.hp = Math.min(statsRef.current.maxHp, L.hp + amount)
    if (hot) addBuff(L, 'regen', hot[0], hot[1])
    if (shieldAmt) addBuff(L, 'shield', shieldAmt, 12)
    bumpHud()
  }, [bumpHud])

  /* 죽은 자리에서 일으켜 세운다 (힐러 부활 · 던전 웨이브 부활 공용) */
  const reviveInPlace = useCallback((ratio = 0.5) => {
    const L = live.current
    if (!L.dead) return
    L.dead = false
    L.hp = Math.max(1, Math.round(statsRef.current.maxHp * ratio))
    L.iframe = 2
    setDeath(null)
    addToast('✨ 다시 일어났다!')
    bumpHud()
  }, [addToast, bumpHud])

  const castAwaken = useCallback((sk, lv) => {
    const dur = (sk.dur || 12) + (lv - 1) * 1.5
    applyBuffList([['atkP', 22 + lv * 3], ['critF', 10 + lv * 2], ['spdP', 12], ['redP', 18]], dur)
    const p = world.current.player
    pushFx({ kind: 'spell', x: p.x, z: p.z, range: 4, color: cls.color })
    addToast(`🌟 ${sk.name}! (${Math.round(dur)}초)`)
  }, [applyBuffList, pushFx, addToast, cls])

  const castBuff = useCallback((sk, lv) => {
    const pw = supportPower()
    const list = sk.buffs.map(([k, base, per]) => [k, +((base + per * (lv - 1)) * pw).toFixed(1)])
    applyBuffList(list, sk.dur)
    const p = world.current.player
    const net = netRef.current
    if (net) {
      net.room.send({
        t: 'buff', x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10,
        r: sk.aoe, list, dur: sk.dur, mapId: mapIdRef.current,
        in: world.current.inst || undefined, nick: account.nick,
      })
    }
    pushFx({ kind: 'heal', x: p.x, z: p.z })
    addToast(`✨ ${sk.name} — 주변 아군을 축복했다`)
  }, [supportPower, applyBuffList, pushFx, addToast, account.nick])

  const castHeal = useCallback((sk, lv) => {
    const pw = supportPower()
    const amount = Math.round((sk.heal + sk.healPer * (lv - 1)) * pw)
    const hot = sk.hot ? [Math.round(sk.hot[0] * pw), sk.hot[1]] : null
    const shieldAmt = sk.shield ? Math.round((sk.shield + 8 * (lv - 1)) * pw) : 0
    selfHeal(amount, hot, shieldAmt)
    const p = world.current.player
    const net = netRef.current
    if (net) {
      net.room.send({
        t: 'heal', x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10,
        r: sk.aoe, amount, hot, shield: shieldAmt, revive: !!sk.revive,
        mapId: mapIdRef.current, in: world.current.inst || undefined, nick: account.nick,
      })
    }
    pushFx({ kind: 'heal', x: p.x, z: p.z })
    addToast(`💖 ${sk.name}`)
  }, [supportPower, selfHeal, pushFx, addToast, account.nick])

  const castDebuff = useCallback((sk, lv) => {
    const pw = supportPower()
    const debs = sk.debs.map(([k, base, per]) => [k, +((base + per * (lv - 1)) * pw).toFixed(1)])
    const w = world.current
    const p = w.player
    const ids = []
    w.mobs.forEach((m) => { if (m.alive && dist2(p.x, p.z, m.x, m.z) <= sk.aoe) ids.push(m.id) })

    /* 달의 사제는 저주가 본체이고 직접 피해는 매우 낮다 (사용자 확정).
       달의 권위자로 전직하면 각성 스킬이 되어 피해가 크게 오른다. */
    if (ids.length) {
      const st2 = withBuffs(statsRef.current, live.current)
      const base = sk.mul != null ? sk.mul + (sk.per || 0) * (lv - 1) : 1
      const dmgMul = sk.awakened ? base : base * MOON_SKILL_DMG_MUL
      const roll2 = rollDamage(st2, dmgMul)
      applyArea(p, sk.aoe, Math.PI, roll2.dmg)
    }
    const net = netRef.current
    const follower = net && !net.simOwner && net.snapZone === zoneOf(w.inst, mapIdRef.current)
    if (follower) {
      if (ids.length) net.room.send({ t: 'mobDebuff', ids, debs, dur: sk.dur, mapId: mapIdRef.current, in: w.inst || undefined })
    } else {
      applyMobDebuffs(w, ids, debs, sk.dur, net ? net.myId : null)
    }
    pushFx({ kind: 'spell', x: p.x, z: p.z, range: sk.aoe * 0.55, color: '#8b5cf6' })
    addToast(ids.length ? `🌙 ${sk.name} — ${ids.length}마리에게 저주` : `🌙 ${sk.name} — 사거리 안에 적이 없다`)
  }, [supportPower, pushFx, addToast, applyArea])

  /* ==================================================================
     어둠의 암살자 — 5가지 능력 (사용자 확정 설계)

     패시브: 4초간 가만히 있다가 움직이면 은신. 은신 중 남들에게 안 보인다.
     1) 쓰는 즉시 은신하며 상대에게 파고들어 잔상 2개와 함께 3연속 공격.
        은신이 풀리지 않는다.
     2) 잔상을 전방에 발사, 5초 안에 재사용하면 그 자리로 순간이동.
        잔상은 내가 공격할 때 같은 공격을 전방으로 복제한다.
     3) 주변을 원으로 벤다 — 은신이 풀리지 않는다
     4) 상대에게 들어가 무적이 된다. 5초 안에 재사용하거나 5초가 지나면
        자동으로 튀어나오며, 잔상 10개가 원을 그리며 중심으로 돌진한다.
        직후 한 번 더 쓰면 즉시 은신하며 멀리 돌진한다.

     잔상은 모두 "흐릿한 내 모습"으로 그려진다 (Afterimages 컴포넌트).
     ================================================================== */
  const darkHit = useCallback((originX, originZ, yaw, range, arc, dmg) => {
    /* 특정 지점을 기준으로 광역 판정 (잔상 공격에 쓴다) */
    const w = world.current
    let hits = 0
    w.mobs.forEach((m) => {
      if (!m.alive) return
      const dx = m.x - originX, dz = m.z - originZ, d = Math.hypot(dx, dz)
      if (d > range) return
      if (arc < Math.PI && Math.abs(angleDiff(Math.atan2(dx, dz), yaw)) > arc) return
      m.hit(d < 0.001 ? { x: 0, z: 1 } : { x: dx / d, z: dz / d }, dmg)
      hits++
    })
    return hits
  }, [])

  /* 잔상 하나를 띄운다. 풀 크기를 넘으면 오래된 것부터 밀려난다. */
  const pushAfterimage = useCallback((e) => {
    const arr = world.current.afterimages
    const now = performance.now()
    /* 수명이 끝난 칸부터 재활용한다 */
    for (let i = arr.length - 1; i >= 0; i--) {
      if (now - arr[i].born >= arr[i].life) arr.splice(i, 1)
    }
    arr.push({ born: now, life: 900, ...e })
    while (arr.length > AFTERIMAGE_POOL) arr.shift()
  }, [])

  /* 빙의에서 튀어나오는 순간 — 잔상 10개가 원을 그리며 중심으로 돌진한다.
     수동 재사용과 5초 자동 해제가 똑같이 이걸 쓴다. */
  const darkBurst = useCallback((px, pz, dmgOf) => {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      pushAfterimage({ cx: px, cz: pz, a, r0: 5.5, life: 620 })
      setTimeout(() => {
        const d2 = Math.round(dmgOf() * 0.45)
        darkHit(px + Math.cos(a) * 1.2, pz + Math.sin(a) * 1.2, 0, 2.4, Math.PI, d2)
        pushFx({ kind: 'slash', x: px + Math.cos(a) * 1.4, z: pz + Math.sin(a) * 1.4, yaw: a, range: 2.2, arc: 1.4, color: '#7c3aed' })
      }, 300 + i * 40)
    }
  }, [darkHit, pushAfterimage, pushFx])

  const castDark = useCallback((sk, lv) => {
    const L = live.current
    const w = world.current
    const p = w.player
    const st = withBuffs(statsRef.current, L)
    const dmg = () => rollDamage(st, sk.dmgMul + sk.dmgPer * (lv - 1)).dmg
    const cy = camRef.current.yaw
    const fx2 = -Math.sin(cy), fz2 = -Math.cos(cy)

    /* 가장 가까운 적 (몬스터 또는 결투 상대) */
    const nearestFoe = (maxR) => {
      let best = null, bd = maxR
      w.mobs.forEach((m) => {
        if (!m.alive) return
        const d = dist2(p.x, p.z, m.x, m.z)
        if (d < bd) { bd = d; best = { x: m.x, z: m.z, mob: m } }
      })
      const duel = duelRef.current
      if (duel) {
        const op = w.peers.get(duel.peerId)
        if (op && !op.dead) {
          const d = dist2(p.x, p.z, op.x, op.z)
          if (d < bd) { bd = d; best = { x: op.x, z: op.z, peer: op } }
        }
      }
      return best
    }

    if (sk.kind === 'dark_strike') {
      const foe = nearestFoe(sk.range)
      if (!foe) { addToast('🌑 근처에 대상이 없습니다'); L.cd[sk.id] = 0; return }
      /* 쓰는 즉시 은신 — 이미 은신 중이었어도, 아니었어도 진입한다 */
      L.stealth = true
      if (world.current.onStealth) world.current.onStealth(true)
      /* 상대에게 파고든다 — 붙어서 따라다닌다 */
      w.teleport = { x: foe.x - fx2 * 1.2, z: foe.z - fz2 * 1.2, yaw: Math.atan2(foe.x - p.x, foe.z - p.z) }
      L.followFoe = { until: performance.now() + 1400, mob: foe.mob || null, peerId: foe.peer ? foe.peer.peerId : null }
      /* 본체 + 잔상 2개 = 3연속 (양옆에 흐릿한 내 모습이 선다) */
      const facing = Math.atan2(foe.x - p.x, foe.z - p.z)
      for (const side of [-1, 1]) {
        pushAfterimage({ x: foe.x + side * 1.15, z: foe.z - 0.4, yaw: facing, life: 700 })
      }
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const d2 = dmg()
          darkHit(foe.x, foe.z, 0, 2.6, Math.PI, d2)
          if (foe.peer && netRef.current) netRef.current.room.send({ t: 'dlHit', to: foe.peer.peerId, dmg: d2 })
          pushFx({ kind: 'slash', x: foe.x + (i - 1) * 0.7, z: foe.z, yaw: cy, range: 2.6, arc: 1.6, color: '#7c3aed' })
        }, i * 130)
      }
      /* 이 스킬은 은신을 풀지 않는다 — 계속 은신 상태로 남는다 */
      addToast('🌑 그림자 침투 — 3연속! (은신 유지)')
      return
    }

    if (sk.kind === 'dark_mirror') {
      if (L.mirror) {
        /* 5초 안에 재사용 — 잔상이 선 자리로 순간이동 */
        w.teleport = { x: L.mirror.x, z: L.mirror.z, yaw: p.yaw }
        pushFx({ kind: 'spell', x: L.mirror.x, z: L.mirror.z, range: 1.6, color: '#7c3aed' })
        /* 원래 내가 있던 자리에 잔상이 잠깐 남는다 */
        pushAfterimage({ x: p.x, z: p.z, yaw: p.yaw, life: 600 })
        L.mirror = null
        L.cd[sk.id] = sk.cd              // 순간이동까지 마쳤으니 이제 정식 쿨타임
        addToast('🌑 잔상 위치로 순간이동')
      } else {
        const mx = p.x + fx2 * sk.range, mz = p.z + fz2 * sk.range
        const life = (sk.mirrorLife || 5) * 1000
        L.mirror = { x: mx, z: mz, yaw: cy, until: performance.now() + life, skId: sk.id, cd: sk.cd }
        /* 흐릿한 내 모습이 그 자리에 서 있는다 */
        pushAfterimage({ x: mx, z: mz, yaw: cy, life })
        pushFx({ kind: 'spell', x: mx, z: mz, range: 1.4, color: '#7c3aed' })
        /* 잔상을 세워둔 동안은 쿨타임에 걸리면 안 된다 — 걸리면 재사용 자체가 불가능하다.
           쿨타임은 순간이동했을 때, 또는 잔상이 그냥 사라졌을 때 들어간다. */
        L.cd[sk.id] = 0.4
        addToast(`🌑 잔상 투사 — ${sk.mirrorLife || 5}초 안에 다시 누르면 순간이동`)
      }
      return
    }

    if (sk.kind === 'dark_spin') {
      /* 은신을 유지한 채 주변을 벤다 */
      const d2 = dmg()
      darkHit(p.x, p.z, 0, sk.range, Math.PI, d2)
      const duel = duelRef.current
      if (duel && netRef.current) {
        const op = w.peers.get(duel.peerId)
        if (op && !op.dead && dist2(p.x, p.z, op.x, op.z) <= sk.range) {
          netRef.current.room.send({ t: 'dlHit', to: duel.peerId, dmg: d2 })
        }
      }
      pushFx({ kind: 'slash', x: p.x, z: p.z, yaw: p.yaw, range: sk.range, arc: Math.PI * 2, wide: true, color: '#7c3aed' })
      addToast('🌑 암영 회전 (은신 유지)')
      return
    }

    if (sk.kind === 'dark_possess') {
      if (L.possess) {
        /* 5초가 되기 전에 직접 튀어나온다 */
        const px = L.possess.x, pz = L.possess.z
        L.possess = null
        darkBurst(px, pz, dmg)
        /* 직후 한 번 더 쓰면 은신 + 장거리 돌진 */
        L.possessRecast = performance.now() + 4000
        L.cd[sk.id] = 1.2
        addToast('🌑 빙의 해제 — 잔상 10개 돌진! (지금 다시 누르면 은신 돌진)')
        return
      }
      if (L.possessRecast && performance.now() < L.possessRecast) {
        L.possessRecast = 0
        L.stealth = true
        L.dashReq = { dist: 16 }
        L.cd[sk.id] = sk.cd
        addToast('🌑 은신 돌진!')
        return
      }
      const foe = nearestFoe(sk.range)
      if (!foe) { addToast('🌑 근처에 대상이 없습니다'); L.cd[sk.id] = 0; return }
      L.possess = {
        x: foe.x, z: foe.z, until: performance.now() + sk.dur * 1000,
        mob: foe.mob || null, peerId: foe.peer ? foe.peer.peerId : null,
        /* 시간이 다해 자동으로 빠져나올 때도 같은 연출이 나오도록 들려 보낸다 */
        burst: (bx, bz) => darkBurst(bx, bz, dmg),
      }
      L.stealth = true
      addToast(`🌑 빙의 — ${sk.dur}초 (다시 누르거나 시간이 다하면 잔상 10개 돌진)`)
      return
    }
  }, [darkHit, darkBurst, pushAfterimage, pushFx, addToast])

  /* 달의 권위자 궁극기 — 달을 떨어뜨려 모든 저주를 걸고 빈사의 적을 처형한다
     (사용자 확정: 일반 30% 미만 · 보스 5% 미만 즉사) */
  const castMoonJudgement = useCallback((sk, lv) => {
    const w = world.current
    const p = w.player
    const pw = supportPower()
    const net = netRef.current
    /* 10개 스킬의 모든 디버프 + 속박 */
    const allDebs = [
      ['slow', 70], ['weak', 70], ['vuln', 90], ['dot', 40 * (1 + lv * 0.2)],
      ['blind', 60], ['root', 3 + lv * 0.4],
    ].map(([k, v]) => [k, +(v * Math.min(3, pw / 30)).toFixed(1)])

    const ids = []
    let executed = 0
    w.mobs.forEach((m) => {
      if (!m.alive || dist2(p.x, p.z, m.x, m.z) > sk.aoe) return
      ids.push(m.id)
      const ratio = m.maxHp > 0 ? m.hp / m.maxHp : 1
      const line = (m.rank === 'boss' ? sk.execBoss : sk.execNormal) / 100
      if (ratio <= line) {
        m.hit({ x: 0, z: 1 }, m.hp + 1, net ? net.myId : null)   // 처형
        executed++
      }
    })
    const follower = net && !net.simOwner && net.snapZone === zoneOf(w.inst, mapIdRef.current)
    if (follower) {
      if (ids.length) net.room.send({ t: 'mobDebuff', ids, debs: allDebs, dur: 14, mapId: mapIdRef.current, in: w.inst || undefined })
    } else {
      applyMobDebuffs(w, ids, allDebs, 14, net ? net.myId : null)
    }
    /* 직접 피해도 크게 */
    const st = withBuffs(statsRef.current, live.current)
    const roll = rollDamage(st, (sk.mul || 6) + (sk.per || 1) * (lv - 1))
    applyArea(p, sk.aoe, Math.PI, roll.dmg)
    pushFx({ kind: 'spell', x: p.x, z: p.z, range: sk.aoe * 0.6, color: '#c7d2fe' })
    pushFx({ kind: 'spell', x: p.x, z: p.z, range: sk.aoe * 0.35, color: '#818cf8' })
    addToast(executed > 0
      ? `🌘 달의 심판! ${ids.length}마리 저주 · ${executed}마리 처형`
      : `🌘 달의 심판! ${ids.length}마리에게 모든 저주`)
  }, [supportPower, applyArea, pushFx, addToast])

  const darkHitRef = useRef(darkHit); darkHitRef.current = darkHit

  const castSkillSlot = useCallback((slot) => {
    const L = live.current
    if (L.dead || controlRef.current.lock) return
    const s = S.current
    if (!s.unlocked) { lockedNotice(); return }
    const list = SKILLS[cls.id] || []
    const sk = list.find((x) => x.slot === slot)
    if (!sk) return
    if (s.tier < sk.tier) { addToast(`🔒 ${JOB_TIERS[sk.tier].title} 이후 사용할 수 있습니다`); return }
    const lv = s.skills[sk.id] || 0
    if (lv <= 0) { addToast(`🔒 [${sk.name}] 스킬을 먼저 배워야 합니다 (K)`); return }
    if ((L.cd[sk.id] || 0) > 0) return
    L.cd[sk.id] = sk.cd

    /* 달의 바다 구덩이 안에서 서로 다른 스킬 3개를 쓰면 달의 권위자로 전직 */
    const hs = world.current.hiddenSpot
    if (hs && hs.key === 'moon_sea' && cls.id === 'moon' && (s.fragments || 0) >= 1000) {
      const p0 = world.current.player
      if (dist2(p0.x, p0.z, hs.x, hs.z) <= hs.r) {
        if (!L.moonRite) L.moonRite = new Set()
        L.moonRite.add(sk.id)
        if (L.moonRite.size >= 3) {
          L.moonRite.clear()
          becomeHiddenRef.current('moonlord')
          return
        }
        addToast(`🌘 달의 의식 ${L.moonRite.size}/3`)
      }
    }

    /* 지원 계열 — 성직자·달의 사제·힐러 + 공격 직업의 각성 */
    if (sk.kind === 'awaken') { castAwaken(sk, lv); bumpHud(); return }
    if (sk.kind === 'buff') { castBuff(sk, lv); bumpHud(); return }
    if (sk.kind === 'heal') { castHeal(sk, lv); bumpHud(); return }
    if (sk.kind === 'moon_judgement') { castMoonJudgement(sk, lv); bumpHud(); return }
    if (sk.kind === 'debuff') { castDebuff(sk, lv); bumpHud(); return }
    if (sk.kind && sk.kind.startsWith('dark_')) { castDark(sk, lv); bumpHud(); return }

    /* 공격 계열 */
    const st = withBuffs(statsRef.current, L)
    const p = world.current.player
    if (sk.kind === 'dash') L.dashReq = { dist: 4.5 }
    let mul = sk.dmgMul + sk.dmgPer * (lv - 1)

    /* 마검사 — 검격과 마법을 번갈아 써야 콤보가 쌓인다 (사용자 확정: 극난이도) */
    if (cls.id === 'spellblade') {
      const isSpell = sk.slot % 2 === 0            // 짝수 슬롯 = 마법 계열
      const now2 = performance.now()
      const fresh = L.sbAt && now2 - L.sbAt < SPELLBLADE_COMBO.window * 1000
      if (fresh && L.sbSpell !== undefined && L.sbSpell !== isSpell) {
        L.sbStack = Math.min(SPELLBLADE_COMBO.maxStack, (L.sbStack || 0) + 1)
      } else {
        if ((L.sbStack || 0) > 0) addToast('💢 콤보가 끊겼다')
        L.sbStack = 0
      }
      L.sbSpell = isSpell
      L.sbAt = now2
      mul *= 1 + (L.sbStack || 0) * SPELLBLADE_COMBO.perStack
      if (L.sbStack > 0) addToast(`⚡ 검마 콤보 ${L.sbStack} (×${(1 + L.sbStack * SPELLBLADE_COMBO.perStack).toFixed(2)})`)
    }
    const range = sk.range * (1 + st.skillRange)
    const roll = rollDamage(st, mul)
    const hits = applyArea(p, range, sk.arc, roll.dmg)
    if (st.lifesteal > 0 && hits > 0) L.hp = Math.min(st.maxHp, L.hp + roll.dmg * hits * st.lifesteal / 100)
    /* 이펙트 — 콤보 스킬은 여러 겹으로 화려하게 */
    for (let i = 0; i < sk.hits; i++) {
      if (sk.fx === 'spell') {
        const cy = camRef.current.yaw
        const tx = p.x - Math.sin(cy) * (2.4 + i * 0.9), tz = p.z - Math.cos(cy) * (2.4 + i * 0.9)
        pushFx({ kind: 'spell', x: tx, z: tz, range: range * 0.7, color: sk.color })
      } else if (sk.fx === 'arrow') {
        const cy = camRef.current.yaw
        const spread = (i - (sk.hits - 1) / 2) * 0.18
        const ax = -Math.sin(cy + spread), az = -Math.cos(cy + spread)
        L.arrows.push({ x: p.x + ax * 0.7, z: p.z + az * 0.7, vx: ax * ARROW_SPEED, vz: az * ARROW_SPEED, life: ARROW_LIFE, dmg: roll.dmg })
        pushFx({ kind: 'slash', x: p.x, z: p.z, yaw: p.yaw, range: range * 0.6, arc: 0.8, wide: false, color: sk.color })
      } else {
        pushFx({ kind: 'slash', x: p.x, z: p.z, yaw: p.yaw, range: range * (0.8 + i * 0.18), arc: sk.arc, wide: sk.tier >= 4, color: roll.crit ? '#fbbf24' : sk.color })
      }
    }
    const sw = swing.current
    if (sw.t < 0 || sw.t >= SWING_TIME * 0.5) { sw.t = 0; sw.hitDone = true }
    addToast(`✨ ${sk.name}${roll.crit ? ' 치명타!' : ''}`)
    bumpHud()
  }, [cls, applyArea, pushFx, addToast, bumpHud, lockedNotice, castAwaken, castBuff, castHeal, castDebuff, castMoonJudgement, castDark])
  const castRef = useRef(castSkillSlot); castRef.current = castSkillSlot

  const openMath = useCallback(() => setMathModal(makeMathProblem(S.current.circle)), [])
  const submitMath = useCallback((value) => {
    const prob = mathModal
    setMathModal(null)
    if (!prob) return
    const p = world.current.player
    if (Number(value) !== prob.ans) { addToast('❌ 오답 — 마력이 흩어졌다'); return }
    const s = S.current
    s.mageCorrect += 1
    s.atkBonus += GROWTH_STEP
    let leveled = false
    if (s.mageCorrect % 3 === 0 && s.circle < 7) { s.circle += 1; leveled = true }
    commit()
    const st = computeStats(cls, s)
    const roll = rollDamage(st)
    const cy = camRef.current.yaw
    const tx = p.x - Math.sin(cy) * 3.2, tz = p.z - Math.cos(cy) * 3.2
    world.current.mobs.forEach((m) => {
      if (!m.alive) return
      if (Math.hypot(m.x - tx, m.z - tz) <= 3.0) {
        const dd = Math.max(0.001, Math.hypot(m.x - p.x, m.z - p.z))
        m.hit({ x: (m.x - p.x) / dd, z: (m.z - p.z) / dd }, roll.dmg)
      }
    })
    const b = world.current.bot
    if (b && b.alive && Math.hypot(b.x - tx, b.z - tz) <= 3.8) {
      const dd = Math.max(0.001, Math.hypot(b.x - p.x, b.z - p.z))
      b.hit({ x: (b.x - p.x) / dd, z: (b.z - p.z) / dd }, roll.dmg)
    }
    pushFx({ kind: 'spell', x: tx, z: tz, range: 3.0, color: cls.color })
    const sw = swing.current; if (sw.t < 0) { sw.t = 0; sw.hitDone = true }
    addToast(leveled ? `✨ 정답! ${s.circle}서클 각성! 마력 +${GROWTH_STEP}` : `✨ 정답! 마력 +${GROWTH_STEP}`)
  }, [mathModal, cls, commit, addToast, pushFx])

  const doAttack = useCallback(() => {
    const L = live.current
    if (L.dead || controlRef.current.lock) return
    if (cls.mode === 'spell') { openMath(); return }
    const s = swing.current
    if (s.t >= 0 && s.t < SWING_TIME * 0.55) return
    s.t = 0; s.hitDone = false
    /* 다른 사람 화면에서도 내가 휘두르는 게 보이도록 신호를 올린다 */
    if (netRef.current) netRef.current.swingSeq = (netRef.current.swingSeq | 0) + 1
  }, [cls, openMath])
  const doAttackRef = useRef(doAttack); doAttackRef.current = doAttack

  /* ---------- 아이템 장착/해제/판매 ---------- */
  const equipItem = useCallback((item, slotIndex) => {
    const s = S.current
    const eq = s.equip
    if (item.kind === 'weapon') {
      if (!WEAPON_TYPES[item.wtype].classes.includes(cls.id)) { addToast('해당 직업은 장착할 수 없습니다'); return }
      if (eq.weapon) s.bag.push(eq.weapon)
      eq.weapon = item
    } else if (item.kind === 'armor') {
      if (eq[item.slot]) s.bag.push(eq[item.slot])
      eq[item.slot] = item
    } else if (item.kind === 'rune') {
      let idx = slotIndex
      if (idx == null || idx < 0 || idx >= RUNE_SLOTS) idx = eq.runes.findIndex((r) => !r)
      if (idx < 0) { addToast('룬 슬롯이 가득 찼습니다'); return }
      if (eq.runes[idx]) s.bag.push(eq.runes[idx])
      eq.runes[idx] = item
    } else if (item.kind === 'artifact') {
      if (eq.artifact) s.bag.push(eq.artifact)
      eq.artifact = item
    }
    s.bag = s.bag.filter((b) => b.uid !== item.uid)
    commit()
    addToast(`✅ ${item.name} 장착`)
  }, [cls, commit, addToast])

  const unequipItem = useCallback((where, idx) => {
    const s = S.current
    const eq = s.equip
    let it = null
    if (where === 'weapon') { it = eq.weapon; eq.weapon = null }
    else if (where === 'artifact') { it = eq.artifact; eq.artifact = null }
    else if (where === 'rune') { it = eq.runes[idx]; eq.runes[idx] = null }
    else { it = eq[where]; eq[where] = null }
    if (it) { s.bag.push(it); commit(); addToast(`↩ ${it.name} 해제`) }
  }, [commit, addToast])

  const sellItem = useCallback((item) => {
    const s = S.current
    const price = sellPrice(item)
    s.bag = s.bag.filter((b) => b.uid !== item.uid)
    s.gold += price
    commit()
    addToast(`💰 [${gradeOf(item.grade).name}] ${item.name} 판매 (+${price.toLocaleString()} G)`)
  }, [commit, addToast])

  /* ---------- 스킬 배우기 ---------- */
  const investSkill = useCallback((nodeId) => {
    const s = S.current
    if (!s.unlocked) { lockedNotice(); return }
    /* 스킬이면 정의에서, 특성이면 id에 담긴 티어에서 정보를 얻는다 */
    const sk = SKILL_BY_ID[nodeId]
    const stat = sk ? null : findWebStat(cls.id, nodeId)
    if (!sk && !stat) return
    const tier = sk ? sk.tier : stat.tier
    if (s.tier < tier) { addToast('[' + JOB_TIERS[tier].title + ']이 필요합니다'); return }
    const cur = s.skills[nodeId] || 0
    const max = sk ? skillMaxLv(sk, s.tier) : WEB_STAT_MAX
    const label = sk ? sk.name : stat.stat.name
    if (cur >= max) { addToast('이미 최대 레벨입니다'); return }
    if (s.sp < 1) { addToast('스킬 포인트(SP)가 부족합니다'); return }
    s.sp -= 1
    s.skills = { ...s.skills, [nodeId]: cur + 1 }
    commit()
    addToast('[' + label + '] Lv.' + (cur + 1) + ' 습득!')
  }, [cls, commit, addToast, lockedNotice])

  /* ---------- 튜토리얼 / NPC ---------- */
  const startTutorial = useCallback(() => {
    S.current.tutorial = 'active'
    commit()
    addToast('📜 튜토리얼 시작 — 토끼를 사냥해 간 10개를 모으세요')
    setNpcModal(null)
  }, [commit, addToast])

  /* ---------- 메인 퀘스트 보고 ----------
     이장에게 현재 단계를 보고하고 보상을 받은 뒤 다음 단계로 넘어간다.
     마지막 단계를 끝내면 레벨 10을 보장하고 1차 전직이 열린다. */
  const turnInQuest = useCallback(() => {
    const s = S.current
    const q = currentQuest(s)
    if (!q || !q.done(s)) return

    /* 첫 단계는 기존 튜토리얼과 같은 해금 처리를 겸한다 */
    if (q.id === 'tutorial') {
      s.tutorial = 'done'
      s.unlocked = true
      world.current.tutorLock = false
    }

    const r = q.reward || {}
    if (r.gold) s.gold += r.gold
    if (r.sp) s.sp += r.sp
    s.mq = (s.mq || 0) + 1

    const events = r.exp ? applyExp(s, r.exp) : []

    /* 전부 끝내면 1차 전직에 필요한 레벨을 보장해준다 */
    let leveled = false
    if (allQuestsDone(s) && s.level < MQ_GOAL_LEVEL) {
      s.level = MQ_GOAL_LEVEL
      s.exp = 0
      s.sp += 2
      leveled = true
    }
    commit()

    addToast(`📜 [${q.title}] 완료! ${r.gold ? `+${r.gold} G ` : ''}${r.sp ? `SP +${r.sp}` : ''}`)
    events.forEach(addToast)
    if (q.id === 'tutorial') addToast('🎉 모든 콘텐츠가 해금되었습니다')
    if (leveled) {
      addToast(`✨ 메인 퀘스트 완주 — Lv.${MQ_GOAL_LEVEL} 달성! SP +2`)
      addToast('🎖 1차 전직 퀘스트가 열렸습니다 — 전직관을 찾아가세요')
    }
    setNpcModal(null)
  }, [commit, addToast])

  /* 상인 구매 */
  const buyItem = useCallback((entry) => {
    const s = S.current
    if (!s.unlocked) { lockedNotice(); return }
    if (s.gold < entry.price) { addToast('골드가 부족합니다'); return }
    s.gold -= entry.price
    /* 상점은 일반~에픽까지만 취급한다 (룬·아티팩트는 판매하지 않는다) */
    if (entry.key === 'sp') { s.sp += 1; addToast('📖 깨달음의 서 — SP +1') }
    else if (entry.key === 'armor') addItem(makeArmor(s, entry.gradeMax))
    else if (entry.key === 'weapon') addItem(makeWeapon(s, entry.gradeMax, cls.weapon))
    commit()
  }, [cls, commit, addToast, addItem, lockedNotice])

  /* 전직 — 골드 지불 */
  const advanceByGold = useCallback(() => {
    const s = S.current
    const next = canAdvance(s)
    if (!next) return
    if (s.gold < next.cost) { addToast('골드가 부족합니다'); return }
    s.gold -= next.cost
    s.tier = next.tier
    s.sp += 2
    commit()
    addToast(`⭐ ${next.title} 완료! [${next.name}] — ${next.unlock}`)
    addToast('✨ SP +2 · 스킬트리가 확장되었습니다 (K)')
    setNpcModal(null)
  }, [commit, addToast])

  /* 전직 — 퀘스트 */
  const acceptJobQuest = useCallback((npc) => {
    const s = S.current
    const t = s.tier + 1
    s.jobQuest[npc.id] = {
      state: 'active', base: s.kills,
      dgBase: (s.dungeonClears || 0) + (s.raidClears || 0),
    }
    commit()
    addToast(`📜 전직 시험 시작 — 몬스터 ${jobQuestNeed(t)}마리 · 던전 ${jobQuestDungeons(t)}회`)
    setNpcModal(null)
  }, [commit, addToast])

  const completeJobQuest = useCallback((npc) => {
    const s = S.current
    const next = canAdvance(s)
    if (!next) return
    const q = s.jobQuest[npc.id]
    if (!q || q.state !== 'active') return
    const need = jobQuestNeed(next.tier)
    const dgNeed = jobQuestDungeons(next.tier)
    const dgDone = (s.dungeonClears || 0) + (s.raidClears || 0) - (q.dgBase || 0)
    if (s.kills - q.base < need || dgDone < dgNeed) return
    s.jobQuest[npc.id] = { state: 'none', base: 0, dgBase: 0 }
    s.tier = next.tier
    s.sp += 2
    commit()
    addToast(`⭐ ${next.title} 완료! [${next.name}] — ${next.unlock}`)
    addToast('✨ SP +2 · 스킬트리가 확장되었습니다 (K)')
    setNpcModal(null)
  }, [commit, addToast])

  /* 전직관 추가 수련 — 골드로 SP 구매 */
  const trainSp = useCallback(() => {
    const s = S.current
    const cost = 1500 + s.tier * 1200
    if (s.gold < cost) { addToast('골드가 부족합니다'); return }
    s.gold -= cost
    s.sp += 1
    commit()
    addToast(`📘 추가 수련 완료 — SP +1 (−${cost} G)`)
  }, [commit, addToast])

  /* ---------- 맵 이동 (포탈) ---------- */
  const changeMap = useCallback((to) => {
    const s = S.current
    const md = MAP_BY_ID[to]
    if (!md) return
    if (!s.unlocked) { lockedNotice(); return }
    if (s.level < md.reqLv) { addToast('[' + md.name + '] 입장 조건: Lv.' + md.reqLv); return }
    s.map = to
    if (to > s.bestMap) s.bestMap = to
    commit()
    world.current.mobs.clear()
    world.current.half = md.half
    world.current.portals = portalsFor(to)
    setMapId(to)
    setMobs(spawnForMap(to))
    live.current.arrows.length = 0
    world.current.teleport = { x: 0, z: -(md.half - 11), yaw: 0 }
    addToast('[' + md.name + '] 도착! ' + md.desc)
  }, [commit, addToast, lockedNotice, spawnForMap])

  /* ---------- 직업 변경 (닉네임은 영구 고정, 직업은 자유) ---------- */
  /* ---------- 직업 포기 → 재전직 (사용자 확정 규칙) ----------
     전직관에서 직접 포기해야 하며, 모든 스킬과 스킬 포인트를 잃는다.
     포기 후에는 전직 단계도 0으로 돌아가 처음부터 다시 올라가야 한다. */
  const abandonClass = useCallback(() => {
    const s = S.current
    if (!s.unlocked) { lockedNotice(); return }
    s.skills = {}                 // 모든 스킬 상실
    s.sp = 0                      // 스킬 포인트 전부 상실
    s.tier = 0                    // 전직 단계 초기화
    s.jobQuest = {}
    s.abandoned = true            // 재전직 대기 상태
    const w = s.equip.weapon
    if (w) { s.bag.push(w); s.equip.weapon = null }
    commit()
    live.current.cd = {}
    addToast('💔 직업을 포기했습니다 — 모든 스킬과 SP를 잃었습니다')
    addToast('전직관에서 새 직업을 선택하세요')
    setNpcModal(null)
  }, [commit, addToast, lockedNotice])

  /* 포기한 뒤에만 새 직업을 고를 수 있다 */
  const pickNewClass = useCallback((newId) => {
    const s = S.current
    if (!s.unlocked) { lockedNotice(); return }
    if (!s.abandoned) { addToast('먼저 현재 직업을 포기해야 합니다'); return }
    const nc = CLASS_BY_ID[newId]
    if (!nc || nc.hidden) return
    s.abandoned = false
    s.skills = {}
    s.sp = 1                      // 새 출발용 최소 1포인트
    commit()
    live.current.cd = {}
    addToast(`✨ [${nc.name}]로 새로 시작합니다 — SP 1 지급`)
    setNpcModal(null)
    onChangeClass(newId)
  }, [commit, addToast, lockedNotice, onChangeClass])

  /* 히든 직업 전직 — 조건을 만족한 경우에만 호출된다 */
  const becomeHidden = useCallback((hid) => {
    const s = S.current
    const h = HIDDEN_BY_ID[hid]
    if (!h) return
    if (!hiddenUnlockable(s, cls.id, hid)) { addToast('조건을 만족하지 않았습니다'); return }
    s.hidden = { ...(s.hidden || {}), [hid]: true }
    /* 히든 직업은 새 스킬 체계를 쓰므로 기존 스킬 투자는 SP로 돌려준다 */
    let refund = 0
    Object.keys(s.skills).forEach((k) => { if (k.startsWith(cls.id + '_')) refund += s.skills[k] })
    const kept = {}
    Object.keys(s.skills).forEach((k) => { if (!k.startsWith(cls.id + '_')) kept[k] = s.skills[k] })
    s.skills = kept
    s.sp += Math.max(1, refund)
    const w = s.equip.weapon
    if (w && !WEAPON_TYPES[w.wtype].classes.includes(hid)) { s.bag.push(w); s.equip.weapon = null }
    commit()
    live.current.cd = {}
    addToast(`🌟 히든 직업 [${h.name}] 전직 성공!`)
    addToast(h.note)
    pushChat({ sys: true, txt: `${account.nick}님이 히든 직업 [${h.name}]에 전직했습니다!` })
    setNpcModal(null)
    onChangeClass(hid)
  }, [cls, commit, addToast, onChangeClass, pushChat, account.nick])
  becomeHiddenRef.current = becomeHidden

  /* ---------- PVP ---------- */
  /* ==================================================================
     파티 던전 · 레이드 — 인스턴스 입장/진행/보상

     [소유권] 파티장이 웨이브 진행과 보스 페이즈를 판정하고 브로드캐스트한다.
     [보상] 협동 콘텐츠이므로 막타 규칙 대신 파티 전원에게 지급한다.
     ================================================================== */
  const nextInstMobId = useRef(100000)

  /* 인스턴스 몹 배치 — 원형 맵 가장자리에 고르게 흩뿌린다 */
  const spawnInstWave = useCallback((kind, cid, wave, size, solo) => {
    const half = kind === 'dungeon' ? DG_HALF : RAID_HALF
    if (kind === 'raid') {
      const diff = RAID_BY_ID[cid]
      /* 솔로 레이드는 인원 보정 없이 기준치에 약화 배율만 적용한다 (사용자 확정) */
      const hp = solo ? soloRaidBossHp(diff) : raidBossHp(diff, size)
      const dmg = solo ? soloRaidDmg(diff) : diff.dmg
      return [{
        id: RAID_BOSS_ID, type: 'drake', scale: 3.0, rank: 'boss',
        x: 0, z: -half * 0.45,
        hpMul: hp / MOB_TYPES.drake.hp,
        dmgMul: dmg / MOB_TYPES.drake.dmg,
        spdMul: 0.85, aggroR: 999,
      }]
    }
    const dg = DUNGEON_BY_ID[cid]
    const spec = dungeonWave(wave, size)
    return spec.map((s, i) => {
      const a = (i / spec.length) * Math.PI * 2 + wave * 0.7
      const r = s.rank === 'boss' ? half * 0.4 : half * (0.5 + (i % 3) * 0.13)
      return {
        id: nextInstMobId.current++,
        type: dg.mob, scale: (MOB_SCALE[dg.mob] || 1) * s.scale, rank: s.rank,
        x: Math.cos(a) * r, z: Math.sin(a) * r,
        hpMul: s.hpMul, dmgMul: s.dmgMul,
        spdMul: s.rank === 'boss' ? 0.9 : 1, aggroR: 999,
      }
    })
  }, [])

  const instRef = useRef(null); instRef.current = inst
  /* 이번 웨이브에 소환한 몹 id — 이게 채워지고 전부 죽어야 웨이브가 끝난다.
     (몹이 등록되기 전에 "0마리 남음"으로 오판해 즉시 클리어되는 것을 막는다) */
  const waveIdsRef = useRef(null)

  /* 인스턴스 보상 — 파티 전원 동일 지급 */
  const grantInstReward = useCallback((exp, gold, gradeMax) => {
    const s = S.current
    const st = statsRef.current
    const cur = instRef.current
    s.gold += Math.round(gold * (1 + st.goldGain / 100) * adminMul(s, 'gold'))
    const ev = applyExp(s, exp * (1 + st.expGain / 100))
    if (gradeMax) {
      /* 아티팩트는 40레벨 이상 던전에서 아주 드물게만 나온다 (사용자 확정) */
      const reqLv = cur && cur.kind === 'dungeon' ? (DUNGEON_BY_ID[cur.cid]?.reqLv || 0)
        : cur ? (RAID_BY_ID[cur.cid]?.reqLv || 0) : 0
      if (artifactAllowed(reqLv) && Math.random() < ARTIFACT_DROP * 1000) {
        /* 던전 클리어는 사냥 한 번보다 훨씬 귀한 기회다 */
        addItem(makeArtifact(s, gradeMax))
      } else {
        addItem(Math.random() < 0.5 ? makeWeapon(s, gradeMax) : makeArmor(s, gradeMax))
      }
    }
    commit()
    ev.forEach(addToast)
  }, [commit, addToast, addItem])

  const exitInstance = useCallback((msg) => {
    const w = world.current
    w.inst = null; w.instLeader = null
    w.mobs.clear()
    waveIdsRef.current = null
    setInst(null)
    setAllies([])
    const md = MAP_BY_ID[mapIdRef.current]
    w.half = md.half
    w.portals = portalsFor(mapIdRef.current)
    w.tutorLock = !S.current.unlocked && mapIdRef.current === 0
    setMode('field')
    setMobs(spawnForMap(mapIdRef.current))
    const L = live.current
    L.hp = statsRef.current.maxHp; L.dead = false; L.iframe = 2; L.arrows.length = 0
    setDeath(null)
    w.teleport = { x: 0, z: 3, yaw: 0 }
    if (msg) addToast(msg)
  }, [addToast, spawnForMap])

  const [allies, setAllies] = useState([])
  const enterInstance = useCallback((kind, cid, instId, leaderId, size, aiCount = 0, solo = false) => {
    const s = S.current
    if (!s.unlocked) { lockedNotice(); return }
    const def = kind === 'dungeon' ? DUNGEON_BY_ID[cid] : RAID_BY_ID[cid]
    if (!def) return
    const w = world.current
    const net = netRef.current
    const isLeader = net && net.myId === leaderId
    w.inst = instId; w.instLeader = leaderId
    w.mobs.clear()
    w.half = kind === 'dungeon' ? DG_HALF : RAID_HALF
    w.portals = []; w.tutorLock = false; w.bot = null
    if (net) net.simOwner = !!isLeader
    setBotCls(null); setBotDiff(null)
    setMode(kind)
    setInst({ kind, cid, inst: instId, leaderId, size, wave: 1, phase: 1, done: null, solo })
    /* 몹 구성은 파티장이 정하고 뿌린다 — 팔로워는 스냅샷으로 받는다 */
    const first = isLeader ? spawnInstWave(kind, cid, 1, size, solo) : []
    waveIdsRef.current = isLeader ? first.map((m) => m.id) : null
    setMobs(first)
    const L = live.current
    L.hp = statsRef.current.maxHp; L.dead = false; L.iframe = 2; L.arrows.length = 0
    L.buffs = []
    setDeath(null)
    w.teleport = { x: 0, z: (kind === 'dungeon' ? DG_HALF : RAID_HALF) * 0.6, yaw: Math.PI }
    /* 자리를 채운 용병은 인스턴스 소유자(파티장)만 시뮬레이션한다 */
    setAllies(isLeader && aiCount > 0 ? makeAllies(aiCount, S.current.level) : [])
    addToast(`${def.icon} [${def.name}] 입장!`)
    pushChat({ sys: true, txt: `${def.name} 입장 — ${size}명${aiCount ? ` (용병 ${aiCount}명 합류)` : ''}` })
    if (aiCount > 0) addToast(`🤝 인원이 모자라 용병 ${aiCount}명이 합류했습니다`)
  }, [addToast, lockedNotice, spawnInstWave, pushChat])
  enterInstanceRef.current = enterInstance

  /* 파티장 — 웨이브/페이즈 진행 판정 (0.5초마다, 가볍게) */
  useEffect(() => {
    if (!inst || inst.done) return
    const net = netRef.current
    if (!net || net.myId !== inst.leaderId) return
    const iv = setInterval(() => {
      const w = world.current
      const cur = instRef.current
      if (!cur || cur.done) return
      /* 이번 웨이브 몹이 아직 하나도 등록되지 않았다면 판정을 미룬다 */
      const want = waveIdsRef.current
      const spawned = want && want.length > 0 && want.some((id) => w.mobs.has(id))
      const alive = want
        ? want.filter((id) => { const m = w.mobs.get(id); return m && m.alive }).length
        : [...w.mobs.values()].filter((m) => m.alive).length

      /* 전멸 판정 — 인스턴스 안의 파티원이 모두 쓰러졌는가 */
      const inHere = [...w.peers.values()].filter((p) => p.inst === cur.inst)
      const allDown = live.current.dead && inHere.every((p) => p.dead)
      if (allDown) {
        net.room.send({ t: 'dgEnd', inst: cur.inst, win: false })
        supportRef.current.onInstEnd?.({ win: false })
        return
      }

      if (cur.kind === 'raid') {
        const boss = w.mobs.get(RAID_BOSS_ID)
        const diff = RAID_BY_ID[cur.cid]
        if (!boss || (!boss.alive && boss.phase !== 'alive')) {
          net.room.send({ t: 'dgEnd', inst: cur.inst, win: true })
          supportRef.current.onInstEnd?.({ win: true })
          return
        }
        const ratio = boss.maxHp > 0 ? boss.hp / boss.maxHp : 1
        const ph = raidPhase(ratio, diff.phases)
        if (ph !== cur.phase) {
          net.room.send({ t: 'dgPhase', inst: cur.inst, phase: ph })
          supportRef.current.onInstPhase?.({ phase: ph })
        }
        return
      }

      /* 던전 — 이번 웨이브 몹이 실제로 등장했고 전부 쓰러졌을 때만 다음으로 */
      if (spawned && alive === 0) {
        const done = cur.wave >= DG_WAVES
        waveIdsRef.current = null
        net.room.send({ t: 'dgWave', inst: cur.inst, wave: cur.wave, next: done ? null : cur.wave + 1, win: done })
        supportRef.current.onInstWave?.({ wave: cur.wave, next: done ? null : cur.wave + 1, win: done })
        if (!done) {
          const next = spawnInstWave(cur.kind, cur.cid, cur.wave + 1, cur.size)
          waveIdsRef.current = next.map((m) => m.id)
          setMobs(next)
        }
      }
    }, 500)
    return () => clearInterval(iv)
  }, [inst, spawnInstWave])

  /* 웨이브 클리어 — 전원 보상 (막타 무관) */
  const onInstWave = useCallback(({ wave, next, win }) => {
    const cur = instRef.current
    if (!cur) return
    const rw = dungeonWaveReward(cur.cid, wave)
    grantInstReward(rw.exp, rw.gold, win ? 4 : (wave === 4 ? 3 : 0))
    if (win) {
      S.current.dungeonClears = (S.current.dungeonClears || 0) + 1
      commit()
      setInst((v) => (v ? { ...v, done: 'win' } : v))
      addToast('🏆 던전 클리어!')
      pushChat({ sys: true, txt: `${DUNGEON_BY_ID[cur.cid].name} 클리어!` })
    } else {
      setInst((v) => (v ? { ...v, wave: next } : v))
      addToast(`✅ ${wave}웨이브 클리어! (+${rw.exp} EXP, +${rw.gold} G)`)
      /* 쓰러진 사람은 다음 웨이브 시작과 함께 일어난다 */
      if (live.current.dead) reviveInPlace(0.6)
    }
  }, [grantInstReward, addToast, pushChat, reviveInPlace, commit])

  /* 인스턴스 몹 처치 — 보상은 웨이브 클리어 때 전원에게 주므로 여기선 기록만 */
  const onInstMobKill = useCallback((entry) => {
    S.current.kills += 1
    commit()
    if (entry && entry.rank === 'boss') addToast('💀 보스를 쓰러뜨렸다!')
  }, [commit, addToast])
  const noRespawn = useCallback(() => {}, [])   // 인스턴스 몹은 되살아나지 않는다

  const onInstPhase = useCallback(({ phase }) => {
    setInst((v) => (v ? { ...v, phase } : v))
    addToast(`⚠ 페이즈 ${phase} — 보스가 더 강해집니다!`)
  }, [addToast])

  /* 보스 광역기가 내 발밑에 떨어졌을 때 — 각자 자기 HP에 적용한다 */
  const onInstAoe = useCallback((m) => {
    const p = world.current.player
    pushFx({ kind: 'spell', x: m.x, z: m.z, range: m.r, color: m.c || '#ef4444' })
    if (dist2(p.x, p.z, m.x, m.z) <= m.r && world.current.hitPlayer) {
      world.current.hitPlayer(m.dmg)
      addToast('💥 보스의 일격에 휩쓸렸다!')
    }
  }, [pushFx, addToast])

  /* 레이드 기믹 — 파티장만 돌린다. 페이즈가 오를수록 패턴이 늘어난다.
     예고 후 터지도록 텔레그래프를 먼저 보내고, 0.9초 뒤 실제 판정을 한다. */
  useEffect(() => {
    if (!inst || inst.kind !== 'raid' || inst.done) return
    const net = netRef.current
    if (!net || net.myId !== inst.leaderId) return
    const diff = RAID_BY_ID[inst.cid]
    let addCd = 0

    const fire = (x, z, r, dmg, color, delay = 0.9) => {
      const cur = instRef.current
      if (!cur) return
      /* 예고 (모두에게) */
      net.room.send({ t: 'dgAoe', inst: cur.inst, x, z, r, dmg: 0, c: color, tele: 1 })
      supportRef.current.onInstAoe?.({ x, z, r, dmg: 0, c: color })
      setTimeout(() => {
        const c2 = instRef.current
        if (!c2 || c2.done) return
        net.room.send({ t: 'dgAoe', inst: c2.inst, x, z, r, dmg, c: color })
        supportRef.current.onInstAoe?.({ x, z, r, dmg, c: color })
      }, delay * 1000)
    }

    const iv = setInterval(() => {
      const cur = instRef.current
      if (!cur || cur.done) return
      const w = world.current
      const boss = w.mobs.get(RAID_BOSS_ID)
      if (!boss || !boss.alive) return
      const mech = raidMechanics(cur.phase)
      const enr = mech.enrage ? 1.35 : 1
      const baseDmg = cur.solo ? soloRaidDmg(diff) : diff.dmg
      const dmg = Math.round(baseDmg * enr)

      /* 내려찍기 — 보스 주변 */
      if (mech.slam) fire(boss.x, boss.z, 6.5, dmg, '#ef4444')

      /* 일제사격 — 무작위 대상 지점 여러 곳 */
      if (mech.volley) {
        const targets = [{ x: w.player.x, z: w.player.z }, ...[...w.peers.values()].filter((p) => p.inst === cur.inst).map((p) => ({ x: p.x, z: p.z }))]
        targets.slice(0, 4).forEach((tg, i) => setTimeout(() => fire(tg.x, tg.z, 3.4, Math.round(dmg * 0.7), '#f59e0b', 0.8), i * 220))
      }

      /* 화염 장판 — 맵 곳곳 */
      if (mech.zones) {
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2
          const r = Math.random() * RAID_HALF * 0.75
          fire(Math.cos(a) * r, Math.sin(a) * r, 4.2, Math.round(dmg * 0.8), '#fb923c', 1.2)
        }
      }

      /* 부하 소환 */
      if (mech.adds && addCd <= 0) {
        addCd = 3
        const adds = Array.from({ length: Math.min(4, 2 + cur.phase) }, (_, i) => {
          const a = (i / 4) * Math.PI * 2 + Math.random()
          return {
            id: nextInstMobId.current++, type: 'wraith', scale: 1.1, rank: 'normal',
            x: Math.cos(a) * RAID_HALF * 0.5, z: Math.sin(a) * RAID_HALF * 0.5,
            hpMul: 2.4, dmgMul: 1.1, aggroR: 999,
          }
        })
        setMobs((prev) => [...prev, ...adds])
      }
      if (addCd > 0) addCd--
    }, 5200)
    return () => clearInterval(iv)
  }, [inst])

  const onInstEnd = useCallback(({ win }) => {
    const cur = instRef.current
    if (!cur) return
    if (win && cur.kind === 'raid') {
      const diff = RAID_BY_ID[cur.cid]
      grantInstReward(diff.exp, diff.gold, diff.gradeMax)
      S.current.raidClears = (S.current.raidClears || 0) + 1
      commit()
      addToast('🏆 레이드 토벌 성공!')
      pushChat({ sys: true, txt: `${diff.name} 토벌 성공!` })
    }
    setInst((v) => (v ? { ...v, done: win ? 'win' : 'fail' } : v))
  }, [grantInstReward, addToast, pushChat, commit])

  /* ==================================================================
     거래 — 내 골드와 상대 아이템을 맞바꾼다 (양쪽 다 제시할 수 있다)

     양측이 각자 제시 → 둘 다 잠금 → 둘 다 확정해야 성립한다.
     아이템은 값으로 오가고 받는 쪽에서 uid를 새로 발급한다.
     ================================================================== */
  /* trade = { peerId, nick, myGold, myItems[], theirGold, theirItems[],
               myLock, theirLock, myOk, theirOk } */
  const tradeRef = useRef(null); tradeRef.current = trade

  const requestTrade = useCallback((peerId, nick) => {
    const net = netRef.current
    if (!net) return
    if (tradeRef.current) { addToast('이미 거래 중입니다'); return }
    net.room.send({ t: 'trReq', to: peerId, nick: account.nick })
    addToast(`💱 ${nick}님에게 거래를 신청했습니다`)
    setPartyOpen(false)
  }, [account.nick, addToast])

  const openTradeWith = useCallback((peerId, nick) => {
    setTrade({
      peerId, nick, myGold: 0, myItems: [], theirGold: 0, theirItems: [],
      myLock: false, theirLock: false, myOk: false, theirOk: false,
    })
  }, [])

  const acceptTrade = useCallback(() => {
    const req = tradeReq
    setTradeReq(null)
    const net = netRef.current
    if (!net || !req) return
    net.room.send({ t: 'trAcc', to: req.from, nick: account.nick })
    openTradeWith(req.from, req.nick)
  }, [tradeReq, account.nick, openTradeWith])

  const cancelTrade = useCallback((silent) => {
    const net = netRef.current
    const t = tradeRef.current
    if (net && t && !silent) net.room.send({ t: 'trCancel', to: t.peerId })
    setTrade(null)
    if (!silent) addToast('거래를 취소했습니다')
  }, [addToast])

  /* 내 제시 내용을 상대에게 알린다 */
  const sendOffer = useCallback((gold, items) => {
    const net = netRef.current
    const t = tradeRef.current
    if (!net || !t) return
    net.room.send({ t: 'trOffer', to: t.peerId, gold, items })
  }, [])

  const setTradeGold = useCallback((raw) => {
    setTrade((v) => {
      if (!v || v.myLock) return v
      const g = clampInt(Number(raw) || 0, 0, S.current.gold)
      const nv = { ...v, myGold: g, theirOk: false, myOk: false }
      sendOffer(g, nv.myItems)
      return nv
    })
  }, [sendOffer])

  const toggleTradeItem = useCallback((item) => {
    setTrade((v) => {
      if (!v || v.myLock) return v
      const has = v.myItems.some((x) => x.uid === item.uid)
      const items = has ? v.myItems.filter((x) => x.uid !== item.uid)
        : v.myItems.length >= 3 ? v.myItems : [...v.myItems, item]
      const nv = { ...v, myItems: items, theirOk: false, myOk: false }
      sendOffer(nv.myGold, items)
      return nv
    })
  }, [sendOffer])

  const lockTrade = useCallback(() => {
    const net = netRef.current
    setTrade((v) => {
      if (!v || v.myLock) return v
      if (net) net.room.send({ t: 'trLock', to: v.peerId })
      return { ...v, myLock: true }
    })
  }, [])

  /* 교환 실행 — 각자 자기 저장 데이터에만 적용한다 (자기 것은 자기가 소유) */
  const applyTrade = useCallback((t) => {
    const s = S.current
    s.gold = Math.max(0, s.gold - t.myGold) + t.theirGold
    /* 내가 낸 아이템은 가방에서 빼고, 받은 것은 uid를 새로 매겨 넣는다 */
    const outUids = new Set(t.myItems.map((x) => x.uid))
    s.bag = s.bag.filter((x) => !outUids.has(x.uid))
    t.theirItems.forEach((it) => { s.bag.push({ ...it, uid: s.uid++ }) })
    commit()
    addToast(`💱 거래 완료! ${t.theirGold > 0 ? `+${t.theirGold} G ` : ''}${t.theirItems.length ? `아이템 ${t.theirItems.length}개 획득` : ''}`)
    pushChat({ sys: true, txt: `${t.nick}님과 거래를 마쳤습니다` })
  }, [commit, addToast, pushChat])

  const confirmTrade = useCallback(() => {
    const net = netRef.current
    setTrade((v) => {
      if (!v || !v.myLock || !v.theirLock) return v
      if (net) net.room.send({ t: 'trConfirm', to: v.peerId })
      const nv = { ...v, myOk: true }
      if (nv.theirOk) { applyTrade(nv); return null }
      return nv
    })
  }, [applyTrade])

  /* ---- 거래 메시지 수신 ---- */
  const onTradeReq = useCallback((m) => {
    if (tradeRef.current) { netRef.current?.room.send({ t: 'trCancel', to: m.id }); return }
    setTradeReq({ from: m.id, nick: m.nick || '???' })
  }, [])
  const onTradeAcc = useCallback((m) => { openTradeWith(m.id, m.nick || '???') }, [openTradeWith])
  const onTradeOffer = useCallback((m) => {
    setTrade((v) => (v && v.peerId === m.id
      ? { ...v, theirGold: m.gold || 0, theirItems: m.items || [], myOk: false, theirOk: false } : v))
  }, [])
  const onTradeLock = useCallback((m) => {
    setTrade((v) => (v && v.peerId === m.id ? { ...v, theirLock: true } : v))
  }, [])
  const onTradeConfirm = useCallback((m) => {
    setTrade((v) => {
      if (!v || v.peerId !== m.id) return v
      const nv = { ...v, theirOk: true }
      if (nv.myOk) { applyTrade(nv); return null }
      return nv
    })
  }, [applyTrade])
  const onTradeCancel = useCallback(() => {
    setTrade((v) => { if (v) addToast('상대가 거래를 취소했습니다'); return null })
  }, [addToast])

  /* ==================================================================
     결투 — 유저 대 유저. 서로 수락하면 둘만의 투기장으로 들어간다.
     각자 자기 캐릭터를 조작하고, 피해는 때린 쪽이 계산해 보낸다.
     ================================================================== */
  const duelRef = useRef(null)      // { peerId, nick, inst }

  const requestDuel = useCallback((peerId, nick) => {
    const net = netRef.current
    if (!net) return
    if (duelRef.current) { addToast('이미 결투 중입니다'); return }
    net.room.send({ t: 'dlReq', to: peerId, nick: account.nick })
    addToast(`⚔ ${nick}님에게 결투를 신청했습니다`)
    setPartyOpen(false)
  }, [account.nick, addToast])

  const enterDuel = useCallback((peerId, nick, instId) => {
    const w = world.current
    const net = netRef.current
    duelRef.current = { peerId, nick, inst: instId }
    w.inst = instId; w.instLeader = null
    w.mobs.clear(); w.portals = []; w.tutorLock = false; w.bot = null
    w.half = ARENA_HALF
    if (net) net.simOwner = false      // 결투에는 몬스터가 없다
    setBotCls(null); setBotDiff(null); setInst(null)
    setMode('arena')
    setMobs([])
    const L = live.current
    L.hp = statsRef.current.maxHp; L.dead = false; L.iframe = 1.5; L.arrows.length = 0; L.buffs = []
    L.duelHits = 0
    setDeath(null)
    w.teleport = { x: 0, z: 6, yaw: Math.PI }
    addToast(`⚔ ${nick}님과의 결투 시작!`)
  }, [addToast])

  const acceptDuel = useCallback(() => {
    const req = duelReq
    setDuelReq(null)
    const net = netRef.current
    if (!net || !req) return
    const instId = 'duel_' + [net.myId, req.from].sort().join('_')
    net.room.send({ t: 'dlAcc', to: req.from, nick: account.nick, inst: instId })
    enterDuel(req.from, req.nick, instId)
  }, [duelReq, account.nick, enterDuel])

  const endDuel = useCallback((won, silent) => {
    const d = duelRef.current
    if (!d) return
    const net = netRef.current
    if (net && !silent) net.room.send({ t: 'dlEnd', to: d.peerId, win: !won })
    duelRef.current = null
    if (won) {
      const s = S.current
      const st = statsRef.current
      s.pvpKills += 1
      s.gold += Math.round(120 * (1 + st.goldGain / 100) * adminMul(s, 'gold'))
      /* 도적이 한 방(피격 없이 단번)에 끝냈으면 어둠의 암살자 조건이 쌓인다 */
      if (cls.id === 'assassin' && (live.current.duelHits || 0) <= 1) {
        s.oneShotPvp = (s.oneShotPvp || 0) + 1
        addToast(`🌑 한방 승리 ${s.oneShotPvp}/5 — 어둠의 제단으로`)
      }
      if (cls.id === 'assassin') s.atkBonus += GROWTH_STEP
      const ev = applyExp(s, 500 * (1 + st.expGain / 100))
      commit()
      ev.forEach(addToast)
      addToast(`🏆 ${d.nick}님과의 결투에서 승리! (+120 G)`)
      pushChat({ sys: true, txt: `${account.nick}님이 ${d.nick}님과의 결투에서 승리했습니다` })
    } else {
      addToast(`💀 ${d.nick}님에게 패배했습니다`)
    }
    exitInstance(null)
  }, [cls.id, commit, addToast, pushChat, account.nick, exitInstance])
  const endDuelRef = useRef(endDuel); endDuelRef.current = endDuel

  const onDuelReq = useCallback((m) => {
    if (duelRef.current || instRef.current) { netRef.current?.room.send({ t: 'dlDec', to: m.id, nick: account.nick }); return }
    setDuelReq({ from: m.id, nick: m.nick || '???' })
  }, [account.nick])
  const onDuelAcc = useCallback((m) => { enterDuel(m.id, m.nick || '???', m.inst) }, [enterDuel])
  const onDuelHit = useCallback((m) => {
    const d = duelRef.current
    if (!d || m.id !== d.peerId) return
    if (world.current.hitPlayer) world.current.hitPlayer(m.dmg)
  }, [])
  const onDuelEnd = useCallback((m) => {
    const d = duelRef.current
    if (!d || m.id !== d.peerId) return
    endDuelRef.current(!!m.win, true)
  }, [])

  /* 네트워크 수신 핸들러 묶음 — 위의 콜백이 모두 정의된 뒤에 채운다.
     (배선 useEffect는 supportRef.current를 통해 항상 최신 것을 호출한다) */
  supportRef.current = {
    applyBuffList, selfHeal, reviveInPlace, pushChat,
    setPInvite, hasParty: () => !!partyRef.current,
    onPartyAccept, onPartySnap, onPartyReady, onPartyLeave, onPartyStart,
    onInstWave, onInstPhase, onInstEnd, onInstAoe,
    onTradeReq, onTradeAcc, onTradeOffer, onTradeLock, onTradeConfirm, onTradeCancel,
    onDuelReq, onDuelAcc, onDuelHit, onDuelEnd,
  }

  const enterArena = useCallback((diffId) => {
    const s = S.current
    if (!s.unlocked) { lockedNotice(); return }
    const diff = AI_DIFFS[clampInt(diffId, 0, 5)]
    s.aiDiff = diff.id
    const others = CLASSES.filter((c) => c.id !== cls.id)
    const bc = others[Math.floor(Math.random() * others.length)]
    commit()
    setBotCls(bc); setBotDiff(diff); setMode('arena'); setDiffModal(false)
    world.current.half = ARENA_HALF; world.current.bot = null; world.current.tutorLock = false; world.current.portals = []
    const L = live.current
    L.hp = statsRef.current.maxHp; L.dead = false; L.iframe = 1.2; L.arrows.length = 0
    world.current.teleport = { x: 0, z: -6, yaw: 0 }
    addToast(`⚔ [${diff.name}] 난이도 결투 시작! 상대: ${bc.name}`)
  }, [cls, commit, addToast, lockedNotice])

  const onBotDead = useCallback(() => {
    const s = S.current
    const st = statsRef.current
    const diff = botDiff || AI_DIFFS[1]
    s.gold += Math.round(diff.gold * (1 + st.goldGain / 100) * adminMul(s, 'gold'))
    s.pvpKills += 1
    if (diff.id > s.bestDiff) s.bestDiff = diff.id
    const ev = applyExp(s, diff.exp * (1 + st.expGain / 100))
    if (cls.id === 'assassin') {
      s.atkBonus += GROWTH_STEP
      addToast(`🗡 처형 ${s.pvpKills}회 — 공격력 +${(s.pvpKills * GROWTH_STEP).toFixed(2)}`)
    }
    if (diff.id >= 4) addItem(makeArtifact(s, diff.id === 5 ? 5 : 4))
    else if (diff.id >= 2) addItem(makeRune(s))
    else if (Math.random() < 0.5) addItem(makeArmor(s))
    commit()
    addToast(`🏆 [${diff.name}] 승리! +${diff.gold} G · +${diff.exp} EXP`)
    ev.forEach(addToast)
    setBotCls(null); setBotDiff(null); setMode('field')
    world.current.half = MAP_BY_ID[mapIdRef.current].half; world.current.bot = null
    world.current.tutorLock = !S.current.unlocked && mapIdRef.current === 0
    world.current.portals = portalsFor(mapIdRef.current)
    world.current.teleport = { x: PVP_PORTAL.x, z: PVP_PORTAL.z + 4, yaw: Math.PI }
  }, [cls, botDiff, commit, addToast, addItem])

  /* ---------- 상호작용 ---------- */
  const promptAction = useCallback(() => {
    if (uiOpenRef.current || live.current.dead) return
    const pr = live.current.prompt
    if (!pr) return
    if (pr.kind === 'portal') {
      if (!S.current.unlocked) { lockedNotice(); return }
      setDiffModal(true)
    } else if (pr.kind === 'altar') {
      if (!S.current.unlocked) { lockedNotice(); return }
      if (!live.current.sermon.active) { live.current.sermon = { active: true, t: 0, dur: 2.5 }; bumpHud() }
    } else if (pr.kind === 'npc') {
      const npc = NPC_BY_ID[pr.id]
      if (!npc) return
      if (npc.role !== 'chief' && !S.current.unlocked) { lockedNotice(); return }
      setNpcModal(npc)
    } else if (pr.kind === 'sq') {
      if (!S.current.unlocked) { lockedNotice(); return }
      setSqModal(pr.id)
    } else if (pr.kind === 'hidden') {
      if (!S.current.unlocked) { lockedNotice(); return }
      hiddenSpotRef.current(pr.id)
    }
  }, [bumpHud, lockedNotice])
  const promptRef = useRef(promptAction); promptRef.current = promptAction

  /* 첫 접속 시 이장 대화 자동 오픈 */
  const bootedRef = useRef(false)
  useEffect(() => {
    // StrictMode 이중 마운트에서도 한 번만 열리도록 ref로 가드 (타이머를 쓰면 cleanup에 지워진다)
    if (bootedRef.current) return
    if (S.current.tutorial === 'none') {
      bootedRef.current = true
      setNpcModal(NPC_BY_ID.chief)
    }
  }, [])

  /* ---------- 입력 ---------- */
  useEffect(() => {
    /* 조이스틱(왼손)과 시점(오른손)이 섞이지 않도록 포인터 ID로 구분한다 */
    const drag = { id: null, lx: 0, ly: 0 }
    const onContext = (e) => e.preventDefault()
    const onDown = (e) => {
      if (e.target.closest && e.target.closest('[data-ui]')) return
      const touch = e.pointerType === 'touch'
      if (e.button === 2 || touch) {          // 우클릭 또는 터치 → 시점 회전
        drag.id = e.pointerId; drag.lx = e.clientX; drag.ly = e.clientY
        return
      }
      if (e.button === 0) {                   // 마우스 좌클릭 → 공격
        if (uiOpenRef.current || live.current.dead) return
        doAttackRef.current()
      }
    }
    const onMove = (e) => {
      if (drag.id !== e.pointerId) return
      const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly
      drag.lx = e.clientX; drag.ly = e.clientY
      camRef.current.yaw -= dx * CAM_SENS
      camRef.current.pitch = clamp(camRef.current.pitch + dy * CAM_SENS, CAM_MIN_PITCH, CAM_MAX_PITCH)
    }
    const onUp = (e) => { if (drag.id === e.pointerId) drag.id = null }
    const onKey = (e) => {
      if (e.repeat) return
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return
      /* 스킬 핫바 — 1~9, 0, - 로 최대 11칸 */
      const n = {
        Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Digit5: 5,
        Digit6: 6, Digit7: 7, Digit8: 8, Digit9: 9, Digit0: 10, Minus: 11,
      }[e.code]
      if (n) { castRef.current(n); return }
      if (e.code === 'KeyE') { live.current.eHeld = true; promptRef.current() }
      else if (e.code === 'KeyF') {
        /* 어둠의 암살자 전용 — 5초간 속도 500% 증폭 + 무적, 쿨타임 5초 (사용자 확정) */
        if (cls.id !== 'darkassassin') return
        const L = live.current
        if (L.dead || controlRef.current.lock) return
        if ((L.cd['dark_burst'] || 0) > 0) return
        const now = performance.now()
        L.cd['dark_burst'] = 5
        L.burst = { until: now + 5000 }
        addToast('🌀 은신 폭주 — 5초간 속도 500% + 무적!')
      }
      else if (e.code === 'KeyC') {
        /* 채팅 — 온라인 같이 하기 중에만 (사용자 확정 규칙) */
        if (!netRef.current) return
        setChatOpen((v) => {
          const nv = !v
          if (nv) setTimeout(() => chatInputRef.current && chatInputRef.current.focus(), 60)
          return nv
        })
      }
      else if (e.code === 'KeyP') { if (netRef.current) setPartyOpen((v) => !v) }
      else if (e.code === 'KeyI') { if (!live.current.dead) setInvOpen((v) => !v) }
      else if (e.code === 'KeyK') {
        if (live.current.dead) return
        if (!S.current.unlocked) { lockedNotice(); return }
        setTreeOpen((v) => !v)
      } else if (e.code === 'Escape') {
        setMathModal(null); setInvOpen(false); setTreeOpen(false); setNpcModal(null); setDiffModal(false)
        setSqModal(null); setPartyOpen(false); setAdminOpen(false)
      }
    }
    /* E를 꾹 누르는 동안(요정 모으기) 상태를 추적한다 */
    const onKeyUp = (e) => { if (e.code === 'KeyE') live.current.eHeld = false }
    const onBlurE = () => { live.current.eHeld = false }
    window.addEventListener('contextmenu', onContext)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlurE)
    return () => {
      window.removeEventListener('contextmenu', onContext)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlurE)
    }
  }, [lockedNotice, cls, addToast])

  /* ---------- 파생 표시값 ---------- */
  const L = live.current
  const hpPct = clamp(L.hp / stats.maxHp, 0, 1)
  const hurtOpacity = Math.min(0.8, L.hurtT * 1.5) + (!L.dead && hpPct < 0.25 ? 0.25 : 0)
  const isRanged = cls.mode === 'arrow' || cls.mode === 'spell'
  const sermon = L.sermon
  const expNeed = EXP_FOR(saveUI.level)
  const tierInfo = JOB_TIERS[saveUI.tier]
  const growAmount = cls.statKey === 'buffCoef' ? saveUI.buffCoef
    : cls.statKey === 'debuffPower' ? saveUI.debuffPower
    : cls.statKey === 'healPower' ? saveUI.healPower : saveUI.atkBonus
  /* 핫바 — 11칸 (1~9, 0, -). 배운 스킬 + 다음 티어 미리보기만 보여 화면을 아낀다 */
  const activeSkills = useMemo(() => {
    const list = SKILLS[cls.id] || []
    return list.filter((s) => s.tier <= Math.min(MAX_TIER, saveUI.tier + 1))
  }, [cls.id, saveUI.tier])
  const slotKeyLabel = (slot) => (slot === 10 ? '0' : slot === 11 ? '-' : String(slot))
  const promptLabel = !L.prompt ? null
    : L.prompt.kind === 'altar' ? '제단에서 설교 듣기'
    : L.prompt.kind === 'portal' ? 'PVP 결투장 입장'
    : L.prompt.kind === 'sq' ? (SQ_BY_ID[L.prompt.id]?.npc || 'NPC') + ' 와(과) 대화'
    : L.prompt.kind === 'hidden' ? (SPECIAL_SPOTS[L.prompt.id]?.label || '수상한 곳') + ' — 조사하기'
    : (NPC_BY_ID[L.prompt.id]?.name || 'NPC') + ' 와(과) 대화'

  return (
    <div className="fixed inset-0 select-none">
      <Canvas shadows camera={{ fov: 52, near: 0.1, far: 260, position: [0, 6, 14] }}>
        <color attach="background" args={[mode === 'arena' ? '#2a2036' : mapDef.sky]} />
        <fog attach="fog" args={[mode === 'arena' ? '#2a2036' : mapDef.sky, mapDef.fog[0], mapDef.fog[1]]} />
        <hemisphereLight args={['#dcefff', '#4c7a3f', 1.1]} />
        <directionalLight
          castShadow position={[16, 24, 12]} intensity={2.0}
          shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}
          shadow-camera-left={-42} shadow-camera-right={42}
          shadow-camera-top={42} shadow-camera-bottom={-42}
          shadow-camera-near={1} shadow-camera-far={100}
        />

        {mode === 'field' ? (
          <group>
            <Ground color={mapDef.ground} />
            <MapScenery mapId={mapId} />
            {mapId === 0 && (
              <group>
                <TrainingFloor />
                <Altar glow={sermon.active} />
                <Portal position={PVP_PORTAL} />
                {NPCS.map((n) => (
                  <QuestNPC key={n.id} npc={n}
                    state={n.role === 'chief'
                      ? (allQuestsDone(saveUI) ? 'done' : canTurnIn(saveUI) ? 'ready' : saveUI.tutorial === 'none' ? 'none' : 'active')
                      : n.role === 'merchant' || n.role === 'changer' ? 'none'
                      : (n.cls === cls.id && canAdvance(saveUI) ? 'ready' : 'done')} />
                ))}
                {TARGET_SPOTS.map((t, i) => (
                  <Target key={i} entry={{ id: i, ...t }} world={world} onHitTarget={onTargetHit} />
                ))}
                {DUMMY_SPOTS.map((d, i) => (
                  <Dummy key={i} entry={{ id: i, ...d }} world={world} onHealDummy={onHealDummy} />
                ))}
                {fragments.map((f) => <Fragment key={f.id} x={f.x} z={f.z} />)}
              </group>
            )}
            {/* 맵별 사이드 퀘스트 NPC */}
            {sqSpots.map((sp) => (
              <SideQuestNPC key={sp.id} spot={sp}
                state={sqState(saveUI, sp.id)}
                ready={sqState(saveUI, sp.id) === 'active' && sqComplete(saveUI, sp)}
                canTake={sqState(saveUI, sp.id) === 'none' && saveUI.level >= sp.reqLv} />
            ))}
            {/* 히든 직업 지점 */}
            {hiddenSpot && <HiddenSpot spot={hiddenSpot} />}
            {/* 맵 연결 포탈 — 빛나는 기둥 */}
            {portalsFor(mapId).map((p) => (
              <PortalPillar key={p.to} x={p.x} z={p.z} color={p.color} label={p.label}
                locked={!unlocked || saveUI.level < MAP_BY_ID[p.to].reqLv} />
            ))}
            <group key={'m' + mapId}>
              {mobs.map((m) => (
                <Monster key={m.id} entry={m} world={world} live={live} onKill={onMobKill} onRespawn={onMobRespawn} />
              ))}
            </group>
            {/* 튜토리얼 경계 표시 */}
            {!unlocked && mapId === 0 && (
              <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
                <ringGeometry args={[TUTORIAL_RADIUS - 0.35, TUTORIAL_RADIUS, 64]} />
                <meshBasicMaterial color="#fbbf24" transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
            )}
          </group>
        ) : mode === 'dungeon' || mode === 'raid' ? (
          <group>
            <DungeonArena inst={inst} mobs={mobs} world={world} live={live}
              onKill={onInstMobKill} onRespawn={noRespawn} />
            {allies.map((a, i) => (
              <AllyBot key={a.id} ally={a} world={world} live={live} index={i} />
            ))}
          </group>
        ) : (
          <group>
            <Ground color="#3a3450" />
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} receiveShadow>
              <circleGeometry args={[ARENA_HALF + 0.5, 48]} /><meshStandardMaterial color="#4a4363" roughness={0.9} />
            </mesh>
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
              <ringGeometry args={[ARENA_HALF - 0.1, ARENA_HALF + 0.5, 48]} />
              <meshBasicMaterial color={botDiff ? botDiff.color : '#e879f9'} />
            </mesh>
            {Array.from({ length: 16 }, (_, i) => {
              const a = (i / 16) * Math.PI * 2
              return (
                <mesh key={i} castShadow position={[Math.cos(a) * (ARENA_HALF + 0.5), 1, Math.sin(a) * (ARENA_HALF + 0.5)]}>
                  <cylinderGeometry args={[0.18, 0.22, 2, 8]} /><meshStandardMaterial color="#6b5f86" roughness={0.8} />
                </mesh>
              )
            })}
            {botCls && botDiff && <Bot botCls={botCls} diff={botDiff} world={world} live={live} onDead={onBotDead} />}
          </group>
        )}

        <Player cls={cls} wtype={wtype} gradeColor={weaponGradeColor} awakened={stats.awakened}
          swing={swing} world={world} live={live} camRef={camRef} controlRef={controlRef} statsRef={statsRef} />
        {fx.map((f) => {
          if (f.kind === 'slash') return <SlashFx key={f.id} fx={f} onDone={fxDone} />
          if (f.kind === 'spell') return <SpellFx key={f.id} fx={f} onDone={fxDone} />
          return <HealFx key={f.id} fx={f} onDone={fxDone} />
        })}
        <ArrowPool live={live} />
        {/* 어둠의 암살자 잔상 — 흐릿한 내 모습 */}
        {cls.id === 'darkassassin' && <Afterimages world={world} cls={cls} wtype={wtype} />}
        {/* 같은 zone에 있는 다른 플레이어 (필드 · 던전 · 레이드 · 결투) */}
        {(mode !== 'arena' || world.current.inst) && <RemotePlayers roster={roster} world={world} />}
        <GameLogic world={world} live={live} mode={mode} mapId={mapId} statsRef={statsRef}
          bumpHud={bumpHud} onFragment={onFragment} onSermon={onSermon} onPortal={changeMap} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 transition-opacity duration-150"
        style={{ boxShadow: 'inset 0 0 140px 30px rgba(220,38,38,0.8)', opacity: hurtOpacity }} />

      {isRanged && !uiOpen && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="h-5 w-5 rounded-full border-2" style={{ borderColor: cls.color + 'cc' }} />
          <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
        </div>
      )}

      {/* 좌상단 */}
      <div className="pointer-events-none absolute left-4 top-4 w-64 rounded-2xl border border-white/10 bg-slate-900/75 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl"
            style={{ background: cls.color + '33', border: `1px solid ${cls.color}66` }}>{cls.icon}</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">
              {account.nick}
              <span className="ml-1.5 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">Lv.{saveUI.level}</span>
            </div>
            <div className="text-[11px]" style={{ color: cls.color }}>[{tierInfo.name}] {cls.name} · {WEAPON_TYPES[wtype].name}</div>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/50">
          {unlocked
            ? <div className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-400" style={{ width: `${Math.min(100, (saveUI.exp / expNeed) * 100)}%` }} />
            : <div className="h-full w-full bg-slate-700/60" />}
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
          <span>{unlocked ? `EXP ${saveUI.exp.toLocaleString()}/${expNeed.toLocaleString()}` : '🔒 레벨 잠김'}</span>
          {saveUI.sp > 0 && <span className="font-bold text-emerald-300">SP {saveUI.sp}</span>}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1 text-[10px]">
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-white">⚔ {stats.atk.toFixed(2)}</span>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-white">💥 {stats.critRate.toFixed(0)}%</span>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-white">🛡 {stats.defense.toFixed(0)}</span>
          <span className="rounded px-1.5 py-0.5 font-bold" style={{ background: cls.color + '22', color: cls.color }}>
            {cls.statLabel} +{growAmount.toFixed(2)}
          </span>
        </div>
      </div>

      {/* 우상단 */}
      <div className="pointer-events-none absolute right-4 top-4 rounded-2xl border border-white/10 bg-slate-900/75 px-4 py-2.5 text-right backdrop-blur-sm">
        <div className="text-sm font-black text-amber-300">🪙 {saveUI.gold.toLocaleString()}</div>
        <div className="text-[11px] text-slate-400">처치 {saveUI.kills} · PVP {saveUI.pvpKills}</div>
        <div className="mt-1 text-[11px] font-bold" style={{ color: mode === 'arena' ? (botDiff?.color || '#e879f9') : '#4ade80' }}>
          {mode === 'arena' ? `⚔ ${botDiff?.name || ''} 결투` : `🗺 ${mapDef.name}`}
        </div>
      </div>

      {/* 메인 퀘스트 추적 / 성장 안내 */}
      {!inst && !allQuestsDone(saveUI) ? (() => {
        const q = currentQuest(saveUI)
        const ready = canTurnIn(saveUI)
        const stepPct = ((saveUI.mq || 0) / MQ_COUNT) * 100
        return (
          <div className="pointer-events-none absolute left-1/2 top-4 w-[min(92vw,30rem)] -translate-x-1/2 rounded-2xl border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-center backdrop-blur-sm">
            <div className="text-[11px] font-black tracking-widest text-amber-200">
              📜 메인 퀘스트 {(saveUI.mq || 0) + 1} / {MQ_COUNT} · {q.icon} {q.title}
            </div>
            <div className="text-[12px] text-white">
              {saveUI.tutorial === 'none' ? '마을 이장에게 말을 걸어보세요 (E)'
                : ready ? '✅ 완료 — 마을 이장에게 돌아가세요!'
                : `${q.hint} — ${q.progress(saveUI)}`}
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/40">
              <div className="h-full bg-amber-400 transition-[width]" style={{ width: `${ready ? Math.min(100, stepPct + 100 / MQ_COUNT) : stepPct}%` }} />
            </div>
          </div>
        )
      })() : inst ? null : (
        <div className="pointer-events-none absolute left-1/2 top-4 max-w-md -translate-x-1/2 rounded-full border border-white/10 bg-black/40 px-4 py-1.5 text-center text-[11px] text-white/75 backdrop-blur-sm">
          💡 {cls.growHint}
        </div>
      )}

      {sermon.active && (
        <div className="pointer-events-none absolute left-1/2 top-1/3 w-56 -translate-x-1/2 text-center">
          <div className="mb-1 text-xs font-bold text-amber-200">✝️ 설교를 듣는 중...</div>
          <div className="h-2 overflow-hidden rounded-full bg-black/50">
            <div className="h-full bg-amber-400" style={{ width: `${(sermon.t / sermon.dur) * 100}%` }} />
          </div>
        </div>
      )}

      {promptLabel && !uiOpen && !sermon.active && (
        <div className="pointer-events-none absolute bottom-40 left-1/2 -translate-x-1/2 rounded-full border border-white/20 bg-black/70 px-5 py-2 text-sm text-white">
          <b className="rounded bg-white/20 px-1.5">E</b> {promptLabel}
        </div>
      )}

      {/* 스킬 바 — 최대 11칸이라 좁게, 넘치면 줄바꿈 */}
      {unlocked && (
        <div data-ui className={`absolute left-1/2 flex max-w-[96vw] -translate-x-1/2 flex-wrap justify-center gap-1.5 ${isMobile ? 'bottom-44 scale-90' : 'bottom-16'}`}>
          {activeSkills.map((sk) => {
            const lv = saveUI.skills[sk.id] || 0
            const tierOk = saveUI.tier >= sk.tier
            const cd = L.cd[sk.id] || 0
            const ready = tierOk && lv > 0 && cd <= 0
            const icon = sk.kind === 'buff' ? '🕊️' : sk.kind === 'heal' ? '💗' : sk.kind === 'debuff' ? '🌒' : sk.kind === 'awaken' ? '🌟' : sk.kind === 'dash' ? '💨' : '⚡'
            return (
              <button key={sk.id} onClick={() => castSkillSlot(sk.slot)} title={`${sk.name} — ${sk.desc}`}
                className="relative h-14 w-12 overflow-hidden rounded-xl border text-center backdrop-blur-sm transition active:scale-95"
                style={{ borderColor: ready ? sk.color + 'aa' : '#ffffff22', background: ready ? sk.color + '22' : 'rgba(15,23,42,.8)' }}>
                <div className="pt-1 text-base leading-none">{tierOk ? (lv > 0 ? icon : '➕') : '🔒'}</div>
                <div className="truncate px-0.5 text-[8px] leading-tight text-slate-200">{tierOk ? sk.name : JOB_TIERS[sk.tier].title}</div>
                <div className="text-[8px] font-bold" style={{ color: sk.color }}>{lv > 0 ? `Lv.${lv}` : ''}</div>
                {cd > 0 && <div className="absolute inset-x-0 bottom-0 bg-black/70" style={{ height: `${(cd / sk.cd) * 100}%` }} />}
                {cd > 0 && <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-white">{cd.toFixed(1)}</div>}
                <div className="absolute left-1 top-0.5 text-[8px] font-bold text-slate-400">{slotKeyLabel(sk.slot)}</div>
              </button>
            )
          })}
        </div>
      )}

      {/* HP 바 */}
      <div className={`pointer-events-none absolute left-1/2 -translate-x-1/2 ${isMobile ? 'bottom-3 w-[min(44vw,220px)]' : 'bottom-4 w-[min(92vw,380px)]'}`}>
        <div className="relative h-5 overflow-hidden rounded-full border border-white/10 bg-black/55">
          <div className="h-full rounded-full transition-[width] duration-150"
            style={{ width: `${hpPct * 100}%`, background: 'linear-gradient(90deg,#4ade80,#22c55e)' }} />
          <div className="absolute inset-0 text-center text-[11px] font-bold leading-5 text-white drop-shadow">
            HP {Math.ceil(L.hp)} / {stats.maxHp}
          </div>
        </div>
      </div>

      {!isMobile && (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl bg-black/40 px-3 py-2 text-[10px] leading-relaxed text-white/70">
          <b>우클릭 드래그</b> 카메라 · <b>WASD</b> 이동(카메라 기준)<br />
          <b>좌클릭</b> {cls.mode === 'spell' ? '마법(수학)' : cls.mode === 'heal' ? '치유/공격' : '공격'} · <b>1~9 0 -</b> 스킬 · <b>E</b> 상호작용 · <b>I</b> 인벤토리 · <b>K</b> 스킬트리
          {cls.id === 'darkassassin' && <><br /><b>F</b> 은신 폭주 (5초간 속도 500%+무적, 쿨5초)</>}
          {room.connected && <><br /><b>P</b> 파티 · <b>C</b> 채팅</>}
        </div>
      )}

      {/* 모바일 터치 조작 */}
      {isMobile && !uiOpen && !L.dead && (
        <>
          <div className="absolute bottom-5 left-4 z-40">
            <VirtualJoystick size={118} onVec={rpgSetVec} />
          </div>
          <div className="absolute bottom-[9.5rem] left-8 z-40">
            <TouchBtn label="🏃" sub="달리기" size={56} textSize="text-lg"
              bg={runOn ? 'rgba(52,211,153,.4)' : 'rgba(255,255,255,.14)'}
              border={runOn ? 'rgba(52,211,153,.85)' : 'rgba(255,255,255,.32)'}
              onPress={toggleRun} />
          </div>
          <div className="absolute bottom-5 right-4 z-40 flex flex-col items-center gap-2.5">
            {promptLabel && !sermon.active && (
              <TouchBtn label="E" size={52} textSize="text-base"
                bg="rgba(52,211,153,.3)" border="rgba(52,211,153,.7)"
                onPress={promptAction} />
            )}
            <TouchBtn
              label={cls.mode === 'spell' ? '🔮' : cls.mode === 'heal' ? '💖' : '⚔'}
              sub="공격" size={88} textSize="text-2xl"
              bg={cls.color + '44'} border={cls.color + 'cc'}
              onPress={() => doAttackRef.current()} />
          </div>
        </>
      )}

      <div data-ui className={`absolute right-4 flex flex-col items-end gap-2 ${isMobile ? 'top-28 scale-90 origin-top-right' : 'bottom-4'}`}>
        <button onClick={() => setRoomOpen(true)}
          className={`rounded-full border px-4 py-2 text-sm font-bold backdrop-blur-sm transition ${room.connected
            ? 'border-emerald-400/50 bg-emerald-600/80 text-white hover:bg-emerald-600'
            : 'border-white/15 bg-slate-900/85 text-white hover:bg-slate-800'}`}>
          {room.connected
            ? <>🌐 월드 <span className="ml-1 rounded-full bg-black/35 px-2 py-0.5 text-[10px]">{room.members.length}명</span></>
            : <>🚪 혼자 하기</>}
        </button>
        {room.connected && (
          <button onClick={() => setPartyOpen(true)}
            className={`rounded-full border px-4 py-2 text-sm font-bold backdrop-blur-sm transition ${party
              ? 'border-amber-400/50 bg-amber-600/80 text-white hover:bg-amber-600'
              : 'border-white/15 bg-slate-900/85 text-white hover:bg-slate-800'}`}>
            🛡 파티{party ? ` ${party.members.length}명` : ''} {!isMobile && <span className="text-[10px] text-slate-400">(P)</span>}
          </button>
        )}
        {room.connected && (
          <button onClick={() => {
            setChatOpen((v) => {
              const nv = !v
              if (nv) setTimeout(() => chatInputRef.current && chatInputRef.current.focus(), 60)
              return nv
            })
          }}
            className="rounded-full border border-white/15 bg-slate-900/85 px-4 py-2 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-slate-800">
            💬 채팅 {!isMobile && <span className="text-[10px] text-slate-400">(C)</span>}
          </button>
        )}
        <button onClick={() => { if (!unlocked) { lockedNotice(); return } setTreeOpen(true) }}
          className={`rounded-full border px-4 py-2 text-sm font-bold backdrop-blur-sm transition ${unlocked ? 'border-white/15 bg-slate-900/85 text-white hover:bg-slate-800' : 'border-white/10 bg-slate-900/60 text-slate-500'}`}>
          {unlocked ? '🕸' : '🔒'} 스킬트리 <span className="text-[10px] text-slate-400">(K)</span>
          {unlocked && saveUI.sp > 0 && <span className="ml-1.5 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black">SP {saveUI.sp}</span>}
        </button>
        <button onClick={() => setInvOpen(true)}
          className="rounded-full border border-amber-300/40 bg-gradient-to-r from-amber-500/90 to-orange-500/90 px-5 py-2.5 text-sm font-black text-white shadow-lg backdrop-blur-sm transition hover:brightness-110">
          🎒 인벤토리 <span className="text-[10px] opacity-80">(I)</span>
          {saveUI.bag.length > 0 && <span className="ml-1.5 rounded-full bg-black/40 px-2 py-0.5 text-[10px]">{saveUI.bag.length}</span>}
        </button>
      </div>

      {/* ── 던전 · 레이드 진행 상황 ── */}
      {inst && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-2xl border border-white/15 bg-black/60 px-5 py-2 text-center backdrop-blur-sm">
          <div className="text-[11px] tracking-[0.25em] text-amber-200/80">
            {inst.kind === 'dungeon' ? DUNGEON_BY_ID[inst.cid].name : RAID_BY_ID[inst.cid].name}
            {inst.solo && <span className="ml-1.5 rounded-full bg-sky-500/25 px-1.5 py-0.5 text-[9px] font-black text-sky-200">🧍 솔로</span>}
          </div>
          {inst.kind === 'dungeon' ? (
            <>
              <div className="text-lg font-black text-white">
                웨이브 {inst.wave} <span className="text-sm text-slate-400">/ {DG_WAVES}</span>
              </div>
              <div className="mt-1 flex justify-center gap-1">
                {Array.from({ length: DG_WAVES }, (_, i) => (
                  <span key={i} className={`h-1.5 w-6 rounded-full ${i + 1 < inst.wave ? 'bg-emerald-400' : i + 1 === inst.wave ? 'bg-amber-400' : 'bg-white/20'}`} />
                ))}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">
                {inst.wave <= 3 ? '일반 몬스터' : inst.wave === 4 ? '⚔ 엘리트 2마리' : '👑 보스'}
              </div>
            </>
          ) : (
            <>
              <div className="text-lg font-black text-white">
                페이즈 {inst.phase} <span className="text-sm text-slate-400">/ {RAID_BY_ID[inst.cid].phases}</span>
              </div>
              {(() => {
                const b = world.current.mobs.get(RAID_BOSS_ID)
                const r = b && b.maxHp ? clamp(b.hp / b.maxHp, 0, 1) : 1
                return (
                  <div className="mt-1 h-2 w-56 overflow-hidden rounded-full border border-white/15 bg-black/50">
                    <div className="h-full rounded-full transition-[width] duration-200"
                      style={{ width: `${r * 100}%`, background: 'linear-gradient(90deg,#f43f5e,#a855f7)' }} />
                  </div>
                )
              })()}
            </>
          )}
        </div>
      )}

      {/* 던전/레이드 결과 */}
      {inst && inst.done && (
        <div data-ui className="absolute inset-0 z-[65] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-[21rem] rounded-3xl border border-white/15 bg-slate-900 p-7 text-center shadow-2xl [animation:pop_.4s_cubic-bezier(.2,1.6,.4,1)]">
            <div className="text-6xl">{inst.done === 'win' ? '🏆' : '💀'}</div>
            <div className={`mt-3 text-2xl font-black ${inst.done === 'win' ? 'text-amber-300' : 'text-rose-400'}`}>
              {inst.done === 'win' ? '클리어!' : '전멸...'}
            </div>
            <div className="mt-2 text-[12px] text-slate-400">
              {inst.done === 'win'
                ? '파티 전원이 보상을 받았습니다'
                : '파티 전원이 쓰러졌습니다 — 마을로 돌아갑니다'}
            </div>
            <button onClick={() => exitInstance(inst.done === 'win' ? '마을로 돌아왔습니다' : '다시 도전해보세요')}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-3 font-black text-white transition hover:brightness-110">
              나가기
            </button>
          </div>
        </div>
      )}

      {/* ── 코드 입력창 (채팅창 바로 위) ── */}
      <div data-ui className={`absolute left-4 z-40 w-[19rem] max-w-[85vw] ${isMobile
        ? (room.connected ? 'bottom-[19.5rem]' : 'bottom-40')
        : (room.connected ? 'bottom-[17.5rem]' : 'bottom-24')}`}>
        {codeOpen ? (
          <div className="rounded-2xl border border-white/15 bg-black/70 p-2 backdrop-blur-sm">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-[11px] font-bold text-slate-300">🎟 코드 입력</span>
              <button onClick={() => { setCodeOpen(false); setCodeMsg(null); setAskPw(false) }}
                className="px-1 text-slate-400 transition hover:text-white">✕</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault()
              if (codeInputRef.current) { submitCode(codeInputRef.current.value); codeInputRef.current.value = '' }
            }}>
              <input ref={codeInputRef} maxLength={32}
                type={askPw ? 'password' : 'text'}
                placeholder={askPw ? '비밀번호' : '코드를 입력하세요'}
                onKeyDown={(e) => { if (e.key === 'Escape') { setCodeOpen(false); e.currentTarget.blur() } }}
                className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-[12px] text-white outline-none transition focus:border-amber-400" />
            </form>
            {codeMsg && (
              <div className={`px-1 pt-1 text-[11px] ${codeMsg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
                {codeMsg.ok ? '✓' : '✕'} {codeMsg.txt}
              </div>
            )}
          </div>
        ) : (
          <button onClick={() => { setCodeOpen(true); setTimeout(() => codeInputRef.current && codeInputRef.current.focus(), 60) }}
            className="rounded-full border border-white/15 bg-black/50 px-3 py-1 text-[11px] font-bold text-slate-300 backdrop-blur-sm transition hover:bg-black/70">
            🎟 코드
          </button>
        )}
        {saveUI.admin && (
          <button onClick={() => setAdminOpen(true)}
            className="ml-1.5 mt-1.5 rounded-full border border-rose-400/40 bg-rose-600/70 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm transition hover:bg-rose-600">
            🛠 관리자
          </button>
        )}
      </div>

      {/* ── 채팅 (온라인 전용) ── */}
      {room.connected && (
        <div data-ui className={`absolute left-4 z-40 w-[19rem] max-w-[85vw] ${isMobile ? 'bottom-40' : 'bottom-24'}`}>
          {chatOpen ? (
            <div className="rounded-2xl border border-white/15 bg-black/70 backdrop-blur-sm">
              <div className="flex items-center justify-between px-3 pt-2">
                <span className="text-[11px] font-bold text-slate-300">💬 채팅</span>
                <button onClick={() => setChatOpen(false)} className="px-1 text-slate-400 transition hover:text-white">✕</button>
              </div>
              <div ref={chatListRef} className="max-h-40 space-y-0.5 overflow-y-auto px-3 py-1.5 text-[12px]">
                {chatMsgs.current.length === 0 && <div className="text-slate-500">아직 대화가 없습니다 — 첫 인사를 건네보세요</div>}
                {chatMsgs.current.map((m, i) => m.sys
                  ? <div key={i} className="text-amber-300/90">📢 {m.txt}</div>
                  : <div key={i} className="break-all text-slate-200"><b className={m.me ? 'text-emerald-300' : 'text-sky-300'}>{m.nick}</b> {m.txt}</div>)}
              </div>
              <form className="p-2" onSubmit={(e) => {
                e.preventDefault()
                if (chatInputRef.current) { sendChat(chatInputRef.current.value); chatInputRef.current.value = '' }
              }}>
                <input ref={chatInputRef} maxLength={120} placeholder="메시지 입력 후 Enter"
                  onKeyDown={(e) => { if (e.key === 'Escape') { setChatOpen(false); e.currentTarget.blur() } }}
                  className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-[12px] text-white outline-none transition focus:border-indigo-400" />
              </form>
            </div>
          ) : (
            chatMsgs.current.length > 0 && (
              <div className="pointer-events-none space-y-0.5 text-[12px]">
                {chatMsgs.current.slice(-3).map((m, i) => (
                  <div key={i} className="w-fit max-w-full truncate rounded-lg bg-black/45 px-2 py-0.5 text-slate-200">
                    {m.sys ? <span className="text-amber-300/90">📢 {m.txt}</span> : <><b className="text-sky-300">{m.nick}</b> {m.txt}</>}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* ── 모달 ── */}
      {invOpen && (
        <InventoryModal save={saveUI} cls={cls} stats={stats}
          onEquip={equipItem} onUnequip={unequipItem} onSell={sellItem} onClose={() => setInvOpen(false)} />
      )}
      {treeOpen && (
        <SkillTreeModal save={saveUI} cls={cls} stats={stats} onInvest={investSkill} onClose={() => setTreeOpen(false)} />
      )}
      {npcModal && (
        <NpcModal npc={npcModal} save={saveUI} cls={cls} nick={account.nick}
          onAbandonClass={abandonClass} onPickNewClass={pickNewClass} onBecomeHidden={becomeHidden}
          onStartTutorial={startTutorial} onTurnInQuest={turnInQuest}
          onBuy={buyItem} onAdvanceGold={advanceByGold}
          onAcceptJobQuest={acceptJobQuest} onCompleteJobQuest={completeJobQuest} onTrainSp={trainSp}
          onClose={() => setNpcModal(null)} />
      )}
      {diffModal && <DifficultyModal save={saveUI} onPick={enterArena} onClose={() => setDiffModal(false)} />}
      {roomOpen && (
        <RoomModal room={room} isHost={roomIsHost} onJoin={joinRoom} onLeave={leaveRoom}
          onClose={() => setRoomOpen(false)} />
      )}
      {partyOpen && room.connected && (
        <PartyModal
          myId={netRef.current ? netRef.current.myId : null}
          party={party} roster={roster} saveLevel={saveUI.level}
          allyOk={!allQuestsDone(saveUI)}
          contentSel={contentSel} setContentSel={setContentSel}
          onInvite={inviteToParty} onLeave={leaveParty} onReady={toggleReady} onStart={startParty}
          onTrade={requestTrade} onDuel={requestDuel}
          onClose={() => setPartyOpen(false)} />
      )}
      {pInvite && (
        <ConfirmPopup icon="📨" title="파티 초대"
          desc={<><b className="text-indigo-300">{pInvite.nick}</b>님이 파티에 초대했습니다</>}
          hint={`수락하면 ${pInvite.nick}님이 파티장이 됩니다`}
          accentFrom="from-indigo-500" accentTo="to-violet-500"
          onAccept={acceptInvite} onDecline={declineInvite} />
      )}
      {tradeReq && !trade && (
        <ConfirmPopup icon="💱" title="거래 신청"
          desc={<><b className="text-amber-300">{tradeReq.nick}</b>님이 거래를 신청했습니다</>}
          hint="골드와 아이템을 서로 맞바꿀 수 있습니다"
          accentFrom="from-amber-500" accentTo="to-orange-500"
          onAccept={acceptTrade}
          onDecline={() => { const r = tradeReq; setTradeReq(null); if (r) netRef.current?.room.send({ t: 'trCancel', to: r.from }) }} />
      )}
      {duelReq && (
        <ConfirmPopup icon="⚔" title="결투 신청"
          desc={<><b className="text-rose-300">{duelReq.nick}</b>님이 결투를 신청했습니다</>}
          hint="수락하면 둘만의 투기장에서 겨룹니다"
          accentFrom="from-rose-500" accentTo="to-red-500"
          onAccept={acceptDuel}
          onDecline={() => { const r = duelReq; setDuelReq(null); if (r) netRef.current?.room.send({ t: 'dlDec', to: r.from, nick: account.nick }) }} />
      )}
      {sqModal && SQ_BY_ID[sqModal] && (
        <SideQuestModal quest={SQ_BY_ID[sqModal]} save={saveUI}
          onAccept={acceptSq} onTurnIn={turnInSq} onClose={() => setSqModal(null)} />
      )}
      {adminOpen && saveUI.admin && (
        <AdminPanel save={saveUI} players={allPlayers} spectate={spectate}
          onAct={adminAct} onSpectate={setSpectate} onClose={() => setAdminOpen(false)} />
      )}
      {trade && (
        <TradeModal trade={trade} bag={saveUI.bag} myGold={saveUI.gold}
          onGold={setTradeGold} onToggleItem={toggleTradeItem}
          onLock={lockTrade} onConfirm={confirmTrade} onCancel={cancelTrade} />
      )}
      {mathModal && <MathModal problem={mathModal} circle={saveUI.circle} onSubmit={submitMath} onCancel={() => setMathModal(null)} />}
      {death && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-[20rem] rounded-3xl border border-red-500/30 bg-slate-900 p-7 text-center shadow-2xl [animation:pop_.4s_cubic-bezier(.2,1.6,.4,1)]">
            <div className="text-6xl">💀</div>
            <div className="mt-3 text-2xl font-black text-red-400">{death.arena ? '결투에서 패배' : '쓰러졌습니다'}</div>
            {death.inst ? (
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                <b className="text-pink-300">힐러의 부활</b>을 기다리거나<br />
                다음 웨이브가 시작되면 다시 일어납니다.
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-300">
                골드의 10% <b className="text-amber-300">🪙 {death.lost.toLocaleString()}</b> 를 잃었습니다.
              </p>
            )}
            {death.inst ? (
              <button onClick={() => exitInstance('인스턴스에서 나왔습니다')} data-ui
                className="mt-5 w-full rounded-xl border border-white/15 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/5">
                포기하고 나가기
              </button>
            ) : (
              <button onClick={revive} data-ui
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-slate-200 to-white py-3 font-black text-slate-900 transition hover:brightness-105">
                {death.arena ? '필드로 귀환' : '다시 일어나기'}
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes pop { from { transform: scale(1.8) } to { transform: scale(1) } }`}</style>
    </div>
  )
}
function ItemChip({ item, onClick, compact, disabled }) {
  if (!item) return null
  const g = gradeOf(item.grade)
  /* 등급별 시세를 알려줘 거래할 때 값을 가늠할 수 있게 한다 */
  const [lo, hi] = g.price
  const mul = item.kind === 'artifact' ? 2.5 : item.kind === 'rune' ? 1.6 : 1
  const market = `시세 ${Math.round(lo * mul).toLocaleString()}~${Math.round(hi * mul).toLocaleString()} G`
  return (
    <button onClick={onClick} disabled={disabled}
      title={`[${g.name}] ${item.name}\n${itemStatLine(item)}\n${market}`}
      className={`w-full rounded-lg border px-2 py-1.5 text-left transition ${disabled ? 'opacity-50' : 'hover:brightness-125'}`}
      style={{ borderColor: g.color + '66', background: g.color + '14' }}>
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[11px] font-bold" style={{ color: g.color }}>{item.name}</span>
        {!compact && <span className="shrink-0 text-[9px] text-slate-400">{g.name}</span>}
      </div>
      <div className="truncate text-[10px] text-slate-300">{itemStatLine(item)}</div>
      {!compact && <div className="truncate text-[9px] text-amber-300/70">🪙 {market}</div>}
    </button>
  )
}

function EmptySlot({ label, icon, onClick }) {
  return (
    <div onClick={onClick}
      className="flex h-[42px] items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/20 text-[10px] text-slate-500">
      {icon} {label}
    </div>
  )
}

/* ==================================================================
   인벤토리 — 장비창 · 룬 10슬롯 · 아티팩트 · 가방
   ================================================================== */
function InventoryModal({ save, cls, stats, onEquip, onUnequip, onSell, onClose }) {
  const [tab, setTab] = useState('all')
  const [runeTarget, setRuneTarget] = useState(null)   // 룬 장착 대상 슬롯
  const eq = save.equip
  const bag = save.bag

  const filtered = bag.filter((it) => tab === 'all' || it.kind === tab)
  const canEquipWeapon = (it) => WEAPON_TYPES[it.wtype].classes.includes(cls.id)

  return (
    <div data-ui className="absolute inset-0 z-[55] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-3xl border border-white/12 bg-slate-900/96 p-5 shadow-2xl [animation:pop_.25s_cubic-bezier(.2,1.5,.4,1)]">
        <button onClick={onClose} className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">✕</button>
        <div className="mb-3 pr-8">
          <div className="text-lg font-black text-white">🎒 인벤토리 · 장비</div>
          <div className="text-[11px] text-slate-400">아이템을 눌러 장착 · 장착된 아이템을 눌러 해제</div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-[1fr_1fr_1fr]">
          {/* ── 장비 ── */}
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/8 bg-slate-800/40 p-3">
              <div className="mb-2 text-xs font-bold text-slate-300">⚔ 무기</div>
              {eq.weapon
                ? <ItemChip item={eq.weapon} onClick={() => onUnequip('weapon')} />
                : <EmptySlot icon="⚔" label={`${WEAPON_TYPES[cls.weapon].name} (기본)`} />}
              <div className="mt-1 text-[10px] text-slate-500">
                {WEAPON_TYPES[cls.weapon].hands === 2 ? '두 손 무기' : '한 손 무기'} · {cls.name} 전용
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-slate-800/40 p-3">
              <div className="mb-2 text-xs font-bold text-slate-300">🛡 방어구</div>
              <div className="space-y-1.5">
                {ARMOR_SLOTS.map((s) => (
                  <div key={s.key}>
                    {eq[s.key]
                      ? <ItemChip item={eq[s.key]} onClick={() => onUnequip(s.key)} />
                      : <EmptySlot icon={s.icon} label={`${s.name} (${s.desc})`} />}
                  </div>
                ))}
              </div>
              {stats.setBonuses && stats.setBonuses.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-white/8 pt-2">
                  {stats.setBonuses.map((b, i) => (
                    <div key={i} className="text-[10px] font-bold" style={{ color: ARMOR_SETS[b.key].color }}>
                      ✦ {ARMOR_SETS[b.key].name} {b.tier}세트 — {b.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-3">
              <div className="mb-2 text-xs font-bold text-amber-300">✨ 아티팩트 (1슬롯)</div>
              {eq.artifact
                ? <ItemChip item={eq.artifact} onClick={() => onUnequip('artifact')} />
                : <EmptySlot icon="✨" label="아티팩트 없음" />}
            </div>
          </div>

          {/* ── 룬 10슬롯 ── */}
          <div className="rounded-2xl border border-white/8 bg-slate-800/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">🔮 룬 슬롯</span>
              <span className="text-[10px] text-slate-500">{eq.runes.filter(Boolean).length} / {RUNE_SLOTS}</span>
            </div>
            <div className="space-y-1.5">
              {eq.runes.map((r, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-4 shrink-0 text-[10px] text-slate-500">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    {r ? <ItemChip item={r} compact onClick={() => onUnequip('rune', i)} />
                      : (
                        <div onClick={() => setRuneTarget(runeTarget === i ? null : i)}
                          className={`flex h-[42px] cursor-pointer items-center justify-center rounded-lg border border-dashed text-[10px] transition ${
                            runeTarget === i ? 'border-violet-400 bg-violet-500/15 text-violet-200' : 'border-white/15 bg-black/20 text-slate-500'
                          }`}>
                          {runeTarget === i ? '가방에서 룬 선택' : '빈 슬롯'}
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 border-t border-white/8 pt-2 text-[10px] leading-relaxed text-slate-400">
              룬은 몬스터 처치 시 <b className="text-violet-300">0.3%</b> 확률로 드랍되거나 퀘스트 보상으로 얻습니다.
            </div>
          </div>

          {/* ── 가방 ── */}
          <div className="rounded-2xl border border-white/8 bg-slate-800/40 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-1">
              {[['all', '전체'], ['weapon', '무기'], ['armor', '방어구'], ['rune', '룬'], ['artifact', '아티팩트']].map(([k, n]) => (
                <button key={k} onClick={() => setTab(k)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${tab === k ? 'bg-white/20 text-white' : 'bg-black/25 text-slate-400 hover:text-white'}`}>
                  {n}
                </button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-[11px] text-slate-500">비어 있습니다<br />몬스터를 사냥하거나 퀘스트를 완료하세요</div>
            ) : (
              <div className="max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
                {filtered.map((it) => {
                  const blocked = it.kind === 'weapon' && !canEquipWeapon(it)
                  return (
                    <div key={it.uid} className="rounded-lg border border-white/8 bg-black/20 p-1.5">
                      <ItemChip item={it} onClick={() => onEquip(it, it.kind === 'rune' ? runeTarget : null)} />
                      <div className="mt-1 flex items-center gap-1">
                        <button onClick={() => onEquip(it, it.kind === 'rune' ? runeTarget : null)}
                          className={`flex-1 rounded px-2 py-1 text-[10px] font-bold transition ${
                            blocked ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                          }`}>
                          {blocked ? '직업 제한' : '장착'}
                        </button>
                        <button onClick={() => onSell(it)}
                          className="rounded bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-300 transition hover:bg-amber-500/25">
                          판매
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 종합 스탯 */}
        <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-white/8 pt-3 text-[10px] sm:grid-cols-6">
          {[
            ['공격력', stats.atk], ['최대 체력', stats.maxHp], ['치명타', stats.critRate.toFixed(0) + '%'],
            ['치명 피해', stats.critDmg.toFixed(0) + '%'], ['방어력', stats.defense.toFixed(0)], ['피해감소', stats.dmgReduce.toFixed(0) + '%'],
            ['이동속도', '+' + stats.moveSpd.toFixed(0) + '%'], ['회피', stats.dodge.toFixed(0) + '%'], ['재생', stats.regen.toFixed(1) + '/s'],
            ['골드', '+' + stats.goldGain.toFixed(0) + '%'], ['경험치', '+' + stats.expGain.toFixed(0) + '%'], ['흡혈', stats.lifesteal.toFixed(0) + '%'],
          ].map(([n, v]) => (
            <div key={n} className="rounded bg-black/25 px-2 py-1 text-center">
              <div className="text-slate-500">{n}</div><div className="font-bold text-white">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ==================================================================
   스킬트리
   ================================================================== */

/* ==================================================================
   스킬트리 — 전직할수록 확장 (7단계 · 상한 증가)
   ================================================================== */

/* ==================================================================
   스킬트리 — 전직 단계(티어)를 한 줄씩 쌓은 표

   방사형 거미줄은 노드가 20개를 넘어가면서 서로 겹쳐 알아보기 힘들었다.
   지금은 티어를 위에서 아래로 한 줄씩 놓고, 각 줄에 그 단계에서 열리는
   스킬 카드와 특성 칩을 나란히 둔다. 어떤 단계에 무엇이 열리는지가
   한눈에 들어오고, 화면이 좁아도 자연스럽게 접힌다.
   ================================================================== */
function SkillTreeModal({ save, cls, stats, onInvest, onClose }) {
  const list = useMemo(() => SKILLS[cls.id] || [], [cls.id])
  const [sel, setSel] = useState(list[0] ? list[0].id : null)

  /* 티어별로 스킬과 특성을 묶는다 */
  const tiers = useMemo(() => Array.from({ length: MAX_TIER + 1 }, (_, t) => ({
    tier: t,
    skills: list.filter((s) => s.tier === t),
    stats: t === 0 ? [] : WEB_STATS[t - 1].map((st) => ({
      id: webStatId(cls.id, t, st.k), stat: st, tier: t,
    })),
  })), [list, cls.id])

  const selSkill = list.find((s) => s.id === sel)
  const selStat = !selSkill
    ? tiers.flatMap((r) => r.stats).find((n) => n.id === sel)
    : null
  const node = selSkill || selStat
  const nodeTier = node ? node.tier : 0
  const lv = node ? (save.skills[node.id] || 0) : 0
  const max = selSkill ? skillMaxLv(selSkill, save.tier) : WEB_STAT_MAX
  const tierOk = save.tier >= nodeTier
  const canInvest = tierOk && save.sp > 0 && lv < max

  const kindIcon = (k) => k === 'buff' ? '🕊️' : k === 'heal' ? '💗' : k === 'debuff' ? '🌒'
    : k === 'awaken' ? '🌟' : k === 'dash' ? '💨' : '⚔'
  const kindLabel = (k) => k === 'buff' ? '아군 버프' : k === 'heal' ? '아군 회복' : k === 'debuff' ? '적 디버프'
    : k === 'awaken' ? '각성' : k === 'dash' ? '돌진 공격' : '공격'
  const slotKey = (n) => (n === 10 ? '0' : n === 11 ? '-' : String(n))

  return (
    <div data-ui className="absolute inset-0 z-[55] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[94vh] w-full max-w-4xl flex-col rounded-3xl border border-white/12 bg-slate-900 p-5 shadow-2xl [animation:pop_.25s_cubic-bezier(.2,1.5,.4,1)]">
        <button onClick={onClose} className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">✕</button>

        <div className="mb-3 flex items-center justify-between pr-8">
          <div>
            <div className="text-lg font-black text-white">🕸 {cls.name} 스킬트리</div>
            <div className="text-[11px] text-slate-400">
              현재 <b style={{ color: cls.color }}>[{JOB_TIERS[save.tier].name}] {JOB_TIERS[save.tier].title}</b>
              {save.tier < MAX_TIER
                ? <> · 다음 <b className="text-amber-300">{JOB_TIERS[save.tier + 1].title}</b>(Lv.{JOB_TIERS[save.tier + 1].reqLv})에서 새 단계 해금</>
                : <> · <b className="text-fuchsia-300">모든 단계 해금 완료</b></>}
            </div>
          </div>
          <div className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm font-black text-emerald-300">SP {save.sp}</div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden sm:grid-cols-[1fr_15rem]">
          {/* 티어별 목록 */}
          <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
            {tiers.map((row) => {
              const open = save.tier >= row.tier
              return (
                <div key={row.tier}
                  className={`rounded-2xl border p-3 transition ${open ? 'border-white/12 bg-white/[0.04]' : 'border-white/6 bg-black/20'}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${open ? 'bg-indigo-500/25 text-indigo-200' : 'bg-white/5 text-slate-600'}`}>
                      {row.tier === 0 ? '기본' : JOB_TIERS[row.tier].title}
                    </span>
                    <span className={`text-[10px] ${open ? 'text-slate-400' : 'text-slate-600'}`}>
                      {open ? `스킬 ${row.skills.length}개` : `Lv.${JOB_TIERS[row.tier].reqLv} 전직 시 해금`}
                    </span>
                    {!open && <span className="ml-auto text-xs">🔒</span>}
                  </div>

                  {/* 스킬 카드 */}
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {row.skills.map((sk) => {
                      const l = save.skills[sk.id] || 0
                      const m = skillMaxLv(sk, save.tier)
                      const done = l >= m && m > 0
                      const on = sel === sk.id
                      return (
                        <button key={sk.id} onClick={() => setSel(sk.id)}
                          className={`rounded-xl border px-2 py-1.5 text-left transition ${on ? 'ring-2' : ''} ${
                            !open ? 'border-white/8 bg-black/25 opacity-50'
                            : done ? 'border-amber-400/50 bg-amber-500/12'
                            : l > 0 ? 'border-emerald-400/45 bg-emerald-500/10'
                            : 'border-white/12 bg-black/25 hover:bg-white/8'}`}
                          style={on ? { boxShadow: `0 0 0 2px ${cls.color}88` } : undefined}>
                          <div className="flex items-center gap-1">
                            <span className="text-[13px]">{open ? kindIcon(sk.kind) : '🔒'}</span>
                            <span className="truncate text-[11px] font-bold text-white">{sk.name}</span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between text-[9px]">
                            <span className="rounded bg-black/40 px-1 text-slate-400">{slotKey(sk.slot)}</span>
                            <span className={done ? 'font-bold text-amber-300' : l > 0 ? 'font-bold text-emerald-300' : 'text-slate-500'}>
                              {open ? `${l} / ${m}` : '—'}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* 특성 칩 */}
                  {row.stats.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {row.stats.map((n) => {
                        const l = save.skills[n.id] || 0
                        const done = l >= WEB_STAT_MAX
                        const on = sel === n.id
                        return (
                          <button key={n.id} onClick={() => setSel(n.id)}
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${on ? 'ring-2 ring-white/40' : ''} ${
                              !open ? 'border-white/8 bg-black/25 text-slate-600 opacity-50'
                              : done ? 'border-amber-400/50 bg-amber-500/12 text-amber-200'
                              : l > 0 ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                              : 'border-white/12 bg-black/25 text-slate-300 hover:bg-white/8'}`}>
                            ✦ {n.stat.name} <span className="opacity-70">{open ? `${l}/${WEB_STAT_MAX}` : '🔒'}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* 상세 */}
          <div className="flex h-fit flex-col rounded-2xl border border-white/8 bg-slate-800/50 p-4">
            {node ? (
              <>
                <div className="text-base font-black text-white">
                  {tierOk ? (selSkill ? selSkill.name : selStat.stat.name) : '잠긴 항목'}
                </div>
                <div className="mt-0.5 text-[11px]" style={{ color: cls.color }}>
                  {nodeTier === 0 ? '기본' : JOB_TIERS[nodeTier].title}
                  {' · '}
                  {selSkill ? `${kindLabel(selSkill.kind)} [${slotKey(selSkill.slot)}]` : '특성'}
                </div>

                <div className="mt-3 rounded-lg bg-black/30 px-3 py-2 text-xs leading-relaxed text-slate-300">
                  {!tierOk ? `${JOB_TIERS[nodeTier].title}(Lv.${JOB_TIERS[nodeTier].reqLv}) 이후 해금됩니다.`
                    : selSkill ? selSkill.desc
                    : `${selStat.stat.name} — 레벨당 ${selStat.stat.stat} +${selStat.stat.per}${selStat.stat.unit}`}
                </div>

                {tierOk && (
                  <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                    <div>레벨 <b className="text-white">{lv} / {max}</b></div>
                    {selSkill && (selSkill.kind === 'dmg' || selSkill.kind === 'dash') && (
                      <>
                        <div>피해 배율 <b className="text-white">×{(selSkill.dmgMul + selSkill.dmgPer * Math.max(0, lv - 1)).toFixed(2)}</b></div>
                        <div>범위 <b className="text-white">{(selSkill.range * (1 + stats.skillRange)).toFixed(1)}</b> · 쿨 <b className="text-white">{selSkill.cd}s</b></div>
                        {selSkill.kind === 'dash' && <div className="text-sky-300">💨 시전 시 전방으로 돌진</div>}
                      </>
                    )}
                    {selSkill && selSkill.kind === 'buff' && (
                      <div className="text-amber-200">🕊️ 주변 아군 · 범위 {selSkill.aoe}m · 지속 {selSkill.dur}초 · 쿨 {selSkill.cd}s</div>
                    )}
                    {selSkill && selSkill.kind === 'debuff' && (
                      <div className="text-violet-300">🌒 주변 적 · 범위 {selSkill.aoe}m · 지속 {selSkill.dur}초 · 쿨 {selSkill.cd}s</div>
                    )}
                    {selSkill && selSkill.kind === 'heal' && (
                      <div className="text-pink-300">💗 주변 아군 · 범위 {selSkill.aoe}m · 쿨 {selSkill.cd}s{selSkill.revive ? ' · 부활' : ''}</div>
                    )}
                    {selSkill && selSkill.kind === 'awaken' && (
                      <div className="text-amber-300">🌟 {selSkill.dur}초 동안 전능력 강화 · 쿨 {selSkill.cd}s</div>
                    )}
                    {selStat && (
                      <div>현재 보너스 <b className="text-white">+{(selStat.stat.per * lv).toFixed(1)}{selStat.stat.unit}</b></div>
                    )}
                  </div>
                )}

                <button onClick={() => onInvest(node.id)} disabled={!canInvest}
                  className={`mt-4 w-full rounded-xl py-2.5 text-sm font-bold transition ${
                    canInvest ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:brightness-110'
                      : 'cursor-not-allowed bg-slate-700/50 text-slate-500'}`}>
                  {!tierOk ? '🔒 전직 필요' : lv >= max ? '✓ 최대 레벨' : save.sp < 1 ? 'SP 부족' : `SP 1 투자 (Lv.${lv} → ${lv + 1})`}
                </button>
              </>
            ) : (
              <div className="text-sm text-slate-500">항목을 선택하세요</div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-white/8 pt-3 text-[11px]">
              <div className="text-slate-400">공격력 <b className="text-white">{stats.atk.toFixed(2)}</b></div>
              <div className="text-slate-400">최대 HP <b className="text-white">{stats.maxHp}</b></div>
              <div className="text-slate-400">치명타 <b className="text-white">{stats.critRate.toFixed(0)}%</b></div>
              <div className="text-slate-400">방어력 <b className="text-white">{stats.defense.toFixed(0)}</b></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
function NpcModal({ npc, save, cls, nick, onAbandonClass, onPickNewClass, onBecomeHidden,
  onStartTutorial, onTurnInQuest, onBuy,
  onAdvanceGold, onAcceptJobQuest, onCompleteJobQuest, onTrainSp, onClose }) {
  const isMobile = useIsMobile()
  const next = canAdvance(save)
  const jq = save.jobQuest[npc.id]
  const questNeed = next ? jobQuestNeed(next.tier) : 0
  const questCur = jq && jq.state === 'active' ? Math.min(questNeed, save.kills - jq.base) : 0
  /* 전직 시험은 던전 클리어도 요구한다 (난이도 상향) */
  const dgNeed = next ? jobQuestDungeons(next.tier) : 0
  const dgCur = jq && jq.state === 'active'
    ? Math.min(dgNeed, (save.dungeonClears || 0) + (save.raidClears || 0) - (jq.dgBase || 0)) : 0
  const questOk = questCur >= questNeed && dgCur >= dgNeed

  return (
    <div data-ui className="absolute inset-0 z-[55] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl border border-white/12 bg-slate-900/96 p-6 shadow-2xl [animation:pop_.25s_cubic-bezier(.2,1.5,.4,1)]">
        <button onClick={onClose} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">✕</button>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full text-2xl" style={{ background: npc.color + '33' }}>{npc.icon}</div>
          <div>
            <div className="text-lg font-black text-white">{npc.name}</div>
            <div className="text-[11px]" style={{ color: npc.color }}>{npc.region}</div>
          </div>
        </div>

        {/* 이 NPC에게서 받을 수 있는 히든 직업
           요정술사는 마법사 전직관, 초초보자는 아무 전직관에서나 받는다 */}
        {(npc.role === 'job' || npc.role === 'changer') && HIDDEN_CLASSES.filter((h) => {
          if (!hiddenUnlockable(save, cls.id, h.id)) return false
          if (h.id === 'fairymancer') return npc.role === 'job' && npc.cls === 'mage'
          if (h.id === 'novice') return true
          return false
        }).map((h) => (
          <button key={h.id} onClick={() => onBecomeHidden(h.id)}
            className="mt-4 w-full rounded-xl border-2 border-amber-400/60 bg-gradient-to-r from-amber-500/20 to-fuchsia-500/20 p-3 text-left transition hover:brightness-125">
            <div className="text-sm font-black text-amber-200">🌟 히든 직업 해금! {h.icon} {h.name}</div>
            <div className="mt-0.5 text-[10px] text-slate-300">{h.note}</div>
            <div className="mt-1 text-[11px] font-bold text-amber-300">눌러서 전직하기 →</div>
          </button>
        ))}

        {/* ── 마을 이장 (메인 퀘스트) ── */}
        {npc.role === 'chief' && (() => {
          const q = currentQuest(save)
          const ready = q && q.done(save)
          const step = (save.mq || 0) + 1
          return (
            <>
              {/* 진행 표시 — 총 5단계 중 어디쯤인지 */}
              <div className="mt-4 flex items-center gap-1.5">
                {MAIN_QUESTS.map((mq, i) => (
                  <div key={mq.id} className="flex-1 text-center">
                    <div className={`h-1.5 rounded-full ${i < (save.mq || 0) ? 'bg-emerald-400' : i === (save.mq || 0) ? 'bg-amber-400' : 'bg-white/15'}`} />
                    <div className={`mt-1 text-[9px] ${i < (save.mq || 0) ? 'text-emerald-300' : i === (save.mq || 0) ? 'text-amber-300' : 'text-slate-600'}`}>
                      {mq.icon}
                    </div>
                  </div>
                ))}
              </div>

              {q ? (
                <>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-300">
                      메인 {step} / {MQ_COUNT}
                    </span>
                    <span className="text-sm font-black text-white">{q.icon} {q.title}</span>
                  </div>

                  <p className="mt-2 rounded-xl bg-black/30 p-3 text-sm leading-relaxed text-slate-200">
                    {ready
                      ? `“${q.turnIn}”`
                      : (save.mq === 0 && save.tutorial === 'none'
                        ? <>“{nick} 환영한다네! 먼저 움직이는 법(<b className="text-amber-300">{isMobile ? '왼쪽 조이스틱' : 'W, A, S, D'}</b>)과 시점 돌리는 법(<b className="text-amber-300">{isMobile ? '빈 화면 드래그' : '우클릭 드래그'}</b>)을 익혀보게. {q.give}”</>
                        : `“${q.give}”`)}
                  </p>

                  {!ready && (
                    <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300">📌 {q.hint}</span>
                        <b className="text-amber-300">{q.progress(save)}</b>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="text-slate-500">보상</span>
                    {q.reward.gold && <span className="rounded bg-black/30 px-2 py-0.5 text-amber-300">🪙 {q.reward.gold}</span>}
                    {q.reward.sp && <span className="rounded bg-black/30 px-2 py-0.5 text-emerald-300">SP +{q.reward.sp}</span>}
                    {q.reward.exp && <span className="rounded bg-black/30 px-2 py-0.5 text-violet-300">EXP {q.reward.exp}</span>}
                  </div>

                  {save.mq === 0 && save.tutorial === 'none' ? (
                    <button onClick={onStartTutorial}
                      className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 font-bold text-white transition hover:brightness-110">
                      📜 알겠습니다, 다녀오겠습니다
                    </button>
                  ) : ready ? (
                    <button onClick={onTurnInQuest}
                      className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 font-black text-white transition hover:brightness-110">
                      🎉 보고하고 보상 받기
                    </button>
                  ) : (
                    <button onClick={onClose}
                      className="mt-4 w-full rounded-xl border border-white/15 py-3 font-bold text-slate-200 transition hover:bg-white/5">
                      다녀오겠습니다
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-3 rounded-xl bg-black/30 p-3 text-sm leading-relaxed text-slate-200">
                    “자네는 이제 어엿한 모험가일세. <b className="text-amber-300">전직관</b>을 찾아가 1차 전직을 하게 —
                    10레벨마다 새로운 힘이 열릴 걸세!”
                  </p>
                  <div className="mt-3 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
                    ✓ 메인 퀘스트 {MQ_COUNT}단계를 모두 마쳤습니다
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] text-slate-400">
                    {NPCS.filter((n) => n.role === 'job').map((n) => (
                      <div key={n.id} className={n.cls === cls.id ? 'font-bold text-amber-300' : ''}>
                        {n.icon} {n.region} — {CLASS_BY_ID[n.cls].name}
                      </div>
                    ))}
                  </div>
                  <button onClick={onClose} className="mt-4 w-full rounded-xl border border-white/15 py-3 font-bold text-slate-200 transition hover:bg-white/5">고맙습니다</button>
                </>
              )}
            </>
          )
        })()}

        {/* ── 직업 변경관 ── */}
        {npc.role === 'changer' && (
          <>
            <p className="mt-4 rounded-xl bg-black/30 p-3 text-sm leading-relaxed text-slate-200">
              “<b className="text-cyan-300">{nick}</b>, 길을 바꾸려면 지금의 길을 <b className="text-rose-300">완전히 버려야</b> 하네.
              쌓아온 것을 전부 내려놓을 각오가 있는가?”
            </p>
            <div className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[11px] leading-relaxed text-rose-200">
              ⚠ 직업을 포기하면 <b>모든 스킬과 스킬 포인트(SP)를 잃습니다</b>.<br />
              전직 단계도 <b>0차로 초기화</b>되어 처음부터 다시 올라가야 합니다.<br />
              레벨·골드·아이템은 유지되고, 닉네임은 영구 고정입니다.
            </div>

            {!save.abandoned ? (
              <>
                <div className="mt-3 rounded-xl bg-black/30 p-3 text-[12px] text-slate-300">
                  현재 <b style={{ color: cls.color }}>{cls.icon} {cls.name}</b>
                  <span className="ml-1 text-slate-500">
                    · {JOB_TIERS[save.tier].title} · SP {save.sp} · 배운 스킬 {Object.values(save.skills || {}).filter((v) => v > 0).length}개
                  </span>
                </div>
                <button onClick={onAbandonClass}
                  className="mt-3 w-full rounded-xl bg-gradient-to-r from-rose-600 to-red-600 py-3 font-black text-white transition hover:brightness-110">
                  💔 직업 포기 (스킬·SP 전부 상실)
                </button>
                <div className="mt-1.5 text-center text-[10px] text-slate-500">
                  포기한 뒤에 새 직업을 고를 수 있습니다
                </div>
              </>
            ) : (
              <>
                <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
                  ✓ 직업을 포기한 상태입니다 — 새로 걸을 길을 고르세요
                </div>
                <div className="mt-3 grid max-h-[42vh] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {CLASSES.map((c) => (
                    <button key={c.id} onClick={() => onPickNewClass(c.id)}
                      className="rounded-xl border p-3 text-left transition hover:brightness-125"
                      style={{ borderColor: c.color + '44', background: c.color + '10' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{c.icon}</span>
                        <span className="text-sm font-bold" style={{ color: c.color }}>{c.name}</span>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">{c.role} · {WEAPON_TYPES[c.weapon].name}</div>
                      <div className="mt-1 text-[10px] leading-snug text-slate-300">{c.growHint}</div>
                    </button>
                  ))}
                </div>
              </>
            )}

          </>
        )}

        {/* ── 상인 ── */}
        {npc.role === 'merchant' && (
          <>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">“좋은 물건만 취급하지. 골드만 있다면 뭐든 팔겠네!”</p>
            <div className="mt-1 text-right text-sm font-black text-amber-300">보유 🪙 {save.gold.toLocaleString()}</div>
            <div className="mt-3 max-h-[46vh] space-y-2 overflow-y-auto pr-1">
              {SHOP_STOCK.map((it) => (
                <div key={it.key} className="flex items-center gap-3 rounded-xl border border-white/8 bg-slate-800/50 p-3">
                  <div className="text-2xl">{it.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-white">{it.name}</div>
                    <div className="text-[11px] text-slate-400">{it.desc}</div>
                  </div>
                  <button onClick={() => onBuy(it)} disabled={save.gold < it.price}
                    className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition ${
                      save.gold >= it.price ? 'bg-amber-500/25 text-amber-200 hover:bg-amber-500/40' : 'cursor-not-allowed bg-slate-700/50 text-slate-500'
                    }`}>
                    🪙 {it.price.toLocaleString()}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── 전직관 ── */}
        {npc.role === 'job' && (
          <>
            {npc.cls !== cls.id ? (
              <>
                <p className="mt-4 rounded-xl bg-black/30 p-3 text-sm leading-relaxed text-slate-200">
                  “여기는 <b style={{ color: npc.color }}>{CLASS_BY_ID[npc.cls].name}</b>의 전당일세.
                  자네는 <b style={{ color: cls.color }}>{cls.name}</b>이지 않은가 — 자네의 전직관을 찾아가게.”
                </p>
                <div className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                  ➜ {cls.name}의 전직관: <b>{jobMasterFor(cls.id)?.name}</b> ({jobMasterFor(cls.id)?.region})
                </div>
                <button onClick={onClose} className="mt-4 w-full rounded-xl border border-white/15 py-3 font-bold text-slate-200 transition hover:bg-white/5">돌아가기</button>
              </>
            ) : (
              <>
                <div className="mt-3 rounded-xl bg-black/30 p-3 text-[11px] leading-relaxed text-slate-300">
                  현재 <b style={{ color: cls.color }}>[{JOB_TIERS[save.tier].name}] {JOB_TIERS[save.tier].title}</b>
                  {save.tier < MAX_TIER
                    ? <> · 다음 단계 <b className="text-amber-300">{JOB_TIERS[save.tier + 1].title}</b> (Lv.{JOB_TIERS[save.tier + 1].reqLv})</>
                    : <> · <b className="text-fuchsia-300">최종 단계 도달</b></>}
                </div>

                {save.tier >= MAX_TIER ? (
                  <p className="mt-3 text-sm leading-relaxed text-slate-200">“자네는 이미 초월의 경지에 올랐네. 더 가르칠 것이 없구먼.”</p>
                ) : !next ? (
                  <p className="mt-3 rounded-xl bg-black/30 p-3 text-sm leading-relaxed text-slate-200">
                    “아직 이르네. <b className="text-amber-300">Lv.{JOB_TIERS[save.tier + 1].reqLv}</b>이 되면 다시 오게.”
                  </p>
                ) : (
                  <>
                    <p className="mt-3 rounded-xl bg-black/30 p-3 text-sm leading-relaxed text-slate-200">
                      “준비가 되었군. <b className="text-amber-300">{next.title}</b>을 치르면 <b className="text-violet-300">{next.unlock}</b>.
                      골드를 내거나, 시험을 치르게.”
                    </p>
                    <button onClick={onAdvanceGold} disabled={save.gold < next.cost}
                      className={`mt-3 w-full rounded-xl py-3 font-bold transition ${
                        save.gold >= next.cost ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:brightness-110' : 'cursor-not-allowed bg-slate-700/50 text-slate-500'
                      }`}>
                      🪙 골드로 전직 ({next.cost.toLocaleString()} G)
                    </button>
                    {(!jq || jq.state !== 'active') ? (
                      <button onClick={() => onAcceptJobQuest(npc)}
                        className="mt-2 w-full rounded-xl border border-white/15 py-3 font-bold text-slate-200 transition hover:bg-white/5">
                        ⚔ 시험 받기 (몬스터 {questNeed}마리 · 던전 {dgNeed}회)
                      </button>
                    ) : (
                      <>
                        <div className="mt-3 space-y-2 rounded-xl bg-black/30 p-3">
                          <div>
                            <div className="text-[11px] text-slate-400">전직 시험 ① 몬스터 처치</div>
                            <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/50">
                              <div className="h-full bg-emerald-400" style={{ width: `${(questCur / questNeed) * 100}%` }} />
                            </div>
                            <div className="mt-1 text-right text-[11px] font-bold text-white">{questCur} / {questNeed}</div>
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-400">전직 시험 ② 던전·레이드 클리어</div>
                            <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/50">
                              <div className="h-full bg-sky-400" style={{ width: `${(dgCur / dgNeed) * 100}%` }} />
                            </div>
                            <div className="mt-1 text-right text-[11px] font-bold text-white">{dgCur} / {dgNeed}</div>
                          </div>
                        </div>
                        <button onClick={() => onCompleteJobQuest(npc)} disabled={!questOk}
                          className={`mt-2 w-full rounded-xl py-3 font-bold transition ${
                            questOk ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:brightness-110' : 'cursor-not-allowed bg-slate-700/50 text-slate-500'
                          }`}>
                          {questOk ? '⭐ 시험 통과 — 전직하기' : '아직 부족합니다'}
                        </button>
                      </>
                    )}
                  </>
                )}

                {/* 추가 수련 (레벨에 맞는 추가 스킬 습득용 SP) */}
                <div className="mt-4 border-t border-white/10 pt-3">
                  <div className="text-[11px] text-slate-400">“더 배우고 싶다면 수련비를 내게. 깨달음을 나눠주지.”</div>
                  <button onClick={onTrainSp} disabled={save.gold < 1500 + save.tier * 1200}
                    className={`mt-2 w-full rounded-xl py-2.5 text-sm font-bold transition ${
                      save.gold >= 1500 + save.tier * 1200 ? 'bg-violet-500/25 text-violet-200 hover:bg-violet-500/40' : 'cursor-not-allowed bg-slate-700/50 text-slate-500'
                    }`}>
                    📘 추가 수련 — SP +1 ({(1500 + save.tier * 1200).toLocaleString()} G)
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
/* ==================================================================
   거래창 — 양쪽이 제시하고, 둘 다 잠근 뒤 둘 다 확정해야 성립한다
   ================================================================== */
function TradeModal({ trade, bag, myGold, onGold, onToggleItem, onLock, onConfirm, onCancel }) {
  const chosen = (uid) => trade.myItems.some((x) => x.uid === uid)
  return (
    <div data-ui className="absolute inset-0 z-[68] flex items-center justify-center bg-black/78 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-y-auto rounded-3xl border border-amber-400/30 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="text-lg font-black text-white">💱 <b className="text-amber-300">{trade.nick}</b>님과 거래</div>
          <button onClick={() => onCancel(false)} className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/10 hover:text-white">✕</button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* 내가 내놓을 것 */}
          <div className={`rounded-2xl border p-3 ${trade.myLock ? 'border-emerald-400/50 bg-emerald-500/8' : 'border-white/12 bg-white/5'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">내가 줄 것</span>
              {trade.myLock && <span className="text-[10px] font-bold text-emerald-300">🔒 잠금</span>}
            </div>
            <label className="mt-2 block text-[11px] text-slate-400">골드 (보유 {myGold.toLocaleString()})</label>
            <input type="number" min={0} max={myGold} value={trade.myGold} disabled={trade.myLock}
              onChange={(e) => onGold(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-amber-400 disabled:opacity-50" />
            <div className="mt-2 text-[11px] text-slate-400">아이템 {trade.myItems.length}/3 — 눌러서 선택</div>
            <div className="mt-1 flex max-h-32 flex-wrap gap-1 overflow-y-auto">
              {bag.length === 0 && <span className="text-[11px] text-slate-600">가방이 비어 있습니다</span>}
              {bag.map((it) => (
                <button key={it.uid} disabled={trade.myLock} onClick={() => onToggleItem(it)}
                  className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition disabled:opacity-50 ${chosen(it.uid)
                    ? 'border-amber-400 bg-amber-500/25 text-amber-200' : 'border-white/12 bg-black/30 text-slate-300 hover:bg-white/10'}`}
                  style={chosen(it.uid) ? undefined : { color: gradeOf(it.grade).color }}>
                  {it.name}
                </button>
              ))}
            </div>
          </div>

          {/* 상대가 내놓을 것 */}
          <div className={`rounded-2xl border p-3 ${trade.theirLock ? 'border-emerald-400/50 bg-emerald-500/8' : 'border-white/12 bg-white/5'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">{trade.nick}님이 줄 것</span>
              {trade.theirLock && <span className="text-[10px] font-bold text-emerald-300">🔒 잠금</span>}
            </div>
            <div className="mt-2 rounded-lg bg-black/30 px-3 py-2 text-sm font-black text-amber-300">
              🪙 {(trade.theirGold || 0).toLocaleString()}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">아이템 {trade.theirItems.length}개</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {trade.theirItems.length === 0 && <span className="text-[11px] text-slate-600">없음</span>}
              {trade.theirItems.map((it, i) => (
                <span key={i} className="rounded-lg border border-white/12 bg-black/30 px-2 py-1 text-[10px] font-bold"
                  style={{ color: gradeOf(it.grade).color }}>{it.name}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={() => onCancel(false)}
            className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/5">취소</button>
          {!trade.myLock ? (
            <button onClick={onLock}
              className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-sm font-black text-white transition hover:brightness-110">
              🔒 제시 확정 (잠금)
            </button>
          ) : (
            <button onClick={onConfirm} disabled={!trade.theirLock || trade.myOk}
              className={`flex-1 rounded-xl py-2.5 text-sm font-black transition ${trade.theirLock && !trade.myOk
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:brightness-110'
                : 'cursor-not-allowed bg-slate-700/60 text-slate-500'}`}>
              {trade.myOk ? '상대 확정 대기 중…' : !trade.theirLock ? '상대 잠금 대기 중…' : '✓ 거래 성립'}
            </button>
          )}
        </div>
        <div className="mt-2 text-center text-[11px] text-slate-500">
          양쪽 모두 잠그고 확정해야 교환이 이뤄집니다
        </div>
      </div>
    </div>
  )
}

/* ==================================================================
   사이드 퀘스트 대화창 — 수락 / 진행 확인 / 보고
   ================================================================== */
function SideQuestModal({ quest, save, onAccept, onTurnIn, onClose }) {
  const st = sqState(save, quest.id)
  const cur = sqProgress(save, quest)
  const done = sqComplete(save, quest)
  const lvOk = (save.level || 1) >= quest.reqLv
  const pct = Math.min(100, (cur / quest.need) * 100)

  return (
    <div data-ui className="absolute inset-0 z-[58] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl border border-white/12 bg-slate-900/96 p-6 shadow-2xl [animation:pop_.25s_cubic-bezier(.2,1.5,.4,1)]">
        <button onClick={onClose} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">✕</button>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-2xl">{quest.icon}</div>
          <div>
            <div className="text-lg font-black text-white">{quest.npc}</div>
            <div className="text-[11px] text-amber-300">{quest.title}</div>
          </div>
        </div>

        <p className="mt-4 rounded-xl bg-black/30 p-3 text-sm leading-relaxed text-slate-200">“{quest.desc}”</p>

        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          <span className={`rounded px-2 py-0.5 ${lvOk ? 'bg-black/30 text-slate-300' : 'bg-rose-500/20 text-rose-300'}`}>
            Lv.{quest.reqLv} 이상
          </span>
          <span className="rounded bg-black/30 px-2 py-0.5 text-violet-300">EXP {quest.exp.toLocaleString()}</span>
          <span className="rounded bg-black/30 px-2 py-0.5 text-amber-300">🪙 {quest.gold.toLocaleString()}</span>
          {quest.rune && <span className="rounded bg-fuchsia-500/20 px-2 py-0.5 font-bold text-fuchsia-300">🔮 룬 확정 지급</span>}
        </div>

        {st === 'done' ? (
          <>
            <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-center text-[12px] text-emerald-200">
              ✓ 이미 완료한 의뢰입니다
            </div>
            <button onClick={onClose} className="mt-3 w-full rounded-xl border border-white/15 py-3 font-bold text-slate-200 transition hover:bg-white/5">돌아가기</button>
          </>
        ) : st === 'active' ? (
          <>
            <div className="mt-4 rounded-xl bg-black/30 p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">
                  {quest.type === 'collect' ? `${quest.item} 수집`
                    : quest.type === 'boss' ? '던전·레이드 클리어'
                    : quest.type === 'visit' ? '방문' : '몬스터 처치'}
                </span>
                <b className="text-white">{cur} / {quest.need}</b>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/50">
                <div className="h-full rounded-full bg-amber-400 transition-[width]" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <button onClick={() => onTurnIn(quest.id)} disabled={!done}
              className={`mt-3 w-full rounded-xl py-3 font-black transition ${done
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:brightness-110'
                : 'cursor-not-allowed bg-slate-700/50 text-slate-500'}`}>
              {done ? '🎉 보고하고 보상 받기' : '아직 부족합니다'}
            </button>
          </>
        ) : (
          <button onClick={() => onAccept(quest.id)} disabled={!lvOk}
            className={`mt-4 w-full rounded-xl py-3 font-black transition ${lvOk
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:brightness-110'
              : 'cursor-not-allowed bg-slate-700/50 text-slate-500'}`}>
            {lvOk ? '📜 의뢰 받기' : `🔒 Lv.${quest.reqLv} 이상 필요`}
          </button>
        )}
      </div>
    </div>
  )
}

/* ==================================================================
   관리자 패널 — 코드로 해금된 사람만 열 수 있다
   ================================================================== */
/* 배율 토글 한 줄 — 켜진 배율을 다시 누르면 꺼진다(1배로 복귀) */
function BoostRow({ label, icon, kind, options, current, onAct }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-slate-400">{icon} {label}</label>
        {current > 1 && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300">×{current} 적용 중</span>}
      </div>
      <div className="mt-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((mul) => {
          const on = current === mul
          return (
            <button key={mul} onClick={() => onAct('boost', { kind, mul })}
              className={`rounded-lg border py-2 text-[12px] font-black transition ${on
                ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                : 'border-white/12 bg-white/5 text-slate-300 hover:bg-white/10'}`}>
              ×{mul}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AdminPanel({ save, players, spectate, onAct, onSpectate, onClose }) {
  const [nick, setNick] = useState('')
  const [confirmNew, setConfirmNew] = useState(false)
  const btn = 'rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-[12px] font-bold text-white transition hover:bg-white/10'
  return (
    <div data-ui className="absolute inset-0 z-[72] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-rose-400/40 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="text-lg font-black text-rose-300">🛠 관리자 패널</div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/10 hover:text-white">✕</button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className={btn} onClick={() => onAct('gold')}>🪙 골드 +10,000</button>
          <button className={btn} onClick={() => onAct('levelup')}>⬆ 레벨 업</button>
          <button className={btn} onClick={() => onAct('maxlevel')}>👑 만렙 찍기</button>
          <button className={btn} onClick={() => onAct('sp')}>✨ SP +10</button>
        </div>

        {/* 경험치·확률·골드 배율 — 다시 누르면 꺼진다 */}
        <BoostRow label="경험치 배율" icon="📘" kind="exp" options={[2, 4, 8, 16]}
          current={(save.adminBoost && save.adminBoost.exp) || 1} onAct={onAct} />
        <BoostRow label="아이템 확률 배율" icon="🎲" kind="drop" options={[10]}
          current={(save.adminBoost && save.adminBoost.drop) || 1} onAct={onAct} />
        <BoostRow label="골드 획득 배율" icon="🪙" kind="gold" options={[2]}
          current={(save.adminBoost && save.adminBoost.gold) || 1} onAct={onAct} />

        <div className="mt-3">
          <label className="text-[11px] text-slate-400">닉네임 바꾸기</label>
          <div className="mt-1 flex gap-2">
            <input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={10}
              placeholder="새 닉네임 (2~10자)"
              className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-[12px] text-white outline-none focus:border-rose-400" />
            <button onClick={() => { onAct('nick', nick); setNick('') }}
              className="rounded-lg bg-rose-600/85 px-3 py-2 text-[12px] font-bold text-white transition hover:brightness-110">변경</button>
          </div>
        </div>

        <div className="mt-3">
          <label className="text-[11px] text-slate-400">캐릭터 새로 만들기</label>
          {!confirmNew ? (
            <button onClick={() => setConfirmNew(true)}
              className="mt-1 w-full rounded-xl border border-orange-400/40 bg-orange-500/10 py-2.5 text-[12px] font-bold text-orange-200 transition hover:bg-orange-500/20">
              🔄 지금 직업·레벨·아이템을 전부 지우고 새로 시작
            </button>
          ) : (
            <div className="mt-1 flex gap-2">
              <button onClick={() => setConfirmNew(false)}
                className="flex-1 rounded-xl border border-white/15 py-2.5 text-[12px] font-bold text-slate-300 transition hover:bg-white/5">취소</button>
              <button onClick={() => onAct('newchar')}
                className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 py-2.5 text-[12px] font-black text-white transition hover:brightness-110">
                정말 초기화 (되돌릴 수 없음)
              </button>
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="text-[11px] text-slate-400">다른 사람 관전하기 <span className="text-slate-600">— 다른 맵에 있어도 가능</span></div>
          {players.length === 0 ? (
            <div className="mt-1 rounded-lg bg-white/5 px-3 py-2 text-[11px] text-slate-500">
              방에 다른 접속자가 없습니다
            </div>
          ) : (
            <div className="mt-1 max-h-48 space-y-1 overflow-y-auto pr-1">
              {players.map((p) => {
                const on = spectate === p.id
                const c = CLASS_BY_ID[p.cls]
                return (
                  <button key={p.id} onClick={() => onSpectate(on ? null : p.id)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${on
                      ? 'border-rose-400/60 bg-rose-500/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                    <span>{c ? c.icon : '👤'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-bold text-white">{p.nick}{p.dead && ' 💀'}</div>
                      <div className="truncate text-[10px] text-slate-400">
                        {p.inst ? (p.inst.startsWith('dg_') ? '파티 던전' : p.inst.startsWith('rd_') ? '파티 레이드' : '결투 중')
                          : p.arena ? '투기장' : p.mapName}
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] text-slate-400">{on ? '관전 중 — 해제' : '관전'}</span>
                  </button>
                )
              })}
            </div>
          )}
          {spectate && (
            <div className="mt-2 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-1.5 text-[10px] text-rose-200">
              카메라가 상대를 따라갑니다 (다른 맵이면 그 사람의 좌표만 비춥니다) — 다시 눌러 해제하세요
            </div>
          )}
        </div>

        <div className="mt-4 rounded-lg bg-white/5 px-3 py-2 text-[10px] leading-relaxed text-slate-500">
          Lv.{save.level} · 🪙 {save.gold.toLocaleString()} · SP {save.sp}
        </div>
      </div>
    </div>
  )
}

/* 수락/거절만 묻는 작은 팝업 (거래·결투 공용) */
function ConfirmPopup({ icon, title, desc, hint, accentFrom, accentTo, onAccept, onDecline }) {
  return (
    <div data-ui className="absolute inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-[20rem] rounded-3xl border border-white/15 bg-slate-900 p-6 text-center shadow-2xl [animation:pop_.3s_cubic-bezier(.2,1.6,.4,1)]">
        <div className="text-5xl">{icon}</div>
        <div className="mt-3 text-lg font-black text-white">{title}</div>
        <div className="mt-1 text-sm text-slate-300">{desc}</div>
        {hint && <div className="mt-2 text-[11px] text-slate-500">{hint}</div>}
        <div className="mt-5 flex gap-2">
          <button onClick={onDecline}
            className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/5">거절</button>
          <button onClick={onAccept}
            className={`flex-1 rounded-xl bg-gradient-to-r ${accentFrom} ${accentTo} py-2.5 text-sm font-black text-white transition hover:brightness-110`}>수락</button>
        </div>
      </div>
    </div>
  )
}

/* ==================================================================
   맵별 사이드 퀘스트 NPC — 머리 위 표시로 받을 것/보고할 것을 알린다
   ================================================================== */
function SideQuestNPC({ spot, state, ready, canTake }) {
  const mark = useRef()
  useFrame((st) => {
    if (mark.current) {
      const t = st.clock.elapsedTime
      mark.current.position.y = 2.5 + Math.sin(t * 2.4) * 0.12
      mark.current.rotation.y = t * 1.6
    }
  })
  const color = ready ? '#4ade80' : canTake ? '#fbbf24' : '#64748b'
  return (
    <group position={[spot.x, 0, spot.z]} rotation-y={spot.face || 0}>
      {/* 몸통 */}
      <mesh castShadow position={[0, 0.85, 0]}>
        <capsuleGeometry args={[0.32, 0.75, 4, 10]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
      <mesh castShadow position={[0, 1.62, 0]}>
        <sphereGeometry args={[0.27, 14, 12]} />
        <meshStandardMaterial color="#f1d3b4" roughness={0.8} />
      </mesh>
      {/* 상태 표식 */}
      {(ready || canTake) && (
        <mesh ref={mark} position={[0, 2.5, 0]}>
          <octahedronGeometry args={[0.2]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} />
        </mesh>
      )}
      <Billboard position={[0, 2.1, 0]}>
        <mesh><planeGeometry args={[1.5, 0.3]} /><meshBasicMaterial color="#0b1020" transparent opacity={0.7} /></mesh>
      </Billboard>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <ringGeometry args={[1.1, 1.35, 24]} />
        <meshBasicMaterial color={color} transparent opacity={state === 'done' ? 0.15 : 0.4} />
      </mesh>
    </group>
  )
}

/* 히든 직업 전직 지점 — 빛나는 원 */
function HiddenSpot({ spot }) {
  const g = useRef()
  useFrame((st) => {
    if (g.current) {
      const t = st.clock.elapsedTime
      g.current.rotation.y = t * 0.5
      g.current.scale.setScalar(1 + Math.sin(t * 1.6) * 0.06)
    }
  })
  return (
    <group position={[spot.x, 0, spot.z]}>
      <group ref={g}>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.06, 0]}>
          <ringGeometry args={[spot.r - 0.5, spot.r, 40]} />
          <meshBasicMaterial color="#e879f9" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
          <circleGeometry args={[spot.r - 0.5, 32]} />
          <meshBasicMaterial color="#a855f7" transparent opacity={0.16} />
        </mesh>
      </group>
      <pointLight color="#e879f9" intensity={5} distance={12} position={[0, 1.5, 0]} />
      <mesh position={[0, 1.6, 0]}>
        <octahedronGeometry args={[0.42]} />
        <meshStandardMaterial color="#f0abfc" emissive="#e879f9" emissiveIntensity={1.4} />
      </mesh>
    </group>
  )
}

/* ==================================================================
   AI 동료 — 인원이 모자랄 때 함께 싸워주는 마을 용병

   혼자서도 파티 던전·레이드를 체험할 수 있게 파티 자리를 채운다.
   시뮬레이션은 몹과 마찬가지로 인스턴스 소유자(파티장)만 돌리고,
   나머지 참가자에게는 위치·HP가 스냅샷으로 전달된다.
   ================================================================== */
const ALLY_NAMES = ['용병 카린', '용병 두르', '용병 미라', '용병 렌', '용병 소라', '용병 발크', '용병 이니', '용병 타샤', '용병 곤']
const ALLY_CLASSES = ['warrior', 'archer', 'healer', 'mage', 'priest', 'assassin', 'moon', 'swordsman', 'reaper']

/* 인원이 모자란 만큼 AI 동료를 만든다 */
function makeAllies(count, level) {
  return Array.from({ length: Math.max(0, count) }, (_, i) => ({
    id: 'ai_' + i,
    nick: ALLY_NAMES[i % ALLY_NAMES.length],
    cls: ALLY_CLASSES[i % ALLY_CLASSES.length],
    level,
    ai: true,
  }))
}

function AllyBot({ ally, world, live, index }) {
  const root = useRef()
  const armPivot = useRef()
  const hpFg = useRef()
  const cls = CLASS_BY_ID[ally.cls] || CLASSES[0]
  const pose = poseOf(cls.weapon)
  const label = useMemo(() => makeLabelTexture(ally.nick), [ally.nick])
  useEffect(() => () => label.tex.dispose(), [label])

  const st = useRef({
    x: Math.cos((index / 4) * Math.PI * 2) * 4,
    z: 6 + Math.sin((index / 4) * Math.PI * 2) * 2,
    yaw: Math.PI, hp: 1, maxHp: 1, swingT: -1, cool: 0.6 + index * 0.2, healCd: 4,
  })

  /* 파티 명단에 나를 등록해 힐·버프 대상이 되고 몹 표적도 된다 */
  useEffect(() => {
    const w = world.current
    const me = {
      peerId: ally.id, nick: ally.nick, cls: ally.cls, ai: true,
      x: st.current.x, z: st.current.z, yaw: st.current.yaw,
      hp: 1, maxHp: 1, dead: false, alive: true,
      mapId: w.mapId, inst: w.inst, at: performance.now(),
    }
    w.peers.set(ally.id, me)
    return () => { w.peers.delete(ally.id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((state, rawDelta) => {
    const g = root.current
    if (!g) return
    const dt = Math.min(rawDelta, 0.1)
    const w = world.current
    const me = w.peers.get(ally.id)
    if (!me) return
    const S2 = st.current

    /* 동료 능력치는 파티원 평균에 맞춘 고정값 — 밸런스가 튀지 않게 */
    const lvl = ally.level || 1
    const maxHp = 200 + lvl * 26
    const atk = 12 + lvl * 3.4
    if (S2.maxHp !== maxHp) { S2.maxHp = maxHp; if (S2.hp <= 1) S2.hp = maxHp }
    me.maxHp = maxHp
    me.at = performance.now()
    me.inst = w.inst
    me.mapId = w.mapId

    if (me.dead) {
      g.rotation.x = lerp(g.rotation.x, -Math.PI / 2 + 0.2, damp(6, dt))
      g.position.set(S2.x, 0, S2.z)
      return
    }
    g.rotation.x = lerp(g.rotation.x, 0, damp(10, dt))

    /* 가장 가까운 살아있는 몹을 찾아 붙는다 */
    let target = null, best = 1e9
    w.mobs.forEach((m) => {
      if (!m.alive) return
      const d = dist2(S2.x, S2.z, m.x, m.z)
      if (d < best) { best = d; target = m }
    })

    const healer = ally.cls === 'healer' || ally.cls === 'priest'
    S2.healCd = Math.max(0, S2.healCd - dt)
    /* 지원 계열은 다친 아군(플레이어 포함)을 돌본다 */
    if (healer && S2.healCd <= 0) {
      const pHurt = live.current.hp < statsRefSafe(w) * 0.65 && !live.current.dead
      if (pHurt) {
        S2.healCd = 6
        if (w.healAlly) w.healAlly(Math.round(40 + lvl * 6))
      }
    }

    if (target) {
      const dx = target.x - S2.x, dz = target.z - S2.z
      const d = Math.max(0.001, Math.hypot(dx, dz))
      S2.yaw = dampAngle(S2.yaw, Math.atan2(dx, dz), 8, dt)
      const reach = 2.6
      if (d > reach) {
        const spd = 5.2
        S2.x += (dx / d) * spd * dt
        S2.z += (dz / d) * spd * dt
      } else {
        S2.cool -= dt
        if (S2.cool <= 0) {
          S2.cool = 1.1
          S2.swingT = 0
          const dmg = Math.round(atk * (0.85 + Math.random() * 0.4))
          target.hit({ x: dx / d, z: dz / d }, dmg, ally.id)
        }
      }
    } else {
      /* 적이 없으면 플레이어 곁으로 */
      const px = w.player.x, pz = w.player.z
      const dx = px - S2.x, dz = pz - S2.z
      const d = Math.hypot(dx, dz)
      if (d > 4) { S2.x += (dx / d) * 4.4 * dt; S2.z += (dz / d) * 4.4 * dt }
      S2.yaw = dampAngle(S2.yaw, Math.atan2(dx, dz), 5, dt)
    }

    const half = w.half
    S2.x = clamp(S2.x, -half, half); S2.z = clamp(S2.z, -half, half)
    me.x = S2.x; me.z = S2.z; me.yaw = S2.yaw; me.hp = S2.hp

    g.position.x = S2.x
    g.position.z = S2.z
    g.position.y = Math.abs(Math.sin(state.clock.elapsedTime * 3 + index)) * 0.04
    g.rotation.y = S2.yaw

    if (hpFg.current) {
      const r = clamp(S2.hp / S2.maxHp, 0, 1)
      hpFg.current.scale.x = Math.max(0.001, r)
      hpFg.current.position.x = -0.6 * (1 - r)
      hpFg.current.material.color.set(r > 0.6 ? '#4ade80' : r > 0.34 ? '#facc15' : '#f87171')
    }
    if (armPivot.current) {
      if (S2.swingT >= 0) {
        S2.swingT += dt
        const q = S2.swingT / SWING_TIME
        if (q >= 1) { S2.swingT = -1; armPivot.current.rotation.x = pose.rest }
        else armPivot.current.rotation.x = swingAngleFor(pose, q)
      } else armPivot.current.rotation.x = pose.rest + Math.sin(state.clock.elapsedTime * 1.6 + index) * 0.05
    }
  })

  return (
    <group ref={root}>
      <CharacterBody cls={cls} wtype={cls.weapon} armPivot={armPivot} tint={false} />
      <Billboard position={[0, 3.05, 0]}>
        <mesh position={[0, 0.3, 0]}>
          <planeGeometry args={[label.aspect * 0.4, 0.4]} />
          <meshBasicMaterial map={label.tex} transparent depthWrite={false} />
        </mesh>
        <mesh><planeGeometry args={[1.25, 0.16]} /><meshBasicMaterial color="#111827" transparent opacity={0.85} /></mesh>
        <mesh ref={hpFg} position={[0, 0, 0.001]}><planeGeometry args={[1.2, 0.1]} /><meshBasicMaterial color="#4ade80" /></mesh>
      </Billboard>
    </group>
  )
}
/* 플레이어 최대 HP를 안전하게 얻는다 (동료 회복 판단용) */
function statsRefSafe(w) { return (w.playerMaxHp || 100) }

/* ==================================================================
   던전 · 레이드 무대 — 폐쇄된 원형 투기장 + 웨이브 몬스터
   ================================================================== */
function DungeonArena({ inst, mobs, world, live, onKill, onRespawn }) {
  const def = inst ? (inst.kind === 'dungeon' ? DUNGEON_BY_ID[inst.cid] : RAID_BY_ID[inst.cid]) : null
  const half = inst && inst.kind === 'raid' ? RAID_HALF : DG_HALF
  const ground = inst && inst.kind === 'raid' ? '#2a1f3a' : (def ? def.ground : '#333')
  const accent = inst && inst.kind === 'raid' ? (def ? def.color : '#a052d6') : (def ? def.accent : '#888')
  const pillars = useMemo(() => Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2
    return [Math.cos(a) * (half + 0.6), Math.sin(a) * (half + 0.6)]
  }), [half])

  return (
    <group>
      <Ground color={ground} />
      {/* 바닥 원 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} receiveShadow>
        <circleGeometry args={[half + 0.6, 56]} />
        <meshStandardMaterial color={ground} roughness={0.95} />
      </mesh>
      {/* 경계 링 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
        <ringGeometry args={[half - 0.15, half + 0.6, 56]} />
        <meshBasicMaterial color={accent} transparent opacity={0.75} />
      </mesh>
      {/* 기둥 */}
      {pillars.map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, 1.6, z]}>
          <cylinderGeometry args={[0.28, 0.34, 3.2, 7]} />
          <meshStandardMaterial color={accent} roughness={0.85} emissive={accent} emissiveIntensity={0.12} />
        </mesh>
      ))}
      {/* 몬스터 — 필드와 같은 컴포넌트를 재사용한다 */}
      <group key={inst ? inst.inst + '_' + inst.wave : 'none'}>
        {mobs.map((m) => (
          <Monster key={m.id} entry={m} world={world} live={live} onKill={onKill} onRespawn={onRespawn} />
        ))}
      </group>
    </group>
  )
}

/* ==================================================================
   파티 — 초대해서 팀을 만들고, 전원 준비되면 파티장이 던전/레이드를 연다
   ================================================================== */
function PartyModal({ myId, party, roster, contentSel, setContentSel, saveLevel, allyOk,
  onInvite, onLeave, onReady, onStart, onTrade, onDuel, onClose }) {
  const isLeader = !!party && party.leaderId === myId
  const size = party ? party.members.length : 1
  const lim = contentSel.kind === 'dungeon' ? { min: 1, max: 6 } : { min: 4, max: 10 }
  const content = contentSel.kind === 'dungeon' ? DUNGEON_BY_ID[contentSel.id] : RAID_BY_ID[contentSel.id]
  const notReady = party ? party.members.filter((m) => m.id !== party.leaderId && !m.ready) : []
  /* 인원이 모자라면 AI 용병이 채워주므로 상한만 지키면 시작할 수 있다 */
  const aiFill = Math.max(0, lim.min - size)
  const sizeOk = size <= lim.max
  const canStart = isLeader && sizeOk && notReady.length === 0
  const lvOk = saveLevel >= content.reqLv
  const inParty = (id) => !!party && party.members.some((m) => m.id === id)
  const myReady = party ? !!party.members.find((m) => m.id === myId)?.ready : false

  return (
    <div data-ui className="absolute inset-0 z-[60] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="text-lg font-black text-white">🛡 파티</div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/10 hover:text-white">✕</button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* 접속자 목록 */}
          <div>
            <div className="text-xs font-bold text-slate-400">같은 방 접속자 ({roster.length}명)</div>
            <div className="mt-2 space-y-1.5">
              {roster.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[12px] text-slate-500">
                  아직 아무도 없습니다 — 같은 방 코드로 친구를 초대하세요
                </div>
              )}
              {roster.map((p) => {
                const c = CLASS_BY_ID[p.cls]
                return (
                  <div key={p.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-base">{c ? c.icon : '👤'}</span>
                    <span className="truncate text-sm font-bold text-white">{p.nick}</span>
                    <div className="ml-auto flex gap-1">
                      {inParty(p.id)
                        ? <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-bold text-emerald-300">파티중</span>
                        : (
                          <button onClick={() => onInvite(p.id, p.nick)} disabled={!!party && !isLeader}
                            className="rounded-lg bg-indigo-500/85 px-2 py-1 text-[10px] font-bold text-white transition hover:brightness-110 disabled:opacity-40">
                            초대
                          </button>
                        )}
                      <button onClick={() => onTrade(p.id, p.nick)}
                        className="rounded-lg bg-amber-500/85 px-2 py-1 text-[10px] font-bold text-white transition hover:brightness-110">거래</button>
                      <button onClick={() => onDuel(p.id, p.nick)}
                        className="rounded-lg bg-rose-500/85 px-2 py-1 text-[10px] font-bold text-white transition hover:brightness-110">대결</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 파티 상태 */}
          <div>
            <div className="text-xs font-bold text-slate-400">내 파티 {party ? `(${size}명)` : ''}</div>
            {!party ? (
              <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-[12px] leading-relaxed text-slate-400">
                파티가 없습니다.<br />
                왼쪽 목록에서 <b className="text-slate-200">초대</b>를 누르면 파티가 만들어지고,
                <b className="text-slate-200"> 초대를 보낸 사람이 파티장</b>이 됩니다.
              </div>
            ) : (
              <>
                <div className="mt-2 space-y-1.5">
                  {party.members.map((m) => {
                    const c = CLASS_BY_ID[m.cls]
                    const leader = m.id === party.leaderId
                    return (
                      <div key={m.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <span className="text-base">{c ? c.icon : '👤'}</span>
                        <span className="truncate text-sm font-bold text-white">{m.nick}</span>
                        {leader && <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">파티장</span>}
                        {m.id === myId && <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-slate-300">나</span>}
                        <span className="ml-auto text-[11px] text-slate-400">Lv.{m.level || 1}</span>
                        {!leader && (
                          <span className={`text-[11px] font-bold ${m.ready ? 'text-emerald-300' : 'text-slate-500'}`}>
                            {m.ready ? '✓준비' : '대기'}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                {!isLeader && (
                  <button onClick={onReady}
                    className={`mt-3 w-full rounded-xl py-2.5 text-sm font-black transition ${myReady
                      ? 'bg-emerald-600 text-white hover:brightness-110'
                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}>
                    {myReady ? '✓ 준비 완료 (해제하려면 클릭)' : '준비 완료하기'}
                  </button>
                )}
                <button onClick={onLeave}
                  className="mt-2 w-full rounded-xl border border-white/15 py-2 text-[12px] font-bold text-slate-300 transition hover:bg-white/5">
                  파티 나가기
                </button>
              </>
            )}
          </div>
        </div>

        {/* 콘텐츠 선택 — 파티장만 시작 */}
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="flex gap-2">
            {[['dungeon', '🗝 파티 던전', '1~6명 · 5웨이브'], ['raid', '🐉 파티 레이드', '4~10명 · 페이즈 보스']].map(([k, label, sub]) => (
              <button key={k} onClick={() => setContentSel({ kind: k, id: 0 })}
                className={`flex-1 rounded-xl border px-3 py-2 text-left transition ${contentSel.kind === k
                  ? 'border-indigo-400/60 bg-indigo-500/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                <div className="text-sm font-black text-white">{label}</div>
                <div className="text-[10px] text-slate-400">{sub}</div>
              </button>
            ))}
          </div>

          {/* 던전이 많아 레벨 구간별로 묶어 보여준다 */}
          <div className="mt-3 max-h-56 overflow-y-auto pr-1">
            {contentSel.kind === 'raid' ? (
              <div className="grid gap-2 sm:grid-cols-3">
                {RAID_DIFFS.map((d) => {
                  const on = contentSel.id === d.id
                  const lvOk = saveLevel >= d.reqLv
                  return (
                    <button key={d.id} onClick={() => setContentSel({ kind: 'raid', id: d.id })}
                      className={`rounded-xl border px-3 py-2 text-left transition ${on
                        ? 'border-amber-400/60 bg-amber-500/12' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                      <div className="text-[13px] font-black text-white">{d.icon} {d.name}</div>
                      <div className={`text-[10px] ${lvOk ? 'text-slate-400' : 'text-rose-400'}`}>
                        Lv.{d.reqLv} 이상 · {d.phases}페이즈
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              [...new Set(DUNGEONS.map((d) => d.reqLv))].map((lv) => {
                const group = DUNGEONS.filter((d) => d.reqLv === lv)
                const lvOk = saveLevel >= lv
                return (
                  <div key={lv} className="mb-2">
                    <div className={`mb-1 text-[10px] font-bold ${lvOk ? 'text-slate-400' : 'text-rose-400/70'}`}>
                      Lv.{lv} {lvOk ? '' : '(부족)'} — {group.length}개
                    </div>
                    <div className="grid gap-1.5 sm:grid-cols-3">
                      {group.map((d) => {
                        const on = contentSel.id === d.id
                        return (
                          <button key={d.id} onClick={() => setContentSel({ kind: 'dungeon', id: d.id })}
                            title={d.desc}
                            className={`rounded-xl border px-2.5 py-1.5 text-left transition ${on
                              ? 'border-amber-400/60 bg-amber-500/12'
                              : lvOk ? 'border-white/10 bg-white/5 hover:bg-white/10'
                              : 'border-white/8 bg-black/20 opacity-60'}`}>
                            <div className="truncate text-[12px] font-black text-white">{d.icon} {d.name}</div>
                            {d.reqLv >= 40 && <div className="text-[9px] text-fuchsia-300">✨ 아티팩트 가능</div>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {aiFill > 0 && lvOk && (
            allyOk ? (
              <div className="mt-3 rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-[11px] text-sky-200">
                🤝 인원이 <b>{aiFill}명</b> 모자라 <b>마을 용병</b>이 함께 갑니다 — 메인 퀘스트 중에만 도와줍니다
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                ⚠ 인원이 <b>{aiFill}명</b> 부족합니다 — 용병은 <b>메인 퀘스트 중에만</b> 도와줍니다. 사람을 모아주세요.
              </div>
            )
          )}

          {!party || isLeader ? (
            <>
              {contentSel.kind === 'raid' && size <= 1 && lvOk && (
                <button onClick={() => onStart(true)}
                  className="mt-3 w-full rounded-xl border border-sky-400/40 bg-sky-500/10 py-2.5 text-sm font-black text-sky-200 transition hover:bg-sky-500/20">
                  🧍 혼자 레이드 입장 (보스 약화)
                </button>
              )}
              <button onClick={() => onStart(false)} disabled={!lvOk || (party && !canStart) || (aiFill > 0 && !allyOk)}
                className={`mt-3 w-full rounded-xl py-3 font-black text-white transition ${lvOk && (!party || canStart) && (aiFill === 0 || allyOk)
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110'
                  : 'cursor-not-allowed bg-slate-700/60 text-slate-500'}`}>
                {!lvOk ? `Lv.${content.reqLv} 이상 필요`
                  : !sizeOk ? `최대 ${lim.max}명까지입니다 (현재 ${size}명)`
                  : aiFill > 0 && !allyOk ? `${lim.min}명이 필요합니다 (현재 ${size}명)`
                  : notReady.length ? `준비 대기: ${notReady.map((m) => m.nick).join(', ')}`
                  : `▶ ${content.name} 입장${aiFill > 0 ? ` (+용병 ${aiFill})` : ''}`}
              </button>
              <div className="mt-2 text-center text-[11px] text-slate-500">
                {party ? '파티원 전원이 준비를 완료하면 입장할 수 있습니다'
                  : allyOk ? '혼자 시작하면 용병이 자리를 채웁니다' : '용병은 메인 퀘스트 중에만 함께합니다'}
              </div>
            </>
          ) : (
            <div className="mt-3 rounded-xl bg-white/5 px-3 py-2.5 text-center text-[12px] text-slate-400">
              파티장이 시작하기를 기다리는 중입니다 — <b className="text-slate-200">준비 완료</b>를 눌러주세요
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ==================================================================
   월드 — 맵에 들어오면 코드 없이 자동으로 모두와 연결된다
   ================================================================== */
function RoomModal({ room, isHost, onJoin, onLeave, onClose }) {
  const online = !!getWsUrl()          // 인터넷 서버가 설정되어 있는가
  const link = room.link

  return (
    <div data-ui className="absolute inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-[23rem] rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="text-lg font-black text-white">🌐 월드</div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/10 hover:text-white">✕</button>
        </div>

        {room.connected ? (
          <>
            <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-center">
              <div className="text-3xl">🌍</div>
              <div className="mt-1 text-sm font-black text-emerald-300">월드에 접속 중</div>
              <div className="mt-1.5 text-[11px] text-slate-400">
                같은 맵에 있는 사람과 자동으로 만나집니다
              </div>
            </div>

            {/* 연결 상태 */}
            <div className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-bold ${
              link === 'open' ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
              : link === 'connecting' ? 'border-amber-400/30 bg-amber-500/10 text-amber-300'
              : link === 'error' ? 'border-rose-400/30 bg-rose-500/10 text-rose-300'
              : 'border-white/10 bg-white/5 text-slate-300'}`}>
              {link === 'open' && <>🟢 인터넷 서버 연결됨 — 다른 기기와 만날 수 있어요</>}
              {link === 'connecting' && <>🟡 서버에 연결하는 중…</>}
              {link === 'error' && <>🔴 서버 주소가 잘못되었습니다</>}
              {link === 'local' && <>💻 로컬 모드 — 이 컴퓨터의 탭끼리 연결됩니다</>}
            </div>

            <div className="mt-4">
              <div className="text-xs font-bold text-slate-400">접속 중 ({room.members.length}명)</div>
              <div className="mt-2 space-y-1.5">
                {room.members.map((m) => {
                  const c = CLASS_BY_ID[m.cls]
                  const isMe = m.id === room.roomRef.current?.id
                  return (
                    <div key={m.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <span className="text-base">{c ? c.icon : '👤'}</span>
                      <span className="text-sm font-bold text-white">{m.nick}</span>
                      {isMe && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">나</span>}
                      <span className="ml-auto text-[11px] text-slate-400">Lv.{m.level || 1}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
              {isHost
                ? '🖥 이 기기가 몬스터를 관리합니다 (호스트)'
                : '📡 호스트의 몬스터 상태를 받아오는 중입니다'}
              <br />몬스터를 <b className="text-slate-300">마지막에 때린 사람</b>이 경험치와 아이템을 가져갑니다.
            </div>

            <button onClick={() => { onLeave(); onClose() }}
              className="mt-4 w-full rounded-xl border border-white/15 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/5">
              혼자 하기
            </button>
          </>
        ) : (
          <>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <div className="text-3xl">🚪</div>
              <div className="mt-1 text-sm font-black text-slate-200">혼자 하는 중</div>
              <div className="mt-1.5 text-[11px] text-slate-400">
                다시 접속하면 다른 사람들과 만날 수 있습니다
              </div>
            </div>

            <button onClick={() => { onJoin(); onClose() }}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-3 font-black text-white transition hover:brightness-110">
              🌐 월드에 다시 접속
            </button>

            <div className="mt-4 rounded-xl bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
              {online ? (
                <>🌏 <b className="text-slate-300">인터넷 서버</b>를 통해 연결됩니다 —
                맵에 들어오면 다른 기기의 사람들과 자동으로 만나집니다.</>
              ) : (
                <>지금은 <b className="text-slate-300">같은 컴퓨터의 다른 탭</b>끼리 연결됩니다.
                서버를 붙이면 인터넷 너머의 친구와도 자동으로 만날 수 있습니다.</>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function DifficultyModal({ save, onPick, onClose }) {
  return (
    <div data-ui className="absolute inset-0 z-[55] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-3xl border border-white/12 bg-slate-900/96 p-6 shadow-2xl [animation:pop_.25s_cubic-bezier(.2,1.5,.4,1)]">
        <button onClick={onClose} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">✕</button>
        <div className="mb-1 text-lg font-black text-white">⚔ 결투 난이도 선택</div>
        <div className="mb-4 text-[11px] text-slate-400">
          높을수록 적이 강해지고 보상이 커집니다
          {save.bestDiff >= 0 && <> · 최고 기록 <b style={{ color: AI_DIFFS[save.bestDiff].color }}>{AI_DIFFS[save.bestDiff].name}</b></>}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {AI_DIFFS.map((d) => (
            <button key={d.id} onClick={() => onPick(d.id)}
              className="rounded-xl border p-3 text-left transition hover:brightness-125"
              style={{ borderColor: d.color + '55', background: d.color + '12' }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-black" style={{ color: d.color }}>{d.name}</span>
                <span className="text-[10px]" style={{ color: d.color }}>{d.star}</span>
              </div>
              <div className="mt-1 text-[10px] text-slate-400">체력 {d.hp} · 피해 {d.dmg} · 속도 {d.spd}</div>
              <div className="text-[10px] text-amber-300/80">보상 {d.gold} G · {d.exp} EXP</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ==================================================================
   수학 문제 (마법사)
   ================================================================== */
function MathModal({ problem, circle, onSubmit, onCancel }) {
  const [val, setVal] = useState('')
  const inputRef = useRef(null)
  useEffect(() => { const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 30); return () => clearTimeout(t) }, [])
  const submit = (e) => { e.preventDefault(); if (val.trim() === '') return; onSubmit(val) }
  return (
    <div data-ui className="absolute inset-0 z-[55] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <form onSubmit={submit}
        className="w-[22rem] rounded-3xl border border-violet-400/30 bg-slate-900/96 p-7 text-center shadow-2xl [animation:pop_.25s_cubic-bezier(.2,1.5,.4,1)]">
        <div className="text-[11px] tracking-[0.3em] text-violet-300/70">{circle}서클 마법 · 연산 시전</div>
        <div className="mt-3 text-4xl font-black text-white">{problem.text}<span className="text-violet-300"> = ?</span></div>
        <input ref={inputRef} value={val} onChange={(e) => setVal(e.target.value.replace(/[^0-9-]/g, ''))}
          inputMode="numeric" placeholder="정답 입력"
          className="mt-5 w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-center text-2xl font-bold text-white outline-none focus:border-violet-400" />
        <div className="mt-4 flex gap-2">
          <button type="submit" className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-3 font-black text-white transition hover:brightness-110">🔮 시전</button>
          <button type="button" onClick={onCancel} className="rounded-xl border border-white/15 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/5">취소</button>
        </div>
        <div className="mt-2 text-[11px] text-slate-500">정답 시 스킬 발동 · 데미지 ×1.5 · 3정답마다 서클↑</div>
      </form>
    </div>
  )
}

/* ==================================================================
   화면 1: 로그인
   ================================================================== */
function LoginScreen({ onCreate }) {
  const [nick, setNick] = useState('')
  const [error, setError] = useState(null)
  const submit = (e) => { e.preventDefault(); const err = onCreate(nick); if (err) setError(err) }
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-indigo-950 via-slate-950 to-black">
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 28%, rgba(99,102,241,.22), transparent 60%)' }} />
      <form onSubmit={submit} className="relative w-[22rem] rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
        <div className="text-center">
          <div className="text-[11px] tracking-[0.4em] text-indigo-300/70">HARDCORE ACTION RPG</div>
          <h1 className="mt-2 text-3xl font-black text-white">파밍의 투기장</h1>
          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            모험을 시작할 닉네임을 정해주세요.<br />
            한 번 정한 닉네임은 <b className="text-slate-200">변경할 수 없습니다.</b>
          </p>
        </div>
        <input value={nick} onChange={(e) => { setNick(e.target.value); setError(null) }} maxLength={10}
          placeholder="닉네임 (2~10자)" autoFocus
          className="mt-6 w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-center text-white placeholder-slate-500 outline-none transition focus:border-indigo-400" />
        {error && <div role="alert" className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">⚠ {error}</div>}
        <button type="submit" className="mt-5 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-3 font-bold text-white transition hover:brightness-110 active:scale-[0.98]">
          모험 시작
        </button>
      </form>
    </div>
  )
}

/* ==================================================================
   화면 2: 직업 선택
   ================================================================== */
function ClassSelectScreen({ nick, onPick }) {
  return (
    <div className="fixed inset-0 overflow-y-auto bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 text-center">
          <div className="text-[11px] tracking-[0.4em] text-indigo-300/70">CLASS SELECT</div>
          <h1 className="mt-2 text-3xl font-black text-white">직업 선택</h1>
          <p className="mt-2 text-sm text-slate-400">
            <b className="text-white">{nick}</b>님, 직업마다 <b className="text-indigo-300">영구 성장 방식</b>과 <b className="text-amber-300">전용 무기</b>가 다릅니다
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CLASSES.map((c) => (
            <button key={c.id} onClick={() => onPick(c.id)}
              className="group rounded-2xl border border-white/10 bg-slate-900/70 p-5 text-left transition hover:-translate-y-1 hover:border-white/30 hover:bg-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="text-3xl">{c.icon}</div>
                <div>
                  <div className="text-lg font-bold" style={{ color: c.color }}>{c.name}</div>
                  <div className="text-[11px] text-slate-400">{c.role}</div>
                </div>
              </div>
              <div className="mt-2">
                <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-xs text-slate-300">
                  🗡 {WEAPON_TYPES[c.weapon].name} ({WEAPON_TYPES[c.weapon].hands === 2 ? '두 손' : '한 손'})
                </span>
              </div>
              <div className="mt-3 rounded-lg bg-black/25 px-3 py-2 text-[11px] leading-relaxed text-slate-300">
                <b style={{ color: c.color }}>성장</b> · {c.growHint}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ==================================================================
   앱
   ================================================================== */

/* ==================================================================
   앱 — 닉네임은 영구 고정, 직업은 자유 변경
   ================================================================== */
function RpgGame() {
  const [boot] = useState(() => loadJSON(LS_ACCOUNT, null))
  const [account, setAccount] = useState(boot)
  const [screen, setScreen] = useState(boot?.nick ? (boot.cls ? 'GAME' : 'CLASS_SELECT') : 'LOGIN')
  const [toasts, setToasts] = useState([])
  const toastId = useRef(0)

  const addToast = useCallback((msg) => {
    const id = ++toastId.current
    setToasts((t) => [...t.slice(-4), { id, msg }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400)
  }, [])

  const createAccount = useCallback((raw) => {
    const nick = raw.trim()
    if (nick.length < 2 || nick.length > 10) return '닉네임은 2~10자로 입력해주세요'
    const taken = loadJSON(LS_NICKS, [])
    if (taken.includes(nick)) return '이미 사용 중인 닉네임입니다'
    /* 닉네임은 이 시점에 영구 고정된다 — 이후 어떤 경로로도 변경 불가 */
    const acc = { nick }
    saveJSON(LS_ACCOUNT, acc)
    saveJSON(LS_NICKS, [...taken, nick])
    saveJSON(LS_SAVE, defaultSave())
    setAccount(acc)
    setScreen('CLASS_SELECT')
    return null
  }, [])

  const pickClass = useCallback((id) => {
    const c = CLASS_BY_ID[id]
    if (!c) return
    setAccount((prev) => { const acc = { ...prev, cls: id }; saveJSON(LS_ACCOUNT, acc); return acc })
    setScreen('GAME')
    addToast(`${c.name}의 길을 걷습니다 ${c.icon}`)
  }, [addToast])

  /* 직업 변경 — 닉네임(nick)은 그대로 두고 cls만 교체해 localStorage에 반영 */
  const changeClass = useCallback((id) => {
    const c = CLASS_BY_ID[id]
    if (!c) return
    setAccount((prev) => { const acc = { ...prev, cls: id }; saveJSON(LS_ACCOUNT, acc); return acc })
  }, [])

  /* 관리자 전용 — 캐릭터 새로 만들기. 저장 데이터를 초기화하고
     닉네임은 그대로 둔 채 직업 선택 화면으로 되돌아간다.
     관리자 권한과 코드 사용 이력은 기기(계정) 단위 설정이라 그대로 넘겨준다. */
  const resetCharacter = useCallback((preserve) => {
    saveJSON(LS_SAVE, { ...defaultSave(), ...preserve })
    setAccount((prev) => { const acc = { nick: prev.nick }; saveJSON(LS_ACCOUNT, acc); return acc })
    setScreen('CLASS_SELECT')
  }, [])

  const cls = CLASS_BY_ID[account?.cls] || null
  const view = screen === 'GAME' && !cls ? 'CLASS_SELECT' : screen

  return (
    <div className="fixed inset-0 bg-slate-950 font-sans">
      {view === 'LOGIN' && <LoginScreen onCreate={createAccount} />}
      {view === 'CLASS_SELECT' && account && <ClassSelectScreen nick={account.nick} onPick={pickClass} />}
      {view === 'GAME' && account && cls && (
        <GameScreen key={cls.id} account={account} cls={cls} addToast={addToast}
          onChangeClass={changeClass} onResetCharacter={resetCharacter} />
      )}

      <div className="pointer-events-none fixed left-1/2 top-20 z-[70] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="rounded-full border border-white/10 bg-black/80 px-5 py-2.5 text-sm font-medium text-white shadow-xl [animation:toastup_2.4s_ease_forwards]">
            {t.msg}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toastup {
          0% { opacity: 0; transform: translateY(-12px) }
          8% { opacity: 1; transform: translateY(0) }
          85% { opacity: 1 }
          100% { opacity: 0; transform: translateY(-10px) }
        }
      `}</style>
    </div>
  )
}


/* ==================================================================
   ==================================================================
   [ 게임 2 ] Dragon Rider — 창공의 부화장
   Phase 1 잠입(알 도둑) → Phase 2 부화장(육성) → Phase 3 공중전(도그파이트)
   ==================================================================
   ================================================================== */

/* ---------------- 잠입 페이즈 상수 ---------------- */
const DR_FIELD_X = 16          // 둥지 맵 좌우 반경
const DR_FIELD_Z = 30          // 앞뒤 길이
const DR_START = { x: 0, z: 26 }
const DR_EGG = { x: 0, z: -22 }
const DR_MOM = { x: 0, z: -26 }
const DR_MOVE = 8.5
const DR_CONE_R = 26           // 시야각 사거리
const DR_CONE_HALF = 0.52      // 시야각 절반(라디안) ≈ 60°
const DR_SWEEP = 0.85          // 좌우 스윙 폭(라디안)
const DR_SWEEP_SPD = 0.55      // 스윙 속도

/* ---------------- 부화 페이즈 상수 ---------------- */
const DR_TEMP_MIN = 0
const DR_TEMP_MAX = 100
const DR_TEMP_LO = 55          // 적정 온도 구간
const DR_TEMP_HI = 70
const DR_HOLD_NEED = 5         // 적정 유지 필요 시간(초)
const DR_DRIFT = 4.5           // 자연 냉각 속도(초당)
const DR_FIRE_STEP = 13        // 화염석 1회
const DR_ICE_STEP = 11         // 만년설 1회

/* ---------------- 공중전 페이즈 상수 ---------------- */
const DR_SKY_X = 15            // 비행 가능 좌우
const DR_SKY_Y = 9             // 비행 가능 상하
const DR_FLY_SPD = 11
const DR_BREATH_SPD = 46
const DR_BREATH_CD = 0.18
const DR_ENEMY_SPD = 9
const DR_ORB_SPD = 15
const DR_SPAWN_EVERY = 1.45

/* ==================================================================
   드래곤 3D 모델 — 기본 도형 조합 (날개 퍼덕임 애니메이션 포함)
   ================================================================== */
function DragonModel({ color = '#c04a3c', belly = '#e6b980', scale = 1, flap = 1, glow = false, wingRef }) {
  const wingL = useRef(); const wingR = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const a = Math.sin(t * 6 * flap) * 0.55
    if (wingL.current) wingL.current.rotation.z = 0.35 + a
    if (wingR.current) wingR.current.rotation.z = -0.35 - a
    if (wingRef) wingRef.current = a
  })
  const skin = { color, roughness: 0.65, metalness: 0.1, emissive: glow ? color : '#000000', emissiveIntensity: glow ? 0.45 : 0 }
  return (
    <group scale={scale}>
      {/* 몸통 */}
      <mesh castShadow scale={[1, 0.95, 1.7]}><sphereGeometry args={[0.62, 18, 14]} /><meshStandardMaterial {...skin} /></mesh>
      {/* 배 */}
      <mesh position={[0, -0.22, 0.1]} scale={[0.7, 0.5, 1.3]}><sphereGeometry args={[0.55, 14, 12]} /><meshStandardMaterial color={belly} roughness={0.8} /></mesh>
      {/* 목 */}
      <mesh castShadow position={[0, 0.28, 0.86]} rotation-x={0.5}><cylinderGeometry args={[0.22, 0.3, 0.7, 10]} /><meshStandardMaterial {...skin} /></mesh>
      {/* 머리 */}
      <mesh castShadow position={[0, 0.5, 1.28]} scale={[0.85, 0.8, 1]}><sphereGeometry args={[0.36, 16, 12]} /><meshStandardMaterial {...skin} /></mesh>
      {/* 주둥이 */}
      <mesh castShadow position={[0, 0.4, 1.72]} rotation-x={Math.PI / 2} scale={[0.75, 1, 0.6]}><coneGeometry args={[0.22, 0.5, 8]} /><meshStandardMaterial {...skin} /></mesh>
      {/* 뿔 */}
      <mesh castShadow position={[-0.17, 0.78, 1.18]} rotation={[-0.5, 0, 0.4]}><coneGeometry args={[0.07, 0.36, 6]} /><meshStandardMaterial color="#f0e6d2" roughness={0.6} /></mesh>
      <mesh castShadow position={[0.17, 0.78, 1.18]} rotation={[-0.5, 0, -0.4]}><coneGeometry args={[0.07, 0.36, 6]} /><meshStandardMaterial color="#f0e6d2" roughness={0.6} /></mesh>
      {/* 눈 */}
      <mesh position={[-0.16, 0.58, 1.5]}><sphereGeometry args={[0.07, 10, 8]} /><meshStandardMaterial color="#ffe066" emissive="#ffcc00" emissiveIntensity={1.2} /></mesh>
      <mesh position={[0.16, 0.58, 1.5]}><sphereGeometry args={[0.07, 10, 8]} /><meshStandardMaterial color="#ffe066" emissive="#ffcc00" emissiveIntensity={1.2} /></mesh>
      {/* 날개 */}
      <group ref={wingL} position={[-0.5, 0.28, 0]}>
        <mesh castShadow position={[-0.75, 0, -0.1]} rotation={[0, 0.25, 0]} scale={[1, 0.12, 1]}>
          <coneGeometry args={[0.62, 1.7, 4]} /><meshStandardMaterial color={color} roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
        <mesh castShadow position={[-0.42, 0, 0]} rotation-z={1.5}><cylinderGeometry args={[0.05, 0.06, 0.9, 6]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
      </group>
      <group ref={wingR} position={[0.5, 0.28, 0]}>
        <mesh castShadow position={[0.75, 0, -0.1]} rotation={[0, -0.25, 0]} scale={[1, 0.12, 1]}>
          <coneGeometry args={[0.62, 1.7, 4]} /><meshStandardMaterial color={color} roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
        <mesh castShadow position={[0.42, 0, 0]} rotation-z={-1.5}><cylinderGeometry args={[0.05, 0.06, 0.9, 6]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
      </group>
      {/* 꼬리 */}
      <mesh castShadow position={[0, 0, -1.1]} rotation-x={-0.35}><cylinderGeometry args={[0.1, 0.28, 1.0, 8]} /><meshStandardMaterial {...skin} /></mesh>
      <mesh castShadow position={[0, 0.1, -1.7]} rotation-x={-0.35} scale={[1, 0.15, 1]}><coneGeometry args={[0.3, 0.55, 4]} /><meshStandardMaterial color={color} roughness={0.7} side={THREE.DoubleSide} /></mesh>
      {/* 다리 */}
      {[[-0.32, 0.5], [0.32, 0.5], [-0.32, -0.45], [0.32, -0.45]].map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, -0.5, z]}><cylinderGeometry args={[0.1, 0.09, 0.42, 6]} /><meshStandardMaterial {...skin} /></mesh>
      ))}
      {/* 등 가시 */}
      {[0.5, 0.1, -0.35, -0.75].map((z, i) => (
        <mesh key={i} castShadow position={[0, 0.55 - i * 0.03, z]} scale={[0.35, 1, 0.45]}>
          <coneGeometry args={[0.14, 0.3, 4]} /><meshStandardMaterial color="#f0e6d2" roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

/* ==================================================================
   PHASE 1 — 알 도둑 (쿼터뷰 잠입)
   ================================================================== */

/* 잠입 플레이어 — 작은 도둑 캐릭터 */
function ThiefModel({ crouch }) {
  return (
    <group scale={crouch ? 0.85 : 1}>
      <mesh castShadow position={[0, 0.32, 0]}><cylinderGeometry args={[0.17, 0.22, 0.62, 8]} /><meshStandardMaterial color="#2f3b52" roughness={0.8} /></mesh>
      <mesh castShadow position={[0, 0.78, 0]}><sphereGeometry args={[0.2, 12, 10]} /><meshStandardMaterial color="#e8c39a" roughness={0.75} /></mesh>
      <mesh castShadow position={[0, 0.86, 0]} scale={[1, 0.6, 1]}><sphereGeometry args={[0.22, 12, 10]} /><meshStandardMaterial color="#1f2937" roughness={0.85} /></mesh>
      <mesh position={[0, 0.76, 0.18]}><boxGeometry args={[0.26, 0.06, 0.04]} /><meshStandardMaterial color="#111827" /></mesh>
      <mesh castShadow position={[-0.24, 0.42, 0]} rotation-z={0.4}><cylinderGeometry args={[0.06, 0.06, 0.44, 6]} /><meshStandardMaterial color="#2f3b52" /></mesh>
      <mesh castShadow position={[0.24, 0.42, 0]} rotation-z={-0.4}><cylinderGeometry args={[0.06, 0.06, 0.44, 6]} /><meshStandardMaterial color="#2f3b52" /></mesh>
      <mesh castShadow position={[0, 0.5, -0.2]} scale={[0.8, 1, 0.35]}><sphereGeometry args={[0.2, 10, 8]} /><meshStandardMaterial color="#7c5f3f" roughness={0.9} /></mesh>
    </group>
  )
}

/* 어미 드래곤 — 자고 있음 (숨쉬기 애니메이션) */
function MotherDragon() {
  const g = useRef()
  useFrame((state) => {
    if (g.current) {
      const b = Math.sin(state.clock.elapsedTime * 0.9) * 0.06
      g.current.scale.set(1 + b * 0.3, 1 + b, 1 + b * 0.3)
    }
  })
  return (
    <group position={[DR_MOM.x, 0, DR_MOM.z]}>
      <group ref={g} position={[0, 2.4, 0]} scale={4.2}>
        <DragonModel color="#8b2f2a" belly="#c78a56" flap={0.12} />
      </group>
      {/* Zzz */}
      <Billboard position={[3, 7, 0]}>
        <mesh><planeGeometry args={[1.6, 0.9]} /><meshBasicMaterial color="#0b1020" transparent opacity={0.55} /></mesh>
      </Billboard>
    </group>
  )
}

/* 시야각 — 붉은 반투명 부채꼴, 좌우로 스윙 */
function VisionCone({ coneRef, alerted }) {
  const g = useRef()
  const fan = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const yaw = Math.sin(t * DR_SWEEP_SPD) * DR_SWEEP
    if (g.current) g.current.rotation.y = yaw
    if (coneRef) coneRef.current = yaw
    if (fan.current) fan.current.material.opacity = alerted ? 0.55 : 0.24 + Math.sin(t * 3) * 0.05
  })
  /* circleGeometry(thetaStart, thetaLength)로 부채꼴을 만들고 바닥에 눕힌다.
     기본 원판은 +X에서 시작하므로 중앙이 +Z(둥지 바깥)를 보도록 회전시킨다. */
  return (
    <group position={[DR_MOM.x, 0.06, DR_MOM.z + 3]}>
      <group ref={g}>
        <mesh ref={fan} rotation={[-Math.PI / 2, 0, -Math.PI / 2 - DR_CONE_HALF]}>
          <circleGeometry args={[DR_CONE_R, 40, 0, DR_CONE_HALF * 2]} />
          <meshBasicMaterial color={alerted ? '#ff2222' : '#ff4444'} transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        {/* 시야 경계선 */}
        <mesh rotation={[-Math.PI / 2, 0, -Math.PI / 2 - DR_CONE_HALF]} position={[0, 0.02, 0]}>
          <ringGeometry args={[DR_CONE_R - 0.25, DR_CONE_R, 40, 1, 0, DR_CONE_HALF * 2]} />
          <meshBasicMaterial color="#ff6666" transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

/* 빛나는 알 */
function GlowingEgg() {
  const g = useRef(); const ring = useRef()
  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1)
    const t = state.clock.elapsedTime
    if (g.current) { g.current.position.y = 0.75 + Math.sin(t * 1.6) * 0.12; g.current.rotation.y += dt * 0.6 }
    if (ring.current) { ring.current.rotation.z += dt * 1.2; ring.current.material.opacity = 0.5 + Math.sin(t * 2.4) * 0.2 }
  })
  return (
    <group position={[DR_EGG.x, 0, DR_EGG.z]}>
      <mesh position={[0, 0.1, 0]} receiveShadow><cylinderGeometry args={[1.5, 1.7, 0.2, 20]} /><meshStandardMaterial color="#5b4636" roughness={0.9} /></mesh>
      <group ref={g} position={[0, 0.75, 0]}>
        <mesh castShadow scale={[1, 1.35, 1]}>
          <sphereGeometry args={[0.5, 20, 16]} />
          <meshStandardMaterial color="#fff3c4" emissive="#ffd166" emissiveIntensity={1.1} roughness={0.3} />
        </mesh>
        <mesh ref={ring} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.9, 0.04, 8, 28]} /><meshBasicMaterial color="#ffe9a8" transparent opacity={0.6} />
        </mesh>
      </group>
      <pointLight position={[0, 1.2, 0]} color="#ffd166" intensity={11} distance={14} />
    </group>
  )
}

/* 둥지 바닥 · 바위 엄폐물 */
const DR_ROCKS = [
  [-8, 16], [7, 13], [-5, 6], [9, 2], [-11, -3], [4, -8], [-7, -14], [10, -12], [0, 10], [-2, -1],
]
function NestScenery() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[80, 90]} /><meshStandardMaterial color="#6b5744" roughness={1} /></mesh>
      {/* 둥지 테두리 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, -18]}>
        <ringGeometry args={[11, 13, 40]} /><meshStandardMaterial color="#4a3a2c" roughness={1} />
      </mesh>
      {DR_ROCKS.map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, 0.6, z]} rotation={[0.3, i, 0.2]} scale={1 + (i % 3) * 0.4}>
          <dodecahedronGeometry args={[0.8, 0]} /><meshStandardMaterial color="#7c6a55" roughness={0.95} />
        </mesh>
      ))}
      {/* 시작 지점 표시 */}
      <mesh rotation-x={-Math.PI / 2} position={[DR_START.x, 0.03, DR_START.z]}>
        <ringGeometry args={[1.1, 1.5, 24]} /><meshBasicMaterial color="#4ade80" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/* 잠입 플레이어 + 쿼터뷰 카메라 + 시야 판정 */
function ThiefPlayer({ live, coneRef, onCaught, onEgg }) {
  const root = useRef()
  const keys = useKeys()
  const camera = useThree((s) => s.camera)
  const vel = useMemo(() => new THREE.Vector3(), [])
  const want = useMemo(() => new THREE.Vector3(), [])
  const camGoal = useMemo(() => new THREE.Vector3(), [])
  const lookAt = useMemo(() => new THREE.Vector3(), [])
  const pos = useRef({ x: DR_START.x, z: DR_START.z })
  const yaw = useRef(Math.PI)
  const snapped = useRef(false)

  useFrame((_, rawDelta) => {
    const g = root.current
    if (!g) return
    const dt = Math.min(rawDelta, 0.1)
    const L = live.current
    const k = keys.current
    const P = pos.current

    /* 강제 귀환 */
    if (L.resetReq) {
      L.resetReq = false
      P.x = DR_START.x; P.z = DR_START.z
      vel.set(0, 0, 0); snapped.current = false
    }

    /* 쿼터뷰 고정축 이동 — W는 둥지 안쪽(-Z) */
    let ix = 0, iz = 0
    if (!L.frozen) {
      ix = clamp((k.r ? 1 : 0) - (k.l ? 1 : 0) + TOUCH.mx, -1, 1)
      iz = clamp((k.b ? 1 : 0) - (k.f ? 1 : 0) + TOUCH.my, -1, 1)
    }
    want.set(ix, 0, iz)
    const mag = Math.min(1, want.length())
    if (mag > 0.001) want.normalize().multiplyScalar((k.run || TOUCH.run ? DR_MOVE * 1.35 : DR_MOVE) * mag)
    else want.set(0, 0, 0)
    vel.lerp(want, damp(12, dt))
    P.x = clamp(P.x + vel.x * dt, -DR_FIELD_X, DR_FIELD_X)
    P.z = clamp(P.z + vel.z * dt, -DR_FIELD_Z, DR_FIELD_Z)
    if (vel.length() > 0.4) yaw.current = dampAngle(yaw.current, Math.atan2(vel.x, vel.z), 14, dt)

    g.position.set(P.x, 0, P.z)
    g.rotation.y = yaw.current
    L.px = P.x; L.pz = P.z
    L.moving = vel.length() > 0.5

    /* 시야 판정 — 콘 원점 기준 각도/거리 */
    if (!L.frozen) {
      const ox = DR_MOM.x, oz = DR_MOM.z + 3
      const dx = P.x - ox, dz = P.z - oz
      const d = Math.hypot(dx, dz)
      const coneYaw = coneRef.current || 0
      /* 콘 중앙이 +Z를 향하고 yaw만큼 회전 → 콘 방향 벡터 (sin,cos) */
      const ang = Math.atan2(dx, dz)
      const diff = Math.abs(angleDiff(ang, coneYaw))
      const seen = d < DR_CONE_R && diff < DR_CONE_HALF
      L.seen = seen
      if (seen) { L.frozen = true; onCaught() }
      /* 알 도달 */
      else if (Math.hypot(P.x - DR_EGG.x, P.z - DR_EGG.z) < 1.9) { L.frozen = true; onEgg() }
    }

    /* 쿼터뷰 카메라 — 고정 각도로 따라간다 */
    camGoal.set(P.x + 13, 17, P.z + 15)
    if (!snapped.current) { camera.position.copy(camGoal); snapped.current = true }
    else camera.position.lerp(camGoal, damp(5, dt))
    lookAt.set(P.x, 0.8, P.z)
    camera.lookAt(lookAt)
  })

  return (
    <group ref={root} position={[DR_START.x, 0, DR_START.z]}>
      <ThiefModel crouch={false} />
    </group>
  )
}

function DragonPhase1({ onClear, onExit }) {
  const isMobile = useIsMobile()
  const drSetVec = useCallback((x, y) => { TOUCH.mx = x; TOUCH.my = y }, [])
  const live = useRef({ px: DR_START.x, pz: DR_START.z, seen: false, frozen: false, resetReq: false, moving: false })
  const coneRef = useRef(0)
  const [alert, setAlert] = useState(false)
  const [caught, setCaught] = useState(0)
  const [, bump] = useState(0)

  const onCaught = useCallback(() => {
    setAlert(true)
    setCaught((c) => c + 1)
    setTimeout(() => {
      live.current.resetReq = true
      live.current.frozen = false
      live.current.seen = false
      setAlert(false)
      bump((n) => n + 1)
    }, 1300)
  }, [])

  const onEgg = useCallback(() => { onClear() }, [onClear])

  /* 남은 거리 표시용 — 8Hz */
  const [dist, setDist] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => {
      setDist(Math.hypot(live.current.px - DR_EGG.x, live.current.pz - DR_EGG.z))
    }, 130)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="fixed inset-0 select-none bg-slate-950">
      <Canvas shadows camera={{ fov: 46, near: 0.1, far: 220, position: [13, 17, 41] }}>
        <color attach="background" args={['#1a1526']} />
        <fog attach="fog" args={['#1a1526', 40, 110]} />
        <ambientLight intensity={0.55} />
        <hemisphereLight args={['#b9a3ff', '#3a2f22', 0.75]} />
        <directionalLight
          castShadow position={[18, 30, 20]} intensity={1.35}
          shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}
          shadow-camera-left={-45} shadow-camera-right={45}
          shadow-camera-top={45} shadow-camera-bottom={-45}
          shadow-camera-near={1} shadow-camera-far={110}
        />
        <NestScenery />
        <MotherDragon />
        <VisionCone coneRef={coneRef} alerted={alert} />
        <GlowingEgg />
        <ThiefPlayer live={live} coneRef={coneRef} onCaught={onCaught} onEgg={onEgg} />
      </Canvas>

      {/* HUD */}
      <div className="pointer-events-none absolute left-1/2 top-4 w-[min(94vw,34rem)] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/55 px-5 py-3 text-center backdrop-blur-sm">
        <div className="text-[11px] tracking-[0.3em] text-rose-300/80">PHASE 1 · 알 도둑</div>
        <div className="mt-1 text-sm text-white">어미 드래곤의 <b className="text-rose-300">붉은 시야</b>를 피해 빛나는 알에 닿으세요</div>
        <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-slate-300">
          <span>알까지 <b className="text-amber-300">{dist.toFixed(1)}m</b></span>
          <span>발각 <b className="text-rose-300">{caught}</b>회</span>
        </div>
      </div>

      <div className={`pointer-events-none absolute rounded-xl bg-black/50 px-3 py-2 text-[11px] leading-relaxed text-white/75 ${isMobile ? 'bottom-4 right-4 max-w-[46vw] text-right' : 'bottom-4 left-4'}`}>
        {isMobile
          ? <>왼쪽 <b>조이스틱</b>으로 이동<br />바위 뒤도 안전하지 않습니다 — 시야각을 피하세요</>
          : <><b>W</b> 전진(둥지 안쪽) · <b>S</b> 후퇴 · <b>A/D</b> 좌우 · <b>Shift</b> 질주<br />바위 뒤는 안전하지 않습니다 — 시야각 자체를 피하세요</>}
      </div>

      {isMobile && (
        <div className="absolute bottom-6 left-5 z-40">
          <VirtualJoystick size={124} onVec={drSetVec} />
        </div>
      )}

      <button data-ui onClick={onExit}
        className="absolute bottom-4 right-4 rounded-full border border-white/15 bg-slate-900/85 px-4 py-2 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-slate-800">
        ← 로비
      </button>

      {/* 발각 연출 */}
      {alert && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="absolute inset-0 bg-red-600/30" />
          <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 180px 50px rgba(220,38,38,0.9)' }} />
          <div className="relative rounded-3xl border border-red-400/50 bg-black/80 px-10 py-6 text-center [animation:pop_.35s_cubic-bezier(.2,1.6,.4,1)]">
            <div className="text-5xl">👁️</div>
            <div className="mt-2 text-3xl font-black text-red-400">발각되었습니다!</div>
            <div className="mt-1 text-sm text-slate-300">시작 지점으로 돌아갑니다...</div>
          </div>
        </div>
      )}
      <style>{`@keyframes pop { from { transform: scale(1.7) } to { transform: scale(1) } }`}</style>
    </div>
  )
}

/* ==================================================================
   PHASE 2 — 부화장 (HTML 육성 UI)
   화염석/만년설로 적정 온도(55~70)를 5초간 유지하면 부화
   ================================================================== */
function DragonPhase2({ onHatched, onExit }) {
  const [temp, setTemp] = useState(28)
  const [hold, setHold] = useState(0)
  const [hatched, setHatched] = useState(false)
  const [spec, setSpec] = useState(null)
  const tempRef = useRef(28)
  const holdRef = useRef(0)
  const doneRef = useRef(false)
  tempRef.current = temp

  /* 자연 냉각 + 적정 구간 유지 시간 누적 (100ms 틱) */
  useEffect(() => {
    const iv = setInterval(() => {
      if (doneRef.current) return
      const dt = 0.1
      setTemp((t) => {
        const nt = clamp(t - DR_DRIFT * dt, DR_TEMP_MIN, DR_TEMP_MAX)
        const inRange = nt >= DR_TEMP_LO && nt <= DR_TEMP_HI
        holdRef.current = inRange ? holdRef.current + dt : Math.max(0, holdRef.current - dt * 1.6)
        setHold(holdRef.current)
        if (holdRef.current >= DR_HOLD_NEED && !doneRef.current) {
          doneRef.current = true
          /* 부화 스펙 — 유지 정확도에 따라 살짝 달라진다 */
          const hp = 100 + Math.floor(Math.random() * 60)
          const spd = 10 + Math.floor(Math.random() * 8)
          const pow = 18 + Math.floor(Math.random() * 12)
          setSpec({ hp, spd, pow })
          setHatched(true)
        }
        return nt
      })
    }, 100)
    return () => clearInterval(iv)
  }, [])

  const heat = () => { if (!doneRef.current) setTemp((t) => clamp(t + DR_FIRE_STEP, DR_TEMP_MIN, DR_TEMP_MAX)) }
  const cool = () => { if (!doneRef.current) setTemp((t) => clamp(t - DR_ICE_STEP, DR_TEMP_MIN, DR_TEMP_MAX)) }

  const inRange = temp >= DR_TEMP_LO && temp <= DR_TEMP_HI
  const pct = (temp / DR_TEMP_MAX) * 100
  const loPct = (DR_TEMP_LO / DR_TEMP_MAX) * 100
  const hiPct = (DR_TEMP_HI / DR_TEMP_MAX) * 100
  const holdPct = Math.min(100, (hold / DR_HOLD_NEED) * 100)

  return (
    <div className="fixed inset-0 overflow-y-auto bg-gradient-to-b from-[#1b1026] via-[#241634] to-[#0d0913]">
      <div className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(255,180,80,.18), transparent 60%)' }} />
      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-5 py-10">
        <div className="text-[11px] tracking-[0.4em] text-amber-300/70">PHASE 2 · 부화장</div>
        <h2 className="mt-2 text-3xl font-black text-white">훔쳐 온 알을 부화시켜라</h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          <b className="text-orange-300">화염석</b>과 <b className="text-sky-300">만년설</b>로 온도를 조절해<br />
          적정 구간(<b className="text-emerald-300">{DR_TEMP_LO}~{DR_TEMP_HI}℃</b>)에서 <b className="text-emerald-300">{DR_HOLD_NEED}초</b>간 유지하세요
        </p>

        {/* 알 비주얼 */}
        <div className="relative mt-8 flex h-48 w-40 items-center justify-center">
          <div className="absolute inset-0 rounded-[50%_50%_45%_45%/60%_60%_40%_40%] transition-all duration-300"
            style={{
              background: hatched
                ? 'radial-gradient(circle at 40% 35%, #fff6d5, #ffb347 60%, #b45309)'
                : `radial-gradient(circle at 40% 35%, #fff3c4, ${inRange ? '#ffcc66' : '#c9bda0'} 60%, #6b5636)`,
              boxShadow: inRange || hatched
                ? '0 0 60px 12px rgba(255,180,80,.55)'
                : '0 0 24px 4px rgba(0,0,0,.5)',
              transform: hatched ? 'scale(1.06)' : `scale(${1 + (inRange ? Math.min(0.05, hold * 0.01) : 0)})`,
            }} />
          {/* 균열 */}
          {hold > DR_HOLD_NEED * 0.5 && !hatched && (
            <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-70">⚡</div>
          )}
          {hatched && <div className="relative text-6xl">🐉</div>}
        </div>

        {!hatched ? (
          <>
            {/* 온도 게이지 */}
            <div className="mt-8 w-full max-w-md">
              <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>0℃</span>
                <span className={inRange ? 'font-black text-emerald-300' : 'font-bold text-white'}>
                  현재 {temp.toFixed(1)}℃ {inRange ? '· 적정!' : temp < DR_TEMP_LO ? '· 너무 차갑다' : '· 너무 뜨겁다'}
                </span>
                <span>100℃</span>
              </div>
              <div className="relative h-7 overflow-hidden rounded-full border border-white/15 bg-black/50">
                {/* 적정 구간 */}
                <div className="absolute inset-y-0 bg-emerald-500/25"
                  style={{ left: `${loPct}%`, width: `${hiPct - loPct}%` }} />
                <div className="absolute inset-y-0 w-[2px] bg-emerald-400/70" style={{ left: `${loPct}%` }} />
                <div className="absolute inset-y-0 w-[2px] bg-emerald-400/70" style={{ left: `${hiPct}%` }} />
                {/* 현재 온도 */}
                <div className="h-full transition-[width] duration-100"
                  style={{ width: `${pct}%`, background: inRange ? 'linear-gradient(90deg,#34d399,#10b981)' : 'linear-gradient(90deg,#60a5fa,#f97316)' }} />
                <div className="absolute inset-y-0 w-1 bg-white shadow-lg transition-[left] duration-100" style={{ left: `calc(${pct}% - 2px)` }} />
              </div>

              {/* 유지 게이지 */}
              <div className="mt-4 mb-1 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">부화 진행도</span>
                <span className="font-bold text-emerald-300">{hold.toFixed(1)} / {DR_HOLD_NEED}초</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full border border-white/10 bg-black/50">
                <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-[width] duration-100"
                  style={{ width: `${holdPct}%` }} />
              </div>
            </div>

            {/* 조작 버튼 */}
            <div className="mt-7 flex gap-4">
              <button onClick={heat}
                className="group rounded-2xl border border-orange-400/40 bg-gradient-to-b from-orange-500/25 to-red-600/25 px-8 py-5 text-center transition hover:brightness-125 active:scale-95">
                <div className="text-4xl">🔥</div>
                <div className="mt-1 text-sm font-black text-orange-200">화염석</div>
                <div className="text-[11px] text-orange-300/70">온도 +{DR_FIRE_STEP}℃</div>
              </button>
              <button onClick={cool}
                className="group rounded-2xl border border-sky-400/40 bg-gradient-to-b from-sky-500/25 to-blue-600/25 px-8 py-5 text-center transition hover:brightness-125 active:scale-95">
                <div className="text-4xl">❄️</div>
                <div className="mt-1 text-sm font-black text-sky-200">만년설</div>
                <div className="text-[11px] text-sky-300/70">온도 −{DR_ICE_STEP}℃</div>
              </button>
            </div>
            <div className="mt-3 text-[11px] text-slate-500">※ 온도는 시간이 지나면 자연히 식습니다 (초당 −{DR_DRIFT}℃)</div>
          </>
        ) : (
          <>
            {/* 부화 완료 — 스펙 표시 */}
            <div className="mt-8 w-full max-w-sm rounded-3xl border border-amber-400/30 bg-black/45 p-6 text-center [animation:pop_.4s_cubic-bezier(.2,1.6,.4,1)]">
              <div className="text-[11px] tracking-[0.3em] text-amber-300/80">HATCHED</div>
              <div className="mt-1 text-2xl font-black text-white">새끼 드래곤이 부화했다!</div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-[10px] text-slate-400">체력</div>
                  <div className="text-xl font-black text-emerald-300">{spec.hp}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-[10px] text-slate-400">스피드</div>
                  <div className="text-xl font-black text-sky-300">{spec.spd}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-[10px] text-slate-400">화력</div>
                  <div className="text-xl font-black text-orange-300">{spec.pow}</div>
                </div>
              </div>
              <button onClick={() => onHatched(spec)}
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 py-4 text-lg font-black text-white transition hover:brightness-110 active:scale-[0.98]">
                🐉 비행 시작
              </button>
            </div>
          </>
        )}

        <button onClick={onExit}
          className="mt-8 rounded-full border border-white/15 bg-slate-900/70 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800">
          ← 로비
        </button>
      </div>
      <style>{`@keyframes pop { from { transform: scale(1.7) } to { transform: scale(1) } }`}</style>
    </div>
  )
}

/* ==================================================================
   PHASE 3 — 공중전 (3인칭 백뷰 도그파이트)
   ================================================================== */

/* 구름 — 지나가는 배경 (속도감) */
function SkyClouds({ live }) {
  const meshes = useRef([])
  const data = useMemo(() => Array.from({ length: 26 }, () => ({
    x: (Math.random() * 2 - 1) * 46,
    y: (Math.random() * 2 - 1) * 20,
    z: -Math.random() * 200,
    s: 3 + Math.random() * 7,
  })), [])
  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1)
    for (let i = 0; i < data.length; i++) {
      const d = data[i]
      d.z += (34 + live.current.speed * 1.4) * dt
      if (d.z > 24) { d.z = -200 - Math.random() * 40; d.x = (Math.random() * 2 - 1) * 46; d.y = (Math.random() * 2 - 1) * 20 }
      const m = meshes.current[i]
      if (m) { m.position.set(d.x, d.y, d.z); m.scale.setScalar(d.s) }
    }
  })
  return (
    <group>
      {data.map((_, i) => (
        <mesh key={i} ref={(el) => { meshes.current[i] = el }}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.5} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

/* 플레이어 드래곤 — WASD 이동 + 마우스 조준 + TPS 카메라 */
function RiderDragon({ live, spec }) {
  const root = useRef()
  const keys = useKeys()
  const camera = useThree((s) => s.camera)
  const camGoal = useMemo(() => new THREE.Vector3(), [])
  const lookAt = useMemo(() => new THREE.Vector3(), [])
  const snapped = useRef(false)

  useFrame((_, rawDelta) => {
    const g = root.current
    if (!g) return
    const dt = Math.min(rawDelta, 0.1)
    const L = live.current
    const k = keys.current
    if (L.over) return

    const spd = DR_FLY_SPD + spec.spd * 0.35
    const ix = clamp((k.r ? 1 : 0) - (k.l ? 1 : 0) + TOUCH.mx, -1, 1)
    const iy = clamp((k.f ? 1 : 0) - (k.b ? 1 : 0) - TOUCH.my, -1, 1)   // W / 조이스틱 위 = 상승
    L.vx = lerp(L.vx, ix * spd, damp(9, dt))
    L.vy = lerp(L.vy, iy * spd, damp(9, dt))
    L.x = clamp(L.x + L.vx * dt, -DR_SKY_X, DR_SKY_X)
    L.y = clamp(L.y + L.vy * dt, -DR_SKY_Y, DR_SKY_Y)
    L.speed = Math.hypot(L.vx, L.vy)

    /* 마우스 조준 — 화면 좌표를 월드 방향으로 */
    const aimX = L.mx * 9
    const aimY = L.my * 6
    L.aimX = aimX; L.aimY = aimY

    /* 기체 자세 — 이동/조준에 따라 롤·피치 */
    g.position.set(L.x, L.y, 0)
    g.rotation.z = lerp(g.rotation.z, -L.vx * 0.055, damp(8, dt))
    g.rotation.x = lerp(g.rotation.x, -L.vy * 0.03, damp(8, dt))
    g.rotation.y = lerp(g.rotation.y, (aimX - L.x) * 0.012, damp(6, dt))

    /* 피격 흔들림 */
    if (L.shake > 0) {
      L.shake = Math.max(0, L.shake - dt * 2.6)
      g.position.x += (Math.random() - 0.5) * L.shake
      g.position.y += (Math.random() - 0.5) * L.shake
    }

    /* TPS 백뷰 카메라 */
    camGoal.set(L.x * 0.42, L.y * 0.5 + 2.6, 12.5)
    if (!snapped.current) { camera.position.copy(camGoal); snapped.current = true }
    else camera.position.lerp(camGoal, damp(6, dt))
    lookAt.set(L.x * 0.7 + aimX * 0.12, L.y * 0.8 + aimY * 0.1, -14)
    camera.lookAt(lookAt)
  })

  return (
    <group ref={root}>
      <group scale={1.15} rotation-y={Math.PI}>
        <DragonModel color="#4ea8de" belly="#cfe9ff" flap={1.5} glow />
      </group>
      <pointLight position={[0, 0, 2]} color="#7dd3fc" intensity={4} distance={9} />
    </group>
  )
}

/* 화염 브레스 · 적 · 적탄 풀 렌더러 */
const DR_BREATH_MAX = 40
const DR_ENEMY_MAX = 14
const DR_ORB_MAX = 40

function DogfightPool({ live }) {
  const bMesh = useRef([]); const eMesh = useRef([]); const oMesh = useRef([])
  useFrame((state) => {
    const L = live.current
    const t = state.clock.elapsedTime
    for (let i = 0; i < DR_BREATH_MAX; i++) {
      const m = bMesh.current[i]; if (!m) continue
      const b = L.breaths[i]
      if (b) { m.visible = true; m.position.set(b.x, b.y, b.z); m.scale.setScalar(0.5 + Math.sin(t * 22 + i) * 0.12) }
      else m.visible = false
    }
    for (let i = 0; i < DR_ENEMY_MAX; i++) {
      const g = eMesh.current[i]; if (!g) continue
      const e = L.enemies[i]
      if (e) {
        g.visible = true
        g.position.set(e.x, e.y, e.z)
        g.rotation.z = Math.sin(t * 2 + i) * 0.2
        g.scale.setScalar(e.hp > 0 ? 1 : Math.max(0.01, 1 + e.dieT * 2))
      } else g.visible = false
    }
    for (let i = 0; i < DR_ORB_MAX; i++) {
      const m = oMesh.current[i]; if (!m) continue
      const o = L.orbs[i]
      if (o) { m.visible = true; m.position.set(o.x, o.y, o.z); m.scale.setScalar(0.42 + Math.sin(t * 16 + i) * 0.08) }
      else m.visible = false
    }
  })
  return (
    <group>
      {Array.from({ length: DR_BREATH_MAX }, (_, i) => (
        <mesh key={'b' + i} ref={(el) => { bMesh.current[i] = el }} visible={false}>
          <sphereGeometry args={[0.42, 10, 8]} />
          <meshStandardMaterial color="#ffb703" emissive="#ff6b00" emissiveIntensity={2} roughness={0.3} />
        </mesh>
      ))}
      {Array.from({ length: DR_ENEMY_MAX }, (_, i) => (
        <group key={'e' + i} ref={(el) => { eMesh.current[i] = el }} visible={false}>
          <DragonModel color="#8b2f6a" belly="#d8a0c8" scale={1.05} flap={1.8} />
        </group>
      ))}
      {Array.from({ length: DR_ORB_MAX }, (_, i) => (
        <mesh key={'o' + i} ref={(el) => { oMesh.current[i] = el }} visible={false}>
          <sphereGeometry args={[0.44, 10, 8]} />
          <meshStandardMaterial color="#ff3b3b" emissive="#ff0000" emissiveIntensity={1.8} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

/* 공중전 시뮬레이션 — 스폰·이동·충돌 */
function DogfightLogic({ live, bumpHud, onOver }) {
  const acc = useRef(0)
  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1)
    const L = live.current
    if (L.over) return
    L.time += dt
    L.spawnT -= dt
    L.cd = Math.max(0, L.cd - dt)

    /* 난이도: 시간이 지날수록 자주·빠르게 */
    const wave = 1 + L.time / 45

    /* 적 스폰 */
    if (L.spawnT <= 0 && L.enemies.filter(Boolean).length < DR_ENEMY_MAX) {
      L.spawnT = DR_SPAWN_EVERY / wave
      const idx = L.enemies.findIndex((e) => !e)
      if (idx >= 0) {
        L.enemies[idx] = {
          x: (Math.random() * 2 - 1) * (DR_SKY_X - 2),
          y: (Math.random() * 2 - 1) * (DR_SKY_Y - 2),
          z: -150 - Math.random() * 40,
          hp: 3, dieT: 0, fireT: 0.8 + Math.random() * 1.4,
        }
      }
    }

    /* 화염 브레스 발사 */
    if (L.firing && L.cd <= 0) {
      L.cd = DR_BREATH_CD
      const idx = L.breaths.findIndex((b) => !b)
      if (idx >= 0) {
        const dx = (L.aimX - L.x) * 0.06
        const dy = (L.aimY - L.y) * 0.06
        L.breaths[idx] = { x: L.x, y: L.y, z: -1.5, vx: dx * 12, vy: dy * 12, life: 2.6 }
      }
    }

    /* 브레스 이동 · 적중 */
    for (let i = 0; i < L.breaths.length; i++) {
      const b = L.breaths[i]; if (!b) continue
      b.x += b.vx * dt; b.y += b.vy * dt; b.z -= DR_BREATH_SPD * dt; b.life -= dt
      let hit = false
      for (let j = 0; j < L.enemies.length; j++) {
        const e = L.enemies[j]
        if (!e || e.hp <= 0) continue
        if (Math.hypot(b.x - e.x, b.y - e.y) < 1.5 && Math.abs(b.z - e.z) < 2.4) {
          e.hp -= 1
          hit = true
          if (e.hp <= 0) {
            e.dieT = 0
            L.score += 100
            L.kills += 1
            bumpHud()
          }
          break
        }
      }
      if (hit || b.life <= 0 || b.z < -170) L.breaths[i] = null
    }

    /* 적 이동 · 사격 · 충돌 */
    for (let i = 0; i < L.enemies.length; i++) {
      const e = L.enemies[i]; if (!e) continue
      if (e.hp <= 0) {
        e.dieT -= dt * 1.6
        e.z += (DR_ENEMY_SPD * 0.5) * dt
        if (e.dieT < -0.5) L.enemies[i] = null
        continue
      }
      e.z += (DR_ENEMY_SPD * wave) * dt
      /* 플레이어 쪽으로 살짝 유도 */
      e.x += clamp((L.x - e.x) * 0.25, -3, 3) * dt
      e.y += clamp((L.y - e.y) * 0.25, -3, 3) * dt
      /* 사격 */
      e.fireT -= dt
      if (e.fireT <= 0 && e.z > -110 && e.z < -6) {
        e.fireT = 1.4 + Math.random() * 1.6
        const idx = L.orbs.findIndex((o) => !o)
        if (idx >= 0) {
          const d = Math.max(1, Math.hypot(L.x - e.x, L.y - e.y, -e.z))
          L.orbs[idx] = {
            x: e.x, y: e.y, z: e.z,
            vx: ((L.x - e.x) / d) * DR_ORB_SPD * 0.5,
            vy: ((L.y - e.y) / d) * DR_ORB_SPD * 0.5,
            vz: DR_ORB_SPD, life: 6,
          }
        }
      }
      /* 적 본체 충돌 */
      if (Math.abs(e.z) < 1.8 && Math.hypot(L.x - e.x, L.y - e.y) < 1.8) {
        e.hp = 0; e.dieT = 0
        L.hp -= 18; L.shake = 0.7; bumpHud()
      }
      if (e.z > 16) L.enemies[i] = null
    }

    /* 적탄 이동 · 피격 */
    for (let i = 0; i < L.orbs.length; i++) {
      const o = L.orbs[i]; if (!o) continue
      o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt; o.life -= dt
      if (Math.abs(o.z) < 1.4 && Math.hypot(L.x - o.x, L.y - o.y) < 1.3) {
        L.hp -= 10; L.shake = 0.5; L.orbs[i] = null; bumpHud()
        continue
      }
      if (o.life <= 0 || o.z > 18) L.orbs[i] = null
    }

    /* 생존 점수 */
    L.score += dt * 6

    if (L.hp <= 0 && !L.over) { L.hp = 0; L.over = true; onOver(Math.floor(L.score), L.kills, L.time) }

    acc.current += dt
    if (acc.current >= 0.1) { acc.current = 0; bumpHud() }
  })
  return null
}

function DragonPhase3({ spec, onExit, onRestart }) {
  const isMobile = useIsMobile()
  const flySetVec = useCallback((x, y) => { TOUCH.mx = x; TOUCH.my = y }, [])
  const live = useRef({
    x: 0, y: 0, vx: 0, vy: 0, speed: 0, mx: 0, my: 0, aimX: 0, aimY: 0,
    hp: spec.hp, maxHp: spec.hp, score: 0, kills: 0, time: 0,
    breaths: Array(DR_BREATH_MAX).fill(null),
    enemies: Array(DR_ENEMY_MAX).fill(null),
    orbs: Array(DR_ORB_MAX).fill(null),
    firing: false, cd: 0, spawnT: 1.2, shake: 0, over: false,
  })
  const [, setTick] = useState(0)
  const bumpHud = useCallback(() => setTick((t) => t + 1), [])
  const [over, setOver] = useState(null)

  const onOver = useCallback((score, kills, time) => {
    setOver({ score, kills, time: Math.floor(time) })
  }, [])

  /* 마우스 조준 + 좌클릭 발사 */
  useEffect(() => {
    /* 터치는 화면을 누르는 동안 조준 + 발사. 조이스틱 터치와 섞이지 않게 ID로 구분 */
    const aim = { id: null }
    const setAim = (e) => {
      live.current.mx = (e.clientX / window.innerWidth) * 2 - 1
      live.current.my = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    const onMove = (e) => {
      if (e.pointerType === 'touch' && aim.id !== e.pointerId) return
      setAim(e)
    }
    const onDown = (e) => {
      if (e.target.closest && e.target.closest('[data-ui]')) return
      const touch = e.pointerType === 'touch'
      if (!touch && e.button !== 0) return
      if (touch) { aim.id = e.pointerId; setAim(e) }
      live.current.firing = true
    }
    const onUp = (e) => {
      if (e.pointerType === 'touch') {
        if (aim.id !== e.pointerId) return
        aim.id = null
      } else if (e.button !== 0) return
      live.current.firing = false
    }
    const onContext = (e) => e.preventDefault()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('contextmenu', onContext)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('contextmenu', onContext)
    }
  }, [])

  const L = live.current
  const hpPct = clamp(L.hp / L.maxHp, 0, 1)

  return (
    <div className="fixed inset-0 select-none">
      <Canvas shadows camera={{ fov: 62, near: 0.1, far: 400, position: [0, 3, 13] }}>
        <color attach="background" args={['#7cc7f5']} />
        <fog attach="fog" args={['#9fd8fb', 60, 220]} />
        <ambientLight intensity={0.8} />
        <hemisphereLight args={['#ffffff', '#7cc7f5', 0.9]} />
        <directionalLight castShadow position={[12, 22, 10]} intensity={1.5} />
        <SkyClouds live={live} />
        <RiderDragon live={live} spec={spec} />
        <DogfightPool live={live} />
        <DogfightLogic live={live} bumpHud={bumpHud} onOver={onOver} />
      </Canvas>

      {/* 조준점 */}
      {!over && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute h-8 w-8 rounded-full border-2 border-orange-300/80"
            style={{ left: `calc(${((L.mx + 1) / 2) * 100}% - 16px)`, top: `calc(${((1 - L.my) / 2) * 100}% - 16px)` }} />
          <div className="absolute h-1.5 w-1.5 rounded-full bg-white"
            style={{ left: `calc(${((L.mx + 1) / 2) * 100}% - 3px)`, top: `calc(${((1 - L.my) / 2) * 100}% - 3px)` }} />
        </div>
      )}

      {/* 피격 비네트 */}
      <div className="pointer-events-none absolute inset-0 transition-opacity duration-150"
        style={{ boxShadow: 'inset 0 0 150px 40px rgba(220,38,38,0.85)', opacity: Math.min(0.85, L.shake * 1.2) }} />

      {/* HUD */}
      <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-white/15 bg-black/45 px-4 py-3 backdrop-blur-sm">
        <div className="text-[11px] tracking-[0.3em] text-sky-200/80">PHASE 3 · 공중전</div>
        <div className="mt-1 w-52">
          <div className="mb-1 flex justify-between text-[11px] text-white">
            <span>체력</span><span className="font-bold">{Math.max(0, Math.ceil(L.hp))} / {L.maxHp}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full border border-white/15 bg-black/50">
            <div className="h-full transition-[width] duration-150"
              style={{ width: `${hpPct * 100}%`, background: hpPct > 0.4 ? 'linear-gradient(90deg,#4ade80,#22c55e)' : 'linear-gradient(90deg,#f97316,#ef4444)' }} />
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute right-4 top-4 rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-right backdrop-blur-sm">
        <div className="text-2xl font-black text-amber-300">{Math.floor(L.score).toLocaleString()}</div>
        <div className="text-[11px] text-slate-300">격추 {L.kills} · 생존 {Math.floor(L.time)}초</div>
      </div>

      <div className={`pointer-events-none absolute rounded-xl bg-black/45 px-3 py-2 text-[11px] leading-relaxed text-white/80 ${isMobile ? 'bottom-4 right-4 max-w-[46vw] text-right' : 'bottom-4 left-4'}`}>
        {isMobile
          ? <>왼쪽 <b>조이스틱</b>으로 비행<br />오른쪽 화면을 <b>누른 채 움직이면</b> 조준 + 브레스 발사</>
          : <><b>W/S</b> 상승·하강 · <b>A/D</b> 좌우 · <b>마우스</b> 조준 · <b>좌클릭</b> 화염 브레스<br />붉은 구체와 적 드래곤을 피하세요</>}
      </div>

      {isMobile && !over && (
        <div className="absolute bottom-6 left-5 z-40">
          <VirtualJoystick size={124} onVec={flySetVec} tint="rgba(125,211,252,.8)" />
        </div>
      )}

      <button data-ui onClick={onExit}
        className="absolute bottom-4 right-4 rounded-full border border-white/15 bg-slate-900/80 px-4 py-2 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-slate-800">
        ← 로비
      </button>

      {/* 게임 오버 */}
      {over && (
        <div data-ui className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-[22rem] rounded-3xl border border-rose-500/40 bg-slate-900 p-7 text-center shadow-2xl [animation:pop_.4s_cubic-bezier(.2,1.6,.4,1)]">
            <div className="text-6xl">💥</div>
            <div className="mt-3 text-2xl font-black text-rose-400">격추당했다!</div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-[10px] text-slate-400">점수</div>
                <div className="text-lg font-black text-amber-300">{over.score.toLocaleString()}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-[10px] text-slate-400">격추</div>
                <div className="text-lg font-black text-sky-300">{over.kills}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-[10px] text-slate-400">생존</div>
                <div className="text-lg font-black text-emerald-300">{over.time}초</div>
              </div>
            </div>
            <button onClick={onRestart}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 py-3 font-black text-white transition hover:brightness-110">
              🔄 처음부터 다시
            </button>
            <button onClick={onExit}
              className="mt-2 w-full rounded-xl border border-white/15 py-3 font-bold text-slate-200 transition hover:bg-white/5">
              ← 로비로
            </button>
          </div>
        </div>
      )}
      <style>{`@keyframes pop { from { transform: scale(1.7) } to { transform: scale(1) } }`}</style>
    </div>
  )
}

/* ==================================================================
   Dragon Rider 페이즈 컨트롤러
   ================================================================== */
function DragonGame() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState(1)
  const [spec, setSpec] = useState(null)
  const exit = useCallback(() => navigate('/'), [navigate])
  const restart = useCallback(() => { setSpec(null); setPhase(1) }, [])

  if (phase === 1) return <DragonPhase1 onClear={() => setPhase(2)} onExit={exit} />
  if (phase === 2) return <DragonPhase2 onHatched={(sp) => { setSpec(sp); setPhase(3) }} onExit={exit} />
  return <DragonPhase3 spec={spec || { hp: 120, spd: 12, pow: 20 }} onExit={exit} onRestart={restart} />
}

/* ==================================================================
   ==================================================================
   [ 포털 ] My 3D Game Universe — 로비 & 라우팅
   ==================================================================
   ================================================================== */

/* 로비 배경 별 — 3D 캔버스 없이 CSS만 사용 */
const LOBBY_STARS = Array.from({ length: 60 }, (_, i) => ({
  left: (i * 37.7) % 100,
  top: (i * 61.3) % 100,
  size: 1 + (i % 3),
  delay: (i % 7) * 0.45,
}))



/* ==================================================================
   ==================================================================
   [ 게임 3 ] Tower of Trials — 3D 점프맵 (로블록스식 오비)
   WASD 이동 · Space 점프 · 우클릭 드래그 카메라 · R 체크포인트 복귀
   ==================================================================
   ================================================================== */

/* ---------------- 물리 상수 ---------------- */
const TW_GRAVITY = 30
const TW_JUMP_V = 12.2          // 점프 높이 ≈ 2.48, 체공 ≈ 0.81s
const TW_MOVE = 7.2             // 도달 거리 ≈ 5.8
const TW_RUN = 9.8
const TW_ACCEL_GROUND = 70
const TW_ACCEL_AIR = 22
const TW_MAX_FALL = -34
const TW_COYOTE = 0.12          // 발판을 벗어난 뒤에도 점프 허용 시간
const TW_BUFFER = 0.13          // 착지 직전 점프 입력 보관 시간
const TW_PR = 0.42              // 플레이어 반폭
const TW_PH = 1.8               // 플레이어 키
const TW_VOID_Y = -16           // 이 아래로 떨어지면 체크포인트 복귀
const TW_SUBSTEP = 1 / 120      // 물리 서브스텝 (관통 방지)

const LS_TOWER = 'tower_of_trials_v1'

/* ==================================================================
   타워 설계 — 중심축을 둘러싼 나선형 8스테이지
   ================================================================== */
function buildTower() {
  const plats = []
  let id = 0
  let ang = -0.5
  let y = 0

  const add = (o) => {
    const p = {
      id: id++, w: 4, h: 0.7, d: 4, type: 'static',
      color: '#60a5fa', x: 0, y: 0, z: 0, ...o,
    }
    plats.push(p)
    return p
  }

  /* 나선 링 — n개 발판을 각도/높이를 올리며 배치.
     체크포인트 발판은 넉넉하고 항상 고정(움직이지 않는다). */
  const ring = (n, opts = {}) => {
    const { r = 8, dAng = 0.6, rise = 1.8, cp, ...rest } = opts
    for (let i = 0; i < n; i++) {
      ang += dAng
      y += rise
      const base = { x: Math.cos(ang) * r, y, z: Math.sin(ang) * r }
      if (i === 0 && cp) {
        add({
          ...base, ...rest,
          w: (rest.w || 4) + 1.5, d: (rest.d || 4) + 1.5,
          type: 'static', cp,
        })
      } else {
        add({ ...base, ...rest })
      }
    }
  }

  /* ── 출발 ── */
  add({ x: 0, y: 0, z: 0, w: 15, h: 1.2, d: 15, color: '#4ade80', cp: '출발점' })

  /* ── 1. 첫 걸음 ── */
  ring(6, { r: 8, dAng: 0.62, rise: 1.7, w: 4.4, d: 4.4, color: '#60a5fa', cp: '첫 걸음' })

  /* ── 2. 좁은 길 ── */
  ring(6, { r: 8.4, dAng: 0.6, rise: 1.8, w: 2.5, d: 2.5, color: '#38bdf8', cp: '좁은 길' })

  /* ── 3. 흔들다리 (좌우 이동) ── */
  ring(6, {
    r: 9, dAng: 0.58, rise: 1.8, w: 3.4, d: 3.4, color: '#a78bfa',
    type: 'moveX', amp: 2.6, speed: 1.05, cp: '흔들다리',
  })

  /* ── 4. 디딤돌 (초소형) ── */
  ring(6, { r: 8, dAng: 0.58, rise: 1.75, w: 2.1, d: 2.1, color: '#f472b6', cp: '디딤돌' })

  /* ── 5. 승강기 (상하 이동) ── */
  ring(6, {
    r: 8.4, dAng: 0.58, rise: 1.7, w: 3.2, d: 3.2, color: '#34d399',
    type: 'moveY', amp: 1.0, speed: 0.85, cp: '승강기',
  })

  /* ── 6. 점멸 (사라지는 발판) ── */
  ring(6, {
    r: 8.4, dAng: 0.58, rise: 1.75, w: 3.3, d: 3.3, color: '#fbbf24',
    type: 'blink', period: 2.6, cp: '점멸',
  })

  /* ── 7. 회전목마 (제자리에서 원을 그리며 도는 발판) ── */
  ring(6, {
    r: 8.6, dAng: 0.58, rise: 1.75, w: 3.4, d: 3.4, color: '#fb923c',
    type: 'orbit', amp: 1.4, speed: 0.9, cp: '회전목마',
  })

  /* ── 8. 최후의 관문 (전부 섞기) ── */
  ring(1, { r: 8.4, dAng: 0.58, rise: 1.75, w: 4.2, d: 4.2, color: '#ef4444', cp: '최후의 관문' })
  ring(1, { r: 8.4, dAng: 0.58, rise: 1.75, w: 2.2, d: 2.2, color: '#ef4444' })
  ring(1, { r: 8.6, dAng: 0.58, rise: 1.75, w: 3.2, d: 3.2, color: '#ef4444', type: 'moveX', amp: 1.8, speed: 1.25 })
  ring(1, { r: 8.4, dAng: 0.58, rise: 1.75, w: 3.2, d: 3.2, color: '#ef4444', type: 'blink', period: 2.2 })
  ring(1, { r: 8.4, dAng: 0.58, rise: 1.75, w: 3.0, d: 3.0, color: '#ef4444', type: 'moveY', amp: 1.0, speed: 1.0 })
  ring(1, { r: 8.4, dAng: 0.58, rise: 1.75, w: 2.4, d: 2.4, color: '#ef4444' })

  /* ── 정상 ── */
  y += 1.8
  const summit = add({ x: 0, y, z: 0, w: 9, h: 1.2, d: 9, color: '#fde047', summit: true, cp: '정상' })

  /* 타입별 위상 — 인접 발판이 정반대로 움직이지 않도록 간격을 좁게 잡는다.
     (상대 변위 최대치 = 2·amp·sin(Δφ/2) 이므로 Δφ가 작으면 간격/높이차가 작다) */
  plats.forEach((p) => {
    if (p.type === 'blink') p.phase = (p.id % 3) * 0.33   // 세 그룹이 번갈아 점멸
    else if (p.type === 'moveY') p.phase = p.id * 0.35
    else p.phase = p.id * 0.45
  })

  return { plats, summit }
}

const TOWER = buildTower()
const TW_PLATS = TOWER.plats
const TW_SUMMIT_Y = TOWER.summit.y
const TW_CHECKPOINTS = TW_PLATS.filter((p) => p.cp)
const TW_PLAT_BY_ID = Object.fromEntries(TW_PLATS.map((p) => [p.id, p]))

/* 시간 t에서의 발판 중심 — 물리와 렌더가 같은 함수를 쓰므로 완전히 동기화된다 */
function platPosAt(p, t) {
  switch (p.type) {
    case 'moveX': return { x: p.x + Math.sin(t * p.speed + p.phase) * p.amp, y: p.y, z: p.z }
    case 'moveZ': return { x: p.x, y: p.y, z: p.z + Math.sin(t * p.speed + p.phase) * p.amp }
    case 'moveY': return { x: p.x, y: p.y + Math.sin(t * p.speed + p.phase) * p.amp, z: p.z }
    /* 제자리에서 작은 원을 그리며 도는 발판 — 서로 멀어지지 않아 항상 도달 가능 */
    case 'orbit': {
      const a = p.phase + t * p.speed
      return { x: p.x + Math.cos(a) * p.amp, y: p.y, z: p.z + Math.sin(a) * p.amp }
    }
    default: return { x: p.x, y: p.y, z: p.z }
  }
}

/* 점멸 발판이 지금 단단한가 (0~0.62 구간만 실체) */
function platSolid(p, t) {
  if (p.type !== 'blink') return true
  const ph = (((t / p.period) + p.phase) % 1 + 1) % 1
  return ph < 0.62
}

/* 발판 AABB — p.y 는 '윗면' 높이 */
function platAABB(p, t) {
  const c = platPosAt(p, t)
  return {
    minX: c.x - p.w / 2, maxX: c.x + p.w / 2,
    minY: c.y - p.h, maxY: c.y,
    minZ: c.z - p.d / 2, maxZ: c.z + p.d / 2,
  }
}

/* ==================================================================
   점프맵 전용 입력 — 기존 useKeys에 없는 점프(Space)를 포함
   ================================================================== */
function useTowerKeys(live) {
  const keys = useRef({ f: false, b: false, l: false, r: false, run: false })
  useEffect(() => {
    /* Shift는 시프트락(마우스 조준) 전용이라 달리기는 Ctrl로 옮겼다.
       Ctrl을 누르고 있는 채로 W를 치면 브라우저의 창 닫기(Ctrl+W)가 발동하므로,
       Ctrl은 누르고 있는 게 아니라 한 번 눌러 켜고 다시 눌러 끄는 토글로 만든다
       (사용자 확정) — 이러면 W를 누를 때 Ctrl을 붙잡고 있을 필요가 없다. */
    const MAP = {
      KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b',
      KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
    }
    const onDown = (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return
      if (e.code === 'Space') {
        e.preventDefault()                       // 스페이스로 페이지가 스크롤되지 않게
        if (!e.repeat) live.current.jumpBuf = TW_BUFFER
        live.current.jumpHeld = true
        return
      }
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
        if (!e.repeat) keys.current.run = !keys.current.run
        return
      }
      const k = MAP[e.code]
      if (!k) return
      if (e.code.startsWith('Arrow')) e.preventDefault()
      keys.current[k] = true
    }
    const onUp = (e) => {
      if (e.code === 'Space') { live.current.jumpHeld = false; return }
      /* Ctrl은 뗄 때 아무 것도 하지 않는다 — 토글은 누르는 순간에만 바뀐다 */
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') return
      const k = MAP[e.code]
      if (k) keys.current[k] = false
    }
    const onBlur = () => {
      for (const k in keys.current) keys.current[k] = false
      live.current.jumpHeld = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [live])
  return keys
}

/* ==================================================================
   플레이어 모델 — 로블록스풍 블록 캐릭터
   ================================================================== */
function TowerAvatar({ armRef, legRef }) {
  return (
    <group>
      {/* 다리 */}
      <group ref={legRef}>
        <mesh castShadow position={[-0.17, 0.3, 0]}>
          <boxGeometry args={[0.26, 0.6, 0.26]} /><meshStandardMaterial color="#2563eb" roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0.17, 0.3, 0]}>
          <boxGeometry args={[0.26, 0.6, 0.26]} /><meshStandardMaterial color="#2563eb" roughness={0.7} />
        </mesh>
      </group>
      {/* 몸통 */}
      <mesh castShadow position={[0, 0.95, 0]}>
        <boxGeometry args={[0.62, 0.72, 0.34]} /><meshStandardMaterial color="#22c55e" roughness={0.65} />
      </mesh>
      {/* 팔 */}
      <group ref={armRef} position={[0, 1.24, 0]}>
        <mesh castShadow position={[-0.44, -0.28, 0]}>
          <boxGeometry args={[0.22, 0.62, 0.24]} /><meshStandardMaterial color="#fcd34d" roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0.44, -0.28, 0]}>
          <boxGeometry args={[0.22, 0.62, 0.24]} /><meshStandardMaterial color="#fcd34d" roughness={0.7} />
        </mesh>
      </group>
      {/* 머리 */}
      <mesh castShadow position={[0, 1.58, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} /><meshStandardMaterial color="#fcd34d" roughness={0.7} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.12, 1.62, 0.26]}><boxGeometry args={[0.08, 0.11, 0.02]} /><meshStandardMaterial color="#1f2937" /></mesh>
      <mesh position={[0.12, 1.62, 0.26]}><boxGeometry args={[0.08, 0.11, 0.02]} /><meshStandardMaterial color="#1f2937" /></mesh>
      {/* 입 */}
      <mesh position={[0, 1.47, 0.26]}><boxGeometry args={[0.16, 0.04, 0.02]} /><meshStandardMaterial color="#1f2937" /></mesh>
    </group>
  )
}

/* ==================================================================
   공용 시뮬레이션 시계
   발판 위치와 물리가 반드시 '같은 시간'을 보게 만든다.
   실시간 시계를 쓰면 프레임 드랍 시 발판만 순간이동해 플레이어가
   실려가지 못하고 떨어지는 문제가 생긴다.
   ================================================================== */
function TowerClock({ simRef }) {
  useFrame((_, rawDelta) => {
    const S = simRef.current
    S.prev = S.t
    S.t += Math.min(rawDelta, 0.05)
  })
  return null
}

/* ==================================================================
   플레이어 물리 — AABB 3축 분리 해결 + 코요테 타임 + 점프 버퍼
   ================================================================== */
const twHit = (L, bb) =>
  L.px + TW_PR > bb.minX && L.px - TW_PR < bb.maxX &&
  L.py + TW_PH > bb.minY && L.py < bb.maxY &&
  L.pz + TW_PR > bb.minZ && L.pz - TW_PR < bb.maxZ

function TowerPlayer({ live, camRef, simRef, onCheckpoint, onWin, onRespawn, bumpHud }) {
  const root = useRef()
  const armRef = useRef()
  const legRef = useRef()
  const keys = useTowerKeys(live)
  const camera = useThree((s) => s.camera)
  const camGoal = useMemo(() => new THREE.Vector3(), [])
  const lookAt = useMemo(() => new THREE.Vector3(), [])
  const snapped = useRef(false)

  /* 물리 1스텝 (고정 시간 h) — 관통을 막기 위해 서브스텝으로 여러 번 호출된다 */
  const stepPhysics = useCallback((h, t) => {
    const L = live.current
    const k = keys.current

    /* 1) 서 있는 발판을 따라 함께 이동 */
    if (L.standId !== null) {
      const p = TW_PLAT_BY_ID[L.standId]
      if (p && p.type !== 'static') {
        const a = platPosAt(p, t - h)
        const b = platPosAt(p, t)
        L.px += b.x - a.x
        L.py += b.y - a.y
        L.pz += b.z - a.z
      }
    }

    /* 2) 입력 → 목표 수평 속도 (카메라 기준) */
    const cy = camRef.current.yaw
    const fwdX = -Math.sin(cy), fwdZ = -Math.cos(cy)
    const rgtX = Math.cos(cy), rgtZ = -Math.sin(cy)
    let ix = 0, iz = 0
    if (!L.locked) {
      const f = clamp((k.f ? 1 : 0) - (k.b ? 1 : 0) - TOUCH.my, -1, 1)
      const s = clamp((k.r ? 1 : 0) - (k.l ? 1 : 0) + TOUCH.mx, -1, 1)
      ix = fwdX * f + rgtX * s
      iz = fwdZ * f + rgtZ * s
    }
    const len = Math.hypot(ix, iz)
    let tx = 0, tz = 0
    if (len > 0.001) {
      const spd = (k.run || TOUCH.run ? TW_RUN : TW_MOVE) * Math.min(1, len)
      tx = (ix / len) * spd
      tz = (iz / len) * spd
    }
    const accel = (L.grounded ? TW_ACCEL_GROUND : TW_ACCEL_AIR) * h
    L.vx += clamp(tx - L.vx, -accel, accel)
    L.vz += clamp(tz - L.vz, -accel, accel)

    /* 3) 점프 — 코요테 타임 + 입력 버퍼 */
    L.coyote = L.grounded ? TW_COYOTE : Math.max(0, L.coyote - h)
    L.jumpBuf = Math.max(0, L.jumpBuf - h)
    if (L.jumpBuf > 0 && L.coyote > 0 && !L.locked) {
      L.vy = TW_JUMP_V
      L.jumpBuf = 0
      L.coyote = 0
      L.grounded = false
      L.standId = null
      L.jumps += 1
    }
    /* 가변 점프 — 스페이스를 일찍 떼면 낮게 뛴다 */
    if (!L.jumpHeld && L.vy > 0) L.vy -= TW_GRAVITY * 1.15 * h

    /* 4) 중력 */
    L.vy = Math.max(TW_MAX_FALL, L.vy - TW_GRAVITY * h)

    /* 5) Y축 이동 → 착지 / 머리 부딪힘 */
    L.py += L.vy * h
    L.grounded = false
    let landed = null
    for (let i = 0; i < TW_PLATS.length; i++) {
      const p = TW_PLATS[i]
      if (!platSolid(p, t)) continue
      const bb = platAABB(p, t)
      if (!twHit(L, bb)) continue
      if (L.vy <= 0) { L.py = bb.maxY; L.vy = 0; L.grounded = true; landed = p }
      else { L.py = bb.minY - TW_PH; L.vy = 0 }
    }
    L.standId = landed ? landed.id : null
    if (landed) L.lastPlat = landed

    /* 6) X축 이동 */
    L.px += L.vx * h
    for (let i = 0; i < TW_PLATS.length; i++) {
      const p = TW_PLATS[i]
      if (!platSolid(p, t)) continue
      const bb = platAABB(p, t)
      if (!twHit(L, bb)) continue
      if (L.vx > 0) L.px = bb.minX - TW_PR
      else if (L.vx < 0) L.px = bb.maxX + TW_PR
      L.vx = 0
    }

    /* 7) Z축 이동 */
    L.pz += L.vz * h
    for (let i = 0; i < TW_PLATS.length; i++) {
      const p = TW_PLATS[i]
      if (!platSolid(p, t)) continue
      const bb = platAABB(p, t)
      if (!twHit(L, bb)) continue
      if (L.vz > 0) L.pz = bb.minZ - TW_PR
      else if (L.vz < 0) L.pz = bb.maxZ + TW_PR
      L.vz = 0
    }
  }, [camRef, keys, live])

  useFrame(() => {
    const g = root.current
    if (!g) return
    const L = live.current
    const S = simRef.current
    const dt = S.t - S.prev              // 공용 시계가 이미 클램프한 값
    const t = S.t

    /* 리스폰 — 움직이는 발판이 체크포인트여도 '지금' 위치로 되살아난다 */
    if (L.respawnReq) {
      L.respawnReq = false
      const cp = TW_PLAT_BY_ID[L.cpId]
      const c = cp ? platPosAt(cp, t) : { x: 0, y: 0, z: 0 }
      L.px = c.x; L.py = c.y + 0.05; L.pz = c.z
      L.vx = L.vy = L.vz = 0
      L.standId = null; L.grounded = false
      snapped.current = false
    }

    /* 고정 시간 서브스텝으로 물리 진행 (프레임률과 무관하게 동일한 감각) */
    if (!L.won) {
      let remain = dt
      let simT = S.prev
      let guard = 0
      while (remain > 0 && guard < 24) {
        const h = Math.min(remain, TW_SUBSTEP)
        simT += h
        stepPhysics(h, simT)
        remain -= h
        guard++
      }
      if (!L.locked) L.time += dt
    }

    /* 체크포인트 · 정상 판정 */
    if (L.standId !== null) {
      const p = TW_PLAT_BY_ID[L.standId]
      if (p && p.cp && L.cpId !== p.id) {
        L.cpId = p.id
        L.cpY = p.y                 // 깃발 점등 판정용 (실제 좌표는 리스폰 시 재계산)
        L.cpName = p.cp
        onCheckpoint(p.cp)
      }
      if (p && p.summit && !L.won) { L.won = true; L.locked = true; onWin(L.time) }
    }

    /* 낙사 */
    if (L.py < TW_VOID_Y) { L.respawnReq = true; L.falls += 1; onRespawn() }

    /* 최고 높이 기록 */
    if (L.py > L.maxY) L.maxY = L.py

    /* 모델 배치 — 시프트락이면 항상 카메라가 보는 쪽을 향하고(로블록스식),
       평소엔 진행 방향을 바라본다 */
    g.position.set(L.px, L.py, L.pz)
    const sp = Math.hypot(L.vx, L.vz)
    if (L.shiftLock) L.yaw = dampAngle(L.yaw, camRef.current.yaw + Math.PI, 22, dt)
    else if (sp > 0.6) L.yaw = dampAngle(L.yaw, Math.atan2(L.vx, L.vz), 16, dt)
    g.rotation.y = L.yaw

    /* 걷기 / 점프 애니메이션 */
    const swing = L.grounded ? Math.sin(t * 11) * Math.min(1, sp / 6) * 0.7 : 0
    if (legRef.current) {
      legRef.current.children[0].rotation.x = L.grounded ? swing : -0.45
      legRef.current.children[1].rotation.x = L.grounded ? -swing : 0.25
    }
    if (armRef.current) {
      armRef.current.children[0].rotation.x = L.grounded ? -swing : -2.3
      armRef.current.children[1].rotation.x = L.grounded ? swing : -2.3
    }

    /* 3인칭 오빗 카메라 + 발판 관통 방지 */
    const cam = camRef.current
    const horiz = Math.cos(cam.pitch) * cam.dist
    const eyeX = L.px, eyeY = L.py + 1.3, eyeZ = L.pz
    let gx = eyeX + Math.sin(cam.yaw) * horiz
    let gy = eyeY + Math.sin(cam.pitch) * cam.dist
    let gz = eyeZ + Math.cos(cam.yaw) * horiz
    /* 시선 선분을 훑어 발판 안이면 카메라를 앞으로 당긴다 */
    let best = 1
    for (let s = 1; s >= 0.25; s -= 0.0833) {
      const sx = eyeX + (gx - eyeX) * s
      const sy = eyeY + (gy - eyeY) * s
      const sz = eyeZ + (gz - eyeZ) * s
      let blocked = false
      for (let i = 0; i < TW_PLATS.length; i++) {
        const p = TW_PLATS[i]
        if (!platSolid(p, t)) continue
        const bb = platAABB(p, t)
        if (sx > bb.minX - 0.3 && sx < bb.maxX + 0.3 &&
            sy > bb.minY - 0.3 && sy < bb.maxY + 0.3 &&
            sz > bb.minZ - 0.3 && sz < bb.maxZ + 0.3) { blocked = true; break }
      }
      if (!blocked) { best = s; break }
      best = s
    }
    gx = eyeX + (gx - eyeX) * best
    gy = eyeY + (gy - eyeY) * best
    gz = eyeZ + (gz - eyeZ) * best

    camGoal.set(gx, gy, gz)
    if (!snapped.current) { camera.position.copy(camGoal); snapped.current = true }
    else camera.position.lerp(camGoal, damp(14, dt))
    lookAt.set(eyeX, eyeY, eyeZ)
    camera.lookAt(lookAt)

    /* HUD 갱신 (8Hz) */
    L.hudAcc += dt
    if (L.hudAcc >= 0.12) { L.hudAcc = 0; bumpHud() }
  })

  return (
    <group ref={root}>
      <TowerAvatar armRef={armRef} legRef={legRef} />
    </group>
  )
}

/* ==================================================================
   발판 렌더링 — 물리와 동일한 platPosAt / platSolid 사용
   ================================================================== */
function TowerPlatforms({ simRef }) {
  const meshes = useRef([])
  const mats = useRef([])
  useFrame(() => {
    const t = simRef.current.t
    for (let i = 0; i < TW_PLATS.length; i++) {
      const p = TW_PLATS[i]
      if (p.type === 'static') continue
      const m = meshes.current[i]
      if (m) {
        const c = platPosAt(p, t)
        m.position.set(c.x, c.y - p.h / 2, c.z)
      }
      if (p.type === 'blink') {
        const mat = mats.current[i]
        if (mat) {
          const solid = platSolid(p, t)
          mat.opacity = solid ? 1 : 0.16
          mat.emissiveIntensity = solid ? 0.15 : 0.6
        }
      }
    }
  })
  return (
    <group>
      {TW_PLATS.map((p, i) => (
        <group key={p.id}>
          <mesh
            ref={(el) => { meshes.current[i] = el }}
            position={[p.x, p.y - p.h / 2, p.z]}
            castShadow receiveShadow
          >
            <boxGeometry args={[p.w, p.h, p.d]} />
            <meshStandardMaterial
              ref={(el) => { mats.current[i] = el }}
              color={p.color}
              roughness={0.75}
              metalness={0.05}
              transparent={p.type === 'blink'}
              emissive={p.summit ? '#fde047' : p.color}
              emissiveIntensity={p.summit ? 0.5 : 0.08}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* 체크포인트 깃발 — 도달하면 색이 바뀐다 */
function TowerFlags({ live }) {
  const flags = useRef([])
  useFrame((state) => {
    const t = state.clock.elapsedTime      // 장식 애니메이션은 실시간이어도 무해
    const reached = live.current.cpY
    for (let i = 0; i < TW_CHECKPOINTS.length; i++) {
      const g = flags.current[i]
      if (!g) continue
      const p = TW_CHECKPOINTS[i]
      const on = p.y <= reached + 0.01
      g.rotation.y = t * (on ? 1.6 : 0.4)
      g.position.y = p.y + 1.5 + Math.sin(t * 2 + i) * (on ? 0.16 : 0.06)
      const mat = g.children[0] && g.children[0].material
      if (mat) {
        mat.color.set(on ? '#4ade80' : '#94a3b8')
        mat.emissive.set(on ? '#22c55e' : '#000000')
        mat.emissiveIntensity = on ? 0.9 : 0
      }
    }
  })
  return (
    <group>
      {TW_CHECKPOINTS.map((p, i) => (
        <group key={p.id}>
          {/* 깃대 */}
          <mesh position={[p.x, p.y + 0.85, p.z]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, 1.7, 6]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
          </mesh>
          {/* 회전하는 표식 */}
          <group ref={(el) => { flags.current[i] = el }} position={[p.x, p.y + 1.5, p.z]}>
            <mesh castShadow>
              <octahedronGeometry args={[0.3]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.4} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  )
}

/* 타워 중심 기둥 + 정상 트로피 (분위기용) */
function TowerDecor() {
  const trophy = useRef()
  const halo = useRef()
  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1)
    const t = state.clock.elapsedTime
    if (trophy.current) {
      trophy.current.rotation.y += dt * 1.1
      trophy.current.position.y = TW_SUMMIT_Y + 1.5 + Math.sin(t * 1.6) * 0.2
    }
    if (halo.current) halo.current.rotation.z += dt * 0.7
  })
  return (
    <group>
      {/* 중심 기둥 */}
      <mesh position={[0, TW_SUMMIT_Y / 2, 0]} receiveShadow>
        <cylinderGeometry args={[2.2, 3.2, TW_SUMMIT_Y + 4, 20]} />
        <meshStandardMaterial color="#3f3a5c" roughness={0.95} />
      </mesh>
      {/* 바닥 안개 구름 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -13, 0]}>
        <circleGeometry args={[60, 32]} />
        <meshStandardMaterial color="#c7d2fe" transparent opacity={0.35} roughness={1} />
      </mesh>
      {/* 정상 트로피 */}
      <group ref={trophy} position={[0, TW_SUMMIT_Y + 1.5, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.42, 0.24, 0.6, 12]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.85} roughness={0.2} emissive="#f59e0b" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0, -0.48, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.36, 8]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[0, -0.72, 0]} castShadow>
          <cylinderGeometry args={[0.34, 0.4, 0.16, 12]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh ref={halo} rotation-x={Math.PI / 2}>
          <torusGeometry args={[1.1, 0.04, 8, 32]} />
          <meshBasicMaterial color="#fde047" transparent opacity={0.7} />
        </mesh>
      </group>
      <pointLight position={[0, TW_SUMMIT_Y + 2.5, 0]} color="#fde047" intensity={14} distance={22} />
    </group>
  )
}

/* 배경 구름 */
function TowerClouds() {
  const data = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    x: Math.cos(i * 1.9) * (24 + (i % 5) * 5),
    y: -6 + i * 6.2,
    z: Math.sin(i * 1.9) * (24 + (i % 5) * 5),
    s: 3 + (i % 4) * 1.6,
  })), [])
  const g = useRef()
  useFrame((_, rawDelta) => { if (g.current) g.current.rotation.y += Math.min(rawDelta, 0.1) * 0.014 })
  return (
    <group ref={g}>
      {data.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.42} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

/* ==================================================================
   회오리 — 타워 주위를 도는 거대한 깔때기
   물리에는 영향을 주지 않는 연출 요소 (검증된 점프 난이도를 유지)
   ================================================================== */
const TW_TORNADO_H = 78          // 회오리 높이
const TW_TORNADO_RINGS = 22
const TW_TORNADO_ORBIT_R = 21    // 타워 중심에서 떨어진 거리
const TW_TORNADO_ORBIT_SPD = 0.11

function TowerTornado({ simRef }) {
  const root = useRef()
  const rings = useRef([])
  const debris = useRef([])

  /* 높이에 따라 반경이 커지는 깔때기 층 */
  const layers = useMemo(() => Array.from({ length: TW_TORNADO_RINGS }, (_, i) => {
    const f = i / (TW_TORNADO_RINGS - 1)          // 0(바닥) → 1(꼭대기)
    return {
      y: -8 + f * TW_TORNADO_H,
      r: 1.1 + Math.pow(f, 1.7) * 9.5,            // 아래는 좁고 위로 갈수록 넓게
      spin: 2.6 - f * 1.1,                        // 아래쪽이 더 빠르게 회전
      tilt: 0.05 + f * 0.05,
      op: 0.34 - f * 0.16,
    }
  }), [])

  /* 휘말려 도는 잔해 */
  const bits = useMemo(() => Array.from({ length: 34 }, (_, i) => {
    const f = (i % 12) / 11
    return {
      baseY: -6 + f * TW_TORNADO_H,
      r: 1.6 + Math.pow(f, 1.6) * 9,
      ang: (i * 2.39) % (Math.PI * 2),
      spd: 2.2 - f * 0.8,
      s: 0.22 + (i % 4) * 0.13,
      bob: 0.5 + (i % 5) * 0.35,
    }
  }), [])

  useFrame(() => {
    const t = simRef.current.t
    /* 회오리 자체가 타워 주위를 천천히 순회 */
    if (root.current) {
      const a = t * TW_TORNADO_ORBIT_SPD
      root.current.position.set(Math.cos(a) * TW_TORNADO_ORBIT_R, 0, Math.sin(a) * TW_TORNADO_ORBIT_R)
      root.current.rotation.y = -a
    }
    for (let i = 0; i < layers.length; i++) {
      const m = rings.current[i]
      if (!m) continue
      const l = layers[i]
      m.rotation.z = t * l.spin
      /* 층마다 살짝 흔들려 살아 있는 느낌 */
      m.position.x = Math.sin(t * 0.9 + i * 0.4) * (0.25 + i * 0.05)
      m.position.z = Math.cos(t * 0.75 + i * 0.4) * (0.25 + i * 0.05)
    }
    for (let i = 0; i < bits.length; i++) {
      const m = debris.current[i]
      if (!m) continue
      const b = bits[i]
      const a = b.ang + t * b.spd
      m.position.set(Math.cos(a) * b.r, b.baseY + Math.sin(t * b.bob + i) * 0.9, Math.sin(a) * b.r)
      m.rotation.x = t * 2.4 + i
      m.rotation.y = t * 1.7 + i
    }
  })

  return (
    <group ref={root}>
      {/* 깔때기 층 */}
      {layers.map((l, i) => (
        <mesh
          key={i}
          ref={(el) => { rings.current[i] = el }}
          position={[0, l.y, 0]}
          rotation={[Math.PI / 2 + l.tilt, 0, 0]}
        >
          <torusGeometry args={[l.r, Math.max(0.14, l.r * 0.11), 8, 26]} />
          <meshStandardMaterial
            color="#cbd5e1" transparent opacity={l.op}
            roughness={1} depthWrite={false}
          />
        </mesh>
      ))}

      {/* 중심 소용돌이 기둥 */}
      <mesh position={[0, -8 + TW_TORNADO_H / 2, 0]}>
        <cylinderGeometry args={[8.4, 1.0, TW_TORNADO_H, 26, 1, true]} />
        <meshStandardMaterial
          color="#94a3b8" transparent opacity={0.16}
          side={THREE.DoubleSide} roughness={1} depthWrite={false}
        />
      </mesh>

      {/* 바닥에서 피어오르는 먼지 */}
      <mesh position={[0, -8.4, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[4.2, 24]} />
        <meshStandardMaterial color="#b8bfcc" transparent opacity={0.3} depthWrite={false} />
      </mesh>

      {/* 휘말린 잔해 */}
      {bits.map((b, i) => (
        <mesh key={i} ref={(el) => { debris.current[i] = el }} scale={b.s}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={i % 3 === 0 ? '#a1887f' : '#9aa5b1'} roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}

/* ==================================================================
   Tower of Trials — 게임 화면
   ================================================================== */
const twFmt = (s) => {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const cs = Math.floor((s * 100) % 100)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

function TowerGame() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const live = useRef({
    px: 0, py: 0.05, pz: 0, vx: 0, vy: 0, vz: 0, yaw: 0,
    grounded: false, coyote: 0, jumpBuf: 0, jumpHeld: false,
    standId: null, lastPlat: null, locked: false, won: false,
    cpId: 0, cpX: 0, cpY: 0, cpZ: 0, cpName: '출발점',
    time: 0, falls: 0, jumps: 0, maxY: 0, hudAcc: 0, respawnReq: false,
    shiftLock: false,
  })
  const camRef = useRef({ yaw: Math.PI, pitch: 0.42, dist: 9 })
  const simRef = useRef({ t: 0, prev: 0 })
  const [shiftLock, setShiftLock] = useState(false)
  const [runOn, setRunOn] = useState(false)
  const setLockRef = useRef(() => {})   // 아래 effect가 채운다 — 모바일 버튼에서도 같은 함수를 쓴다
  const [, setTick] = useState(0)
  const bumpHud = useCallback(() => setTick((n) => n + 1), [])
  const [best, setBest] = useState(() => loadJSON(LS_TOWER, { time: null, height: 0, clears: 0 }))
  const [win, setWin] = useState(null)
  const [toast, setToast] = useState(null)
  const toastT = useRef(null)

  const flash = useCallback((msg) => {
    setToast(msg)
    if (toastT.current) clearTimeout(toastT.current)
    toastT.current = setTimeout(() => setToast(null), 1600)
  }, [])
  useEffect(() => () => { if (toastT.current) clearTimeout(toastT.current) }, [])

  const onCheckpoint = useCallback((name) => {
    if (name === '출발점') return
    flash(`🚩 체크포인트 — ${name}`)
  }, [flash])

  const onRespawn = useCallback(() => {
    flash('💫 떨어졌다! 체크포인트로 복귀')
  }, [flash])

  const onWin = useCallback((time) => {
    const prev = loadJSON(LS_TOWER, { time: null, height: 0, clears: 0 })
    const isBest = prev.time === null || time < prev.time
    const next = {
      time: isBest ? time : prev.time,
      height: Math.max(prev.height || 0, TW_SUMMIT_Y),
      clears: (prev.clears || 0) + 1,
    }
    saveJSON(LS_TOWER, next)
    setBest(next)
    setWin({ time, isBest, clears: next.clears })
  }, [])

  /* 최고 높이 기록 저장 (정상 실패해도 기록은 남는다) */
  useEffect(() => {
    const iv = setInterval(() => {
      const h = live.current.maxY
      const prev = loadJSON(LS_TOWER, { time: null, height: 0, clears: 0 })
      if (h > (prev.height || 0) + 0.5) {
        const next = { ...prev, height: h }
        saveJSON(LS_TOWER, next)
        setBest(next)
      }
    }, 2500)
    return () => clearInterval(iv)
  }, [])

  /* 카메라 드래그 · 시프트락(로블록스식) · R 리스폰 */
  useEffect(() => {
    const drag = { id: null, lx: 0, ly: 0 }
    const canvasEl = () => document.querySelector('canvas')

    const onContext = (e) => e.preventDefault()
    const onDown = (e) => {
      if (e.target.closest && e.target.closest('[data-ui]')) return
      if (document.pointerLockElement) return          // 시프트락 중엔 드래그 불필요
      drag.id = e.pointerId; drag.lx = e.clientX; drag.ly = e.clientY
    }
    const onMove = (e) => {
      /* 시프트락: 버튼을 누르지 않아도 마우스 움직임이 곧 시점 이동.
         포인터락이 걸리면 커서가 갇히고, 막힌 환경에선 그냥 마우스 이동량만 쓴다 */
      if (live.current.shiftLock) {
        camRef.current.yaw -= (e.movementX || 0) * 0.0026
        camRef.current.pitch = clamp(camRef.current.pitch + (e.movementY || 0) * 0.0022, -0.35, 1.25)
        return
      }
      if (drag.id !== e.pointerId) return
      const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly
      drag.lx = e.clientX; drag.ly = e.clientY
      camRef.current.yaw -= dx * 0.006
      camRef.current.pitch = clamp(camRef.current.pitch + dy * 0.005, -0.35, 1.25)
    }
    const onUp = (e) => { if (drag.id === e.pointerId) drag.id = null }
    const onWheel = (e) => {
      camRef.current.dist = clamp(camRef.current.dist + e.deltaY * 0.008, 5, 16)
    }

    /* 시프트락 켜고 끄기.
       포인터락(커서 가두기)은 '있으면 좋은' 기능 — 브라우저가 막아도
       마우스 이동량만으로 조준이 되도록 항상 동작시킨다. */
    const setLock = (on) => {
      live.current.shiftLock = on
      setShiftLock(on)
      const el = canvasEl()
      if (!el) return
      if (on) {
        try {
          const r = el.requestPointerLock && el.requestPointerLock()
          if (r && typeof r.catch === 'function') r.catch(() => {})
        } catch { /* 포인터락 불가 환경 — 소프트 모드로 계속 */ }
      } else if (document.pointerLockElement === el) {
        document.exitPointerLock()
      }
    }
    setLockRef.current = setLock   // 모바일 버튼도 같은 함수로 켠다 (포인터락은 모바일에서 조용히 무시된다)

    /* 사용자가 Esc로 포인터락을 풀면 시프트락도 함께 해제 */
    const onLockChange = () => {
      if (!document.pointerLockElement && live.current.shiftLock) {
        live.current.shiftLock = false
        setShiftLock(false)
      }
    }

    const onKey = (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return
      if (e.code === 'KeyR' && !e.repeat) { live.current.respawnReq = true; flash('↩ 체크포인트로 복귀') }
      if (e.code === 'Escape' && live.current.shiftLock) setLock(false)
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) {
        e.preventDefault()
        const on = !live.current.shiftLock
        setLock(on)
        flash(on ? '🖱 시프트락 ON — 마우스로 조준 (Shift로 해제)' : '🖱 시프트락 OFF')
      }
    }

    window.addEventListener('contextmenu', onContext)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerlockchange', onLockChange)
    return () => {
      window.removeEventListener('contextmenu', onContext)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerlockchange', onLockChange)
      if (document.pointerLockElement) document.exitPointerLock()   // 라우트 이탈 시 해제
    }
  }, [flash])

  const twSetVec = useCallback((x, y) => { TOUCH.mx = x; TOUCH.my = y }, [])

  /* 모바일 전용 — 시프트락 · 달리기 토글 (키보드가 없어도 같은 기능을 쓸 수 있게) */
  const toggleShiftLock = useCallback(() => {
    const on = !live.current.shiftLock
    setLockRef.current(on)
    flash(on ? '🖱 시프트락 ON — 항상 카메라 방향을 본다 (다시 누르면 해제)' : '🖱 시프트락 OFF')
  }, [flash])
  const toggleRun = useCallback(() => { TOUCH.run = !TOUCH.run; setRunOn(TOUCH.run) }, [])

  const restart = useCallback(() => {
    const L = live.current
    L.px = 0; L.py = 0.05; L.pz = 0
    L.vx = L.vy = L.vz = 0
    L.grounded = false; L.standId = null
    L.cpId = 0; L.cpX = 0; L.cpY = 0; L.cpZ = 0; L.cpName = '출발점'
    L.time = 0; L.falls = 0; L.jumps = 0; L.maxY = 0
    L.won = false; L.locked = false; L.respawnReq = true
    setWin(null)
  }, [])

  const L = live.current
  const progress = clamp(L.py / TW_SUMMIT_Y, 0, 1)

  return (
    <div className="fixed inset-0 select-none">
      <Canvas shadows camera={{ fov: 60, near: 0.1, far: 400, position: [0, 6, 14] }}>
        <color attach="background" args={['#8ec5ff']} />
        <fog attach="fog" args={['#a9d4ff', 45, 170]} />
        <ambientLight intensity={0.72} />
        <hemisphereLight args={['#ffffff', '#6f86b8', 0.85]} />
        <directionalLight
          castShadow position={[24, 60, 18]} intensity={1.5}
          shadow-mapSize={[2048, 2048]} shadow-bias={-0.0005}
          shadow-camera-left={-30} shadow-camera-right={30}
          shadow-camera-top={30} shadow-camera-bottom={-30}
          shadow-camera-near={1} shadow-camera-far={140}
        />
        <TowerClock simRef={simRef} />
        <TowerClouds />
        <TowerTornado simRef={simRef} />
        <TowerDecor />
        <TowerPlatforms simRef={simRef} />
        <TowerFlags live={live} />
        <TowerPlayer
          live={live} camRef={camRef} simRef={simRef} bumpHud={bumpHud}
          onCheckpoint={onCheckpoint} onWin={onWin} onRespawn={onRespawn}
        />
      </Canvas>

      {/* 좌상단 — 진행도 */}
      <div className="pointer-events-none absolute left-4 top-4 w-60 rounded-2xl border border-white/20 bg-black/45 px-4 py-3 backdrop-blur-sm">
        <div className="text-[11px] tracking-[0.3em] text-sky-200/80">TOWER OF TRIALS</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-2xl font-black text-white">{L.py.toFixed(1)}</span>
          <span className="text-xs text-slate-300">/ {TW_SUMMIT_Y.toFixed(0)} m</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full border border-white/15 bg-black/50">
          <div className="h-full rounded-full transition-[width] duration-150"
            style={{ width: `${progress * 100}%`, background: 'linear-gradient(90deg,#38bdf8,#fbbf24)' }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="font-bold text-emerald-300">🚩 {L.cpName}</span>
          <span className="text-slate-300">{Math.round(progress * 100)}%</span>
        </div>
      </div>

      {/* 우상단 — 타이머 / 기록 */}
      <div className="pointer-events-none absolute right-4 top-4 rounded-2xl border border-white/20 bg-black/45 px-4 py-3 text-right backdrop-blur-sm">
        <div className="font-mono text-2xl font-black text-amber-300">{twFmt(L.time)}</div>
        <div className="text-[11px] text-slate-300">낙하 {L.falls} · 점프 {L.jumps}</div>
        {best.time !== null && (
          <div className="mt-1 text-[11px] font-bold text-sky-300">최고 기록 {twFmt(best.time)}</div>
        )}
        {best.clears > 0 && (
          <div className="text-[10px] text-slate-400">클리어 {best.clears}회</div>
        )}
      </div>

      {/* 시프트락 조준점 (로블록스식) */}
      {shiftLock && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-7 w-7">
            <div className="absolute left-1/2 top-0 h-2.5 w-0.5 -translate-x-1/2 bg-white/90 shadow" />
            <div className="absolute bottom-0 left-1/2 h-2.5 w-0.5 -translate-x-1/2 bg-white/90 shadow" />
            <div className="absolute left-0 top-1/2 h-0.5 w-2.5 -translate-y-1/2 bg-white/90 shadow" />
            <div className="absolute right-0 top-1/2 h-0.5 w-2.5 -translate-y-1/2 bg-white/90 shadow" />
            <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
          </div>
        </div>
      )}
      {shiftLock && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-sky-300/40 bg-sky-500/20 px-3 py-1 text-[11px] font-bold text-sky-100 backdrop-blur-sm">
          🖱 시프트락 ON
        </div>
      )}

      {/* 조작 안내 */}
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl bg-black/45 px-3 py-2 text-[11px] leading-relaxed text-white/85">
        {isMobile ? (
          <>왼쪽 <b>조이스틱</b> 이동 · 오른쪽 <b>점프</b> 버튼<br />
          <b>🏃 달리기</b> · <b>🎯 시프트락</b> 버튼은 다시 누르면 꺼집니다<br />
          빈 화면을 <b>드래그</b>하면 시점이 돌아갑니다</>
        ) : (
          <><b>WASD</b> 이동 · <b>Space</b> 점프 · <b>Ctrl</b> 달리기(누르면 켜짐, 다시 누르면 꺼짐)<br />
          <b>Shift</b> 시프트락(마우스 조준) · <b>Esc</b> 해제<br />
          <b>마우스 드래그</b> 시점 회전 · <b>휠</b> 줌 · <b>R</b> 체크포인트 복귀</>
        )}
      </div>

      {/* 모바일 터치 조작 */}
      {isMobile && !win && (
        <>
          <div className="absolute bottom-6 left-5 z-40">
            <VirtualJoystick size={124} onVec={twSetVec} />
          </div>
          <div className="absolute bottom-[10.5rem] left-9 z-40 flex gap-2">
            <TouchBtn label="🏃" sub="달리기" size={52} textSize="text-base"
              bg={runOn ? 'rgba(52,211,153,.4)' : 'rgba(255,255,255,.14)'}
              border={runOn ? 'rgba(52,211,153,.85)' : 'rgba(255,255,255,.32)'}
              onPress={toggleRun} />
            <TouchBtn label="🎯" sub="시프트락" size={52} textSize="text-base"
              bg={shiftLock ? 'rgba(56,189,248,.4)' : 'rgba(255,255,255,.14)'}
              border={shiftLock ? 'rgba(56,189,248,.85)' : 'rgba(255,255,255,.32)'}
              onPress={toggleShiftLock} />
          </div>
          <div className="absolute bottom-7 right-5 z-40 flex flex-col items-center gap-3">
            <TouchBtn
              label="↻" sub="복귀" size={54} textSize="text-lg"
              onPress={() => { live.current.respawnReq = true; flash('↩ 체크포인트로 복귀') }}
            />
            <TouchBtn
              label="점프" size={94} textSize="text-sm"
              bg="rgba(56,189,248,.32)" border="rgba(56,189,248,.7)"
              onPress={() => { live.current.jumpBuf = TW_BUFFER; live.current.jumpHeld = true }}
              onRelease={() => { live.current.jumpHeld = false }}
            />
          </div>
        </>
      )}

      {/* 로비 */}
      <button data-ui onClick={() => navigate('/')}
        className="absolute bottom-4 right-4 rounded-full border border-white/20 bg-slate-900/80 px-4 py-2 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-slate-800">
        ← 로비
      </button>

      {/* 토스트 */}
      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-20 -translate-x-1/2 rounded-full border border-white/20 bg-black/75 px-5 py-2.5 text-sm font-bold text-white shadow-xl">
          {toast}
        </div>
      )}

      {/* 정상 등정 */}
      {win && (
        <div data-ui className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-[22rem] rounded-3xl border border-amber-400/50 bg-slate-900 p-7 text-center shadow-2xl [animation:pop_.45s_cubic-bezier(.2,1.6,.4,1)]">
            <div className="text-6xl">🏆</div>
            <div className="mt-3 text-2xl font-black text-amber-300">정상 등정!</div>
            {win.isBest && (
              <div className="mt-1 text-xs font-bold text-emerald-300">✨ 신기록 달성!</div>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-[10px] text-slate-400">기록</div>
                <div className="font-mono text-sm font-black text-amber-300">{twFmt(win.time)}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-[10px] text-slate-400">낙하</div>
                <div className="text-lg font-black text-rose-300">{L.falls}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-[10px] text-slate-400">점프</div>
                <div className="text-lg font-black text-sky-300">{L.jumps}</div>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-slate-400">총 {win.clears}번째 클리어</div>
            <button onClick={restart}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 font-black text-white transition hover:brightness-110">
              🔄 다시 도전
            </button>
            <button onClick={() => navigate('/')}
              className="mt-2 w-full rounded-xl border border-white/15 py-3 font-bold text-slate-200 transition hover:bg-white/5">
              ← 로비로
            </button>
          </div>
        </div>
      )}
      <style>{`@keyframes pop { from { transform: scale(1.7) } to { transform: scale(1) } }`}</style>
    </div>
  )
}
function LobbyPage({ device, onChangeDevice }) {
  const games = [
    {
      to: '/rpg',
      badge: 'GAME 01',
      title: 'Hardcore Action RPG',
      sub: '끝없는 수련',
      desc: '9개 직업 · 0.01 단위 영구 성장 · 거미줄 스킬트리 · 6차 전직 · 다중 사냥터 · PVP 투기장',
      icon: '⚔️',
      tags: ['튜토리얼', '전직', '인벤토리', 'PVP'],
      from: 'from-indigo-600/30', to2: 'to-violet-600/20', ring: 'group-hover:border-indigo-400/60',
      glow: 'rgba(99,102,241,.35)',
    },
    {
      to: '/dragon',
      badge: 'GAME 02',
      title: 'Dragon Rider',
      sub: '창공의 부화장',
      desc: '잠입으로 알을 훔치고 · 온도를 맞춰 부화시키고 · 드래곤을 타고 하늘에서 도그파이트',
      icon: '🐉',
      tags: ['잠입', '육성', '비행 슈팅'],
      from: 'from-amber-600/30', to2: 'to-rose-600/20', ring: 'group-hover:border-amber-400/60',
      glow: 'rgba(245,158,11,.35)',
    },
    {
      to: '/tower',
      badge: 'GAME 03',
      title: 'Tower of Trials',
      sub: '시련의 탑',
      desc: 'WASD로 달리고 스페이스로 뛰어라 · 흔들다리 · 승강기 · 점멸 발판 · 회전목마를 지나 정상까지',
      icon: '🗼',
      tags: ['점프맵', '체크포인트', '타임어택'],
      from: 'from-sky-600/30', to2: 'to-emerald-600/20', ring: 'group-hover:border-sky-400/60',
      glow: 'rgba(56,189,248,.35)',
    },
    {
      to: '/escape',
      badge: 'GAME 04',
      title: 'Escape the Room',
      sub: '잠긴 방',
      desc: '방을 뒤져 단서를 모으고 · 키패드 · 색 순서 · 스위치 · 다이얼을 풀어 문을 열어라 — 난이도 5단계',
      icon: '🔓',
      tags: ['1인칭 탐색', '5단계 난이도', '타임어택'],
      from: 'from-fuchsia-600/30', to2: 'to-purple-700/20', ring: 'group-hover:border-fuchsia-400/60',
      glow: 'rgba(217,70,239,.35)',
    },
  ]

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#070912]">
      {/* 배경 */}
      <div className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,.22), transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(245,158,11,.14), transparent 55%)' }} />
      <div className="pointer-events-none absolute inset-0">
        {LOBBY_STARS.map((s, i) => (
          <span key={i} className="absolute rounded-full bg-white"
            style={{
              left: s.left + '%', top: s.top + '%', width: s.size, height: s.size,
              opacity: 0.35, animation: `twinkle 3.2s ease-in-out ${s.delay}s infinite`,
            }} />
        ))}
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-5 py-14">
        {/* 타이틀 */}
        <div className="text-center">
          <button onClick={onChangeDevice}
            className="absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/80 backdrop-blur-sm transition hover:bg-white/10">
            {device === 'mobile' ? '📱 모바일' : '🖥️ 컴퓨터'}
            <span className="text-white/40">변경</span>
          </button>
          <div className="text-[11px] tracking-[0.6em] text-indigo-300/70">WELCOME TO</div>
          <h1 className="mt-3 text-5xl font-black leading-none tracking-tight sm:text-7xl">
            <span className="bg-gradient-to-r from-indigo-300 via-white to-amber-300 bg-clip-text text-transparent">
              My 3D Game Universe
            </span>
          </h1>
          <div className="mx-auto mt-4 h-px w-56 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <p className="mt-4 text-sm text-slate-400">네 개의 거대한 3D 세계가 당신을 기다립니다</p>
        </div>

        {/* 게임 카드 */}
        <div className="mt-12 grid w-full gap-5 md:grid-cols-2">
          {games.map((g) => (
            <Link key={g.to} to={g.to}
              className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${g.from} ${g.to2} p-7 transition-all duration-300 hover:-translate-y-2 ${g.ring}`}
              style={{ backdropFilter: 'blur(4px)' }}>
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: g.glow }} />
              <div className="relative">
                <div className="flex items-start justify-between">
                  <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[10px] font-bold tracking-widest text-white/70">{g.badge}</span>
                  <span className="text-5xl transition-transform duration-300 group-hover:scale-110">{g.icon}</span>
                </div>
                <h2 className="mt-5 text-2xl font-black text-white sm:text-3xl">{g.title}</h2>
                <div className="mt-1 text-base font-bold text-white/60">{g.sub}</div>
                <p className="mt-4 min-h-[3.5rem] text-[13px] leading-relaxed text-slate-300">{g.desc}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {g.tags.map((t) => (
                    <span key={t} className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] text-slate-300">{t}</span>
                  ))}
                </div>
                <div className="mt-6 flex items-center gap-2 text-sm font-black text-white transition-transform duration-300 group-hover:translate-x-1">
                  게임 시작 <span className="text-lg">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 text-center text-[11px] leading-relaxed text-slate-600">
          React Three Fiber · 외부 모델 파일 없이 기본 도형만으로 제작<br />
          각 게임은 독립 라우트로 분리되어 페이지를 벗어나면 WebGL 캔버스가 완전히 해제됩니다
        </div>
      </div>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: .15; transform: scale(1) }
          50% { opacity: .75; transform: scale(1.5) }
        }
      `}</style>
    </div>
  )
}

/* RPG 라우트 래퍼 — 로비 복귀 버튼 + 캔버스 완전 언마운트 */
function RpgPage() {
  const navigate = useNavigate()
  return (
    <div className="fixed inset-0">
      <RpgGame />
      <button data-ui onClick={() => navigate('/')}
        className="fixed left-1/2 top-4 z-[80] -translate-x-1/2 rounded-full border border-white/15 bg-black/70 px-4 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-black/90">
        ← 로비
      </button>
    </div>
  )
}

/* ==================================================================
   App — 라우터
   각 Route가 언마운트되면 해당 게임의 <Canvas>도 함께 파괴되어
   WebGL 컨텍스트/메모리가 정리된다 (게임 간 상태 완전 분리).
   ================================================================== */
export default function App() {
  /* 접속 시 기기를 한 번 물어보고 저장한다 (로비에서 언제든 변경 가능) */
  const [device, setDevice] = useState(() => loadJSON(LS_DEVICE, null))

  const pickDevice = useCallback((id) => {
    saveJSON(LS_DEVICE, id)
    TOUCH.clear()
    setDevice(id)
  }, [])

  /* 모바일에선 브라우저 기본 제스처(핀치줌·더블탭줌·당겨서 새로고침)를 막는다.

     단 'none'을 쓰면 안 된다 — touch-action은 조상까지 함께 계산되므로
     body에 none을 주면 그 안의 목록·모달까지 손가락으로 스크롤할 수 없게 된다
     (방탈출 방 목록 15개가 아예 끝까지 내려가지 않았다).
     'manipulation'은 더블탭 확대만 막고 스크롤은 살려둔다. */
  useEffect(() => {
    if (device !== 'mobile') return
    const prevTouch = document.body.style.touchAction
    const prevSelect = document.body.style.userSelect
    const prevOver = document.body.style.overscrollBehavior
    document.body.style.touchAction = 'manipulation'
    document.body.style.userSelect = 'none'
    document.body.style.overscrollBehavior = 'none'
    const stopPinch = (e) => { if (e.touches && e.touches.length > 1) e.preventDefault() }
    document.addEventListener('touchmove', stopPinch, { passive: false })
    return () => {
      document.body.style.touchAction = prevTouch
      document.body.style.userSelect = prevSelect
      document.body.style.overscrollBehavior = prevOver
      document.removeEventListener('touchmove', stopPinch)
    }
  }, [device])

  if (!device) return <DeviceSelectScreen onPick={pickDevice} />

  return (
    <DeviceCtx.Provider value={device}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LobbyPage device={device} onChangeDevice={() => pickDevice(null)} />} />
          <Route path="/rpg" element={<RpgPage />} />
          <Route path="/dragon" element={<DragonGame />} />
          <Route path="/tower" element={<TowerGame />} />
          <Route path="/escape" element={<EscapeGame />} />
          <Route path="*" element={<LobbyPage device={device} onChangeDevice={() => pickDevice(null)} />} />
        </Routes>
      </BrowserRouter>
    </DeviceCtx.Provider>
  )
}
