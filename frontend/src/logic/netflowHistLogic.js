/**
 * netflowHistLogic.js
 * 存提差同比（netflow-additional-historical）告警判断逻辑
 *
 * 告警结果（全部条件 AND）：
 *   0. 间隔检查：当前告警 alertTime 与前一条 alertTime 差 < alertInterval(X) 分钟 → FALSE
 *   1. 条件1：withdrawalAmount >= xThreshold（日累计提款 ≥ X）→ TRUE
 *   2. 条件2：val1(存提差) < 以下任意两个历史值 → TRUE
 *      · historicalYesterday（昨日同时间）
 *      · historicalLastWeek（上周同天）
 *      · historicalLastMonth（上月同天）
 *   结果：间隔OK AND 条件1 AND 条件2 → TRUE
 */

export const getX = cfg => Number(cfg?.xThreshold ?? 0)
export const getAlertInterval = cfg => Number(cfg?.alertInterval ?? 60)

// ── 间隔检查 ─────────────────────────────────────────────────────────────────
/**
 * 当前记录与前一条记录的告警时间差（分钟）。
 * records 按 alertTime 降序（index 0 = 最新）。
 * 返回 Infinity 表示无前一条或时间无法解析。
 */
export function minutesSincePrev(absIdx, records) {
    const cur  = records[absIdx]
    const prev = records[absIdx + 1]
    if (!cur?.alertTime || !prev?.alertTime) return Infinity
    const diff = Math.abs(
        (new Date(cur.alertTime) - new Date(prev.alertTime)) / 60000
    )
    return isNaN(diff) ? Infinity : diff
}

// ── 条件计算 ─────────────────────────────────────────────────────────────────
/** 条件1：日累计提款 >= X */
export function calcCond1(row, cfg) {
    if (row.withdrawalAmount === null || row.withdrawalAmount === undefined) return null
    return Number(row.withdrawalAmount) >= getX(cfg) ? 'TRUE' : 'FALSE'
}

/** RCSQA 计算：val1 是否小于某历史值 */
export function calcLowerThan(val1, historical) {
    if (val1 === null || val1 === undefined) return null
    if (historical === null || historical === undefined) return null
    return Number(val1) < Number(historical) ? 'TRUE' : 'FALSE'
}

/** 条件2：存提差 < 任意两个历史值（≥2个TRUE → TRUE） */
export function calcCond2(row) {
    const checks = [
        calcLowerThan(row.val1, row.historicalYesterday),
        calcLowerThan(row.val1, row.historicalLastWeek),
        calcLowerThan(row.val1, row.historicalLastMonth),
    ]
    if (checks.every(c => c === null)) return null
    return checks.filter(c => c === 'TRUE').length >= 2 ? 'TRUE' : 'FALSE'
}

// ── 告警结果 ──────────────────────────────────────────────────────────────────
/**
 * 告警结果（含间隔检查）
 *
 * @param {number}      absIdx  在 records 数组中的绝对索引
 * @param {object[]}    records 完整记录列表（降序）
 * @param {object|null} cfg     关联 Config
 * @returns {'TRUE'|'FALSE'}
 */
export function calcNormalResult(absIdx, records, cfg) {
    // 间隔检查：距前一条告警不足 X 分钟 → FALSE
    if (minutesSincePrev(absIdx, records) < getAlertInterval(cfg)) return 'FALSE'
    const row = records[absIdx]
    const c1 = calcCond1(row, cfg)
    const c2 = calcCond2(row)
    if (c1 === null || c2 === null) return 'FALSE'
    return c1 === 'TRUE' && c2 === 'TRUE' ? 'TRUE' : 'FALSE'
}

// ── 逻辑一致 ─────────────────────────────────────────────────────────────────
export function calcLogicMatch(absIdx, records, cfg) {
    const row = records[absIdx]
    if (!row?.devResult) return false
    return calcNormalResult(absIdx, records, cfg) === row.devResult
}

// ── 行样式 ───────────────────────────────────────────────────────────────────
export function getRowClass(absIdx, records, cfg) {
    const row = records[absIdx]
    if (row?.ignored) return 'row-ignored'
    if (row?.devResult && !calcLogicMatch(absIdx, records, cfg)) return 'row-mismatch'
    return ''
}

// ── 统计 ─────────────────────────────────────────────────────────────────────
export function getMatchCount(records, cfg) {
    let pass = 0, fail = 0
    records.forEach((row, absIdx) => {
        if (!row.devResult || row.ignored) return
        calcLogicMatch(absIdx, records, cfg) ? pass++ : fail++
    })
    return { pass, fail }
}
