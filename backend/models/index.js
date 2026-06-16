import mongoose from 'mongoose'

const SCHEMA_OPTS = { timestamps: true, versionKey: false }

// ── Config (alert thresholds, typeId 1-9) ─────────────────────────────────────
const ConfigSchema = new mongoose.Schema({
    typeId:       { type: Number, index: true },
    name:         { type: String, trim: true },
    durationMin:  { type: Number, default: 30 },
    multiUpper:   { type: Number, default: 1.15 },
    multiLower:   { type: Number, default: 0.85 },
    ratioLimit:   { type: Number, default: 1.5 },
    ratioMulti:   { type: Number, default: 0.5 },
    alertWindow:  { type: Number, default: 30 },
    ggrThreshold: { type: Number, default: 10 },
    xThreshold:   { type: Number, default: 2500 },
    yThreshold:   { type: Number, default: 10 },
    alertInterval:{ type: Number, default: 60 },
    // ── 优惠同比 (typeId 11) / 优惠环比 (typeId 12) 配置参数（镜像风控优惠监控配置）──
    startThreshold:{ type: Number, default: 0 },    // 同比：日累计优惠起步判断额
    mult7:         { type: Number, default: 1.2 },  // 同比：≥前7天平均 × 倍数
    mult30:        { type: Number, default: 1.2 },  // 同比：≥前30天平均 × 倍数
    multLast:      { type: Number, default: 1.2 },  // 环比：≥上时段 × 倍数
}, SCHEMA_OPTS)

// 同一 typeId 下配置名唯一（稀疏索引允许 name 为空）
ConfigSchema.index({ typeId: 1, name: 1 }, { unique: true, sparse: true })

// ── TestList (typeId 1-7, 9 alert records) ────────────────────────────────────
const MAX_RECORDS = 5000   // 单列表最大记录数，防止单文档超 16 MB

const TestListSchema = new mongoose.Schema({
    typeId:        { type: Number, index: true },
    listName:      { type: String, trim: true },
    configId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Config' },
    rcBaseUrl:     { type: String, default: '' },
    syncStartTime: { type: String, default: null },  // 列表级同步起始时间（为 null 则用全局配置）
    records: [{
        alertId:    String,
        alertTime:  String,
        val1:       { type: Number, default: null },
        val2:       { type: Number, default: null },
        normalType: { type: String, enum: ['上升', '下降', ''], default: '' },
        contType:   String,
        devResult:  { type: String, enum: ['TRUE', 'FALSE', ''], default: '' },
        ignored:    { type: Boolean, default: false },
        // ── 存提差环比 (typeId 9) 专用字段 ──────────────────────────────────
        // null = 接口未返回该字段（路径配置错误）；0 = 接口返回值为零
        depositAmount:        { type: Number, default: null },
        withdrawalAmount:     { type: Number, default: null },
        lastNetflowAmount:    { type: Number, default: null },
        lastDepositAmount:    { type: Number, default: null },
        lastWithdrawalAmount: { type: Number, default: null },
        // ── 存提差同比 (typeId 10) 专用字段 ─────────────────────────────────────
        // null = 接口未返回；RC 返回的 lowerThan* 字段存字符串 'true'/'false'
        historicalYesterday:  { type: Number, default: null },
        historicalLastWeek:   { type: Number, default: null },
        historicalLastMonth:  { type: Number, default: null },
        lowerThanYesterday:   { type: String, default: null },
        lowerThanLastWeek:    { type: String, default: null },
        lowerThanLastMonth:   { type: String, default: null },
        // ── 优惠同比 (typeId 11) / 优惠环比 (typeId 12) 专用字段 ─────────────────
        // null = 接口未返回。配置驱动：记录存原始值，倍数由 Config 乘（镜像风控优惠监控配置）。
        rewardType:    { type: String, default: null },   // 优惠类型（ALL / 细分活动名）
        todayTotal:    { type: Number, default: null },   // 今日累计优惠
        avg7:          { type: Number, default: null },   // 同比：前7天平均日累计优惠（原始）
        avg30:         { type: Number, default: null },   // 同比：前30天平均日累计优惠（原始）
        currentGrowth: { type: Number, default: null },   // 环比：本时段增长
        lastGrowth:    { type: Number, default: null },   // 环比：上时段增长（原始）
        alertSeq:      { type: Number, default: null },   // 环比：今日第 N 个告警
    }],
}, SCHEMA_OPTS)

export { MAX_RECORDS }

// ── GameProfitList (game-profit / COLORGAME records) ──────────────────────────
const GameProfitListSchema = new mongoose.Schema({
    listName:      { type: String, trim: true },
    rcBaseUrl:     { type: String, default: '' },
    configId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Config', default: null },
    ignoreC2:      { type: Boolean, default: false },
    syncStartTime: { type: String, default: null },  // 列表级同步起始时间
    records: [{
        alertId:         String,
        alertTime:       String,
        currentBet:      Number,
        betMedian:       Number,
        currentRtp:      Number,
        avgRtp:          Number,
        rtpDeviation:    Number,
        currentGgr:      Number,
        lastGgr:         Number,
        prevAlertTime:   String,
        currentBetCount: Number,
        avgBetCount:     Number,
        devResult:       { type: String, enum: ['TRUE', 'FALSE', ''], default: '' },
        ignored:         { type: Boolean, default: false },
    }],
}, SCHEMA_OPTS)

// ── CaptureConfig (field mapping per alert type) ──────────────────────────────
const CaptureConfigSchema = new mongoose.Schema({
    typeId:   { type: Number, unique: true },
    endpoint: { type: String, default: null, trim: true },   // null = 未配置，''  已统一为 null
    fields:   [{ listField: String, path: { type: String, trim: true } }],
}, SCHEMA_OPTS)

// ── QAConfig (global QA settings + RC env list) ───────────────────────────────
const QAConfigSchema = new mongoose.Schema({
    singleton:       { type: String, default: 'default', unique: true },
    syncIntervalMin: { type: Number, default: 1 },
    syncPageSize:    { type: Number, default: 200 },
    syncStartTime:   { type: String, default: null },  // 同步起始时间过滤，null = 不过滤
    rcBaseUrl:       { type: String, default: 'https://rc-client.platform88.me' },
    rcEnvs: {
        type: [{
            _id:       { type: mongoose.Schema.Types.ObjectId, auto: true },
            name:      String,
            rcBaseUrl: String,
        }],
        default: [],
    },
}, SCHEMA_OPTS)

// ── SyncCache (persisted per-URL cache for Python sync service) ───────────────
const SyncCacheSchema = new mongoose.Schema({
    normUrl:     { type: String, unique: true, index: true },
    transaction: { type: Array, default: [] },
    bet:         { type: Array, default: [] },
    gameProfit:  { type: Array, default: [] },
    reward:      { type: Array, default: [] },   // /rewardAlerts：优惠同比(11)/环比(12) 原始记录
    updatedAt:   { type: String, default: null },
}, { timestamps: false, versionKey: false })

// TTL：7 天未更新的缓存自动删除（防止无限增长）
// 注意：updatedAt 是 String 类型，TTL 需要用 Date 类型字段才生效
// 改用 Mongoose timestamps 的 updatedAt（Date）来触发 TTL
SyncCacheSchema.index({ updatedAt: 1 }, {
    expireAfterSeconds: 7 * 24 * 3600,
    // updatedAt 是 String，MongoDB TTL 只对 Date 生效，此索引仅用于查询优化
    // 真正的过期清理通过 persistCacheToDb 写入时间戳控制
})

export const Config         = mongoose.model('Config',         ConfigSchema)
export const TestList       = mongoose.model('TestList',       TestListSchema)
export const GameProfitList = mongoose.model('GameProfitList', GameProfitListSchema)
export const CaptureConfig  = mongoose.model('CaptureConfig',  CaptureConfigSchema)
export const QAConfig       = mongoose.model('QAConfig',       QAConfigSchema)
export const SyncCacheDoc   = mongoose.model('SyncCache',      SyncCacheSchema)
