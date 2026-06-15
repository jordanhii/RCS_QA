import { Router } from 'express'
import { Config, TestList, GameProfitList } from '../models/index.js'

const router = Router()
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

router.get('/:typeId', ah(async (req, res) => {
    const typeId = Number(req.params.typeId)
    if (isNaN(typeId)) return res.status(400).json({ error: '无效的 typeId' })
    res.json(await Config.find({ typeId }))
}))

router.post('/', ah(async (req, res) => {
    const { _id, ...data } = req.body
    if (!data.typeId) return res.status(400).json({ error: 'typeId 为必填项' })
    if (_id) {
        await Config.findByIdAndUpdate(_id, data)
        res.json({ success: true })
    } else {
        res.json(await Config.create(data))
    }
}))

router.delete('/:id', ah(async (req, res) => {
    const id = req.params.id

    // Count lists WITH records that reference this config (to decide notification level)
    const [testWithData, gpWithData] = await Promise.all([
        TestList.countDocuments({ configId: id, 'records.0': { $exists: true } }),
        GameProfitList.countDocuments({ configId: id, 'records.0': { $exists: true } }),
    ])
    const affectedWithData = testWithData + gpWithData

    // Delete config first, then cascade-clear references.
    // Not wrapped in a transaction (requires replica set); if cascade fails the
    // frontend's configId validation on load will self-heal dangling references.
    const deleted = await Config.findByIdAndDelete(id)
    if (!deleted) return res.status(404).json({ error: '配置不存在' })

    await Promise.allSettled([
        TestList.updateMany({ configId: id }, { $set: { configId: null } }),
        GameProfitList.updateMany({ configId: id }, { $set: { configId: null } }),
    ])

    res.json({ success: true, affectedWithData })
}))

export default router
