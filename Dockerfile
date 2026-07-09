# RCS QA 网页系统 —— Node 后端（同时托管前端页面）
# 说明：导出/同步（要开浏览器抓数的 Python 脚本）留在本地 Mac 运行，
#       服务器只跑网页系统，所以镜像不含 Python/Playwright，轻量省内存。
FROM node:20-bookworm-slim

WORKDIR /app

# ── 后端依赖（先拷 package 便于缓存）──────────────────────────────────────────
COPY backend/package*.json backend/
RUN cd backend && npm ci --omit=dev

# ── 前端：装依赖 → 打包成静态文件（后端会托管 frontend/dist）──────────────────
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci
COPY frontend frontend
RUN cd frontend && npm run build

# ── 后端代码 + 环境示例 ──────────────────────────────────────────────────────
COPY backend backend
COPY .env.example ./

ENV NODE_ENV=production
# 平台会通过环境变量注入 PORT；本地默认 3000
EXPOSE 3000
CMD ["node", "backend/server.js"]
