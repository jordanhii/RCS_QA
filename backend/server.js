/**
 * server.js — entry point only
 *
 * All business logic lives in:
 *   models/index.js          — Mongoose schemas & models
 *   routes/configs.js        — Alert config CRUD (typeId 1-8)
 *   routes/testLists.js      — Test list CRUD (typeId 1-7)
 *   routes/gameProfitLists.js — Game-profit list CRUD
 *   routes/qaConfig.js       — QA global config + RC env management
 *   routes/captureConfig.js  — Field mapping config
 *   routes/syncCache.js      — Sync cache, heartbeat, debug log
 *   routes/export.js         — Excel & IGO export via Python workers
 */
import './env.js'
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import path from 'path'
import { fileURLToPath } from 'url'

import configsRouter          from './routes/configs.js'
import testListsRouter        from './routes/testLists.js'
import gameProfitListsRouter  from './routes/gameProfitLists.js'
import qaConfigRouter         from './routes/qaConfig.js'
import captureConfigRouter    from './routes/captureConfig.js'
import syncCacheRouter, { restoreSyncCacheFromDb } from './routes/syncCache.js'
import exportRouter           from './routes/export.js'
import authRouter             from './routes/auth.js'
import usersRouter            from './routes/users.js'
import { requireAuth, requireAdmin, requireAuthOrWorker } from './middleware/auth.js'
import bcrypt from 'bcryptjs'
import { User, QAConfig } from './models/index.js'
import { encryptSecret, hasSecretKey } from './crypto.js'

const app = express()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── 生产环境安全自检：关键密钥不能是默认值/缺失，否则拒绝启动 ─────────────────────
function assertProdSecrets() {
    if (process.env.NODE_ENV !== 'production') return
    const bad = []
    if (!process.env.APP_SECRET_KEY) bad.push('APP_SECRET_KEY（未设置）')
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'rcsqa-dev-secret-change-me') bad.push('JWT_SECRET（仍是默认值）')
    if (!process.env.WORKER_TOKEN || process.env.WORKER_TOKEN === 'rcsqa-worker-token') bad.push('WORKER_TOKEN（仍是默认值）')
    if (bad.length) {
        console.error('❌ 生产环境安全配置不达标，已阻止启动：\n   - ' + bad.join('\n   - ')
            + '\n   请在环境变量中设置强随机值后重启。')
        process.exit(1)
    }
    if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'Admin@123')
        console.warn('⚠️  ADMIN_PASSWORD 仍是默认值，登录后请立即修改管理员密码。')
}
assertProdSecrets()

// 部署在 Render/Nginx 等反向代理之后：信任代理，secure cookie 与协议判断才正确
app.set('trust proxy', 1)

// ── 环境变量（本地无值时回落到开发默认） ─────────────────────────────────────────
const PORT         = process.env.PORT || 3000
const MONGODB_URI  = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/qa_alert_system'
// 额外放行的线上域名，多个用逗号分隔，例如 https://rcs-qa.onrender.com,https://qa.example.com
const EXTRA_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)

// ── CORS — 放行本地(任意端口) + 环境变量里配置的线上域名 ─────────────────────────
app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true)                              // 同源/服务器间调用
        if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true)
        if (EXTRA_ORIGINS.includes(origin)) return cb(null, true)
        cb(Object.assign(new Error('CORS: origin not allowed'), { status: 403 }))
    },
    credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())

// ── MongoDB ────────────────────────────────────────────────────────────────────
mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('✅ MongoDB 连接成功！')
        await runStartupMigrations()
        await restoreSyncCacheFromDb()
        await seedAdmin()
        await seedRcEnvCredentials()
    })
    .catch(err => console.error('❌ MongoDB 连接失败:', err.message))

/** 首个管理员：无 admin 时按 .env（ADMIN_USERNAME / ADMIN_PASSWORD）预置，默认 admin / Admin@123 */
async function seedAdmin() {
    if (await User.exists({ role: 'admin' })) return
    const username = process.env.ADMIN_USERNAME || 'admin'
    const password = process.env.ADMIN_PASSWORD || 'Admin@123'
    await User.create({ username, passwordHash: await bcrypt.hash(password, 10), role: 'admin' })
    console.log(`👤 已创建初始管理员：${username} / ${password}（请尽快登录并修改密码）`)
}

/**
 * 首次迁移：把 .env / 源码里的账号加密导入到数据库的 rcEnvs 配置。
 * - 测试站(platform88) ← RC_USERNAME/RC_PASSWORD/RC_OTP_SECRET
 * - 正式站(platform10) ← RC_PROD_USERNAME/RC_PROD_PASSWORD/RC_PROD_OTP_SECRET
 * - IGO(igo8.me)       ← IGO_USERNAME/IGO_PASSWORD，无 OTP
 * 只在对应环境「还没配用户名」时才写入，绝不覆盖你在页面上改过的账号。
 */
async function seedRcEnvCredentials() {
    if (!hasSecretKey()) {
        console.warn('⚠️  未配置 APP_SECRET_KEY，跳过账号加密导入（请在 .env 设置后重启）')
        return
    }
    const cfg = await QAConfig.findOneAndUpdate(
        { singleton: 'default' }, { $setOnInsert: { singleton: 'default' } }, { upsert: true, new: true }
    )
    const find = kw => (cfg.rcEnvs || []).find(e => (e.rcBaseUrl || '').toLowerCase().includes(kw))
    let changed = false

    const fill = (env, user, pass, otp) => {
        if (!env || env.username || !user) return
        env.username = user
        if (pass) env.passwordEnc = encryptSecret(pass)
        if (otp)  env.otpSecretEnc = encryptSecret(otp)
        changed = true
    }
    fill(find('platform88'), process.env.RC_USERNAME, process.env.RC_PASSWORD, process.env.RC_OTP_SECRET)
    fill(find('platform10'), process.env.RC_PROD_USERNAME, process.env.RC_PROD_PASSWORD, process.env.RC_PROD_OTP_SECRET)

    // IGO：不存在则新建（账号来自 IGO_USERNAME/IGO_PASSWORD，源码不写死；
    // 环境变量为空则建一条空账号，登录后到「接口配置」页面填即可）
    if (!find('igo8.me') && !find('igo-web')) {
        cfg.rcEnvs.push({
            name:        'IGO',
            rcBaseUrl:   'https://igo-web.igo8.me/igo-report',
            username:    process.env.IGO_USERNAME || '',
            passwordEnc: process.env.IGO_PASSWORD ? encryptSecret(process.env.IGO_PASSWORD) : '',
            otpSecretEnc: '',
        })
        changed = true
    }
    if (changed) {
        await cfg.save()
        console.log('🔐 已把 .env / 内置账号加密导入到 rcEnvs 配置')
    }
}

/**
 * 启动时一次性数据库迁移：
 * 1. 清理孤儿集合 gameprofitconfigs
 * 2. 将 captureconfigs.endpoint 空字符串统一为 null
 */
async function runStartupMigrations() {
    const db = mongoose.connection.db

    // 1. 清理孤儿集合
    const collections = (await db.listCollections().toArray()).map(c => c.name)
    if (collections.includes('gameprofitconfigs')) {
        await db.dropCollection('gameprofitconfigs')
        console.log('🧹 已清理孤儿集合 gameprofitconfigs')
    }

    // 2. captureconfigs.endpoint 空字符串 → null
    const { modifiedCount } = await db.collection('captureconfigs').updateMany(
        { endpoint: '' },
        { $set: { endpoint: null } }
    )
    if (modifiedCount > 0)
        console.log(`🔧 captureconfigs: ${modifiedCount} 条空 endpoint 已修正为 null`)

    // 3. testlists 中 depositAmount 等 undefined → null（存提差环比字段）
    const extraFields = ['depositAmount','withdrawalAmount','lastNetflowAmount','lastDepositAmount','lastWithdrawalAmount']
    for (const field of extraFields) {
        const { modifiedCount: mc } = await db.collection('testlists').updateMany(
            { [`records.${field}`]: { $exists: false } },
            { $set: { [`records.$[].${field}`]: null } }
        )
        if (mc > 0) console.log(`🔧 testlists.records.${field}: ${mc} 个文档已补 null`)
    }

    const extraFields10 = ['historicalYesterday','historicalLastWeek','historicalLastMonth','lowerThanYesterday','lowerThanLastWeek','lowerThanLastMonth']
    for (const field of extraFields10) {
        const { modifiedCount: mc } = await db.collection('testlists').updateMany(
            { [`records.${field}`]: { $exists: false } },
            { $set: { [`records.$[].${field}`]: null } }
        )
        if (mc > 0) console.log(`🔧 testlists.records.${field}: ${mc} 个文档已补 null`)
    }

    console.log('✅ 启动迁移完成')
}

// ── Routes ─────────────────────────────────────────────────────────────────────
// 公开：健康检查（部署平台探活用）—— 数据库没连上时返回 503，避免被误判为健康
app.get('/api/health', (_req, res) => {
    const dbOk = mongoose.connection.readyState === 1
    res.status(dbOk ? 200 : 503).json({ ok: dbOk, db: dbOk })
})

// 公开：登录系统
app.use('/api/auth', authRouter)

// 仅管理员：用户管理
app.use('/api/users', requireAuth, requireAdmin, usersRouter)

// 前端业务路由：需登录
app.use('/api/configs',            requireAuth, configsRouter)
app.use('/api/test-lists',         requireAuth, testListsRouter)
app.use('/api/game-profit-lists',  requireAuth, gameProfitListsRouter)
app.use('/api/capture-config',     requireAuth, captureConfigRouter)

// qa-config 与 sync-* 同步服务(worker)也要访问 → 登录 cookie 或 worker 令牌任一通过
app.use('/api/qa-config',          requireAuthOrWorker, qaConfigRouter)
app.use('/api',                    requireAuthOrWorker, syncCacheRouter)

// 导出（前端触发 Python worker）：需登录
app.use('/api',                    requireAuth, exportRouter)

// ── 前端静态资源（生产环境）────────────────────────────────────────────────────
// 后端同时托管 frontend/dist：一个服务、一个域名即可访问整个系统。
const distDir = path.resolve(__dirname, '..', 'frontend', 'dist')
app.use(express.static(distDir))

// ── /api 未命中 → 404（JSON）；其余路径 → 交给前端 SPA ──────────────────────────
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: '接口不存在' })
    if (req.method !== 'GET') return next()
    res.sendFile(path.join(distDir, 'index.html'), err => err && next())
})

// ── Global error handler ───────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('❌ 未处理的错误:', err.message || err)
    res.status(err.status || 500).json({ error: err.message || '服务器内部错误' })
})

app.listen(PORT, () => console.log(`🚀 后端运行在端口 ${PORT}`))
