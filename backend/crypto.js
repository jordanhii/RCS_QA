/**
 * crypto.js —— 敏感信息对称加解密（RC 账号密码、OTP 密钥）
 *
 * 用 AES-256-GCM，主密钥来自环境变量 APP_SECRET_KEY（任意长度字符串，
 * 经 SHA-256 派生成 32 字节密钥）。未配置主密钥时加解密都会明确报错，
 * 避免把明文误存进数据库。
 *
 * 存储格式：v1:<iv_base64>:<authTag_base64>:<ciphertext_base64>
 */
import crypto from 'crypto'

const RAW = process.env.APP_SECRET_KEY || ''
const KEY = RAW ? crypto.createHash('sha256').update(RAW).digest() : null

export function hasSecretKey() {
    return !!KEY
}

export function encryptSecret(plain) {
    if (plain == null || plain === '') return ''
    if (!KEY) throw new Error('未配置 APP_SECRET_KEY，无法加密存储敏感信息')
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
    const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
}

export function decryptSecret(blob) {
    if (!blob) return ''
    if (!KEY) throw new Error('未配置 APP_SECRET_KEY，无法解密敏感信息')
    const parts = String(blob).split(':')
    if (parts.length !== 4 || parts[0] !== 'v1') return ''   // 非本格式，视为空
    const [, ivB, tagB, dataB] = parts
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB, 'base64'))
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()])
    return dec.toString('utf8')
}
