import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  /* 상대 경로로 뽑는다 — 어느 하위 경로에 올리든, 심지어 dist/index.html 을
     그냥 두 번 눌러 열어도 동작한다. 배포 위치를 아직 안 정했다. */
  base: './',
  plugins: [react(), tailwindcss()],
})
