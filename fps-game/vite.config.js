import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/* gh-pages 의 fps-game/ 하위 폴더로 배포한다. 저장소 루트에는 용 게임이,
   coding-ai/ 에는 단어장이 이미 올라가 있어서 서로 건드리면 안 된다. */
export default defineConfig({
  base: '/qkrtpdbs1/fps-game/',
  plugins: [react(), tailwindcss()],
})
