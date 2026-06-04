import { describe, it, expect } from 'vitest'
import { calcNormalResult, calcContResult, calcLogicMatch, timeDiffMins } from '../logic/alertLogic.js'

// ─── Shared fixtures ──────────────────────────────────────────────────────────
const CFG_1234 = { durationMin: 30, multiUpper: 1.15, multiLower: 0.85 }
const CFG_567  = { ratioLimit: 1.5, ratioMulti: 0.5, alertWindow: 30 }

// ─── timeDiffMins ─────────────────────────────────────────────────────────────
describe('timeDiffMins', () => {
    it('returns positive diff when t1 > t2', () => {
        expect(timeDiffMins('2024-01-01 10:30:00', '2024-01-01 10:00:00')).toBe(30)
    })
    it('returns negative diff when t1 < t2', () => {
        expect(timeDiffMins('2024-01-01 09:00:00', '2024-01-01 10:00:00')).toBe(-60)
    })
    it('returns 0 for identical timestamps', () => {
        expect(timeDiffMins('2024-01-01 10:00:00', '2024-01-01 10:00:00')).toBe(0)
    })
})

// ─── calcNormalResult ─────────────────────────────────────────────────────────
describe('calcNormalResult — typeId 1/2/3/4', () => {
    it('returns WAIT when no config', () => {
        expect(calcNormalResult({ normalType: '上升', val1: 100, val2: 80 }, null, 1)).toBe('WAIT')
    })
    it('上升 + val1 > val2 → TRUE', () => {
        expect(calcNormalResult({ normalType: '上升', val1: 100, val2: 80 }, CFG_1234, 1)).toBe('TRUE')
    })
    it('上升 + val1 <= val2 → FALSE', () => {
        expect(calcNormalResult({ normalType: '上升', val1: 70, val2: 80 }, CFG_1234, 1)).toBe('FALSE')
    })
    it('下降 + val1 < val2 → TRUE', () => {
        expect(calcNormalResult({ normalType: '下降', val1: 60, val2: 80 }, CFG_1234, 1)).toBe('TRUE')
    })
    it('下降 + val1 >= val2 → FALSE', () => {
        expect(calcNormalResult({ normalType: '下降', val1: 90, val2: 80 }, CFG_1234, 1)).toBe('FALSE')
    })
})

describe('calcNormalResult — typeId 5/6/7 (ratio)', () => {
    it('ratio > ratioLimit → TRUE', () => {
        // val1/val2 = 200/100 = 2.0 > 1.5
        expect(calcNormalResult({ val1: 200, val2: 100 }, CFG_567, 5)).toBe('TRUE')
    })
    it('ratio <= ratioLimit → FALSE', () => {
        // val1/val2 = 100/100 = 1.0 <= 1.5
        expect(calcNormalResult({ val1: 100, val2: 100 }, CFG_567, 5)).toBe('FALSE')
    })
    it('val2 = 0 → FALSE (no divide-by-zero crash)', () => {
        expect(calcNormalResult({ val1: 100, val2: 0 }, CFG_567, 5)).toBe('FALSE')
    })
})

// ─── calcContResult — typeId 3/4 ─────────────────────────────────────────────
describe('calcContResult — typeId 3/4', () => {
    // records are stored descending (index 0 = newest)
    const makeRec = (alertTime, contType, val1) => ({ alertTime, contType, val1, val2: 0 })

    it('oldest record (absIdx = records.length-1) with 前30分钟无告警 → TRUE', () => {
        const records = [
            makeRec('2024-01-01 10:20:00', '下降转上升', 100),
            makeRec('2024-01-01 10:00:00', '前30分钟无告警', 80),
        ]
        expect(calcContResult(1, records, CFG_1234, 3)).toBe('TRUE')
    })

    it('oldest record with non-无告警 contType → -', () => {
        const records = [
            makeRec('2024-01-01 10:20:00', '上升恶化', 120),
            makeRec('2024-01-01 10:00:00', '上升恶化', 80),
        ]
        expect(calcContResult(1, records, CFG_1234, 3)).toBe('-')
    })

    it('gap >= durationMin → -', () => {
        const records = [
            makeRec('2024-01-01 11:00:00', '下降转上升', 100),
            makeRec('2024-01-01 10:00:00', '前30分钟无告警', 80),
        ]
        // timeDiff = 60 >= 30
        expect(calcContResult(0, records, CFG_1234, 3)).toBe('-')
    })

    it('上升恶化 + val1 >= prev.val1 * multiUpper → TRUE', () => {
        const records = [
            makeRec('2024-01-01 10:20:00', '上升恶化', 120),
            makeRec('2024-01-01 10:00:00', '上升恶化', 100),
        ]
        // 120 >= 100 * 1.15 = 115 → TRUE
        expect(calcContResult(0, records, CFG_1234, 3)).toBe('TRUE')
    })

    it('上升恶化 + val1 < prev.val1 * multiUpper → FALSE', () => {
        const records = [
            makeRec('2024-01-01 10:20:00', '上升恶化', 110),
            makeRec('2024-01-01 10:00:00', '上升恶化', 100),
        ]
        // 110 < 100 * 1.15 = 115 → FALSE
        expect(calcContResult(0, records, CFG_1234, 3)).toBe('FALSE')
    })

    it('下降转上升 → TRUE', () => {
        const records = [
            makeRec('2024-01-01 10:20:00', '下降转上升', 100),
            makeRec('2024-01-01 10:00:00', '下降恶化', 80),
        ]
        expect(calcContResult(0, records, CFG_1234, 3)).toBe('TRUE')
    })

    it('上升转下降 → TRUE', () => {
        const records = [
            makeRec('2024-01-01 10:20:00', '上升转下降', 90),
            makeRec('2024-01-01 10:00:00', '上升恶化', 80),
        ]
        expect(calcContResult(0, records, CFG_1234, 3)).toBe('TRUE')
    })
})

// ─── calcContResult — typeId 5/6/7 ───────────────────────────────────────────
describe('calcContResult — typeId 5/6/7', () => {
    const makeRec = (alertTime, val1, val2) => ({ alertTime, val1, val2, contType: '', normalType: '' })

    it('oldest record → -', () => {
        const records = [makeRec('2024-01-01 10:00:00', 200, 100)]
        expect(calcContResult(0, records, CFG_567, 5)).toBe('-')
    })

    it('gap >= alertWindow → -', () => {
        const records = [
            makeRec('2024-01-01 11:00:00', 200, 100),
            makeRec('2024-01-01 10:00:00', 100, 100),
        ]
        // timeDiff = 60 >= 30
        expect(calcContResult(0, records, CFG_567, 5)).toBe('-')
    })

    it('val2 = 0 in either record → - (no divide-by-zero)', () => {
        const records = [
            makeRec('2024-01-01 10:20:00', 200, 0),
            makeRec('2024-01-01 10:00:00', 100, 100),
        ]
        expect(calcContResult(0, records, CFG_567, 5)).toBe('-')
    })

    it('cur ratio >= prev ratio + ratioMulti → TRUE', () => {
        const records = [
            makeRec('2024-01-01 10:20:00', 300, 100),  // ratio = 3.0
            makeRec('2024-01-01 10:00:00', 200, 100),  // ratio = 2.0
        ]
        // 3.0 >= 2.0 + 0.5 = 2.5 → TRUE
        expect(calcContResult(0, records, CFG_567, 5)).toBe('TRUE')
    })

    it('cur ratio < prev ratio + ratioMulti → FALSE', () => {
        const records = [
            makeRec('2024-01-01 10:20:00', 210, 100),  // ratio = 2.1
            makeRec('2024-01-01 10:00:00', 200, 100),  // ratio = 2.0
        ]
        // 2.1 < 2.0 + 0.5 = 2.5 → FALSE
        expect(calcContResult(0, records, CFG_567, 5)).toBe('FALSE')
    })
})

// ─── calcLogicMatch ───────────────────────────────────────────────────────────
describe('calcLogicMatch', () => {
    it('typeId 1: match when normal result === devResult', () => {
        const row = { normalType: '上升', val1: 100, val2: 80, devResult: 'TRUE' }
        expect(calcLogicMatch(row, 0, [row], CFG_1234, 1)).toBe(true)
    })

    it('typeId 1: mismatch when normal result !== devResult', () => {
        const row = { normalType: '上升', val1: 70, val2: 80, devResult: 'TRUE' }
        expect(calcLogicMatch(row, 0, [row], CFG_1234, 1)).toBe(false)
    })

    it('typeId 3: uses contResult when contResult is not -', () => {
        const records = [
            { alertTime: '2024-01-01 10:20:00', contType: '下降转上升', val1: 100, val2: 0, devResult: 'TRUE' },
            { alertTime: '2024-01-01 10:00:00', contType: '前30分钟无告警', val1: 80, val2: 0, devResult: 'TRUE' },
        ]
        // absIdx 0: contResult = TRUE (下降转上升); devResult = TRUE → match
        expect(calcLogicMatch(records[0], 0, records, CFG_1234, 3)).toBe(true)
    })
})
