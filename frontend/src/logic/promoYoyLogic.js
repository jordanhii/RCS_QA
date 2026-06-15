/**
 * promoYoyLogic.js
 * 优惠同比（reward-cumulative / 日累计领取优惠同比）告警判断逻辑
 *
 * 配置驱动（镜像风控「优惠监控配置」）：
 *   cfg.startThreshold — 日累计优惠起步判断额（条件1）
 *   cfg.mult7          — ≥前7天平均 × 倍数（条件2之一，≥1）
 *   cfg.mult30         — ≥前30天平均 × 倍数（条件2之二，≥1）
 *
 * 记录字段（原始值，倍数由配置乘）：
 *   rewardType — 优惠类型（ALL / 细分活动名）
 *   todayTotal — 今日累计优惠
 *   avg7       — 前7天平均日累计优惠（原始）
 *   avg30      — 前30天平均日累计优惠（原始）
 *
 * 告警结果（全部满足）：
 *   条件1：今日累计 ≥ 起步判断额
 *   条件2：今日累计 ≥ 前7天平均×mult7  且  今日累计 ≥ 前30天平均×mult30
 *   每日只触发一次：当日该优惠类型已有更早告警 → FALSE
 *   两个平均值都缺 → null（数据不足，不对比）
 */

export const getStart = cfg => Number(cfg?.startThreshold ?? 0)
export const getMult7 = cfg => Number(cfg?.mult7 ?? 1)
export const getMult30 = cfg => Number(cfg?.mult30 ?? 1)

/** 单项比较：今日累计 ≥ 平均值 × 倍数 */
export function calcCmp(today, avg, mult) {
    if (today === null || today === undefined) return null
    if (avg === null || avg === undefined) return null
    return Number(today) >= Number(avg) * Number(mult) ? 'TRUE' : 'FALSE'
}

/** YYYY-MM-DD（取 alertTime 前 10 位） */
function dayOf(alertTime) {
    return alertTime ? String(alertTime).slice(0, 10) : ''
}

/**
 * 当日该优惠类型是否已有更早的告警（records 按 alertTime 降序，旧的在更大 index）。
 * 同比每日只触发一次。
 */
export function hasEarlierSameDay(absIdx, records) {
    const cur = records[absIdx]
    if (!cur?.alertTime) return false
    const curDay = dayOf(cur.alertTime)
    const curType = cur.rewardType ?? ''
    for (let i = absIdx + 1; i < records.length; i++) {
        const r = records[i]
        if (!r?.alertTime) continue
        if (dayOf(r.alertTime) !== curDay) break
        if ((r.rewardType ?? '') === curType) return true
    }
    return false
}

// ── 告警结果 ──────────────────────────────────────────────────────────────────
/**
 * @param {number}      absIdx  records 中的绝对索引
 * @param {object[]}    records 完整记录列表（按 alertTime 降序）
 * @param {object|null} cfg     关联 Config（提供 startThreshold / mult7 / mult30）
 * @returns {'TRUE'|'FALSE'|null}
 */
export function calcNormalResult(absIdx, records, cfg) {
    const row = records[absIdx]
    const today = row.todayTotal
    const c7 = calcCmp(today, row.avg7, getMult7(cfg))
    const c30 = calcCmp(today, row.avg30, getMult30(cfg))
    // 两个平均值都缺 → 数据不足，不对比
    if (c7 === null && c30 === null) return null
    if (today === null || today === undefined) return null
    // 条件1：起步判断额（未达 → 不触发）
    if (Number(today) < getStart(cfg)) return 'FALSE'
    // 每日只触发一次
    if (hasEarlierSameDay(absIdx, records)) return 'FALSE'
    // 条件2：两项需同时满足（缺一项视为不满足）
    return c7 === 'TRUE' && c30 === 'TRUE' ? 'TRUE' : 'FALSE'
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
