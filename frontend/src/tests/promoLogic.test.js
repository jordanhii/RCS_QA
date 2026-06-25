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

// ─── 优惠同比 连续告警 promoYoyLogic.calcContResult（条件3）────────────────────
// 普通倍数 1.05、连续倍数 1.15、连续间隔 5 分钟（镜像风控优惠监控配置）
const YOY_CONT_CFG = { startThreshold: 0, mult7: 1.05, mult30: 1.05, mult7Cont: 1.15, mult30Cont: 1.15, alertInterval: 5 }

describe('promoYoyLogic.calcContResult — 优惠同比连续告警', () => {
    it('当日同类型首条（无更早告警）→ -', () => {
        const recs = [{ alertTime: '2026-06-24 18:00:00', rewardType: 'ALL', todayTotal: 1100, avg7: 100, avg30: 1000, devResult: 'TRUE' }]
        expect(yoy.calcContResult(0, recs, YOY_CONT_CFG)).toBe('-')
    })
    it('间隔 ≥ N 分钟 且 恶化到 ≥前7/前30天平均×连续倍数 → TRUE', () => {
        const recs = [
            { alertTime: '2026-06-24 18:12:00', rewardType: 'ALL', todayTotal: 1200, avg7: 100, avg30: 1000, devResult: 'TRUE' },
            { alertTime: '2026-06-24 18:00:00', rewardType: 'ALL', todayTotal: 1100, avg7: 100, avg30: 1000, devResult: 'TRUE' },
        ]
        // 间隔 12min ≥ 5；1200 ≥ 100×1.15=115 且 ≥ 1000×1.15=1150
        expect(yoy.calcContResult(0, recs, YOY_CONT_CFG)).toBe('TRUE')
    })
    it('间隔 < N 分钟（太快再发）→ FALSE（即便金额达标）', () => {
        const recs = [
            { alertTime: '2026-06-24 18:03:00', rewardType: 'ALL', todayTotal: 1200, avg7: 100, avg30: 1000, devResult: 'TRUE' },
            { alertTime: '2026-06-24 18:00:00', rewardType: 'ALL', todayTotal: 1100, avg7: 100, avg30: 1000, devResult: 'TRUE' },
        ]
        // 间隔 3min < 5 → 太快，连续告警不该发
        expect(yoy.calcContResult(0, recs, YOY_CONT_CFG)).toBe('FALSE')
    })
    it('间隔 ≥ N 但 未恶化到连续倍数（< 前30天平均×1.15）→ FALSE', () => {
        const recs = [
            { alertTime: '2026-06-24 18:12:00', rewardType: 'ALL', todayTotal: 1100, avg7: 100, avg30: 1000, devResult: 'TRUE' },
            { alertTime: '2026-06-24 18:00:00', rewardType: 'ALL', todayTotal: 1050, avg7: 100, avg30: 1000, devResult: 'TRUE' },
        ]
        // 1100 < 1000×1.15=1150 → 未达连续门槛
        expect(yoy.calcContResult(0, recs, YOY_CONT_CFG)).toBe('FALSE')
    })
})

describe('promoYoyLogic.calcLogicMatch — 首条比普通、之后比连续', () => {
    const recs = [
        { alertTime: '2026-06-24 18:12:00', rewardType: 'ALL', todayTotal: 1200, avg7: 100, avg30: 1000, devResult: 'TRUE' }, // 连续
        { alertTime: '2026-06-24 18:00:00', rewardType: 'ALL', todayTotal: 1100, avg7: 100, avg30: 1000, devResult: 'TRUE' }, // 首条·普通
    ]
    it('首条按普通判定一致', () => { expect(yoy.calcLogicMatch(1, recs, YOY_CONT_CFG)).toBe(true) })
    it('之后按连续判定一致', () => { expect(yoy.calcLogicMatch(0, recs, YOY_CONT_CFG)).toBe(true) })
    it('每分钟重复触发：间隔不足 → 连续算 FALSE，与 RC=TRUE 不一致（命中误报）', () => {
        const dup = [
            { alertTime: '2026-06-24 18:01:00', rewardType: 'ALL', todayTotal: 1100, avg7: 100, avg30: 1000, devResult: 'TRUE' },
            { alertTime: '2026-06-24 18:00:00', rewardType: 'ALL', todayTotal: 1100, avg7: 100, avg30: 1000, devResult: 'TRUE' },
        ]
        expect(yoy.calcLogicMatch(0, dup, YOY_CONT_CFG)).toBe(false)
    })
})

describe('promoYoyLogic.getMatchCount — 按优惠类型解析各自配置（resolver）', () => {
    it('不同优惠类型用不同倍数', () => {
        const cfgByName = {
            ALL: { startThreshold: 0, mult7: 1.05, mult30: 1.05, mult7Cont: 1.15, mult30Cont: 1.15, alertInterval: 5 },
            Mud: { startThreshold: 0, mult7: 100,  mult30: 100,  mult7Cont: 200,  mult30Cont: 200,  alertInterval: 5 },
        }
        const recs = [
            { alertTime: '2026-06-24 18:00:00', rewardType: 'ALL', todayTotal: 1100, avg7: 100, avg30: 1000, devResult: 'TRUE' }, // 普通：1100≥1050 → pass
            { alertTime: '2026-06-24 18:00:00', rewardType: 'Mud', todayTotal: 1100, avg7: 100, avg30: 1000, devResult: 'TRUE' }, // 普通：1100 < 1000×100 → FALSE → fail
        ]
        const resolver = row => cfgByName[row.rewardType] || null
        expect(yoy.getMatchCount(recs, resolver)).toEqual({ pass: 1, fail: 1 })
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

// ─── 优惠环比 连续告警 promoMomLogic.calcContResult ───────────────────────────
const MOM_CONT_CFG = { multLast: 1.1, multLastCont: 1.5, alertInterval: 30 }

describe('promoMomLogic.calcContResult — 优惠环比连续告警', () => {
    it('同类型上一告警在 A 分钟内 且 本时段增长 ≥ 上时段×C → TRUE', () => {
        const recs = [
            { alertTime: '2026-05-25 10:05:00', rewardType: 'ALL', currentGrowth: 1000, lastGrowth: 500, devResult: 'TRUE' },
            { alertTime: '2026-05-25 10:00:00', rewardType: 'ALL', currentGrowth: 500,  lastGrowth: 100, devResult: 'TRUE' },
        ]
        // 间隔 5min < 30；1000 ≥ 500×1.5=750
        expect(mom.calcContResult(0, recs, MOM_CONT_CFG)).toBe('TRUE')
    })
    it('A 分钟内 但 本时段增长 < 上时段×C → FALSE', () => {
        const recs = [
            { alertTime: '2026-05-25 10:05:00', rewardType: 'ALL', currentGrowth: 1000, lastGrowth: 800, devResult: 'TRUE' },
            { alertTime: '2026-05-25 10:00:00', rewardType: 'ALL', currentGrowth: 500,  lastGrowth: 100, devResult: 'TRUE' },
        ]
        // 1000 < 800×1.5=1200
        expect(mom.calcContResult(0, recs, MOM_CONT_CFG)).toBe('FALSE')
    })
    it('与上一同类型告警间隔 ≥ A → 跨周期，非连续 → -', () => {
        const recs = [
            { alertTime: '2026-05-25 10:40:00', rewardType: 'ALL', currentGrowth: 1000, lastGrowth: 100, devResult: 'TRUE' },
            { alertTime: '2026-05-25 10:00:00', rewardType: 'ALL', currentGrowth: 500,  lastGrowth: 100, devResult: 'TRUE' },
        ]
        expect(mom.calcContResult(0, recs, MOM_CONT_CFG)).toBe('-')
    })
    it('同类型首条（无更早同类型告警）→ -', () => {
        const recs = [
            { alertTime: '2026-05-25 10:05:00', rewardType: 'ALL', currentGrowth: 1000, lastGrowth: 500, devResult: 'TRUE' },
        ]
        expect(mom.calcContResult(0, recs, MOM_CONT_CFG)).toBe('-')
    })
    it('上一条是不同优惠类型 → 互不视为连续 → -', () => {
        const recs = [
            { alertTime: '2026-05-25 10:05:00', rewardType: 'ALL', currentGrowth: 1000, lastGrowth: 500, devResult: 'TRUE' },
            { alertTime: '2026-05-25 10:00:00', rewardType: 'Mud', currentGrowth: 500,  lastGrowth: 100, devResult: 'TRUE' },
        ]
        expect(mom.calcContResult(0, recs, MOM_CONT_CFG)).toBe('-')
    })
})

describe('promoMomLogic.calcLogicMatch — 连续窗口内比连续结果', () => {
    it('连续窗口内：RC=TRUE 且 连续算 TRUE → 一致', () => {
        const recs = [
            { alertTime: '2026-05-25 10:05:00', rewardType: 'ALL', currentGrowth: 1000, lastGrowth: 500, devResult: 'TRUE' },
            { alertTime: '2026-05-25 10:00:00', rewardType: 'ALL', currentGrowth: 500,  lastGrowth: 100, devResult: 'TRUE' },
        ]
        expect(mom.calcLogicMatch(0, recs, MOM_CONT_CFG)).toBe(true)
    })
    it('连续窗口内：RC=TRUE 但 连续算 FALSE（< 上时段×C）→ 不一致', () => {
        const recs = [
            { alertTime: '2026-05-25 10:05:00', rewardType: 'ALL', currentGrowth: 1000, lastGrowth: 800, devResult: 'TRUE' },
            { alertTime: '2026-05-25 10:00:00', rewardType: 'ALL', currentGrowth: 500,  lastGrowth: 100, devResult: 'TRUE' },
        ]
        expect(mom.calcLogicMatch(0, recs, MOM_CONT_CFG)).toBe(false)
    })
})

describe('promoMomLogic.calcAlertSeq — 今日第N个告警（RCS_QA 计算）', () => {
    // records 按 alertTime 降序（index 0 最新）
    const recs = [
        { alertTime: '2026-06-23 23:41:00', rewardType: 'ALL' }, // 当日 ALL 第3个
        { alertTime: '2026-06-23 23:40:00', rewardType: 'Mud' }, // 当日 Mud 第2个
        { alertTime: '2026-06-23 23:39:00', rewardType: 'ALL' }, // 当日 ALL 第2个
        { alertTime: '2026-06-23 10:00:00', rewardType: 'ALL' }, // 当日 ALL 第1个
        { alertTime: '2026-06-23 09:00:00', rewardType: 'Mud' }, // 当日 Mud 第1个
        { alertTime: '2026-06-22 23:00:00', rewardType: 'ALL' }, // 前一天 ALL 第1个
    ]
    it('同日同类型按时间从旧到新计数，最旧为1', () => {
        expect(mom.calcAlertSeq(0, recs)).toBe(3)  // ALL 23:41
        expect(mom.calcAlertSeq(2, recs)).toBe(2)  // ALL 23:39
        expect(mom.calcAlertSeq(3, recs)).toBe(1)  // ALL 10:00
    })
    it('不同优惠类型各自独立计数', () => {
        expect(mom.calcAlertSeq(1, recs)).toBe(2)  // Mud 23:40
        expect(mom.calcAlertSeq(4, recs)).toBe(1)  // Mud 09:00
    })
    it('跨天独立计数：前一天的同类型不计入今天', () => {
        expect(mom.calcAlertSeq(5, recs)).toBe(1)  // 前一天 ALL
    })
    it('缺告警时间 → null', () => {
        expect(mom.calcAlertSeq(0, [{ rewardType: 'ALL' }])).toBeNull()
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
    it('按优惠名称解析各自配置（resolver）：不同优惠名称用不同倍数', () => {
        // ALL 用 B=1.1，Mud 用 B=100（极高，必不达标）
        const cfgByName = { ALL: { multLast: 1.1, alertInterval: 30 }, Mud: { multLast: 100, alertInterval: 30 } }
        const recs = [
            { alertTime: '2026-06-23 06:00:00', rewardType: 'ALL', currentGrowth: 6000000, lastGrowth: 100, devResult: 'TRUE' }, // 6e6≥110 → pass
            { alertTime: '2026-06-23 06:00:00', rewardType: 'Mud', currentGrowth: 6000000, lastGrowth: 100, devResult: 'TRUE' }, // 6e6 < 100×100=10000? 不，10000<6e6 → 仍 TRUE
            { alertTime: '2026-06-23 05:00:00', rewardType: 'Mud', currentGrowth: 50,      lastGrowth: 100, devResult: 'TRUE' }, // 50 < 100×100=10000 → FALSE → fail
        ]
        const resolver = row => cfgByName[row.rewardType] || null
        expect(mom.getMatchCount(recs, resolver)).toEqual({ pass: 2, fail: 1 })
    })
})
