<template>
    <div style="display:flex;flex-direction:column;gap:20px;">
        <el-card shadow="hover" class="main-card">
            <template #header>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <h2 style="margin:0 0 2px;font-size:22px;color:var(--qa-heading-color);">{{ PAGE_TITLE }}告警检查</h2>
                        <p style="margin:0;font-size:13px;color:var(--qa-subtext-color);">
                            验证 {{ ALERT_TYPE }} 优惠环比告警逻辑
                        </p>
                    </div>
                    <el-button type="primary" size="large" @click="createNewList">
                        <el-icon style="margin-right:5px;"><Plus /></el-icon> 新增列表
                    </el-button>
                </div>
            </template>

            <div v-if="isPageLoading" style="padding:30px;">
                <el-skeleton :rows="8" animated />
            </div>
            <el-empty v-else-if="allLists.length === 0" description="暂无列表" />

            <el-collapse v-else v-model="activeLists" class="custom-collapse">
                <el-collapse-item v-for="list in allLists" :key="list._id" :name="list._id">

                    <template #title>
                        <div class="header-title-wrapper">
                            <span style="font-size:18px;margin-right:8px;">📋</span>
                            <template v-if="!list._isEditingName">
                                <span class="header-title">{{ list.listName }}</span>
                                <el-button link type="primary" class="edit-icon" @click.stop="startEditName(list)">
                                    <el-icon><Edit /></el-icon>
                                </el-button>
                            </template>
                            <template v-else>
                                <el-input v-model="list._tempName" size="small" style="width:250px;" @click.stop
                                    @keyup.enter.stop="confirmEditName(list)" placeholder="输入列表名称" />
                                <el-button type="success" size="small" circle style="margin-left:8px;"
                                    @click.stop="confirmEditName(list)">
                                    <el-icon><Check /></el-icon>
                                </el-button>
                                <el-button type="info" plain size="small" circle @click.stop="cancelEditName(list)">
                                    <el-icon><Close /></el-icon>
                                </el-button>
                            </template>
                        </div>
                    </template>

                    <!-- 控制栏 -->
                    <div class="control-panel">
                        <div class="panel-left">
                            <span class="cfg-label">关联配置：</span>
            <el-select v-model="list.configIds" size="small" style="min-width:240px;max-width:440px;"
                                multiple collapse-tags collapse-tags-tooltip
                                placeholder="可多选配置（各优惠类型自动匹配各自配置）" clearable @change="saveList(list, false)">
                                <el-option v-for="c in availableConfigs" :key="c._id"
                                    :label="c.promoName ? `${c.name}（${c.promoName}）` : c.name" :value="c._id" />
                                <template v-if="availableConfigs.length === 0">
                                    <el-option disabled value="" label="暂无配置，请前往「告警配置」添加" />
                                </template>
                            </el-select>
                        </div>
                        <div class="panel-right">
                            <span class="save-status" style="display:inline-flex; align-items:center; gap:5px; font-size:13px; color:#909399; margin-right:8px;">
                                <template v-if="list._saveState === 'saving'">
                                    <el-icon class="is-loading"><Loading /></el-icon> 保存中…
                                </template>
                                <template v-else-if="list._saveState === 'error'">
                                    <el-icon color="#F56C6C"><CircleClose /></el-icon>
                                    <span style="color:#F56C6C;">保存失败</span>
                                    <el-button link type="primary" @click="saveList(list)">重试</el-button>
                                </template>
                                <template v-else>
                                    <el-icon color="#67C23A"><CircleCheck /></el-icon> 已保存<template v-if="list._savedAt"> {{ list._savedAt }}</template>
                                </template>
                            </span>
                            <el-upload action="#" :auto-upload="false" :show-file-list="false"
                                :on-change="(file) => handleImport(file, list)">
                                <el-button type="warning" plain>
                                    <el-icon><Upload /></el-icon> 导入 Excel
                                </el-button>
                            </el-upload>
                            <el-button type="info" @click="addRow(list)">手工新增</el-button>
                            <el-divider direction="vertical" style="height:20px; margin:0 6px;" />
                            <el-button type="danger" plain @click="removeList(list._id)">删除</el-button>
                        </div>
                    </div>

                    <!-- 同步控制栏 -->
                    <div class="sync-bar" :class="{ 'sync-bar-active': list._syncEnabled }">
                        <div class="sync-bar-left">
                            <el-switch v-model="list._syncEnabled" :loading="list._isSyncingNow"
                                active-color="#67C23A"
                                @change="(v) => v ? startAutoSync(list) : stopAutoSync(list)" />
                            <span :class="['sync-toggle-label', list._syncEnabled ? 'label-on' : '']">
                                风控自动同步
                            </span>
                            <el-tooltip placement="top">
                                <template #content>
                                    <div style="max-width:240px;line-height:1.7;">
                                        在「配置 → 质检配置」中可修改间隔和抓取数量。<br />
                                        <span style="color:#bbb;font-size:11px;">修改后重启此列表的同步开关即可生效</span>
                                    </div>
                                </template>
                                <span class="sync-cfg-hint">
                                    每 {{ globalQAConfig.syncIntervalMin }} 分钟 · 抓 {{ globalQAConfig.syncPageSize }} 条
                                </span>
                            </el-tooltip>
                            <el-tooltip placement="top"
                                :content="(globalQAConfig.syncStartTime || globalQAConfig.syncEndTime) ? '已在质检配置中设定，子页面不支持修改' : '只同步告警时间落在此范围内的数据，留空 = 不限制'">
                                <span style="display:inline-block;">
                                <el-date-picker
                                    type="datetimerange"
                                    range-separator="至"
                                    start-placeholder="抓取起始" end-placeholder="抓取结束"
                                    format="MM-DD HH:mm"
                                    value-format="YYYY-MM-DD HH:mm:ss"
                                    style="width:330px;" size="small" clearable
                                    :disabled="!!(globalQAConfig.syncStartTime || globalQAConfig.syncEndTime)"
                                    :model-value="(globalQAConfig.syncStartTime || globalQAConfig.syncEndTime)
                                        ? [globalQAConfig.syncStartTime, globalQAConfig.syncEndTime]
                                        : ((list.syncStartTime && list.syncEndTime) ? [list.syncStartTime, list.syncEndTime] : null)"
                                    @update:model-value="v => { if (!(globalQAConfig.syncStartTime || globalQAConfig.syncEndTime)) { list.syncStartTime = v?.[0] || null; list.syncEndTime = v?.[1] || null; saveList(list, false) } }"
                                />
                                </span>
                            </el-tooltip>
                            <el-divider direction="vertical" />
                            <el-tooltip
                                :content="cooldownSec(list.rcBaseUrl) > 0 ? `冷却中，${cooldownSec(list.rcBaseUrl)} 秒后可再次同步` : ''"
                                :disabled="cooldownSec(list.rcBaseUrl) === 0"
                                placement="top">
                                <el-button size="small" plain :loading="list._isSyncingNow"
                                    :disabled="!globalSyncStatus.isAlive || cooldownSec(list.rcBaseUrl) > 0"
                                    @click="manualSync(list)">
                                    {{ cooldownSec(list.rcBaseUrl) > 0 ? `冷却中 ${cooldownSec(list.rcBaseUrl)}s` : '立即同步' }}
                                </el-button>
                            </el-tooltip>
                        </div>
                        <div class="sync-bar-right">
                            <el-tooltip placement="top">
                                <template #content>
                                    <div style="max-width:280px;line-height:1.7;">
                                        <b style="color:#F56C6C;">必填</b>：选择此列表对应的 RC 系统地址。<br />
                                        未选择 RC 地址时无法开启风控自动同步。
                                    </div>
                                </template>
                                <span class="sync-url-label sync-url-required">RC地址 <span style="color:#F56C6C;">*</span></span>
                            </el-tooltip>
                            <el-select v-model="list.rcBaseUrl" size="small" style="width:240px;"
                                placeholder="请选择 RC 地址（开启同步必填）" @change="saveList(list, false)">
                                <el-option v-for="env in rcEnvOptions" :key="env.rcBaseUrl"
                                    :label="`${env.name}  (${env.rcBaseUrl})`" :value="env.rcBaseUrl" />
                                <template v-if="rcEnvOptions.length === 0">
                                    <el-option disabled value="" label="暂无配置，请前往「接口配置」添加" />
                                </template>
                            </el-select>
                            <el-divider direction="vertical" />
                            <template v-if="globalSyncStatus.isAlive">
                                <el-icon color="var(--qa-pass)" size="13"><CircleCheck /></el-icon>
                                <span class="sync-status-on">服务运行中</span>
                                <span v-if="list._lastSyncAt" class="sync-time">
                                    上次同步：{{ list._lastSyncAt }}
                                </span>
                            </template>
                            <template v-else>
                                <el-icon color="#E6A23C" size="13"><Warning /></el-icon>
                                <el-tooltip placement="top">
                                    <template #content>
                                        <div style="max-width:340px;line-height:1.8;font-size:12px;">
                                            <b>需在 terminal 持续运行对应环境的同步服务：</b><br />
                                            正式站：<code>python rc_sync_service.py</code><br />
                                            测试站：<code>python rc_sync_service.py --url https://rc-client.platform10.me</code><br />
                                            <span style="color:#bbb;">每个环境需单独运行一个进程</span>
                                        </div>
                                    </template>
                                    <span class="sync-status-off" style="cursor:help;text-decoration:underline dotted;">
                                        未连接 · 请在 terminal 运行 rc_sync_service.py
                                    </span>
                                </el-tooltip>
                            </template>
                        </div>
                    </div>

                    <!-- 空列表引导 -->
                    <div v-if="!list.records || list.records.length === 0" class="empty-list-hint">
                        <el-icon size="32" color="#c0c4cc"><DocumentAdd /></el-icon>
                        <div class="empty-hint-text">
                            <div class="empty-hint-title">此列表暂无数据</div>
                            <div class="empty-hint-actions">
                                可通过以下方式添加数据：<br />
                                <b>① 手工新增</b> — 手动录入单条记录<br />
                                <b>② 风控自动同步</b> — 开启后自动从 RC 系统拉取数据
                            </div>
                        </div>
                    </div>

                    <!-- 统计栏 -->
                    <div v-if="list.records && list.records.length > 0" class="stats-bar"
                        :class="{ 'has-fail': getMatchCount(list.records, row => getCfgForRow(list, row)).fail > 0 }">
                        <span class="stat-item">共 <b>{{ list.records.length }}</b> 条记录</span>
                        <el-divider direction="vertical" />
                        <span class="stat-item stat-pass">
                            <el-icon><CircleCheck /></el-icon>&nbsp;逻辑一致：<b>{{ getMatchCount(list.records, row => getCfgForRow(list, row)).pass }}</b>
                        </span>
                        <el-divider direction="vertical" />
                        <span class="stat-item" :class="getMatchCount(list.records, row => getCfgForRow(list, row)).fail > 0 ? 'stat-fail' : 'stat-ok'">
                            <el-icon><CircleClose /></el-icon>&nbsp;逻辑异常：<b>{{ getMatchCount(list.records, row => getCfgForRow(list, row)).fail }}</b>
                        </span>
                        <el-tag v-if="getMatchCount(list.records, row => getCfgForRow(list, row)).fail > 0"
                            type="danger" effect="dark" size="small" style="margin-left:10px;">
                            ⚠ {{ getMatchCount(list.records, row => getCfgForRow(list, row)).fail }} 条异常，请检查高亮行
                        </el-tag>
                        <el-tag v-else-if="list.records.filter(r => r.devResult && !r.ignored).length > 0"
                            type="success" effect="dark" size="small" style="margin-left:10px;">
                            ✓ 逻辑全一致
                        </el-tag>
                    </div>

                    <!-- 批量操作栏 -->
                    <div v-if="list.records && list.records.length > 0" class="action-bar">
                        <div class="action-bar-left">
                            <el-dropdown trigger="click" size="small">
                                <el-button size="small" plain>
                                    批量操作 <el-icon style="margin-left:2px;"><ArrowDown /></el-icon>
                                </el-button>
                                <template #dropdown>
                                    <el-dropdown-menu>
                                        <el-dropdown-item @click="allIgnore(list)">忽略全部</el-dropdown-item>
                                        <el-dropdown-item @click="allRestore(list)">恢复全部</el-dropdown-item>
                                        <el-dropdown-item divided @click="allDelete(list)">
                                            <span style="color:#F56C6C;">删除全部</span>
                                        </el-dropdown-item>
                                    </el-dropdown-menu>
                                </template>
                            </el-dropdown>
                            <template v-if="list._selectedRows && list._selectedRows.length > 0">
                                <el-divider direction="vertical" />
                                <span class="bulk-count">已选 <b>{{ list._selectedRows.length }}</b> 条</span>
                                <el-button size="small" type="warning" plain @click="bulkIgnore(list)">忽略</el-button>
                                <el-button size="small" type="success" plain @click="bulkRestore(list)">恢复</el-button>
                                <el-button size="small" type="danger"  plain @click="bulkDelete(list)">删除</el-button>
                                <el-button size="small" link @click="list._selectedRows = []">取消</el-button>
                            </template>
                        </div>
                        <div class="action-bar-right">
                            <!-- 优惠名称筛选（仅过滤展示行，逻辑仍按完整 records 的绝对索引计算） -->
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
                                <el-option
                                    v-for="t in rewardTypeOptions(list)"
                                    :key="t"
                                    :label="t"
                                    :value="t"
                                />
                            </el-select>
                            <el-divider direction="vertical" />
                            <el-date-picker
                                v-model="list._dateRange"
                                type="datetimerange"
                                range-separator="至"
                                start-placeholder="开始时间"
                                end-placeholder="结束时间"
                                size="small"
                                style="width:360px;"
                                format="YYYY-MM-DD HH:mm"
                                value-format="YYYY-MM-DD HH:mm:ss"
                                :default-time="[new Date(2000,1,1,0,0,0), new Date(2000,1,1,23,59,59)]"
                                @change="list._currentPage = 1"
                                clearable
                            />
                            <span v-if="list._dateRange || list._rewardTypeFilter" class="filter-count">
                                {{ getFilteredRecords(list).length }} / {{ list.records.length }} 条
                            </span>
                        </div>
                    </div>

                    <!-- 数据表格 -->
                    <div v-if="list.records && list.records.length > 0" style="overflow-x:auto;">
                    <el-table :data="getPagedRecords(list)"
                        border size="small" style="width:100%;margin-top:8px;"
                        :row-key="(row) => row.alertId || list.records.indexOf(row)"
                        :row-class-name="({ row }) => getRowClass(list.records.indexOf(row), list.records, getCfgForRow(list, row))"
                        @selection-change="rows => list._selectedRows = rows">

                        <el-table-column type="selection" width="40" fixed="left" reserve-selection />

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
                                    :controls="false" style="width:100%;" placeholder="未抓到" />
                            </template>
                        </el-table-column>

                        <!-- 5. 本时段增长 -->
                        <el-table-column label="本时段增长" width="120">
                            <template #default="{ row }">
                                <el-input-number v-model="row.currentGrowth" size="small"
                                    :controls="false" style="width:100%;" placeholder="未抓到" />
                            </template>
                        </el-table-column>

                        <!-- 6. 上时段增长（原始，倍数由配置乘） -->
                        <el-table-column label="上时段增长" width="135">
                            <template #default="{ row }">
                                <el-input-number v-model="row.lastGrowth" size="small"
                                    :controls="false" style="width:100%;" placeholder="未抓到" />
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
                                <b :style="{ color: getContResultColor(calcContResult(list.records.indexOf(row), list.records, getCfgForRow(list, row))) }">
                                    {{ calcContResult(list.records.indexOf(row), list.records, getCfgForRow(list, row)) }}
                                </b>
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

                        <!-- 12. 操作 -->
                        <el-table-column label="操作" width="112" align="center" fixed="right">
                            <template #default="{ row }">
                                <el-button size="small" link
                                    :type="row.ignored ? 'primary' : 'warning'"
                                    @click="row.ignored = !row.ignored; saveList(list, false)">
                                    {{ row.ignored ? '取消忽略' : '忽略' }}
                                </el-button>
                                <el-button size="small" link type="danger"
                                    @click="deleteRow(list, list.records.indexOf(row))">删除</el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                    </div>

                    <!-- 分页 -->
                    <div v-if="list.records && list.records.length > 0" class="pagination-bar">
                        <el-pagination
                            v-model:current-page="list._currentPage"
                            v-model:page-size="list._pageSize"
                            :page-sizes="[30, 50, 100, 200]"
                            :total="getFilteredRecords(list).length"
                            layout="total, sizes, prev, pager, next, jumper"
                            background
                            @size-change="list._currentPage = 1"
                        />
                    </div>

                </el-collapse-item>
            </el-collapse>
        </el-card>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import axios from 'axios'
import { ElNotification, ElMessageBox } from 'element-plus'
import {
    Plus, Edit, Check, Close, CircleCheck, CircleClose,
    Warning, DocumentAdd, InfoFilled, Upload, ArrowDown, Loading
} from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import { useSyncManager } from '../composables/useSyncManager.js'
import { useAppStore } from '../stores/appStore.js'
import { PAGE_TITLES } from '../logic/alertTypes.js'
import {
    calcNormalResult, calcContResult, calcLogicMatch, calcAlertSeq,
    getRowClass, getMatchCount, getContResultColor
} from '../logic/promoMomLogic.js'

const API       = 'http://localhost:3000/api'
const TYPE_ID   = 12
const PAGE_TITLE = PAGE_TITLES[TYPE_ID]
const ALERT_TYPE = 'reward-interval'

// ── Store ──────────────────────────────────────────────────────────────────────
const appStore = useAppStore()

// ── QA 全局配置 ────────────────────────────────────────────────────────────────
const globalQAConfig = ref({ syncIntervalMin: 1, syncPageSize: 200, syncStartTime: null, syncEndTime: null })
const loadQAConfig = async () => {
    try { const { data } = await axios.get(`${API}/qa-config`); globalQAConfig.value = data } catch {}
}

// ── RC 环境列表 ───────────────────────────────────────────────────────────────
const rcEnvOptions = ref([])
const loadRcEnvs = async () => {
    try { const { data } = await axios.get(`${API}/qa-config`); rcEnvOptions.value = data.rcEnvs || [] } catch {}
}

// ── 关联配置列表（typeId=12）──────────────────────────────────────────────────
const availableConfigs = ref([])
const loadAvailableConfigs = async () => {
    try { const { data } = await axios.get(`${API}/configs/${TYPE_ID}`); availableConfigs.value = data } catch {}
}

// 列表关联的配置集合（支持多选 configIds；兼容旧的单值 configId）
const listCfgs = list => {
    const ids = (list.configIds && list.configIds.length) ? list.configIds : (list.configId ? [list.configId] : [])
    return ids.map(id => availableConfigs.value.find(c => c._id === id)).filter(Boolean)
}
const getCfg = list => listCfgs(list)[0] || null

// 配置的「优惠类型」支持多个名称（逗号分隔）：行的优惠类型命中其中任一即用该配置（大小写不敏感）。
// 仅在「本列表关联的配置」内匹配，确保按环境隔离（不会误用其它环境的同类型配置）。
const cfgPromoNames = c => String(c?.promoName ?? '').split(/[,，]/).map(s => s.trim()).filter(Boolean)
const getCfgForRow = (list, row) => {
    const name = String(row?.rewardType ?? '').trim().toLowerCase()
    const cfgs = listCfgs(list)
    if (name) {
        const byName = cfgs.find(c => cfgPromoNames(c).some(n => n.toLowerCase() === name))
        if (byName) return byName
    }
    return cfgs[0] || null
}

// ── 同步状态 ──────────────────────────────────────────────────────────────────
const globalSyncStatus = ref({ isAlive: false })
const fetchSyncStatusFn = async (rcBaseUrl = '') => {
    try {
        const params = rcBaseUrl ? { url: rcBaseUrl } : {}
        const { data } = await axios.get(`${API}/sync-status`, { params })
        globalSyncStatus.value = data
    } catch { globalSyncStatus.value = { isAlive: false } }
}

// ── Sync composable ───────────────────────────────────────────────────────────
const toNum = v => (v === null || v === undefined || v === '') ? null : Number(v)
const {
    cooldownSec, startTick, stopTick, destroyAll,
    startAutoSync: _startAutoSync, stopAutoSync: _stopAutoSync, manualSync: _manualSync,
} = useSyncManager({
    getCacheUrl: list =>
        `${API}/sync-cache/${TYPE_ID}?url=${encodeURIComponent(list.rcBaseUrl || '')}`,
    // 只同步「告警时间落在抓取时间范围内」的记录：优先用质检全局配置，其次用本列表设置；起/止可留空 = 该端不限制
    filterRecords: (raw, list) => {
        const s = globalQAConfig.value?.syncStartTime || list?.syncStartTime
        const e = globalQAConfig.value?.syncEndTime   || list?.syncEndTime
        if (!s && !e) return raw
        const sMs = s ? new Date(s).getTime() : -Infinity
        const eMs = e ? new Date(e).getTime() :  Infinity
        return raw.filter(r => {
            const t = new Date(r.alertTime).getTime()
            return !isNaN(t) && t >= sMs && t <= eMs
        })
    },
    mapRecord: item => ({
        alertId:             String(item.alertId  || ''),
        alertTime:           String(item.alertTime || ''),
        rewardType:          String(item.rewardType ?? '') || '',
        todayTotal:          toNum(item.todayTotal),
        currentGrowth:       toNum(item.currentGrowth),
        lastGrowth: toNum(item.lastGrowth),
        // alertSeq（今日第N个告警）由 RCS_QA 计算，不再抓取/存储
        devResult:           item.devResult || '',
        ignored:             false,
    }),
    onNewRecords: async (list) => { await saveList(list, false) },
})

// Wrap sync fns to also update globalSyncStatus
const startAutoSync = async list => {
    if (!list.rcBaseUrl) {
        list._syncEnabled = false
        ElNotification.warning({ message: '请先选择 RC 地址', position: 'bottom-right', duration: 4000 })
        return
    }
    await fetchSyncStatusFn(list.rcBaseUrl)
    await _startAutoSync(list, saveList)
    saveSyncState(list)
}
const stopAutoSync = list => { _stopAutoSync(list, saveList); saveSyncState(list) }

// ── 同步开关持久化 + 恢复（与「质检配置」批量开启共用同一 localStorage key）──
// 修复：优惠环比页此前缺少恢复逻辑，导致质检配置「开启选中」后本页开关不生效、不会真正同步
const SYNC_STORAGE_KEY = (id) => `rcs_sync_${id}`
const saveSyncState = (list) => {
    try { localStorage.setItem(SYNC_STORAGE_KEY(list._id), JSON.stringify({ enabled: list._syncEnabled })) } catch {}
}
const restoreSyncState = (list) => {
    try {
        const raw = localStorage.getItem(SYNC_STORAGE_KEY(list._id))
        if (!raw) return
        if (!JSON.parse(raw).enabled || !list.rcBaseUrl) return
        list._syncEnabled = true
        startAutoSync(list)
    } catch {}
}
const manualSync   = async list => {
    await fetchSyncStatusFn(list.rcBaseUrl)
    await _manualSync(list)
}

// ── State ──────────────────────────────────────────────────────────────────────
const allLists      = ref([])
const activeLists   = ref([])
const isPageLoading = ref(false)

// ── Reward-type options ──────────────────────────────────────────────────────────
const rewardTypeOptions = list => {
    const set = new Set()
    list.records.forEach(r => { if (r.rewardType) set.add(r.rewardType) })
    return [...set]
}

// ── Time + reward-type filter + pagination ───────────────────────────────────────
const getFilteredRecords = list => {
    let rows = list.records
    if (list._dateRange?.[0]) {
        const s = new Date(list._dateRange[0]).getTime()
        const e = new Date(list._dateRange[1]).getTime()
        rows = rows.filter(r => {
            if (!r.alertTime) return false
            const t = new Date(r.alertTime).getTime()
            return t >= s && t <= e
        })
    }
    if (list._rewardTypeFilter) {
        rows = rows.filter(r => r.rewardType === list._rewardTypeFilter)
    }
    return rows
}

const getPagedRecords = list => {
    const filtered = getFilteredRecords(list)
    const page = list._currentPage || 1
    const size = list._pageSize    || 50
    return filtered.slice((page - 1) * size, page * size)
}

// ── Batch operations ───────────────────────────────────────────────────────────
const bulkIgnore = list => {
    const sel = new Set(list._selectedRows)
    list.records.forEach(r => { if (sel.has(r)) r.ignored = true })
    list._selectedRows = []
}
const bulkRestore = list => {
    const sel = new Set(list._selectedRows)
    list.records.forEach(r => { if (sel.has(r)) r.ignored = false })
    list._selectedRows = []
}
const bulkDelete = async list => {
    if (!list._selectedRows.length) return
    // 快照选中项：await 期间表格会清空 _selectedRows，必须先固定引用，否则只删零星几条
    const selectedRows = [...list._selectedRows]
    try {
        await ElMessageBox.confirm(
            `确认删除选中的 ${selectedRows.length} 条记录？`,
            '批量删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
        )
        const sel = new Set(selectedRows)
        list.records = list.records.filter(r => !sel.has(r))
        list._selectedRows = []
        const maxPage = Math.max(1, Math.ceil(list.records.length / list._pageSize))
        if (list._currentPage > maxPage) list._currentPage = maxPage
        await saveList(list, false)
    } catch { /* cancelled */ }
}

// ── 一键全部操作 ──────────────────────────────────────────────────────────────
const allIgnore = async list => {
    try {
        await ElMessageBox.confirm(`确认忽略全部 ${list.records.length} 条记录？`, '一键忽略', {
            type: 'warning', confirmButtonText: '忽略全部', cancelButtonText: '取消'
        })
        list.records.forEach(r => { r.ignored = true })
    } catch { /* cancelled */ }
}
const allRestore = async list => {
    try {
        await ElMessageBox.confirm(`确认恢复全部 ${list.records.length} 条记录？`, '一键恢复', {
            type: 'info', confirmButtonText: '恢复全部', cancelButtonText: '取消'
        })
        list.records.forEach(r => { r.ignored = false })
    } catch { /* cancelled */ }
}
const allDelete = async list => {
    try {
        await ElMessageBox.confirm(`确认删除全部 ${list.records.length} 条记录？此操作不可撤销。`, '一键删除', {
            type: 'warning', confirmButtonText: '删除全部', cancelButtonText: '取消',
            confirmButtonClass: 'el-button--danger'
        })
        list.records = []
        list._selectedRows = []
        list._currentPage = 1
        await saveList(list, false)
        ElNotification.success({ message: '全部记录已删除', position: 'bottom-right' })
    } catch { /* cancelled */ }
}

// ── List CRUD ──────────────────────────────────────────────────────────────────
const fetchLists = async () => {
    isPageLoading.value = true
    try {
        const { data } = await axios.get(`${API}/test-lists/${TYPE_ID}`)
        allLists.value = data.map(l => ({
            ...l,
            // 兼容旧数据：把单值 configId 迁移成 configIds 数组
            configIds:      (l.configIds && l.configIds.length) ? l.configIds : (l.configId ? [l.configId] : []),
            _isEditingName: false,
            _tempName:      l.listName,
            _isSaving:      false,
            _saveState:     'idle',
            _savedAt:       null,
            _syncEnabled:   false,
            _isSyncingNow:  false,
            _lastSyncAt:    '',
            _currentPage:   1,
            _pageSize:      50,
            _selectedRows:  [],
            _dateRange:     null,
            _rewardTypeFilter: '',
        }))
        allLists.value.forEach(attachAutoSave)
        if (allLists.value.length > 0) activeLists.value = [allLists.value[0]._id]
    } finally {
        isPageLoading.value = false
    }
}

// ── 自动保存：列表数据/配置一变就存，带状态反馈，无需手动点保存 ────────────────
const _saveTimers = new Map()

const saveList = async (list) => {
    list._saveState = 'saving'
    try {
        await axios.post(`${API}/test-lists`, {
            _id:           list._id,
            typeId:        TYPE_ID,
            listName:      list.listName,
            configIds:     list.configIds || [],
            configId:      (list.configIds && list.configIds[0]) || list.configId || null,  // 兼容旧字段
            rcBaseUrl:     list.rcBaseUrl || '',
            syncStartTime: list.syncStartTime || null,
            syncEndTime:   list.syncEndTime || null,
            records:       list.records,
        })
        list._saveState = 'idle'
        list._savedAt = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch (e) {
        list._saveState = 'error'
        console.error('[saveList] 保存失败:', e)
    }
}

/** 防抖保存：连续改动 700ms 后落库一次 */
const queueSave = (list) => {
    list._saveState = 'saving'
    clearTimeout(_saveTimers.get(list._id))
    _saveTimers.set(list._id, setTimeout(() => saveList(list), 700))
}

/** 给列表挂自动保存监听：records / 关联配置 / RC地址 / 起始时间 任一变化即存 */
const attachAutoSave = (list) => {
    if (list._autosaveOn) return
    list._autosaveOn = true
    watch(
        () => [list.records, list.configIds, list.configId, list.rcBaseUrl, list.syncStartTime, list.syncEndTime],
        () => queueSave(list),
        { deep: true }
    )
}

const createNewList = async () => {
    try {
        const { value } = await ElMessageBox.prompt('请输入列表名称', '新增列表', {
            confirmButtonText: '创建', cancelButtonText: '取消',
            inputValidator: v => v?.trim() ? true : '名称不能为空',
        })
        if (!value?.trim()) return
        const { data } = await axios.post(`${API}/test-lists`, {
            typeId: TYPE_ID, listName: value.trim(), records: [],
        })
        allLists.value.unshift({
            ...data,
            configIds: (data.configIds && data.configIds.length) ? data.configIds : (data.configId ? [data.configId] : []),
            _isEditingName: false, _tempName: data.listName,
            _isSaving: false, _saveState: 'idle', _savedAt: null,
            _syncEnabled: false, _isSyncingNow: false,
            _lastSyncAt: '', _currentPage: 1, _pageSize: 50,
            _selectedRows: [], _dateRange: null, _rewardTypeFilter: '',
        })
        attachAutoSave(allLists.value[0])
        activeLists.value = [data._id]
    } catch {}
}

const removeList = async id => {
    try {
        await ElMessageBox.confirm('确认删除该列表及其全部记录？', '删除确认', { type: 'warning' })
        await axios.delete(`${API}/test-lists/${id}`)
        allLists.value = allLists.value.filter(l => l._id !== id)
        ElNotification.success({ message: '列表已删除', position: 'bottom-right', duration: 2000 })
    } catch {}
}

const startEditName  = l => { l._tempName = l.listName; l._isEditingName = true }
const cancelEditName = l => { l._isEditingName = false }
const confirmEditName = async l => {
    if (!l._tempName?.trim()) return
    l.listName = l._tempName.trim(); l._isEditingName = false
    await saveList(l, false)
}

// ── Excel import ──────────────────────────────────────────────────────────────
const handleImport = (file, list) => {
    const reader = new FileReader()
    reader.onload = (e) => {
        try {
            const wb  = XLSX.read(e.target.result, { type: 'array' })
            const ws  = wb.Sheets[wb.SheetNames[0]]
            const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

            const mapped = rows
                .filter(r => !r.alertType || r.alertType === ALERT_TYPE)
                .map(r => ({
                    alertId:             String(r.alertNumber || r.alertId || ''),
                    alertTime:           String(r.alertGeneratedTime || r.alertTime || ''),
                    rewardType:          String(r.rewardType ?? r['meta.rewardType'] ?? '') || '',
                    todayTotal:          toNum(r.todayTotal          ?? r['meta.todayTotal']),
                    currentGrowth:       toNum(r.currentGrowth       ?? r['meta.currentGrowth']),
                    lastGrowth: toNum(r.lastGrowth ?? r['meta.lastGrowth']),
                    // alertSeq（今日第N个告警）由 RCS_QA 计算，不再从 Excel 取
                    devResult:           String(r.alertNumber || '').trim() ? 'TRUE' : '',
                    ignored:             false,
                }))

            if (mapped.length === 0) {
                ElNotification.warning({ message: `未找到有效数据（请确认告警类型为 ${ALERT_TYPE}）`, position: 'bottom-right' })
                return
            }

            const existedIds = new Set(list.records.map(r => r.alertId).filter(Boolean))
            const newOnes    = mapped.filter(r => !r.alertId || !existedIds.has(r.alertId))
            list.records.unshift(...newOnes)
            list._currentPage = 1
            ElNotification.success({
                message: `导入 ${mapped.length} 条，新增 ${newOnes.length} 条`,
                position: 'bottom-right', duration: 3000,
            })
        } catch (err) {
            ElNotification.error({ message: `解析失败：${err.message}`, position: 'bottom-right' })
        }
    }
    reader.readAsArrayBuffer(file.raw)
}

// ── Row operations ─────────────────────────────────────────────────────────────
const addRow = list => {
    list.records.unshift({
        alertId: '', alertTime: '', rewardType: '',
        todayTotal: 0, currentGrowth: 0, lastGrowth: 0,
        devResult: '', ignored: false,
    })
    list._currentPage = 1
}
const deleteRow = (list, idx) => list.records.splice(idx, 1)

// ── Lifecycle ──────────────────────────────────────────────────────────────────
onMounted(async () => {
    await Promise.all([fetchLists(), loadRcEnvs(), loadQAConfig(), loadAvailableConfigs()])
    allLists.value.forEach(l => restoreSyncState(l))
    startTick()
    await fetchSyncStatusFn()
})
onBeforeUnmount(() => { destroyAll(); stopTick() })
</script>

<style scoped>
.main-card :deep(.el-card__header) { padding: 16px 20px; }

/* ── Collapse header ── */
.header-title-wrapper { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
.header-title { font-size: 15px; font-weight: 600; color: var(--qa-heading-color); }
.edit-icon { opacity: 0; transition: opacity .15s; }
.header-title-wrapper:hover .edit-icon { opacity: 1; }

/* ── Control panel ── */
.control-panel {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 0 10px; flex-wrap: wrap; gap: 8px;
}
.panel-left, .panel-right { display: flex; align-items: center; gap: 8px; }
.cfg-label { font-size: 13px; color: #606266; font-weight: 500; }

/* ── Sync bar ── */
.sync-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 14px; margin: 4px 0 10px; border-radius: 6px;
    background: #f7f8fa; border: 1px solid #ebeef5; flex-wrap: wrap; gap: 8px;
}
.sync-bar-active { background: #f0f9eb; border-color: #b3e19d; }
.sync-bar-left, .sync-bar-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sync-toggle-label { font-size: 13px; color: #606266; }
.label-on { color: #67c23a; font-weight: 600; }
.sync-cfg-hint { font-size: 12px; color: #909399; cursor: help; }
.sync-url-label { font-size: 12px; color: #909399; white-space: nowrap; }
.sync-url-required { font-weight: 500; }
.sync-status-on  { font-size: 12px; color: var(--qa-pass); font-weight: 500; }
.sync-status-off { font-size: 12px; color: #E6A23C; }
.sync-time       { font-size: 11px; color: #c0c4cc; }

/* ── Empty hint ── */
.empty-list-hint {
    display: flex; align-items: flex-start; gap: 14px;
    padding: 20px 16px; background: #fafafa; border-radius: 6px;
    border: 1px dashed #e0e0e0; margin: 8px 0;
}
.empty-hint-text  { font-size: 13px; color: #606266; line-height: 1.8; }
.empty-hint-title { font-weight: 600; color: #303133; margin-bottom: 4px; }
.empty-hint-actions { color: #909399; }

/* ── Stats bar ── */
.stats-bar {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 14px; margin: 4px 0 8px;
    background: #f0f9eb; border-radius: 6px; border: 1px solid #b3e19d;
    font-size: 13px; flex-wrap: wrap;
}
.stats-bar.has-fail { background: #fef0f0; border-color: #fbc4c4; }
.stat-item { display: flex; align-items: center; gap: 4px; }
.stat-pass { color: var(--qa-pass); }
.stat-fail { color: var(--qa-fail); font-weight: 600; }
.stat-ok   { color: var(--qa-pass); }

/* ── Action bar ── */
.action-bar {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 6px 10px; margin-bottom: 6px;
    background: #fdf6ec; border: 1px solid #faecd8;
    border-radius: 6px; font-size: 13px; flex-wrap: wrap;
}
.action-bar-left  { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.action-bar-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.bulk-count { font-size: 13px; color: #606266; }
.filter-label { font-size: 12px; color: #909399; white-space: nowrap; }
.filter-count { font-size: 12px; color: #909399; white-space: nowrap; }

/* ── Table ── */
.tip-header { cursor: help; display: flex; align-items: center; gap: 2px; }
.field-missing { color: #E6A23C; font-size: 12px; font-weight: 500; white-space: nowrap; }
:deep(.row-mismatch td) { background-color: #fff0f0 !important; }
:deep(.row-ignored td)  { opacity: .45; }

/* ── Pagination ── */
.pagination-bar {
    display: flex; justify-content: flex-end;
    padding: 12px 0 0;
}

.custom-collapse :deep(.el-collapse-item__header) { font-size: 14px; padding: 0 16px; height: 48px; }
.custom-collapse :deep(.el-collapse-item__content) { padding: 0 16px 16px; }
</style>
