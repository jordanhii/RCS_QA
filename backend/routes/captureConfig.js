import { Router } from 'express'
import { CaptureConfig } from '../models/index.js'
import { refreshCaptureConfigCache } from './syncCache.js'

const router = Router()
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

router.get('/:typeId', ah(async (req, res) => {
    const typeId = Number(req.params.typeId)
    const doc = await CaptureConfig.findOne({ typeId })
    res.json(doc || { typeId, fields: [] })
}))

router.post('/', ah(async (req, res) => {
    const { typeId, fields } = req.body
    let { endpoint } = req.body
    if (!typeId) return res.status(400).json({ error: 'typeId 为必填项' })

    // 空字符串统一为 null，避免数据不一致
    endpoint = (typeof endpoint === 'string' && endpoint.trim()) ? endpoint.trim() : null

    // fields 中过滤掉 path 为空的条目
    const cleanFields = (Array.isArray(fields) ? fields : [])
        .filter(f => f.listField && f.path?.trim())
        .map(f => ({ listField: f.listField, path: f.path.trim() }))

    const doc = await CaptureConfig.findOneAndUpdate(
        { typeId }, { typeId, endpoint, fields: cleanFields }, { upsert: true, new: true }
    )
    await refreshCaptureConfigCache()   // 保存后立即刷新缓存
    res.json(doc)
}))

export default router
