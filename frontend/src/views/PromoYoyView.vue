<template>
    <AlertListShell
        :type-id="TYPE_ID"
        :page-title="PAGE_TITLE"
        page-subtitle="校验优惠金额与前 7 天 / 前 30 天均值的同比告警逻辑"
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
        <template #config="{ list, availableConfigs, saveList, getCfg }">
            <span class="setting-label">关联配置</span>
            <el-select v-model="list.configIds" multiple collapse-tags collapse-tags-tooltip clearable
                placeholder="可多选配置（各优惠类型自动匹配各自配置）" style="min-width:240px;max-width:440px" size="small"
                @change="saveList(list, false)">
                <el-option v-for="c in availableConfigs" :key="c._id"
                    :label="c.promoName ? `${c.name}（${c.promoName}）` : c.name" :value="c._id" />
            </el-select>
            <el-popover v-if="getCfg(list)" placement="bottom-start" trigger="hover" :width="260">
                <template #reference>
                    <el-icon size="14" color="#409EFF" style="cursor:help;margin-left:2px;vertical-align:middle;"><InfoFilled /></el-icon>
                </template>
                <div style="font-size:13px;line-height:2;">
                    <div><b>普通告警：</b>≥前7天均×{{ getCfg(list).mult7 }}、≥前30天均×{{ getCfg(list).mult30 }}</div>
                    <div><b>连续告警：</b>≥前7天均×{{ getCfg(list).mult7Cont }}、≥前30天均×{{ getCfg(list).mult30Cont }}</div>
                    <div><b>连续间隔：</b>{{ getCfg(list).alertInterval }} 分钟</div>
                    <div style="color:#909399;font-size:12px;">每个优惠类型按「优惠类型」匹配各自配置</div>
                </div>
            </el-popover>
        </template>

        <!-- 优惠类型筛选 -->
        <template #filters="{ list }">
            <span class="filter-label">优惠类型：</span>
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
            <el-table-column label="告警单号" min-width="120">
                <template #default="scope">
                    <el-input v-model="scope.row.alertId" size="small" />
                </template>
            </el-table-column>

            <!-- 2. 告警时间 -->
            <el-table-column label="告警时间" min-width="160">
                <template #default="scope">
                    <el-date-picker v-model="scope.row.alertTime" type="datetime"
                        format="YYYY-MM-DD HH:mm:ss" value-format="YYYY-MM-DD HH:mm:ss"
                        size="small" style="width: 100%" />
                </template>
            </el-table-column>

            <!-- 3. 优惠类型 -->
            <el-table-column label="优惠类型" min-width="180">
                <template #default="scope">
                    <el-input v-model="scope.row.rewardType" size="small" placeholder="ALL / 活动名" />
                </template>
            </el-table-column>

            <!-- 4. 今日累计优惠 -->
            <el-table-column label="今日累计优惠" min-width="120">
                <template #default="scope">
                    <el-input-number v-model="scope.row.todayTotal" :controls="false" :formatter="amtFormat" :parser="amtParse" size="small" style="width:100%" placeholder="未抓到" />
                </template>
            </el-table-column>

            <!-- 5. 前7天平均 -->
            <el-table-column label="前7天平均" min-width="130">
                <template #default="scope">
                    <el-input-number v-model="scope.row.avg7" :controls="false" :formatter="amtFormat" :parser="amtParse" size="small" style="width:100%" placeholder="未抓到" />
                </template>
            </el-table-column>

            <!-- 6. 前30天平均 -->
            <el-table-column label="前30天平均" min-width="130">
                <template #default="scope">
                    <el-input-number v-model="scope.row.avg30" :controls="false" :formatter="amtFormat" :parser="amtParse" size="small" style="width:100%" placeholder="未抓到" />
                </template>
            </el-table-column>

            <!-- 7. 普通告警结果 -->
            <el-table-column width="130" align="center">
                <template #header>
                    <el-tooltip placement="top">
                        <template #content>
                            <div style="line-height:1.8;">
                                <div>每日只触发一次：当日该优惠类型已有更早告警 → <b style="color:#F56C6C;">FALSE</b></div>
                                <div style="margin-top:4px;">条件2：今日累计 ≥ 前7天平均×普通倍数 且 ≥ 前30天平均×普通倍数 → <b>TRUE</b></div>
                                <div style="margin-top:4px;">两个对比值都缺 → 数据不足，不对比</div>
                            </div>
                        </template>
                        <span class="tip-header">普通告警结果&nbsp;<el-icon size="11"><InfoFilled /></el-icon></span>
                    </el-tooltip>
                </template>
                <template #default="scope">
                    <template v-if="calcNormalResult(list.records.indexOf(scope.row), list.records, getCfgForRow(list, scope.row)) === null">
                        <span class="field-missing">⚠ 数据不足/未抓到</span>
                    </template>
                    <el-tag v-else :type="calcNormalResult(list.records.indexOf(scope.row), list.records, getCfgForRow(list, scope.row)) === 'TRUE' ? 'success' : 'danger'" size="small">
                        {{ calcNormalResult(list.records.indexOf(scope.row), list.records, getCfgForRow(list, scope.row)) }}
                    </el-tag>
                </template>
            </el-table-column>

            <!-- 8. 连续告警结果 -->
            <el-table-column width="130" align="center">
                <template #header>
                    <el-tooltip placement="top">
                        <template #content>
                            <div style="line-height:1.8;">
                                <div>触发普通告警后、间隔 ≥ N 分钟再查，恶化到<br />今日累计 ≥ 前7天平均×连续倍数 且 ≥ 前30天平均×连续倍数 → <b>TRUE</b></div>
                                <div style="color:#bbb;margin-top:4px;font-size:12px;">当日该优惠类型首条（无更早告警）→ 显示 -</div>
                            </div>
                        </template>
                        <span class="tip-header">连续告警结果&nbsp;<el-icon size="11"><InfoFilled /></el-icon></span>
                    </el-tooltip>
                </template>
                <template #default="scope">
                    <span v-if="calcContResult(list.records.indexOf(scope.row), list.records, getCfgForRow(list, scope.row)) === '-'" style="color:var(--qa-neutral);">—</span>
                    <el-tag v-else :type="calcContResult(list.records.indexOf(scope.row), list.records, getCfgForRow(list, scope.row)) === 'TRUE' ? 'success' : 'danger'" size="small">
                        {{ calcContResult(list.records.indexOf(scope.row), list.records, getCfgForRow(list, scope.row)) }}
                    </el-tag>
                </template>
            </el-table-column>

            <!-- 9. 风控系统判断（只读，来自同步/导入的 RC 判断） -->
            <el-table-column label="风控系统判断" width="115" align="center">
                <template #default="scope">
                    <el-tag v-if="scope.row.devResult"
                        :type="scope.row.devResult === 'TRUE' ? 'success' : 'danger'"
                        size="small">
                        {{ scope.row.devResult }}
                    </el-tag>
                    <span v-else class="field-missing">—</span>
                </template>
            </el-table-column>

            <!-- 10. 逻辑一致 -->
            <el-table-column label="逻辑一致" width="90" align="center">
                <template #default="scope">
                    <el-tag v-if="scope.row.ignored" type="info" size="small">—</el-tag>
                    <template v-else-if="scope.row.devResult">
                        <el-tag v-if="calcLogicMatch(list.records.indexOf(scope.row), list.records, getCfgForRow(list, scope.row))" type="success" size="small">✓ 一致</el-tag>
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
    calcNormalResult,
    calcContResult,
    calcLogicMatch,
    getMatchCount as yoyGetMatchCount,
    getRowClass as yoyGetRowClass,
    getContResultColor,
} from '../logic/promoYoyLogic.js'

const TYPE_ID = 11
const PAGE_TITLE = PAGE_TITLES[TYPE_ID]
const ALERT_TYPE = 'reward-cumulative'
const TYPE_COLOR = '#389e0d'

const toNum = (v) => (v === null || v === undefined || v === '') ? null : Number(v)

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
const getMatchCount = (list, configs) => yoyGetMatchCount(list.records, row => getCfgForRowFn(list, row, configs))
const getRowClassFn = (row, absIdx, list, configs) => yoyGetRowClass(absIdx, list.records, getCfgForRowFn(list, row, configs))

const newRecord = () => ({
    alertId: '', alertTime: '', rewardType: '',
    todayTotal: 0, avg7: 0, avg30: 0,
    devResult: '', ignored: false,
})

// 同步映射（与原页面 mapRewardRows 行为一致）
const mapSyncRecord = (item) => ({
    alertId:    String(item.alertId  || ''),
    alertTime:  String(item.alertTime || ''),
    rewardType: String(item.rewardType ?? '') || '',
    todayTotal: toNum(item.todayTotal),
    avg7:       toNum(item.avg7),
    avg30:      toNum(item.avg30),
    devResult:  item.devResult || '',
    ignored:    false,
})

// Excel 导入映射（自校验：阈值取自记录）
const mapImportRow = (r) => ({
    alertId:    r.alertNumber        || '',
    alertTime:  r.alertGeneratedTime || '',
    rewardType: String(r.rewardType ?? r['meta.rewardType'] ?? '') || '',
    todayTotal: toNum(r.todayTotal  ?? r['meta.todayTotal']),
    avg7:       toNum(r.avg7  ?? r['meta.avg7']),
    avg30:      toNum(r.avg30 ?? r['meta.avg30']),
    devResult:  String(r.alertNumber || '').trim() ? 'TRUE' : '',
    ignored:    false,
})

// 优惠类型筛选选项
const rewardTypeOptions = (list) => {
    const set = new Set()
    list.records.forEach(r => { if (r.rewardType) set.add(r.rewardType) })
    return [...set]
}

// 优惠类型展示过滤（仅过滤展示行，逻辑仍按完整 records 绝对索引计算）
const extraFilter = (list, record) =>
    !list._rewardTypeFilter || record.rewardType === list._rewardTypeFilter
</script>
