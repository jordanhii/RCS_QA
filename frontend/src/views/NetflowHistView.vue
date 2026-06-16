<template>
    <div style="display: flex; flex-direction: column; gap: 20px;">
        <el-card shadow="hover" class="main-card">
            <template #header>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h2 style="margin:0 0 2px; font-size:22px; color: var(--qa-heading-color);">存提差同比</h2>
                        <p style="margin:0;font-size:13px;color:var(--qa-subtext-color);">校验当日累计存提差与历史同期（昨日 / 上周 / 上月）的告警逻辑</p>
                    </div>
                    <el-button type="primary" @click="createNewList" size="large">
                        <el-icon style="margin-right: 5px;"><Plus /></el-icon> 新增列表
                    </el-button>
                </div>
            </template>
            <div v-if="isPageLoading" style="padding: 30px;">
                <el-skeleton :rows="8" animated />
            </div>
            <el-empty v-else-if="allLists.length === 0" description="暂无测试列表" />
            <el-collapse v-else v-model="activeLists" class="custom-collapse">
                <el-collapse-item v-for="list in allLists" :key="list._id" :name="list._id">
                    <template #title>
                        <div class="header-title-wrapper">
                            <span style="font-size: 18px; margin-right: 8px;">📋</span>
                            <template v-if="!list._isEditingName">
                                <span class="header-title">{{ list.listName }}</span>
                                <el-button link type="primary" class="edit-icon" @click.stop="startEditName(list)">
                                    <el-icon><Edit /></el-icon>
                                </el-button>
                            </template>
                            <template v-else>
                                <el-input v-model="list._tempName" size="small" style="width: 250px;" @click.stop
                                    @keyup.enter.stop="confirmEditName(list)" placeholder="输入列表名称" />
                                <el-button type="success" size="small" circle style="margin-left: 8px;"
                                    @click.stop="confirmEditName(list)">
                                    <el-icon><Check /></el-icon>
                                </el-button>
                            </template>
                        </div>
                    </template>

                    <!-- 控制栏 -->
                    <div class="control-panel">
                        <div class="panel-left">
                            <span style="font-weight: 600;">关联配置:</span>
                            <el-select v-model="list.configId" placeholder="选择配置" style="width: 220px"
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
                                :on-change="(file) => handleImportPreview(file, list)">
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
                                    <div style="max-width:240px; line-height:1.7;">
                                        在「配置 → 质检配置」中可修改间隔和抓取数量。<br />
                                        <span style="color:#bbb; font-size:11px;">修改后重启此列表的同步开关即可生效</span>
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
                                    size="small"
                                    plain
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
                                    v-for="env in rcEnvOptions"
                                    :key="env.rcBaseUrl"
                                    :label="`${env.name}  (${env.rcBaseUrl})`"
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
                        <el-tag v-if="getMatchCount(list).fail > 0" type="danger" effect="dark" size="small" style="margin-left: 10px;">
                            ⚠ {{ getMatchCount(list).fail }} 条异常，请检查高亮行
                        </el-tag>
                        <el-tag v-else-if="list.records.length > 0 && getMatchCount(list).pass > 0" type="success" effect="dark" size="small" style="margin-left: 10px;">
                            ✓ 逻辑全部一致
                        </el-tag>
                    </div>

                    <!-- 操作栏 -->
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
                    <el-table
                        :data="getPagedRecords(list)"
                        border
                        style="width: 100%"
                        size="small"
                        :row-key="(row) => row.alertId || list.records.indexOf(row)"
                        :row-class-name="({ row }) => getRowClassName(list.records.indexOf(row), list.records, getCfg(list))"
                        @selection-change="(rows) => list._selectedRows = rows">

                        <el-table-column type="selection" width="40" fixed="left" reserve-selection />

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
                                <el-input-number v-model="scope.row.val1" :controls="false" size="small" style="width:100%" placeholder="未抓到" />
                            </template>
                        </el-table-column>

                        <!-- 4. 存款额 -->
                        <el-table-column label="存款额" min-width="100">
                            <template #default="scope">
                                <el-input-number v-model="scope.row.depositAmount" :controls="false" size="small" style="width:100%" placeholder="未抓到" />
                            </template>
                        </el-table-column>

                        <!-- 5. 提款额 -->
                        <el-table-column label="提款额" min-width="100">
                            <template #default="scope">
                                <el-input-number v-model="scope.row.withdrawalAmount" :controls="false" size="small" style="width:100%" placeholder="未抓到" />
                            </template>
                        </el-table-column>

                        <!-- 6. 昨日-存提差 -->
                        <el-table-column label="昨日-存提差" min-width="120">
                            <template #default="scope">
                                <el-input-number v-model="scope.row.historicalYesterday" :controls="false" size="small" style="width:100%" placeholder="未抓到" />
                            </template>
                        </el-table-column>

                        <!-- 7. 上周-存提差 -->
                        <el-table-column label="上周-存提差" min-width="120">
                            <template #default="scope">
                                <el-input-number v-model="scope.row.historicalLastWeek" :controls="false" size="small" style="width:100%" placeholder="未抓到" />
                            </template>
                        </el-table-column>

                        <!-- 8. 上月-存提差 -->
                        <el-table-column label="上月-存提差" min-width="120">
                            <template #default="scope">
                                <el-input-number v-model="scope.row.historicalLastMonth" :controls="false" size="small" style="width:100%" placeholder="未抓到" />
                            </template>
                        </el-table-column>

                        <!-- ── RC 系统判断 组 ────────────────────────────── -->
                        <el-table-column label="RC 系统判断" align="center">
                        <!-- 9. < 昨日 (RC) -->
                        <el-table-column label="< 昨日" min-width="80" align="center">
                            <template #default="scope">
                                <span v-if="scope.row.lowerThanYesterday === null" class="field-missing">⚠</span>
                                <el-tag v-else :type="scope.row.lowerThanYesterday?.toLowerCase() === 'true' ? 'success' : 'danger'" size="small">
                                    {{ scope.row.lowerThanYesterday?.toLowerCase() === 'true' ? 'TRUE' : 'FALSE' }}
                                </el-tag>
                            </template>
                        </el-table-column>

                        <!-- 10. < 上周同天 (RC) -->
                        <el-table-column label="< 上周同天" min-width="90" align="center">
                            <template #default="scope">
                                <span v-if="scope.row.lowerThanLastWeek === null" class="field-missing">⚠</span>
                                <el-tag v-else :type="scope.row.lowerThanLastWeek?.toLowerCase() === 'true' ? 'success' : 'danger'" size="small">
                                    {{ scope.row.lowerThanLastWeek?.toLowerCase() === 'true' ? 'TRUE' : 'FALSE' }}
                                </el-tag>
                            </template>
                        </el-table-column>

                        <!-- 11. < 上月同天 (RC) -->
                        <el-table-column label="< 上月同天" min-width="90" align="center">
                            <template #default="scope">
                                <span v-if="scope.row.lowerThanLastMonth === null" class="field-missing">⚠</span>
                                <el-tag v-else :type="scope.row.lowerThanLastMonth?.toLowerCase() === 'true' ? 'success' : 'danger'" size="small">
                                    {{ scope.row.lowerThanLastMonth?.toLowerCase() === 'true' ? 'TRUE' : 'FALSE' }}
                                </el-tag>
                            </template>
                        </el-table-column>
                        </el-table-column>

                        <!-- ── RCSQA 自算 组（用抓到的数据自算，与左侧 RC 判断对照）──── -->
                        <el-table-column label="RCSQA 自算" align="center">
                        <!-- 12. < 昨日（RCSQA） -->
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

                        <!-- 13. < 上周同天（RCSQA） -->
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

                        <!-- 14. < 上月同天（RCSQA） -->
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

                        <!-- 15. 告警结果 -->
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

                        <!-- 16. 风控系统判断 -->
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

                        <!-- 17. 逻辑一致 -->
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

                        <!-- 18. 操作 -->
                        <el-table-column label="操作" width="110" align="center" fixed="right">
                            <template #default="scope">
                                <el-button
                                    :type="scope.row.ignored ? 'info' : 'warning'"
                                    link
                                    @click="scope.row.ignored = !scope.row.ignored; saveList(list, false)">
                                    {{ scope.row.ignored ? '恢复' : '忽略' }}
                                </el-button>
                                <el-button type="danger" link
                                    @click="removeRecord(list, list.records.indexOf(scope.row))">
                                    删除
                                </el-button>
                            </template>
                        </el-table-column>
                    </el-table>

                    <!-- 分页 -->
                    <div v-if="list.records.length > 0" class="pagination-bar">
                        <el-pagination
                            v-model:current-page="list._currentPage"
                            v-model:page-size="list._pageSize"
                            :page-sizes="[30, 50, 100, 200, 500, 1000]"
                            :total="getFilteredRecords(list).length"
                            layout="total, sizes, prev, pager, next, jumper"
                            background
                            @size-change="list._currentPage = 1"
                        />
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
                </el-collapse-item>
            </el-collapse>
        </el-card>

        <!-- Excel 导入时间范围弹窗 -->
        <el-dialog v-model="importDialogVisible" title="📥 选择导入时间范围" width="600px" :close-on-click-modal="false">
            <div class="import-info-box">
                <el-icon color="#409EFF" size="20"><InfoFilled /></el-icon>
                <div>
                    Excel 中共发现 <b style="color:#409EFF; font-size:16px;">{{ importRawExcelData.length }}</b> 条
                    <b>存提差同比</b> 数据<br />
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
import { ref, computed, onMounted, onBeforeUnmount, shallowRef, watch } from 'vue'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { ElNotification, ElMessageBox } from 'element-plus'
import { CircleCheck, CircleClose, Loading, Plus, Edit, Check, Upload, InfoFilled, Warning, DocumentAdd, ArrowDown } from '@element-plus/icons-vue'
import { filterByAlertType, getTimeRange, mapExcelRows } from '../logic/importMapper.js'

import {
    calcLowerThan,
    calcNormalResult,
    calcLogicMatch,
    getMatchCount as histGetMatchCount,
    getRowClass as histGetRowClass,
} from '../logic/netflowHistLogic.js'

const TYPE_ID = 10
const API = 'http://localhost:3000/api'

const allLists = ref([]), activeLists = ref([]), availableConfigs = ref([])
const isPageLoading = ref(true)

const COLLAPSE_KEY = `rcs_collapse_${TYPE_ID}`
const saveCollapseState = (ids) => {
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(ids)) } catch {}
}
const loadCollapseState = () => {
    try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || 'null') } catch { return null }
}

const globalSyncStatus = ref({ isAlive: false, updatedAt: null, transactionCount: 0, betCount: 0 })
const globalQAConfig   = ref({ syncIntervalMin: 1, syncPageSize: 200, syncStartTime: null })
const rcEnvOptions     = ref([])
const syncTimers    = new Map()
const cooldownEnds  = new Map()
const COOLDOWN_MS   = 30_000
const _tick         = shallowRef(0)
let   _tickTimer    = null

const cooldownSec = (url) => {
    void _tick.value
    const exp = cooldownEnds.get((url || '').trim().toLowerCase().replace(/\/+$/, '') || 'default')
    if (!exp) return 0
    return Math.max(0, Math.ceil((exp - Date.now()) / 1000))
}
const markCooldown = (url) => {
    const key = (url || '').trim().toLowerCase().replace(/\/+$/, '') || 'default'
    cooldownEnds.set(key, Date.now() + COOLDOWN_MS)
}

const fetchQAConfig = async () => {
    try {
        const { data } = await axios.get(`${API}/qa-config`)
        globalQAConfig.value.syncIntervalMin = data.syncIntervalMin ?? 1
        globalQAConfig.value.syncPageSize    = data.syncPageSize    ?? 200
        globalQAConfig.value.syncStartTime   = data.syncStartTime   ?? null
        rcEnvOptions.value = data.rcEnvs || []
    } catch { /* use defaults */ }
}

const SYNC_STORAGE_KEY = (id) => `rcs_sync_${id}`
const saveSyncState = (list) => {
    try { localStorage.setItem(SYNC_STORAGE_KEY(list._id), JSON.stringify({ enabled: list._syncEnabled })) } catch {}
}
const restoreSyncState = (list) => {
    try {
        const raw = localStorage.getItem(SYNC_STORAGE_KEY(list._id))
        if (!raw) return
        const { enabled } = JSON.parse(raw)
        if (!enabled || !list.rcBaseUrl) return
        list._syncEnabled = true
        startAutoSync(list, true)
    } catch {}
}

const fetchSyncStatus = async (rcBaseUrl = '') => {
    try {
        const params = rcBaseUrl ? { url: rcBaseUrl } : {}
        const { data } = await axios.get(`${API}/sync-status`, { params })
        globalSyncStatus.value = data
    } catch {
        globalSyncStatus.value = { isAlive: false, updatedAt: null, transactionCount: 0, betCount: 0 }
    }
}

const runSync = async (list, isManual = false, skipRequest = false) => {
    if (list._isSyncingNow) return
    list._isSyncingNow = true
    try {
        let waitMs = 0
        if (!skipRequest) {
            const syncResp = await axios.post(`${API}/request-sync`, {
                pageSize:  globalQAConfig.value.syncPageSize || 200,
                rcBaseUrl: list.rcBaseUrl || ''
            })
            if (!syncResp.data?.skipped) {
                markCooldown(list.rcBaseUrl || '')
                waitMs = 8000
            }
        }
        let fetched = [], rawCount = 0
        if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs))
        for (let attempt = 0; attempt < 5; attempt++) {
            const res = await axios.get(`${API}/sync-cache/${TYPE_ID}`, {
                params: { url: list.rcBaseUrl || '' }
            })
            fetched  = res.data.data     || []
            rawCount = res.data.totalRaw ?? 0
            if (fetched.length > 0 || attempt === 4) break
            await new Promise(r => setTimeout(r, skipRequest ? 500 : 3000))
        }
        const startTime = globalQAConfig.value.syncStartTime || list.syncStartTime
        if (startTime) {
            const cutoff = new Date(startTime).getTime()
            fetched = fetched.filter(r => {
                const t = new Date(r.alertTime).getTime()
                return !isNaN(t) && t >= cutoff
            })
        }
        const existingIds = new Set(list.records.map(r => r.alertId?.toString().trim()).filter(Boolean))
        const newOnes = fetched.filter(r => {
            const fid = r.alertId?.toString().trim()
            return !fid || !existingIds.has(fid)
        })
        list._lastSyncAt = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        if (newOnes.length > 0) {
            list.records.unshift(...newOnes)
            list._currentPage = 1
            await saveList(list, false)
            ElNotification.success({
                title: `存提差同比 · ${list.listName}`,
                message: `${isManual ? '手动' : '自动'}同步：新增 ${newOnes.length} 条（已保存）`,
                position: 'bottom-right', duration: 4000
            })
        } else {
            if (rawCount === 0 && isManual) {
                ElNotification.warning({ title: '暂无数据', message: '缓存为空，请确认 rc_sync_service.py 正在运行，并已完成登录', position: 'bottom-right', duration: 5000 })
            } else if (fetched.length === 0 && rawCount > 0) {
                ElNotification.warning({ title: `存提差同比 · ${list.listName} — 无匹配数据`, message: `缓存共 ${rawCount} 条原始数据，但无匹配当前告警类型的记录。`, position: 'bottom-right', duration: 7000 })
            } else if (isManual && fetched.length > 0) {
                ElNotification.info({ title: `存提差同比 · ${list.listName}`, message: `拉取到 ${fetched.length} 条，已全部在列表中（无新增）`, position: 'bottom-right', duration: 3000 })
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
    await runSync(list, false, fromRestore)
    const ms = (globalQAConfig.value.syncIntervalMin || 1) * 60 * 1000
    const id = setInterval(() => runSync(list), ms)
    syncTimers.set(list._id, id)
}

const stopAutoSync = (list) => {
    if (syncTimers.has(list._id)) {
        clearInterval(syncTimers.get(list._id))
        syncTimers.delete(list._id)
    }
    saveSyncState(list)
}

const manualSync = async (list) => {
    await fetchSyncStatus()
    await runSync(list, true)
}

// ─── Excel import ────────────────────────────────────────────────────────────
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
            const filtered = filterByAlertType(json, 'netflow-additional-historical')
            if (filtered.length === 0) {
                return ElNotification.warning({
                    title: '没有匹配数据',
                    message: 'Excel 中没有找到 alertType = "netflow-additional-historical" 的数据',
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
    const mapped = mapExcelRows(dataToImport, TYPE_ID)
    list.records.unshift(...mapped)
    list._currentPage = 1
    ElNotification.success({ title: '导入成功', message: `成功导入 ${mapped.length} 条存提差同比数据`, position: 'bottom-right' })
    importDialogVisible.value = false
    importRawExcelData.value  = []
    importTargetList.value    = null
    importTimeRange.value     = null
}

onBeforeUnmount(() => {
    syncTimers.forEach(id => clearInterval(id))
    syncTimers.clear()
    if (_tickTimer) clearInterval(_tickTimer)
})

onMounted(async () => {
    _tickTimer = setInterval(() => { _tick.value++ }, 1000)
    isPageLoading.value = true
    try {
        const [cfg, list] = await Promise.all([
            axios.get(`${API}/configs/${TYPE_ID}`),
            axios.get(`${API}/test-lists/${TYPE_ID}`)
        ])
        availableConfigs.value = cfg.data
        allLists.value = list.data.map(l => ({
            ...l,
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
            _isSyncingNow: false,
            _isImportingSync: false, /* keep for saveList destructure compat */
            _dateRange: null,
            _isEditingName: false,
        }))
        allLists.value.forEach(attachAutoSave)
        const savedCollapse = loadCollapseState()
        if (savedCollapse && savedCollapse.length > 0) {
            activeLists.value = savedCollapse.filter(id => allLists.value.some(l => l._id === id))
        }
        if (activeLists.value.length === 0 && allLists.value.length > 0) {
            activeLists.value = [allLists.value[0]._id]
        }
        const validIds = new Set(availableConfigs.value.map(c => String(c._id)))
        for (const l of allLists.value) {
            if (l.configId && !validIds.has(String(l.configId))) {
                l.configId = null
                axios.post(`${API}/test-lists`, { _id: l._id, typeId: TYPE_ID, configId: null }).catch(() => {})
            }
        }
        await Promise.all([fetchSyncStatus(), fetchQAConfig()])
        allLists.value.forEach(l => restoreSyncState(l))
    } finally {
        isPageLoading.value = false
    }
})

watch(activeLists, (ids) => saveCollapseState(ids), { deep: true })

const getFilteredRecords = (list) => {
    if (!list._dateRange || !list._dateRange[0]) return list.records
    const startMs = new Date(list._dateRange[0]).getTime()
    const endMs   = new Date(list._dateRange[1]).getTime()
    return list.records.filter(r => {
        if (!r.alertTime) return false
        const t = new Date(r.alertTime).getTime()
        return t >= startMs && t <= endMs
    })
}

const getPagedRecords = (list) => {
    const filtered = getFilteredRecords(list)
    const start = (list._currentPage - 1) * list._pageSize
    return filtered.slice(start, start + list._pageSize)
}

const removeRecord = (list, absIdx) => {
    ElMessageBox.confirm('确定删除此条记录？', '删除确认', {
        type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
    }).then(() => {
        list.records.splice(absIdx, 1)
        const maxPage = Math.max(1, Math.ceil(list.records.length / list._pageSize))
        if (list._currentPage > maxPage) list._currentPage = maxPage
    }).catch(() => {})
}

const getMatchCount = (list) => histGetMatchCount(list.records, getCfg(list))

const getRowClassName = (absIdx, records, cfg) => histGetRowClass(absIdx, records, cfg)

const getCfg = (list) => availableConfigs.value.find(c => c._id === list.configId)

// ── 自动保存：列表数据/配置一变就存，带状态反馈，无需手动点保存 ────────────────
const _saveTimers = new Map()

const saveList = async (list) => {
    list._saveState = 'saving'
    try {
        // eslint-disable-next-line no-unused-vars
        const { _tempName, _isSaving, _saveState, _savedAt, _autosaveOn,
                _currentPage, _pageSize, _customPageSize, _isEditingName,
                _selectedRows, _syncEnabled, _lastSyncAt, _isSyncingNow, _isImportingSync,
                _dateRange, ...payload } = list
        await axios.post(`${API}/test-lists`, payload)
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
        () => [list.records, list.configId, list.rcBaseUrl, list.syncStartTime],
        () => queueSave(list),
        { deep: true }
    )
}

const addRow = (list) => {
    list.records.unshift({
        alertId: '', alertTime: '',
        val1: 0, depositAmount: 0, withdrawalAmount: 0,
        historicalYesterday: 0, historicalLastWeek: 0, historicalLastMonth: 0,
        lowerThanYesterday: null, lowerThanLastWeek: null, lowerThanLastMonth: null,
        devResult: '', ignored: false,
    })
    list._currentPage = 1
}

const createNewList = () => ElMessageBox.prompt('为新列表起个名字，用于区分不同环境或场景', '新增列表', {
    confirmButtonText: '创建', cancelButtonText: '取消',
    inputPlaceholder: '例：测试站 / 正式站',
    inputValidator: v => v?.trim() ? true : '名称不能为空',
}).then(async ({ value }) => {
    const res = await axios.post(`${API}/test-lists`, { typeId: TYPE_ID, listName: value, records: [] })
    allLists.value.push({
        ...res.data, _tempName: res.data.listName,
        _isSaving: false, _saveState: 'idle', _savedAt: null,
        _currentPage: 1, _pageSize: 30, _customPageSize: null, _selectedRows: [],
        _syncEnabled: false, _lastSyncAt: null, _isSyncingNow: false, _isImportingSync: false, /* keep for saveList destructure compat */
        _dateRange: null, _isEditingName: false,
    })
    attachAutoSave(allLists.value[allLists.value.length - 1])
}).catch(() => {})

const applyCustomPageSize = (list) => {
    const n = list._customPageSize
    if (!n || n < 1) return
    list._pageSize = Math.floor(n)
    list._currentPage = 1
    list._customPageSize = null
}

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
    try {
        await ElMessageBox.confirm(`确认删除选中的 ${list._selectedRows.length} 条记录？`, '批量删除', {
            type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
        })
        const sel = new Set(list._selectedRows)
        list.records = list.records.filter(r => !sel.has(r))
        list._selectedRows = []
        const maxPage = Math.max(1, Math.ceil(list.records.length / list._pageSize))
        if (list._currentPage > maxPage) list._currentPage = maxPage
    } catch {}
}

const allIgnore = async (list) => {
    try {
        await ElMessageBox.confirm(`确认忽略全部 ${list.records.length} 条记录？`, '一键忽略', {
            type: 'warning', confirmButtonText: '忽略全部', cancelButtonText: '取消'
        })
        list.records.forEach(r => { r.ignored = true })
    } catch {}
}
const allRestore = async (list) => {
    try {
        await ElMessageBox.confirm(`确认恢复全部 ${list.records.length} 条记录？`, '一键恢复', {
            type: 'info', confirmButtonText: '恢复全部', cancelButtonText: '取消'
        })
        list.records.forEach(r => { r.ignored = false })
    } catch {}
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
    } catch {}
}

const removeList = (id) => ElMessageBox.confirm('确定删除此列表？', '删除确认', {
    type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
}).then(async () => {
    const list = allLists.value.find(l => l._id === id)
    if (list) stopAutoSync(list)
    await axios.delete(`${API}/test-lists/${id}`)
    allLists.value = allLists.value.filter(l => l._id !== id)
    ElNotification.success({ message: '列表已删除', position: 'bottom-right' })
})

const startEditName = (l) => l._isEditingName = true
const confirmEditName = (l) => { l.listName = l._tempName; l._isEditingName = false; saveList(l, false) }
</script>

<style scoped>
.main-card { border-radius: 8px; }

.header-title-wrapper { display: flex; align-items: center; width: 100%; }
.header-title { font-weight: bold; color: var(--qa-heading-color); }

.control-panel {
    background: var(--qa-control-panel-bg);
    padding: 15px;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 8px;
}
.panel-left  { display: flex; align-items: center; gap: 8px; }
.panel-right { display: flex; gap: 8px; flex-wrap: wrap; }

.stats-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    margin-bottom: 12px;
    background: var(--qa-stats-pass-bg);
    border: 1px solid var(--qa-stats-pass-border);
    border-radius: 6px;
    font-size: 13px;
}
.stats-bar.has-fail {
    background: var(--qa-stats-fail-bg);
    border-color: var(--qa-stats-fail-border);
}
.stat-item { display: flex; align-items: center; gap: 3px; }
.stat-pass { color: var(--qa-pass); }
.stat-fail { color: var(--qa-fail); font-weight: bold; }
.stat-ok   { color: var(--qa-neutral); }

.tip-header {
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
    gap: 12px; padding: 6px 10px; margin-bottom: 6px;
    background: #fdf6ec; border: 1px solid #faecd8;
    border-radius: 6px; font-size: 13px; flex-wrap: wrap;
}
.action-bar-left  { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.action-bar-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.filter-count { font-size: 12px; color: #909399; white-space: nowrap; }
.bulk-count { color: #606266; }

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

/* ── 同步控制栏 ─────────────────────────────────────────────────────────────── */
.sync-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    margin-bottom: 12px;
    background: #f8f9fa;
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    font-size: 13px;
    gap: 12px;
    flex-wrap: wrap;
}
.sync-bar-active { background: #f0f9eb; border-color: var(--qa-stats-pass-border); }
.sync-bar-left  { display: flex; align-items: center; gap: 10px; }
.sync-bar-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

.sync-toggle-label { font-size: 13px; color: #606266; }
.sync-toggle-label.label-on { color: var(--qa-pass); font-weight: 600; }
.sync-cfg-hint {
    font-size: 12px; color: var(--qa-subtext-color);
    background: #f0f2f5; padding: 2px 8px; border-radius: 10px;
    cursor: default; white-space: nowrap;
}
.sync-status-on  { color: var(--qa-pass); }
.sync-status-off { color: #E6A23C; }
.sync-time { color: var(--qa-subtext-color); margin-left: 6px; }
.sync-url-label { font-size: 12px; color: var(--qa-subtext-color); white-space: nowrap; cursor: help; }

:deep(.row-mismatch) { background-color: var(--qa-row-mismatch-bg) !important; }
:deep(.row-mismatch:hover > td.el-table__cell) { background-color: var(--qa-row-mismatch-hover) !important; }

:deep(.row-ignored) { background-color: var(--qa-row-ignored-bg) !important; opacity: 0.55; }
:deep(.row-ignored:hover > td.el-table__cell) { background-color: var(--qa-row-ignored-bg) !important; }

.empty-list-hint {
    display: flex; align-items: flex-start; gap: 16px;
    padding: 24px 20px; margin-bottom: 12px;
    background: #fafafa; border: 1px dashed #dcdfe6;
    border-radius: 8px; color: #909399;
}
.empty-hint-title { font-size: 14px; font-weight: 600; color: #606266; margin-bottom: 6px; }
.empty-hint-actions { font-size: 13px; line-height: 1.9; color: #909399; }
.empty-hint-actions b { color: #409EFF; }

.field-missing { color: #E6A23C; font-size: 12px; font-weight: 500; white-space: nowrap; }

/* ── Excel 导入弹窗 ─────────────────────────────────────────────────────────── */
.import-info-box {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 14px 16px;
    background: #ecf5ff; border-left: 4px solid #409EFF;
    border-radius: 4px; font-size: 13px; line-height: 1.8;
}
.import-preview-count {
    display: flex; align-items: center; gap: 8px;
    padding: 12px 16px;
    background: #f5f7fa; border-radius: 6px;
    font-size: 14px;
}
</style>
