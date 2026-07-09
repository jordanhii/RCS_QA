/**
 * useSyncManager — shared sync composable
 *
 * Extracted from TestView.vue and GameProfitView.vue to eliminate ~300 lines
 * of duplicated sync infrastructure. Both views should migrate to this.
 *
 * @example
 * const sync = useSyncManager({
 *   getCacheUrl:   list => `${API}/sync-cache/${typeId}?url=${encodeURIComponent(list.rcBaseUrl)}`,
 *   filterRecords: raw => raw,
 *   mapRecord:     item => ({ alertId: item.alertNumber, ... }),
 *   onNewRecords:  async (list, newOnes) => { await saveList(list, false) },
 * })
 */
import { ref, reactive } from 'vue'
import axios from 'axios'
import { ElNotification } from 'element-plus'
import { useAppStore } from '../stores/appStore.js'
import { requestAndPollCache } from '../logic/syncCore.js'

const API = import.meta.env.VITE_API_URL || '/api'
const COOLDOWN_MS = 30_000

export function useSyncManager({ getCacheUrl, filterRecords, mapRecord, onNewRecords }) {
    const store = useAppStore()

    // ── Global sync status ─────────────────────────────────────────────────────
    const globalSyncStatus = ref({ isAlive: false })

    async function fetchSyncStatus(rcBaseUrl = '') {
        try {
            const params = rcBaseUrl ? { url: rcBaseUrl } : {}
            const { data } = await axios.get(`${API}/sync-status`, { params })
            globalSyncStatus.value = data
        } catch {
            globalSyncStatus.value = { isAlive: false }
        }
    }

    // ── Cooldown timer ─────────────────────────────────────────────────────────
    const _cooldownMap = reactive({})
    const _tick        = ref(0)
    let   _tickTimer   = null

    function startTick() { if (!_tickTimer) _tickTimer = setInterval(() => _tick.value++, 1000) }
    function stopTick()  { if (_tickTimer)  { clearInterval(_tickTimer); _tickTimer = null } }

    function markCooldown(url) { _cooldownMap[url || ''] = Date.now() }
    // 后端已在冷却（还剩 remainingSec 秒）时，让前端按钮同步反映剩余时间
    function markCooldownRemaining(url, remainingSec) {
        _cooldownMap[url || ''] = Date.now() - Math.max(0, COOLDOWN_MS - remainingSec * 1000)
    }
    function cooldownSec(url) {
        _tick.value  // reactive dependency
        const start = _cooldownMap[url || '']
        if (!start) return 0
        const elapsed = Date.now() - start
        return elapsed >= COOLDOWN_MS ? 0 : Math.ceil((COOLDOWN_MS - elapsed) / 1000)
    }

    // ── Per-list sync timers ───────────────────────────────────────────────────
    const syncTimers = new Map()

    // ── Core sync ─────────────────────────────────────────────────────────────
    async function runSync(list, isManual = false) {
        if (list._isSyncingNow) return
        list._isSyncingNow = true
        try {
            // 核心流程（request-sync + 冷却处理 + 轮询缓存）走共享 syncCore，两页面一致
            const { fetched, rawCount } = await requestAndPollCache({
                list,
                pageSize: store.qaConfig.syncPageSize,
                cacheUrl: getCacheUrl(list),
                filter:   raw => filterRecords(raw, list),
                waitMs:   15000,
                maxAttempts: 12,
                pollGapMs:   5000,
                onCooldown: sec => sec === null
                    ? markCooldown(list.rcBaseUrl || '')
                    : markCooldownRemaining(list.rcBaseUrl || '', sec),
            })

            const existedIds = new Set(list.records.map(r => r.alertId).filter(Boolean))
            const newOnes = fetched
                .map(item => mapRecord(item))
                .filter(r => r.alertId && !existedIds.has(r.alertId))

            list._lastSyncAt = new Date().toLocaleTimeString('zh-CN', {
                hour: '2-digit', minute: '2-digit', second: '2-digit',
            })

            if (newOnes.length > 0) {
                list.records.unshift(...newOnes)
                list._currentPage = 1
                if (onNewRecords) await onNewRecords(list, newOnes)
                ElNotification.success({
                    message:  `${isManual ? '手动' : '自动'}同步：新增 ${newOnes.length} 条（已保存）`,
                    position: 'bottom-right', duration: 3000,
                })
            } else if (isManual) {
                if (rawCount === 0) {
                    ElNotification.warning({ title: '暂无数据', message: '缓存为空，请确认 rc_sync_service.py 正在运行', position: 'bottom-right', duration: 5000 })
                } else if (fetched.length > 0) {
                    ElNotification.info({ message: `拉取到 ${fetched.length} 条，已全部在列表中（无新增）`, position: 'bottom-right', duration: 3000 })
                } else {
                    ElNotification.warning({ title: '无匹配数据', message: `共 ${rawCount} 条原始数据，无匹配记录`, position: 'bottom-right', duration: 6000 })
                }
            }
            await fetchSyncStatus(list.rcBaseUrl)
        } catch (e) {
            console.error('[useSyncManager] Sync error:', e)
        } finally {
            list._isSyncingNow = false
        }
    }

    async function startAutoSync(list, saveFn) {
        if (!list.rcBaseUrl) {
            list._syncEnabled = false
            ElNotification.warning({
                title: '请先选择 RC 地址',
                message: '必须为此列表选择对应的 RC 系统地址，才能开启风控自动同步',
                position: 'bottom-right', duration: 4000,
            })
            return
        }
        stopAutoSync(list, saveFn)
        if (saveFn) saveFn(list, false)
        await fetchSyncStatus(list.rcBaseUrl)
        ElNotification.info({ message: '正在进行首次同步，请稍候…', position: 'bottom-right', duration: 3000 })
        await runSync(list)
        const ms = (store.qaConfig.syncIntervalMin || 1) * 60 * 1000
        syncTimers.set(list._id, setInterval(() => runSync(list), ms))
    }

    function stopAutoSync(list, saveFn) {
        if (syncTimers.has(list._id)) {
            clearInterval(syncTimers.get(list._id))
            syncTimers.delete(list._id)
        }
        if (saveFn) saveFn(list, false)
    }

    async function manualSync(list) {
        await fetchSyncStatus(list.rcBaseUrl)
        await runSync(list, true)
    }

    function destroyAll() {
        syncTimers.forEach(t => clearInterval(t))
        syncTimers.clear()
        stopTick()
    }

    return {
        globalSyncStatus,
        fetchSyncStatus,
        cooldownSec,
        startTick,
        stopTick,
        startAutoSync,
        stopAutoSync,
        manualSync,
        destroyAll,
    }
}
