<template>
    <div style="display:flex;flex-direction:column;gap:20px;">
        <el-card shadow="hover" class="main-card">
            <template #header>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <h2 style="margin:0 0 2px;font-size:22px;color:var(--qa-heading-color);">游戏盈利(CG)告警检查</h2>
                        <p style="margin:0;font-size:13px;color:var(--qa-subtext-color);">
                            验证 allGameProfitAlerts（game-profit）COLORGAME 的普通告警与连续告警逻辑
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
                            </template>

                        </div>
                    </template>

                    <!-- 控制栏 -->
                    <div class="control-panel">
                        <div class="panel-left">
                            <span class="cfg-label">关联配置：</span>
                            <el-select
                                v-model="list.configId"
                                size="small"
                                style="width:180px;"
                                placeholder="请选择配置"
                                clearable
                                @change="saveList(list, false)"
                            >
                                <el-option
                                    v-for="c in availableConfigs"
                                    :key="c._id"
                                    :label="c.name"
                                    :value="c._id"
                                />
                                <template v-if="availableConfigs.length === 0">
                                    <el-option disabled value="" label="暂无配置，请前往「告警配置」添加" />
                                </template>
                            </el-select>
                            <el-popover v-if="_cfg(list)" placement="bottom-start" trigger="hover" :width="260">
                                <template #reference>
                                    <el-icon size="14" color="#409EFF" style="cursor:help;margin-left:4px;vertical-align:middle;"><InfoFilled /></el-icon>
                                </template>
                                <div style="font-size:13px;line-height:2;">
                                    <div><b>告警阈值 X：</b>{{ getX(_cfg(list)) }}</div>
                                    <div><b>连续告警阈值 Y：</b>{{ getY(_cfg(list)) }}%</div>
                                    <div><b>检查间隔：</b>{{ getAlertInterval(_cfg(list)) }} 分钟</div>
                                </div>
                            </el-popover>
                            <el-divider direction="vertical" style="margin:0 8px;" />
                            <el-tooltip placement="top">
                                <template #content>
                                    <div style="line-height:1.8;max-width:260px;">
                                        <b>关闭（默认）：</b>普通告警 = C1 AND C2，连续告警 = C1 AND C2 AND C3<br/>
                                        <b>开启：</b>普通告警 = 仅C1，连续告警 = C1 AND C3（忽略条件2）
                                    </div>
                                </template>
                                <span class="cfg-label" style="cursor:help;">忽略条件2&nbsp;<el-icon size="11" style="vertical-align:middle;"><InfoFilled /></el-icon></span>
                            </el-tooltip>
                            <el-switch
                                v-model="list.ignoreC2"
                                size="small"
                                active-color="#E6A23C"
                                @change="saveList(list, false)"
                            />
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
                                    <div style="max-width:240px;line-height:1.7;">
                                        在「配置 → 质检配置」中可修改间隔和抓取数量。<br />
                                        <span style="color:#bbb;font-size:11px;">修改后重启此列表的同步开关即可生效</span>
                                    </div>
                                </template>
                                <span class="sync-cfg-hint">
                                    每 {{ globalQAConfig.syncIntervalMin }} 分钟 · 抓 {{ globalQAConfig.syncPageSize }} 条
                                </span>
                            </el-tooltip>
                            <el-tooltip placement="bottom"
                                :content="globalQAConfig.syncStartTime ? '已在质检配置中设定，子页面不支持修改' : '只导入告警时间 ≥ 此时间的数据，留空 = 不过滤'">
                                <span style="display:inline-block;">
                                <el-date-picker
                                    v-model="list.syncStartTime"
                                    type="datetime"
                                    :placeholder="globalQAConfig.syncStartTime ? '' : '起始时间（选填）'"
                                    format="MM-DD HH:mm"
                                    value-format="YYYY-MM-DD HH:mm:ss"
                                    style="width:140px;"
                                    size="small"
                                    clearable
                                    :disabled="!!globalQAConfig.syncStartTime"
                                    :model-value="globalQAConfig.syncStartTime || list.syncStartTime"
                                    @update:model-value="v => { if (!globalQAConfig.syncStartTime) { list.syncStartTime = v; saveList(list, false) } }"
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
                                    size="small" plain
                                    :loading="list._isSyncingNow"
                                    :disabled="!globalSyncStatus.isAlive || cooldownSec(list.rcBaseUrl) > 0"
                                    @click="manualSync(list)"
                                >
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
                                placeholder="请选择 RC 地址（开启同步必填）"
                                @change="saveList(list, false)">
                                <el-option v-for="(env, idx) in rcEnvOptions" :key="env.rcBaseUrl"
                                    :label="idx === 0 ? `${env.name}（默认）  (${env.rcBaseUrl})` : `${env.name}  (${env.rcBaseUrl})`"
                                    :value="env.rcBaseUrl" />
                                <template v-if="rcEnvOptions.length === 0">
                                    <el-option disabled value="" label="暂无配置，请前往「接口配置」添加" />
                                </template>
                            </el-select>
                            <el-divider direction="vertical" />
                            <template v-if="globalSyncStatus.isAlive">
                                <el-icon color="var(--qa-pass)" size="13"><CircleCheck /></el-icon>
                                <span class="sync-status-on">服务运行中</span>
                                <span v-if="list._lastSyncAt" class="sync-time">上次同步：{{ list._lastSyncAt }}，新增 {{ list._lastSyncCount }} 条</span>
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
                                <b>① 导入 Excel</b> — 从 RC 系统导出的告警文件批量导入<br />
                                <b>② 手工新增</b> — 手动录入单条记录<br />
                                <b>③ 风控自动同步</b> — 开启后自动从 RC 系统拉取数据
                            </div>
                        </div>
                    </div>

                    <!-- 统计栏 -->
                    <div v-if="list.records && list.records.length > 0" class="stats-bar"
                        :class="{ 'has-fail': getMatchCount(list).fail > 0 }">
                        <span class="stat-item">共 <b>{{ list.records.length }}</b> 条记录</span>
                        <el-divider direction="vertical" />
                        <span class="stat-item stat-pass">
                            <el-icon><CircleCheck /></el-icon>&nbsp;逻辑一致：<b>{{ getMatchCount(list).pass }}</b>
                        </span>
                        <el-divider direction="vertical" />
                        <span class="stat-item" :class="getMatchCount(list).fail > 0 ? 'stat-fail' : 'stat-ok'">
                            <el-icon><CircleClose /></el-icon>&nbsp;逻辑异常：<b>{{ getMatchCount(list).fail }}</b>
                        </span>
                        <el-tag v-if="getMatchCount(list).fail > 0" type="danger" effect="dark" size="small" style="margin-left:10px;">
                            ⚠ {{ getMatchCount(list).fail }} 条异常，请检查高亮行
                        </el-tag>
                        <el-tag v-else-if="list.records.length > 0 && getMatchCount(list).pass > 0" type="success" effect="dark" size="small" style="margin-left:10px;">
                            ✓ 逻辑全部一致
                        </el-tag>
                    </div>

                    <!-- 操作栏（批量操作 + 日期筛选 合并一行） -->
                    <div v-if="list.records && list.records.length > 0" class="action-bar">

                        <!-- 左：批量操作下拉 + 已选操作 -->
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

                        <!-- 右：时间范围筛选 -->
                        <div class="action-bar-right">
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
                            <span v-if="list._dateRange" class="filter-count">
                                {{ getFilteredRecords(list).length }} / {{ list.records.length }} 条
                            </span>
                        </div>
                    </div>

                    <!-- 数据表格 -->
                    <div class="table-scroll-wrapper">
                    <el-table
                        :data="getPagedRecords(list)"
                        border
                        style="width:100%"
                        size="small"
                        :row-key="(row) => row.alertId || list.records.indexOf(row)"
                        :row-class-name="(scope) => getRowClass(scope, list)"
                        @selection-change="(rows) => list._selectedRows = rows"
                    >
                        <el-table-column type="selection" width="40" fixed="left" reserve-selection />

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
                                <el-input-number v-model="row.currentBet" :controls="false" size="small" style="width:100%" />
                            </template>
                        </el-table-column>

                        <el-table-column label="投注中位数" min-width="115">
                            <template #default="{ row }">
                                <el-input-number v-model="row.betMedian" :controls="false" size="small" style="width:100%" />
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
                                <el-input-number v-model="row.currentGgr" :controls="false" size="small" style="width:100%" />
                            </template>
                        </el-table-column>

                        <el-table-column label="上次GGR" min-width="130">
                            <template #default="{ row }">
                                <el-input-number v-model="row.lastGgr" :controls="false" size="small" style="width:100%" />
                            </template>
                        </el-table-column>

                        <el-table-column label="投注笔数" min-width="115">
                            <template #default="{ row }">
                                <el-input-number v-model="row.currentBetCount" :controls="false" size="small" style="width:100%" />
                            </template>
                        </el-table-column>

                        <el-table-column label="平均投注笔数" min-width="120">
                            <template #default="{ row }">
                                <el-input-number v-model="row.avgBetCount" :controls="false" size="small" style="width:100%" />
                            </template>
                        </el-table-column>

                        <!-- 普通告警结果 -->
                        <el-table-column width="115" align="center">
                            <template #header>
                                <el-tooltip placement="top">
                                    <template #content>
                                        <div style="line-height:1.8;">
                                            普通告警结果 = C1 AND C2<br />
                                            C1：当前RTP − 30日均RTP &lt; {{ getX(_cfg(list)) }}（告警阈值X）<br />
                                            C2：Current Bet ≥ Bet Median
                                        </div>
                                    </template>
                                    <span class="tip-header">普通告警结果&nbsp;<el-icon size="11"><InfoFilled /></el-icon></span>
                                </el-tooltip>
                            </template>
                            <template #default="{ row }">
                                <el-tag :type="calcNormalW(row, list) === 'TRUE' ? 'success' : 'danger'" size="small">
                                    {{ calcNormalW(row, list) }}
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
                                            C3：Last GGR − Current GGR ≥ |Last GGR| × {{ getY(_cfg(list)) }}%（连续阈值Y）<br />
                                            <span style="color:#bbb;font-size:12px;">时间差 ≥ {{ getAlertInterval(_cfg(list)) }} 分钟 → 不检查连续告警，显示 -</span>
                                        </div>
                                    </template>
                                    <span class="tip-header">连续告警结果&nbsp;<el-icon size="11"><InfoFilled /></el-icon></span>
                                </el-tooltip>
                            </template>
                            <template #default="{ row }">
                                <span v-if="calcContW(row, list) === '-'" style="color:var(--qa-neutral);">—</span>
                                <el-tag v-else :type="calcContW(row, list) === 'TRUE' ? 'success' : 'danger'" size="small">
                                    {{ calcContW(row, list) }}
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
                                    <el-tag v-if="isMatchW(row, list)" type="success" size="small">✓ 一致</el-tag>
                                    <el-tag v-else type="danger" size="small">✗ 异常</el-tag>
                                </template>
                                <el-tag v-else type="info" size="small">待判断</el-tag>
                            </template>
                        </el-table-column>

                        <!-- 操作 -->
                        <el-table-column label="操作" width="112" align="center" fixed="right">
                            <template #default="{ row, $index }">
                                <el-button size="small" link
                                    :type="row.ignored ? 'primary' : 'warning'"
                                    @click="toggleIgnore(row, list)">
                                    {{ row.ignored ? '取消忽略' : '忽略' }}
                                </el-button>
                                <el-button size="small" link type="danger"
                                    @click="deleteRow(list, $index)">删除</el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                    </div>

                    <!-- 分页 -->
                    <div class="pagination-bar">
                        <el-pagination
                            v-model:current-page="list._currentPage"
                            v-model:page-size="list._pageSize"
                            :page-sizes="[30, 50, 100, 200]"
                            :total="getFilteredRecords(list).length"
                            layout="total, sizes, prev, pager, next, jumper"
                            background
                        />
                    </div>

                </el-collapse-item>
            </el-collapse>
        </el-card>
    </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import {
    getX, getY, getAlertInterval, calcNormal, calcCont, isMatch,
    getMatchCount as _getMatchCount, getRowClass as _getRowClass, applyLastGgr
} from '../logic/gameProfitLogic.js'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { ElNotification, ElMessageBox } from 'element-plus'
import {
    Plus, Edit, Check, Upload, DocumentAdd, InfoFilled,
    CircleCheck, CircleClose, Warning, Timer, ArrowDown, Loading
} from '@element-plus/icons-vue'

const API = 'http://localhost:3000/api'

// ── 关联配置列表（typeId=8）────────────────────────────────────────────────────
const availableConfigs = ref([])
const loadAvailableConfigs = async () => {
    try {
        const { data } = await axios.get(`${API}/configs/8`)
        availableConfigs.value = data
    } catch {}
}

// getX / getY 从 gameProfitLogic.js 导入，接受 cfg 对象（非 list）

// ── QA 全局配置 ────────────────────────────────────────────────────────────────
const globalQAConfig = ref({ syncIntervalMin: 1, syncPageSize: 200, syncStartTime: null })
const loadQAConfig = async () => {
    try {
        const { data } = await axios.get(`${API}/qa-config`)
        globalQAConfig.value = data
    } catch {}
}

// ── RC 环境列表 ───────────────────────────────────────────────────────────────
const rcEnvOptions = ref([])
const loadRcEnvs = async () => {
    try { const { data } = await axios.get(`${API}/qa-config`); rcEnvOptions.value = data.rcEnvs || [] }
    catch {}
}

// ── 同步服务状态 ──────────────────────────────────────────────────────────────
const globalSyncStatus = ref({ isAlive: false })
const fetchSyncStatus = async (rcBaseUrl = '') => {
    try {
        const params = rcBaseUrl ? { url: rcBaseUrl } : {}
        const { data } = await axios.get(`${API}/sync-status`, { params })
        globalSyncStatus.value = data
    } catch {
        globalSyncStatus.value = { isAlive: false }
    }
}

// ── 冷却倒计时 ────────────────────────────────────────────────────────────────
const COOLDOWN_MS = 30_000
const _cooldownMap = reactive({})   // url → startTimestamp
const _tick = ref(0)
let _tickTimer = null

const markCooldown  = url => { _cooldownMap[url || ''] = Date.now() }
const cooldownSec   = url => {
    _tick.value  // reactive dependency
    const start = _cooldownMap[url || '']
    if (!start) return 0
    const elapsed = Date.now() - start
    return elapsed >= COOLDOWN_MS ? 0 : Math.ceil((COOLDOWN_MS - elapsed) / 1000)
}

// ── 折叠面板状态持久化 ─────────────────────────────────────────────────────────
const COLLAPSE_KEY = 'gp_collapse'
const activeLists  = ref([])
const saveCollapseState = ids => { try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(ids)) } catch {} }
const loadCollapseState = ()  => { try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || 'null') } catch { return null } }
watch(activeLists, ids => saveCollapseState(ids), { deep: true })

// ── 同步开关持久化 ─────────────────────────────────────────────────────────────
const SYNC_KEY = id => `gp_sync_${id}`
const saveSyncState    = list => { try { localStorage.setItem(SYNC_KEY(list._id), JSON.stringify({ enabled: list._syncEnabled })) } catch {} }
const restoreSyncState = list => {
    try {
        const raw = localStorage.getItem(SYNC_KEY(list._id))
        if (!raw) return
        const { enabled } = JSON.parse(raw)
        if (enabled && list.rcBaseUrl) { list._syncEnabled = true; startAutoSync(list, true) }
    } catch {}
}

// ── 列表初始化 ────────────────────────────────────────────────────────────────
const isPageLoading = ref(false)
const allLists = ref([])
const syncTimers = new Map()

const initList = l => Object.assign(l, {
    _tempName:      l.listName,
    _isEditingName: false,
    _isSaving:      false,
    _saveState:     'idle',
    _savedAt:       null,
    _currentPage:   1,
    _pageSize:      30,
    _selectedRows:  [],
    _syncEnabled:   false,
    _isSyncingNow:  false,
    _lastSyncAt:    null,
    _lastSyncCount: 0,
    _dateRange:     null,
    ignoreC2:       l.ignoreC2 ?? false,
})

const loadLists = async () => {
    isPageLoading.value = true
    try {
        const { data } = await axios.get(`${API}/game-profit-lists`)
        allLists.value = data.map(l => {
            const list = initList(l)
            // 重新推导 prevAlertTime（兼容旧数据，DB 中此字段可能为空）
            if (list.records?.length) applyLastGgr(list.records)
            return list
        })
        const saved = loadCollapseState()
        activeLists.value = saved || allLists.value.slice(0, 1).map(l => l._id)
        allLists.value.forEach(attachAutoSave)
        allLists.value.forEach(restoreSyncState)
    } catch {} finally { isPageLoading.value = false }
}

const createNewList = () => {
    ElMessageBox.prompt('输入列表名称', '新增列表', {
        confirmButtonText: '创建', cancelButtonText: '取消',
        inputPlaceholder: '例：测试站 COLORGAME'
    }).then(async ({ value }) => {
        if (!value?.trim()) return
        const { data } = await axios.post(`${API}/game-profit-lists`, { listName: value.trim(), rcBaseUrl: '', records: [] })
        allLists.value.push(initList(data))
        attachAutoSave(allLists.value[allLists.value.length - 1])
        activeLists.value = [...activeLists.value, data._id]
    }).catch(() => {})
}

const removeList = id => ElMessageBox.confirm('确定删除此列表？', '删除确认', {
    type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
}).then(async () => {
    const list = allLists.value.find(l => l._id === id)
    if (list) stopAutoSync(list)
    await axios.delete(`${API}/game-profit-lists/${id}`)
    allLists.value = allLists.value.filter(l => l._id !== id)
    ElNotification.success({ message: '列表已删除', position: 'bottom-right' })
}).catch(() => {})

// ── 自动保存：列表数据/配置一变就存，带状态反馈，无需手动点保存 ────────────────
const _saveTimers = new Map()

const saveList = async (list) => {
    list._saveState = 'saving'
    try {
        await axios.put(`${API}/game-profit-lists/${list._id}`, {
            listName: list.listName,
            rcBaseUrl: list.rcBaseUrl,
            configId: list.configId || null,
            ignoreC2: list.ignoreC2 ?? false,
            records: list.records.map(r => ({
                alertId: r.alertId, alertTime: r.alertTime,
                currentBet: r.currentBet, betMedian: r.betMedian,
                currentRtp: r.currentRtp, avgRtp: r.avgRtp,
                rtpDeviation: r.rtpDeviation,
                currentGgr: r.currentGgr, lastGgr: r.lastGgr,
                prevAlertTime: r.prevAlertTime || '',
                currentBetCount: r.currentBetCount, avgBetCount: r.avgBetCount,
                devResult: r.devResult, ignored: r.ignored,
            }))
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

/** 给列表挂自动保存监听：records / 关联配置 / RC地址 / 忽略条件2 / 起始时间 任一变化即存 */
const attachAutoSave = (list) => {
    if (list._autosaveOn) return
    list._autosaveOn = true
    watch(
        () => [list.records, list.configId, list.rcBaseUrl, list.ignoreC2, list.syncStartTime],
        () => queueSave(list),
        { deep: true }
    )
}

const startEditName    = l => { l._tempName = l.listName; l._isEditingName = true }
const confirmEditName  = l => { l.listName = l._tempName; l._isEditingName = false; saveList(l, false) }

// ── 告警逻辑计算（实现在 logic/gameProfitLogic.js）────────────────────────────
const _cfg = list => availableConfigs.value.find(c => c._id === list.configId)

const calcNormalW = (row, list) => calcNormal(row, getX(_cfg(list)), list.ignoreC2)
const calcContW   = (row, list) => calcCont(row, getX(_cfg(list)), getY(_cfg(list)), getAlertInterval(_cfg(list)), list.ignoreC2)
const isMatchW    = (row, list) => isMatch(row, getX(_cfg(list)), list.ignoreC2)

const getMatchCount = list => _getMatchCount(list.records, getX(_cfg(list)), list.ignoreC2)
const getRowClass   = ({ row }, list) => _getRowClass(row, getX(_cfg(list)), list.ignoreC2)

// ── 表格辅助 ──────────────────────────────────────────────────────────────────
const fmt2 = v => (v != null && v !== '') ? Number(v).toFixed(2) : '—'
const fmtN = v => (v != null && v !== '') ? Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : '—'

const getFilteredRecords = list => {
    if (!list._dateRange || !list._dateRange[0]) return list.records
    const [start, end] = list._dateRange
    const startMs = new Date(start).getTime()
    const endMs   = new Date(end).getTime()
    return list.records.filter(r => {
        if (!r.alertTime) return false
        const t = new Date(r.alertTime).getTime()
        return t >= startMs && t <= endMs
    })
}

const getPagedRecords = list => {
    const filtered = getFilteredRecords(list)
    const start = (list._currentPage - 1) * list._pageSize
    return filtered.slice(start, start + list._pageSize)
}

const addRow = list => {
    list.records.unshift({
        alertId: '', alertTime: '',
        currentBet: 0, betMedian: 0,
        currentRtp: 0, avgRtp: 0, rtpDeviation: 0,
        currentGgr: 0, lastGgr: 0, prevAlertTime: '',
        currentBetCount: 0, avgBetCount: 0,
        devResult: '', ignored: false
    })
    list._currentPage = 1
}

const toggleIgnore = (row, list) => { row.ignored = !row.ignored; saveList(list, false) }
const deleteRow    = (list, pageIndex) => {
    const start = (list._currentPage - 1) * list._pageSize
    list.records.splice(start + pageIndex, 1)
}

// ── 批量操作 ──────────────────────────────────────────────────────────────────
const bulkIgnore  = list => { const sel = new Set(list._selectedRows); list.records.forEach(r => { if (sel.has(r)) r.ignored = true  }); list._selectedRows = [] }
const bulkRestore = list => { const sel = new Set(list._selectedRows); list.records.forEach(r => { if (sel.has(r)) r.ignored = false }); list._selectedRows = [] }
const bulkDelete  = async list => {
    if (!list._selectedRows.length) return
    try {
        await ElMessageBox.confirm(`确认删除选中的 ${list._selectedRows.length} 条记录？`, '批量删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
        const sel = new Set(list._selectedRows)
        list.records = list.records.filter(r => !sel.has(r))
        list._selectedRows = []
    } catch {}
}
const allIgnore = async list => {
    try { await ElMessageBox.confirm(`确认忽略全部 ${list.records.length} 条记录？`, '一键忽略', { type: 'warning', confirmButtonText: '忽略全部', cancelButtonText: '取消' }); list.records.forEach(r => { r.ignored = true }) } catch {}
}
const allRestore = async list => {
    try { await ElMessageBox.confirm(`确认恢复全部 ${list.records.length} 条记录？`, '一键恢复', { type: 'info', confirmButtonText: '恢复全部', cancelButtonText: '取消' }); list.records.forEach(r => { r.ignored = false }) } catch {}
}
const allDelete = async list => {
    try {
        await ElMessageBox.confirm(`确认删除全部 ${list.records.length} 条记录？此操作不可撤销。`, '一键删除', { type: 'warning', confirmButtonText: '删除全部', cancelButtonText: '取消' })
        list.records = []; list._selectedRows = []; list._currentPage = 1
        await saveList(list, false)
        ElNotification.success({ message: '全部记录已删除', position: 'bottom-right' })
    } catch {}
}

// applyLastGgr 从 gameProfitLogic.js 导入

// ── 导入 Excel ────────────────────────────────────────────────────────────────
const handleImport = (file, list) => {
    const reader = new FileReader()
    reader.onload = async e => {
        try {
            const wb  = XLSX.read(e.target.result, { type: 'binary' })
            const ws  = wb.Sheets[wb.SheetNames[0]]
            const raw = XLSX.utils.sheet_to_json(ws, { defval: '' })
            const rows = raw
                .filter(r => (r['alertType'] === 'game-profit' || !r['alertType'])
                           && (r['target'] || '').toUpperCase() === 'COLORGAME')
                .map(r => {
                    const num = k => { const v = r[`meta.${k}`] ?? r[k] ?? ''; return v === '' ? 0 : Number(v) }
                    const trend = (r['alertTrend'] || '').toLowerCase()
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
                })
                .filter(r => r.alertId)
            if (!rows.length) {
                ElNotification.warning({ message: 'Excel 中没有找到 game-profit 数据', position: 'bottom-right' }); return
            }
            const existed = new Set(list.records.map(r => r.alertId))
            const newOnes = rows.filter(r => !existed.has(r.alertId))
            if (!newOnes.length) {
                ElNotification.info({ message: `${rows.length} 条数据已全部存在，无需重复导入`, position: 'bottom-right' }); return
            }
            list.records.unshift(...newOnes)
            applyLastGgr(list.records)
            list._currentPage = 1
            await saveList(list, false)
            ElNotification.success({ message: `导入成功，新增 ${newOnes.length} 条`, position: 'bottom-right' })
        } catch (err) {
            ElNotification.error({ message: `导入失败: ${err.message}`, position: 'bottom-right' })
        }
    }
    reader.readAsBinaryString(file.raw)
}

// ── 自动同步 ──────────────────────────────────────────────────────────────────
/**
 * @param {boolean} isManual    true = 手动触发
 * @param {boolean} skipRequest true = 跳过 request-sync，直接读缓存（页面恢复时用）
 */
const runSync = async (list, isManual = false, skipRequest = false) => {
    if (list._isSyncingNow) return
    list._isSyncingNow = true
    try {
        let waitMs = 0
        if (!skipRequest) {
            const syncResp = await axios.post(`${API}/request-sync`, { pageSize: globalQAConfig.value.syncPageSize || 200, rcBaseUrl: list.rcBaseUrl || '' })
            if (!syncResp.data?.skipped) {
                markCooldown(list.rcBaseUrl || '')
                waitMs = 15000   // 游戏盈利数据量大，需要等更长时间
            }
            // skipped → waitMs 保持 0，直接读缓存（不 return）
        }
        if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs))

        let fetched = [], rawCount = 0, gameProfitCount = 0
        const maxAttempts = skipRequest ? 3 : 12
        const retryDelay  = skipRequest ? 500 : 5000
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const url = list.rcBaseUrl ? `${API}/game-profit-cache?url=${encodeURIComponent(list.rcBaseUrl)}` : `${API}/game-profit-cache`
            const { data } = await axios.get(url)
            const allRaw = data.data || []
            rawCount = data.totalRaw ?? allRaw.length
            const all = allRaw.filter(item =>
                (item.alertType || '').toLowerCase().replace(/_/g, '-') === 'game-profit'
            )
            gameProfitCount = all.length
            fetched = all.filter(item => (item.target || '').toUpperCase() === 'COLORGAME')
            if (fetched.length > 0 || attempt === maxAttempts - 1) break
            await new Promise(r => setTimeout(r, retryDelay))
        }

        // 起始时间过滤（用 alertGeneratedTime 字段）
        const startTime = globalQAConfig.value.syncStartTime || list.syncStartTime
        if (startTime) {
            const cutoff = new Date(startTime).getTime()
            fetched = fetched.filter(item => {
                const t = new Date(item.alertGeneratedTime).getTime()
                return !isNaN(t) && t >= cutoff
            })
        }

        const existedIds = new Set(list.records.map(r => r.alertId).filter(Boolean))
        const newOnes = fetched
            .map(item => {
                const meta  = item.alertMetadata || {}
                const trend = (item.alertTrend || '').toLowerCase()
                const num   = k => meta[k] ?? item[k] ?? 0
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
            })
            .filter(r => r.alertId && !existedIds.has(r.alertId))

        list._lastSyncAt = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

        if (newOnes.length > 0) {
            list.records.unshift(...newOnes)
            applyLastGgr(list.records)
            list._currentPage = 1
            await saveList(list, false)
            ElNotification.success({ title: `游戏盈利(CG) · ${list.listName}`, message: `${isManual ? '手动' : '自动'}同步：新增 ${newOnes.length} 条（已保存）`, position: 'bottom-right', duration: 4000 })
            list._lastSyncCount = newOnes.length
        } else {
            if (rawCount === 0 && isManual) {
                ElNotification.warning({ title: '暂无数据', message: '缓存为空，请确认 rc_sync_service.py 正在运行', position: 'bottom-right', duration: 5000 })
            } else if (fetched.length === 0 && gameProfitCount === 0 && rawCount > 0) {
                ElNotification.warning({ title: '无匹配数据', message: `缓存共 ${rawCount} 条，但无 game-profit 类型数据。请查看浏览器控制台确认 alertType 字段值。`, position: 'bottom-right', duration: 8000 })
            } else if (fetched.length === 0 && gameProfitCount > 0) {
                ElNotification.warning({ title: '无 COLORGAME 数据', message: `game-profit 共 ${gameProfitCount} 条，但全部非 COLORGAME（target 字段不匹配）。请查看控制台确认 target 字段值。`, position: 'bottom-right', duration: 8000 })
            } else if (isManual && fetched.length > 0) {
                ElNotification.info({ message: `COLORGAME ${fetched.length} 条，已全部在列表中（无新增）`, position: 'bottom-right', duration: 3000 })
            }
        }
        await fetchSyncStatus()
    } catch (e) {
        console.error('Sync error:', e)
    } finally {
        list._isSyncingNow = false
    }
}

const startAutoSync = async (list, fromRestore = false) => {
    if (!list.rcBaseUrl) {
        list._syncEnabled = false
        ElNotification.warning({ title: '请先选择 RC 地址', message: '必须为此列表选择对应的 RC 系统地址，才能开启风控自动同步', position: 'bottom-right', duration: 4000 })
        return
    }
    stopAutoSync(list)
    saveSyncState(list)
    await fetchSyncStatus()
    if (!fromRestore) {
        ElNotification.info({ message: '正在进行首次同步，请稍候…', position: 'bottom-right', duration: 3000 })
    }
    // fromRestore=true → skipRequest=true：直接读缓存，不重新触发 request-sync，无 15s 等待
    await runSync(list, false, fromRestore)
    const ms = (globalQAConfig.value.syncIntervalMin || 1) * 60 * 1000
    syncTimers.set(list._id, setInterval(() => runSync(list), ms))
}

const stopAutoSync = list => {
    if (syncTimers.has(list._id)) { clearInterval(syncTimers.get(list._id)); syncTimers.delete(list._id) }
    saveSyncState(list)
}

const manualSync = async list => { await fetchSyncStatus(); await runSync(list, true) }

// ── 生命周期 ──────────────────────────────────────────────────────────────────
onMounted(async () => {
    _tickTimer = setInterval(() => { _tick.value++ }, 1000)
    await Promise.all([loadAvailableConfigs(), loadQAConfig(), loadRcEnvs(), loadLists()])

    // 清除失效的 configId（配置被删除但列表未更新时的兜底）
    const validIds = new Set(availableConfigs.value.map(c => String(c._id)))
    for (const list of allLists.value) {
        if (list.configId && !validIds.has(String(list.configId))) {
            list.configId = null
            axios.put(`${API}/game-profit-lists/${list._id}`, { configId: null }).catch(() => {})
        }
    }

    await fetchSyncStatus()
})
onBeforeUnmount(() => {
    syncTimers.forEach(id => clearInterval(id))
    syncTimers.clear()
    if (_tickTimer) clearInterval(_tickTimer)
})
</script>

<style scoped>
.main-card { border-radius: 8px; }

.header-title-wrapper { display: flex; align-items: center; width: 100%; gap: 6px; padding-right: 12px; }
.header-title { font-weight: 700; color: var(--qa-heading-color); font-size: 14px; }
.edit-icon { opacity: 0.4; transition: opacity 0.2s; }
.header-title-wrapper:hover .edit-icon { opacity: 1; }

/* ── 列表状态 badge ──────────────────────────────────────────────────────── */
.list-status-badge {
    display: inline-flex; align-items: center;
    font-size: 11px; font-weight: 600;
    padding: 2px 10px; border-radius: 20px;
    white-space: nowrap; flex-shrink: 0;
}
.badge-fail  { background: #fff1f0; color: #ff4d4f; border: 1px solid #ffa39e; }
.badge-empty { background: #f5f5f5; color: #bfbfbf; border: 1px solid #e8eaed; font-weight: 400; }

.control-panel {
    background: var(--qa-control-panel-bg);
    padding: 15px;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}
.panel-left  { display: flex; align-items: center; gap: 8px; }
.panel-right { display: flex; gap: 8px; }
.cfg-label   { font-size: 13px; color: #606266; white-space: nowrap; }

/* ── 同步控制栏 ─────────────────────────────────────────────────────────────── */
.sync-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 14px; margin-bottom: 12px;
    background: #f8f9fa; border: 1px solid #e4e7ed;
    border-radius: 6px; font-size: 13px; gap: 12px;
}
.sync-bar-active { background: #f0f9eb; border-color: var(--qa-stats-pass-border); }
.sync-bar-left  { display: flex; align-items: center; gap: 10px; }
.sync-bar-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.sync-toggle-label { font-size: 13px; color: #606266; }
.sync-toggle-label.label-on { color: var(--qa-pass); font-weight: 600; }
.sync-cfg-hint { font-size: 12px; color: var(--qa-subtext-color); background: #f0f2f5; padding: 2px 8px; border-radius: 10px; cursor: default; white-space: nowrap; }
.sync-status-on  { color: var(--qa-pass); }
.sync-status-off { color: #E6A23C; }
.sync-time { color: var(--qa-subtext-color); margin-left: 6px; }
.sync-url-label { font-size: 12px; color: var(--qa-subtext-color); white-space: nowrap; cursor: help; }

/* ── 统计栏 ─────────────────────────────────────────────────────────────────── */
.stats-bar {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 14px; margin-bottom: 12px;
    background: var(--qa-stats-pass-bg); border: 1px solid var(--qa-stats-pass-border);
    border-radius: 6px; font-size: 13px;
}
.stats-bar.has-fail { background: var(--qa-stats-fail-bg); border-color: var(--qa-stats-fail-border); }
.stat-item  { display: flex; align-items: center; gap: 3px; }
.stat-pass  { color: var(--qa-pass); }
.stat-fail  { color: var(--qa-fail); font-weight: bold; }
.stat-ok    { color: var(--qa-neutral); }

/* ── 操作栏（批量操作 + 时间筛选 合并一行） ─────────────────────────────────── */
.action-bar {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 6px 10px; margin-bottom: 6px;
    background: #f7f8fa; border: 1px solid #eaecef;
    border-radius: 6px; font-size: 13px; flex-wrap: wrap;
}
.action-bar-left  { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.action-bar-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.bulk-label { color: #909399; font-size: 12px; }
.bulk-count { color: #606266; }
.filter-count { font-size: 12px; color: var(--qa-subtext-color); white-space: nowrap; }

/* ── 空列表引导 ─────────────────────────────────────────────────────────────── */
.empty-list-hint {
    display: flex; align-items: flex-start; gap: 16px;
    padding: 24px 20px; margin-bottom: 12px;
    background: #fafafa; border: 1px dashed #dcdfe6;
    border-radius: 8px; color: #909399;
}
.empty-hint-title   { font-size: 14px; font-weight: 600; color: #606266; margin-bottom: 6px; }
.empty-hint-actions { font-size: 13px; line-height: 1.9; color: #909399; }
.empty-hint-actions b { color: #409EFF; }

/* ── 分页 ───────────────────────────────────────────────────────────────────── */
.pagination-bar { display: flex; justify-content: flex-end; margin-top: 12px; padding: 4px 0; }

/* ── 表头提示 ─────────────────────────────────────────────────────────────── */
.tip-header {
    display: inline-flex; align-items: center; gap: 3px;
    cursor: help; border-bottom: 1px dashed var(--qa-tooltip-border);
    padding-bottom: 1px; white-space: nowrap;
}

/* ── 日期筛选栏 ──────────────────────────────────────────────────────────────── */
/* .date-filter-bar merged into .action-bar */

/* ── 水平滚动包装器 ──────────────────────────────────────────────────────────── */
.table-scroll-wrapper {
    position: relative;
    overflow-x: auto;
}
.table-scroll-wrapper::after {
    content: '';
    position: absolute;
    top: 0; right: 0; bottom: 17px; /* leave space for scrollbar */
    width: 40px;
    pointer-events: none;
    background: linear-gradient(to right, transparent, rgba(255,255,255,0.85));
    z-index: 2;
    border-radius: 0 4px 0 0;
}

/* ── 行状态 ─────────────────────────────────────────────────────────────────── */
:deep(.row-mismatch) { background-color: var(--qa-row-mismatch-bg) !important; }
:deep(.row-mismatch:hover > td.el-table__cell) { background-color: var(--qa-row-mismatch-hover) !important; }
:deep(.row-ignored) { background-color: var(--qa-row-ignored-bg) !important; opacity: 0.55; }
:deep(.row-ignored:hover > td.el-table__cell) { background-color: var(--qa-row-ignored-bg) !important; }
</style>
