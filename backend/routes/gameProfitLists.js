import { Router } from 'express'
import { GameProfitList, MAX_RECORDS } from '../models/index.js'

const router = Router()
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

router.get('/', ah(async (_req, res) => {
    res.json(await GameProfitList.find({}))
}))

router.post('/', ah(async (req, res) => {
    const { listName, rcBaseUrl } = req.body
    if (!listName) return res.status(400).json({ error: 'listName 为必填项' })
    const doc = await GameProfitList.create({ listName, rcBaseUrl: rcBaseUrl || '', records: [] })
    res.json(doc)
}))

router.get('/:id', ah(async (req, res) => {
    const doc = await GameProfitList.findById(req.params.id)
    if (!doc) return res.status(404).json({ error: '未找到' })
    res.json(doc)
}))

router.put('/:id', ah(async (req, res) => {
    if (Array.isArray(req.body.records) && req.body.records.length > MAX_RECORDS) {
        return res.status(400).json({
            error: `单列表最多保存 ${MAX_RECORDS} 条记录，当前 ${req.body.records.length} 条，请删除旧数据后再保存`
        })
    }
    const doc = await GameProfitList.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!doc) return res.status(404).json({ error: '未找到' })
    res.json(doc)
}))

router.delete('/:id', ah(async (req, res) => {
    await GameProfitList.findByIdAndDelete(req.params.id)
    res.json({ ok: true })
}))

export default router
