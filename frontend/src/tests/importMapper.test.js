import { describe, it, expect } from 'vitest'
import { fmtDate, filterByAlertType, getTimeRange, resolveDevResult, resolveContType, mapExcelRows } from '../logic/importMapper.js'

// ─── fmtDate ──────────────────────────────────────────────────────────────────
describe('fmtDate', () => {
    it('formats date as YYYY-MM-DD HH:mm:ss', () => {
        const d = new Date('2024-03-15T08:05:09')
        expect(fmtDate(d)).toBe('2024-03-15 08:05:09')
    })
    it('zero-pads single-digit values', () => {
        const d = new Date('2024-01-02T03:04:05')
        expect(fmtDate(d)).toBe('2024-01-02 03:04:05')
    })
})

// ─── filterByAlertType ────────────────────────────────────────────────────────
describe('filterByAlertType', () => {
    const rows = [
        { alertType: 'deposit', alertGeneratedTime: '2024-01-01 10:00:00' },
        { alertType: 'withdrawal', alertGeneratedTime: '2024-01-01 11:00:00' },
        { alertType: 'deposit', alertGeneratedTime: '2024-01-01 12:00:00' },
    ]

    it('returns only rows matching alertType', () => {
        expect(filterByAlertType(rows, 'deposit')).toHaveLength(2)
    })
    it('returns empty array when no match', () => {
        expect(filterByAlertType(rows, 'netflow')).toHaveLength(0)
    })
})

// ─── getTimeRange ─────────────────────────────────────────────────────────────
describe('getTimeRange', () => {
    const rows = [
        { alertGeneratedTime: '2024-01-01 12:00:00' },
        { alertGeneratedTime: '2024-01-01 08:00:00' },
        { alertGeneratedTime: '2024-01-01 10:00:00' },
    ]

    it('returns [min, max] timestamp strings', () => {
        const [min, max] = getTimeRange(rows)
        expect(min).toBe('2024-01-01 08:00:00')
        expect(max).toBe('2024-01-01 12:00:00')
    })
    it('returns [null, null] for empty rows', () => {
        expect(getTimeRange([])).toEqual([null, null])
    })
    it('returns [null, null] when all timestamps invalid', () => {
        expect(getTimeRange([{ alertGeneratedTime: 'bad' }])).toEqual([null, null])
    })
})

// ─── resolveDevResult ─────────────────────────────────────────────────────────
describe('resolveDevResult', () => {
    it('isAbnormal=FALSE → devResult=TRUE', () => {
        expect(resolveDevResult({ isAbnormal: 'FALSE' })).toBe('TRUE')
        expect(resolveDevResult({ isAbnormal: false  })).toBe('TRUE')
    })
    it('isAbnormal=TRUE → devResult=FALSE', () => {
        expect(resolveDevResult({ isAbnormal: 'TRUE' })).toBe('FALSE')
        expect(resolveDevResult({ isAbnormal: true   })).toBe('FALSE')
    })
    it('missing/unknown → defaults to TRUE (matches server.js)', () => {
        expect(resolveDevResult({ isAbnormal: undefined })).toBe('TRUE')
        expect(resolveDevResult({ isAbnormal: 'unknown' })).toBe('TRUE')
        expect(resolveDevResult({})).toBe('TRUE')
    })
})

// ─── resolveContType ──────────────────────────────────────────────────────────
describe('resolveContType', () => {
    it('no prevRow → 前30分钟无告警', () => {
        const row = { alertGeneratedTime: '2024-01-01 10:20:00', alertTrend: 'up' }
        expect(resolveContType(row, null, 30)).toBe('前30分钟无告警')
    })

    it('timeDiff >= durationMin → 前30分钟无告警', () => {
        const row  = { alertGeneratedTime: '2024-01-01 11:00:00', alertTrend: 'up' }
        const prev = { alertGeneratedTime: '2024-01-01 10:00:00', alertTrend: 'up' }
        // diff = 60 >= 30
        expect(resolveContType(row, prev, 30)).toBe('前30分钟无告警')
    })

    it('prev=down, cur=up → 下降转上升', () => {
        const row  = { alertGeneratedTime: '2024-01-01 10:20:00', alertTrend: 'up' }
        const prev = { alertGeneratedTime: '2024-01-01 10:00:00', alertTrend: 'down' }
        expect(resolveContType(row, prev, 30)).toBe('下降转上升')
    })

    it('prev=up, cur=up → 上升恶化', () => {
        const row  = { alertGeneratedTime: '2024-01-01 10:20:00', alertTrend: 'up' }
        const prev = { alertGeneratedTime: '2024-01-01 10:00:00', alertTrend: 'up' }
        expect(resolveContType(row, prev, 30)).toBe('上升恶化')
    })

    it('prev=up, cur=down → 上升转下降', () => {
        const row  = { alertGeneratedTime: '2024-01-01 10:20:00', alertTrend: 'down' }
        const prev = { alertGeneratedTime: '2024-01-01 10:00:00', alertTrend: 'up' }
        expect(resolveContType(row, prev, 30)).toBe('上升转下降')
    })

    it('prev=down, cur=down → 下降恶化', () => {
        const row  = { alertGeneratedTime: '2024-01-01 10:20:00', alertTrend: 'down' }
        const prev = { alertGeneratedTime: '2024-01-01 10:00:00', alertTrend: 'down' }
        expect(resolveContType(row, prev, 30)).toBe('下降恶化')
    })
})

// ─── mapExcelRows ─────────────────────────────────────────────────────────────
describe('mapExcelRows — typeId 1 (deposit)', () => {
    const rows = [
        {
            alertType: 'deposit',
            alertNumber: 'ALT001',
            alertGeneratedTime: '2024-01-01 10:00:00',
            alertTrend: 'up',
            isAbnormal: 'FALSE',
            'meta.currentAmount': '500',
            'meta.upperBoundary': '400',
            'meta.lowerBoundary': '200',
        }
    ]

    it('maps fields correctly', () => {
        const result = mapExcelRows(rows, 1)
        expect(result).toHaveLength(1)
        expect(result[0].alertId).toBe('ALT001')
        expect(result[0].alertTime).toBe('2024-01-01 10:00:00')
        expect(result[0].val1).toBe(500)
        expect(result[0].val2).toBe(400)   // upper boundary for 上升
        expect(result[0].normalType).toBe('上升')
        expect(result[0].devResult).toBe('TRUE')  // isAbnormal=FALSE → TRUE
        expect(result[0].contType).toBe('前30分钟无告警')  // typeId 1 always
    })
})

describe('mapExcelRows — typeId 3/4 (withdrawal) ordering', () => {
    const rows = [
        { alertNumber: 'A2', alertGeneratedTime: '2024-01-01 10:20:00', alertTrend: 'up',   isAbnormal: 'FALSE', 'meta.currentAmount': '120', 'meta.upperBoundary': '100', 'meta.lowerBoundary': '50' },
        { alertNumber: 'A1', alertGeneratedTime: '2024-01-01 10:00:00', alertTrend: 'up',   isAbnormal: 'FALSE', 'meta.currentAmount': '100', 'meta.upperBoundary': '90',  'meta.lowerBoundary': '50' },
    ]

    it('output is descending (newest first)', () => {
        const result = mapExcelRows(rows, 3)
        expect(result[0].alertId).toBe('A2')   // newest
        expect(result[1].alertId).toBe('A1')   // oldest
    })

    it('contType resolved correctly between consecutive rows', () => {
        const result = mapExcelRows(rows, 3)
        // A1 is oldest → 前30分钟无告警
        expect(result[1].contType).toBe('前30分钟无告警')
        // A2 follows A1 (both up → 上升恶化)
        expect(result[0].contType).toBe('上升恶化')
    })
})

describe('mapExcelRows — typeId 5/6/7 (ratio)', () => {
    const rows = [
        {
            alertNumber: 'B001',
            alertGeneratedTime: '2024-01-01 10:00:00',
            isAbnormal: 'TRUE',
            'meta.currentAmount': '300',
            'meta.upperBoundary': '200',
        }
    ]

    it('maps ratio record — no normalType/contType', () => {
        const result = mapExcelRows(rows, 5)
        expect(result[0].normalType).toBe('')
        expect(result[0].contType).toBe('')
        expect(result[0].val1).toBe(300)
        expect(result[0].val2).toBe(200)
        expect(result[0].devResult).toBe('FALSE')  // isAbnormal=TRUE → FALSE
    })
})
