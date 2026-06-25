/** Returns difference in minutes between two timestamp strings: t1 - t2 */
export function timeDiffMins(t1, t2) {
    return (new Date(t1).getTime() - new Date(t2).getTime()) / 60000
}

/**
 * 系统计算的真实存款。
 * 24h存提(typeId 5) / 投存比(typeId 6) RC 抓到的「存款金额*阈值」其实是 存款×阈值(比例)，
 * 所以真实存款 = 存款金额 / 比例。其它类型按原 val2 返回。
 */
export function calcRealDeposit(row, cfg, typeId) {
    if ([5, 6].includes(typeId) && cfg && cfg.ratioLimit) return row.val2 / cfg.ratioLimit
    return row.val2
}

/** 比值（提/存、投/存…）：分母用真实存款，而不是抓到的 存款×阈值 */
export function calcRatio(row, cfg, typeId) {
    const denom = calcRealDeposit(row, cfg, typeId)
    return denom ? row.val1 / denom : 0
}

/** Calculates the normal alert result for a single record */
export function calcNormalResult(row, cfg, typeId) {
    if (!cfg) return 'WAIT'
    if ([1, 2, 3, 4].includes(typeId))
        return row.normalType === '上升' ? (row.val1 > row.val2 ? 'TRUE' : 'FALSE') : (row.val1 < row.val2 ? 'TRUE' : 'FALSE')
    if (!row.val2) return 'FALSE'
    return calcRatio(row, cfg, typeId) > (cfg.ratioLimit || 0) ? 'TRUE' : 'FALSE'
}

/**
 * Calculates the continuous alert result for the record at absIdx.
 * records must be stored in descending order (index 0 = newest).
 * Returns 'TRUE', 'FALSE', '-', or 'WAIT'.
 */
export function calcContResult(absIdx, records, cfg, typeId) {
    if (!cfg) return 'WAIT'
    const cur = records[absIdx]
    if (!cur) return '-'

    if ([3, 4].includes(typeId)) {
        if (absIdx === records.length - 1) {
            return cur.contType === '前30分钟无告警' ? 'TRUE' : '-'
        }
        const prev = records[absIdx + 1]
        if (!cur.alertTime || !prev.alertTime) return '-'
        const diff = timeDiffMins(cur.alertTime, prev.alertTime)
        if (diff >= (cfg.durationMin ?? 30)) return '-'
        if (['前30分钟无告警', '下降转上升', '上升转下降'].includes(cur.contType)) return 'TRUE'
        if (cur.contType === '上升恶化') return cur.val1 >= prev.val1 * (cfg.multiUpper ?? 1.15) ? 'TRUE' : 'FALSE'
        if (cur.contType === '下降恶化') return cur.val1 <= prev.val1 * (cfg.multiLower ?? 0.85) ? 'TRUE' : 'FALSE'
    }

    if ([5, 6, 7].includes(typeId)) {
        if (absIdx === records.length - 1) return '-'
        const prev = records[absIdx + 1]
        if (!cur.alertTime || !prev.alertTime) return '-'
        const diff = timeDiffMins(cur.alertTime, prev.alertTime)
        if (diff >= (cfg.alertWindow ?? 30)) return '-'
        if (!cur.val2 || !prev.val2) return '-'
        return calcRatio(cur, cfg, typeId) >= calcRatio(prev, cfg, typeId) + (cfg.ratioMulti ?? 0.5) ? 'TRUE' : 'FALSE'
    }

    return '-'
}

/** Returns whether the QA-computed result matches the RC system's devResult */
export function calcLogicMatch(row, absIdx, records, cfg, typeId) {
    if ([1, 2].includes(typeId)) {
        return calcNormalResult(row, cfg, typeId) === row.devResult
    }
    const contResult = calcContResult(absIdx, records, cfg, typeId)
    if (contResult === '-') {
        return calcNormalResult(row, cfg, typeId) === row.devResult
    }
    return contResult === row.devResult
}

/** Returns the CSS color string for a continuous alert result value */
export function getContResultColor(result) {
    if (result === 'TRUE') return 'var(--qa-pass)'
    if (result === 'FALSE') return 'var(--qa-fail)'
    return 'var(--qa-neutral)'
}
