/**
 * users.js — 用户管理（仅 admin）。挂载时已套 requireAuth + requireAdmin。
 *   GET    /api/users                列表
 *   POST   /api/users                新增（用户名 + 密码）
 *   POST   /api/users/:id/reset-password   重置密码
 *   POST   /api/users/:id/reset-otp        重置 OTP（清密钥，下次登录重新绑定）
 *   DELETE /api/users/:id            删除（禁止删自己 / 最后一个 admin）
 */
import express from 'express'
import bcrypt from 'bcryptjs'
import { User } from '../models/index.js'
import { validatePassword } from '../middleware/auth.js'

const router = express.Router()
const pub = u => ({ id: String(u._id), username: u.username, role: u.role, otpEnabled: u.otpEnabled, createdAt: u.createdAt })

// 列表
router.get('/', async (_req, res) => {
    const users = await User.find().sort({ createdAt: 1 })
    res.json(users.map(pub))
})

// 新增
router.post('/', async (req, res) => {
    const { username, password, role } = req.body || {}
    if (!username || !username.trim()) return res.status(400).json({ error: '请输入用户名' })
    const pwErr = validatePassword(password)
    if (pwErr) return res.status(400).json({ error: pwErr })
    if (await User.findOne({ username: username.trim() })) return res.status(409).json({ error: '用户名已存在' })

    const user = await User.create({
        username: username.trim(),
        passwordHash: await bcrypt.hash(password, 10),
        role: role === 'admin' ? 'admin' : 'user',
    })
    res.status(201).json(pub(user))
})

// 重置密码
router.post('/:id/reset-password', async (req, res) => {
    const pwErr = validatePassword(req.body?.password)
    if (pwErr) return res.status(400).json({ error: pwErr })
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: '用户不存在' })
    user.passwordHash = await bcrypt.hash(req.body.password, 10)
    await user.save()
    res.json({ ok: true })
})

// 重置 OTP：清空密钥，下次登录重新扫码绑定
router.post('/:id/reset-otp', async (req, res) => {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: '用户不存在' })
    user.otpSecret = null
    user.otpEnabled = false
    await user.save()
    res.json({ ok: true })
})

// 删除（禁止删自己 / 最后一个 admin）
router.delete('/:id', async (req, res) => {
    if (req.params.id === req.user.uid) return res.status(400).json({ error: '不能删除自己' })
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: '用户不存在' })
    if (user.role === 'admin') {
        const adminCount = await User.countDocuments({ role: 'admin' })
        if (adminCount <= 1) return res.status(400).json({ error: '不能删除最后一个管理员' })
    }
    await user.deleteOne()
    res.json({ ok: true })
})

export default router
