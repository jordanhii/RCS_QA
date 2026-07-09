import { Router } from 'express'
import { QAConfig } from '../models/index.js'
import { encryptSecret, decryptSecret } from '../crypto.js'

const router = Router()
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

const getOrCreate = () =>
    QAConfig.findOneAndUpdate(
        { singleton: 'default' },
        { $setOnInsert: { singleton: 'default' } },
        { upsert: true, new: true }
    )

// 对外只暴露安全字段：密码/OTP 只回传「是否已设置」，绝不回传密文/明文
const maskEnv = e => ({
    _id:         e._id,
    name:        e.name,
    rcBaseUrl:   e.rcBaseUrl,
    username:    e.username || '',
    hasPassword: !!e.passwordEnc,
    hasOtp:      !!e.otpSecretEnc,
})

const cfgToJson = cfg => ({
    syncIntervalMin: cfg.syncIntervalMin,
    syncPageSize:    cfg.syncPageSize,
    syncStartTime:   cfg.syncStartTime ?? null,
    syncEndTime:     cfg.syncEndTime ?? null,
    rcBaseUrl:       cfg.rcBaseUrl,
    rcEnvs:          (cfg.rcEnvs || []).map(maskEnv),
})

// 仅管理员可写；worker 令牌不允许改账号
const adminOnly = (req, res) => {
    if (req.isWorker || req.user?.role !== 'admin') {
        res.status(403).json({ error: '需要管理员权限' })
        return false
    }
    return true
}

// 找与给定 URL 最匹配的环境（按 base 前缀，取最长匹配）
const matchEnv = (envs, url) => {
    const norm = String(url || '').trim().replace(/\/+$/, '')
    let best = null
    for (const e of envs) {
        const base = (e.rcBaseUrl || '').replace(/\/+$/, '')
        if (!base) continue
        if (norm === base || norm.startsWith(base + '/') || base.startsWith(norm)) {
            if (!best || base.length > best.rcBaseUrl.replace(/\/+$/, '').length) best = e
        }
    }
    return best
}

router.get('/', ah(async (_req, res) => {
    const cfg = await getOrCreate()
    res.json(cfgToJson(cfg))
}))

router.post('/', ah(async (req, res) => {
    if (!adminOnly(req, res)) return
    const { syncIntervalMin, syncPageSize, syncStartTime, syncEndTime, rcBaseUrl, rcEnvs } = req.body
    const update = {}
    if (syncIntervalMin != null) update.syncIntervalMin = syncIntervalMin
    if (syncPageSize    != null) update.syncPageSize    = syncPageSize
    if ('syncStartTime' in req.body) update.syncStartTime = syncStartTime || null
    if ('syncEndTime'   in req.body) update.syncEndTime   = syncEndTime || null
    if (rcBaseUrl       != null) update.rcBaseUrl       = rcBaseUrl
    // 注意：这里不接受整包覆盖 rcEnvs（含账号），账号只能走下面的 rc-envs 接口，避免明文覆盖
    const cfg = await QAConfig.findOneAndUpdate({ singleton: 'default' }, update, { upsert: true, new: true })
    res.json(cfgToJson(cfg))
}))

// GET /api/qa-config/rc-envs —— 列表（打码，供前端）
router.get('/rc-envs', ah(async (_req, res) => {
    const cfg = await QAConfig.findOne({ singleton: 'default' })
    res.json((cfg?.rcEnvs || []).map(maskEnv))
}))

// GET /api/qa-config/rc-envs/credentials?url=... —— 解密凭证（仅 worker 或管理员）
// 供同步/导出脚本按 RC 地址取账号；返回明文，绝不给普通前端
router.get('/rc-envs/credentials', ah(async (req, res) => {
    if (!req.isWorker && req.user?.role !== 'admin')
        return res.status(403).json({ error: '无权限' })
    const cfg = await QAConfig.findOne({ singleton: 'default' })
    const env = matchEnv(cfg?.rcEnvs || [], req.query.url)
    if (!env) return res.status(404).json({ error: '未找到匹配的账号配置' })
    res.json({
        rcBaseUrl: env.rcBaseUrl,
        username:  env.username || '',
        password:  env.passwordEnc  ? decryptSecret(env.passwordEnc)  : '',
        otpSecret: env.otpSecretEnc ? decryptSecret(env.otpSecretEnc) : '',
    })
}))

// POST /api/qa-config/rc-envs —— 新增（仅管理员）
router.post('/rc-envs', ah(async (req, res) => {
    if (!adminOnly(req, res)) return
    const { name, rcBaseUrl, username, password, otpSecret } = req.body
    if (!name?.trim() || !rcBaseUrl?.trim())
        return res.status(400).json({ error: 'name 和 rcBaseUrl 为必填项' })
    if (!/^https?:\/\/.+/.test(rcBaseUrl.trim()))
        return res.status(400).json({ error: 'rcBaseUrl 必须是有效的 HTTP/HTTPS 链接（以 http:// 或 https:// 开头）' })
    const entry = {
        name:         name.trim(),
        rcBaseUrl:    rcBaseUrl.trim().replace(/\/+$/, ''),
        username:     (username || '').trim(),
        passwordEnc:  password  ? encryptSecret(password)          : '',
        otpSecretEnc: otpSecret ? encryptSecret(otpSecret.trim())  : '',
    }
    const cfg = await QAConfig.findOneAndUpdate(
        { singleton: 'default' },
        { $push: { rcEnvs: entry } },
        { upsert: true, new: true }
    )
    res.json((cfg.rcEnvs || []).map(maskEnv))
}))

// PUT /api/qa-config/rc-envs/:id —— 更新（仅管理员）
// 密码/OTP 仅在传了非空新值时才覆盖；留空表示保持不变
router.put('/rc-envs/:id', ah(async (req, res) => {
    if (!adminOnly(req, res)) return
    const { name, rcBaseUrl, username, password, otpSecret } = req.body
    const set = {}
    if (name      != null) set['rcEnvs.$.name']      = name.trim()
    if (rcBaseUrl != null) {
        if (!/^https?:\/\/.+/.test(rcBaseUrl.trim()))
            return res.status(400).json({ error: 'rcBaseUrl 必须是有效的 HTTP/HTTPS 链接' })
        set['rcEnvs.$.rcBaseUrl'] = rcBaseUrl.trim().replace(/\/+$/, '')
    }
    if (username  != null) set['rcEnvs.$.username'] = username.trim()
    if (password)  set['rcEnvs.$.passwordEnc']  = encryptSecret(password)
    if (otpSecret) set['rcEnvs.$.otpSecretEnc'] = encryptSecret(otpSecret.trim())
    const cfg = await QAConfig.findOneAndUpdate(
        { singleton: 'default', 'rcEnvs._id': req.params.id },
        { $set: set },
        { new: true }
    )
    if (!cfg) return res.status(404).json({ error: '环境不存在' })
    res.json((cfg.rcEnvs || []).map(maskEnv))
}))

// DELETE /api/qa-config/rc-envs/:id —— 删除（仅管理员）
router.delete('/rc-envs/:id', ah(async (req, res) => {
    if (!adminOnly(req, res)) return
    const cfg = await QAConfig.findOneAndUpdate(
        { singleton: 'default' },
        { $pull: { rcEnvs: { _id: req.params.id } } },
        { new: true }
    )
    if (!cfg) return res.status(404).json({ error: '配置不存在' })
    res.json((cfg.rcEnvs || []).map(maskEnv))
}))

export default router
