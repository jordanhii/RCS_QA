/** Formats a Date object as "YYYY-MM-DD HH:mm:ss" */
export function fmtDate(d) {
    const p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** Filters raw Excel JSON rows to only those matching the given alertType string */
export function filterByAlertType(rows, alertType) {
    return rows.filter(r => r.alertType === alertType)
}

/** Returns [minTimeStr, maxTimeStr] derived from alertGeneratedTime across all rows */
export function getTimeRange(rows) {
    const times = rows.map(r => new Date(r.alertGeneratedTime).getTime()).filter(t => !isNaN(t))
    if (!times.length) return [null, null]
    return [fmtDate(new Date(Math.min(...times))), fmtDate(new Date(Math.max(...times)))]
}

/**
 * Derives devResult from isAbnormal field: FALSE → 'TRUE', TRUE → 'FALSE'.
 * Defaults to 'TRUE' when field is missing/malformed, matching server.js behaviour.
 */
/**
 * 将 Excel 行的 devResult 字段值转为 'TRUE' / 'FALSE'：
 *   false / "false" → 'FALSE'；其余（包括 alertNumber 等非空字符串）→ 'TRUE'
 */
export function resolveDevResult(row) {
    const v = row.isAbnormal
    if (v === false || String(v).toLowerCase() === 'false') return 'FALSE'
    return 'TRUE'
}

/**
 * Determines the contType for a withdrawal record given the previous row (ascending order).
 * Returns '前30分钟无告警' when there is no previous row or the time gap exceeds durationMin.
 */
export function resolveContType(row, prevRow, durationMin) {
    if (!prevRow) return '前30分钟无告警'
    const timeDiff = Math.abs((new Date(row.alertGeneratedTime) - new Date(prevRow.alertGeneratedTime)) / 60000)
    if (timeDiff >= durationMin) return '前30分钟无告警'
    const prev = prevRow.alertTrend, cur = row.alertTrend
    if (prev === 'down' && cur === 'up') return '下降转上升'
    if (prev === 'up' && cur === 'up') return '上升恶化'
    if (prev === 'up' && cur === 'down') return '上升转下降'
    if (prev === 'down' && cur === 'down') return '下降恶化'
    return '前30分钟无告警'
}

/**
 * Maps a filtered Excel row array to the internal record format.
 * For typeId 3/4, input is sorted ascending internally; output is returned descending (newest first).
 */
export function mapExcelRows(dataToImport, typeId, durationMin = 30) {
    const sorted = [3, 4].includes(typeId)
        ? [...dataToImport].sort((a, b) => new Date(a.alertGeneratedTime) - new Date(b.alertGeneratedTime))
        : dataToImport

    const mapped = sorted.map((row, idx) => {
        const devResult = resolveDevResult(row)

        // 存提差同比 (typeId 10)
        if (typeId === 10) {
            const toNum = (v) => (v === null || v === undefined || v === '') ? null : Number(v)
            const toStr = (v) => (v === null || v === undefined || v === '') ? null : String(v)
            return {
                alertId:             row.alertNumber        || '',
                alertTime:           row.alertGeneratedTime || '',
                val1:                toNum(row.currentAmount),
                depositAmount:       toNum(row.depositAmount),
                withdrawalAmount:    toNum(row.withdrawalAmount),
                historicalYesterday: toNum(row.historicalYesterday),
                historicalLastWeek:  toNum(row.historicalLastWeek),
                historicalLastMonth: toNum(row.historicalLastMonth),
                lowerThanYesterday:  toStr(row.lowerThanYesterday),
                lowerThanLastWeek:   toStr(row.lowerThanLastWeek),
                lowerThanLastMonth:  toStr(row.lowerThanLastMonth),
                devResult,
                ignored: false,
            }
        }

        // ⚠️ 优惠同比/环比 Excel 列名为占位，请对照实际导出列调整
        if (typeId === 11) { // 优惠同比
            const toNum = (v) => (v === null || v === undefined || v === '') ? null : Number(v)
            const toStr = (v) => (v === null || v === undefined || v === '') ? null : String(v)
            return {
                alertId:    row.alertNumber        || '',
                alertTime:  row.alertGeneratedTime || '',
                rewardType: toStr(row.rewardType),
                todayTotal: toNum(row.todayTotalReward),
                avg7:       toNum(row.last7DaysAvg),
                avg30:      toNum(row.last30DaysAvg),
                devResult,
                ignored: false,
            }
        }

        if (typeId === 12) { // 优惠环比
            const toNum = (v) => (v === null || v === undefined || v === '') ? null : Number(v)
            const toStr = (v) => (v === null || v === undefined || v === '') ? null : String(v)
            return {
                alertId:       row.alertNumber        || '',
                alertTime:     row.alertGeneratedTime || '',
                rewardType:    toStr(row.rewardType),
                todayTotal:    toNum(row.todayTotalReward),
                currentGrowth: toNum(row.currentPeriodGrowth),
                lastGrowth:    toNum(row.lastPeriodGrowth),
                alertSeq:      toNum(row.alertSeq),
                devResult,
                ignored: false,
            }
        }

        if ([5, 6, 7].includes(typeId)) {
            return {
                alertId: row.alertNumber || '',
                alertTime: row.alertGeneratedTime || '',
                val1: Number(row['meta.currentAmount'] || 0),
                val2: Number(row['meta.upperBoundary'] || 0),
                normalType: '',
                contType: '',
                devResult
            }
        }

        const normalType = row.alertTrend === 'up' ? '上升' : (row.alertTrend === 'down' ? '下降' : '')
        const avgAmount = row.alertTrend === 'up'
            ? Number(row['meta.upperBoundary'] || 0)
            : Number(row['meta.lowerBoundary'] || 0)
        const currentAmount = Number(row['meta.currentAmount'] || 0)
        const contType = [3, 4].includes(typeId)
            ? resolveContType(row, idx > 0 ? sorted[idx - 1] : null, durationMin)
            : '前30分钟无告警'

        return {
            alertId: row.alertNumber || '',
            alertTime: row.alertGeneratedTime || '',
            val1: currentAmount,
            val2: avgAmount,
            normalType,
            contType,
            devResult
        }
    })

    if ([3, 4].includes(typeId)) mapped.reverse()
    return mapped
}
