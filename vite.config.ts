/**
 * Vite 설정 파일
 *
 * @role Vite 빌드 도구 설정 (React 플러그인, 경로 별칭 등)
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
