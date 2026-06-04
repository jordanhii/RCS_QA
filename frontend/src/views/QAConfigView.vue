<template>
    <div class="qa-config-page">
        <div class="page-header">
            <div>
                <h2 class="page-title">质检配置</h2>
                <p class="page-subtitle">全局同步参数，适用于所有告警逻辑检查页面的风控自动同步</p>
            </div>
        </div>

        <div class="qa-config-body">
            <div class="qa-config-left">

                <!-- 风控自动同步（同步参数 + 批量开关合并） -->
                <div class="section-label">风控自动同步</div>
                <div class="config-panel">

                    <!-- 同步参数 -->
                    <div class="sync-sub-label">同步参数</div>
                    <div v-if="isLoading" style="padding:16px 0;"><el-skeleton :rows="2" animated /></div>
                    <div v-else class="params-list">
                        <div class="param-row">
                            <div class="param-row-label">
                                自动同步间隔
                                <el-tooltip content="开启自动同步后，每隔此时间自动点击查询并拉取新数据" placement="top">
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-select v-model="form.syncIntervalMin" style="width: 160px;" :disabled="!isEditing">
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
                            <el-select v-model="form.syncPageSize" style="width: 160px;" :disabled="!isEditing">
                                <el-option :value="50"   label="50 条" />
                                <el-option :value="100"  label="100 条" />
                                <el-option :value="200"  label="200 条" />
                                <el-option :value="500"  label="500 条" />
                                <el-option :value="1000" label="1000 条" />
                            </el-select>
                        </div>
                        <div class="param-row" style="border-bottom:none;">
                            <div class="param-row-label">
                                同步起始时间
                                <el-tooltip placement="top">
                                    <template #content>
                                        设置后，自动同步只导入告警时间 ≥ 此时间的数据，更早的数据会被过滤掉。<br />
                                        留空 = 不过滤，导入全部抓到的数据。
                                    </template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-date-picker
                                v-model="form.syncStartTime"
                                type="datetime"
                                placeholder="留空 = 不过滤"
                                format="YYYY-MM-DD HH:mm"
                                value-format="YYYY-MM-DD HH:mm:ss"
                                style="width: 200px;"
                                clearable
                                :disabled="!isEditing"
                            />
                            <span v-if="form.syncStartTime" style="font-size:12px; color:#E6A23C; margin-left:8px;">
                                仅导入 {{ form.syncStartTime.slice(0,16) }} 之后的告警
                            </span>
                        </div>
                    </div>
                    <div class="params-sub-footer">
                        <span class="params-hint">修改后，已开启同步的列表将在下次触发时使用新配置</span>
                        <template v-if="!isEditing">
                            <el-button size="small" @click="enterEdit">编辑</el-button>
                        </template>
                        <template v-else>
                            <el-button plain size="small" @click="cancelEdit">取消</el-button>
                            <el-button type="primary" size="small" :loading="isSaving" @click="save">保存</el-button>
                        </template>
                    </div>

                    <el-divider style="margin: 16px 0 12px;" />

                    <!-- 批量开关 -->
                    <div class="sync-sub-label" style="margin-bottom:6px;">
                        批量开关
                        <span style="font-size:12px; font-weight:400; color:#909399; margin-left:6px;">
                            勾选告警类型后点击「开启选中」，进入对应页面时将自动启动同步
                        </span>
                    </div>

                    <div v-if="isBatchLoading" style="padding:12px 0;"><el-skeleton :rows="3" animated /></div>
                    <template v-else>
                        <div style="display:flex; align-items:center; gap:10px; padding:8px 0 6px; border-bottom:1px solid #f0f2f5; margin-bottom:8px;">
                            <el-checkbox
                                v-model="batchSelectAll"
                                :indeterminate="batchIndeterminate"
                                @change="onSelectAll">
                                全选
                            </el-checkbox>
                            <span style="font-size:12px; color:#909399;">
                                已选 {{ batchSelected.filter(Boolean).length }} / {{ batchTypes.length }} 种告警类型
                            </span>
                        </div>
                        <div class="batch-type-grid">
                            <div v-for="(t, i) in batchTypes" :key="t.key" class="batch-type-item">
                                <el-checkbox v-model="batchSelected[i]" @change="onItemChange">
                                    <span class="batch-type-label">{{ t.label }}</span>
                                </el-checkbox>
                                <span class="batch-list-count">
                                    <el-tag v-if="t.enabledCount > 0" type="success" size="small" effect="plain">
                                        {{ t.enabledCount }}/{{ t.totalCount }} 已开启
                                    </el-tag>
                                    <span v-else style="font-size:11px; color:#c0c4cc;">{{ t.totalCount }} 个列表</span>
                                </span>
                            </div>
                        </div>
                    </template>

                    <div class="panel-footer">
                        <el-button size="small" plain @click="batchDisableSync">关闭全部</el-button>
                        <el-button size="small" @click="loadBatchStatus">
                            <el-icon style="margin-right:3px;"><Refresh /></el-icon>刷新状态
                        </el-button>
                        <el-button type="primary" size="small" @click="batchEnableSync"
                            :disabled="!batchSelected.some(Boolean)">
                            开启选中
                        </el-button>
                    </div>
                </div>

                <!-- 风控系统地址已移至「接口配置」页面 -->

                <!-- 数据导出工具 -->
                <div class="section-label" style="margin-top: 28px;">数据导出工具</div>
                <div class="config-panel">
                    <div class="section-hint">
                        <el-icon size="14" color="#409EFF"><InfoFilled /></el-icon>
                        <span>
                            直接从 RC 系统抓取告警数据并导出为 Excel。
                            需要先运行 <b>fetch_rc_data.py</b> 完成登录并保存 session，再使用此功能。
                        </span>
                    </div>

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
                                <el-option value="allGameProfitAlerts"   label="allGameProfitAlerts（游戏盈利 CG）" />
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

                        <div class="param-row" style="border-bottom: none;">
                            <div class="param-row-label">抓取数量</div>
                            <el-select v-model="exportForm.pageSize" style="width: 160px;">
                                <el-option :value="50"   label="50 条" />
                                <el-option :value="100"  label="100 条" />
                                <el-option :value="200"  label="200 条" />
                                <el-option :value="500"  label="500 条" />
                                <el-option :value="1000" label="1000 条" />
                            </el-select>
                        </div>
                    </div>

                    <div class="panel-footer">
                        <el-button type="primary" size="small" :loading="isExporting" @click="doExport">
                            <el-icon style="margin-right:4px;"><Download /></el-icon>
                            导出 Excel
                        </el-button>
                    </div>
                </div>

                <!-- IGO 平台导出 -->
                <div class="section-label" style="margin-top: 28px;">IGO 平台导出</div>
                <div class="config-panel">
                    <div class="section-hint">
                        <el-icon size="14" color="#409EFF"><InfoFilled /></el-icon>
                        <span>
                            两阶段并发导出 IGO Specialty Games 数据。Phase 1 浏览器抓取指定日当天数据及 API 请求，
                            Phase 2 并发复放历史 N 天请求，导出 Excel 含每日数据 + 告警分析。
                        </span>
                    </div>

                    <div class="params-list">
                        <div class="param-row">
                            <div class="param-row-label">
                                查询日期
                                <el-tooltip content="分析的目标日期（默认今天）" placement="top">
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-date-picker
                                v-model="igoForm.queryDate"
                                type="date"
                                placeholder="默认今天"
                                format="YYYY-MM-DD"
                                value-format="YYYY-MM-DD"
                                style="width: 180px;"
                                clearable
                            />
                        </div>

                        <div class="param-row">
                            <div class="param-row-label">
                                结束时间
                                <el-tooltip content="格式 HH:MM:SS，开始时间自动往前推 1 小时" placement="top">
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input v-model="igoForm.endTime" placeholder="11:00:59" style="width: 130px;" />
                            <span style="font-size:12px;color:#909399;margin-left:8px;">
                                开始：{{ igoStartTime }}
                            </span>
                        </div>

                        <div class="param-row">
                            <div class="param-row-label">
                                回溯天数
                                <el-tooltip content="往前查询多少天的历史数据（默认 30 天）" placement="top">
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input-number v-model="igoForm.daysBack" :min="1" :max="365" controls-position="right" style="width: 130px;" />
                        </div>

                        <div class="param-row">
                            <div class="param-row-label">Outlet IDs</div>
                            <el-select
                                v-model="igoForm.outletIds"
                                multiple allow-create filterable default-first-option
                                placeholder="输入后回车添加"
                                style="width: 340px;"
                            >
                                <el-option value="IGO"         label="IGO" />
                                <el-option value="Lavie"       label="Lavie" />
                                <el-option value="NCLI"        label="NCLI" />
                                <el-option value="Stotsenberg" label="Stotsenberg" />
                            </el-select>
                        </div>

                        <div class="param-row">
                            <div class="param-row-label">Game Brands</div>
                            <el-select
                                v-model="igoForm.gameBrands"
                                multiple allow-create filterable default-first-option
                                placeholder="输入后回车添加"
                                style="width: 340px;"
                            >
                                <el-option value="IGO-COLORGAME"     label="IGO-COLORGAME" />
                                <el-option value="QAT-55-COLORGAME"  label="QAT-55-COLORGAME" />
                                <el-option value="QAT-COLORGAME"     label="QAT-COLORGAME" />
                            </el-select>
                        </div>

                        <div class="param-row">
                            <div class="param-row-label">
                                告警阈值 X (%)
                                <el-tooltip content="条件1：当前RTP − 日均RTP < X%  →  触发普通告警" placement="top">
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input-number v-model="igoForm.xThreshold" :precision="1" :step="0.5" controls-position="right" style="width: 130px;" />
                        </div>

                        <div class="param-row">
                            <div class="param-row-label">
                                连续阈值 Y (%)
                                <el-tooltip content="条件3：上一GGR − 当日GGR ≥ |上一GGR| × Y%  →  触发连续告警" placement="top">
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input-number v-model="igoForm.yThreshold" :precision="1" :step="0.5" controls-position="right" style="width: 130px;" />
                        </div>

                        <div class="param-row">
                            <div class="param-row-label">
                                上一告警 GGR
                                <el-tooltip content="上次普通告警时的 GGR（totalBonusAmount 取反），用于条件3计算" placement="top">
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input-number v-model="igoForm.prevGgr" :precision="3" :step="100000" controls-position="right" style="width: 160px;" />
                        </div>

                        <div class="param-row">
                            <div class="param-row-label">导出内容</div>
                            <el-checkbox v-model="igoForm.exportRaw">原始数据</el-checkbox>
                            <el-checkbox v-model="igoForm.exportAnalysis" style="margin-left:16px;">告警分析</el-checkbox>
                        </div>

                        <div class="param-row">
                            <div class="param-row-label">
                                IGO 账号
                                <el-tooltip content="首次登录需填写；登录成功后会话自动保存，后续可留空" placement="top">
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input v-model="igoForm.username" placeholder="留空使用默认账号" style="width: 180px;" />
                        </div>

                        <div class="param-row" style="border-bottom: none;">
                            <div class="param-row-label">IGO 密码</div>
                            <el-input v-model="igoForm.password" type="password" show-password placeholder="留空使用默认密码" style="width: 180px;" />
                        </div>
                    </div>

                    <div class="panel-footer">
                        <el-button type="primary" size="small" :loading="isIgoExporting" @click="doIgoExport">
                            <el-icon style="margin-right:4px;"><Download /></el-icon>
                            导出 IGO Excel
                        </el-button>
                    </div>
                </div>

            </div><!-- /qa-config-left -->
        </div><!-- /qa-config-body -->
    </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import axios from 'axios'
import { Refresh } from '@element-plus/icons-vue'
import { ElNotification } from 'element-plus'
import { InfoFilled, Download } from '@element-plus/icons-vue'

const API = 'http://localhost:3000/api'

// ── Sync config ───────────────────────────────────────────────────────────────
const isLoading = ref(false)
const isSaving  = ref(false)
const isEditing = ref(false)
const form = reactive({ syncIntervalMin: 1, syncPageSize: 200, syncStartTime: null })
let _orig = {}

// ── RC 环境地址（只读，管理入口在「接口配置」页面）─────────────────────────
const rcEnvs = ref([])

const load = async () => {
    isLoading.value = true
    try {
        const res = await axios.get(`${API}/qa-config`)
        form.syncIntervalMin = res.data.syncIntervalMin ?? 1
        form.syncPageSize    = res.data.syncPageSize    ?? 200
        form.syncStartTime   = res.data.syncStartTime   ?? null
        exportForm.domain    = res.data.rcBaseUrl       || ''
        rcEnvs.value         = res.data.rcEnvs          || []
    } catch { /* use defaults */ } finally {
        isLoading.value = false
    }
}
onMounted(() => { load(); loadBatchStatus() })

const enterEdit = () => {
    _orig = { syncIntervalMin: form.syncIntervalMin, syncPageSize: form.syncPageSize, syncStartTime: form.syncStartTime }
    isEditing.value = true
}
const cancelEdit = () => { Object.assign(form, _orig); isEditing.value = false }
const save = async () => {
    isSaving.value = true
    try {
        await axios.post(`${API}/qa-config`, {
            syncIntervalMin: form.syncIntervalMin,
            syncPageSize:    form.syncPageSize,
            syncStartTime:   form.syncStartTime || null,
        })
        isEditing.value = false
        ElNotification.success({ message: '质检配置已保存', position: 'bottom-right', duration: 2500 })
        // Remind user to restart any running auto-sync switches for the new settings to take effect
        setTimeout(() => {
            ElNotification.info({
                title: '提醒',
                message: '已开启自动同步的列表将在下次触发时应用新参数；如需立即生效，请在测试页面关闭再重新开启对应列表的同步开关。',
                position: 'bottom-right',
                duration: 6000
            })
        }, 600)
    } catch {
        ElNotification.error({ message: '保存失败，请重试', position: 'bottom-right' })
    } finally { isSaving.value = false }
}

// ── Export ────────────────────────────────────────────────────────────────────
const isExporting = ref(false)
const exportForm  = reactive({ domain: '', endpoint: 'allTransactionAlerts', alertType: '', pageSize: 200 })

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
        { value: 'game-profit', label: 'game-profit（游戏盈利 CG）' },
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
        const resp = await axios.post(`${API}/export-data`, { ...exportForm }, { responseType: 'blob', timeout: 120_000 })
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

// ── IGO Export ────────────────────────────────────────────────────────────────
const isIgoExporting = ref(false)
const igoForm = reactive({
    queryDate:      '',
    endTime:        '11:00:59',
    daysBack:       30,
    outletIds:      ['IGO', 'Lavie', 'NCLI', 'Stotsenberg'],
    gameBrands:     ['IGO-COLORGAME', 'QAT-55-COLORGAME', 'QAT-COLORGAME'],
    xThreshold:     5.0,
    yThreshold:     10.0,
    prevGgr:        0,
    exportRaw:      false,
    exportAnalysis: true,
    username:       '',
    password:       '',
})

// 开始时间 = 结束时间往前推 3599 秒
const igoStartTime = computed(() => {
    try {
        const parts = igoForm.endTime.split(':').map(Number)
        if (parts.length !== 3 || parts.some(isNaN)) return '--:--:--'
        const totalSec = parts[0] * 3600 + parts[1] * 60 + parts[2] - 3599
        const h = Math.floor(((totalSec % 86400) + 86400) % 86400 / 3600)
        const m = Math.floor(((totalSec % 86400) + 86400) % 86400 % 3600 / 60)
        const s = ((totalSec % 86400) + 86400) % 86400 % 60
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    } catch { return '--:--:--' }
})

const doIgoExport = async () => {
    isIgoExporting.value = true
    try {
        const payload = {
            queryDate:      igoForm.queryDate      || '',
            endTime:        igoForm.endTime        || '11:00:59',
            daysBack:       igoForm.daysBack       || 30,
            outletIds:      igoForm.outletIds,
            gameBrands:     igoForm.gameBrands,
            xThreshold:     igoForm.xThreshold,
            yThreshold:     igoForm.yThreshold,
            prevGgr:        igoForm.prevGgr,
            exportRaw:      igoForm.exportRaw,
            exportAnalysis: igoForm.exportAnalysis,
            username:       igoForm.username || '',
            password:       igoForm.password || '',
        }
        const resp = await axios.post(`${API}/igo-export`, payload, {
            responseType: 'blob',
            timeout: 1_800_000,
        })
        const blobUrl = URL.createObjectURL(resp.data)
        const link    = document.createElement('a')
        const cd      = resp.headers['content-disposition'] || ''
        const match   = cd.match(/filename="([^"]+)"/)
        link.href     = blobUrl
        link.download = match ? match[1] : 'igo_export.xlsx'
        link.click()
        URL.revokeObjectURL(blobUrl)
        ElNotification.success({ message: 'IGO 数据导出成功', position: 'bottom-right' })
        igoForm.password = ''
    } catch (err) {
        let msg = 'IGO 导出失败'
        if (err.response?.data) {
            try { msg = JSON.parse(await err.response.data.text()).error || msg } catch {}
        }
        ElNotification.error({ message: msg, position: 'bottom-right' })
    } finally {
        isIgoExporting.value = false
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
    { key: 'gp',    label: '游戏盈利(CG)',         api: () => axios.get(`${API}/game-profit-lists`),    storageKey: gpSyncKey },
    { key: 'tl-9',  label: '存提差环比',           api: () => axios.get(`${API}/test-lists/9`),         storageKey: syncKey },
    { key: 'tl-10', label: '存提差同比',           api: () => axios.get(`${API}/test-lists/10`),        storageKey: syncKey },
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

.page-header   { margin-bottom: 20px; }
.page-title    { margin: 0 0 4px; font-size: 22px; color: var(--qa-heading-color); }
.page-subtitle { margin: 0; font-size: 13px; color: var(--qa-subtext-color); }

/* ── Layout ─────────────────────────────────────────────────────────────────── */
.qa-config-body { display: flex; flex-direction: column; gap: 20px; }
.qa-config-left { max-width: 640px; }

/* ── Section label ──────────────────────────────────────────────────────────── */
.section-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--qa-subtext-color, #909399);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 10px;
}

/* ── Config panel ───────────────────────────────────────────────────────────── */
.config-panel {
    background: #fff;
    border: 1px solid #e4e7ed;
    border-radius: var(--qa-radius-md);
    padding: 20px;
}

/* ── Hint ───────────────────────────────────────────────────────────────────── */
.section-hint {
    display: flex; align-items: flex-start; gap: 6px;
    padding: 8px 12px;
    background: var(--qa-import-info-bg);
    border-left: 3px solid #409EFF;
    font-size: 13px; color: #606266;
    margin-bottom: 16px;
    border-radius: 0 4px 4px 0;
    line-height: 1.6;
}

/* ── Params ─────────────────────────────────────────────────────────────────── */
.params-list { display: flex; flex-direction: column; }
.param-row {
    display: flex; align-items: center; gap: 20px;
    padding: 12px 0;
    border-bottom: 1px solid #f0f2f5;
}
.param-row:last-child { border-bottom: none; }
.param-row-label {
    width: 120px; flex-shrink: 0;
    font-size: 13px; font-weight: 500; color: #303133;
    display: flex; align-items: center; gap: 5px;
}

/* ── Footer ─────────────────────────────────────────────────────────────────── */
.panel-footer {
    display: flex; justify-content: flex-end; align-items: center; gap: 8px;
    padding-top: 14px; margin-top: 4px;
    border-top: 1px solid #f0f2f5;
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

/* ── 合并面板内部子标题 ──────────────────────────────────────────────────── */
.sync-sub-label {
    font-size: 12px;
    font-weight: 600;
    color: #606266;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-bottom: 10px;
}
.params-sub-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 10px 0 0;
    margin-top: 4px;
    border-top: 1px solid #f0f2f5;
}
.params-hint {
    flex: 1;
    font-size: 12px;
    color: #909399;
}

/* ── 批量自动同步 ─────────────────────────────────────────────────────────── */
.batch-type-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0;
    padding: 4px 0;
}
.batch-type-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 4px;
    border-bottom: 1px solid #f5f7fa;
}
.batch-type-item:nth-last-child(-n+2) { border-bottom: none; }
.batch-type-label { font-size: 13px; color: #303133; }
.batch-list-count { flex-shrink: 0; margin-left: 6px; }
</style>
