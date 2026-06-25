<template>
    <AlertListShell
        :type-id="TYPE_ID"
        :page-title="PAGE_TITLE + '告警检查'"
        :page-subtitle="`验证 ${ALERT_TYPE} 优惠环比告警逻辑`"
        lists-api="/test-lists"
        :cache-type-id="TYPE_ID"
        :import-alert-type="ALERT_TYPE"
        :multi-config="true"
        :type-color="TYPE_COLOR"
        :new-record="newRecord"
        :get-match-count="getMatchCount"
        :get-row-class="getRowClassFn"
        :map-sync-record="mapSyncRecord"
        :map-import-row="mapImportRow"
        :get-cfg-for-list="getCfgForList"
        :get-cfg-for-row="getCfgForRowFn"
        :extra-filter="extraFilter"
    >
        <!-- 关联配置：多选 -->
        <template #config="{ list, availableConfigs, saveList }">
            <span class="setting-label">关联配置</span>
            <el-select v-model="list.configIds" size="small" style="min-width:240px;max-width:440px;"
                multiple collapse-tags collapse-tags-tooltip
                placeholder="可多选配置（各优惠类型自动匹配各自配置）" clearable @change="saveList(list, false)">
                <el-option v-for="c in availableConfigs" :key="c._id"
                    :label="c.promoName ? `${c.name}（${c.promoName}）` : c.name" :value="c._id" />
                <template v-if="availableConfigs.length === 0">
                    <el-option disabled value="" label="暂无配置，请前往「告警配置」添加" />
                </template>
            </el-select>
        </template>

        <!-- 优惠名称筛选 -->
        <template #filters="{ list }">
            <span class="filter-label">优惠名称：</span>
            <el-select
                v-model="list._rewardTypeFilter"
                size="small"
                style="width:200px;"
                placeholder="全部"
                clearable
                @change="list._currentPage = 1"
            >
                <el-option label="全部" value="" />
                <el-option v-for="t in rewardTypeOptions(list)" :key="t" :label="t" :value="t" />
            </el-select>
            <el-divider direction="vertical" />
        </template>

        <!-- 数据表格列 -->
        <template #columns="{ list, getCfgForRow }">
            <!-- 1. 告警单号 -->
            <el-table-column label="告警单号" width="160" fixed>
                <template #default="{ row }">
                    <el-input v-model="row.alertId" size="small"
                        style="font-size:12px;" placeholder="告警单号" />
                </template>
            </el-table-column>

            <!-- 2. 告警时间 -->
            <el-table-column label="告警时间" min-width="170">
                <template #default="{ row }">
                    <el-date-picker v-model="row.alertTime" type="datetime"
                        size="small" style="width:100%;"
                        format="YYYY-MM-DD HH:mm:ss"
                        value-format="YYYY-MM-DD HH:mm:ss"
                        placeholder="告警时间" />
                </template>
            </el-table-column>

            <!-- 3. 优惠名称 -->
            <el-table-column label="优惠名称" min-width="180">
                <template #default="{ row }">
                    <el-input v-model="row.rewardType" size="small"
                        style="font-size:12px;" placeholder="ALL / 活动名" />
                </template>
            </el-table-column>

            <!-- 4. 今日累计优惠 -->
            <el-table-column label="今日累计优惠" width="120">
                <template #default="{ row }">
                    <el-input-number v-model="row.todayTotal" size="small"
                        :controls="false" :formatter="amtFormat" :parser="amtParse" style="width:100%;" placeholder="未抓到" />
                </template>
            </el-table-column>

            <!-- 5. 本时段增长 -->
            <el-table-column label="本时段增长" width="120">
                <template #default="{ row }">
                    <el-input-number v-model="row.currentGrowth" size="small"
                        :controls="false" :formatter="amtFormat" :parser="amtParse" style="width:100%;" placeholder="未抓到" />
                </template>
            </el-table-column>

            <!-- 6. 上时段增长（原始，倍数由配置乘） -->
            <el-table-column label="上时段增长" width="135">
                <template #default="{ row }">
                    <el-input-number v-model="row.lastGrowth" size="small"
                        :controls="false" :formatter="amtFormat" :parser="amtParse" style="width:100%;" placeholder="未抓到" />
                </template>
            </el-table-column>

            <!-- 7. 今日第N个告警（RCS_QA 计算，只读：同日同优惠类型按时间从旧到新计数） -->
            <el-table-column width="120" align="center">
                <template #header>
                    <el-tooltip placement="top">
                        <template #content>由 RCS_QA 计算：同一天、同一优惠类型，按告警时间从旧到新排第几个（非抓取）</template>
                        <span class="tip-header">今日第N个告警&nbsp;<el-icon size="11"><InfoFilled /></el-icon></span>
                    </el-tooltip>
                </template>
                <template #default="{ row }">
                    <span>{{ calcAlertSeq(list.records.indexOf(row), list.records) ?? '—' }}</span>
                </template>
            </el-table-column>

            <!-- 8. 普通告警结果 -->
            <el-table-column width="120" align="center">
                <template #header>
                    <el-tooltip placement="top">
                        <template #content>
                            <div style="line-height:1.8;">
                                <div>本时段增长 ≥ 上时段增长 × 普通告警倍数(B) → <b>TRUE</b></div>
                                <div style="color:#bbb;margin-top:4px;font-size:12px;">缺对比阈值（如0点首段）→ 数据不足</div>
                            </div>
                        </template>
                        <span class="tip-header">普通告警结果&nbsp;<el-icon size="11"><InfoFilled /></el-icon></span>
                    </el-tooltip>
                </template>
                <template #default="{ row }">
                    <template v-if="calcNormalResult(list.records.indexOf(row), list.records, getCfgForRow(list, row)) === null">
                        <span class="field-missing">⚠ 数据不足/未抓到</span>
                    </template>
                    <el-tag v-else :type="calcNormalResult(list.records.indexOf(row), list.records, getCfgForRow(list, row)) === 'TRUE' ? 'success' : 'danger'" size="small">
                        {{ calcNormalResult(list.records.indexOf(row), list.records, getCfgForRow(list, row)) }}
                    </el-tag>
                </template>
            </el-table-column>

            <!-- 9. 连续告警结果 -->
            <el-table-column width="120" align="center">
                <template #header>
                    <el-tooltip placement="top">
                        <template #content>
                            <div style="line-height:1.8;">
                                <div>触发告警后、同周期(A 分钟)内再次<br />本时段增长 ≥ 上时段增长 × 连续告警倍数(C) → <b>TRUE</b></div>
                                <div style="color:#bbb;margin-top:4px;font-size:12px;">与同类型上一告警间隔 ≥ A 分钟（非连续）→ 显示 -</div>
                            </div>
                        </template>
                        <span class="tip-header">连续告警结果&nbsp;<el-icon size="11"><InfoFilled /></el-icon></span>
                    </el-tooltip>
                </template>
                <template #default="{ row }">
                    <span v-if="calcContResult(list.records.indexOf(row), list.records, getCfgForRow(list, row)) === '-'" style="color:var(--qa-neutral);">—</span>
                    <el-tag v-else :type="calcContResult(list.records.indexOf(row), list.records, getCfgForRow(list, row)) === 'TRUE' ? 'success' : 'danger'" size="small">
                        {{ calcContResult(list.records.indexOf(row), list.records, getCfgForRow(list, row)) }}
                    </el-tag>
                </template>
            </el-table-column>

            <!-- 10. 风控系统判断（只读，来自同步/导入的 RC 判断） -->
            <el-table-column label="风控系统判断" width="115" align="center">
                <template #default="{ row }">
                    <el-tag v-if="row.devResult"
                        :type="row.devResult === 'TRUE' ? 'success' : 'danger'"
                        size="small">
                        {{ row.devResult }}
                    </el-tag>
                    <span v-else class="field-missing">—</span>
                </template>
            </el-table-column>

            <!-- 11. 逻辑一致 -->
            <el-table-column label="逻辑一致" width="90" align="center">
                <template #default="{ row }">
                    <el-tag v-if="row.ignored" type="info" size="small">—</el-tag>
                    <template v-else-if="row.devResult">
                        <el-tag v-if="calcLogicMatch(list.records.indexOf(row), list.records, getCfgForRow(list, row))" type="success" size="small">✓ 一致</el-tag>
                        <el-tag v-else type="danger" size="small">✗ 异常</el-tag>
                    </template>
                    <el-tag v-else type="info" size="small">待判断</el-tag>
                </template>
            </el-table-column>
        </template>
    </AlertListShell>
</template>

<script setup>
import { InfoFilled } from '@element-plus/icons-vue'
import AlertListShell from '../components/AlertListShell.vue'
import { amtFormat, amtParse } from '../logic/format.js'
import { PAGE_TITLES } from '../logic/alertTypes.js'
import {
    calcNormalResult, calcContResult, calcLogicMatch, calcAlertSeq,
    getRowClass, getMatchCount as momGetMatchCount, getContResultColor
} from '../logic/promoMomLogic.js'

const TYPE_ID = 12
const PAGE_TITLE = PAGE_TITLES[TYPE_ID]
const ALERT_TYPE = 'reward-interval'
const TYPE_COLOR = '#c41d7f'

const toNum = v => (v === null || v === undefined || v === '') ? null : Number(v)

// ── 配置匹配（与原页面一致；configs 由 shell 注入）─────────────────────────────
// 列表关联的配置集合（支持多选 configIds；兼容旧的单值 configId）
const listCfgs = (list, configs) => {
    const ids = (list.configIds && list.configIds.length) ? list.configIds : (list.configId ? [list.configId] : [])
    return ids.map(id => (configs || []).find(c => c._id === id)).filter(Boolean)
}
// 配置的「优惠类型」支持多个名称（逗号分隔）：行的优惠类型命中其中任一即用该配置（大小写不敏感）。
const cfgPromoNames = c => String(c?.promoName ?? '').split(/[,，]/).map(s => s.trim()).filter(Boolean)

const getCfgForList = (list, configs) => listCfgs(list, configs)[0] || null
const getCfgForRowFn = (list, row, configs) => {
    const name = String(row?.rewardType ?? '').trim().toLowerCase()
    const cfgs = listCfgs(list, configs)
    if (name) {
        const byName = cfgs.find(c => cfgPromoNames(c).some(n => n.toLowerCase() === name))
        if (byName) return byName
    }
    return cfgs[0] || null
}

// ── 注入 shell 的纯逻辑（configs 由 shell 注入）─────────────────────────────────
const getMatchCount = (list, configs) => momGetMatchCount(list.records, row => getCfgForRowFn(list, row, configs))
const getRowClassFn = (row, absIdx, list, configs) => getRowClass(absIdx, list.records, getCfgForRowFn(list, row, configs))

const newRecord = () => ({
    alertId: '', alertTime: '', rewardType: '',
    todayTotal: 0, currentGrowth: 0, lastGrowth: 0,
    devResult: '', ignored: false,
})

// 同步映射（与原 useSyncManager mapRecord 行为一致）
const mapSyncRecord = (item) => ({
    alertId:       String(item.alertId  || ''),
    alertTime:     String(item.alertTime || ''),
    rewardType:    String(item.rewardType ?? '') || '',
    todayTotal:    toNum(item.todayTotal),
    currentGrowth: toNum(item.currentGrowth),
    lastGrowth:    toNum(item.lastGrowth),
    // alertSeq（今日第N个告警）由 RCS_QA 计算，不再抓取/存储
    devResult:     item.devResult || '',
    ignored:       false,
})

// Excel 导入映射（与原 handleImport 字段一致）
const mapImportRow = (r) => ({
    alertId:       String(r.alertNumber || r.alertId || ''),
    alertTime:     String(r.alertGeneratedTime || r.alertTime || ''),
    rewardType:    String(r.rewardType ?? r['meta.rewardType'] ?? '') || '',
    todayTotal:    toNum(r.todayTotal    ?? r['meta.todayTotal']),
    currentGrowth: toNum(r.currentGrowth ?? r['meta.currentGrowth']),
    lastGrowth:    toNum(r.lastGrowth    ?? r['meta.lastGrowth']),
    devResult:     String(r.alertNumber || '').trim() ? 'TRUE' : '',
    ignored:       false,
})

// 优惠名称筛选选项
const rewardTypeOptions = (list) => {
    const set = new Set()
    list.records.forEach(r => { if (r.rewardType) set.add(r.rewardType) })
    return [...set]
}

// 优惠名称展示过滤（仅过滤展示行，逻辑仍按完整 records 绝对索引计算）
const extraFilter = (list, record) =>
    !list._rewardTypeFilter || record.rewardType === list._rewardTypeFilter
</script>
