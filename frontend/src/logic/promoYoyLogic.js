/**
 * promoYoyLogic.js
 * 优惠同比（reward-cumulative / 日累计领取优惠同比）告警判断逻辑
 *
 * 配置驱动（镜像风控「优惠监控配置」），每个优惠类型可独立配置（按 promoName 匹配）：
 *   cfg.startThreshold — 日累计优惠起步判断额（条件1）
 *   cfg.mult7          — 普通告警 ≥前7天平均 × 倍数（条件2之一，≥1）
 *   cfg.mult30         — 普通告警 ≥前30天平均 × 倍数（条件2之二，≥1）
 *   cfg.mult7Cont      — 连续告警 ≥前7天平均 × 倍数（条件3之一，须 > mult7）
 *   cfg.mult30Cont     — 连续告警 ≥前30天平均 × 倍数（条件3之二，须 > mult30）
 *   cfg.alertInterval  — 连续告警间隔（分钟）：触发后需至少间隔 N 分钟才再次告警
 *   cfg.promoName      — 该配置适用的优惠类型（与告警优惠类型一致，如 ALL / Mud）
 *
 * 记录字段（原始值，倍数由配置乘）：
 *   rewardType — 优惠类型（ALL / 细分活动名）
 *   todayTotal — 今日累计优惠
 *   avg7       — 前7天平均日累计优惠（原始）
 *   avg30      — 前30天平均日累计优惠（原始）
 *
 * 告警判定：
 *   普通告警（条件1+2，每日只触发一次）：
 *     条件1：今日累计 ≥ 起步判断额
 *     条件2：今日累计 ≥ 前7天平均×mult7  且  ≥ 前30天平均×mult30
 *     当日该优惠类型已有更早告警 → FALSE（只触发一次）
 *   连续告警（条件3）：当日已触发后，与同类型上一条告警间隔 ≥ alertInterval 分钟，
 *     且 今日累计 ≥ 前7天平均×mult7Cont 且 ≥ 前30天平均×mult30Cont → TRUE，否则 FALSE；
 *     当日同类型首条 → '-'（由普通告警判定）
 *   两个平均值都缺 → null（数据不足，不对比）
 */

export const getStart        = cfg => Number(cfg?.startThreshold ?? 0)
export const getMult7         = cfg => Number(cfg?.mult7 ?? 1)
export const getMult30        = cfg => Number(cfg?.mult30 ?? 1)
export const getMult7Cont     = cfg => Number(cfg?.mult7Cont  ?? cfg?.mult7  ?? 1)
export const getMult30Cont    = cfg => Number(cfg?.mult30Cont ?? cfg?.mult30 ?? 1)
export const getAlertInterval = cfg => Number(cfg?.alertInterval ?? 30)

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

/** 两个时间字符串相差的分钟数：t1 − t2 */
function timeDiffMins(t1, t2) {
    return (new Date(t1).getTime() - new Date(t2).getTime()) / 60000
}

/**
 * 当日该优惠类型是否已有更早的告警（records 按 alertTime 降序，旧的在更大 index）。
 * 同比普通告警每日只触发一次。
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

/** 找同优惠类型、同一天的上一条（更旧）记录索引；无 → -1 */
function prevSameDayTypeIdx(absIdx, records) {
    const cur = records[absIdx]
    if (!cur?.alertTime) return -1
    const curDay = dayOf(cur.alertTime)
    const curType = cur.rewardType ?? ''
    for (let i = absIdx + 1; i < records.length; i++) {
        const r = records[i]
        if (!r?.alertTime) continue
        if (dayOf(r.alertTime) !== curDay) break
        if ((r.rewardType ?? '') === curType) return i
    }
    return -1
}

// ── 普通告警结果（条件1+2，每日只触发一次）─────────────────────────────────────
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

// ── 连续告警结果（条件3）──────────────────────────────────────────────────────
/**
 * 当日已触发普通告警后，与同类型上一条告警间隔 ≥ alertInterval 分钟（X 分钟后再查），
 * 且 今日累计 ≥ 前7天平均×mult7Cont 且 ≥ 前30天平均×mult30Cont 时再次告警。
 * 当日同类型首条 → '-'（仅普通告警生效）；两个平均值都缺 → null。
 * @returns {'TRUE'|'FALSE'|'-'|null}
 */
export function calcContResult(absIdx, records, cfg) {
    const cur = records[absIdx]
    if (!cur) return '-'
    const pIdx = prevSameDayTypeIdx(absIdx, records)
    if (pIdx === -1) return '-'                              // 当日同类型首条 → 普通告警判定
    const prev = records[pIdx]
    if (!cur.alertTime || !prev.alertTime) return '-'
    const today = cur.todayTotal
    const c7 = calcCmp(today, cur.avg7, getMult7Cont(cfg))
    const c30 = calcCmp(today, cur.avg30, getMult30Cont(cfg))
    if (c7 === null && c30 === null) return null
    if (today === null || today === undefined) return null
    // 触发后需至少间隔 alertInterval 分钟才允许再次告警（X 分钟后再查）
    const gapOk = timeDiffMins(cur.alertTime, prev.alertTime) >= getAlertInterval(cfg)
    return (gapOk && c7 === 'TRUE' && c30 === 'TRUE') ? 'TRUE' : 'FALSE'
}

/** 连续告警结果对应的颜色（与 promoMomLogic.getContResultColor 一致） */
export function getContResultColor(result) {
    if (result === 'TRUE') return 'var(--qa-pass)'
    if (result === 'FALSE') return 'var(--qa-fail)'
    return 'var(--qa-neutral)'
}

// ── 逻辑一致 ─────────────────────────────────────────────────────────────────
// 当日同类型首条 → 比对普通告警结果；之后 → 比对连续告警结果（与 promoMomLogic 统一）
export function calcLogicMatch(absIdx, records, cfg) {
    const row = records[absIdx]
    if (!row?.devResult) return false
    const cont = calcContResult(absIdx, records, cfg)
    if (cont === '-' || cont === null) return calcNormalResult(absIdx, records, cfg) === row.devResult
    return cont === row.devResult
}

// ── 行样式 ───────────────────────────────────────────────────────────────────
export function getRowClass(absIdx, records, cfg) {
    const row = records[absIdx]
    if (row?.ignored) return 'row-ignored'
    if (row?.devResult && !calcLogicMatch(absIdx, records, cfg)) return 'row-mismatch'
    return ''
}

// ── 统计 ─────────────────────────────────────────────────────────────────────
// cfgArg 可为单个 Config，或按行解析配置的函数 (row, absIdx) => cfg（每个优惠类型用各自配置）
export function getMatchCount(records, cfgArg) {
    const resolve = typeof cfgArg === 'function' ? cfgArg : () => cfgArg
    let pass = 0, fail = 0
    records.forEach((row, absIdx) => {
        if (!row.devResult || row.ignored) return
        calcLogicMatch(absIdx, records, resolve(row, absIdx)) ? pass++ : fail++
    })
    return { pass, fail }
}
