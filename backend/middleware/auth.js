/**
 * auth.js — 鉴权共享助手与中间件
 * - JWT 存 httpOnly cookie；两步登录用短时效「OTP 待验证」临时 token
 * - 密码策略：8–16 位，且同时含 数字 + 字母 + 特殊符号
 */
import jwt from 'jsonwebtoken'

const JWT_SECRET   = process.env.JWT_SECRET || 'rcsqa-dev-secret-change-me'
const COOKIE_NAME  = 'rcsqa_token'
const SESSION_HOURS = 8

// ── Token ──────────────────────────────────────────────────────────────────────
export function signAuthToken(user) {
    return jwt.sign(
        { uid: String(user._id), username: user.username, role: user.role, t: 'auth' },
        JWT_SECRET,
        { expiresIn: `${SESSION_HOURS}h` },
    )
}
/** 第一步（密码已验证、待 OTP）用的 5 分钟临时凭证；首次绑定时带上 enrollSecret */
export function signPendingToken(user) {
    const claims = { uid: String(user._id), username: user.username, t: 'otp_pending' }
    if (user.enrollSecret) claims.enrollSecret = user.enrollSecret
    return jwt.sign(claims, JWT_SECRET, { expiresIn: '5m' })
}
export function verifyToken(token) {
    try { return jwt.verify(token, JWT_SECRET) } catch { return null }
}

// ── Cookie ───────────────────────────────────────────────────────────────────--
export function setAuthCookie(res, token) {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',   // 生产(https)自动加 Secure；本地 http 关闭
        maxAge: SESSION_HOURS * 3600 * 1000,
        path: '/',
    })
}
export function clearAuthCookie(res) {
    res.clearCookie(COOKIE_NAME, { path: '/' })
}
export { COOKIE_NAME }

// ── 中间件 ───────────────────────────────────────────────────────────────────--
export function requireAuth(req, res, next) {
    const token = req.cookies?.[COOKIE_NAME]
    const payload = token && verifyToken(token)
    if (!payload || payload.t !== 'auth') return res.status(401).json({ error: '未登录或登录已过期' })
    req.user = { uid: payload.uid, username: payload.username, role: payload.role }
    next()
}
export function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' })
    next()
}

// 用于 worker 也要访问的接口（qa-config / sync-*）：登录 cookie 或 worker 令牌任一通过
const WORKER_TOKEN = process.env.WORKER_TOKEN || 'rcsqa-worker-token'
export function requireAuthOrWorker(req, res, next) {
    if (req.headers['x-worker-token'] === WORKER_TOKEN) { req.isWorker = true; return next() }
    return requireAuth(req, res, next)
}

// ── 密码策略 ─────────────────────────────────────────────────────────────────--
export function validatePassword(pw) {
    if (typeof pw !== 'string' || pw.length < 8 || pw.length > 16)
        return '密码需为 8–16 位'
    if (!/[0-9]/.test(pw))               return '密码需包含数字'
    if (!/[a-zA-Z]/.test(pw))            return '密码需包含字母'
    if (!/[^0-9a-zA-Z]/.test(pw))        return '密码需包含特殊符号'
    return null   // ok
}
