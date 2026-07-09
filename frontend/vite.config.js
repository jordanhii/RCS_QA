import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 开发时前端跑在 5173，后端跑在 3000。
// 前端代码统一用相对路径 /api，这里把 /api 代理到本地后端，
// 上线后前端与后端同域，/api 直接命中，无需再改地址。
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
