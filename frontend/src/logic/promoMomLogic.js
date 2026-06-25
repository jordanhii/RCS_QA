/**
 * promoMomLogic.js
 * 优惠环比（reward-interval / 日累计领取优惠环比）告警判断逻辑
 *
 * 配置驱动（镜像风控「优惠监控配置」）：
 *   cfg.multLast      — 普通告警倍数 B：本时段增长 ≥ 上时段增长 × B（≥1）
 *   cfg.multLastCont  — 连续告警倍数 C：触发后同周期内 本时段增长 ≥ 上时段增长 × C（须 > B）
 *   cfg.alertInterval — 环比间隔时间 A（分钟）：条件1的周期，也是连续告警的判定窗口
 *
 * 记录字段（原始值，倍数由配置乘）：
 *   rewardType    — 优惠类型（ALL / 细分活动名）
 *   todayTotal    — 今日累计优惠（展示用）
 *   currentGrowth — 本时段增长（本时段累计 − 上时段累计）
 *   lastGrowth    — 上时段增长（原始，已由同步层除回 RC 倍数）
 *   alertSeq      — 今日第 N 个告警（展示用）
 *
 * 告警判定：
 *   普通告警：本时段增长 ≥ 上时段增长 × B  → TRUE，否则 FALSE
 *   连续告警：与同优惠类型的上一条告警间隔 < A 分钟（同周期内再次告警）时才检查，
 *             本时段增长 ≥ 上时段增长 × C → TRUE，否则 FALSE；不在连续窗口内 → '-'
 *   缺本时段增长 或 缺上时段增长（0 点首段无上时段）→ null（数据不足，不对比）
 *   上时段增长为 0/负 时照公式正常代入（已与 PM 确认）。
 */

export const getMultLast     = cfg => Number(cfg?.multLast ?? 1)
export const getMultLastCont = cfg => Number(cfg?.multLastCont ?? cfg?.multLast ?? 1)
export const getAlertInterval = cfg => Number(cfg?.alertInterval ?? 30)

/** 两个时间字符串相差的分钟数：t1 − t2 */
function timeDiffMins(t1, t2) {
    return (new Date(t1).getTime() - new Date(t2).getTime()) / 60000
}

/**
 * 今日第 N 个告警（由 RCS_QA 计算，不取 RC 抓取值）：
 * 同一天、同一优惠类型，按时间从旧到新计数，最旧的为 1。
 * records 按 alertTime 降序（index 0 最新），故本条到末尾的同组条数即为其序号。
 * @returns {number|null} 缺告警时间 → null
 */
export function calcAlertSeq(absIdx, records) {
    const cur = records[absIdx]
    if (!cur?.alertTime) return null
    const day  = String(cur.alertTime).slice(0, 10)
    const type = cur.rewardType ?? ''
    let n = 0
    for (let i = absIdx; i < records.length; i++) {
        const r = records[i]
        if ((r.rewardType ?? '') !== type) continue
        if (!r.alertTime || String(r.alertTime).slice(0, 10) !== day) continue
        n++
    }
    return n
}

/** 找同优惠类型的上一条（更旧）记录索引；records 按 alertTime 降序，更旧的 index 更大 */
function prevSameTypeIdx(absIdx, records) {
    const type = records[absIdx]?.rewardType ?? ''
    for (let i = absIdx + 1; i < records.length; i++) {
        if ((records[i]?.rewardType ?? '') === type) return i
    }
    return -1
}

// ── 普通告警结果 ──────────────────────────────────────────────────────────────
/**
 * @param {number}      absIdx  records 中的绝对索引
 * @param {object[]}    records 完整记录列表（按 alertTime 降序）
 * @param {object|null} cfg     关联 Config（提供 multLast = B）
 * @returns {'TRUE'|'FALSE'|null}
 */
export function calcNormalResult(absIdx, records, cfg) {
    const row = records[absIdx]
    if (row.currentGrowth === null || row.currentGrowth === undefined) return null
    if (row.lastGrowth === null || row.lastGrowth === undefined) return null
    return Number(row.currentGrowth) >= Number(row.lastGrowth) * getMultLast(cfg) ? 'TRUE' : 'FALSE'
}

// ── 连续告警结果 ──────────────────────────────────────────────────────────────
/**
 * 触发普通告警后，若在条件1周期（A 分钟）内再次满足 本时段增长 ≥ 上时段增长 × C 则再告警。
 * QA 判定：与同优惠类型上一条告警间隔 < A 分钟 → 视为同周期内的连续告警，按 C 校验；
 * 否则（同类型首条 / 间隔 ≥ A / 缺时间）→ '-'，仅普通告警生效。
 * @returns {'TRUE'|'FALSE'|'-'}
 */
export function calcContResult(absIdx, records, cfg) {
    const cur = records[absIdx]
    if (!cur) return '-'
    const pIdx = prevSameTypeIdx(absIdx, records)
    if (pIdx === -1) return '-'                              // 同类型首条 → 无上一告警
    const prev = records[pIdx]
    if (!cur.alertTime || !prev.alertTime) return '-'
    if (timeDiffMins(cur.alertTime, prev.alertTime) >= getAlertInterval(cfg)) return '-'  // 跨周期 → 非连续
    if (cur.currentGrowth === null || cur.currentGrowth === undefined) return '-'
    if (cur.lastGrowth === null || cur.lastGrowth === undefined) return '-'
    return Number(cur.currentGrowth) >= Number(cur.lastGrowth) * getMultLastCont(cfg) ? 'TRUE' : 'FALSE'
}

/** 连续告警结果对应的颜色（与 alertLogic.getContResultColor 一致） */
export function getContResultColor(result) {
    if (result === 'TRUE') return 'var(--qa-pass)'
    if (result === 'FALSE') return 'var(--qa-fail)'
    return 'var(--qa-neutral)'
}

// ── 逻辑一致 ─────────────────────────────────────────────────────────────────
// 在连续窗口内 → 比对连续告警结果；否则 → 比对普通告警结果（与 alertLogic 统一）
export function calcLogicMatch(absIdx, records, cfg) {
    const row = records[absIdx]
    if (!row?.devResult) return false
    const cont = calcContResult(absIdx, records, cfg)
    if (cont === '-') return calcNormalResult(absIdx, records, cfg) === row.devResult
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
// cfgArg 可为单个 Config，或按行解析配置的函数 (row, absIdx) => cfg（每个优惠名称用各自配置）
export function getMatchCount(records, cfgArg) {
    const resolve = typeof cfgArg === 'function' ? cfgArg : () => cfgArg
    let pass = 0, fail = 0
    records.forEach((row, absIdx) => {
        if (!row.devResult || row.ignored) return
        calcLogicMatch(absIdx, records, resolve(row, absIdx)) ? pass++ : fail++
    })
    return { pass, fail }
}
