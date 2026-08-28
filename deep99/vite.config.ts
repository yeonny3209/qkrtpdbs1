import { defineConfig } from 'vite'

/* GitHub Pages 의 하위 폴더로 나가므로 상대 경로로 빌드한다. */
export default defineConfig({
  base: './',
  server: { port: 5250 },
  build: { target: 'es2022' },
})
