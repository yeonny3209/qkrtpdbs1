# 대화형 코딩 AI

질문을 몇 개 던지고, 그 답에 맞춰 **바로 실행되는 코드**를 만들어 줍니다.

```bash
npm install
npm run dev
```

## 어떻게 생겼나

```
🤖 무엇을 만들어 드릴까요?          → 할 일 목록 / 퀴즈 / 타이머 / 소개 페이지
🤖 이름을 뭐라고 할까요?
🤖 할 일 하나에 무엇까지 적을까요?   ← 할 일 목록을 골랐을 때만 나오는 질문
🤖 새로고침해도 남아 있어야 할까요?
🤖 어떤 색이 좋으세요?
                                    → ✨ 만들기 → 미리보기 · 코드 · 내려받기
```

앞의 답에 따라 다음 질문이 갈라집니다. 소개 페이지에는 저장할 내용이 없으니
저장 여부를 묻지 않는 식입니다. 이미 답한 말풍선을 누르면 그 지점으로 되돌아갑니다.

결과물은 **파일 하나짜리 HTML**입니다. 받아서 두 번 누르면 열리고, 인터넷 없이도
동작하며, 밝은 화면과 어두운 화면에 알아서 맞춥니다.

## 구조

```
src/
  brain/
    contract.js   두뇌가 지켜야 할 약속 (ask / build) + 검사기
    rules.js      규칙 기반 두뇌 — 지금 켜져 있는 쪽
    claude.js     Claude 두뇌 — 아직 안 켠 쪽, 같은 약속을 지킨다
  generate/
    theme.js      색·여백·저장·알림음 등 공통 껍데기
    todo.js quiz.js timer.js landing.js   종류별 생성기
    index.js      만들 수 있는 것들의 목록
  ui/
    Answer.jsx    답 고르는 자리 (하나 / 여러 개 / 직접 쓰기)
    Result.jsx    미리보기 · 코드 · 내려받기
  App.jsx         묻고 → 받고 → 만드는 흐름
```

핵심은 **두뇌와 화면이 분리되어 있다**는 점입니다. 화면은 `ask` 와 `build`
두 가지만 부르고, 그 안에서 무슨 일이 일어나는지 모릅니다.

## 두뇌를 Claude 로 바꾸려면

지금은 제가 미리 짜 둔 질문표로 돕니다. Claude 를 연결하면 무엇을 물을지
그때그때 정하고, 만들 수 있는 것도 네 종류에 묶이지 않습니다.

1. API 키 발급 (console.anthropic.com)
2. `npm install @anthropic-ai/sdk`
3. `ANTHROPIC_API_KEY` 환경변수 설정 후 `node server.example.js`
4. `vite.config.js` 에 `server: { proxy: { '/api': 'http://localhost:8787' } }`
5. `src/App.jsx` 의 `import brain from './brain/rules.js'` 를 `'./brain/claude.js'` 로

**키는 브라우저에 두면 안 됩니다.** 화면에 안 보여도 개발자 도구와 빌드된
js 파일에 그대로 남아서, 가져다 쓰면 요금은 키 주인이 냅니다. 그래서 키를
가진 작은 창구(`server.example.js`)를 따로 두고 브라우저는 그 앞에만 말을 겁니다.
