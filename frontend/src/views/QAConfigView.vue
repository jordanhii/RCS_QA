<template>
    <div class="qa-config-page">
        <div class="page-header">
            <div>
                <h2 class="page-title">质检配置</h2>
                <p class="page-subtitle">全局同步参数，适用于所有告警逻辑检查页面的风控自动同步</p>
            </div>
        </div>

        <el-tabs v-model="activeTab" class="qa-tabs">
        <!-- ══════════ Tab 1：自动同步 ══════════ -->
        <el-tab-pane name="sync">
            <template #label>
                <span class="qa-tab-label"><el-icon><RefreshRight /></el-icon> 自动同步</span>
            </template>

            <!-- ── 同步参数 ── -->
            <div class="section-label">同步参数</div>
            <div class="config-panel sync-params-card">
                <span class="save-status save-status--corner">
                    <template v-if="saveState === 'saving'">
                        <el-icon class="is-loading"><Loading /></el-icon> 保存中…
                    </template>
                    <template v-else-if="saveState === 'error'">
                        <el-icon color="#F56C6C"><CircleClose /></el-icon>
                        <span style="color:#F56C6C;">保存失败</span>
                        <el-button link type="primary" @click="saveSync">重试</el-button>
                    </template>
                    <template v-else>
                        <el-icon color="#67C23A"><CircleCheck /></el-icon> 已保存<template v-if="savedAt"> {{ savedAt }}</template>
                    </template>
                </span>

                <div v-if="isLoading" style="padding:16px 0;"><el-skeleton :rows="2" animated /></div>
                <template v-else>
                    <div class="params-list">
                        <div class="param-row">
                            <div class="param-row-label">
                                自动同步间隔
                                <el-tooltip content="开启自动同步后，每隔此时间自动点击查询并拉取新数据" placement="top">
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-select v-model="form.syncIntervalMin" style="width: 160px;" @change="queueSave">
                                <el-option :value="1"  label="每 1 分钟" />
                                <el-option :value="2"  label="每 2 分钟" />
                                <el-option :value="5"  label="每 5 分钟" />
                                <el-option :value="10" label="每 10 分钟" />
                            </el-select>
                        </div>
                        <div class="param-row">
                            <div class="param-row-label">
                                每次抓取数量
                                <el-tooltip content="每次触发同步时，向 RC 系统请求的最大告警条数" placement="top">
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-select v-model="form.syncPageSize" style="width: 160px;" @change="queueSave">
                                <el-option :value="50"   label="50 条" />
                                <el-option :value="100"  label="100 条" />
                                <el-option :value="200"  label="200 条" />
                                <el-option :value="500"  label="500 条" />
                                <el-option :value="1000" label="1000 条" />
                            </el-select>
                        </div>
                        <div class="param-row" style="border-bottom:none;">
                            <div class="param-row-label">
                                同步抓取时间
                                <el-tooltip placement="top">
                                    <template #content>
                                        <div style="max-width:300px;line-height:1.7;">
                                            只导入告警时间 ≥ 开始时间的数据；<b>结束时间留空 = 一直抓到最新</b>。<br />
                                            开始也留空 = 不过滤。
                                        </div>
                                    </template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <div class="sync-time-fields">
                                <el-date-picker
                                    type="datetime"
                                    placeholder="开始时间"
                                    format="YYYY-MM-DD HH:mm"
                                    value-format="YYYY-MM-DD HH:mm:ss"
                                    style="width: 185px;"
                                    clearable
                                    :model-value="form.syncStartTime"
                                    @update:model-value="v => { form.syncStartTime = v || null; queueSave() }"
                                />
                                <span class="sync-time-sep">至</span>
                                <el-date-picker
                                    type="datetime"
                                    placeholder="结束（留空=最新）"
                                    format="YYYY-MM-DD HH:mm"
                                    value-format="YYYY-MM-DD HH:mm:ss"
                                    style="width: 205px;"
                                    clearable
                                    :model-value="form.syncEndTime"
                                    @update:model-value="v => { form.syncEndTime = v || null; queueSave() }"
                                />
                            </div>
                            <span v-if="form.syncStartTime || form.syncEndTime" class="range-note">
                                仅导入 {{ form.syncStartTime ? form.syncStartTime.slice(0,16) : '不限' }} ~ {{ form.syncEndTime ? form.syncEndTime.slice(0,16) : '最新' }} 的告警
                            </span>
                        </div>
                    </div>
                    <p class="params-hint params-hint--block">修改后，已开启同步的列表将在下次触发时使用新配置</p>
                </template>
            </div>

            <!-- ── 批量开关 ── -->
            <div class="section-label" style="margin-top:20px;">
                批量开关
                <el-tooltip placement="top" effect="dark" :show-after="100">
                    <template #content>
                        <div style="max-width:300px;line-height:1.7;">
                            勾选告警类型后点击「开启选中」，进入对应页面时将自动启动同步。
                        </div>
                    </template>
                    <el-icon class="section-help"><QuestionFilled /></el-icon>
                </el-tooltip>
            </div>
            <div class="config-panel">
                <div class="card-head">
                    <el-checkbox
                        v-model="batchSelectAll"
                        :indeterminate="batchIndeterminate"
                        @change="onSelectAll">
                        全选
                    </el-checkbox>
                    <span class="batch-selected-count">
                        已选 {{ batchSelected.filter(Boolean).length }} / {{ batchTypes.length }} 种
                    </span>
                </div>

                <div v-if="isBatchLoading" style="padding:12px 0;"><el-skeleton :rows="3" animated /></div>
                <div v-else class="batch-type-grid">
                    <label v-for="(t, i) in batchTypes" :key="t.key"
                        class="batch-type-item" :class="{ 'is-selected': batchSelected[i] }">
                        <el-checkbox v-model="batchSelected[i]" @change="onItemChange">
                            <span class="batch-type-label">{{ t.label }}</span>
                        </el-checkbox>
                        <el-tag v-if="t.enabledCount > 0" type="success" size="small" effect="plain" round>
                            {{ t.enabledCount }}/{{ t.totalCount }} 已开启
                        </el-tag>
                        <span v-else class="batch-list-empty">{{ t.totalCount }} 个列表</span>
                    </label>
                </div>

                <div class="panel-footer">
                    <el-button plain @click="batchDisableSync">关闭全部</el-button>
                    <el-button @click="loadBatchStatus">
                        <el-icon style="margin-right:3px;"><Refresh /></el-icon>刷新状态
                    </el-button>
                    <el-button type="primary" @click="batchEnableSync"
                        :disabled="!batchSelected.some(Boolean)">
                        开启选中
                    </el-button>
                </div>
            </div>
        </el-tab-pane>

        <!-- ══════════ Tab 2：数据导出 ══════════ -->
        <el-tab-pane name="export">
            <template #label>
                <span class="qa-tab-label"><el-icon><Download /></el-icon> 数据导出</span>
            </template>

            <div class="export-stack">
            <!-- ── 数据导出工具 ── -->
            <div>
                <div class="section-label">
                    数据导出工具
                    <el-tooltip placement="top" effect="dark" :show-after="100">
                        <template #content>
                            <div style="max-width:320px;line-height:1.7;">
                                直接从 RC 系统抓取告警数据并导出为 Excel。
                                首次使用会自动用 <b>.env</b> 中配置的账号和 OTP 登录，登录成功后 session 自动保存，后续导出无需重复登录。
                            </div>
                        </template>
                        <el-icon class="section-help"><QuestionFilled /></el-icon>
                    </el-tooltip>
                </div>
                <div class="config-panel">
                    <div class="params-list">
                        <div class="param-row">
                            <div class="param-row-label">
                                域名
                                <el-tooltip content="选择已配置的 RC 系统地址，或直接输入自定义地址" placement="top">
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-select
                                v-model="exportForm.domain"
                                placeholder="选择环境或输入地址"
                                style="width: 300px;"
                                allow-create
                                filterable
                                default-first-option
                            >
                                <el-option
                                    v-for="env in rcEnvs"
                                    :key="env.rcBaseUrl"
                                    :label="`${env.name}  (${env.rcBaseUrl})`"
                                    :value="env.rcBaseUrl"
                                />
                            </el-select>
                        </div>

                        <div class="param-row">
                            <div class="param-row-label">接口</div>
                            <el-select v-model="exportForm.endpoint" style="width: 260px;" @change="onEndpointChange">
                                <el-option value="allTransactionAlerts"  label="allTransactionAlerts（存提款）" />
                                <el-option value="allBetAlerts"          label="allBetAlerts（投注优惠）" />
                                <el-option value="allGameProfitAlerts"   label="allGameProfitAlerts（游戏盈利）" />
                                <el-option value="rewardAlerts"          label="rewardAlerts（优惠/红利）" />
                            </el-select>
                        </div>

                        <div class="param-row">
                            <div class="param-row-label">
                                告警类型
                                <el-tooltip content="留空则导出该接口下的全部告警类型" placement="top">
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-select v-model="exportForm.alertType" style="width: 260px;" clearable placeholder="全部（不过滤）">
                                <el-option
                                    v-for="opt in alertTypeOptions"
                                    :key="opt.value"
                                    :value="opt.value"
                                    :label="opt.label"
                                />
                            </el-select>
                        </div>

                        <div class="param-row">
                            <div class="param-row-label">抓取数量</div>
                            <el-select v-model="exportForm.pageSize" style="width: 160px;">
                                <el-option :value="50"   label="50 条" />
                                <el-option :value="100"  label="100 条" />
                                <el-option :value="200"  label="200 条" />
                                <el-option :value="500"  label="500 条" />
                                <el-option :value="1000" label="1000 条" />
                            </el-select>
                        </div>

                        <div class="param-row" style="border-bottom: none;">
                            <div class="param-row-label">
                                起始时间
                                <el-tooltip content="只导出告警时间 ≥ 此时间的数据，留空则导出全部抓到的数据" placement="top">
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-date-picker
                                v-model="exportForm.startTime"
                                type="datetime"
                                placeholder="留空 = 不过滤"
                                format="YYYY-MM-DD HH:mm"
                                value-format="YYYY-MM-DD HH:mm:ss"
                                style="width: 210px;"
                                clearable
                            />
                            <span v-if="exportForm.startTime" style="font-size:12px; color:#E6A23C; margin-left:8px;">
                                仅导出 {{ exportForm.startTime.slice(0,16) }} 之后
                            </span>
                        </div>
                    </div>

                    <div class="panel-footer">
                        <el-button type="primary" :loading="isExporting" @click="doExport">
                            <el-icon style="margin-right:4px;"><Download /></el-icon>
                            导出 Excel
                        </el-button>
                    </div>
                </div>
            </div>

            </div><!-- /export-grid -->
        </el-tab-pane>
        </el-tabs>
    </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import axios from 'axios'
import { Refresh, RefreshRight, Loading, CircleCheck, CircleClose } from '@element-plus/icons-vue'
import { ElNotification } from 'element-plus'
import { InfoFilled, Download, QuestionFilled } from '@element-plus/icons-vue'

const API = import.meta.env.VITE_API_URL || '/api'
const activeTab = ref('sync')

// ── Sync config ───────────────────────────────────────────────────────────────
const isLoading = ref(false)
const saveState = ref('idle')   // 'idle' | 'saving' | 'error'
const savedAt   = ref(null)
const form = reactive({ syncIntervalMin: 1, syncPageSize: 200, syncStartTime: null, syncEndTime: null })

// ── RC 环境地址（只读，管理入口在「接口配置」页面）─────────────────────────
const rcEnvs = ref([])

const load = async () => {
    isLoading.value = true
    try {
        const res = await axios.get(`${API}/qa-config`)
        form.syncIntervalMin = res.data.syncIntervalMin ?? 1
        form.syncPageSize    = res.data.syncPageSize    ?? 200
        form.syncStartTime   = res.data.syncStartTime   ?? null
        form.syncEndTime     = res.data.syncEndTime     ?? null
        exportForm.domain    = res.data.rcBaseUrl       || ''
        rcEnvs.value         = res.data.rcEnvs          || []
    } catch { /* use defaults */ } finally {
        isLoading.value = false
    }
}
onMounted(() => { load(); loadBatchStatus() })

// ── Auto-save ───────────────────────────────────────────────────────────────
let _saveTimer = null
const queueSave = () => { saveState.value = 'saving'; clearTimeout(_saveTimer); _saveTimer = setTimeout(saveSync, 700) }

const saveSync = async () => {
    saveState.value = 'saving'
    try {
        await axios.post(`${API}/qa-config`, {
            syncIntervalMin: form.syncIntervalMin,
            syncPageSize:    form.syncPageSize,
            syncStartTime:   form.syncStartTime || null,
            syncEndTime:     form.syncEndTime || null,
        })
        saveState.value = 'idle'
        savedAt.value   = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
        saveState.value = 'error'
    }
}

// ── Export ────────────────────────────────────────────────────────────────────
const isExporting = ref(false)
const exportForm  = reactive({ domain: '', endpoint: 'allTransactionAlerts', alertType: '', pageSize: 200, startTime: null })

// 告警类型选项按接口分组，切换接口时自动过滤
const ALERT_TYPE_MAP = {
    allTransactionAlerts: [
        { value: 'deposit',                          label: 'deposit（前X分钟存款-天）' },
        { value: 'deposit-monthly',                  label: 'deposit-monthly（前X分钟存款-月）' },
        { value: 'withdrawal',                       label: 'withdrawal（前X分钟提款-天）' },
        { value: 'withdrawal-monthly',               label: 'withdrawal-monthly（前X分钟提款-月）' },
        { value: 'netflow',                          label: 'netflow（24小时存提款额）' },
        { value: 'netflow-additional-historical',    label: 'netflow-additional-historical（存提差同比）' },
        { value: 'netflow-additional-present-day',   label: 'netflow-additional-present-day（存提出环比）' },
    ],
    allBetAlerts: [
        { value: 'bet-deposit',       label: 'bet-deposit（投/存比）' },
        { value: 'bet-deposit-promo', label: 'bet-deposit-promo（投/存+惠比）' },
    ],
    allGameProfitAlerts: [
        { value: 'game-profit', label: 'game-profit（游戏盈利）' },
    ],
    rewardAlerts: [
        { value: 'reward-cumulative', label: 'reward-cumulative（优惠同比）' },
        { value: 'reward-interval',   label: 'reward-interval（优惠环比）' },
    ],
}
const alertTypeOptions = computed(() => ALERT_TYPE_MAP[exportForm.endpoint] || [])

function onEndpointChange() {
    // 切换接口后，如果当前告警类型不属于新接口，自动清空
    const valid = alertTypeOptions.value.some(o => o.value === exportForm.alertType)
    if (!valid) exportForm.alertType = ''
}

const doExport = async () => {
    if (!exportForm.domain || !exportForm.endpoint) {
        ElNotification.warning({ message: '请选择域名和接口', position: 'bottom-right' })
        return
    }
    isExporting.value = true
    try {
        const resp = await axios.post(`${API}/export-data`, {
            ...exportForm,
            startTime: exportForm.startTime || null,
        }, { responseType: 'blob', timeout: 120_000 })
        const blobUrl = URL.createObjectURL(resp.data)
        const link    = document.createElement('a')
        const cd      = resp.headers['content-disposition'] || ''
        const match   = cd.match(/filename="([^"]+)"/)
        link.href     = blobUrl
        link.download = match ? match[1] : 'rcs_export.xlsx'
        link.click()
        URL.revokeObjectURL(blobUrl)
        ElNotification.success({ message: '导出成功', position: 'bottom-right' })
    } catch (err) {
        let msg = '导出失败'
        if (err.response?.data) {
            try { msg = JSON.parse(await err.response.data.text()).error || msg } catch {}
        }
        ElNotification.error({ message: msg, position: 'bottom-right' })
    } finally {
        isExporting.value = false
    }
}

// ── 批量自动同步 ──────────────────────────────────────────────────────────────

// localStorage key 格式与各子页面保持一致
const syncKey   = id => `rcs_sync_${id}`    // TestView / NetflowHistView
const gpSyncKey = id => `gp_sync_${id}`     // GameProfitView

// 告警类型定义
const BATCH_TYPE_DEFS = [
    { key: 'tl-1',  label: '前X分钟存款（天）',  api: () => axios.get(`${API}/test-lists/1`),         storageKey: syncKey },
    { key: 'tl-2',  label: '前X分钟存款（月）',  api: () => axios.get(`${API}/test-lists/2`),         storageKey: syncKey },
    { key: 'tl-3',  label: '前X分钟提款（天）',  api: () => axios.get(`${API}/test-lists/3`),         storageKey: syncKey },
    { key: 'tl-4',  label: '前X分钟提款（月）',  api: () => axios.get(`${API}/test-lists/4`),         storageKey: syncKey },
    { key: 'tl-5',  label: '24小时存提款额',      api: () => axios.get(`${API}/test-lists/5`),         storageKey: syncKey },
    { key: 'tl-6',  label: '投/存比',             api: () => axios.get(`${API}/test-lists/6`),         storageKey: syncKey },
    { key: 'tl-7',  label: '投/存+惠比',          api: () => axios.get(`${API}/test-lists/7`),         storageKey: syncKey },
    { key: 'gp',    label: '游戏盈利',             api: () => axios.get(`${API}/game-profit-lists`),    storageKey: gpSyncKey },
    { key: 'tl-9',  label: '存提差环比',           api: () => axios.get(`${API}/test-lists/9`),         storageKey: syncKey },
    { key: 'tl-10', label: '存提差同比',           api: () => axios.get(`${API}/test-lists/10`),        storageKey: syncKey },
    { key: 'tl-11', label: '优惠同比',             api: () => axios.get(`${API}/test-lists/11`),        storageKey: syncKey },
    { key: 'tl-12', label: '优惠环比',             api: () => axios.get(`${API}/test-lists/12`),        storageKey: syncKey },
]

const isBatchLoading = ref(false)
const batchTypes     = ref([])   // { key, label, lists:[{_id}], enabledCount, totalCount, storageKey }
const batchSelected  = ref([])

const batchSelectAll    = computed(() => batchSelected.value.length > 0 && batchSelected.value.every(Boolean))
const batchIndeterminate = computed(() => batchSelected.value.some(Boolean) && !batchSelectAll.value)

const onSelectAll = (val) => { batchSelected.value = batchTypes.value.map(() => val) }
const onItemChange = () => { /* triggers computed */ }

/** 读取各列表的 localStorage 状态，计算 enabledCount */
function refreshEnabledCounts() {
    for (const t of batchTypes.value) {
        t.enabledCount = t.lists.filter(l => {
            try { return JSON.parse(localStorage.getItem(t.storageKey(l._id)) || '{}').enabled === true }
            catch { return false }
        }).length
    }
}

/** 拉取所有列表并计算同步状态 */
async function loadBatchStatus() {
    isBatchLoading.value = true
    try {
        const results = await Promise.all(BATCH_TYPE_DEFS.map(d => d.api().catch(() => ({ data: [] }))))
        batchTypes.value = BATCH_TYPE_DEFS.map((def, i) => {
            const lists = results[i].data || []
            return { key: def.key, label: def.label, lists, storageKey: def.storageKey,
                     totalCount: lists.length, enabledCount: 0 }
        })
        batchSelected.value = batchTypes.value.map(() => false)
        refreshEnabledCounts()
    } finally {
        isBatchLoading.value = false
    }
}

/** 开启选中类型的全部列表，并立即触发一次同步 */
async function batchEnableSync() {
    let count = 0
    const rcUrls = new Set()   // 收集需要立即同步的 RC 地址（去重）

    batchTypes.value.forEach((t, i) => {
        if (!batchSelected.value[i]) return
        t.lists.forEach(l => {
            if (!l.rcBaseUrl) return   // 未配置 RC 地址的跳过
            localStorage.setItem(t.storageKey(l._id), JSON.stringify({ enabled: true }))
            rcUrls.add(l.rcBaseUrl)
            count++
        })
    })
    refreshEnabledCounts()

    const noRcCount = batchTypes.value
        .filter((_, i) => batchSelected.value[i])
        .flatMap(t => t.lists)
        .filter(l => !l.rcBaseUrl).length

    if (count === 0) {
        ElNotification.warning({ message: '所选类型的列表均未配置 RC 地址，请先在接口配置页面添加', position: 'bottom-right' })
        return
    }

    // 立即触发同步（对每个涉及的 RC 地址各发一次请求）
    let syncOk = 0
    await Promise.all([...rcUrls].map(async (url) => {
        try {
            await axios.post(`${API}/request-sync`, {
                pageSize:  form.syncPageSize || 200,
                rcBaseUrl: url,
            })
            syncOk++
        } catch { /* 同步服务未运行时静默忽略 */ }
    }))

    const syncNote = syncOk > 0
        ? `已立即触发同步（${syncOk} 个 RC 环境），并将按每 ${form.syncIntervalMin} 分钟自动同步。`
        : '未能触发立即同步（请确认 rc_sync_service.py 正在运行），但已配置好自动同步，进入对应页面时将自动启动。'

    ElNotification.success({
        title: `已为 ${count} 个列表开启自动同步`,
        message: syncNote + (noRcCount > 0 ? `（${noRcCount} 个列表未配置 RC 地址已跳过）` : ''),
        position: 'bottom-right',
        duration: 6000,
    })
}

/** 关闭全部列表的自动同步 */
function batchDisableSync() {
    let count = 0
    batchTypes.value.forEach(t => {
        t.lists.forEach(l => {
            localStorage.setItem(t.storageKey(l._id), JSON.stringify({ enabled: false }))
            count++
        })
    })
    refreshEnabledCounts()
    ElNotification.info({ message: `已关闭全部 ${count} 个列表的自动同步`, position: 'bottom-right' })
}
</script>

<style scoped>
.qa-config-page { display: flex; flex-direction: column; }

.page-header   { margin-bottom: 18px; }
.page-title    { margin: 0 0 3px; font-size: 20px; font-weight: 700; color: var(--qa-heading-color); }
.page-subtitle { margin: 0; font-size: 13px; color: var(--qa-subtext-color); }

/* ── Tabs（顶部分段：自动同步 / 数据导出）────────────────────────────────── */
.qa-tabs :deep(.el-tabs__header) { margin-bottom: 18px; }
.qa-tabs :deep(.el-tabs__nav-wrap::after) { height: 1px; background: #ebeef5; }
.qa-tabs :deep(.el-tabs__item) { font-size: 14px; font-weight: 600; height: 42px; }
.qa-tab-label { display: inline-flex; align-items: center; gap: 6px; }

/* ── 数据导出：单列堆叠（不再左右分栏），卡片满宽与其它页对齐 ──────────────── */
.export-stack {
    display: flex; flex-direction: column; gap: 20px;
}

/* ── Section label：主色竖条 + 粗体（与告警配置/接口配置统一）─────────────── */
.section-label {
    display: flex; align-items: center; gap: 8px;
    font-size: 14px; font-weight: 700; color: var(--qa-heading-color);
    margin-bottom: 12px;
}
.section-label::before {
    content: ''; width: 3px; height: 14px; border-radius: 2px; background: #409EFF; flex-shrink: 0;
}
.section-help { font-size: 14px; color: #c0c4cc; cursor: help; transition: color 0.15s ease; }
.section-help:hover { color: #409EFF; }

/* ── 卡片头：右上角保存状态 / 左右分布 ───────────────────────────────────── */
.card-head {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 14px;
}
.card-head-spacer { flex: 1; }
/* 同步参数卡：已保存放右上角，与第一行参数对齐（不单占一空行）*/
.sync-params-card { position: relative; }
.save-status--corner { position: absolute; top: 20px; right: 22px; }

/* ── Config panel：统一卡片（12px 圆角 + 轻边框 + 淡阴影）───────────────── */
.config-panel {
    background: #fff;
    border: 1px solid #ebeef5;
    border-radius: 12px;
    padding: 20px 22px;
    box-shadow: var(--qa-shadow-xs);
}

/* ── Hint：圆角柔和提示框 ────────────────────────────────────────────────── */
.section-hint {
    display: flex; align-items: flex-start; gap: 8px;
    padding: 10px 14px;
    background: #f2f8ff; border: 1px solid #e1ebf7;
    border-radius: 10px;
    font-size: 13px; color: #5e6d82;
    margin-bottom: 16px;
    line-height: 1.7;
}

/* ── Params（与告警配置一致：卡片满宽，但栏位限宽 720、靠左）─────────────── */
.params-list { display: flex; flex-direction: column; max-width: 720px; }
.param-row {
    display: flex; align-items: center; gap: 24px;
    padding: 13px 0;
    border-bottom: 1px solid #f5f6f8;
}
.param-row:last-child { border-bottom: none; }
.param-row-label {
    width: 120px; flex-shrink: 0;
    font-size: 13px; font-weight: 500; color: #4e5969;
    line-height: 1.4;
    display: flex; align-items: center; gap: 6px;
}

/* ── Footer ─────────────────────────────────────────────────────────────────── */
.panel-footer {
    display: flex; justify-content: flex-end; align-items: center; gap: 8px;
    padding-top: 14px; margin-top: 4px;
    border-top: 1px solid #f5f6f8;
}

/* ── Log panel ──────────────────────────────────────────────────────────────── */
.log-panel {
    background: #fff;
    border: 1px solid #e4e7ed;
    border-radius: var(--qa-radius-md);
    display: flex;
    flex-direction: column;
    height: calc(50vh - 60px);
    min-height: 200px;
    max-height: 380px;
}

.log-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 14px;
    border-bottom: 1px solid #f0f2f5;
    font-size: 13px; font-weight: 600; color: #303133;
    flex-shrink: 0;
}

.log-body {
    flex: 1;
    overflow-y: auto;
    padding: 6px 0;
    font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
    font-size: 11.5px;
}

.log-empty {
    padding: 20px 16px;
    text-align: center;
    color: #c0c4cc;
    font-family: inherit;
    font-size: 12px;
    line-height: 1.8;
}

.log-line {
    display: flex;
    gap: 7px;
    padding: 2px 12px;
    line-height: 1.7;
}
.log-line:hover { background: #f5f7fa; }

.log-ts  { color: #c0c4cc; flex-shrink: 0; min-width: 68px; }

.log-tag {
    flex-shrink: 0;
    padding: 0 5px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 700;
    line-height: 18px;
    align-self: flex-start;
    margin-top: 2px;
}
.log-tag.sync   { background: #ecf5ff; color: #409EFF; }
.log-tag.export { background: #f0f9eb; color: #67C23A; }

.log-msg { color: #303133; word-break: break-all; white-space: pre-wrap; }

.log-err  .log-msg { color: #F56C6C; }
.log-ok   .log-msg { color: #67C23A; }
.log-info .log-msg { color: #409EFF; }

.save-status { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: #909399; }

.range-note { font-size: 12px; color: #E6A23C; margin-left: 8px; white-space: nowrap; }
.sync-time-fields { display: inline-flex; align-items: center; gap: 6px; }
.sync-time-sep { color: #909399; font-size: 12px; }
.params-hint { font-size: 12px; color: #909399; }
.params-hint--block { margin: 12px 0 0; }

/* ── 批量开关：等宽网格，内容靠左成组（不左右撑开）─────────────────────── */
.batch-selected-count { font-size: 12px; color: #909399; }
.batch-type-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}
@media (max-width: 680px) {
    .batch-type-grid { grid-template-columns: 1fr; }
}
.batch-type-item {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 12px; margin: 0;
    background: #fafbfc;
    border: 1px solid #ebeef5;
    border-radius: 10px;
    cursor: pointer;
    transition: var(--qa-transition);
}
.batch-type-item:hover { border-color: #c0d4f0; background: #f5f8fc; }
.batch-type-item.is-selected { border-color: #409EFF; background: #ecf5ff; }
.batch-type-label { font-size: 13px; color: #303133; }
.batch-list-empty { font-size: 11px; color: #c0c4cc; }
/* checkbox 去掉默认右边距，让名称紧贴勾选框、状态紧跟名称 */
.batch-type-item :deep(.el-checkbox) { margin-right: 0; }

</style>
