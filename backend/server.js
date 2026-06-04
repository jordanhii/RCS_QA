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
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'

import configsRouter          from './routes/configs.js'
import testListsRouter        from './routes/testLists.js'
import gameProfitListsRouter  from './routes/gameProfitLists.js'
import qaConfigRouter         from './routes/qaConfig.js'
import captureConfigRouter    from './routes/captureConfig.js'
import syncCacheRouter, { restoreSyncCacheFromDb } from './routes/syncCache.js'
import exportRouter           from './routes/export.js'

const app = express()

// ── CORS — allow localhost only (any port, for Vite/dev flexibility) ───────────
app.use(cors({
    origin: (origin, cb) => {
        if (!origin || /^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true)
        cb(Object.assign(new Error('CORS: origin not allowed'), { status: 403 }))
    },
    credentials: true,
}))
app.use(express.json({ limit: '10mb' }))

// ── MongoDB ────────────────────────────────────────────────────────────────────
mongoose.connect('mongodb://127.0.0.1:27017/qa_alert_system')
    .then(async () => {
        console.log('✅ MongoDB 连接成功！')
        await runStartupMigrations()
        await restoreSyncCacheFromDb()
    })
    .catch(err => console.error('❌ MongoDB 连接失败:', err.message))

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
app.use('/api/configs',            configsRouter)
app.use('/api/test-lists',         testListsRouter)
app.use('/api/game-profit-lists',  gameProfitListsRouter)
app.use('/api/qa-config',          qaConfigRouter)
app.use('/api/capture-config',     captureConfigRouter)
app.use('/api',                    syncCacheRouter)
app.use('/api',                    exportRouter)

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: '接口不存在' }))

// ── Global error handler ───────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('❌ 未处理的错误:', err.message || err)
    res.status(err.status || 500).json({ error: err.message || '服务器内部错误' })
})

app.listen(3000, () => console.log('🚀 后端运行在 http://localhost:3000'))
