# 上线部署说明（Render 版）

本项目已改造成「一个服务跑全套」：**Node 后端同时托管前端页面**，
前端不再写死 `localhost`，数据库地址/端口/域名都走环境变量。
本地开发方式不变（前端 5173 + 后端 3000，`/api` 自动代理）。

---

## 一、准备（你需要的账号）

1. **GitHub** —— 把本仓库推上去（Render 从 GitHub 拉代码自动部署）。
2. **MongoDB Atlas**（免费）—— 数据库放云上。
   - 注册 → 建免费集群 (M0) → Database Access 建一个用户 → Network Access 允许 `0.0.0.0/0`
   - 拿到连接串：`mongodb+srv://用户:密码@cluster.xxx.mongodb.net/qa_alert_system`
3. **Render**（免费起步）—— 跑网站。

## 二、在 Render 上部署

方式 A（推荐，自动读 `render.yaml`）：
1. Render 后台 → **New +** → **Blueprint** → 选中本仓库。
2. 它会读 `render.yaml` 建好服务，提示你填环境变量（见下）。

方式 B（手动）：
1. **New +** → **Web Service** → 连本仓库。
2. Runtime 选 **Docker**（仓库根目录已有 `Dockerfile`）。
3. 手动加下面的环境变量。

### 必填环境变量
| 变量 | 值 |
|------|----|
| `MONGODB_URI` | Atlas 连接串 |
| `APP_SECRET_KEY` | 账号加密主密钥 —— **填你本地 `.env` 里那一串**（务必一致，否则导入的账号解不开） |
| `JWT_SECRET` | 随机长串，登录令牌签名用 |
| `WORKER_TOKEN` | 随机长串，同步/导出脚本访问后端用（脚本端 `.env` 要填同一串） |
| `ADMIN_USERNAME` | 初始管理员账号（如 admin） |
| `ADMIN_PASSWORD` | 初始管理员密码（登录后请改） |

### 账号（RC / IGO）怎么配？
账号**不再写死**，也不必长期放环境变量。两种方式：
- **推荐**：上线后用管理员登录，到系统「**接口配置**」页面直接添加/编辑各环境的
  网址 + 用户名 + 密码 + OTP 密钥（加密存库，页面只显示「已设置」）。
- 或首次启动时用 `RC_USERNAME/…`、`RC_PROD_…`、`IGO_USERNAME/IGO_PASSWORD`
  让它自动导入一次（仅首次、仅在对应环境还没账号时）。

> `PORT` 不用填，Render 自动注入。前后端同域，`CORS_ORIGINS` 也不用填。

3. 部署完成后 Render 给一个网址（`https://xxx.onrender.com`）。想用自己的域名：
   Settings → Custom Domain 加域名，再去域名商加一条 CNAME 指向它，HTTPS 证书 Render 自动配。

## 三、导出 / 同步留在本地 Mac

导出（`export_worker.py` / `igo_export_worker.py`）和同步（`rc_sync_service.py`）
都要开浏览器抓数据，**不搬上线**——服务器镜像因此很轻，free 方案够用。

在你 Mac 本地跑它们，把数据推到线上后端即可：
1. 本地 `.env` 的 `BACKEND_URL` 改成线上网址（如 `https://rcs-qa.onrender.com`）
2. 本地 `.env` 的 `WORKER_TOKEN` 要和 Render 上设的**同一串**
3. 账号（RC/IGO）上线后在网页「接口配置」页面配好，脚本会自动向后端取（本地 `.env` 里的旧账号仅作兜底）

## 五、本地用 Docker 验证（可选）

```bash
docker build -t rcs-qa .
docker run -p 3000:3000 \
  -e MONGODB_URI="你的Atlas连接串" \
  -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD=Admin@123 \
  rcs-qa
# 浏览器打开 http://localhost:3000
```
