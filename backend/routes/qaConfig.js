import { Router } from 'express'
import { QAConfig } from '../models/index.js'

const router = Router()
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

const getOrCreate = () =>
    QAConfig.findOneAndUpdate(
        { singleton: 'default' },
        { $setOnInsert: { singleton: 'default' } },
        { upsert: true, new: true }
    )

const cfgToJson = cfg => ({
    syncIntervalMin: cfg.syncIntervalMin,
    syncPageSize:    cfg.syncPageSize,
    syncStartTime:   cfg.syncStartTime ?? null,
    rcBaseUrl:       cfg.rcBaseUrl,
    rcEnvs:          cfg.rcEnvs || [],
})

router.get('/', ah(async (_req, res) => {
    const cfg = await getOrCreate()
    res.json(cfgToJson(cfg))
}))

router.post('/', ah(async (req, res) => {
    const { syncIntervalMin, syncPageSize, syncStartTime, rcBaseUrl, rcEnvs } = req.body
    const update = {}
    if (syncIntervalMin != null) update.syncIntervalMin = syncIntervalMin
    if (syncPageSize    != null) update.syncPageSize    = syncPageSize
    if ('syncStartTime' in req.body) update.syncStartTime = syncStartTime || null
    if (rcBaseUrl       != null) update.rcBaseUrl       = rcBaseUrl
    if (rcEnvs          != null) update.rcEnvs          = rcEnvs
    const cfg = await QAConfig.findOneAndUpdate({ singleton: 'default' }, update, { upsert: true, new: true })
    res.json(cfgToJson(cfg))
}))

// GET /api/qa-config/rc-envs
router.get('/rc-envs', ah(async (_req, res) => {
    const cfg = await QAConfig.findOne({ singleton: 'default' })
    res.json(cfg?.rcEnvs || [])
}))

// POST /api/qa-config/rc-envs
router.post('/rc-envs', ah(async (req, res) => {
    const { name, rcBaseUrl } = req.body
    if (!name?.trim() || !rcBaseUrl?.trim())
        return res.status(400).json({ error: 'name 和 rcBaseUrl 为必填项' })
    if (!/^https?:\/\/.+/.test(rcBaseUrl.trim()))
        return res.status(400).json({ error: 'rcBaseUrl 必须是有效的 HTTP/HTTPS 链接（以 http:// 或 https:// 开头）' })
    const cfg = await QAConfig.findOneAndUpdate(
        { singleton: 'default' },
        { $push: { rcEnvs: { name: name.trim(), rcBaseUrl: rcBaseUrl.trim().replace(/\/+$/, '') } } },
        { upsert: true, new: true }
    )
    res.json(cfg.rcEnvs)
}))

// DELETE /api/qa-config/rc-envs/:id  — uses ObjectId, not array index (fixes fragile index-based delete)
router.delete('/rc-envs/:id', ah(async (req, res) => {
    const cfg = await QAConfig.findOneAndUpdate(
        { singleton: 'default' },
        { $pull: { rcEnvs: { _id: req.params.id } } },
        { new: true }
    )
    if (!cfg) return res.status(404).json({ error: '配置不存在' })
    res.json(cfg.rcEnvs)
}))

export default router
