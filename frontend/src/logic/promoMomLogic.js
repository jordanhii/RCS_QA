/**
 * promoMomLogic.js
 * 优惠环比（reward-interval / 日累计领取优惠环比）告警判断逻辑
 *
 * 配置驱动（镜像风控「优惠监控配置」）：
 *   cfg.multLast      — ≥上时段 × 倍数（≥1）
 *   cfg.alertInterval — 环比间隔时间（分钟，对比窗口大小；展示/参考用）
 *
 * 记录字段（原始值，倍数由配置乘）：
 *   rewardType    — 优惠类型
 *   todayTotal    — 今日累计优惠（展示用）
 *   currentGrowth — 本时段增长（本时段累计 − 上时段累计）
 *   lastGrowth    — 上时段增长（原始）
 *   alertSeq      — 今日第 N 个告警（展示用）
 *
 * 告警结果：
 *   本时段增长 ≥ 上时段增长 × multLast → TRUE，否则 FALSE
 *   缺本时段增长，或缺上时段增长（0 点首段无上时段）→ null（数据不足，不对比）
 *   上时段增长为 0/负 时照公式正常代入（已与 PM 确认）。
 */

export const getMultLast = cfg => Number(cfg?.multLast ?? 1)
export const getAlertInterval = cfg => Number(cfg?.alertInterval ?? 30)

// ── 告警结果 ──────────────────────────────────────────────────────────────────
/**
 * @param {number}      absIdx  records 中的绝对索引
 * @param {object[]}    records 完整记录列表（按 alertTime 降序）
 * @param {object|null} cfg     关联 Config（提供 multLast）
 * @returns {'TRUE'|'FALSE'|null}
 */
export function calcNormalResult(absIdx, records, cfg) {
    const row = records[absIdx]
    if (row.currentGrowth === null || row.currentGrowth === undefined) return null
    if (row.lastGrowth === null || row.lastGrowth === undefined) return null
    return Number(row.currentGrowth) >= Number(row.lastGrowth) * getMultLast(cfg) ? 'TRUE' : 'FALSE'
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
