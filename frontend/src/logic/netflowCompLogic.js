/**
 * netflowCompLogic.js
 * 存提差环比（netflow-additional-present-day）告警判断逻辑
 *
 * 核心字段：
 *   val1              — 当前存提差金额 (currentAmount)
 *   lastNetflowAmount — 上期存提差金额
 *
 * 告警结果：
 *   1. 间隔检查：当前告警 alertTime 与前一条 alertTime 差 < alertInterval(X) 分钟 → FALSE
 *   2. 下降金额 = Last存提差 − 当前存提差，≥ Y（下降阈值）→ TRUE
 *   条件 1 优先：间隔不足直接 FALSE，无论下降金额多少。
 */

// ── 下降金额 ──────────────────────────────────────────────────────────────────
/** 下降金额 = Last存提差 − 当前存提差 */
export function calcDecline(row) {
    return (Number(row.lastNetflowAmount) || 0) - (Number(row.val1) || 0)
}

// ── 阈值读取 ─────────────────────────────────────────────────────────────────
/** 下降阈值 Y，默认 0 */
export const getY = cfg => Number(cfg?.yThreshold ?? 0)
/** 检查间隔 X（分钟），默认 60 */
export const getAlertInterval = cfg => Number(cfg?.alertInterval ?? 60)

// ── 间隔检查 ─────────────────────────────────────────────────────────────────
/**
 * 当前记录与前一条记录（absIdx+1，更旧）的告警时间差（分钟）。
 * records 按 alertTime 降序存储（index 0 = 最新）。
 * 返回 Infinity 表示没有前一条或时间无法解析。
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

// ── 告警结果 ──────────────────────────────────────────────────────────────────
/**
 * 告警结果（含间隔检查）
 *
 * @param {number}       absIdx  在 records 数组中的绝对索引
 * @param {object[]}     records 完整记录列表（降序）
 * @param {object|null}  cfg     关联 Config
 * @returns {'TRUE'|'FALSE'}
 */
export function calcNormalResult(absIdx, records, cfg) {
    const row = records[absIdx]
    // 间隔检查：距前一条告警不足 X 分钟 → FALSE
    if (minutesSincePrev(absIdx, records) < getAlertInterval(cfg)) return 'FALSE'
    // 下降幅度检查
    return calcDecline(row) >= getY(cfg) ? 'TRUE' : 'FALSE'
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
