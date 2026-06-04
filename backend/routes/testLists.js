import { Router } from 'express'
import { TestList, MAX_RECORDS } from '../models/index.js'

const router = Router()
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

router.get('/:typeId', ah(async (req, res) => {
    const typeId = Number(req.params.typeId)
    if (isNaN(typeId)) return res.status(400).json({ error: '无效的 typeId' })
    res.json(await TestList.find({ typeId }))
}))

router.post('/', ah(async (req, res) => {
    const { _id, ...data } = req.body
    if (!data.typeId) return res.status(400).json({ error: 'typeId 为必填项' })

    // 防止单文档超限（MongoDB 单文档上限 16 MB）
    if (Array.isArray(data.records) && data.records.length > MAX_RECORDS) {
        return res.status(400).json({
            error: `单列表最多保存 ${MAX_RECORDS} 条记录，当前 ${data.records.length} 条，请删除旧数据后再保存`
        })
    }

    if (_id) {
        await TestList.findByIdAndUpdate(_id, data)
        res.json({ success: true })
    } else {
        res.json(await TestList.create(data))
    }
}))

router.delete('/:id', ah(async (req, res) => {
    await TestList.findByIdAndDelete(req.params.id)
    res.json({ success: true })
}))

export default router
