<template>
    <AlertListShell
        :type-id="TYPE_ID"
        :configs-type-id="8"
        page-title="游戏盈利(CG)告警检查"
        page-subtitle="验证 allGameProfitAlerts（game-profit）COLORGAME 的普通告警与连续告警逻辑"
        lists-api="/game-profit-lists"
        import-alert-type="game-profit"
        :multi-config="false"
        :type-color="TYPE_COLOR"
        :list-defaults="{ ignoreC2: false }"
        :new-record="newRecord"
        :get-match-count="getMatchCount"
        :get-row-class="getRowClassFn"
        :map-sync-record="mapSyncRecord"
        :map-import-row="mapImportRow"
        :get-cfg-for-list="getCfgForList"
        :get-cfg-for-row="getCfgForRowFn"
        :record-preprocess="applyLastGgr"
        :get-cache-url="getCacheUrl"
        :sync-filter-records="syncFilterRecords"
        :load-lists-request="loadListsRequest"
        :save-request="saveRequest"
        :create-request="createRequest"
        :delete-request="deleteRequest"
    >
        <!-- 关联配置（单选）-->
        <template #config="{ list, availableConfigs, saveList, getCfg }">
            <span class="setting-label">关联配置</span>
            <el-select
                v-model="list.configId"
                size="small"
                style="width:180px;"
                placeholder="请选择配置"
                clearable
                @change="saveList(list, false)"
            >
                <el-option v-for="c in availableConfigs" :key="c._id" :label="c.name" :value="c._id" />
                <template v-if="availableConfigs.length === 0">
                    <el-option disabled value="" label="暂无配置，请前往「告警配置」添加" />
                </template>
            </el-select>
            <el-popover v-if="getCfg(list)" placement="bottom-start" trigger="hover" :width="260">
                <template #reference>
                    <el-icon size="14" color="#409EFF" style="cursor:help;margin-left:4px;vertical-align:middle;"><InfoFilled /></el-icon>
                </template>
                <div style="font-size:13px;line-height:2;">
                    <div><b>告警阈值 X：</b>{{ getX(getCfg(list)) }}</div>
                    <div><b>连续告警阈值 Y：</b>{{ getY(getCfg(list)) }}%</div>
                    <div><b>检查间隔：</b>{{ getAlertInterval(getCfg(list)) }} 分钟</div>
                </div>
            </el-popover>
        </template>

        <!-- 数据表格列 -->
        <template #columns="{ list, getCfg }">
            <el-table-column label="告警单号" min-width="155">
                <template #default="{ row }">
                    <el-input v-model="row.alertId" size="small" />
                </template>
            </el-table-column>

            <el-table-column label="告警时间" min-width="185">
                <template #default="{ row }">
                    <el-date-picker v-model="row.alertTime" type="datetime"
                        format="YYYY-MM-DD HH:mm:ss" value-format="YYYY-MM-DD HH:mm:ss"
                        size="small" style="width:100%" />
                </template>
            </el-table-column>

            <el-table-column label="当前投注" min-width="115">
                <template #default="{ row }">
                    <el-input-number v-model="row.currentBet" :controls="false" :formatter="amtFormat" :parser="amtParse" size="small" style="width:100%" />
                </template>
            </el-table-column>

            <el-table-column label="投注中位数" min-width="115">
                <template #default="{ row }">
                    <el-input-number v-model="row.betMedian" :controls="false" :formatter="amtFormat" :parser="amtParse" size="small" style="width:100%" />
                </template>
            </el-table-column>

            <el-table-column label="当前RTP%" min-width="110">
                <template #default="{ row }">
                    <el-input-number v-model="row.currentRtp" :controls="false" :precision="2" size="small" style="width:100%" />
                </template>
            </el-table-column>

            <el-table-column label="30日均RTP%" min-width="115">
                <template #default="{ row }">
                    <el-input-number v-model="row.avgRtp" :controls="false" :precision="2" size="small" style="width:100%" />
                </template>
            </el-table-column>

            <el-table-column label="偏差" min-width="110">
                <template #default="{ row }">
                    <el-input-number v-model="row.rtpDeviation" :controls="false" :precision="2" size="small" style="width:100%" />
                </template>
            </el-table-column>

            <el-table-column label="当前GGR" min-width="130">
                <template #default="{ row }">
                    <el-input-number v-model="row.currentGgr" :controls="false" :formatter="amtFormat" :parser="amtParse" size="small" style="width:100%" />
                </template>
            </el-table-column>

            <el-table-column label="上次GGR" min-width="130">
                <template #default="{ row }">
                    <el-input-number v-model="row.lastGgr" :controls="false" :formatter="amtFormat" :parser="amtParse" size="small" style="width:100%" />
                </template>
            </el-table-column>

            <el-table-column label="投注笔数" min-width="115">
                <template #default="{ row }">
                    <el-input-number v-model="row.currentBetCount" :controls="false" :formatter="amtFormat" :parser="amtParse" size="small" style="width:100%" />
                </template>
            </el-table-column>

            <el-table-column label="平均投注笔数" min-width="120">
                <template #default="{ row }">
                    <el-input-number v-model="row.avgBetCount" :controls="false" :formatter="amtFormat" :parser="amtParse" size="small" style="width:100%" />
                </template>
            </el-table-column>

            <!-- 普通告警结果 -->
            <el-table-column width="115" align="center">
                <template #header>
                    <el-tooltip placement="top">
                        <template #content>
                            <div style="line-height:1.8;">
                                普通告警结果 = C1 AND C2<br />
                                C1：当前RTP − 30日均RTP &lt; {{ getX(getCfg(list)) }}（告警阈值X）<br />
                                C2：Current Bet ≥ Bet Median
                            </div>
                        </template>
                        <span class="tip-header">普通告警结果&nbsp;<el-icon size="11"><InfoFilled /></el-icon></span>
                    </el-tooltip>
                </template>
                <template #default="{ row }">
                    <el-tag :type="calcNormalW(row, getCfg(list), list) === 'TRUE' ? 'success' : 'danger'" size="small">
                        {{ calcNormalW(row, getCfg(list), list) }}
                    </el-tag>
                </template>
            </el-table-column>

            <!-- 连续告警结果 -->
            <el-table-column width="115" align="center">
                <template #header>
                    <el-tooltip placement="top">
                        <template #content>
                            <div style="line-height:1.8;">
                                连续告警结果 = C1 AND C2 AND C3<br />
                                C3：Last GGR − Current GGR ≥ |Last GGR| × {{ getY(getCfg(list)) }}%（连续阈值Y）<br />
                                <span style="color:#bbb;font-size:12px;">时间差 ≥ {{ getAlertInterval(getCfg(list)) }} 分钟 → 不检查连续告警，显示 -</span>
                            </div>
                        </template>
                        <span class="tip-header">连续告警结果&nbsp;<el-icon size="11"><InfoFilled /></el-icon></span>
                    </el-tooltip>
                </template>
                <template #default="{ row }">
                    <span v-if="calcContW(row, getCfg(list), list) === '-'" style="color:var(--qa-neutral);">—</span>
                    <el-tag v-else :type="calcContW(row, getCfg(list), list) === 'TRUE' ? 'success' : 'danger'" size="small">
                        {{ calcContW(row, getCfg(list), list) }}
                    </el-tag>
                </template>
            </el-table-column>

            <!-- 风控系统判断 -->
            <el-table-column width="115" align="center">
                <template #header>风控系统判断</template>
                <template #default="{ row }">
                    <span v-if="!row.devResult" style="color:#c0c4cc;">—</span>
                    <el-tag v-else :type="['TRUE','normal','continuous'].includes(row.devResult) ? 'success' : 'danger'" size="small">
                        {{ ['normal','continuous'].includes(row.devResult) ? 'TRUE' : row.devResult }}
                    </el-tag>
                </template>
            </el-table-column>

            <!-- 逻辑一致 -->
            <el-table-column width="72" align="center">
                <template #header>逻辑一致</template>
                <template #default="{ row }">
                    <el-tag v-if="row.ignored" type="info" size="small">—</el-tag>
                    <template v-else-if="row.devResult">
                        <el-tag v-if="isMatchW(row, getCfg(list), list)" type="success" size="small">✓ 一致</el-tag>
                        <el-tag v-else type="danger" size="small">✗ 异常</el-tag>
                    </template>
                    <el-tag v-else type="info" size="small">待判断</el-tag>
                </template>
            </el-table-column>
        </template>
    </AlertListShell>
</template>

<script setup>
import axios from 'axios'
import { InfoFilled } from '@element-plus/icons-vue'
import AlertListShell from '../components/AlertListShell.vue'
import { amtFormat, amtParse } from '../logic/format.js'
import { useAppStore } from '../stores/appStore.js'
import {
    getX, getY, getAlertInterval, calcNormal, calcCont, isMatch,
    getMatchCount as _getMatchCount, getRowClass as _getRowClass, applyLastGgr
} from '../logic/gameProfitLogic.js'

const API = 'http://localhost:3000/api'
const appStore = useAppStore()
const TYPE_ID = 8           // configs typeId (also passed via configs-type-id)
const TYPE_COLOR = '#1677ff'

// ── cfg 解析（单选 configId；configs 由 shell 注入）────────────────────────────
const getCfgForList = (list, configs) => (configs || []).find(c => c._id === list.configId) || null
// 单配置：每行用同一关联配置
const getCfgForRowFn = (list, row, configs) => getCfgForList(list, configs)

// ── 告警逻辑计算（cfg 已在 #columns 内通过 getCfg 解析）────────────────────────
const calcNormalW = (row, cfg, list) => calcNormal(row, getX(cfg), list.ignoreC2)
const calcContW   = (row, cfg, list) => calcCont(row, getX(cfg), getY(cfg), getAlertInterval(cfg), list.ignoreC2)
const isMatchW    = (row, cfg, list) => isMatch(row, getX(cfg), list.ignoreC2)

// ── 注入 shell 的纯逻辑（configs 由 shell 注入）────────────────────────────────
const getMatchCount = (list, configs) => _getMatchCount(list.records, getX(getCfgForList(list, configs)), list.ignoreC2)
const getRowClassFn = (row, absIdx, list, configs) => _getRowClass(row, getX(getCfgForList(list, configs)), list.ignoreC2)

const newRecord = () => ({
    alertId: '', alertTime: '',
    currentBet: 0, betMedian: 0,
    currentRtp: 0, avgRtp: 0, rtpDeviation: 0,
    currentGgr: 0, lastGgr: 0, prevAlertTime: '',
    currentBetCount: 0, avgBetCount: 0,
    devResult: '', ignored: false,
})

// ── 缓存 URL（游戏盈利专属端点）────────────────────────────────────────────────
const getCacheUrl = (list) =>
    list.rcBaseUrl ? `${API}/game-profit-cache?url=${encodeURIComponent(list.rcBaseUrl)}` : `${API}/game-profit-cache`

// ── 同步原始数据过滤：alertType=game-profit 且 target=COLORGAME，再按抓取时间范围 ──
const syncFilterRecords = (allRaw, list) => {
    let fetched = (allRaw || [])
        .filter(item => (item.alertType || '').toLowerCase().replace(/_/g, '-') === 'game-profit')
        .filter(item => (item.target || '').toUpperCase() === 'COLORGAME')
    // 与原页面一致：全局质检配置时间范围优先，其次列表级；起/止可留空 = 该端不限制
    const sTime = appStore.qaConfig?.syncStartTime || list?.syncStartTime
    const eTime = appStore.qaConfig?.syncEndTime   || list?.syncEndTime
    if (sTime || eTime) {
        const sMs = sTime ? new Date(sTime).getTime() : -Infinity
        const eMs = eTime ? new Date(eTime).getTime() :  Infinity
        fetched = fetched.filter(item => {
            const t = new Date(item.alertGeneratedTime).getTime()
            return !isNaN(t) && t >= sMs && t <= eMs
        })
    }
    return fetched
}

// ── 同步映射（meta 字段，lastGgr 由 applyLastGgr 重算）──────────────────────────
const mapSyncRecord = (item) => {
    const meta = item.alertMetadata || {}
    const num  = k => meta[k] ?? item[k] ?? 0
    return {
        alertId:         String(item.alertNumber || ''),
        alertTime:       String(item.alertGeneratedTime || ''),
        currentBet:      num('currentBet'),
        betMedian:       num('betMedian'),
        currentRtp:      num('currentRtp'),
        avgRtp:          num('avgRtp'),
        rtpDeviation:    num('rtpDeviation'),
        currentGgr:      num('currentGgr'),
        lastGgr:         0,
        currentBetCount: num('currentBetCount'),
        avgBetCount:     num('avgBetCount'),
        devResult:       item.alertNumber ? 'TRUE' : '',
        ignored:         false,
    }
}

// ── Excel 导入映射（与原 handleImport 一致）─────────────────────────────────────
const mapImportRow = (r) => {
    const num = k => { const v = r[`meta.${k}`] ?? r[k] ?? ''; return v === '' ? 0 : Number(v) }
    return {
        alertId:         String(r['alertNumber'] || r['alertId'] || ''),
        alertTime:       String(r['alertGeneratedTime'] || r['alertTime'] || ''),
        currentBet:      num('currentBet'),
        betMedian:       num('betMedian'),
        currentRtp:      num('currentRtp'),
        avgRtp:          num('avgRtp'),
        rtpDeviation:    num('rtpDeviation'),
        currentGgr:      num('currentGgr'),
        lastGgr:         0,
        currentBetCount: num('currentBetCount'),
        avgBetCount:     num('avgBetCount'),
        devResult:       (r['alertNumber'] || r['alertId']) ? 'TRUE' : '',
        ignored:         false,
    }
}

// ── 持久化（游戏盈利专属端点 / 字段裁剪）────────────────────────────────────────
const loadListsRequest = async () => {
    const { data } = await axios.get(`${API}/game-profit-lists`)
    // 重新推导 lastGgr / prevAlertTime（兼容旧数据）
    data.forEach(l => { if (l.records?.length) applyLastGgr(l.records) })
    return data
}

const saveRequest = async (list) => {
    await axios.put(`${API}/game-profit-lists/${list._id}`, {
        listName: list.listName,
        rcBaseUrl: list.rcBaseUrl,
        configId: list.configId || null,
        ignoreC2: list.ignoreC2 ?? false,
        syncStartTime: list.syncStartTime || null,
        syncEndTime: list.syncEndTime || null,
        records: list.records.map(r => ({
            alertId: r.alertId, alertTime: r.alertTime,
            currentBet: r.currentBet, betMedian: r.betMedian,
            currentRtp: r.currentRtp, avgRtp: r.avgRtp,
            rtpDeviation: r.rtpDeviation,
            currentGgr: r.currentGgr, lastGgr: r.lastGgr,
            prevAlertTime: r.prevAlertTime || '',
            currentBetCount: r.currentBetCount, avgBetCount: r.avgBetCount,
            devResult: r.devResult, ignored: r.ignored,
        })),
    })
}

const createRequest = async (listName) => {
    const { data } = await axios.post(`${API}/game-profit-lists`, { listName: listName.trim(), rcBaseUrl: '', records: [] })
    return data
}

const deleteRequest = (id) => axios.delete(`${API}/game-profit-lists/${id}`)
</script>
