import { defineConfig } from 'vite'

/* GitHub Pages 의 하위 폴더로 나가므로 base 를 박아 둔다.
   루트로 배포할 일이 생기면 이 한 줄만 고치면 된다. */
export default defineConfig({
  base: './',
  server: { port: 5240 },
  build: { target: 'es2022' },
})
