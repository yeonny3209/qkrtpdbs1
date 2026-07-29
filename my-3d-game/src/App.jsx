import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Billboard, RoundedBox } from '@react-three/drei'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import * as THREE from 'three'

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
const RUNE_DROP = 0.003
const GEAR_DROP = 0.06
const GROWTH_STEP = 0.01                   // 기믹 1회 성공 = +0.01 (고정)
const LIVER_DROP = 0.25                    // 튜토리얼 '토끼 간' 드랍률
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
  { id: 'assassin', name: '암살자', weapon: 'dagger', icon: '🔪', color: '#94a3b8', mode: 'melee', fx: 'slash',
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
const CLASS_BY_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c]))

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
const GRADES = [
  { key: 0, name: '일반', color: '#cbd5e1', mult: 1 },
  { key: 1, name: '희귀', color: '#60a5fa', mult: 1.8 },
  { key: 2, name: '레어', color: '#a78bfa', mult: 3.0 },
  { key: 3, name: '전설', color: '#fbbf24', mult: 5.0 },
  { key: 4, name: '신화', color: '#f472b6', mult: 8.5 },
  { key: 5, name: '에이펙스', color: '#ef4444', mult: 14 },
]
function clampInt(v, lo, hi) { return Math.max(lo, Math.min(hi, v | 0)) }
const gradeOf = (g) => GRADES[clampInt(g, 0, GRADES.length - 1)]
function rollGrade(max = 3, luck = 1) {
  const r = Math.random() / luck
  let g = 0
  if (r < 0.02) g = 5
  else if (r < 0.06) g = 4
  else if (r < 0.15) g = 3
  else if (r < 0.36) g = 2
  else if (r < 0.66) g = 1
  return Math.min(max, g)
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
/* 전직 퀘스트 (골드 대신 수행 가능) */
const jobQuestNeed = (tier) => 5 + tier * 8

/* 티어별 스킬 원형 — 모든 직업이 공유하는 역학, 이름/색만 직업별 */
const TIER_ARCH = [
  { type: 'active', slot: 1, cd: 3.0, dmgMul: 1.6, dmgPer: 0.35, range: 3.4, arc: 1.3, hits: 1 },
  { type: 'active', slot: 2, cd: 5.0, dmgMul: 2.2, dmgPer: 0.45, range: 4.0, arc: 1.7, hits: 2 },
  { type: 'active', slot: 3, cd: 8.0, dmgMul: 2.9, dmgPer: 0.60, range: 4.6, arc: 2.1, hits: 1 },
  { type: 'passive', slot: 0 },
  { type: 'active', slot: 4, cd: 14.0, dmgMul: 3.8, dmgPer: 0.80, range: 5.4, arc: 2.7, hits: 3 },
  { type: 'active', slot: 5, cd: 25.0, dmgMul: 5.2, dmgPer: 1.20, range: 6.6, arc: Math.PI, hits: 2 },
  { type: 'passive', slot: 0 },
]

/* 직업별 7단계 스킬 이름 · 설명 */
const SKILL_NAMES = {
  swordsman: [
    ['강격', '검에 힘을 실어 전방을 강하게 벤다'],
    ['연속 베기', '강격에 이어지는 2연격 — 기본 스킬 연계'],
    ['회전 참격', '몸을 회전시켜 주변을 크게 베는 신규 검술'],
    ['검술 숙련', '모든 스킬의 범위와 피해가 증가한다'],
    ['폭풍의 검무', '3연격 콤보 — 여러 검술이 섞인 난무'],
    ['일도양단', '하늘을 가르는 전설의 일격'],
    ['검신 강림', '각성 — 검기의 오라를 두르고 모든 능력이 극대화'],
  ],
  mage: [
    ['매직 미사일', '마력탄을 전방에 발사한다'],
    ['연쇄 마법', '매직 미사일이 연쇄 폭발한다 — 기본 연계'],
    ['화염 폭발', '지정 지점에 거대한 화염을 터뜨리는 신규 마법'],
    ['마력 증폭', '모든 마법의 범위와 피해가 증가한다'],
    ['원소 융합진', '3속성이 융합된 대마법 콤보'],
    ['메테오 스트라이크', '하늘에서 운석을 떨어뜨리는 전설 마법'],
    ['대마법사의 각성', '각성 — 마력의 오라를 두르고 모든 능력이 극대화'],
  ],
  warrior: [
    ['분쇄', '대검으로 적을 짓눌러 분쇄한다'],
    ['연속 강타', '분쇄에 이어지는 2연타 — 기본 연계'],
    ['대지 가르기', '땅을 갈라 충격파를 보내는 신규 기술'],
    ['불굴의 투지', '모든 스킬의 범위와 피해가 증가한다'],
    ['광전사의 연격', '이성을 잃고 몰아치는 3연격 콤보'],
    ['대지멸참', '대지를 통째로 쪼개는 전설의 참격'],
    ['전쟁군주 각성', '각성 — 투기의 오라를 두르고 모든 능력이 극대화'],
  ],
  archer: [
    ['정밀 사격', '급소를 노려 강하게 쏜다'],
    ['연발 사격', '정밀 사격에 이은 2연사 — 기본 연계'],
    ['관통 화살', '적을 꿰뚫고 나아가는 신규 사격'],
    ['매의 눈', '모든 사격의 사거리와 피해가 증가한다'],
    ['폭풍 연사', '화살비를 쏟아붓는 3연사 콤보'],
    ['신궁의 일격', '하늘을 가르는 전설의 화살'],
    ['바람의 화신 각성', '각성 — 바람의 오라를 두르고 모든 능력이 극대화'],
  ],
  assassin: [
    ['급소 찌르기', '치명적인 급소를 단검으로 찌른다'],
    ['그림자 연격', '급소 찌르기에 이은 2연격 — 기본 연계'],
    ['암살 표식', '표식을 새겨 광역으로 터뜨리는 신규 기술'],
    ['은신 숙련', '모든 기술의 범위와 피해가 증가한다'],
    ['그림자 난무', '잔상을 남기며 몰아치는 3연격 콤보'],
    ['처형 선고', '죽음을 선고하는 전설의 일격'],
    ['그림자 군주 각성', '각성 — 어둠의 오라를 두르고 모든 능력이 극대화'],
  ],
  priest: [
    ['성스러운 일격', '신성한 힘을 담아 내리친다'],
    ['축복의 연타', '성스러운 일격에 이은 2연타 — 기본 연계'],
    ['신성 폭발', '주변을 정화하는 신성한 폭발 — 신규'],
    ['신앙 심화', '모든 신성술의 범위와 피해가 증가한다'],
    ['심판의 연쇄', '신벌이 연쇄로 내리는 3연격 콤보'],
    ['대심판', '하늘에서 심판의 빛이 쏟아지는 전설기'],
    ['대주교 각성', '각성 — 성광의 오라를 두르고 모든 능력이 극대화'],
  ],
  moon: [
    ['월광 베기', '달빛을 실어 적을 벤다'],
    ['달빛 연계', '월광 베기에 이은 2연격 — 기본 연계'],
    ['저주의 장막', '광역 저주를 씌우는 신규 술법'],
    ['월식의 지혜', '모든 술법의 범위와 피해가 증가한다'],
    ['삭월 연무', '달의 위상이 바뀌며 이어지는 3연격 콤보'],
    ['개기월식', '달을 삼켜 전장을 뒤덮는 전설의 술법'],
    ['월신 강림', '각성 — 월광의 오라를 두르고 모든 능력이 극대화'],
  ],
  healer: [
    ['치유의 빛', '빛을 쏘아 아군을 치유하고 적을 태운다'],
    ['연쇄 치유', '치유의 빛이 연쇄된다 — 기본 연계'],
    ['생명의 파동', '광역으로 생명력을 퍼뜨리는 신규 술법'],
    ['자애 숙련', '모든 치유술의 범위와 효과가 증가한다'],
    ['대치유진', '거대한 치유진을 전개하는 콤보'],
    ['부활의 기적', '죽음마저 되돌리는 전설의 기적'],
    ['생명의 여신 각성', '각성 — 생명의 오라를 두르고 모든 능력이 극대화'],
  ],
  reaper: [
    ['사신의 낫질', '거대한 낫으로 전방을 넓게 수확한다'],
    ['연속 수확', '낫질에 이은 2연격 — 기본 연계'],
    ['영혼 흡수', '주변 영혼을 빨아들이는 신규 술법'],
    ['사신의 인도', '모든 수확술의 범위와 피해가 증가한다'],
    ['죽음의 윤무', '낫을 휘돌리는 3연격 콤보'],
    ['대수확', '전장의 모든 생명을 거두는 전설의 일격'],
    ['사신 강림', '각성 — 사기의 오라를 두르고 모든 능력이 극대화'],
  ],
}

/* 스킬 정의 생성 (직업 × 7단계 = 63개) */
function buildSkills() {
  const out = {}
  CLASSES.forEach((c) => {
    out[c.id] = SKILL_NAMES[c.id].map((nm, tier) => {
      const arch = TIER_ARCH[tier]
      return {
        id: `${c.id}_t${tier}`,
        cls: c.id, tier,
        name: nm[0], desc: nm[1],
        type: arch.type,
        slot: arch.slot,
        cd: arch.cd, dmgMul: arch.dmgMul, dmgPer: arch.dmgPer,
        range: arch.range, arc: arch.arc, hits: arch.hits,
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

/* 티어3 패시브: 스킬 범위/피해 증가 · 티어6 각성: 전 능력 극대화 */
const PASSIVE_T3 = { rangePer: 0.05, dmgPer: 0.08 }
const PASSIVE_T6 = { atkPer: 0.03, hpPer: 0.04, critPer: 2 }

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

/* 상인 판매 목록 */
const SHOP_STOCK = [
  { key: 'rune', name: '봉인된 룬 상자', desc: '무작위 룬 1개', price: 900, icon: '🔮' },
  { key: 'armor', name: '방어구 꾸러미', desc: '무작위 방어구 1개', price: 700, icon: '🛡️' },
  { key: 'weapon', name: '무기 상자', desc: '내 직업 전용 무기 1개', price: 1200, icon: '⚔️' },
  { key: 'artifact', name: '고대 유물 상자', desc: '무작위 아티팩트 1개', price: 5000, icon: '✨' },
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
const MAPS = [
  { id: 0, name: '초보자 마을', reqLv: 1, town: true, half: 30,
    ground: '#57a355', sky: '#8fd3f4', fog: [40, 120], mob: 'rabbit', count: 9,
    desc: '모든 모험이 시작되는 평화로운 마을' },
  { id: 1, name: '고블린 숲', reqLv: 8, half: 26,
    ground: '#3d6b43', sky: '#7fae8c', fog: [30, 90], mob: 'goblin', count: 8,
    desc: '고블린 무리가 우글거리는 어두운 숲' },
  { id: 2, name: '늑대 협곡', reqLv: 16, half: 26,
    ground: '#8a7a5e', sky: '#c9b98a', fog: [30, 90], mob: 'wolf', count: 8,
    desc: '굶주린 늑대들이 배회하는 바위 협곡' },
  { id: 3, name: '화염 동굴', reqLv: 26, half: 24,
    ground: '#6b3327', sky: '#d9744a', fog: [24, 74], mob: 'imp', count: 8,
    desc: '용암이 흐르는 뜨거운 지하 동굴' },
  { id: 4, name: '심연의 던전', reqLv: 36, half: 24,
    ground: '#332e46', sky: '#231f33', fog: [22, 66], mob: 'wraith', count: 8,
    desc: '빛이 닿지 않는 심연. 망령이 떠돈다' },
  { id: 5, name: '용의 둥지', reqLv: 48, half: 24,
    ground: '#5c3340', sky: '#8f5560', fog: [22, 70], mob: 'drake', count: 7,
    desc: '어린 용들이 둥지를 튼 최종 사냥터' },
]
const MAP_BY_ID = Object.fromEntries(MAPS.map((m) => [m.id, m]))

/* 몬스터 원형 — 맵마다 종류·레벨·스펙이 다르다 */
const MOB_TYPES = {
  rabbit: { name: '토끼', lv: 1, hp: 22, dmg: 0, exp: 60, gold: 6, spd: 0, aggro: false, color: '#ffffff', range: 0, cool: 0, windup: 0 },
  goblin: { name: '고블린', lv: 10, hp: 130, dmg: 12, exp: 300, gold: 24, spd: 3.5, aggro: true, color: '#6f9440', range: 2.4, cool: 1.6, windup: 0.5 },
  wolf: { name: '굶주린 늑대', lv: 18, hp: 240, dmg: 21, exp: 680, gold: 44, spd: 5.4, aggro: true, color: '#7d7d8c', range: 2.4, cool: 1.2, windup: 0.38 },
  imp: { name: '화염 임프', lv: 28, hp: 420, dmg: 32, exp: 1400, gold: 78, spd: 4.4, aggro: true, color: '#e2603a', range: 2.6, cool: 1.1, windup: 0.42 },
  wraith: { name: '심연 망령', lv: 38, hp: 700, dmg: 46, exp: 2800, gold: 130, spd: 4.8, aggro: true, color: '#8b6ad6', range: 2.8, cool: 1.0, windup: 0.4 },
  drake: { name: '어린 용', lv: 50, hp: 1200, dmg: 66, exp: 5600, gold: 240, spd: 5.0, aggro: true, color: '#c04a3c', range: 3.2, cool: 1.15, windup: 0.5 },
}

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

/* 방사형 좌표 계산 (SVG viewBox 400×400, 중심 200,200) */
const WEB_CENTER = 200
const webRadius = (tier) => 30 + tier * 25
function webPos(tier, idx) {
  if (tier === 0) return { x: WEB_CENTER, y: WEB_CENTER }
  const per = 3
  const base = -Math.PI / 2                       // 12시 방향부터
  const spin = tier * 0.28                        // 레이어마다 살짝 비틀어 거미줄 느낌
  const a = base + (idx / per) * Math.PI * 2 + spin
  const r = webRadius(tier)
  return { x: WEB_CENTER + Math.cos(a) * r, y: WEB_CENTER + Math.sin(a) * r }
}

/* 한 직업의 전체 웹 노드 목록 (스킬 + 특성) */
function webNodesFor(clsId) {
  const nodes = [{ id: `${clsId}_t0`, kind: 'skill', tier: 0, idx: 0, ...webPos(0, 0) }]
  for (let t = 1; t <= MAX_TIER; t++) {
    nodes.push({ id: `${clsId}_t${t}`, kind: 'skill', tier: t, idx: 0, ...webPos(t, 0) })
    WEB_STATS[t - 1].forEach((s, i) => {
      nodes.push({ id: webStatId(clsId, t, s.k), kind: 'stat', tier: t, idx: i + 1, stat: s, ...webPos(t, i + 1) })
    })
  }
  return nodes
}
/* 웹 연결선 — 방사(스포크) + 동심(테두리) */
function webLinks(nodes) {
  const links = []
  const at = (tier, idx) => nodes.find((n) => n.tier === tier && n.idx === idx)
  for (let t = 1; t <= MAX_TIER; t++) {
    for (let i = 0; i < 3; i++) {
      const cur = at(t, i)
      const prev = t === 1 ? at(0, 0) : at(t - 1, i)
      if (cur && prev) links.push({ a: prev, b: cur, tier: t })
      const nxt = at(t, (i + 1) % 3)
      if (cur && nxt) links.push({ a: cur, b: nxt, tier: t, ring: true })
    }
  }
  return links
}

/* 몬스터 크기 배율 */
const MOB_SCALE = { rabbit: 1, goblin: 1, wolf: 1.1, imp: 1, wraith: 1.15, drake: 1.35 }
/* ==================================================================
   유틸
   ================================================================== */
const lerp = THREE.MathUtils.lerp
const clamp = THREE.MathUtils.clamp
const smooth = (t) => t * t * (3 - 2 * t)
const damp = (lambda, dt) => 1 - Math.exp(-lambda * dt)
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

function angleDiff(a, b) {
  let d = a - b
  d = ((((d + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI
  return d
}
function dampAngle(cur, target, lambda, dt) { return cur + angleDiff(target, cur) * damp(lambda, dt) }
const inZone = (x, z, zone) => dist2(x, z, zone.x, zone.z) <= zone.r

const loadJSON = (key, fallback) => {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback } catch { return fallback }
}
const saveJSON = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* 무시 */ }
}

/* ==================================================================
   모바일 지원 — 기기 선택 · 터치 입력 · 가상 조이스틱 / 버튼
   ================================================================== */
const LS_DEVICE = 'device_mode_v1'

/* 터치 입력 싱글턴.
   조이스틱·버튼이 값을 쓰고, 각 게임의 물리 코드가 키보드 입력과 합쳐 읽는다.
   라우트당 게임이 하나만 마운트되므로 전역 하나로 충분하다. */
const TOUCH = {
  mx: 0, my: 0,          // 이동 조이스틱 (-1 ~ 1)
  run: false,
  clear() { this.mx = 0; this.my = 0; this.run = false },
}

const DeviceCtx = createContext('pc')
const useIsMobile = () => useContext(DeviceCtx) === 'mobile'

/* 기기 자동 추정 — 선택 화면의 '추천' 표시에만 쓴다 (강제하지 않음) */
function guessMobile() {
  try {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
  } catch { return false }
}

/* ------------------------------------------------------------------
   가상 조이스틱 — 아날로그 입력 (살짝 밀면 걷고, 끝까지 밀면 전력)
   ------------------------------------------------------------------ */
function VirtualJoystick({ onVec, size = 128, tint = 'rgba(255,255,255,.75)' }) {
  const pad = useRef(null)
  const knob = useRef(null)
  const pid = useRef(null)
  const R = size * 0.33

  const apply = (cx, cy) => {
    const el = pad.current
    if (!el) return
    const r = el.getBoundingClientRect()
    let dx = cx - (r.left + r.width / 2)
    let dy = cy - (r.top + r.height / 2)
    const len = Math.hypot(dx, dy)
    if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R }
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`
    onVec(dx / R, dy / R)
  }
  const reset = () => {
    pid.current = null
    if (knob.current) knob.current.style.transform = 'translate(0px, 0px)'
    onVec(0, 0)
  }
  /* 게임을 벗어나도 입력이 남지 않도록 정리 */
  useEffect(() => () => onVec(0, 0), [onVec])

  return (
    <div
      data-ui
      ref={pad}
      onPointerDown={(e) => {
        e.preventDefault()
        pid.current = e.pointerId
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* 무시 */ }
        apply(e.clientX, e.clientY)
      }}
      onPointerMove={(e) => { if (pid.current === e.pointerId) apply(e.clientX, e.clientY) }}
      onPointerUp={(e) => { if (pid.current === e.pointerId) reset() }}
      onPointerCancel={reset}
      onContextMenu={(e) => e.preventDefault()}
      style={{ width: size, height: size, touchAction: 'none' }}
      className="relative select-none rounded-full border-2 border-white/25 bg-black/35 backdrop-blur-sm"
    >
      <div
        ref={knob}
        style={{
          width: size * 0.44, height: size * 0.44,
          marginLeft: -size * 0.22, marginTop: -size * 0.22,
          background: tint,
        }}
        className="absolute left-1/2 top-1/2 rounded-full border border-white/50 shadow-lg"
      />
    </div>
  )
}

/* ------------------------------------------------------------------
   터치 버튼 — 누르는 순간/떼는 순간을 각각 알려준다
   ------------------------------------------------------------------ */
function TouchBtn({ onPress, onRelease, label, sub, size = 78, bg, border, disabled, textSize = 'text-base' }) {
  return (
    <button
      data-ui
      disabled={disabled}
      onPointerDown={(e) => { e.preventDefault(); if (!disabled && onPress) onPress() }}
      onPointerUp={() => { if (onRelease) onRelease() }}
      onPointerCancel={() => { if (onRelease) onRelease() }}
      onPointerLeave={() => { if (onRelease) onRelease() }}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        width: size, height: size, touchAction: 'none',
        background: bg || 'rgba(255,255,255,.14)',
        borderColor: border || 'rgba(255,255,255,.32)',
      }}
      className={`flex select-none flex-col items-center justify-center rounded-full border-2 font-black text-white backdrop-blur-sm transition active:scale-90 disabled:opacity-35 ${textSize}`}
    >
      <span className="leading-none">{label}</span>
      {sub && <span className="mt-0.5 text-[9px] font-bold leading-none opacity-75">{sub}</span>}
    </button>
  )
}

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
function makeRune(save, gradeMax = 3) {
  const opt = pick(RUNE_OPTS)
  const g = rollGrade(gradeMax)
  const gr = gradeOf(g)
  const value = +(opt.base * gr.mult).toFixed(1)
  return {
    uid: save.uid++, kind: 'rune', grade: g, stat: opt.key, value,
    name: `${RUNE_PREFIX[Math.min(3, g)]} ${opt.name} 룬`,
  }
}
function makeArmor(save, gradeMax = 3) {
  const slot = pick(ARMOR_SLOTS)
  const setKey = pick(ARMOR_SET_KEYS)
  const g = rollGrade(gradeMax)
  const gr = gradeOf(g)
  const value = +(slot.base * gr.mult).toFixed(1)
  return {
    uid: save.uid++, kind: 'armor', grade: g, slot: slot.key, set: setKey,
    stat: slot.stat, value,
    name: `${ARMOR_SETS[setKey].name} ${slot.name}`,
  }
}
function makeWeapon(save, gradeMax = 3, wtypeForce) {
  const wtype = wtypeForce || pick(WEAPON_KEYS)
  const wt = WEAPON_TYPES[wtype]
  const g = rollGrade(gradeMax)
  const gr = gradeOf(g)
  const atk = Math.round(wt.atk * gr.mult)
  return {
    uid: save.uid++, kind: 'weapon', grade: g, wtype, atk,
    name: `${gradeOf(g).name} ${wt.name}`,
  }
}
function makeArtifact(save, gradeMax = 5) {
  const eff = pick(ARTIFACT_EFFECTS)
  const g = rollGrade(gradeMax)
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

  /* 1) 스킬 패시브 (티어3 강화 · 티어6 각성) */
  const list = SKILLS[cls.id] || []
  list.forEach((sk) => {
    const lv = save.skills[sk.id] || 0
    if (!lv || sk.type !== 'passive') return
    if (sk.tier === 3) {
      st.skillRange += PASSIVE_T3.rangePer * lv
      st.skillDmg += PASSIVE_T3.dmgPer * lv
    } else if (sk.tier === 6) {
      st.critRate += PASSIVE_T6.critPer * lv
      st.awakenAtk = (st.awakenAtk || 0) + PASSIVE_T6.atkPer * lv
      st.awakenHp = (st.awakenHp || 0) + PASSIVE_T6.hpPer * lv
    }
  })

  /* 1-b) 거미줄 특성 노드 */
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

/* 레벨업 — 튜토리얼 완료(unlocked) 전에는 경험치가 쌓이지 않는다 */
function applyExp(save, amount) {
  const events = []
  if (!save.unlocked) return events
  save.exp += Math.max(0, Math.round(amount))
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
    const spdMul = 1 + (st.moveSpd || 0) / 100
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

    const horiz = Math.cos(cam.pitch) * CAM_DIST
    camGoal.set(
      g.position.x + Math.sin(cy) * horiz,
      g.position.y + LOOK_HEIGHT + Math.sin(cam.pitch) * CAM_DIST,
      g.position.z + Math.cos(cy) * horiz,
    )
    if (!snapped.current) { camera.position.copy(camGoal); snapped.current = true }
    else camera.position.lerp(camGoal, damp(CAM_LAMBDA, dt))
    lookAt.set(g.position.x, g.position.y + LOOK_HEIGHT, g.position.z)
    camera.lookAt(lookAt)
  })

  return (
    <group ref={root}>
      <CharacterBody cls={cls} wtype={wtype} armPivot={armPivot} tint={false} gradeColor={gradeColor} awakened={awakened} />
    </group>
  )
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
  const maxHp = T.hp
  const hp = useRef(T.hp)
  const flash = useRef(0); const dieT = useRef(0); const goneT = useRef(0)
  const fired = useRef({ kill: false, resp: false })
  const knock = useRef({ x: 0, z: 1, t: 0 })
  const dieDir = useRef({ x: 0, z: 1 })
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

  const onHit = useCallback((dir, dmg) => {
    if (phase.current !== 'alive') return
    flash.current = HIT_FLASH
    hp.current -= dmg
    knock.current = { x: dir.x, z: dir.z, t: 0.18 }
    if (T.aggro) ai.current.cool = Math.min(ai.current.cool, 0.3)   // 맞으면 즉각 반응
    if (hp.current <= 0) { phase.current = 'dying'; dieDir.current = dir; dieT.current = 0 }
  }, [T.aggro])
  const onHitRef = useRef(onHit); onHitRef.current = onHit

  useEffect(() => {
    const reg = world.current.mobs
    const me = { x: entry.x, z: entry.z, alive: true, type: entry.type, hit: (dir, dmg) => onHitRef.current(dir, dmg) }
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

    if (hpFg.current) {
      const r = Math.max(0, hp.current) / maxHp
      hpFg.current.scale.x = Math.max(0.001, r)
      hpFg.current.position.x = -0.43 * (1 - r)
      hpFg.current.material.color.set(r > 0.6 ? '#4ade80' : r > 0.34 ? '#facc15' : '#f87171')
    }
    if (hpBar.current) hpBar.current.visible = phase.current === 'alive'

    if (phase.current === 'alive') {
      const P = pos.current
      const pl = world.current.player
      const dx = pl.x - P.x, dz = pl.z - P.z
      const d = Math.hypot(dx, dz)
      if (knock.current.t > 0) knock.current.t = Math.max(0, knock.current.t - dt)
      const kk = smooth(knock.current.t / 0.18) * 0.4

      if (T.aggro && !live.current.dead) {
        const A = ai.current
        if (A.cool > 0) A.cool -= dt
        face.current = dampAngle(face.current, Math.atan2(dx, dz), 7, dt)
        if (A.mode === 'idle') {
          if (d < 14 && d > T.range) {
            const half = world.current.half
            P.x = clamp(P.x + (dx / (d || 1)) * T.spd * dt, -half, half)
            P.z = clamp(P.z + (dz / (d || 1)) * T.spd * dt, -half, half)
          } else if (d <= T.range && A.cool <= 0) { A.mode = 'windup'; A.t = 0 }
        } else if (A.mode === 'windup') {
          A.t += dt
          if (A.t >= T.windup) {
            A.mode = 'idle'; A.cool = T.cool
            const dd = Math.hypot(pl.x - P.x, pl.z - P.z)
            if (dd <= T.range + 0.6) world.current.hitPlayer(T.dmg + Math.floor(Math.random() * Math.max(1, T.dmg * 0.25)))
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
      const me = meRef.current; if (me) { me.x = g.position.x; me.z = g.position.z; me.alive = true }
      return
    }

    if (phase.current === 'dying') {
      const me = meRef.current; if (me) me.alive = false
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
        if (!fired.current.kill) { fired.current.kill = true; onKill(entry) }
      }
      return
    }
    goneT.current += dt
    if (goneT.current >= RESPAWN_TIME && !fired.current.resp) { fired.current.resp = true; onRespawn(entry.id) }
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
function GameScreen({ account, cls, addToast, onChangeClass }) {
  const isMobile = useIsMobile()
  const rpgSetVec = useCallback((x, y) => { TOUCH.mx = x; TOUCH.my = y }, [])
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
  })
  const world = useRef({
    player: { x: 0, z: 3, yaw: 0 },
    mobs: new Map(), targets: new Map(), dummies: new Map(), fragments: new Map(),
    bot: null, half: MAP_BY_ID[S.current.map || 0].half, teleport: null,
    tutorLock: !S.current.unlocked, onEdge: null, portals: portalsFor(S.current.map || 0),
  })
  const camRef = useRef({ yaw: Math.PI, pitch: 0.62 })
  const swing = useRef({ t: -1, hitDone: true, impact: null })
  const controlRef = useRef({ lock: false })

  const [, setTick] = useState(0)
  const bumpHud = useCallback(() => setTick((t) => t + 1), [])

  const [mode, setMode] = useState('field')
  const modeRef = useRef(mode); modeRef.current = mode
  const [mapId, setMapId] = useState(() => S.current.map || 0)
  const mapIdRef = useRef(mapId); mapIdRef.current = mapId
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

  const onMobKill = useCallback((entry) => {
    const s = S.current
    const st = statsRef.current
    s.kills += 1
    const mt = MOB_TYPES[(entry && entry.type) || 'rabbit']
    s.gold += Math.round((mt.gold + Math.floor(Math.random() * (mt.gold * 0.4 + 2))) * (1 + st.goldGain / 100))
    /* 튜토리얼: 토끼 간 */
    if (s.tutorial === 'active' && s.livers < LIVER_NEED && Math.random() < LIVER_DROP) {
      s.livers += 1
      addToast(`🥩 토끼 간 획득! (${s.livers}/${LIVER_NEED})`)
      if (s.livers >= LIVER_NEED) addToast('📜 다 모았다 — 이장에게 돌아가자!')
    }
    const ev = applyExp(s, mt.exp * (1 + st.expGain / 100))
    if (s.unlocked) {
      if (Math.random() < RUNE_DROP) addItem(makeRune(s))
      else if (Math.random() < GEAR_DROP) addItem(Math.random() < 0.5 ? makeArmor(s) : makeWeapon(s))
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
    if (Math.random() * 100 < st.dodge) { addToast('✨ 회피!'); return }
    let dmg = rawDmg * (1 - defReduce(st.defense)) * (1 - st.dmgReduce / 100)
    dmg = Math.max(1, Math.round(dmg))
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
      const lost = Math.floor(S.current.gold * 0.1)
      S.current.gold -= lost; commit()
      setDeath({ lost, arena: modeRef.current === 'arena' })
    }
  }, [cls, commit, bumpHud, addToast])
  world.current.hitPlayer = hitPlayer

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
    return hits
  }, [])

  const onImpact = useCallback(() => {
    const p = world.current.player
    const st = statsRef.current
    const L = live.current
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
  const castSkillSlot = useCallback((slot) => {
    const L = live.current
    if (L.dead || controlRef.current.lock) return
    const s = S.current
    if (!s.unlocked) { lockedNotice(); return }
    const list = SKILLS[cls.id] || []
    const sk = list.find((x) => x.type === 'active' && x.slot === slot)
    if (!sk) return
    if (s.tier < sk.tier) { addToast(`🔒 ${JOB_TIERS[sk.tier].title} 이후 사용할 수 있습니다`); return }
    const lv = s.skills[sk.id] || 0
    if (lv <= 0) { addToast(`🔒 [${sk.name}] 스킬을 먼저 배워야 합니다 (K)`); return }
    if ((L.cd[sk.id] || 0) > 0) return
    const st = statsRef.current
    L.cd[sk.id] = sk.cd
    const p = world.current.player
    const mul = sk.dmgMul + sk.dmgPer * (lv - 1)
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
  }, [cls, applyArea, pushFx, addToast, bumpHud, lockedNotice])
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
    const price = Math.round((10 + item.grade * 25) * (item.kind === 'artifact' ? 3 : 1))
    s.bag = s.bag.filter((b) => b.uid !== item.uid)
    s.gold += price
    commit()
    addToast(`💰 ${item.name} 판매 (+${price} G)`)
  }, [commit, addToast])

  /* ---------- 스킬 배우기 ---------- */
  const investSkill = useCallback((nodeId) => {
    const s = S.current
    if (!s.unlocked) { lockedNotice(); return }
    const node = webNodesFor(cls.id).find((n) => n.id === nodeId)
    if (!node) return
    if (s.tier < node.tier) { addToast('[' + JOB_TIERS[node.tier].title + ']이 필요합니다'); return }
    const cur = s.skills[nodeId] || 0
    const isSkill = node.kind === 'skill'
    const max = isSkill ? skillMaxLv(SKILL_BY_ID[nodeId], s.tier) : WEB_STAT_MAX
    const label = isSkill ? SKILL_BY_ID[nodeId].name : node.stat.name
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

  const finishTutorial = useCallback(() => {
    const s = S.current
    if (s.livers < LIVER_NEED) return
    s.tutorial = 'done'
    s.unlocked = true
    s.gold += 300
    s.sp += 1
    commit()
    world.current.tutorLock = false
    addToast('🎉 튜토리얼 완료! 모든 콘텐츠가 해금되었습니다')
    addToast('✨ SP +1 · 골드 +300 — 이제 레벨업과 전직이 가능합니다')
    setNpcModal(null)
  }, [commit, addToast])

  /* 상인 구매 */
  const buyItem = useCallback((entry) => {
    const s = S.current
    if (!s.unlocked) { lockedNotice(); return }
    if (s.gold < entry.price) { addToast('골드가 부족합니다'); return }
    s.gold -= entry.price
    if (entry.key === 'sp') { s.sp += 1; addToast('📖 깨달음의 서 — SP +1') }
    else if (entry.key === 'rune') addItem(makeRune(s))
    else if (entry.key === 'armor') addItem(makeArmor(s))
    else if (entry.key === 'weapon') addItem(makeWeapon(s, 3, cls.weapon))
    else addItem(makeArtifact(s))
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
    s.jobQuest[npc.id] = { state: 'active', base: s.kills }
    commit()
    addToast(`📜 전직 시험 시작 — 몬스터 ${jobQuestNeed(s.tier + 1)}마리 처치`)
    setNpcModal(null)
  }, [commit, addToast])

  const completeJobQuest = useCallback((npc) => {
    const s = S.current
    const next = canAdvance(s)
    if (!next) return
    const q = s.jobQuest[npc.id]
    if (!q || q.state !== 'active') return
    const need = jobQuestNeed(next.tier)
    if (s.kills - q.base < need) return
    s.jobQuest[npc.id] = { state: 'none', base: 0 }
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
  const changeClass = useCallback((newId) => {
    const s = S.current
    if (!s.unlocked) { lockedNotice(); return }
    if (newId === cls.id) { addToast('이미 해당 직업입니다'); return }
    const nc = CLASS_BY_ID[newId]
    if (!nc) return
    let refund = 0
    Object.keys(s.skills).forEach((k) => { if (k.startsWith(cls.id + '_')) refund += s.skills[k] })
    const kept = {}
    Object.keys(s.skills).forEach((k) => { if (!k.startsWith(cls.id + '_')) kept[k] = s.skills[k] })
    s.skills = kept
    s.sp += refund
    const w = s.equip.weapon
    if (w && !WEAPON_TYPES[w.wtype].classes.includes(newId)) { s.bag.push(w); s.equip.weapon = null }
    commit()
    live.current.cd = {}
    addToast('[' + nc.name + ']로 직업을 변경했습니다! SP ' + refund + ' 환급')
    setNpcModal(null)
    onChangeClass(newId)
  }, [cls, commit, addToast, lockedNotice, onChangeClass])

  /* ---------- PVP ---------- */
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
    s.gold += Math.round(diff.gold * (1 + st.goldGain / 100))
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
      const n = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Digit5: 5 }[e.code]
      if (n) { castRef.current(n); return }
      if (e.code === 'KeyE') promptRef.current()
      else if (e.code === 'KeyI') { if (!live.current.dead) setInvOpen((v) => !v) }
      else if (e.code === 'KeyK') {
        if (live.current.dead) return
        if (!S.current.unlocked) { lockedNotice(); return }
        setTreeOpen((v) => !v)
      } else if (e.code === 'Escape') {
        setMathModal(null); setInvOpen(false); setTreeOpen(false); setNpcModal(null); setDiffModal(false)
      }
    }
    window.addEventListener('contextmenu', onContext)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('contextmenu', onContext)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [lockedNotice])

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
  const activeSkills = (SKILLS[cls.id] || []).filter((s) => s.type === 'active')
  const promptLabel = !L.prompt ? null
    : L.prompt.kind === 'altar' ? '제단에서 설교 듣기'
    : L.prompt.kind === 'portal' ? 'PVP 결투장 입장'
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
                      ? (saveUI.tutorial === 'none' ? 'none' : saveUI.tutorial === 'done' ? 'done' : (saveUI.livers >= LIVER_NEED ? 'ready' : 'active'))
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

      {/* 튜토리얼 추적 / 성장 안내 */}
      {!unlocked ? (
        <div className="pointer-events-none absolute left-1/2 top-4 w-[min(92vw,30rem)] -translate-x-1/2 rounded-2xl border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-center backdrop-blur-sm">
          <div className="text-[11px] font-black tracking-widest text-amber-200">📜 튜토리얼</div>
          <div className="text-[12px] text-white">
            {saveUI.tutorial === 'none' ? '마을 이장에게 말을 걸어보세요 (E)'
              : saveUI.livers >= LIVER_NEED ? '토끼 간을 다 모았습니다 — 이장에게 돌아가세요!'
              : `토끼를 사냥해 '토끼 간' 수집 — ${saveUI.livers} / ${LIVER_NEED}`}
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/40">
            <div className="h-full bg-amber-400 transition-[width]" style={{ width: `${(saveUI.livers / LIVER_NEED) * 100}%` }} />
          </div>
        </div>
      ) : (
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

      {/* 스킬 바 */}
      {unlocked && (
        <div data-ui className={`absolute left-1/2 flex -translate-x-1/2 gap-2 ${isMobile ? 'bottom-44 scale-90' : 'bottom-16'}`}>
          {activeSkills.map((sk) => {
            const lv = saveUI.skills[sk.id] || 0
            const tierOk = saveUI.tier >= sk.tier
            const cd = L.cd[sk.id] || 0
            const ready = tierOk && lv > 0 && cd <= 0
            return (
              <button key={sk.id} onClick={() => castSkillSlot(sk.slot)} title={`${sk.name} — ${sk.desc}`}
                className="relative h-14 w-14 overflow-hidden rounded-xl border text-center backdrop-blur-sm transition active:scale-95"
                style={{ borderColor: ready ? sk.color + 'aa' : '#ffffff22', background: ready ? sk.color + '22' : 'rgba(15,23,42,.8)' }}>
                <div className="pt-1 text-lg leading-none">{tierOk ? (lv > 0 ? '⚡' : '➕') : '🔒'}</div>
                <div className="truncate px-0.5 text-[9px] leading-tight text-slate-200">{tierOk ? sk.name : JOB_TIERS[sk.tier].title}</div>
                <div className="text-[9px] font-bold" style={{ color: sk.color }}>{lv > 0 ? `Lv.${lv}` : ''}</div>
                {cd > 0 && <div className="absolute inset-x-0 bottom-0 bg-black/70" style={{ height: `${(cd / sk.cd) * 100}%` }} />}
                {cd > 0 && <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-white">{cd.toFixed(1)}</div>}
                <div className="absolute left-1 top-0.5 text-[9px] font-bold text-slate-400">{sk.slot}</div>
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
          <b>좌클릭</b> {cls.mode === 'spell' ? '마법(수학)' : cls.mode === 'heal' ? '치유/공격' : '공격'} · <b>1~5</b> 스킬 · <b>E</b> 상호작용 · <b>I</b> 인벤토리 · <b>K</b> 스킬트리
        </div>
      )}

      {/* 모바일 터치 조작 */}
      {isMobile && !uiOpen && !L.dead && (
        <>
          <div className="absolute bottom-5 left-4 z-40">
            <VirtualJoystick size={118} onVec={rpgSetVec} />
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

      {/* ── 모달 ── */}
      {invOpen && (
        <InventoryModal save={saveUI} cls={cls} stats={stats}
          onEquip={equipItem} onUnequip={unequipItem} onSell={sellItem} onClose={() => setInvOpen(false)} />
      )}
      {treeOpen && (
        <SkillTreeModal save={saveUI} cls={cls} stats={stats} onInvest={investSkill} onClose={() => setTreeOpen(false)} />
      )}
      {npcModal && (
        <NpcModal npc={npcModal} save={saveUI} cls={cls} nick={account.nick} onChangeClass={changeClass}
          onStartTutorial={startTutorial} onFinishTutorial={finishTutorial}
          onBuy={buyItem} onAdvanceGold={advanceByGold}
          onAcceptJobQuest={acceptJobQuest} onCompleteJobQuest={completeJobQuest} onTrainSp={trainSp}
          onClose={() => setNpcModal(null)} />
      )}
      {diffModal && <DifficultyModal save={saveUI} onPick={enterArena} onClose={() => setDiffModal(false)} />}
      {mathModal && <MathModal problem={mathModal} circle={saveUI.circle} onSubmit={submitMath} onCancel={() => setMathModal(null)} />}
      {death && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-[20rem] rounded-3xl border border-red-500/30 bg-slate-900 p-7 text-center shadow-2xl [animation:pop_.4s_cubic-bezier(.2,1.6,.4,1)]">
            <div className="text-6xl">💀</div>
            <div className="mt-3 text-2xl font-black text-red-400">{death.arena ? '결투에서 패배' : '쓰러졌습니다'}</div>
            <p className="mt-3 text-sm text-slate-300">
              골드의 10% <b className="text-amber-300">🪙 {death.lost.toLocaleString()}</b> 를 잃었습니다.
            </p>
            <button onClick={revive} data-ui
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-slate-200 to-white py-3 font-black text-slate-900 transition hover:brightness-105">
              {death.arena ? '필드로 귀환' : '다시 일어나기'}
            </button>
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
  return (
    <button onClick={onClick} disabled={disabled}
      className={`w-full rounded-lg border px-2 py-1.5 text-left transition ${disabled ? 'opacity-50' : 'hover:brightness-125'}`}
      style={{ borderColor: g.color + '66', background: g.color + '14' }}>
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[11px] font-bold" style={{ color: g.color }}>{item.name}</span>
        {!compact && <span className="shrink-0 text-[9px] text-slate-400">{g.name}</span>}
      </div>
      <div className="truncate text-[10px] text-slate-300">{itemStatLine(item)}</div>
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
   거미줄 스킬트리 — 중앙에서 바깥으로 뻗는 방사형 노드 UI
   전직할 때마다 바깥 테두리(레이어)가 하나씩 해금되며 넓어진다.
   ================================================================== */
function SkillTreeModal({ save, cls, stats, onInvest, onClose }) {
  const nodes = useMemo(() => webNodesFor(cls.id), [cls.id])
  const links = useMemo(() => webLinks(nodes), [nodes])
  const [sel, setSel] = useState(`${cls.id}_t0`)
  const node = nodes.find((n) => n.id === sel) || nodes[0]
  const isSkill = node.kind === 'skill'
  const sk = isSkill ? SKILL_BY_ID[node.id] : null
  const lv = save.skills[node.id] || 0
  const max = isSkill ? skillMaxLv(sk, save.tier) : WEB_STAT_MAX
  const tierOk = save.tier >= node.tier
  const canInvest = tierOk && save.sp > 0 && lv < max
  const label = isSkill ? sk.name : node.stat.name

  const stateOf = (n) => {
    const l = save.skills[n.id] || 0
    if (save.tier < n.tier) return 'locked'
    if (l >= (n.kind === 'skill' ? skillMaxLv(SKILL_BY_ID[n.id], save.tier) : WEB_STAT_MAX)) return 'mastered'
    if (l > 0) return 'progress'
    return 'open'
  }
  const COL = { mastered: '#fbbf24', progress: '#34d399', open: '#818cf8', locked: '#3a3a50' }

  return (
    <div data-ui className="absolute inset-0 z-[55] flex items-center justify-center bg-black/72 p-3 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[94vh] w-full max-w-4xl flex-col rounded-3xl border border-white/12 bg-slate-900/96 p-5 shadow-2xl [animation:pop_.25s_cubic-bezier(.2,1.5,.4,1)]">
        <button onClick={onClose} className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">✕</button>
        <div className="mb-3 flex items-center justify-between pr-8">
          <div>
            <div className="text-lg font-black text-white">🕸 {cls.name} 거미줄 스킬트리</div>
            <div className="text-[11px] text-slate-400">
              현재 <b style={{ color: cls.color }}>[{JOB_TIERS[save.tier].name}] {JOB_TIERS[save.tier].title}</b>
              {save.tier < MAX_TIER
                ? <> · 다음 <b className="text-amber-300">{JOB_TIERS[save.tier + 1].title}</b>(Lv.{JOB_TIERS[save.tier + 1].reqLv}) 시 바깥 테두리 해금</>
                : <> · <b className="text-fuchsia-300">모든 테두리 해금 완료</b></>}
            </div>
          </div>
          <div className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm font-black text-emerald-300">SP {save.sp}</div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto sm:grid-cols-[1fr_15rem]">
          {/* 방사형 웹 */}
          <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#080b14]">
            <svg viewBox="0 0 400 400" className="h-full w-full">
              {/* 해금된 테두리(동심원) 가이드 */}
              {[1, 2, 3, 4, 5, 6].map((t) => (
                <circle key={t} cx={WEB_CENTER} cy={WEB_CENTER} r={webRadius(t)} fill="none"
                  stroke={save.tier >= t ? '#6366f1' : '#ffffff'}
                  strokeOpacity={save.tier >= t ? 0.16 : 0.05} strokeWidth="1" strokeDasharray={save.tier >= t ? '0' : '3 5'} />
              ))}
              {/* 거미줄 실 */}
              {links.map((l, i) => {
                const on = save.tier >= l.tier
                return (
                  <line key={i} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y}
                    stroke={on ? (l.ring ? '#4f46e5' : '#6366f1') : '#252538'}
                    strokeWidth={on ? (l.ring ? 1.6 : 2.4) : 1.2}
                    strokeDasharray={on ? '0' : '4 4'} strokeOpacity={on ? 0.85 : 0.7} />
                )
              })}
              {/* 노드 */}
              {nodes.map((n) => {
                const stt = stateOf(n)
                const l = save.skills[n.id] || 0
                const isSel = sel === n.id
                const r = n.kind === 'skill' ? (n.tier === 0 ? 19 : 16) : 12
                const nm = n.kind === 'skill' ? SKILL_BY_ID[n.id].name : n.stat.name
                return (
                  <g key={n.id} style={{ cursor: 'pointer' }} onClick={() => setSel(n.id)}>
                    {isSel && <circle cx={n.x} cy={n.y} r={r + 6} fill="none" stroke={COL[stt]} strokeWidth="2" opacity="0.65" />}
                    <circle cx={n.x} cy={n.y} r={r} fill={stt === 'locked' ? '#12121e' : COL[stt] + '30'} stroke={COL[stt]} strokeWidth={isSel ? 3 : 2} />
                    <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={n.kind === 'skill' ? 12 : 10} fill={COL[stt]} fontWeight="bold">
                      {stt === 'locked' ? '🔒' : stt === 'mastered' ? '★' : String(l)}
                    </text>
                    {stt !== 'locked' && (
                      <text x={n.x} y={n.y + r + 11} textAnchor="middle" fontSize="8.5" fill="#94a3b8" fontWeight="600">{nm}</text>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>

          {/* 상세 */}
          <div className="flex h-fit flex-col rounded-2xl border border-white/8 bg-slate-800/50 p-4">
            <div className="text-base font-black text-white">{tierOk ? label : '잠긴 노드'}</div>
            <div className="mt-0.5 text-[11px]" style={{ color: cls.color }}>
              {JOB_TIERS[node.tier].title} · {isSkill ? (sk.type === 'active' ? `액티브 [${sk.slot}]` : '패시브') : '특성'}
            </div>
            <div className="mt-3 rounded-lg bg-black/30 px-3 py-2 text-xs leading-relaxed text-slate-300">
              {!tierOk ? `${JOB_TIERS[node.tier].title}(Lv.${JOB_TIERS[node.tier].reqLv}) 이후 해금됩니다.`
                : isSkill ? sk.desc
                : `${node.stat.name} — ${node.stat.stat} +${node.stat.per}${node.stat.unit} / 레벨`}
            </div>
            {tierOk && (
              <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                <div>레벨 <b className="text-white">{lv} / {max}</b></div>
                {isSkill && sk.type === 'active' && (
                  <>
                    <div>피해 배율 <b className="text-white">×{(sk.dmgMul + sk.dmgPer * Math.max(0, lv - 1)).toFixed(2)}</b></div>
                    <div>범위 <b className="text-white">{(sk.range * (1 + stats.skillRange)).toFixed(1)}</b> · 쿨 <b className="text-white">{sk.cd}s</b></div>
                  </>
                )}
                {isSkill && sk.type === 'passive' && sk.tier === 3 && (
                  <div>스킬 범위 <b className="text-white">+{(PASSIVE_T3.rangePer * 100 * lv).toFixed(0)}%</b> · 피해 <b className="text-white">+{(PASSIVE_T3.dmgPer * 100 * lv).toFixed(0)}%</b></div>
                )}
                {isSkill && sk.type === 'passive' && sk.tier === 6 && (
                  <div className="text-amber-300">★ 각성 — 오라 발현 · 공/체/치명 극대화</div>
                )}
                {!isSkill && (
                  <div>현재 보너스 <b className="text-white">+{(node.stat.per * lv).toFixed(1)}{node.stat.unit}</b></div>
                )}
              </div>
            )}
            <button onClick={() => onInvest(node.id)} disabled={!canInvest}
              className={`mt-4 w-full rounded-xl py-2.5 text-sm font-bold transition ${
                canInvest ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:brightness-110' : 'cursor-not-allowed bg-slate-700/50 text-slate-500'
              }`}>
              {!tierOk ? '🔒 전직 필요' : lv >= max ? '✓ 최대 레벨' : save.sp < 1 ? 'SP 부족' : `SP 1 투자 (Lv.${lv} → ${lv + 1})`}
            </button>
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
function NpcModal({ npc, save, cls, nick, onChangeClass, onStartTutorial, onFinishTutorial, onBuy,
  onAdvanceGold, onAcceptJobQuest, onCompleteJobQuest, onTrainSp, onClose }) {
  const isMobile = useIsMobile()
  const next = canAdvance(save)
  const jq = save.jobQuest[npc.id]
  const questNeed = next ? jobQuestNeed(next.tier) : 0
  const questCur = jq && jq.state === 'active' ? Math.min(questNeed, save.kills - jq.base) : 0

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

        {/* ── 마을 이장 (튜토리얼) ── */}
        {npc.role === 'chief' && (
          <>
            {save.tutorial === 'none' && (
              <>
                <p className="mt-4 rounded-xl bg-black/30 p-3 text-sm leading-relaxed text-slate-200">
                  “{nick} 환영한다네! 먼저 움직이는 법(<b className="text-amber-300">{isMobile ? '왼쪽 조이스틱' : 'W, A, S, D'}</b>)과 시점 돌리는 법(<b className="text-amber-300">{isMobile ? '빈 화면 드래그' : '우클릭 드래그'}</b>)을 익혀보게.
                  준비가 되면 주변의 토끼를 사냥해 <b className="text-amber-300">‘토끼 간’ 10개</b>를 구해오게나.”
                </p>
                <div className="mt-3 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                  ⚠ 튜토리얼을 완료하기 전까지 레벨업 · 맵 탐험 · 전직 · 수련관 · 신전 · 스킬트리가 잠겨 있습니다.
                </div>
                <button onClick={onStartTutorial}
                  className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 font-bold text-white transition hover:brightness-110">
                  📜 알겠습니다, 다녀오겠습니다
                </button>
              </>
            )}
            {save.tutorial === 'active' && save.livers < LIVER_NEED && (
              <>
                <p className="mt-4 rounded-xl bg-black/30 p-3 text-sm leading-relaxed text-slate-200">
                  “아직 부족하구먼. 토끼를 더 사냥해 <b className="text-amber-300">토끼 간</b>을 모아오게. 조급해할 것 없네.”
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/50">
                  <div className="h-full bg-amber-400" style={{ width: `${(save.livers / LIVER_NEED) * 100}%` }} />
                </div>
                <div className="mt-1 text-right text-[11px] font-bold text-white">{save.livers} / {LIVER_NEED}</div>
                <button onClick={onClose} className="mt-4 w-full rounded-xl border border-white/15 py-3 font-bold text-slate-200 transition hover:bg-white/5">알겠습니다</button>
              </>
            )}
            {save.tutorial === 'active' && save.livers >= LIVER_NEED && (
              <>
                <p className="mt-4 rounded-xl bg-black/30 p-3 text-sm leading-relaxed text-slate-200">
                  “오오, 벌써 다 모았는가! 훌륭하네. 이제 자네는 어엿한 모험가일세 —
                  <b className="text-violet-300"> 레벨</b>과 <b className="text-violet-300">전직</b>, 그리고 바깥 세상이 모두 열릴 걸세!”
                </p>
                <button onClick={onFinishTutorial}
                  className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 font-black text-white transition hover:brightness-110">
                  🎉 보상 받기 — 전 콘텐츠 해금
                </button>
              </>
            )}
            {save.tutorial === 'done' && (
              <>
                <p className="mt-4 rounded-xl bg-black/30 p-3 text-sm leading-relaxed text-slate-200">
                  “자네 덕분에 마을이 평화롭다네. 상인에게 물건도 사고, 자네 직업의 <b className="text-amber-300">전직관</b>도 찾아가 보게.
                  10레벨마다 전직할 수 있으니 잊지 말게!”
                </p>
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
        )}

        {/* ── 직업 변경관 ── */}
        {npc.role === 'changer' && (
          <>
            <p className="mt-4 rounded-xl bg-black/30 p-3 text-sm leading-relaxed text-slate-200">
              “<b className="text-cyan-300">{nick}</b>, 이름은 평생 따라다니지만 길은 언제든 바꿀 수 있다네.
              원한다면 지금의 <b style={{ color: cls.color }}>{cls.name}</b>를 버리고 다른 길을 걸어보게.”
            </p>
            <div className="mt-2 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-[11px] leading-relaxed text-cyan-200">
              ⚠ 닉네임은 <b>영구 고정</b>이라 변경할 수 없습니다.<br />
              직업을 바꾸면 이전 직업 스킬에 쓴 <b>SP는 전액 환급</b>되고, 레벨·전직 단계·아이템은 유지됩니다.
            </div>
            <div className="mt-3 grid max-h-[46vh] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {CLASSES.map((c) => {
                const cur = c.id === cls.id
                return (
                  <button key={c.id} onClick={() => onChangeClass(c.id)} disabled={cur}
                    className={`rounded-xl border p-3 text-left transition ${cur ? 'cursor-default opacity-70' : 'hover:brightness-125'}`}
                    style={{ borderColor: c.color + (cur ? '99' : '44'), background: c.color + (cur ? '22' : '10') }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{c.icon}</span>
                      <span className="text-sm font-bold" style={{ color: c.color }}>{c.name}</span>
                      {cur && <span className="ml-auto text-[10px] font-bold text-white/70">현재 직업</span>}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">{c.role} · {WEAPON_TYPES[c.weapon].name}</div>
                    <div className="mt-1 text-[10px] leading-snug text-slate-300">{c.growHint}</div>
                  </button>
                )
              })}
            </div>
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
                        ⚔ 시험 받기 (몬스터 {questNeed}마리 처치)
                      </button>
                    ) : (
                      <>
                        <div className="mt-3 rounded-xl bg-black/30 p-3">
                          <div className="text-[11px] text-slate-400">전직 시험 — 몬스터 처치</div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/50">
                            <div className="h-full bg-emerald-400" style={{ width: `${(questCur / questNeed) * 100}%` }} />
                          </div>
                          <div className="mt-1 text-right text-[11px] font-bold text-white">{questCur} / {questNeed}</div>
                        </div>
                        <button onClick={() => onCompleteJobQuest(npc)} disabled={questCur < questNeed}
                          className={`mt-2 w-full rounded-xl py-3 font-bold transition ${
                            questCur >= questNeed ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:brightness-110' : 'cursor-not-allowed bg-slate-700/50 text-slate-500'
                          }`}>
                          {questCur >= questNeed ? '⭐ 시험 통과 — 전직하기' : '아직 부족합니다'}
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

  const cls = CLASS_BY_ID[account?.cls] || null
  const view = screen === 'GAME' && !cls ? 'CLASS_SELECT' : screen

  return (
    <div className="fixed inset-0 bg-slate-950 font-sans">
      {view === 'LOGIN' && <LoginScreen onCreate={createAccount} />}
      {view === 'CLASS_SELECT' && account && <ClassSelectScreen nick={account.nick} onPick={pickClass} />}
      {view === 'GAME' && account && cls && (
        <GameScreen key={cls.id} account={account} cls={cls} addToast={addToast} onChangeClass={changeClass} />
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
    /* Shift는 시프트락(마우스 조준) 전용이라 달리기는 Ctrl로 옮겼다 */
    const MAP = {
      KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b',
      KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
      ControlLeft: 'run', ControlRight: 'run',
    }
    const onDown = (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return
      if (e.code === 'Space') {
        e.preventDefault()                       // 스페이스로 페이지가 스크롤되지 않게
        if (!e.repeat) live.current.jumpBuf = TW_BUFFER
        live.current.jumpHeld = true
        return
      }
      const k = MAP[e.code]
      if (!k) return
      if (e.code.startsWith('Arrow')) e.preventDefault()
      keys.current[k] = true
    }
    const onUp = (e) => {
      if (e.code === 'Space') { live.current.jumpHeld = false; return }
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
          빈 화면을 <b>드래그</b>하면 시점이 돌아갑니다</>
        ) : (
          <><b>WASD</b> 이동 · <b>Space</b> 점프 · <b>Ctrl</b> 달리기<br />
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
          <p className="mt-4 text-sm text-slate-400">세 개의 거대한 3D 세계가 당신을 기다립니다</p>
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

  /* 모바일에선 브라우저 기본 제스처(스크롤·핀치줌·더블탭줌)를 막는다 */
  useEffect(() => {
    if (device !== 'mobile') return
    const prevTouch = document.body.style.touchAction
    const prevSelect = document.body.style.userSelect
    document.body.style.touchAction = 'none'
    document.body.style.userSelect = 'none'
    const stopPinch = (e) => { if (e.touches && e.touches.length > 1) e.preventDefault() }
    document.addEventListener('touchmove', stopPinch, { passive: false })
    return () => {
      document.body.style.touchAction = prevTouch
      document.body.style.userSelect = prevSelect
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
          <Route path="*" element={<LobbyPage device={device} onChangeDevice={() => pickDevice(null)} />} />
        </Routes>
      </BrowserRouter>
    </DeviceCtx.Provider>
  )
}
