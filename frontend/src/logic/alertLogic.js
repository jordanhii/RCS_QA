/** Returns difference in minutes between two timestamp strings: t1 - t2 */
export function timeDiffMins(t1, t2) {
    return (new Date(t1).getTime() - new Date(t2).getTime()) / 60000
}

/** Calculates the normal alert result for a single record */
export function calcNormalResult(row, cfg, typeId) {
    if (!cfg) return 'WAIT'
    if ([1, 2, 3, 4].includes(typeId))
        return row.normalType === '上升' ? (row.val1 > row.val2 ? 'TRUE' : 'FALSE') : (row.val1 < row.val2 ? 'TRUE' : 'FALSE')
    if (!row.val2) return 'FALSE'
    return (row.val1 / row.val2) > (cfg.ratioLimit || 0) ? 'TRUE' : 'FALSE'
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
        if (diff >= (cfg.durationMin || 30)) return '-'
        if (['前30分钟无告警', '下降转上升', '上升转下降'].includes(cur.contType)) return 'TRUE'
        if (cur.contType === '上升恶化') return cur.val1 >= prev.val1 * (cfg.multiUpper || 1.15) ? 'TRUE' : 'FALSE'
        if (cur.contType === '下降恶化') return cur.val1 <= prev.val1 * (cfg.multiLower || 0.85) ? 'TRUE' : 'FALSE'
    }

    if ([5, 6, 7].includes(typeId)) {
        if (absIdx === records.length - 1) return '-'
        const prev = records[absIdx + 1]
        if (!cur.alertTime || !prev.alertTime) return '-'
        const diff = timeDiffMins(cur.alertTime, prev.alertTime)
        if (diff >= (cfg.alertWindow || 30)) return '-'
        if (!cur.val2 || !prev.val2) return '-'
        return (cur.val1 / cur.val2) >= (prev.val1 / prev.val2) + (cfg.ratioMulti || 0.5) ? 'TRUE' : 'FALSE'
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
