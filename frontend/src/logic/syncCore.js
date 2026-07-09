/**
 * syncCore — 同步核心逻辑（TestView 与 useSyncManager 共用）
 *
 * 之前 TestView 和 AlertListShell 各写了一套几乎一样的同步流程，导致同一类 bug
 * 要在两处分别修（冷却时不读缓存、列表级残留时间误过滤）。这里把最易出错、且必须
 * 两边完全一致的部分收敛成一份：时间窗解析、request-sync + 冷却处理 + 轮询缓存。
 * 各页面自己的「映射 / 去重 / 保存 / 提示」仍留在各自代码里（本就该不同）。
 */
import axios from 'axios'

export const SYNC_API = import.meta.env.VITE_API_URL || '/api'

/**
 * 解析生效的同步时间窗。
 * 与界面一致：全局(质检配置)设了「开始或结束」任一时间，就整体用全局值（子页面时间被禁用）；
 * 否则才用列表级。绝不逐字段 `||` 回退——那会在全局只设开始时误用列表级残留的旧结束时间，
 * 把该时间之后的最新数据悄悄过滤掉。
 */
export function syncTimeWindow(qaCfg, list) {
    const useGlobal = qaCfg?.syncStartTime || qaCfg?.syncEndTime
    const s = useGlobal ? qaCfg?.syncStartTime : list?.syncStartTime
    const e = useGlobal ? qaCfg?.syncEndTime   : list?.syncEndTime
    return {
        active: !!(s || e),
        sMs: s ? new Date(s).getTime() : -Infinity,
        eMs: e ? new Date(e).getTime() :  Infinity,
    }
}

/** 按同步时间窗过滤记录（依据 record.alertTime）。窗口未设置则原样返回。 */
export function filterByTimeWindow(records, qaCfg, list) {
    const { active, sMs, eMs } = syncTimeWindow(qaCfg, list)
    if (!active) return records
    return records.filter(r => {
        const t = new Date(r.alertTime).getTime()
        return !isNaN(t) && t >= sMs && t <= eMs
    })
}

/**
 * 触发同步并轮询缓存，返回过滤后的记录。
 *
 * 关键契约（两个历史 bug 的根治点）：
 * - 后端冷却(skipped=true)时：不重复触发 Python，但**仍读一次缓存**返回已有数据，
 *   绝不早退（早退会导致列表白屏、看不到已同步的数据）。
 * - skipRequest=true：完全不触发 request-sync，直接读缓存（页面恢复场景）。
 *
 * @param {object}   o.list          列表对象（需含 rcBaseUrl）
 * @param {number}   o.pageSize      抓取条数
 * @param {string}   o.cacheUrl      读缓存的完整 URL
 * @param {Function} [o.filter]      过滤原始记录（用于提前结束轮询与返回），默认原样
 * @param {boolean}  [o.skipRequest] true=不触发同步只读缓存
 * @param {number}   [o.waitMs]      触发后等待 Python 推送的时间
 * @param {number}   [o.maxAttempts] 轮询次数
 * @param {number}   [o.pollGapMs]   轮询间隔
 * @param {Function} [o.onCooldown]  冷却回调：被限流时传剩余秒数，正常触发时传 null
 * @returns {Promise<{ skipped:boolean, fetched:any[], rawCount:number }>}
 */
export async function requestAndPollCache({
    list, pageSize, cacheUrl, filter = r => r,
    skipRequest = false, waitMs = 15000, maxAttempts = 12, pollGapMs = 5000,
    onCooldown,
}) {
    let skipped = false
    if (!skipRequest) {
        const { data } = await axios.post(`${SYNC_API}/request-sync`, {
            pageSize:  pageSize || 200,
            rcBaseUrl: list.rcBaseUrl || '',
        })
        skipped = !!data?.skipped
        onCooldown?.(skipped ? (data?.remainingSec || 0) : null)
        if (!skipped && waitMs > 0) await new Promise(r => setTimeout(r, waitMs))
    }
    // 冷却 / 恢复时数据已在缓存里，读一次即可；正常触发则轮询等推送到位
    const attempts = (skipRequest || skipped) ? 1 : maxAttempts
    let fetched = [], rawCount = 0
    for (let i = 0; i < attempts; i++) {
        const { data } = await axios.get(cacheUrl)
        const raw = data.data || []
        rawCount = data.totalRaw ?? raw.length
        fetched  = filter(raw)
        if (fetched.length > 0 || i === attempts - 1) break
        await new Promise(r => setTimeout(r, pollGapMs))
    }
    return { skipped, fetched, rawCount }
}
