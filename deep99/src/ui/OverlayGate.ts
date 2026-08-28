/* ==================================================================
   오버레이 클릭 통과 감시자

   #overlay 는 로비·컷씬·창·엔딩을 그리는 자리이자, 캔버스를 덮는
   투명 레이어이기도 하다. 내용이 있을 때만 클릭을 받아야 한다.

   ── 실제로 있었던 버그

   overlay 를 처음부터 pointer-events:auto 로 고정해 두면, 플레이
   화면에서 비어 있는(innerHTML === '') overlay 가 캔버스보다 위에
   계속 앉아서 도끼질·사격 같은 캔버스 클릭을 전부 가로챈다. 로비·
   창은 잘 눌리니 아무도 못 알아챈다 — "게임 안에서" 클릭이 전부
   안 먹는 것으로만 보인다.

   호출하는 쪽(Panels·Lobby·Cutscene·EndScreen)마다 일일이 챙기게
   두면 새 화면을 하나 더 추가할 때 또 같은 방식으로 샌다. 그래서
   내용의 유무를 직접 지켜본다.
   ================================================================== */

/** overlay 를 물려서, 자식이 있을 때만 클릭을 받게 한다.

    MutationObserver 를 전역에서 안 찾고 overlay 가 속한 document 의
    window 에서 찾는다 — 시험은 linkedom 이 만든 별도의 window 를 쓰고
    거기엔 전역 MutationObserver 가 없다. */
export function wire(overlay: Element): void {
  sync(overlay)
  const view = overlay.ownerDocument?.defaultView as { MutationObserver?: typeof MutationObserver } | null
  const Observer = view?.MutationObserver ?? MutationObserver
  new Observer(() => sync(overlay)).observe(overlay, { childList: true })
}

/** 관찰자 없이 지금 상태만 맞출 때 (시험용) */
export function sync(overlay: Element): void {
  overlay.classList.toggle('interactive', overlay.childElementCount > 0)
}
