<template>
    <div class="test-page">
        <div class="page-header">
            <div>
                <h2 class="page-title">{{ pageTitle }}</h2>
                <p class="page-subtitle">{{ pageSubtitle }}</p>
            </div>
            <el-button type="primary" @click="createNewList">
                <el-icon style="margin-right: 5px;"><Plus /></el-icon> 新增列表
            </el-button>
        </div>

        <div v-if="isPageLoading" class="loading-wrap"><el-skeleton :rows="8" animated /></div>
        <el-empty v-else-if="allLists.length === 0" description="暂无测试列表" />
        <el-collapse v-else v-model="activeLists" class="list-collapse" :style="{ '--type-color': typeColor }">
            <el-collapse-item v-for="list in allLists" :key="list._id" :name="list._id">
                <template #title>
                    <div class="list-head">
                        <span class="list-dot"></span>
                        <template v-if="!list._isEditingName">
                            <span class="list-name">{{ list.listName }}</span>
                            <el-button link type="primary" class="edit-icon" @click.stop="startEditName(list)">
                                <el-icon><Edit /></el-icon>
                            </el-button>
                        </template>
                        <template v-else>
                            <el-input v-model="list._tempName" size="small" style="width: 240px;" @click.stop
                                @keyup.enter.stop="confirmEditName(list)" placeholder="输入列表名称" />
                            <el-button type="success" size="small" circle style="margin-left: 8px;"
                                @click.stop="confirmEditName(list)">
                                <el-icon><Check /></el-icon>
                            </el-button>
                        </template>
                        <el-tag v-if="list.records && list.records.length > 0 && getMatchCount(list).fail > 0"
                            type="danger" size="small" effect="light" class="list-badge">
                            {{ getMatchCount(list).fail }} 条异常
                        </el-tag>

                        <div class="list-head-spacer"></div>

                        <span class="save-status" @click.stop>
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
                    </div>
                </template>

                <div class="list-body">
                    <!-- 关联配置 + 列表操作 -->
                    <div class="setting-row">
                        <slot name="config" :list="list" :availableConfigs="availableConfigs"
                            :saveList="saveList" :getCfg="getCfg" :getCfgForRow="getCfgForRow" />

                        <div class="setting-row-spacer"></div>

                        <el-upload action="#" :auto-upload="false" :show-file-list="false"
                            :on-change="(file) => handleImportPreview(file, list)">
                            <el-button type="primary" plain size="small">
                                <el-icon style="margin-right:3px;"><Upload /></el-icon> 导入 Excel
                            </el-button>
                        </el-upload>
                        <el-button plain size="small" @click="addRow(list)">
                            <el-icon style="margin-right:3px;"><Plus /></el-icon> 手工新增
                        </el-button>
                        <el-button type="danger" plain size="small" @click="removeList(list._id)">删除</el-button>
                    </div>

                    <!-- 同步控制栏 -->
                    <div class="sync-bar" :class="{ 'sync-bar-active': list._syncEnabled }">
                        <div class="sync-bar-left">
                            <el-switch
                                v-model="list._syncEnabled"
                                :loading="list._isSyncingNow"
                                active-color="#67C23A"
                                @change="(v) => v ? startAutoSync(list) : stopAutoSync(list)"
                            />
                            <span :class="['sync-toggle-label', list._syncEnabled ? 'label-on' : '']">
                                风控自动同步
                            </span>
                            <el-tooltip placement="bottom">
                                <template #content>
                                    <div style="max-width:240px; line-height:1.7;">
                                        在「配置 → 质检配置」中可修改间隔和抓取数量。<br />
                                        <span style="color:#bbb; font-size:11px;">修改后重启此列表的同步开关即可生效</span>
                                    </div>
                                </template>
                                <span class="sync-cfg-hint">
                                    每 {{ globalQAConfig.syncIntervalMin }} 分钟 · 抓 {{ globalQAConfig.syncPageSize }} 条
                                </span>
                            </el-tooltip>
                            <!-- 同步抓取时间：开始 + 结束（结束留空 = 一直抓到最新）-->
                            <el-tooltip placement="bottom"
                                :content="(globalQAConfig.syncStartTime || globalQAConfig.syncEndTime) ? '已在质检配置中设定，子页面不支持修改' : '只同步告警时间 ≥ 开始时间的数据；结束时间留空 = 一直抓到最新'">
                                <span class="sync-time-fields">
                                    <el-date-picker
                                        type="datetime"
                                        placeholder="开始时间"
                                        format="MM-DD HH:mm"
                                        value-format="YYYY-MM-DD HH:mm:ss"
                                        style="width:150px;"
                                        size="small"
                                        clearable
                                        :disabled="!!(globalQAConfig.syncStartTime || globalQAConfig.syncEndTime)"
                                        :model-value="(globalQAConfig.syncStartTime || globalQAConfig.syncEndTime) ? globalQAConfig.syncStartTime : list.syncStartTime"
                                        @update:model-value="v => { if (!(globalQAConfig.syncStartTime || globalQAConfig.syncEndTime)) { list.syncStartTime = v || null; saveList(list, false) } }"
                                    />
                                    <span class="sync-time-sep">至</span>
                                    <el-date-picker
                                        type="datetime"
                                        placeholder="结束（留空=最新）"
                                        format="MM-DD HH:mm"
                                        value-format="YYYY-MM-DD HH:mm:ss"
                                        style="width:170px;"
                                        size="small"
                                        clearable
                                        :disabled="!!(globalQAConfig.syncStartTime || globalQAConfig.syncEndTime)"
                                        :model-value="(globalQAConfig.syncStartTime || globalQAConfig.syncEndTime) ? globalQAConfig.syncEndTime : list.syncEndTime"
                                        @update:model-value="v => { if (!(globalQAConfig.syncStartTime || globalQAConfig.syncEndTime)) { list.syncEndTime = v || null; saveList(list, false) } }"
                                    />
                                </span>
                            </el-tooltip>
                            <el-divider direction="vertical" />
                            <el-tooltip
                                :content="cooldownSec(list.rcBaseUrl) > 0 ? `冷却中，${cooldownSec(list.rcBaseUrl)} 秒后可再次同步` : ''"
                                :disabled="cooldownSec(list.rcBaseUrl) === 0"
                                placement="top"
                            >
                                <el-button
                                    size="small"
                                    plain
                                    :loading="list._isSyncingNow"
                                    :disabled="!globalSyncStatus.isAlive || cooldownSec(list.rcBaseUrl) > 0"
                                    @click="manualSync(list)"
                                >
                                    {{ cooldownSec(list.rcBaseUrl) > 0 ? `冷却中 ${cooldownSec(list.rcBaseUrl)}s` : '立即同步' }}
                                </el-button>
                            </el-tooltip>
                            <slot name="sync-extras" :list="list" />
                        </div>
                        <div class="sync-bar-right">
                            <!-- Per-list RC URL override -->
                            <el-tooltip placement="top">
                                <template #content>
                                    <div style="max-width:280px; line-height:1.7;">
                                        <b style="color:#F56C6C;">必填</b>：选择此列表对应的 RC 系统地址。<br />
                                        未选择 RC 地址时无法开启风控自动同步。<br />
                                        在「接口配置」页面管理 RC 地址列表。
                                    </div>
                                </template>
                                <span class="sync-url-label sync-url-required">RC地址 <span style="color:#F56C6C;">*</span></span>
                            </el-tooltip>
                            <el-select
                                v-model="list.rcBaseUrl"
                                size="small"
                                style="width: 240px;"
                                placeholder="请选择 RC 地址（开启同步必填）"
                                @change="saveList(list, false)"
                            >
                                <el-option
                                    v-for="(env, idx) in rcEnvOptions"
                                    :key="env.rcBaseUrl"
                                    :label="idx === 0 ? `${env.name}（默认）  (${env.rcBaseUrl})` : `${env.name}  (${env.rcBaseUrl})`"
                                    :value="env.rcBaseUrl"
                                />
                                <template v-if="rcEnvOptions.length === 0">
                                    <el-option disabled value="" label="暂无配置，请前往「接口配置」添加" />
                                </template>
                            </el-select>
                            <el-divider direction="vertical" />
                            <template v-if="globalSyncStatus.isAlive">
                                <el-icon color="var(--qa-pass)" size="13"><CircleCheck /></el-icon>
                                <span class="sync-status-on">服务运行中</span>
                                <span v-if="list._lastSyncAt" class="sync-time">上次同步：{{ list._lastSyncAt }}</span>
                            </template>
                            <template v-else>
                                <el-icon color="#E6A23C" size="13"><Warning /></el-icon>
                                <el-tooltip placement="top">
                                    <template #content>
                                        <div style="max-width:340px; line-height:1.8; font-size:12px;">
                                            <b>需在 terminal 持续运行对应环境的同步服务：</b><br />
                                            正式站：<code>python rc_sync_service.py</code><br />
                                            测试站：<code>python rc_sync_service.py --url https://rc-client.platform10.me</code><br />
                                            <span style="color:#bbb;">每个环境需单独运行一个进程，关闭 terminal 后同步服务停止</span>
                                        </div>
                                    </template>
                                    <span class="sync-status-off" style="cursor:help; text-decoration: underline dotted;">
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
                                <b>① 导入 Excel</b> — 从 RC 系统导出的告警文件批量导入<br />
                                <b>② 手工新增</b> — 手动录入单条记录<br />
                                <b>③ 风控自动同步</b> — 开启后自动从 RC 系统拉取数据
                            </div>
                        </div>
                    </div>

                    <!-- 统计栏 -->
                    <div v-if="list.records && list.records.length > 0" class="stats-bar"
                         :class="{ 'has-fail': getMatchCount(list).fail > 0 }">
                        <span class="stat-item">
                            共 <b>{{ list.records.length }}</b> 条记录
                        </span>
                        <el-divider direction="vertical" />
                        <span class="stat-item stat-pass">
                            <el-icon><CircleCheck /></el-icon>&nbsp;逻辑一致：<b>{{ getMatchCount(list).pass }}</b>
                        </span>
                        <el-divider direction="vertical" />
                        <span class="stat-item" :class="getMatchCount(list).fail > 0 ? 'stat-fail' : 'stat-ok'">
                            <el-icon><CircleClose /></el-icon>&nbsp;逻辑异常：<b>{{ getMatchCount(list).fail }}</b>
                        </span>
                        <el-tag v-if="getMatchCount(list).fail > 0" type="danger" effect="dark" size="small"
                            style="margin-left: 10px; cursor:pointer;"
                            @click="list._onlyMismatch = true; list._currentPage = 1">
                            ⚠ {{ getMatchCount(list).fail }} 条异常，点此只看异常
                        </el-tag>
                        <el-tag v-else-if="list.records.length > 0 && getMatchCount(list).pass > 0" type="success" effect="dark" size="small" style="margin-left: 10px;">
                            ✓ 逻辑全部一致
                        </el-tag>
                    </div>

                    <!-- 操作栏（批量操作 + 筛选 合并一行） -->
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
                            <el-button size="small"
                                :type="list._onlyMismatch ? 'danger' : ''"
                                :plain="!list._onlyMismatch"
                                :disabled="getMatchCount(list).fail === 0 && !list._onlyMismatch"
                                @click="list._onlyMismatch = !list._onlyMismatch; list._currentPage = 1">
                                <el-icon style="margin-right:3px;"><Warning /></el-icon>
                                {{ list._onlyMismatch ? '显示全部' : '只看异常' }}<template v-if="!list._onlyMismatch && getMatchCount(list).fail > 0"> ({{ getMatchCount(list).fail }})</template>
                            </el-button>
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
                            <slot name="filters" :list="list" />
                            <el-date-picker
                                v-model="list._dateRange"
                                type="datetimerange"
                                range-separator="至"
                                start-placeholder="开始时间"
                                end-placeholder="结束时间"
                                size="small"
                                style="width:380px;"
                                value-format="YYYY-MM-DD HH:mm:ss"
                                date-format="YYYY-MM-DD"
                                time-format="HH:mm"
                                :default-time="[new Date(2000,1,1,0,0,0), new Date(2000,1,1,23,59,59)]"
                                @change="list._currentPage = 1"
                                clearable
                            />
                            <span v-if="list._dateRange || list._rewardTypeFilter || list._onlyMismatch" class="filter-count">
                                {{ getFilteredRecords(list).length }} / {{ list.records.length }} 条
                            </span>
                        </div>
                    </div>

                    <!-- 数据表格 -->
                    <el-table
                        :ref="(el) => setTableRef(list, el)"
                        :data="getPagedRecords(list)"
                        border
                        style="width: 100%"
                        size="small"
                        :row-key="(row) => row.alertId || list.records.indexOf(row)"
                        :row-class-name="({ row }) => getRowClass(row, list.records.indexOf(row), list)"
                        @select="(sel, row) => onRowSelect(list, sel, row)"
                        @selection-change="(rows) => list._selectedRows = rows">

                        <el-table-column type="selection" width="40" fixed="left" reserve-selection />

                        <slot name="columns" :list="list" :getCfg="getCfg" :getCfgForRow="getCfgForRow" />
                    </el-table>

                    <!-- 分页（有数据时始终显示） -->
                    <div v-if="list.records.length > 0" class="pagination-bar">
                        <el-pagination
                            v-model:current-page="list._currentPage"
                            v-model:page-size="list._pageSize"
                            :page-sizes="[30, 50, 100, 200]"
                            :total="getFilteredRecords(list).length"
                            layout="total, sizes, prev, pager, next, jumper"
                            background
                            small
                            @size-change="list._currentPage = 1"
                        />
                        <!-- 手动输入每页条数 -->
                        <div class="page-size-custom">
                            <span class="page-size-label">自定义：</span>
                            <el-input-number
                                v-model="list._customPageSize"
                                :min="1" :max="9999" :controls="false"
                                size="small" style="width: 70px;"
                                placeholder="条数"
                            />
                            <el-button size="small" @click="applyCustomPageSize(list)">确定</el-button>
                        </div>
                    </div>
                </div><!-- /list-body -->
            </el-collapse-item>
        </el-collapse>

        <!-- Excel 导入时间范围弹窗 -->
        <el-dialog v-model="importDialogVisible" title="📥 选择导入时间范围" width="600px" :close-on-click-modal="false">
            <div class="import-info-box">
                <el-icon color="#409EFF" size="20"><InfoFilled /></el-icon>
                <div>
                    Excel 中共发现 <b style="color:#409EFF; font-size:16px;">{{ importRawExcelData.length }}</b> 条
                    <b>{{ pageTitle }}</b> 数据<br />
                    <span style="color: var(--qa-subtext-color); font-size:12px;">
                        数据时间跨度：{{ importDataTimeMin }} 至 {{ importDataTimeMax }}
                    </span>
                </div>
            </div>

            <el-divider style="margin: 16px 0;" />

            <el-form label-width="120px" style="margin-bottom: 8px;">
                <el-form-item label="选择导入范围">
                    <el-date-picker
                        v-model="importTimeRange"
                        type="datetimerange"
                        range-separator="至"
                        start-placeholder="开始时间"
                        end-placeholder="结束时间"
                        format="YYYY-MM-DD HH:mm:ss"
                        value-format="YYYY-MM-DD HH:mm:ss"
                        style="width: 100%"
                    />
                </el-form-item>
            </el-form>

            <div class="import-preview-count">
                <el-icon size="18" :color="importFilteredCount > 0 ? '#409EFF' : 'var(--qa-fail)'"><InfoFilled /></el-icon>
                <span>将导入</span>
                <b :style="{ color: importFilteredCount > 0 ? '#409EFF' : 'var(--qa-fail)', fontSize: '22px' }">
                    {{ importFilteredCount }}
                </b>
                <span>条数据</span>
                <el-tag v-if="importTimeRange && importFilteredCount < importRawExcelData.length" type="warning" size="small">
                    已过滤 {{ importRawExcelData.length - importFilteredCount }} 条
                </el-tag>
            </div>

            <template #footer>
                <el-button @click="importDialogVisible = false">取消</el-button>
                <el-button type="primary" :disabled="importFilteredCount === 0" @click="confirmImport">
                    确认导入 {{ importFilteredCount > 0 ? `(${importFilteredCount} 条)` : '' }}
                </el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import axios from 'axios'
import { ElNotification, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'
import { CircleCheck, CircleClose, Loading, Plus, Edit, Check, Upload, InfoFilled, Warning, DocumentAdd, ArrowDown } from '@element-plus/icons-vue'
import { useSyncManager } from '../composables/useSyncManager.js'
import { filterByTimeWindow } from '../logic/syncCore.js'
import { useAppStore } from '../stores/appStore.js'
import { filterByAlertType, getTimeRange } from '../logic/importMapper.js'

const props = defineProps({
    // ── descriptors ──────────────────────────────────────────────────────────
    typeId:        { type: Number, required: true },
    pageTitle:     { type: String, required: true },
    pageSubtitle:  { type: String, default: '' },
    listsApi:      { type: String, default: '/test-lists' },   // base path (without typeId)
    cacheTypeId:   { type: [Number, String], default: null },  // for /sync-cache/<id>; falls back to typeId
    configsTypeId: { type: [Number, String], default: null },  // for /configs/<id>; falls back to typeId
    importAlertType: { type: String, required: true },         // Excel alertType filter value
    multiConfig:   { type: Boolean, default: false },          // configIds[] vs configId
    typeColor:     { type: String, default: '#409EFF' },
    // ── pure-logic injection (page supplies, operating on full records) ────────
    newRecord:     { type: Function, required: true },         // () => blank record object
    getMatchCount: { type: Function, required: true },         // (list, configs) => { pass, fail }
    getRowClass:   { type: Function, required: true },         // (row, absIdx, list, configs) => cssClass
    mapSyncRecord: { type: Function, required: true },         // (item) => mapped record
    mapImportRow:  { type: Function, required: true },         // (excelRow) => mapped record
    // resolve linked config(s) for a list / a row (page owns matching logic).
    // configs = the shell-loaded availableConfigs array (passed in so the page stays decoupled).
    getCfgForList: { type: Function, required: true },         // (list, configs) => cfg|null
    getCfgForRow:  { type: Function, required: true },         // (list, row, configs) => cfg|null
    // optional extra display filter for getFilteredRecords (e.g. reward-type)
    extraFilter:   { type: Function, default: null },          // (list, record) => bool
    // optional sync record time-range filter override
    syncFilterRecords: { type: Function, default: null },      // (raw, list) => raw[]
    // optional record-preprocess hook run after import/sync insert (e.g. applyLastGgr)
    recordPreprocess: { type: Function, default: null },       // (records) => void (in-place)
    // optional extra per-list reactive fields merged into each decorated list (e.g. ignoreC2)
    listDefaults:  { type: Object, default: () => ({}) },
    // ── persistence overrides (default = promo /test-lists POST behavior) ──────
    // Override the cache-url builder (default = /sync-cache/<cacheTypeId>?url=…)
    getCacheUrl:   { type: Function, default: null },          // (list) => url
    // Override how lists are loaded (default = GET {listsApi}/{typeId})
    loadListsRequest: { type: Function, default: null },       // () => Promise<list[]>
    // Override how a list is persisted (default = POST {listsApi} with stripped payload)
    saveRequest:   { type: Function, default: null },          // (list, payload) => Promise
    // Override create (default = POST {listsApi} {typeId,listName,records:[]})
    createRequest: { type: Function, default: null },          // (listName) => Promise<rawList>
    // Override delete (default = DELETE {listsApi}/{id})
    deleteRequest: { type: Function, default: null },          // (id) => Promise
})

const API = import.meta.env.VITE_API_URL || '/api'
const cacheId = computed(() => props.cacheTypeId ?? props.typeId)

// useSyncManager reads store.qaConfig for pageSize / interval
const appStore = useAppStore()

// expose page-supplied resolvers under shell-local names (inject availableConfigs)
const getCfg = (list) => props.getCfgForList(list, availableConfigs.value)
const getCfgForRow = (list, row) => props.getCfgForRow(list, row, availableConfigs.value)
const getRowClass = (row, absIdx, list) => props.getRowClass(row, absIdx, list, availableConfigs.value)

// 性能：统计「一致/异常」是 O(n) 且模板里被调多次。用 computed 缓存——
// 只在记录 / 配置真正变化时才整体重算一次，一次渲染内的多次读取共享同一结果。
const _matchCounts = computed(() => {
    const m = {}
    for (const l of allLists.value) m[l._id] = props.getMatchCount(l, availableConfigs.value)
    return m
})
const getMatchCount = (list) => _matchCounts.value[list._id] || { pass: 0, fail: 0 }

// ─── State ────────────────────────────────────────────────────────────────────
const allLists = ref([]), activeLists = ref([]), availableConfigs = ref([])
const isPageLoading = ref(true)

// ─── 折叠面板状态持久化 ───────────────────────────────────────────────────────
const COLLAPSE_KEY = `rcs_collapse_${props.typeId}`
const saveCollapseState = (ids) => { try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(ids)) } catch {} }
const loadCollapseState = () => { try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || 'null') } catch { return null } }

// ─── 全局同步服务状态 / 配置 ─────────────────────────────────────────────────
const globalQAConfig = ref({ syncIntervalMin: 1, syncPageSize: 200, syncStartTime: null, syncEndTime: null })
const rcEnvOptions   = ref([])

const fetchQAConfig = async () => {
    try {
        const { data } = await axios.get(`${API}/qa-config`)
        globalQAConfig.value.syncIntervalMin = data.syncIntervalMin ?? 1
        globalQAConfig.value.syncPageSize    = data.syncPageSize    ?? 200
        globalQAConfig.value.syncStartTime   = data.syncStartTime   ?? null
        globalQAConfig.value.syncEndTime     = data.syncEndTime     ?? null
        rcEnvOptions.value = data.rcEnvs || []
    } catch { /* use defaults */ }
}

// ─── Sync composable ───────────────────────────────────────────────────────────
// 时间窗过滤走共享 syncCore（与 TestView 完全同一份逻辑）
const defaultSyncFilter = (raw, list) => filterByTimeWindow(raw, globalQAConfig.value, list)

const {
    globalSyncStatus, fetchSyncStatus, cooldownSec, startTick, stopTick, destroyAll,
    startAutoSync: _startAutoSync, stopAutoSync: _stopAutoSync, manualSync: _manualSync,
} = useSyncManager({
    getCacheUrl: list => props.getCacheUrl
        ? props.getCacheUrl(list)
        : `${API}/sync-cache/${cacheId.value}?url=${encodeURIComponent(list.rcBaseUrl || '')}`,
    filterRecords: (raw, list) => (props.syncFilterRecords || defaultSyncFilter)(raw, list),
    mapRecord: item => props.mapSyncRecord(item),
    onNewRecords: async (list) => {
        if (props.recordPreprocess) props.recordPreprocess(list.records)
        await saveList(list, false)
    },
})

// ─── 同步开关持久化 + 恢复 ─────────────────────────────────────────────────────
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

const startAutoSync = async (list) => {
    if (!list.rcBaseUrl) {
        list._syncEnabled = false
        ElNotification.warning({
            title: '请先选择 RC 地址',
            message: '必须为此列表选择对应的 RC 系统地址，才能开启风控自动同步',
            position: 'bottom-right', duration: 4000,
        })
        return
    }
    await fetchSyncStatus(list.rcBaseUrl)
    await _startAutoSync(list, saveList)
    saveSyncState(list)
}
const stopAutoSync = (list) => { _stopAutoSync(list, saveList); saveSyncState(list) }
const manualSync = async (list) => {
    await fetchSyncStatus(list.rcBaseUrl)
    await _manualSync(list)
}

// ─── 过滤 / 分页 ────────────────────────────────────────────────────────────────
// 某行是否「逻辑异常」：复用页面注入的 getRowClass（返回 'row-mismatch' 即异常），口径与表格高亮一致
const isMismatch = (list, row) =>
    getRowClass(row, list.records.indexOf(row), list) === 'row-mismatch'

const getFilteredRecords = (list) => {
    let rows = list.records
    if (list._dateRange && list._dateRange[0]) {
        const startMs = new Date(list._dateRange[0]).getTime()
        const endMs   = new Date(list._dateRange[1]).getTime()
        rows = rows.filter(r => {
            if (!r.alertTime) return false
            const t = new Date(r.alertTime).getTime()
            return t >= startMs && t <= endMs
        })
    }
    if (props.extraFilter) {
        rows = rows.filter(r => props.extraFilter(list, r))
    }
    if (list._onlyMismatch) {
        rows = rows.filter(r => isMismatch(list, r))
    }
    return rows
}

const getPagedRecords = (list) => {
    const filtered = getFilteredRecords(list)
    const start = (list._currentPage - 1) * list._pageSize
    return filtered.slice(start, start + list._pageSize)
}

// ── Shift 框选：勾一行后按住 Shift 勾另一行 → 中间整段一次性同步勾选/取消 ──────
const _shiftHeld = ref(false)
const _onShiftKey = (e) => { _shiftHeld.value = e.shiftKey }
const _tableRefs = {}
const setTableRef = (list, el) => { if (el) _tableRefs[list._id] = el; else delete _tableRefs[list._id] }
const onRowSelect = (list, selection, row) => {
    const paged = getPagedRecords(list)
    const idx = paged.indexOf(row)
    const nowSelected = selection.includes(row)
    if (_shiftHeld.value && list._lastSelIdx != null && list._lastSelIdx !== idx && idx >= 0) {
        const [a, b] = list._lastSelIdx < idx ? [list._lastSelIdx, idx] : [idx, list._lastSelIdx]
        const tbl = _tableRefs[list._id]
        for (let i = a; i <= b; i++) tbl?.toggleRowSelection(paged[i], nowSelected)
    }
    list._lastSelIdx = idx
}

const applyCustomPageSize = (list) => {
    const n = list._customPageSize
    if (!n || n < 1) return
    list._pageSize = Math.floor(n)
    list._currentPage = 1
    list._customPageSize = null
}

// ─── List CRUD + autosave ──────────────────────────────────────────────────────
const _saveTimers = new Map()

const saveList = async (list) => {
    list._saveState = 'saving'
    try {
        // eslint-disable-next-line no-unused-vars
        const { _tempName, _isSaving, _saveState, _savedAt, _autosaveOn,
                _currentPage, _pageSize, _customPageSize, _isEditingName,
                _selectedRows, _syncEnabled, _lastSyncAt, _lastSyncCount, _isSyncingNow,
                _dateRange, _rewardTypeFilter, _onlyMismatch, _isImportingSync, ...payload } = list
        if (props.multiConfig) {
            // 保留 configIds，并写回兼容旧字段 configId
            payload.configIds = list.configIds || []
            payload.configId  = (list.configIds && list.configIds[0]) || list.configId || null
        }
        if (props.saveRequest) {
            await props.saveRequest(list, payload)
        } else {
            await axios.post(`${API}${props.listsApi}`, payload)
        }
        list._saveState = 'idle'
        list._savedAt = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch (e) {
        list._saveState = 'error'
        console.error('[saveList] 保存失败:', e)
    }
}

const queueSave = (list) => {
    list._saveState = 'saving'
    clearTimeout(_saveTimers.get(list._id))
    _saveTimers.set(list._id, setTimeout(() => saveList(list), 700))
}

const attachAutoSave = (list) => {
    if (list._autosaveOn) return
    list._autosaveOn = true
    watch(
        () => [list.records, list.configIds, list.configId, list.rcBaseUrl, list.ignoreC2, list.syncStartTime, list.syncEndTime],
        () => queueSave(list),
        { deep: true }
    )
}

// 给新建/加载的列表挂上完整 UI 状态
const decorateList = (l) => ({
    ...l,
    configIds: props.multiConfig
        ? ((l.configIds && l.configIds.length) ? l.configIds : (l.configId ? [l.configId] : []))
        : l.configIds,
    _tempName: l.listName,
    _isSaving: false,
    _saveState: 'idle',
    _savedAt: null,
    _currentPage: 1,
    _pageSize: 30,
    _customPageSize: null,
    _selectedRows: [],
    _syncEnabled: false,
    _lastSyncAt: null,
    _lastSyncCount: 0,
    _isSyncingNow: false,
    _dateRange: null,
    _rewardTypeFilter: '',
    _onlyMismatch: false,
    _isEditingName: false,
    // page-specific extra fields (e.g. ignoreC2). Use existing value if present.
    ...Object.fromEntries(
        Object.entries(props.listDefaults).map(([k, v]) => [k, l[k] ?? v])
    ),
})

const addRow = (list) => {
    list.records.unshift(props.newRecord())
    list._currentPage = 1
}

const createNewList = () => ElMessageBox.prompt('为新列表起个名字，用于区分不同环境或场景', '新增列表', {
    confirmButtonText: '创建', cancelButtonText: '取消',
    inputPlaceholder: '例：测试站 / 正式站',
    inputValidator: v => v?.trim() ? true : '名称不能为空',
}).then(async ({ value }) => {
    const raw = props.createRequest
        ? await props.createRequest(value)
        : (await axios.post(`${API}${props.listsApi}`, { typeId: props.typeId, listName: value, records: [] })).data
    const fresh = decorateList(raw)
    allLists.value.push(fresh)
    attachAutoSave(allLists.value[allLists.value.length - 1])
    activeLists.value = [...activeLists.value, fresh._id]
}).catch(() => {})

const removeList = (id) => ElMessageBox.confirm('确定删除此列表？', '删除确认', {
    type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
}).then(async () => {
    const list = allLists.value.find(l => l._id === id)
    if (list) stopAutoSync(list)
    if (props.deleteRequest) await props.deleteRequest(id)
    else await axios.delete(`${API}${props.listsApi}/${id}`)
    allLists.value = allLists.value.filter(l => l._id !== id)
    ElNotification.success({ message: '列表已删除', position: 'bottom-right' })
})

const startEditName = (l) => l._isEditingName = true
const confirmEditName = (l) => { l.listName = l._tempName; l._isEditingName = false; saveList(l, false) }

// ─── 批量操作 ──────────────────────────────────────────────────────────────────
const bulkIgnore = (list) => {
    const sel = new Set(list._selectedRows)
    list.records.forEach(r => { if (sel.has(r)) r.ignored = true })
    list._selectedRows = []
}
const bulkRestore = (list) => {
    const sel = new Set(list._selectedRows)
    list.records.forEach(r => { if (sel.has(r)) r.ignored = false })
    list._selectedRows = []
}
const bulkDelete = async (list) => {
    if (!list._selectedRows.length) return
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

const allIgnore = async (list) => {
    try {
        await ElMessageBox.confirm(`确认忽略全部 ${list.records.length} 条记录？`, '一键忽略', {
            type: 'warning', confirmButtonText: '忽略全部', cancelButtonText: '取消'
        })
        list.records.forEach(r => { r.ignored = true })
    } catch { /* cancelled */ }
}
const allRestore = async (list) => {
    try {
        await ElMessageBox.confirm(`确认恢复全部 ${list.records.length} 条记录？`, '一键恢复', {
            type: 'info', confirmButtonText: '恢复全部', cancelButtonText: '取消'
        })
        list.records.forEach(r => { r.ignored = false })
    } catch { /* cancelled */ }
}
const allDelete = async (list) => {
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

// ─── Excel 导入 ─────────────────────────────────────────────────────────────────
const importDialogVisible = ref(false)
const importRawExcelData  = ref([])
const importTargetList    = ref(null)
const importTimeRange     = ref(null)

const importDataTimeMin = computed(() => importRawExcelData.value.length
    ? importRawExcelData.value.map(r => r.alertGeneratedTime || '').filter(Boolean).sort()[0] || ''
    : '')
const importDataTimeMax = computed(() => importRawExcelData.value.length
    ? [...importRawExcelData.value.map(r => r.alertGeneratedTime || '').filter(Boolean)].sort().at(-1) || ''
    : '')
const importFilteredCount = computed(() => {
    if (!importRawExcelData.value.length) return 0
    if (!importTimeRange.value?.[0] || !importTimeRange.value?.[1]) return importRawExcelData.value.length
    const s = new Date(importTimeRange.value[0]).getTime()
    const e = new Date(importTimeRange.value[1]).getTime()
    return importRawExcelData.value.filter(r => {
        const t = new Date(r.alertGeneratedTime).getTime()
        return !isNaN(t) && t >= s && t <= e
    }).length
})

const handleImportPreview = (file, list) => {
    const reader = new FileReader()
    reader.onload = (e) => {
        try {
            const wb = XLSX.read(e.target.result, { type: 'binary' })
            const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
            const filtered = filterByAlertType(json, props.importAlertType)
            if (filtered.length === 0) {
                return ElNotification.warning({
                    title: '没有匹配数据',
                    message: `Excel 中没有找到 alertType = "${props.importAlertType}" 的数据`,
                    position: 'bottom-right'
                })
            }
            const [minTime, maxTime] = getTimeRange(filtered)
            importRawExcelData.value  = filtered
            importTargetList.value    = list
            importTimeRange.value     = minTime && maxTime ? [minTime, maxTime] : null
            importDialogVisible.value = true
        } catch (err) {
            console.error(err)
            ElNotification.error({ title: '解析失败', message: 'Excel 读取失败，请确认文件格式正确', position: 'bottom-right' })
        }
    }
    reader.readAsBinaryString(file.raw)
}

const confirmImport = () => {
    const list = importTargetList.value
    if (!list) return
    let dataToImport = [...importRawExcelData.value]
    if (importTimeRange.value?.[0] && importTimeRange.value?.[1]) {
        const s = new Date(importTimeRange.value[0]).getTime()
        const e = new Date(importTimeRange.value[1]).getTime()
        dataToImport = dataToImport.filter(r => {
            const t = new Date(r.alertGeneratedTime).getTime()
            return !isNaN(t) && t >= s && t <= e
        })
    }
    const mapped = dataToImport.map(r => props.mapImportRow(r))
    list.records.unshift(...mapped)
    if (props.recordPreprocess) props.recordPreprocess(list.records)
    list._currentPage = 1
    ElNotification.success({ title: '导入成功', message: `成功导入 ${mapped.length} 条${props.pageTitle}数据`, position: 'bottom-right' })
    importDialogVisible.value = false
    importRawExcelData.value  = []
    importTargetList.value    = null
    importTimeRange.value     = null
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
    window.addEventListener('keydown', _onShiftKey)
    window.addEventListener('keyup', _onShiftKey)
    startTick()
    isPageLoading.value = true
    try {
        const configsId = props.configsTypeId ?? props.typeId
        const [cfg, listData] = await Promise.all([
            axios.get(`${API}/configs/${configsId}`),
            props.loadListsRequest
                ? props.loadListsRequest()
                : axios.get(`${API}${props.listsApi}/${props.typeId}`).then(r => r.data)
        ])
        availableConfigs.value = cfg.data
        allLists.value = listData.map(decorateList)
        allLists.value.forEach(attachAutoSave)

        // 清除失效的 configId（配置被删除但列表未更新时的兜底）
        if (!props.multiConfig) {
            const validIds = new Set(availableConfigs.value.map(c => String(c._id)))
            for (const l of allLists.value) {
                if (l.configId && !validIds.has(String(l.configId))) {
                    l.configId = null
                    saveList(l)
                }
            }
        }

        const savedCollapse = loadCollapseState()
        if (savedCollapse && savedCollapse.length > 0) {
            activeLists.value = savedCollapse.filter(id => allLists.value.some(l => l._id === id))
        }
        if (activeLists.value.length === 0 && allLists.value.length > 0) {
            activeLists.value = [allLists.value[0]._id]
        }

        await Promise.all([fetchSyncStatus(), fetchQAConfig(), appStore.loadQAConfig(), appStore.loadRcEnvs()])
        allLists.value.forEach(l => restoreSyncState(l))
    } finally {
        isPageLoading.value = false
    }
})

watch(activeLists, (ids) => saveCollapseState(ids), { deep: true })

onBeforeUnmount(() => {
    window.removeEventListener('keydown', _onShiftKey)
    window.removeEventListener('keyup', _onShiftKey)
    destroyAll(); stopTick()
})

// expose helpers the page may want
defineExpose({ saveList, availableConfigs, allLists })
</script>

<style scoped>
/* ── 页面骨架（与配置页统一）────────────────────────────────────────────── */
.test-page { display: flex; flex-direction: column; }
.page-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    margin-bottom: 18px;
}
.page-title    { margin: 0 0 3px; font-size: 20px; font-weight: 700; color: var(--qa-heading-color); }
.page-subtitle { margin: 0; font-size: 13px; color: var(--qa-subtext-color); }
.loading-wrap  { background: #fff; border: 1px solid #ebeef5; border-radius: 12px; padding: 24px; box-shadow: var(--qa-shadow-xs); }

/* ── 列表卡片头部 ───────────────────────────────────────────────────────── */
.list-head { display: flex; align-items: center; width: 100%; gap: 8px; padding-right: 16px; }
.list-head .save-status { margin-right: 4px; }
.list-dot  { width: 8px; height: 8px; border-radius: 50%; background: var(--type-color, #409EFF); flex-shrink: 0; }
.list-name { font-weight: 700; color: var(--qa-heading-color); font-size: 14px; }
.edit-icon { padding: 2px; }
.list-badge { flex-shrink: 0; }
.list-head-spacer { flex: 1; }
.save-status { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: #909399; }

/* ── 列表卡片内容 ───────────────────────────────────────────────────────── */
.list-body { padding: 4px 2px 2px; }
.setting-row {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    padding: 4px 0 14px;
}
/* setting-label lives inside #config slot content → :deep so it styles slotted markup */
:deep(.setting-label) { font-size: 13px; font-weight: 500; color: #4e5969; }
.setting-row-spacer { flex: 1; }
/* 让 导入/手工新增/删除 间距、高度一致：去掉 Element 相邻按钮的额外 margin，间距只靠 gap */
.setting-row :deep(.el-button + .el-button) { margin-left: 0; }
/* el-upload 盒子默认基线偏高，钉成 small 按钮高度(24px)并居中，与旁边按钮对齐 */
.setting-row :deep(.el-upload),
.setting-row :deep(.el-upload--text) {
    display: inline-flex; align-items: center; height: 24px; line-height: 1;
}
.sync-time-fields { display: inline-flex; align-items: center; gap: 6px; }
.sync-time-sep { color: #909399; font-size: 12px; }

.stats-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    margin-bottom: 12px;
    background: var(--qa-stats-pass-bg);
    border: 1px solid var(--qa-stats-pass-border);
    border-radius: 10px;
    font-size: 13px;
}
.stats-bar.has-fail {
    background: var(--qa-stats-fail-bg);
    border-color: var(--qa-stats-fail-border);
}
.stat-item { display: inline-flex; align-items: center; gap: 4px; line-height: 1; }
.stat-item :deep(.el-icon) { font-size: 14px; }
.stat-pass { color: var(--qa-pass); }
.stat-fail { color: var(--qa-fail); font-weight: bold; }
.stat-ok   { color: var(--qa-neutral); }

/* tip-header lives inside #columns slot content → use :deep so it styles slotted markup */
:deep(.tip-header) {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    cursor: help;
    border-bottom: 1px dashed var(--qa-tooltip-border);
    padding-bottom: 1px;
    white-space: nowrap;
}

.action-bar {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 8px 12px; margin-bottom: 10px;
    background: #fafbfc; border: 1px solid #ebeef5;
    border-radius: 10px; font-size: 13px; flex-wrap: wrap;
}
.action-bar-left  { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.action-bar-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.filter-count { font-size: 12px; color: #909399; white-space: nowrap; }
/* filter-label lives inside #filters slot content */
:deep(.filter-label) { font-size: 12px; color: #909399; white-space: nowrap; }
.bulk-count { color: #606266; }
.shift-hint { font-size: 12px; color: #c0c4cc; }

.pagination-bar {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
    padding: 4px 0;
}
.page-size-custom { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
.page-size-label { font-size: 12px; color: var(--qa-subtext-color); white-space: nowrap; }

.import-info-box {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    background: var(--qa-import-info-bg);
    border-radius: 8px;
    font-size: 14px;
    line-height: 1.8;
}
.import-preview-count {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--qa-import-preview-bg);
    border-radius: 6px;
    font-size: 14px;
    color: #606266;
}

/* ── 同步控制栏 ─────────────────────────────────────────────────────────────── */
.sync-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    margin-bottom: 14px;
    background: #fafbfc;
    border: 1px solid #ebeef5;
    border-radius: 10px;
    font-size: 13px;
    gap: 12px;
    flex-wrap: wrap;
}
.sync-bar-active {
    background: #f6ffed;
    border-color: var(--qa-stats-pass-border);
}
.sync-bar-left  { display: flex; align-items: center; gap: 10px; }
.sync-bar-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

.sync-toggle-label { font-size: 13px; color: #606266; }
.sync-toggle-label.label-on { color: var(--qa-pass); font-weight: 600; }

.sync-cfg-hint {
    font-size: 12px;
    color: var(--qa-subtext-color);
    background: #f0f2f5;
    padding: 2px 8px;
    border-radius: 10px;
    cursor: default;
    white-space: nowrap;
}

.sync-status-on  { color: var(--qa-pass); }
.sync-status-off { color: #E6A23C; }
.sync-time { color: var(--qa-subtext-color); margin-left: 6px; }
.sync-url-label {
    font-size: 12px;
    color: var(--qa-subtext-color);
    white-space: nowrap;
    cursor: help;
}

:deep(.row-mismatch) { background-color: var(--qa-row-mismatch-bg) !important; }
:deep(.row-mismatch:hover > td.el-table__cell) { background-color: var(--qa-row-mismatch-hover) !important; }

/* ── 空列表引导 ──────────────────────────────────────────────────────────────── */
.empty-list-hint {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 24px 20px;
    margin-bottom: 12px;
    background: #fafafa;
    border: 1px dashed #dcdfe6;
    border-radius: 8px;
    color: #909399;
}
.empty-hint-title { font-size: 14px; font-weight: 600; color: #606266; margin-bottom: 6px; }
.empty-hint-actions { font-size: 13px; line-height: 1.9; color: #909399; }
.empty-hint-actions b { color: #409EFF; }

:deep(.row-ignored) { background-color: var(--qa-row-ignored-bg) !important; opacity: 0.55; }
:deep(.row-ignored:hover > td.el-table__cell) { background-color: var(--qa-row-ignored-bg) !important; }

/* field-missing lives inside #columns slot content */
:deep(.field-missing) {
    color: #E6A23C;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
}

/* ── 列表卡片（collapse 当作独立白卡，与配置页一致）─────────────────────── */
.list-collapse { border: none; }
:deep(.list-collapse .el-collapse-item) {
    border: 1px solid #ebeef5;
    border-radius: 12px;
    margin-bottom: 16px;
    overflow: hidden;
    box-shadow: var(--qa-shadow-xs);
    background: #fff;
}
:deep(.list-collapse .el-collapse-item__header) {
    height: 54px;
    padding: 0 20px;
    font-size: 14px;
    border-bottom: 1px solid transparent;
    transition: background 0.15s;
}
:deep(.list-collapse .el-collapse-item__header:hover) { background: #fafbfc; }
:deep(.list-collapse .el-collapse-item__header.is-active) {
    border-bottom-color: #f0f2f5;
}
:deep(.list-collapse .el-collapse-item__wrap) { border-top: none; }
:deep(.list-collapse .el-collapse-item__content) { padding: 16px 20px 20px; }
</style>
