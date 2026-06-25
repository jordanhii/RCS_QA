<template>
    <AlertListShell
        :type-id="TYPE_ID"
        page-title="存提差同比"
        page-subtitle="校验当日累计存提差与历史同期（昨日 / 上周 / 上月）的告警逻辑"
        lists-api="/test-lists"
        :cache-type-id="TYPE_ID"
        import-alert-type="netflow-additional-historical"
        :multi-config="false"
        :type-color="TYPE_COLOR"
        :new-record="newRecord"
        :get-match-count="getMatchCount"
        :get-row-class="getRowClassFn"
        :map-sync-record="mapSyncRecord"
        :map-import-row="mapImportRow"
        :get-cfg-for-list="getCfgForList"
        :get-cfg-for-row="getCfgForRowFn"
    >
        <!-- 关联配置（单选） -->
        <template #config="{ list, availableConfigs, saveList, getCfg }">
            <span class="setting-label">关联配置</span>
            <el-select v-model="list.configId" placeholder="选择配置" style="width: 220px" size="small"
                @change="saveList(list, false)">
                <el-option v-for="c in availableConfigs" :key="c._id" :label="c.name" :value="c._id" />
            </el-select>
            <el-popover v-if="getCfg(list)" placement="bottom-start" trigger="hover" :width="220">
                <template #reference>
                    <el-icon size="14" color="#409EFF" style="cursor:help;margin-left:4px;vertical-align:middle;"><InfoFilled /></el-icon>
                </template>
                <div style="font-size:13px;line-height:2;">
                    <div><b>提款阈值 X：</b>{{ getCfg(list).xThreshold }}</div>
                    <div><b>检查间隔：</b>{{ getCfg(list).alertInterval }} 分钟</div>
                </div>
            </el-popover>
        </template>

        <!-- 数据表格列 -->
        <template #columns="{ list, getCfg }">
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

            <!-- 3. 存提差金额 -->
            <el-table-column label="存提差金额" min-width="120">
                <template #default="scope">
                    <el-input-number v-model="scope.row.val1" :controls="false" :formatter="amtFormat" :parser="amtParse" size="small" style="width:100%" placeholder="未抓到" />
                </template>
            </el-table-column>

            <!-- 4. 存款额 -->
            <el-table-column label="存款额" min-width="100">
                <template #default="scope">
                    <el-input-number v-model="scope.row.depositAmount" :controls="false" :formatter="amtFormat" :parser="amtParse" size="small" style="width:100%" placeholder="未抓到" />
                </template>
            </el-table-column>

            <!-- 5. 提款额 -->
            <el-table-column label="提款额" min-width="100">
                <template #default="scope">
                    <el-input-number v-model="scope.row.withdrawalAmount" :controls="false" :formatter="amtFormat" :parser="amtParse" size="small" style="width:100%" placeholder="未抓到" />
                </template>
            </el-table-column>

            <!-- 6. 昨日-存提差 -->
            <el-table-column label="昨日-存提差" min-width="120">
                <template #default="scope">
                    <el-input-number v-model="scope.row.historicalYesterday" :controls="false" :formatter="amtFormat" :parser="amtParse" size="small" style="width:100%" placeholder="未抓到" />
                </template>
            </el-table-column>

            <!-- 7. 上周-存提差 -->
            <el-table-column label="上周-存提差" min-width="120">
                <template #default="scope">
                    <el-input-number v-model="scope.row.historicalLastWeek" :controls="false" :formatter="amtFormat" :parser="amtParse" size="small" style="width:100%" placeholder="未抓到" />
                </template>
            </el-table-column>

            <!-- 8. 上月-存提差 -->
            <el-table-column label="上月-存提差" min-width="120">
                <template #default="scope">
                    <el-input-number v-model="scope.row.historicalLastMonth" :controls="false" :formatter="amtFormat" :parser="amtParse" size="small" style="width:100%" placeholder="未抓到" />
                </template>
            </el-table-column>

            <!-- ── RC 系统判断 组 ────────────────────────────── -->
            <el-table-column label="RC 系统判断" align="center">
                <el-table-column label="< 昨日" min-width="80" align="center">
                    <template #default="scope">
                        <span v-if="scope.row.lowerThanYesterday === null" class="field-missing">⚠</span>
                        <el-tag v-else :type="scope.row.lowerThanYesterday?.toLowerCase() === 'true' ? 'success' : 'danger'" size="small">
                            {{ scope.row.lowerThanYesterday?.toLowerCase() === 'true' ? 'TRUE' : 'FALSE' }}
                        </el-tag>
                    </template>
                </el-table-column>

                <el-table-column label="< 上周同天" min-width="90" align="center">
                    <template #default="scope">
                        <span v-if="scope.row.lowerThanLastWeek === null" class="field-missing">⚠</span>
                        <el-tag v-else :type="scope.row.lowerThanLastWeek?.toLowerCase() === 'true' ? 'success' : 'danger'" size="small">
                            {{ scope.row.lowerThanLastWeek?.toLowerCase() === 'true' ? 'TRUE' : 'FALSE' }}
                        </el-tag>
                    </template>
                </el-table-column>

                <el-table-column label="< 上月同天" min-width="90" align="center">
                    <template #default="scope">
                        <span v-if="scope.row.lowerThanLastMonth === null" class="field-missing">⚠</span>
                        <el-tag v-else :type="scope.row.lowerThanLastMonth?.toLowerCase() === 'true' ? 'success' : 'danger'" size="small">
                            {{ scope.row.lowerThanLastMonth?.toLowerCase() === 'true' ? 'TRUE' : 'FALSE' }}
                        </el-tag>
                    </template>
                </el-table-column>
            </el-table-column>

            <!-- ── RCSQA 自算 组 ──── -->
            <el-table-column label="RCSQA 自算" align="center">
                <el-table-column label="< 昨日" min-width="90" align="center">
                    <template #default="scope">
                        <template v-if="calcLowerThan(scope.row.val1, scope.row.historicalYesterday) === null">
                            <span class="field-missing">—</span>
                        </template>
                        <el-tag v-else :type="calcLowerThan(scope.row.val1, scope.row.historicalYesterday) === 'TRUE' ? 'success' : 'danger'" size="small">
                            {{ calcLowerThan(scope.row.val1, scope.row.historicalYesterday) }}
                        </el-tag>
                    </template>
                </el-table-column>

                <el-table-column label="< 上周同天" min-width="100" align="center">
                    <template #default="scope">
                        <template v-if="calcLowerThan(scope.row.val1, scope.row.historicalLastWeek) === null">
                            <span class="field-missing">—</span>
                        </template>
                        <el-tag v-else :type="calcLowerThan(scope.row.val1, scope.row.historicalLastWeek) === 'TRUE' ? 'success' : 'danger'" size="small">
                            {{ calcLowerThan(scope.row.val1, scope.row.historicalLastWeek) }}
                        </el-tag>
                    </template>
                </el-table-column>

                <el-table-column label="< 上月同天" min-width="100" align="center">
                    <template #default="scope">
                        <template v-if="calcLowerThan(scope.row.val1, scope.row.historicalLastMonth) === null">
                            <span class="field-missing">—</span>
                        </template>
                        <el-tag v-else :type="calcLowerThan(scope.row.val1, scope.row.historicalLastMonth) === 'TRUE' ? 'success' : 'danger'" size="small">
                            {{ calcLowerThan(scope.row.val1, scope.row.historicalLastMonth) }}
                        </el-tag>
                    </template>
                </el-table-column>
            </el-table-column>

            <!-- 告警结果 -->
            <el-table-column width="120" align="center">
                <template #header>
                    <el-tooltip placement="top">
                        <template #content>
                            <div style="line-height:1.8;">
                                <div>间隔检查：当前告警与前一条告警时间差 &lt; X 分钟（检查间隔）→ <b style="color:#F56C6C;">FALSE</b></div>
                                <div style="margin-top:4px;">条件1：日累计提款 ≥ X（关联配置提款阈值）</div>
                                <div>条件2：存提差 &lt; 以下任意两个历史值</div>
                                <div style="padding-left:8px;">· 昨日同时间 / 上周同天 / 上月同天</div>
                                <div style="margin-top:4px;">告警结果：间隔OK AND 条件1 AND 条件2 → <b>TRUE</b></div>
                            </div>
                        </template>
                        <span class="tip-header">告警结果&nbsp;<el-icon size="11"><InfoFilled /></el-icon></span>
                    </el-tooltip>
                </template>
                <template #default="scope">
                    <el-tag :type="calcNormalResult(list.records.indexOf(scope.row), list.records, getCfg(list)) === 'TRUE' ? 'success' : 'danger'" size="small">
                        {{ calcNormalResult(list.records.indexOf(scope.row), list.records, getCfg(list)) }}
                    </el-tag>
                </template>
            </el-table-column>

            <!-- 风控系统判断 -->
            <el-table-column width="100" align="center">
                <template #header>风控系统判断</template>
                <template #default="scope">
                    <el-tag v-if="scope.row.devResult"
                        :type="scope.row.devResult === 'TRUE' ? 'success' : 'danger'"
                        size="small">
                        {{ scope.row.devResult }}
                    </el-tag>
                </template>
            </el-table-column>

            <!-- 逻辑一致 -->
            <el-table-column width="80" align="center">
                <template #header>逻辑一致</template>
                <template #default="scope">
                    <el-tag v-if="scope.row.ignored" type="info" size="small">—</el-tag>
                    <template v-else-if="scope.row.devResult">
                        <el-tag v-if="calcLogicMatch(list.records.indexOf(scope.row), list.records, getCfg(list))" type="success" size="small">✓ 一致</el-tag>
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
import { mapExcelRows } from '../logic/importMapper.js'
import {
    calcLowerThan,
    calcNormalResult,
    calcLogicMatch,
    getMatchCount as histGetMatchCount,
    getRowClass as histGetRowClass,
} from '../logic/netflowHistLogic.js'

const TYPE_ID = 10
const TYPE_COLOR = '#2f54eb'

// ── cfg 解析（单选 configId；configs 由 shell 注入）────────────────────────────
const getCfgForList = (list, configs) => (configs || []).find(c => c._id === list.configId) || null
const getCfgForRowFn = (list, row, configs) => getCfgForList(list, configs)

// ── 注入 shell 的纯逻辑（configs 由 shell 注入）────────────────────────────────
const getMatchCount = (list, configs) => histGetMatchCount(list.records, getCfgForList(list, configs))
const getRowClassFn = (row, absIdx, list, configs) => histGetRowClass(absIdx, list.records, getCfgForList(list, configs))

const newRecord = () => ({
    alertId: '', alertTime: '',
    val1: 0, depositAmount: 0, withdrawalAmount: 0,
    historicalYesterday: 0, historicalLastWeek: 0, historicalLastMonth: 0,
    lowerThanYesterday: null, lowerThanLastWeek: null, lowerThanLastMonth: null,
    devResult: '', ignored: false,
})

// ── 同步映射：sync-cache/10 已返回该类型映射后的记录，直接透传 ───────────────────
const mapSyncRecord = (item) => item

// ── Excel 导入映射（复用 importMapper.mapExcelRows 的 typeId=10 分支）────────────
const mapImportRow = (r) => mapExcelRows([r], TYPE_ID)[0]
</script>
