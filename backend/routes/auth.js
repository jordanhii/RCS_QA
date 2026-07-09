/**
 * auth.js — 登录系统路由（公开，不经 requireAuth）
 *
 * 两步登录：
 *   POST /api/auth/login       第①步：用户名 + 密码 → 通过则下发「OTP 待验证」临时 cookie
 *                              首次（未绑定 OTP）会一并返回二维码供自助绑定
 *   POST /api/auth/login/otp   第②步：OTP 验证码 → 通过则下发正式登录 cookie
 *   POST /api/auth/logout      登出，清 cookie
 *   GET  /api/auth/me          当前登录用户
 */
import express from 'express'
import bcrypt from 'bcryptjs'
import otplib from 'otplib'
import QRCode from 'qrcode'

const { authenticator } = otplib
import { User } from '../models/index.js'
import {
    signAuthToken, signPendingToken, verifyToken,
    setAuthCookie, clearAuthCookie, requireAuth,
} from '../middleware/auth.js'

const router = express.Router()
const PENDING_COOKIE = 'rcsqa_pending'
const ISSUER = 'RCS QA'

// ── 极简登录限流（内存）：同一用户名连续失败 5 次锁 5 分钟 ──────────────────
const failMap = new Map()   // username -> { count, until }
function isLocked(u)   { const r = failMap.get(u); return r && r.until > Date.now() }
function noteFail(u)   {
    const r = failMap.get(u) || { count: 0, until: 0 }
    r.count++
    if (r.count >= 5) { r.until = Date.now() + 5 * 60_000; r.count = 0 }
    failMap.set(u, r)
}
function clearFail(u)  { failMap.delete(u) }

// ── 第①步：用户名 + 密码 ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { username, password } = req.body || {}
    if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' })
    if (isLocked(username)) return res.status(429).json({ error: '失败次数过多，请 5 分钟后再试' })

    const user = await User.findOne({ username: username.trim() })
    const ok = user && await bcrypt.compare(password, user.passwordHash)
    if (!ok) { noteFail(username); return res.status(401).json({ error: '用户名或密码错误' }) }
    clearFail(username)

    // 已绑定 OTP → 直接进第②步验证
    if (user.otpEnabled && user.otpSecret) {
        const pending = signPendingToken(user)
        setPendingCookie(res, pending)
        return res.json({ step: 'otp', enroll: false })
    }

    // 未绑定 → 生成新密钥 + 二维码，密钥随临时 token 下发（签名防篡改），第②步绑定
    const secret = authenticator.generateSecret()
    const otpauth = authenticator.keyuri(user.username, ISSUER, secret)
    const qr = await QRCode.toDataURL(otpauth)
    const pending = signPendingToken({ _id: user._id, username: user.username, enrollSecret: secret })
    setPendingCookie(res, pending)
    return res.json({ step: 'otp', enroll: true, qr, secret })
})

// ── 第②步：OTP 验证码 ───────────────────────────────────────────────────────
router.post('/login/otp', async (req, res) => {
    const { code } = req.body || {}
    const pendingTok = req.cookies?.[PENDING_COOKIE]
    const payload = pendingTok && verifyToken(pendingTok)
    if (!payload || payload.t !== 'otp_pending') return res.status(401).json({ error: '会话已过期，请重新登录' })
    if (!code || !/^\d{6}$/.test(String(code).trim())) return res.status(400).json({ error: '请输入 6 位验证码' })

    const user = await User.findById(payload.uid)
    if (!user) return res.status(401).json({ error: '用户不存在' })

    const enrolling = !!payload.enrollSecret
    const secret = enrolling ? payload.enrollSecret : user.otpSecret
    if (!secret) return res.status(401).json({ error: '会话已过期，请重新登录' })

    let valid = false
    try { valid = authenticator.check(String(code).trim(), secret) } catch { valid = false }
    if (!valid) return res.status(401).json({ error: '验证码错误或已过期' })

    // 首次绑定成功 → 保存密钥
    if (enrolling) {
        user.otpSecret = secret
        user.otpEnabled = true
        await user.save()
    }

    clearPendingCookie(res)
    setAuthCookie(res, signAuthToken(user))
    res.json({ user: publicUser(user) })
})

// ── 登出 ─────────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => { clearAuthCookie(res); clearPendingCookie(res); res.json({ ok: true }) })

// ── 当前用户 ─────────────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
    const user = await User.findById(req.user.uid)
    if (!user) return res.status(401).json({ error: '未登录' })
    res.json({ user: publicUser(user) })
})

// ── helpers ──────────────────────────────────────────────────────────────────
function publicUser(u) { return { id: String(u._id), username: u.username, role: u.role } }
function setPendingCookie(res, tok) {
    res.cookie(PENDING_COOKIE, tok, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 5 * 60_000, path: '/' })
}
function clearPendingCookie(res) { res.clearCookie(PENDING_COOKIE, { path: '/' }) }

export default router
