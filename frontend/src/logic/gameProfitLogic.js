/**
 * gameProfitLogic.js
 * 游戏盈利 告警判断逻辑（对象可为 COLORGAME / SM …，各对象用各自的关联配置）
 *
 * 普通告警 = C1 AND C2（或 ignoreC2 时仅 C1）
 * 连续告警 = 普通告警 AND C3（且与上一告警的时间差 < alertInterval）
 *
 * C1: 当前RTP − 30日均RTP < X（告警阈值X）
 * C2: Current Bet ≥ Bet Median
 * C3: Last GGR − Current GGR ≥ |Last GGR| × Y%（连续告警阈值Y%）
 * 检查间隔: 当前告警与上一告警时间差 ≥ alertInterval（分钟）→ 不检查连续告警，显示 -
 */

// ── 阈值读取 ───────────────────────────────────────────────────────────────────

/** 从关联配置取 xThreshold，默认 2500 */
export const getX = cfg => cfg?.xThreshold ?? 2500

/** 从关联配置取 yThreshold（%），默认 10 */
export const getY = cfg => cfg?.yThreshold ?? 10

/** 从关联配置取 alertInterval（分钟），默认 60 */
export const getAlertInterval = cfg => cfg?.alertInterval ?? 60

// ── 时间差工具 ─────────────────────────────────────────────────────────────────

/** 返回两个时间字符串的差值（分钟），无效时返回 Infinity */
const timeDiffMins = (t1, t2) => {
    const d1 = new Date(t1), d2 = new Date(t2)
    if (isNaN(d1) || isNaN(d2)) return Infinity
    return Math.abs((d1 - d2) / 60000)
}

// ── 单条件计算 ─────────────────────────────────────────────────────────────────

/**
 * C1: 当前RTP − 30日均RTP < X
 * @param {object} row  record 对象
 * @param {number} x    xThreshold
 * @returns {'TRUE'|'FALSE'}
 */
export const calcC1 = (row, x) =>
    (Number(row.currentRtp) - Number(row.avgRtp)) < x ? 'TRUE' : 'FALSE'

/**
 * C2: Current Bet ≥ Bet Median
 * @param {object} row
 * @returns {'TRUE'|'FALSE'}
 */
export const calcC2 = row =>
    Number(row.currentBet) >= Number(row.betMedian) ? 'TRUE' : 'FALSE'

/**
 * C3: Last GGR − Current GGR ≥ |Last GGR| × Y%
 * @param {object} row
 * @param {number} y    yThreshold（百分比值，如 10 表示 10%）
 * @returns {'TRUE'|'FALSE'}
 */
export const calcC3 = (row, y) => {
    const diff = Number(row.lastGgr) - Number(row.currentGgr)
    const thr  = Math.abs(Number(row.lastGgr)) * (y / 100)
    return diff >= thr ? 'TRUE' : 'FALSE'
}

// ── 综合告警结果 ───────────────────────────────────────────────────────────────

/**
 * 普通告警结果
 * @param {object}  row
 * @param {number}  x
 * @param {boolean} ignoreC2  是否忽略条件2
 * @returns {'TRUE'|'FALSE'}
 */
export const calcNormal = (row, x, ignoreC2 = false) => {
    if (ignoreC2) return calcC1(row, x)
    return calcC1(row, x) === 'TRUE' && calcC2(row) === 'TRUE' ? 'TRUE' : 'FALSE'
}

/**
 * 连续告警结果（普通告警 AND C3，且时间差 < alertInterval）
 *
 * 返回值：
 *   'TRUE'  — 触发连续告警
 *   'FALSE' — 普通告警触发，但不满足 C3
 *   '-'     — 时间差 ≥ alertInterval，或无上一告警，不检查连续告警
 *
 * @param {object}  row
 * @param {number}  x
 * @param {number}  y
 * @param {number}  alertInterval  分钟
 * @param {boolean} ignoreC2
 * @returns {'TRUE'|'FALSE'|'-'}
 */
export const calcCont = (row, x, y, alertInterval = 60, ignoreC2 = false) => {
    // 普通告警未触发 → 连续告警肯定也 FALSE
    if (calcNormal(row, x, ignoreC2) !== 'TRUE') return 'FALSE'

    // 没有 prevAlertTime 记录 → 最早一条，视为普通告警
    if (!row.prevAlertTime) return '-'

    // 时间差 > 检查间隔 → 不检查连续告警（等于间隔时仍需检查，与 RC 系统行为一致）
    if (timeDiffMins(row.alertTime, row.prevAlertTime) > alertInterval) return '-'

    // 满足时间条件，再检查 C3
    return calcC3(row, y)
}

// ── 逻辑一致判断 ───────────────────────────────────────────────────────────────

/** 兼容旧版 devResult 中残留的 'normal'/'continuous' 值 → 统一当作 'TRUE' */
export const normDev = v => (['normal', 'continuous'].includes(v) ? 'TRUE' : v)

/**
 * 逻辑一致：普通告警结果 === 风控系统判断
 * @param {object}  row
 * @param {number}  x
 * @param {boolean} ignoreC2
 * @returns {boolean}
 */
export const isMatch = (row, x, ignoreC2 = false) =>
    !!row.devResult && calcNormal(row, x, ignoreC2) === normDev(row.devResult)

// ── 统计 ───────────────────────────────────────────────────────────────────────

/**
 * 计算列表的通过/异常统计
 * @param {object[]}          records
 * @param {number|Function}   xArg     告警阈值 X，或按行解析的函数 (row) => X（各对象用各自配置）
 * @param {boolean}           ignoreC2
 * @returns {{ pass: number, fail: number }}
 */
export const getMatchCount = (records, xArg, ignoreC2 = false) => {
    const resolveX = typeof xArg === 'function' ? xArg : () => xArg
    let pass = 0, fail = 0
    records.forEach(row => {
        if (!row.devResult || row.ignored) return
        isMatch(row, resolveX(row), ignoreC2) ? pass++ : fail++
    })
    return { pass, fail }
}

/**
 * 行 CSS class
 * @param {object}          row
 * @param {number|Function} xArg     告警阈值 X，或按行解析的函数 (row) => X
 * @param {boolean}         ignoreC2
 * @returns {string}
 */
export const getRowClass = (row, xArg, ignoreC2 = false) => {
    const x = typeof xArg === 'function' ? xArg(row) : xArg
    if (row.ignored) return 'row-ignored'
    if (row.devResult && !isMatch(row, x, ignoreC2)) return 'row-mismatch'
    return ''
}

// ── Last GGR 推导 ──────────────────────────────────────────────────────────────

/**
 * 按告警时间升序排列后，将每条记录的 lastGgr 设为上一条的 currentGgr。
 * 直接原地修改 records 数组中各对象的 lastGgr 属性。
 * @param {object[]} records  完整列表（含新增和已有记录）
 */
/**
 * 原地设置每条记录的：
 *   lastGgr       — 同一对象(target)上一条的 currentGgr
 *   prevAlertTime — 同一对象上一条的 alertTime（用于检查间隔判断）
 *
 * ⚠ 按 target 分组后各自按告警时间升序推导：COLORGAME 和 SM 的 GGR 连续性互不影响，
 *   否则混排时一条 COLORGAME 可能错误地拿到上一条 SM 的 GGR。
 */
export const applyLastGgr = records => {
    const timeOf = r => (r.alertTime ? new Date(r.alertTime).getTime() : 0)
    const groups = new Map()
    for (const row of records) {
        const key = String(row.target ?? '')
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(row)
    }
    for (const group of groups.values()) {
        const sorted = [...group].sort((a, b) => timeOf(a) - timeOf(b))
        sorted.forEach((row, i) => {
            const prev = sorted[i - 1]
            row.lastGgr       = i === 0 ? 0  : Number(prev.currentGgr) || 0
            row.prevAlertTime = i === 0 ? '' : (prev.alertTime || '')
        })
    }
}
