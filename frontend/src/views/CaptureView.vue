<template>
    <div class="capture-page">
        <div class="page-header">
            <div>
                <h2 class="page-title">接口配置</h2>
                <p class="page-subtitle">配置 RC 系统地址、各告警类型的 API 接口及字段映射</p>
            </div>
        </div>

        <!-- ── RC 系统地址（多环境管理）────────────────────────────────────── -->
        <div class="section-label">RC 系统地址</div>
        <div class="config-panel" style="margin-bottom: 24px;">
            <div class="section-hint">
                <el-icon size="14" color="#409EFF"><InfoFilled /></el-icon>
                <span>
                    配置各环境的 RC 系统地址。在「告警逻辑检查」列表同步栏可下拉选择对应环境，实现多环境并行同步。<br />
                    <code>rc_sync_service.py</code> 启动时默认使用<b>第一个</b>地址（也可通过 <code>--url</code> 参数覆盖）。
                </span>
            </div>

            <!-- 已有地址列表 -->
            <div v-if="rcEnvs.length === 0" class="env-empty">暂无配置，请在下方添加。</div>
            <div v-else class="env-list">
                <div v-for="(env, idx) in rcEnvs" :key="env._id || idx" class="env-item">
                    <div class="env-tag" v-if="idx === 0">
                        <el-tag size="small" type="success">默认</el-tag>
                    </div>
                    <div class="env-info">
                        <span class="env-name">{{ env.name }}</span>
                        <span class="env-url">{{ env.rcBaseUrl }}</span>
                    </div>
                    <el-button size="small" type="danger" plain @click="removeEnv(env)" :loading="isDeletingEnv === env._id">
                        删除
                    </el-button>
                </div>
            </div>

            <!-- 新增表单 -->
            <div class="env-add-form">
                <el-input v-model="newEnv.name" placeholder="名称（如：正式站）" style="width:110px;" size="small" />
                <el-input v-model="newEnv.rcBaseUrl" placeholder="https://rc-client.platform88.me" style="flex:1;" size="small" />
                <el-button type="primary" size="small" :loading="isAddingEnv" @click="addEnv">添加</el-button>
            </div>
        </div>

        <!-- ── 字段映射配置 ────────────────────────────────────────────────── -->
        <div class="section-label">字段映射配置</div>
        <div class="type-selector-row">
            <span class="type-selector-label">告警类型：</span>
            <el-select
                v-model="activeTab"
                size="default"
                style="width:220px;"
                @change="onTypeChange"
            >
                <el-option
                    v-for="t in typeNames"
                    :key="String(t.id)"
                    :label="t.label"
                    :value="String(t.id)"
                />
            </el-select>
            <span class="type-selector-hint">{{ currentGroupHint }}</span>
        </div>

        <div class="tab-body">
            <div class="section-hint">
                <el-icon size="14" color="#409EFF"><InfoFilled /></el-icon>
                <span>
                    在「列表字段」中选择告警逻辑检查页面对应的列，填写从 RC 接口抓取该字段所用的
                    API 路径。例：选「告警单号」→ 填 <code>alertNumber</code>
                </span>
            </div>

            <div v-if="isLoading" style="padding: 16px 0;"><el-skeleton :rows="3" animated /></div>

            <template v-else>
                <!-- 接口地址 -->
                <div class="param-row">
                    <div class="param-row-label">接口地址</div>
                    <el-input
                        v-model="endpoint"
                        placeholder="例：/allTransactionAlerts"
                        style="max-width: 420px;"
                        clearable
                        @change="queueSave"
                    />
                </div>

                <!-- 字段映射表 -->
                <el-table :data="fields" border size="small" style="width: 100%; margin: 14px 0 0;">
                    <el-table-column label="列表字段" width="200">
                        <template #default="scope">
                            <el-select v-model="scope.row.listField" size="small" style="width: 100%"
                                placeholder="选择列表字段" @change="queueSave">
                                <el-option v-for="f in currentListFields" :key="f.value" :label="f.label" :value="f.value" />
                            </el-select>
                        </template>
                    </el-table-column>
                    <el-table-column label="API 字段路径">
                        <template #default="scope">
                            <el-input v-model="scope.row.path" size="small"
                                placeholder="例：alertMetadata.currentAmount" @change="queueSave" />
                        </template>
                    </el-table-column>
                    <el-table-column label="操作" width="70" align="center">
                        <template #default="scope">
                            <el-button type="danger" link size="small" @click="removeField(scope.$index)">删除</el-button>
                        </template>
                    </el-table-column>
                </el-table>
            </template>

            <!-- 底部操作行：左侧添加/重置，右侧自动保存状态指示 -->
            <div class="panel-footer">
                <div class="footer-left">
                    <el-button size="small" @click="addField">
                        <el-icon style="margin-right:4px;"><Plus /></el-icon> 添加字段
                    </el-button>
                    <el-button size="small" plain @click="resetDefaults">
                        <el-icon style="margin-right:4px;"><RefreshRight /></el-icon> 恢复默认
                    </el-button>
                </div>
                <div class="footer-right">
                    <span class="save-status" style="display:inline-flex; align-items:center; gap:5px; font-size:13px; color:#909399;">
                        <template v-if="saveState === 'saving'">
                            <el-icon class="is-loading"><Loading /></el-icon> 保存中…
                        </template>
                        <template v-else-if="saveState === 'error'">
                            <el-icon color="#F56C6C"><CircleClose /></el-icon>
                            <span style="color:#F56C6C;">保存失败</span>
                            <el-button link type="primary" @click="saveConfig">重试</el-button>
                        </template>
                        <template v-else>
                            <el-icon color="#67C23A"><CircleCheck /></el-icon> 已保存<template v-if="savedAt"> {{ savedAt }}</template>
                        </template>
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import axios from 'axios'
import { ElNotification, ElMessageBox } from 'element-plus'
import { Plus, InfoFilled, RefreshRight, Loading, CircleCheck, CircleClose } from '@element-plus/icons-vue'

const API = 'http://localhost:3000/api'
const activeTab = ref('1')
const endpoint = ref('')
const fields = ref([])
const isLoading = ref(false)
const saveState = ref('idle')
const savedAt = ref(null)

// ─── RC 环境地址（多环境管理，统一来源）────────────────────────────────────
const rcEnvs        = ref([])
const newEnv        = reactive({ name: '', rcBaseUrl: '' })
const isAddingEnv   = ref(false)
const isDeletingEnv = ref(-1)

const loadRcEnvs = async () => {
    try {
        const { data } = await axios.get(`${API}/qa-config/rc-envs`)
        rcEnvs.value = data || []
    } catch { /* ignore */ }
}

const addEnv = async () => {
    if (!newEnv.name.trim() || !newEnv.rcBaseUrl.trim()) {
        ElNotification.warning({ message: '请填写名称和地址', position: 'bottom-right' })
        return
    }
    isAddingEnv.value = true
    try {
        const { data } = await axios.post(`${API}/qa-config/rc-envs`, {
            name: newEnv.name.trim(),
            rcBaseUrl: newEnv.rcBaseUrl.trim().replace(/\/+$/, '')
        })
        rcEnvs.value = data
        newEnv.name = ''
        newEnv.rcBaseUrl = ''
        ElNotification.success({ message: '地址已添加', position: 'bottom-right' })
    } catch {
        ElNotification.error({ message: '添加失败', position: 'bottom-right' })
    } finally { isAddingEnv.value = false }
}

// Uses env._id (ObjectId) instead of array index — safe for concurrent edits
const removeEnv = async (env) => {
    isDeletingEnv.value = env._id
    try {
        const { data } = await axios.delete(`${API}/qa-config/rc-envs/${env._id}`)
        rcEnvs.value = data
        ElNotification.success({ message: '地址已删除', position: 'bottom-right' })
    } catch {
        ElNotification.error({ message: '删除失败', position: 'bottom-right' })
    } finally { isDeletingEnv.value = -1 }
}

const GROUP_HINTS = {
    1: '存款（天）— 检测普通告警（上升/下降）',
    2: '存款（月）— 检测普通告警（上升/下降）',
    3: '提款（天）— 检测普通 + 连续告警（持续倍数）',
    4: '提款（月）— 检测普通 + 连续告警（持续倍数）',
    5: '24h 存提额 — 检测比值阈值 + 连续增量',
    6: '投/存比 — 检测比值阈值 + 连续增量',
    7: '投/存+惠比 — 检测比值阈值 + 连续增量',
    8: '游戏盈利(CG) — COLORGAME 普通告警与连续告警字段映射',
    9: '存提差环比 — netflow-additional-present-day，对比当前与上期存提差',
    10: '存提差同比 — netflow-additional-historical，对比日累计存提差与历史同期',
    11: '优惠同比 — reward-cumulative，今日累计优惠 ≥ 前7天/前30天平均×倍数（阈值取自注释）',
    12: '优惠环比 — reward-interval，数据来自 alertContent（\\n 分隔 8 段）；普通×B / 连续×C',
}
const currentGroupHint = computed(() => GROUP_HINTS[Number(activeTab.value)] || '')

// prettier-ignore
const typeNames = [
    { id: 1, label: '存款（天）' }, { id: 2, label: '存款（月）' },
    { id: 3, label: '提款（天）' }, { id: 4, label: '提款（月）' },
    { id: 5, label: '24h 存提' },  { id: 6, label: '投/存比' },
    { id: 7, label: '投/存+惠比' },{ id: 8, label: '游戏盈利(CG)' },
    { id: 9, label: '存提差环比' },
    { id: 10, label: '存提差同比' },
    { id: 11, label: '优惠同比' },
    { id: 12, label: '优惠环比' },
]

// 每种告警类型，「告警逻辑检查」页面的列表字段
const LIST_FIELDS = {
    1: [
        { value: 'alertId',    label: '告警单号' },
        { value: 'alertTime',  label: '告警时间' },
        { value: 'val1',       label: '存款金额' },
        { value: 'val2',       label: '近X天平均金额' },
        { value: 'normalType', label: '普通告警类型' },
        { value: 'devResult',  label: '风控系统判断' },
    ],
    2: [
        { value: 'alertId',    label: '告警单号' },
        { value: 'alertTime',  label: '告警时间' },
        { value: 'val1',       label: '存款金额' },
        { value: 'val2',       label: '近X月同天平均金额' },
        { value: 'normalType', label: '普通告警类型' },
        { value: 'devResult',  label: '风控系统判断' },
    ],
    3: [
        { value: 'alertId',    label: '告警单号' },
        { value: 'alertTime',  label: '告警时间' },
        { value: 'val1',       label: '提款金额' },
        { value: 'val2',       label: '近X天平均金额' },
        { value: 'normalType', label: '普通告警类型' },
        { value: 'contType',   label: '连续告警类型' },
        { value: 'devResult',  label: '风控系统判断' },
    ],
    4: [
        { value: 'alertId',    label: '告警单号' },
        { value: 'alertTime',  label: '告警时间' },
        { value: 'val1',       label: '提款金额' },
        { value: 'val2',       label: '近X月同天平均金额' },
        { value: 'normalType', label: '普通告警类型' },
        { value: 'contType',   label: '连续告警类型' },
        { value: 'devResult',  label: '风控系统判断' },
    ],
    5: [
        { value: 'alertId',   label: '告警单号' },
        { value: 'alertTime', label: '告警时间' },
        { value: 'val1',      label: '提款金额' },
        { value: 'val2',      label: '存款金额' },
        { value: 'devResult', label: '风控系统判断' },
    ],
    6: [
        { value: 'alertId',   label: '告警单号' },
        { value: 'alertTime', label: '告警时间' },
        { value: 'val1',      label: '投注金额' },
        { value: 'val2',      label: '存款金额*阈值' },
        { value: 'devResult', label: '风控系统判断' },
    ],
    7: [
        { value: 'alertId',   label: '告警单号' },
        { value: 'alertTime', label: '告警时间' },
        { value: 'val1',      label: '投注金额' },
        { value: 'val2',      label: '存款金额' },
        { value: 'devResult', label: '风控系统判断' },
    ],
    8: [
        { value: 'alertId',         label: '告警单号' },
        { value: 'alertTime',       label: '告警时间' },
        { value: 'currentBet',      label: '当前投注额' },
        { value: 'betMedian',       label: '投注中位数' },
        { value: 'currentRtp',      label: '当前RTP' },
        { value: 'avgRtp',          label: '30日均RTP' },
        { value: 'currentGgr',      label: '当前GGR' },
        { value: 'currentBetCount', label: '当前投注笔数' },
        { value: 'avgBetCount',     label: '平均投注笔数' },
        { value: 'devResult',       label: '风控系统判断' },
    ],
    9: [
        { value: 'alertId',              label: '告警单号' },
        { value: 'alertTime',            label: '告警时间' },
        { value: 'val1',                 label: '当前存提差金额' },
        { value: 'depositAmount',        label: '当前存款额' },
        { value: 'withdrawalAmount',     label: '当前提款额' },
        { value: 'lastNetflowAmount',    label: 'Last 存提差金额' },
        { value: 'lastDepositAmount',    label: 'Last 存款额' },
        { value: 'lastWithdrawalAmount', label: 'Last 提款额' },
        { value: 'devResult',            label: '风控系统判断' },
    ],
    10: [
        { value: 'alertId',             label: '告警单号' },
        { value: 'alertTime',           label: '告警时间' },
        { value: 'val1',                label: '存提差金额' },
        { value: 'depositAmount',       label: '存款额' },
        { value: 'withdrawalAmount',    label: '提款额' },
        { value: 'historicalYesterday', label: '昨日-存提差' },
        { value: 'historicalLastWeek',  label: '上周-存提差' },
        { value: 'historicalLastMonth', label: '上月-存提差' },
        { value: 'lowerThanYesterday',  label: '< 昨日' },
        { value: 'lowerThanLastWeek',   label: '< 上周同天' },
        { value: 'lowerThanLastMonth',  label: '< 上月同天' },
        { value: 'devResult',           label: '风控系统判断' },
    ],
    11: [
        { value: 'alertId',    label: '告警单号' },
        { value: 'alertTime',  label: '告警时间' },
        { value: 'rewardType', label: '优惠类型' },
        { value: 'todayTotal', label: '今日累计优惠' },
        { value: 'avg7',       label: '前7天平均' },
        { value: 'avg30',      label: '前30天平均' },
        { value: 'devResult',  label: '风控系统判断' },
    ],
    12: [
        { value: 'alertId',       label: '告警单号' },
        { value: 'alertTime',     label: '告警时间' },
        { value: 'rewardType',    label: '优惠类型' },
        { value: 'todayTotal',    label: '今日累计优惠' },
        { value: 'currentGrowth', label: '本时段增长' },
        { value: 'lastGrowth',    label: '上时段增长' },
        { value: 'alertSeq',      label: '今日第N个告警' },
        { value: 'devResult',     label: '风控系统判断' },
    ],
}

const currentListFields = computed(() => LIST_FIELDS[Number(activeTab.value)] || [])

// 默认字段映射（与 server.js formatSyncRecord 保持一致）
const DEFAULT_ENDPOINTS = {
    1: '/allTransactionAlerts', 2: '/allTransactionAlerts',
    3: '/allTransactionAlerts', 4: '/allTransactionAlerts',
    5: '/allBetAlerts',         6: '/allBetAlerts',
    7: '/allBetAlerts',         8: '/allGameProfitAlerts',
    9: '/allTransactionAlerts',
    10: '/allTransactionAlerts',
    11: '/rewardAlerts',
    12: '/rewardAlerts',
}

const DEFAULT_FIELDS = {
    1: [
        { listField: 'alertId',    path: 'alertNumber' },
        { listField: 'alertTime',  path: 'alertGeneratedTime' },
        { listField: 'val1',       path: 'alertMetadata.currentAmount' },
        { listField: 'val2',       path: 'alertMetadata.upperBoundary' },
        { listField: 'normalType', path: 'alertTrend' },
        { listField: 'devResult',  path: 'isAbnormal' },
    ],
    2: [
        { listField: 'alertId',    path: 'alertNumber' },
        { listField: 'alertTime',  path: 'alertGeneratedTime' },
        { listField: 'val1',       path: 'alertMetadata.currentAmount' },
        { listField: 'val2',       path: 'alertMetadata.upperBoundary' },
        { listField: 'normalType', path: 'alertTrend' },
        { listField: 'devResult',  path: 'isAbnormal' },
    ],
    3: [
        { listField: 'alertId',    path: 'alertNumber' },
        { listField: 'alertTime',  path: 'alertGeneratedTime' },
        { listField: 'val1',       path: 'alertMetadata.currentAmount' },
        { listField: 'val2',       path: 'alertMetadata.upperBoundary' },
        { listField: 'normalType', path: 'alertTrend' },
        { listField: 'contType',   path: 'continuousAlertObject.appliedContinuousFactor' },
        { listField: 'devResult',  path: 'isAbnormal' },
    ],
    4: [
        { listField: 'alertId',    path: 'alertNumber' },
        { listField: 'alertTime',  path: 'alertGeneratedTime' },
        { listField: 'val1',       path: 'alertMetadata.currentAmount' },
        { listField: 'val2',       path: 'alertMetadata.upperBoundary' },
        { listField: 'normalType', path: 'alertTrend' },
        { listField: 'contType',   path: 'continuousAlertObject.appliedContinuousFactor' },
        { listField: 'devResult',  path: 'isAbnormal' },
    ],
    5: [
        { listField: 'alertId',   path: 'alertNumber' },
        { listField: 'alertTime', path: 'alertGeneratedTime' },
        { listField: 'val1',      path: 'alertMetadata.currentAmount' },
        { listField: 'val2',      path: 'alertMetadata.upperBoundary' },
        { listField: 'devResult', path: 'isAbnormal' },
    ],
    6: [
        { listField: 'alertId',   path: 'alertNumber' },
        { listField: 'alertTime', path: 'alertGeneratedTime' },
        { listField: 'val1',      path: 'alertMetadata.currentAmount' },
        { listField: 'val2',      path: 'alertMetadata.upperBoundary' },
        { listField: 'devResult', path: 'isAbnormal' },
    ],
    7: [
        { listField: 'alertId',   path: 'alertNumber' },
        { listField: 'alertTime', path: 'alertGeneratedTime' },
        { listField: 'val1',      path: 'alertMetadata.currentAmount' },
        { listField: 'val2',      path: 'alertMetadata.upperBoundary' },
        { listField: 'devResult', path: 'isAbnormal' },
    ],
    8: [
        { listField: 'alertId',         path: 'alertNumber' },
        { listField: 'alertTime',       path: 'alertGeneratedTime' },
        { listField: 'currentBet',      path: 'alertMetadata.currentBet' },
        { listField: 'betMedian',       path: 'alertMetadata.betMedian' },
        { listField: 'currentRtp',      path: 'alertMetadata.currentRtp' },
        { listField: 'avgRtp',          path: 'alertMetadata.avgRtp' },
        { listField: 'currentGgr',      path: 'alertMetadata.currentGgr' },
        { listField: 'currentBetCount', path: 'alertMetadata.currentBetCount' },
        { listField: 'avgBetCount',     path: 'alertMetadata.avgBetCount' },
        { listField: 'devResult',       path: 'isAbnormal' },
    ],
    9: [
        { listField: 'alertId',              path: 'alertNumber' },
        { listField: 'alertTime',            path: 'alertGeneratedTime' },
        { listField: 'val1',                 path: 'currentAmount' },
        { listField: 'depositAmount',        path: 'depositAmount' },
        { listField: 'withdrawalAmount',     path: 'withdrawalAmount' },
        { listField: 'lastNetflowAmount',    path: 'lastNetflowAmount' },
        { listField: 'lastDepositAmount',    path: 'lastDepositAmount' },
        { listField: 'lastWithdrawalAmount', path: 'lastWithdrawalAmount' },
        { listField: 'devResult',            path: 'alertNumber' },
    ],
    10: [
        { listField: 'alertId',             path: 'alertNumber' },
        { listField: 'alertTime',           path: 'alertGeneratedTime' },
        { listField: 'val1',                path: 'currentAmount' },
        { listField: 'depositAmount',       path: 'depositAmount' },
        { listField: 'withdrawalAmount',    path: 'withdrawalAmount' },
        { listField: 'historicalYesterday', path: 'historicalYesterday' },
        { listField: 'historicalLastWeek',  path: 'historicalLastWeek' },
        { listField: 'historicalLastMonth', path: 'historicalLastMonth' },
        { listField: 'lowerThanYesterday',  path: 'lowerThanYesterday' },
        { listField: 'lowerThanLastWeek',   path: 'lowerThanLastWeek' },
        { listField: 'lowerThanLastMonth',  path: 'lowerThanLastMonth' },
        { listField: 'devResult',           path: 'alertNumber' },
    ],
    // ⚠️ 优惠同比(11)/环比(12) 数据塞在 /rewardAlerts 的 alertContent 字符串里（\n 分隔），
    //    由后端 formatRewardRecord 按段位解析，此处 path 仅作映射说明，不参与实际取值。
    11: [
        { listField: 'alertId',    path: 'alertId' },
        { listField: 'alertTime',  path: 'alertCreateTime' },
        { listField: 'rewardType', path: 'alertContent[0] 优惠类型' },
        { listField: 'todayTotal', path: 'alertContent[1] 今日累计优惠' },
        { listField: 'avg7',       path: 'alertContent[3] 前7天平均×倍数' },
        { listField: 'avg30',      path: 'alertContent[5] 前30天平均×倍数' },
        { listField: 'devResult',  path: '恒为 TRUE（已触发告警）' },
    ],
    12: [
        { listField: 'alertId',       path: 'alertId' },
        { listField: 'alertTime',     path: 'alertCreateTime' },
        { listField: 'rewardType',    path: 'alertContent[0] 优惠类型' },
        { listField: 'todayTotal',    path: 'alertContent[1] 今日累计优惠' },
        { listField: 'currentGrowth', path: 'alertContent[3] 本时段增长' },
        { listField: 'lastGrowth',    path: 'alertContent[6]÷[5] 原始上时段增长' },
        { listField: 'alertSeq',      path: 'RCS_QA 计算（同日同类型计数，不抓取）' },
        { listField: 'devResult',     path: '恒为 TRUE（已触发告警）' },
    ],
}

const onTypeChange = () => {
    loadConfig()
}

const loadConfig = async () => {
    // 切换类型时以编程方式重新拉取配置；本次不触发自动保存（保存仅由 @change 用户编辑触发）
    isLoading.value = true
    // 切换类型相当于重新加载干净数据，重置保存状态指示
    saveState.value = 'idle'
    let dbHasFields = false
    try {
        const res = await axios.get(`${API}/capture-config/${activeTab.value}`)
        const tid = Number(activeTab.value)
        endpoint.value = res.data.endpoint || DEFAULT_ENDPOINTS[tid] || ''
        dbHasFields = !!res.data.fields?.length
        fields.value = dbHasFields
            ? res.data.fields.map(f => ({ ...f }))
            : (DEFAULT_FIELDS[tid] || []).map(f => ({ ...f }))
    } catch {
        const tid = Number(activeTab.value)
        endpoint.value = DEFAULT_ENDPOINTS[tid] || ''
        fields.value = (DEFAULT_FIELDS[tid] || []).map(f => ({ ...f }))
    } finally {
        isLoading.value = false
    }
    // 数据库里没有该类型的配置 → 用默认模板自动落库一次。
    // 否则同步时后端找不到 captureConfig，会漏抓存款额/提款额/历史存提差等扩展字段
    // （存提差同比 typeId 10 曾因此一直「未抓到」）。
    if (!dbHasFields && fields.value.length) saveConfig()
}

onMounted(() => { loadConfig(); loadRcEnvs() })

const addField = () => {
    fields.value.push({ listField: '', path: '' })
    queueSave()
}

const removeField = (idx) => {
    ElMessageBox.confirm('确定删除此字段映射？', '删除确认', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
    }).then(() => {
        fields.value.splice(idx, 1)
        queueSave()
    }).catch(() => {})
}

const resetDefaults = () => {
    const tid = Number(activeTab.value)
    endpoint.value = DEFAULT_ENDPOINTS[tid] || ''
    fields.value = (DEFAULT_FIELDS[tid] || []).map(f => ({ ...f }))
    queueSave()
}

let _saveTimer = null
const queueSave = () => { saveState.value = 'saving'; clearTimeout(_saveTimer); _saveTimer = setTimeout(saveConfig, 700) }

const saveConfig = async () => {
    saveState.value = 'saving'
    try {
        await axios.post(`${API}/capture-config`, {
            typeId: Number(activeTab.value),
            endpoint: endpoint.value,
            fields: fields.value
        })
        saveState.value = 'idle'
        savedAt.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
        saveState.value = 'error'
    }
}
</script>

<style scoped>
.capture-page { display: flex; flex-direction: column; }

.page-header { margin-bottom: 20px; }
.page-title    { margin: 0 0 4px; font-size: 22px; color: var(--qa-heading-color); }
.page-subtitle { margin: 0; font-size: 13px; color: var(--qa-subtext-color); }

/* ── Section label (above each panel/tabs) ───────────────────────────────── */
.section-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--qa-heading-color);
    margin-bottom: 10px;
}

/* ── Config panel (same visual as tab-body but standalone) ───────────────── */
.config-panel {
    background: #fff;
    border: 1px solid #e4e7ed;
    border-radius: var(--qa-radius-md);
    padding: 20px;
}

/* ── Type selector（与 ConfigView 保持一致）────────────────────────────── */
.type-selector-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
}
.type-selector-label {
    font-size: 14px;
    color: #606266;
    white-space: nowrap;
    font-weight: 500;
}
.type-selector-hint {
    font-size: 12px;
    color: #909399;
}

/* ── Tab body (field mapping section) ───────────────────────────────────── */
.tab-body {
    border: 1px solid #e4e7ed;
    border-top: none;
    border-radius: 0 0 var(--qa-radius-md) var(--qa-radius-md);
    padding: 20px;
    background: #fff;
}

/* ── Hint (shared style) ─────────────────────────────────────────────────── */
.section-hint {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 8px 12px;
    background: var(--qa-import-info-bg);
    border-left: 3px solid #409EFF;
    font-size: 13px;
    color: #606266;
    margin-bottom: 16px;
    border-radius: 0 4px 4px 0;
    line-height: 1.6;
}
.section-hint code {
    background: #dbeeff;
    padding: 1px 5px;
    border-radius: 3px;
    font-family: monospace;
    font-size: 12px;
}

/* ── Param row (matches ConfigView and QAConfigView) ─────────────────────── */
.param-row {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 10px 0;
    border-bottom: 1px solid #f0f2f5;
}
.param-row:last-child { border-bottom: none; }
.param-row-label {
    width: 100px;
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 500;
    color: #303133;
    white-space: nowrap;
}

/* ── RC env list ─────────────────────────────────────────────────────────── */
.env-empty { font-size: 13px; color: #c0c4cc; padding: 8px 0 12px; }
.env-list  { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.env-item  {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px;
    background: #f5f7fa;
    border-radius: 6px;
    border: 1px solid #e4e7ed;
}
.env-tag  { flex-shrink: 0; }
.env-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.env-name { font-size: 13px; font-weight: 600; color: #303133; }
.env-url  { font-size: 12px; color: #909399; font-family: monospace; }
.env-add-form {
    display: flex; gap: 8px; align-items: center;
    padding-top: 12px;
    border-top: 1px solid #f0f2f5;
    margin-top: 4px;
}

/* ── Footer row: left = add/reset actions, right = edit/save/cancel ──────── */
.panel-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 14px;
    margin-top: 8px;
    border-top: 1px solid #f0f2f5;
}
.footer-left  { display: flex; gap: 8px; }
.footer-right { display: flex; gap: 8px; }
</style>
