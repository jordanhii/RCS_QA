import { Router } from 'express'
import { spawn }  from 'child_process'
import fs         from 'fs'
import os         from 'os'
import path       from 'path'
import { fileURLToPath } from 'url'
import { pushLog } from './syncCache.js'
import { QAConfig } from '../models/index.js'
import { decryptSecret } from '../crypto.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const router    = Router()
const ah        = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// 按 RC 地址取该环境账号（后端解密），供导出脚本登录用
async function credsForUrl(url) {
    const cfg  = await QAConfig.findOne({ singleton: 'default' })
    const norm = String(url || '').trim().replace(/\/+$/, '')
    let best = null
    for (const e of (cfg?.rcEnvs || [])) {
        const base = (e.rcBaseUrl || '').replace(/\/+$/, '')
        if (!base) continue
        if (norm === base || norm.startsWith(base + '/') || base.startsWith(norm)) {
            if (!best || base.length > best.rcBaseUrl.replace(/\/+$/, '').length) best = e
        }
    }
    if (!best) return null
    return {
        username:  best.username || '',
        password:  best.passwordEnc  ? decryptSecret(best.passwordEnc)  : '',
        otpSecret: best.otpSecretEnc ? decryptSecret(best.otpSecretEnc) : '',
    }
}

// 把账号通过环境变量（而非命令行参数）注入子进程，避免出现在进程列表里
function credEnv(creds) {
    if (!creds) return {}
    return {
        RCS_CRED_USER: creds.username  || '',
        RCS_CRED_PASS: creds.password  || '',
        RCS_CRED_OTP:  creds.otpSecret || '',
    }
}

async function runPython(args, logType, extraEnv = {}) {
    let exitCode = null, stderr = ''
    await new Promise(resolve => {
        const proc = spawn('python3', args, { env: { ...process.env, ...extraEnv } })
        proc.stdout.on('data', d => pushLog(logType, d.toString().trim()))
        proc.stderr.on('data', d => { stderr += d; pushLog(logType, d.toString().trim()) })
        proc.on('close', code => { exitCode = code; resolve() })
    })
    return { exitCode, stderr }
}

function sendFile(res, outFile, filename) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    const stream = fs.createReadStream(outFile)
    stream.pipe(res)
    stream.on('close', () => { try { fs.unlinkSync(outFile) } catch {} })
}

// POST /api/export-data
router.post('/export-data', ah(async (req, res) => {
    const { domain, endpoint, alertType, pageSize, startTime } = req.body
    if (!domain || !endpoint) return res.status(400).json({ error: 'domain 和 endpoint 为必填项' })

    const dateStr = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)
    const outFile = path.join(os.tmpdir(), `rcs_export_${dateStr}.xlsx`)
    const script  = path.resolve(__dirname, '..', '..', 'export_worker.py')

    const args = [script, '--domain', domain, '--endpoint', endpoint,
                  '--page-size', String(pageSize || 200), '--output', outFile]
    if (alertType) args.push('--alert-type', alertType)
    if (startTime) args.push('--start-time', startTime)

    const creds = await credsForUrl(domain)
    pushLog('export', `▶ 开始导出  domain=${domain}  endpoint=${endpoint}  pageSize=${pageSize || 200}${startTime ? `  startTime≥${startTime}` : ''}  账号=${creds?.username || '(未配置)'}`)
    const { exitCode, stderr } = await runPython(args, 'export', credEnv(creds))

    if (exitCode !== 0 || !fs.existsSync(outFile)) {
        let errMsg = '导出失败'
        try { errMsg = JSON.parse(stderr.trim()).error || errMsg } catch {}
        return res.status(500).json({ error: errMsg })
    }
    sendFile(res, outFile, `${dateStr}_${(endpoint || 'export').replace(/[^a-zA-Z0-9]/g, '')}.xlsx`)
}))

export default router
