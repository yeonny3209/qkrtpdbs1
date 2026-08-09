/* ==================================================================
   결과 — 미리보기 · 코드 · 내려받기

   만든 것을 바로 눈으로 보여준다. 코드만 던져주면 초보자는 그게
   동작하는지조차 확인할 방법이 없다.
   ================================================================== */
import { useEffect, useMemo, useRef, useState } from 'react'
import { previewFile } from '../brain/contract.js'

export default function Result({ result, onRestart }) {
  const [tab, setTab] = useState('preview')
  const [copied, setCopied] = useState(false)
  const file = useMemo(() => previewFile(result.files), [result.files])

  /* "복사됨" 표시는 잠깐만 띄운다. 되돌리지 않으면 다음에 눌렀을 때
     방금 눌린 것인지 아까 것인지 구분이 안 된다. */
  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(id)
  }, [copied])

  const download = () => {
    const blob = new Blob([file.code], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.path
    a.click()
    /* 주소를 놓아주지 않으면 파일 내용이 메모리에 계속 남는다 */
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
        <div className="mr-auto min-w-0">
          <div className="text-[11px] font-bold tracking-widest text-violet-300">완성</div>
          <div className="truncate text-[13px] text-zinc-400">{file.path}</div>
        </div>
        <div className="flex rounded-xl border border-white/10 bg-black/40 p-0.5">
          {[['preview', '미리보기'], ['code', '코드']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition ${
                tab === id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => { navigator.clipboard?.writeText(file.code); setCopied(true) }}
          className="rounded-xl border border-white/10 px-3 py-1.5 text-[12px] font-bold text-zinc-300 transition hover:bg-white/10">
          {copied ? '복사됨' : '코드 복사'}
        </button>
        <button onClick={download}
          className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-1.5 text-[12px] font-black text-white transition hover:brightness-110">
          내려받기
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {tab === 'preview'
          ? <Preview code={file.code} />
          : <pre className="h-full overflow-auto bg-black/40 p-4 text-[11.5px] leading-relaxed text-zinc-300">
              <code>{file.code}</code>
            </pre>}
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <p className="text-[12px] leading-relaxed text-zinc-400">{result.summary}</p>
        <button onClick={onRestart}
          className="mt-3 rounded-xl border border-white/12 px-4 py-2 text-[12px] font-bold text-zinc-300 transition hover:bg-white/10">
          다른 것 만들기
        </button>
      </div>
    </div>
  )
}

/* 만들어 낸 코드를 그대로 실행해 보여준다.
   sandbox 로 가둬서, 결과물이 이 화면의 다른 부분을 건드리지 못하게 한다.
   allow-scripts 는 필요하다 (버튼이 동작해야 미리보기가 의미가 있다).
   allow-same-origin 은 주지 않는다 — 둘을 같이 주면 가둔 의미가 없어진다. */
function Preview({ code }) {
  const ref = useRef(null)

  /* srcdoc 을 바꿔도 안에서 이미 돌던 타이머·소리는 남는다.
     key 를 바꿔 프레임 자체를 새로 만들면 확실히 처음부터 시작한다. */
  const [nonce, setNonce] = useState(0)
  useEffect(() => { setNonce((n) => n + 1) }, [code])

  return (
    <div className="relative h-full">
      <iframe key={nonce} ref={ref} srcDoc={code} title="미리보기"
        sandbox="allow-scripts allow-modals"
        className="h-full w-full bg-white" />
      <button onClick={() => setNonce((n) => n + 1)}
        className="absolute right-3 top-3 rounded-lg bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white
          opacity-0 transition hover:bg-black focus:opacity-100 group-hover:opacity-100"
        style={{ opacity: 0.55 }}>
        새로고침
      </button>
    </div>
  )
}
