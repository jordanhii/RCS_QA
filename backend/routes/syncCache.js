import { Router } from 'express'
import { SyncCacheDoc, CaptureConfig } from '../models/index.js'

// ── CaptureConfig 缓存（按 typeId，用于 devResult 字段路径查找）─────────────
let _captureConfigMap = {}

export async function refreshCaptureConfigCache() {
    try {
        const docs = await CaptureConfig.find({})
        _captureConfigMap = {}
        for (const doc of docs) _captureConfigMap[doc.typeId] = doc
    } catch (e) {
        console.warn('⚠️  captureConfig 缓存刷新失败:', e.message)
    }
}

/** 按点路径从对象中取值，如 "alertMetadata.currentAmount" */
function getByPath(obj, path) {
    if (!path) return undefined
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

/** 从 captureConfig 找 devResult 配置的 API 路径 */
function getDevResultPath(typeId) {
    const cfg = _captureConfigMap[typeId]
    if (!cfg?.fields) return null
    return cfg.fields.find(f => f.listField === 'devResult')?.path || null
}

/**
 * 将字段值转为 'TRUE' / 'FALSE'：
 *   - boolean false 或字符串 "false"（不区分大小写）→ 'FALSE'
 *   - 其余所有非空值（包括任意字符串如 alertNumber）→ 'TRUE'
 *   - null / undefined / 空字符串 → 'TRUE'（无法判断时默认有效）
 */
function evalDevResult(value) {
    if (value === false || String(value).toLowerCase() === 'false') return 'FALSE'
    return 'TRUE'
}

const router = Router()
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// ── In-memory cache (keyed by normalised RC URL) ───────────────────────────────
export const syncCacheMap   = {}
const syncRequests          = {}
const syncCooldowns         = {}
const heartbeats            = {}   // { [normUrl]: lastSeenMs }
const SYNC_COOLDOWN_MS      = 30_000
const SYNC_REQUEST_TTL_MS   = 60_000

const TYPE_ID_MAP = {
    'deposit': 1, 'deposit-monthly': 2,
    'withdrawal': 3, 'withdrawal-monthly': 4,
    'netflow': 5, 'bet-deposit': 6, 'bet-deposit-promo': 7,
    'netflow-additional-present-day': 9,
    'netflow-additional-historical': 10,
    'reward-cumulative': 11, 'reward-interval': 12,
}

export function normUrl(u) {
    return (u || '').trim().toLowerCase().replace(/\/+$/, '') || 'default'
}

export function getCacheForUrl(url) {
    const k = normUrl(url)
    if (!syncCacheMap[k]) syncCacheMap[k] = { transaction: [], bet: [], gameProfit: [], reward: [], updatedAt: null }
    if (!syncCacheMap[k].gameProfit) syncCacheMap[k].gameProfit = []
    if (!syncCacheMap[k].reward)     syncCacheMap[k].reward     = []
    return syncCacheMap[k]
}

export async function restoreSyncCacheFromDb() {
    await refreshCaptureConfigCache()   // 同时加载 captureConfig 缓存
    try {
        const docs = await SyncCacheDoc.find({})
        for (const doc of docs) {
            syncCacheMap[doc.normUrl] = {
                transaction: doc.transaction || [],
                bet:         doc.bet         || [],
                gameProfit:  doc.gameProfit  || [],
                reward:      doc.reward      || [],
                updatedAt:   doc.updatedAt   || null,
            }
        }
        if (docs.length > 0) console.log(`✅ 已从 DB 恢复 ${docs.length} 条同步缓存`)
    } catch (e) {
        console.warn('⚠️  同步缓存恢复失败（非致命）:', e.message)
    }
}

function persistCacheToDb(normKey, entry) {
    SyncCacheDoc.findOneAndUpdate(
        { normUrl: normKey },
        { normUrl: normKey, transaction: entry.transaction, bet: entry.bet,
          gameProfit: entry.gameProfit || [], reward: entry.reward || [], updatedAt: entry.updatedAt },
        { upsert: true }
    ).catch(e => console.warn('⚠️  同步缓存持久化失败:', e.message))
}

// ── Debug log ──────────────────────────────────────────────────────────────────
const debugLog  = []
const MAX_DEBUG = 300
export function pushLog(type, raw) {
    const lines = String(raw).split('\n').map(l => l.trim()).filter(Boolean)
    const ts    = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    for (const msg of lines) debugLog.push({ ts, type, msg })
    while (debugLog.length > MAX_DEBUG) debugLog.shift()
}

router.get('/debug-log',    (_req, res) => res.json({ logs: debugLog }))
router.delete('/debug-log', (_req, res) => { debugLog.length = 0; res.json({ ok: true }) })
router.post('/sync-log',    (req, res)  => { if (req.body.msg) pushLog('sync', req.body.msg); res.json({ ok: true }) })

// ── Heartbeat — rc_sync_service.py posts every 30 s so frontend knows service is alive ──
router.post('/sync-heartbeat', (req, res) => {
    const k = normUrl(req.body.rcBaseUrl || '')
    heartbeats[k] = Date.now()
    res.json({ ok: true })
})
router.get('/sync-alive', (req, res) => {
    const k    = normUrl(req.query.url || '')
    const key  = heartbeats[k] != null ? k : 'default'
    const last = heartbeats[key]
    res.json({ isAlive: !!last && (Date.now() - last) < 90_000, lastBeat: last || null })
})

// ── Write cache ────────────────────────────────────────────────────────────────
router.post('/sync-cache', (req, res) => {
    const { records, source, rcBaseUrl } = req.body
    if (!records || !Array.isArray(records))
        return res.status(400).json({ error: 'records array required' })
    if (!source || !['transaction', 'bet', 'gameProfit', 'reward'].includes(source))
        return res.status(400).json({ error: 'source must be "transaction", "bet", "gameProfit", or "reward"' })
    const k     = normUrl(rcBaseUrl)
    const cache = getCacheForUrl(rcBaseUrl)
    if (source === 'transaction')      cache.transaction = records
    else if (source === 'bet')         cache.bet         = records
    else if (source === 'gameProfit')  cache.gameProfit  = records
    else                               cache.reward      = records
    cache.updatedAt = new Date().toISOString()

    // LRU eviction：最多保留 20 个 URL 的缓存，超出时淘汰最老的
    const MAX_CACHE_URLS = 20
    const keys = Object.keys(syncCacheMap)
    if (keys.length > MAX_CACHE_URLS) {
        const oldest = keys.sort((a, b) =>
            (syncCacheMap[a].updatedAt || '') < (syncCacheMap[b].updatedAt || '') ? -1 : 1
        )[0]
        delete syncCacheMap[oldest]
    }
    persistCacheToDb(k, cache)
    console.log(`[sync-cache] [${k}] [${source}] ${records.length} 条`)
    res.json({ success: true, count: records.length })
})

// ── Game-profit cache read ─────────────────────────────────────────────────────
router.get('/game-profit-cache', (req, res) => {
    const urlParam = req.query.url || ''
    const records  = urlParam
        ? getCacheForUrl(urlParam).gameProfit || []
        : Object.values(syncCacheMap).flatMap(c => c.gameProfit || [])
    const updatedAt = urlParam
        ? getCacheForUrl(urlParam).updatedAt
        : Object.values(syncCacheMap).reduce((l, c) => (!l || (c.updatedAt && c.updatedAt > l)) ? c.updatedAt : l, null)
    res.json({ success: true, data: records, updatedAt, total: records.length, totalRaw: records.length })
})

// ── Alert sync-cache read ──────────────────────────────────────────────────────

/**
 * 从 captureConfig 为指定 typeId 构建字段路径映射表。
 * 返回 { listField → apiPath }，未配置则返回 {}。
 */
function buildPathMap(typeId) {
    const cfg = _captureConfigMap[typeId]
    if (!cfg?.fields) return {}
    const map = {}
    for (const f of cfg.fields) map[f.listField] = f.path
    return map
}

/**
 * 从 item 取字段值：优先用 captureConfig 路径，回退到 defaultPath。
 */
function pick(item, pathMap, listField, defaultPath) {
    const path = pathMap[listField] || defaultPath
    return path ? getByPath(item, path) : undefined
}

/**
 * 将原始 RC 告警记录格式化为前端列表字段。
 *
 * 设计原则：
 * 1. 每个字段的 API 路径由 captureConfig 配置驱动，未配置时使用默认路径作为兜底。
 * 2. 路径对应的值存在（包括 0）→ 返回该值；路径在 RC 接口里不存在 → 返回 null（前端显示⚠）。
 * 3. devResult 特殊规则：captureConfig 配置的路径取到的值，通过 evalDevResult 转为 TRUE/FALSE。
 *    若路径值为非空字符串（如 alertNumber）→ TRUE；为 false/"false" → FALSE。
 * 4. normalType 特殊规则：取到 'up'/'down' 后映射为中文，其余空。
 */
function formatSyncRecord(item, typeId) {
    const meta    = item.alertMetadata || {}
    const pathMap = buildPathMap(typeId)

    /** 按路径取值，path 存在且接口有该字段 → 返回原始值（可能是 0）；否则 → null（未抓到） */
    const pickRaw = (listField, defaultPath) => {
        const path = pathMap[listField] || defaultPath
        if (!path) return null
        const v = getByPath(item, path)
        return (v !== undefined) ? v : null   // undefined = 路径不存在 → null
    }

    /** 数值字段：null 保留（前端展示⚠），其余转 Number */
    const pickNum = (listField, defaultPath) => {
        const v = pickRaw(listField, defaultPath)
        if (v === null) return null
        return Number(v)
    }

    // ── 公共字段 ──────────────────────────────────────────────────────────────
    const alertId   = String(pickRaw('alertId',   'alertNumber')        ?? '')
    const alertTime = String(pickRaw('alertTime',  'alertGeneratedTime') ?? '')

    // devResult：取配置路径的原始值，evalDevResult 判断 TRUE/FALSE
    // 典型场景：配置 alertNumber → 有告警号就是 TRUE；配置 isAbnormal → false 则 FALSE
    const devRaw    = pickRaw('devResult', 'isAbnormal')
    const devResult = evalDevResult(devRaw ?? item.alertNumber)  // 兜底：有 alertNumber 即 TRUE

    // normalType：取配置路径值后映射中文
    const trendRaw   = pickRaw('normalType', 'alertTrend') ?? item.alertTrend
    const normalType = trendRaw === 'up' ? '上升' : trendRaw === 'down' ? '下降' : ''

    const base = { alertId, alertTime, val1: null, val2: null, normalType, contType: '', devResult }

    // ── val1 ─────────────────────────────────────────────────────────────────
    base.val1 = pickNum('val1', 'alertMetadata.currentAmount')

    // ── val2 ─────────────────────────────────────────────────────────────────
    if (pathMap['val2']) {
        // 用户在 captureConfig 配置了明确路径 → 直接取
        base.val2 = pickNum('val2', null)
    } else if ([5, 6, 7].includes(typeId)) {
        // 默认：比值类取 upperBoundary
        base.val2 = Number(meta.upperBoundary || 0)
    } else if ([1, 2, 3, 4].includes(typeId)) {
        // 默认：存提款类计算平均值
        const factor = meta.amountFactor || 1
        const bv = trendRaw === 'up' ? (meta.upperBoundary || 0) : (meta.lowerBoundary || 0)
        base.val2 = factor !== 0 ? Number((bv / factor).toFixed(2)) : 0
    } else {
        base.val2 = 0
    }

    // ── 扩展字段（captureConfig 中非标准字段，如存提差环比的各金额列）────────
    const STANDARD = new Set(['alertId','alertTime','val1','val2','normalType','contType','devResult'])
    const cfg = _captureConfigMap[typeId]
    if (cfg?.fields) {
        for (const f of cfg.fields) {
            if (f.listField && f.path && !STANDARD.has(f.listField)) {
                const raw = getByPath(item, f.path)
                if (raw === undefined) {
                    // 路径未找到 → null（前端显示⚠）
                    base[f.listField] = null
                } else if (typeof raw === 'boolean') {
                    // RC 返回布尔值（如 lowerThanYesterday: true）→ 'TRUE'/'FALSE' 字符串
                    base[f.listField] = raw ? 'TRUE' : 'FALSE'
                } else if (typeof raw === 'string' && (raw.toLowerCase() === 'true' || raw.toLowerCase() === 'false')) {
                    // RC 返回布尔字符串 → 统一大写
                    base[f.listField] = raw.toLowerCase() === 'true' ? 'TRUE' : 'FALSE'
                } else if (typeof raw === 'string' && isNaN(Number(raw))) {
                    // 非数字字符串（如 优惠类型 ALL / 细分活动名）→ 原样保留
                    base[f.listField] = raw
                } else {
                    base[f.listField] = Number(raw)
                }
            }
        }
    }

    return base
}

/**
 * 计算连续告警类型，使用 captureConfig 配置的路径读取时间和趋势字段。
 * @param {object} cur      当前记录（原始 RC item）
 * @param {object|null} prev 前一条记录
 * @param {number} durationMin 连续告警窗口（分钟）
 * @param {object} pathMap  captureConfig 路径映射表
 */
function resolveContTypeSrv(cur, prev, durationMin = 30) {
    if (!prev) return '前30分钟无告警'
    const diff = Math.abs(
        (new Date(cur.alertGeneratedTime) - new Date(prev.alertGeneratedTime)) / 60000
    )
    if (isNaN(diff) || diff >= durationMin) return '前30分钟无告警'

    const p = prev.alertTrend
    const c = cur.alertTrend
    if (p === 'down' && c === 'up')   return '下降转上升'
    if (p === 'up'   && c === 'up')   return '上升恶化'
    if (p === 'up'   && c === 'down') return '上升转下降'
    if (p === 'down' && c === 'down') return '下降恶化'
    return '前30分钟无告警'
}

// ── 优惠告警（/rewardAlerts）专用解析 ────────────────────────────────────────
//
// 优惠记录结构与存提款/投注完全不同：没有 alertMetadata 嵌套对象，
// 数据塞在 alertContent 这个用 "\n" 分隔的字符串里，数字还带千分位逗号。
// 时间字段是 alertCreateTime（UTC ISO，带 Z），需转成 +8 本地时间字符串，
// 与其它告警页的 alertGeneratedTime（"YYYY-MM-DD HH:mm:ss" 本地时间）保持一致。
//
//   环比(12) alertContent 8 段：
//     [0]优惠类型 [1]今日累计优惠 [2]本N分钟 [3]本时段增长 [4]上N分钟 [5]倍数 [6]上时段增长×倍数 [7]今日第N个告警
//     ⚠ lastGrowth 存「原始上时段增长」= [6]÷[5]，让质检按配置的普通(B)/连续(C)倍数各自重算，
//       而不是直接吃 RC 已乘好的阈值（否则普通、连续两套倍数无法分别校验）。
//   同比(11) alertContent 6 段：
//     [0]优惠类型 [1]今日累计优惠 [2]前7天倍数 [3]前7天平均×倍数 [4]前30天倍数 [5]前30天平均×倍数
const REWARD_TZ_OFFSET_MS = 8 * 3600 * 1000   // RC 显示用 +8

function rewardLocalTime(raw) {
    if (!raw || typeof raw !== 'string') return ''
    // 已是本地格式（"YYYY-MM-DD HH:mm:ss"，无 T/Z）→ 原样返回
    if (!/[TZ]/.test(raw)) return raw
    const d = new Date(raw)
    if (isNaN(d.getTime())) return raw
    const t = new Date(d.getTime() + REWARD_TZ_OFFSET_MS)
    const p = n => String(n).padStart(2, '0')
    return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())} `
         + `${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}`
}

/** 去千分位逗号后转数字；空/非数字 → null（前端显示 ⚠ 未抓到） */
function rewardNum(s) {
    if (s === undefined || s === null) return null
    const v = String(s).replace(/,/g, '').trim()
    if (v === '') return null
    const n = Number(v)
    return Number.isNaN(n) ? null : n
}

/**
 * 还原「原始上时段增长」：RC 在 alertContent 里给的是 上时段增长×倍数（阈值），
 * 除回倍数得到原始增长，质检再用配置的 B/C 各自相乘校验普通/连续告警。
 * 倍数缺失或为 0 → 无法还原，退回阈值原值。除法用 1e6 四舍五入消除浮点噪声。
 */
function rewardRawLast(thresholdStr, multStr) {
    const t = rewardNum(thresholdStr)
    if (t === null) return null
    const m = rewardNum(multStr)
    if (m === null || m === 0) return t
    return Math.round((t / m) * 1e6) / 1e6
}

function formatRewardRecord(item, typeId) {
    const alertId   = String(item.alertId ?? item.alertNumber ?? '')
    const alertTime = rewardLocalTime(item.alertCreateTime || item.alertGeneratedTime || '')
    const parts     = String(item.alertContent ?? '').split('\n')

    const base = {
        alertId, alertTime,
        rewardType: String(parts[0] ?? '').trim(),
        todayTotal: rewardNum(parts[1]),
        // 优惠页上的记录都是 RC 已触发的告警 → RC 判断恒为 TRUE
        devResult:  'TRUE',
        ignored:    false,
    }
    if (typeId === 12) {
        base.currentGrowth = rewardNum(parts[3])              // 本时段增长
        base.lastGrowth    = rewardRawLast(parts[6], parts[5]) // 原始上时段增长 = 阈值÷倍数
        // 今日第 N 个告警（parts[7]）不再抓取，改由前端按同日同类型计算，避免依赖 RC 口径
    } else {
        // ⚠ RC 在 alertContent 里给的是「平均×RC倍数」(阈值)，[2]/[4] 是 RC 倍数。
        //   除回倍数得到原始平均，质检再按配置自己的倍数(普通/连续)相乘校验，避免倍数被乘两次。
        base.avg7  = rewardRawLast(parts[3], parts[2])  // 原始前7天平均 = 前7天阈值÷RC倍数
        base.avg30 = rewardRawLast(parts[5], parts[4])  // 原始前30天平均 = 前30天阈值÷RC倍数
    }
    return base
}

router.get('/sync-cache/:typeId', ah(async (req, res) => {
    const targetTypeId = Number(req.params.typeId)
    // 确保 captureConfig 已加载（首次或重启后可能尚未缓存）
    if (Object.keys(_captureConfigMap).length === 0) await refreshCaptureConfigCache()
    const urlParam     = req.query.url || ''

    // ── 优惠同比(11) / 优惠环比(12)：数据来自 reward 缓存，走专用解析 ──────────
    if (targetTypeId === 11 || targetTypeId === 12) {
        const rewardRaw = urlParam
            ? getCacheForUrl(urlParam).reward || []
            : Object.values(syncCacheMap).flatMap(c => c.reward || [])
        const records = rewardRaw
            .filter(item => TYPE_ID_MAP[item.alertType] === targetTypeId)
            .map(item => formatRewardRecord(item, targetTypeId))
            .sort((a, b) => new Date(b.alertTime) - new Date(a.alertTime))
        const updatedAt = urlParam
            ? getCacheForUrl(urlParam).updatedAt
            : Object.values(syncCacheMap).reduce((l, c) => (!l || (c.updatedAt && c.updatedAt > l)) ? c.updatedAt : l, null)
        return res.json({ success: true, data: records, updatedAt, totalRaw: rewardRaw.length })
    }

    // 按 typeId 只在「对应接口」的缓存里搜索：投注类(6/7)来自 allBetAlerts，
    // 其余存提款/存提差类来自 allTransactionAlerts。这样返回的 totalRaw 只反映相关接口的条数，
    // 不会把无关接口（如 bet）也算进来，避免「抓取上限 1000、却显示 1200+」的困惑。
    const BET_TYPES = new Set([6, 7])
    const pickSrc = c => BET_TYPES.has(targetTypeId) ? (c.bet || []) : (c.transaction || [])
    const allRaw = urlParam
        ? pickSrc(getCacheForUrl(urlParam))
        : Object.values(syncCacheMap).flatMap(pickSrc)
    const filtered = allRaw.filter(item => TYPE_ID_MAP[item.alertType] === targetTypeId)
    let records
    if ([3, 4].includes(targetTypeId)) {
        const sorted = [...filtered].sort((a, b) =>
            new Date(a.alertGeneratedTime) - new Date(b.alertGeneratedTime)
        )
        records = sorted.map((item, idx) => {
            const rec = formatSyncRecord(item, targetTypeId)
            rec.contType = resolveContTypeSrv(item, idx > 0 ? sorted[idx - 1] : null)
            return rec
        }).reverse()
    } else {
        records = filtered.map(item => formatSyncRecord(item, targetTypeId))
            .sort((a, b) => new Date(b.alertTime) - new Date(a.alertTime))   // alertTime 已按配置路径提取
    }
    const updatedAt = urlParam
        ? getCacheForUrl(urlParam).updatedAt
        : Object.values(syncCacheMap).reduce((l, c) => (!l || (c.updatedAt && c.updatedAt > l)) ? c.updatedAt : l, null)
    res.json({ success: true, data: records, updatedAt, totalRaw: allRaw.length })
}))

// ── Sync handshake ─────────────────────────────────────────────────────────────
router.post('/request-sync', (req, res) => {
    const { pageSize, rcBaseUrl } = req.body
    const key  = normUrl(rcBaseUrl)
    const now  = Date.now()
    const last = syncCooldowns[key] || 0
    if (now - last < SYNC_COOLDOWN_MS) {
        const remaining = Math.ceil((SYNC_COOLDOWN_MS - (now - last)) / 1000)
        return res.json({ ok: true, skipped: true, reason: 'cooldown', remainingSec: remaining })
    }
    syncRequests[key] = { pageSize: Number(pageSize) || 200, rcBaseUrl: rcBaseUrl || '', ts: now }
    res.json({ ok: true, skipped: false })
})

router.get('/sync-requested', (req, res) => {
    const key = normUrl(req.query.url || '') || 'default'
    const now = Date.now()
    const consume = k => {
        const entry = syncRequests[k]
        if (!entry) return null
        delete syncRequests[k]
        if (now - entry.ts > SYNC_REQUEST_TTL_MS) {
            console.log(`[sync-requested] 丢弃过期请求 [${k}]`)
            return null
        }
        syncCooldowns[k] = now
        return entry
    }
    let pending = consume(key)
    if (!pending && key !== 'default') pending = consume('default')
    res.json({ requested: pending !== null, pageSize: pending?.pageSize || 200, rcBaseUrl: pending?.rcBaseUrl || '' })
})

router.get('/sync-status', (req, res) => {
    const urlParam = req.query.url || ''
    if (urlParam) {
        const cache = getCacheForUrl(urlParam)
        res.json({ isAlive: cache.updatedAt !== null, updatedAt: cache.updatedAt,
                   transactionCount: cache.transaction.length, betCount: cache.bet.length })
    } else {
        const vals = Object.values(syncCacheMap)
        res.json({
            isAlive:          vals.some(c => c.updatedAt !== null),
            updatedAt:        vals.reduce((l, c) => (!l || (c.updatedAt && c.updatedAt > l)) ? c.updatedAt : l, null),
            transactionCount: vals.reduce((s, c) => s + c.transaction.length, 0),
            betCount:         vals.reduce((s, c) => s + c.bet.length, 0),
        })
    }
})

export default router
