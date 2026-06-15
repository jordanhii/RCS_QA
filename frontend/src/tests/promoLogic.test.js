import { describe, it, expect } from 'vitest'
import * as yoy from '../logic/promoYoyLogic.js'
import * as mom from '../logic/promoMomLogic.js'

// 配置（镜像风控优惠监控配置）
const YOY_CFG = { startThreshold: 5000000, mult7: 1.2, mult30: 1.2 }
const MOM_CFG = { multLast: 1.1, alertInterval: 30 }

// ─── 优惠同比 promoYoyLogic（配置驱动）─────────────────────────────────────────
// records 按 alertTime 降序（index 0 = 最新）
describe('promoYoyLogic.calcNormalResult — 优惠同比', () => {
    it('达起步额 且 今日累计 ≥ 前7天平均×1.2 且 ≥ 前30天平均×1.2 → TRUE', () => {
        const recs = [{ alertTime: '2026-05-25 05:20:00', rewardType: 'ALL', todayTotal: 7999000, avg7: 6555000, avg30: 6655555, devResult: 'TRUE' }]
        // 7,999,000 ≥ 5,000,000 ; ≥ 6,555,000×1.2=7,866,000 ; ≥ 6,655,555×1.2=7,986,666
        expect(yoy.calcNormalResult(0, recs, YOY_CFG)).toBe('TRUE')
    })
    it('今日累计 < 起步额 → FALSE（条件1未过）', () => {
        const recs = [{ alertTime: '2026-05-25 05:00:00', rewardType: 'ALL', todayTotal: 4000000, avg7: 4000000, avg30: 4500000 }]
        expect(yoy.calcNormalResult(0, recs, YOY_CFG)).toBe('FALSE')
    })
    it('达起步额但 < 前7天平均×1.2 → FALSE', () => {
        const recs = [{ alertTime: '2026-05-25 05:05:00', rewardType: 'ALL', todayTotal: 5010000, avg7: 5555000, avg30: 5655555 }]
        // 5,010,000 ≥ 5,000,000 起步; 但 < 5,555,000×1.2=6,666,000
        expect(yoy.calcNormalResult(0, recs, YOY_CFG)).toBe('FALSE')
    })
    it('恰好等于阈值 → TRUE（≥ 含等于）', () => {
        const recs = [{ alertTime: '2026-05-25 05:05:00', rewardType: 'ALL', todayTotal: 6000000, avg7: 5000000, avg30: 5000000 }]
        // 6,000,000 ≥ 5,000,000×1.2=6,000,000
        expect(yoy.calcNormalResult(0, recs, YOY_CFG)).toBe('TRUE')
    })
    it('两个平均值都缺 → null（数据不足，不对比）', () => {
        const recs = [{ alertTime: '2026-05-25 05:20:00', rewardType: 'ALL', todayTotal: 9000000, avg7: null, avg30: null }]
        expect(yoy.calcNormalResult(0, recs, YOY_CFG)).toBeNull()
    })
    it('每日只触发一次：当日同类型更早已告警 → 后一条 FALSE', () => {
        const recs = [
            { alertTime: '2026-05-25 06:00:00', rewardType: 'ALL', todayTotal: 14888888, avg7: 6000000, avg30: 6000000 }, // 新
            { alertTime: '2026-05-25 05:20:00', rewardType: 'ALL', todayTotal: 7999000,  avg7: 6000000, avg30: 6000000 }, // 旧·当日首次
        ]
        expect(yoy.calcNormalResult(1, recs, YOY_CFG)).toBe('TRUE')
        expect(yoy.calcNormalResult(0, recs, YOY_CFG)).toBe('FALSE')
    })
    it('当日更早告警是不同优惠类型 → 互不影响，仍 TRUE', () => {
        const recs = [
            { alertTime: '2026-05-25 06:00:00', rewardType: 'LuckyCoins', todayTotal: 9000000, avg7: 6000000, avg30: 6000000 },
            { alertTime: '2026-05-25 05:20:00', rewardType: 'ALL',        todayTotal: 7999000, avg7: 6000000, avg30: 6000000 },
        ]
        expect(yoy.calcNormalResult(0, recs, YOY_CFG)).toBe('TRUE')
    })
    it('跨天：次日同类型可再触发一次', () => {
        const recs = [
            { alertTime: '2026-05-26 05:20:00', rewardType: 'ALL', todayTotal: 8000000, avg7: 6000000, avg30: 6000000 },
            { alertTime: '2026-05-25 05:20:00', rewardType: 'ALL', todayTotal: 7999000, avg7: 6000000, avg30: 6000000 },
        ]
        expect(yoy.calcNormalResult(0, recs, YOY_CFG)).toBe('TRUE')
    })
    it('配置倍数变大后，原本达标的变不达标（配置驱动验证）', () => {
        const recs = [{ alertTime: '2026-05-25 05:20:00', rewardType: 'ALL', todayTotal: 7000000, avg7: 6000000, avg30: 6000000 }]
        expect(yoy.calcNormalResult(0, recs, { startThreshold: 0, mult7: 1.1, mult30: 1.1 })).toBe('TRUE')  // 6,000,000×1.1=6,600,000 ≤ 7,000,000
        expect(yoy.calcNormalResult(0, recs, { startThreshold: 0, mult7: 1.2, mult30: 1.2 })).toBe('FALSE') // 6,000,000×1.2=7,200,000 > 7,000,000
    })
})

describe('promoYoyLogic.calcLogicMatch — 优惠同比', () => {
    it('计算结果与 devResult 一致 → true', () => {
        const recs = [{ alertTime: '2026-05-25 05:20:00', rewardType: 'ALL', todayTotal: 7999000, avg7: 6555000, avg30: 6655555, devResult: 'TRUE' }]
        expect(yoy.calcLogicMatch(0, recs, YOY_CFG)).toBe(true)
    })
    it('RC 判 TRUE 但逻辑算 FALSE（未达起步额）→ 不一致', () => {
        const recs = [{ alertTime: '2026-05-25 05:00:00', rewardType: 'ALL', todayTotal: 4000000, avg7: 100, avg30: 100, devResult: 'TRUE' }]
        expect(yoy.calcLogicMatch(0, recs, YOY_CFG)).toBe(false)
    })
})

// ─── 优惠环比 promoMomLogic（配置驱动）─────────────────────────────────────────
describe('promoMomLogic.calcNormalResult — 优惠环比', () => {
    it('本时段增长 ≥ 上时段增长×1.1 → TRUE', () => {
        const recs = [{ alertTime: '2026-05-25 06:00:00', rewardType: 'ALL', currentGrowth: 6000000, lastGrowth: 4888888, devResult: 'TRUE' }]
        // 6,000,000 ≥ 4,888,888×1.1=5,377,776.8
        expect(mom.calcNormalResult(0, recs, MOM_CFG)).toBe('TRUE')
    })
    it('本时段增长 < 上时段增长×1.1 → FALSE', () => {
        const recs = [{ alertTime: '2026-05-25 06:00:00', rewardType: 'ALL', currentGrowth: 5000000, lastGrowth: 4888888 }]
        // 5,000,000 < 5,377,776.8
        expect(mom.calcNormalResult(0, recs, MOM_CFG)).toBe('FALSE')
    })
    it('上时段增长为 0（阈值=0）→ 本时段任何正增长即 TRUE（已与 PM 确认）', () => {
        const recs = [{ alertTime: '2026-05-25 17:21:00', rewardType: 'ALL', currentGrowth: 3125, lastGrowth: 0 }]
        expect(mom.calcNormalResult(0, recs, MOM_CFG)).toBe('TRUE')
    })
    it('缺上时段增长（0点首段不对比）→ null', () => {
        const recs = [{ alertTime: '2026-05-25 00:30:00', rewardType: 'ALL', currentGrowth: 5000, lastGrowth: null }]
        expect(mom.calcNormalResult(0, recs, MOM_CFG)).toBeNull()
    })
    it('缺本时段增长 → null', () => {
        const recs = [{ alertTime: '2026-05-25 06:00:00', rewardType: 'ALL', currentGrowth: null, lastGrowth: 5000 }]
        expect(mom.calcNormalResult(0, recs, MOM_CFG)).toBeNull()
    })
})

describe('promo getMatchCount', () => {
    it('统计 pass/fail，跳过无 devResult 与 ignored', () => {
        const recs = [
            { alertTime: '2026-05-25 06:00:00', rewardType: 'ALL', currentGrowth: 6000000, lastGrowth: 100, devResult: 'TRUE' },  // pass(算TRUE)
            { alertTime: '2026-05-25 05:30:00', rewardType: 'ALL', currentGrowth: 100, lastGrowth: 6000000, devResult: 'TRUE' },  // fail(算FALSE)
            { alertTime: '2026-05-25 05:00:00', rewardType: 'ALL', currentGrowth: 100, lastGrowth: 50, devResult: '' },           // skip
            { alertTime: '2026-05-25 04:30:00', rewardType: 'ALL', currentGrowth: 100, lastGrowth: 50, devResult: 'TRUE', ignored: true }, // skip
        ]
        expect(mom.getMatchCount(recs, MOM_CFG)).toEqual({ pass: 1, fail: 1 })
    })
})
