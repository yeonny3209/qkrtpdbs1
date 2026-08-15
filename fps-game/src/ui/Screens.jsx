/* ==================================================================
   메뉴 · 일시정지 · 게임오버

   셋 다 3D 위에 덮이는 판이다. 캔버스는 계속 살아 있고 그 위를
   가릴 뿐이라, 일시정지를 풀면 있던 자리에서 그대로 이어진다.
   ================================================================== */
import { WEAPONS, WEAPONS_BY_SLOT, SLOTS, SLOT_LABEL } from '../game/weapons.js'
import { ENEMY_TYPES } from '../game/enemies.js'

/* 무기를 어떻게 얻는지 — 안내문에만 쓰는 설명이라 여기 둔다 */
const HOW_TO_GET = {
  rifle: '2웨이브에 떨어진다',
  shotgun: '4웨이브에 떨어진다',
  pistol: '처음부터 · 탄약 무한',
  knife: '처음부터 · 탄약 없음',
}

function Shell({ children }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/78 backdrop-blur-sm">
      <div className="max-h-full w-full max-w-2xl overflow-y-auto px-8 py-10 text-white">
        {children}
      </div>
    </div>
  )
}

const KEYS = [
  ['W A S D', '이동'],
  ['마우스', '조준'],
  ['좌클릭', '발사'],
  ['R', '재장전'],
  ['Shift', '전력 질주'],
  ['Space', '점프'],
  ['1 2 3', '주무기 · 보조 · 근접'],
  ['Esc', '일시정지'],
]

export function MainMenu({ onStart, best }) {
  return (
    <Shell>
      <div className="text-center">
        <div className="text-xs tracking-[0.55em] text-rose-400">BUNKER BREAK</div>
        <h1 className="mt-2 text-5xl font-bold tracking-tight">벙커를 지켜라</h1>
        <p className="mt-3 text-white/65">
          사방에서 밀려온다. 총알은 한정돼 있고, 물러설 곳은 없다.
          <br />몇 번째 파도까지 버틸 수 있나.
        </p>
      </div>

      <button
        onClick={onStart}
        className="mt-8 w-full rounded-lg bg-rose-500 py-4 text-lg font-bold tracking-widest transition hover:bg-rose-400 active:scale-[0.99]"
      >
        시작하기
      </button>
      <p className="mt-2 text-center text-xs text-white/40">
        누르면 마우스가 화면에 잠깁니다. Esc 로 언제든 빠져나옵니다.
      </p>

      {best.wave > 0 && (
        <div className="mt-6 rounded-lg bg-white/5 p-4 text-center ring-1 ring-white/10">
          <span className="text-xs tracking-[0.3em] text-white/50">최고 기록</span>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            {best.points.toLocaleString()}점 · {best.wave}웨이브
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xs tracking-[0.3em] text-white/50">조작</h2>
          <dl className="space-y-1.5 text-sm">
            {KEYS.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <dt className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs">{k}</dt>
                <dd className="text-white/70">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h2 className="mb-3 text-xs tracking-[0.3em] text-white/50">적</h2>
          <ul className="space-y-2 text-sm">
            {Object.values(ENEMY_TYPES).map((t) => (
              <li key={t.id} className="flex items-start gap-2">
                <span
                  className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: t.color }}
                />
                <span>
                  <b>{t.name}</b>
                  <span className="text-white/55">
                    {' '}— 체력 {t.hp}
                    {t.ranged ? ' · 멀리서 쏜다' : t.knockback ? ' · 세게 밀친다' : ' · 빠르다'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <h2 className="mb-2 mt-5 text-xs tracking-[0.3em] text-white/50">무기</h2>
          <ul className="space-y-2 text-sm text-white/70">
            {SLOTS.map((slot, i) => (
              <li key={slot}>
                <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">
                  {i + 1}
                </span>
                <b className="ml-1.5 text-white">{SLOT_LABEL[slot]}</b>
                <ul className="mt-0.5 ml-6 space-y-0.5 text-xs">
                  {WEAPONS_BY_SLOT[slot].map((id) => (
                    <li key={id}>
                      {WEAPONS[id].icon} {WEAPONS[id].name}
                      <span className="text-white/45"> — {HOW_TO_GET[id]}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-white/45">
            주무기 자리는 소총과 샷건이 나눠 씁니다. 둘 다 가지고 있으면
            1 을 다시 눌러 번갈아 꺼냅니다.
          </p>
        </div>
      </div>
    </Shell>
  )
}

export function PauseScreen({ onResume, onQuit, hud, lockError }) {
  return (
    <Shell>
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-widest">잠깐 멈춤</h1>
        {hud && (
          <p className="mt-2 text-white/60">
            {hud.wave}웨이브 · {hud.points.toLocaleString()}점 · 처치 {hud.kills}
          </p>
        )}
      </div>

      {/* 마우스 잠금이 거부되면 조작이 통째로 안 먹는다. 아무 설명이
          없으면 게임이 고장 난 줄 알기 때문에 이유를 밝혀 둔다. */}
      {lockError && (
        <div className="mt-6 rounded-lg bg-amber-500/15 p-4 text-sm text-amber-200 ring-1 ring-amber-400/30">
          <b>마우스를 화면에 잠글 수 없습니다.</b>
          <p className="mt-1 text-amber-200/80">
            이 창은 마우스 잠금이 막혀 있어 시점을 돌릴 수 없습니다.
            브라우저 탭에서 직접 열면 정상적으로 조작됩니다.
          </p>
        </div>
      )}
      <button
        onClick={onResume}
        className="mt-8 w-full rounded-lg bg-emerald-500 py-4 text-lg font-bold tracking-widest transition hover:bg-emerald-400"
      >
        이어서 하기
      </button>
      <button
        onClick={onQuit}
        className="mt-3 w-full rounded-lg bg-white/10 py-3 text-sm tracking-widest text-white/70 transition hover:bg-white/15"
      >
        그만두기
      </button>
      <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        {KEYS.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3">
            <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs">{k}</span>
            <span className="text-white/60">{v}</span>
          </div>
        ))}
      </div>
    </Shell>
  )
}

export function GameOverScreen({ result, best, onRetry, onMenu }) {
  const isBest = result.points >= best.points && result.points > 0
  return (
    <Shell>
      <div className="text-center">
        <div className="text-xs tracking-[0.5em] text-rose-400">쓰러졌다</div>
        <h1 className="mt-2 text-5xl font-bold">{result.wave}웨이브</h1>
        <div className="mt-6 inline-flex flex-col items-center rounded-xl bg-white/5 px-10 py-6 ring-1 ring-white/10">
          <span className="text-xs tracking-[0.3em] text-white/50">점수</span>
          <span className="text-5xl font-bold tabular-nums">
            {result.points.toLocaleString()}
          </span>
          {isBest && (
            <span className="mt-2 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold tracking-widest text-amber-300">
              최고 기록 경신
            </span>
          )}
        </div>
        <div className="mt-4 flex justify-center gap-8 text-sm text-white/60">
          <span>처치 <b className="text-white">{result.kills}</b></span>
          <span>헤드샷 <b className="text-white">{result.headshots}</b></span>
          <span>최고 기록 <b className="text-white">{best.wave}웨이브</b></span>
        </div>
      </div>
      <button
        onClick={onRetry}
        className="mt-8 w-full rounded-lg bg-rose-500 py-4 text-lg font-bold tracking-widest transition hover:bg-rose-400"
      >
        다시 하기
      </button>
      <button
        onClick={onMenu}
        className="mt-3 w-full rounded-lg bg-white/10 py-3 text-sm tracking-widest text-white/70 transition hover:bg-white/15"
      >
        처음 화면으로
      </button>
    </Shell>
  )
}
