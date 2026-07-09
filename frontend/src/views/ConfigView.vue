<template>
    <div class="config-page">
        <div class="page-header">
            <div>
                <h2 class="page-title">告警配置</h2>
                <p class="page-subtitle">管理各告警类型的检测阈值与参数</p>
            </div>
        </div>

        <div class="type-selector-row">
            <span class="type-selector-label">告警类型：</span>
            <el-select
                v-model="activeTab"
                size="default"
                style="width:220px;"
                @change="onTabChange"
            >
                <el-option
                    v-for="t in typeNames"
                    :key="String(t.id)"
                    :label="t.label"
                    :value="String(t.id)"
                />
            </el-select>
            <span class="type-selector-hint">{{ currentGroupHint }}</span>
            <el-button type="primary" class="add-cfg-btn" @click="addConfig">
                <el-icon style="margin-right: 5px;"><Plus /></el-icon> 新增配置
            </el-button>
        </div>

        <div class="tab-body">
            <div v-if="isLoading" style="padding: 20px;"><el-skeleton :rows="4" animated /></div>
            <el-empty v-else-if="configs.length === 0" description="暂无配置，点击右上角「新增配置」" style="padding: 40px 0;" />

        <el-collapse v-else v-model="activeCol" class="config-collapse">
            <el-collapse-item v-for="cfg in configs" :key="cfg._id" :name="cfg._id">
                <template #title>
                    <div class="collapse-header">
                        <template v-if="!cfg._isEditingName">
                            <span class="cfg-name">{{ cfg.name || '未命名配置' }}</span>
                            <el-button link type="primary" class="edit-name-btn" @click.stop="startEditName(cfg)">
                                <el-icon><Edit /></el-icon>
                            </el-button>
                        </template>
                        <template v-else>
                            <el-input v-model="cfg._tempName" size="small" style="width: 240px;"
                                @click.stop @keyup.enter.stop="confirmEditName(cfg)" />
                            <el-button type="success" size="small" circle style="margin-left: 8px;"
                                @click.stop="confirmEditName(cfg)">
                                <el-icon><Check /></el-icon>
                            </el-button>
                            <el-button type="info" plain size="small" circle @click.stop="cancelEditName(cfg)">
                                <el-icon><Close /></el-icon>
                            </el-button>
                        </template>
                        <div style="flex: 1;" />
                        <span class="save-status" style="display:inline-flex; align-items:center; gap:5px; font-size:13px; color:#909399;" @click.stop>
                            <template v-if="cfg._saveState === 'saving'">
                                <el-icon class="is-loading"><Loading /></el-icon> 保存中…
                            </template>
                            <template v-else-if="cfg._saveState === 'error'">
                                <el-icon color="#F56C6C"><CircleClose /></el-icon>
                                <span style="color:#F56C6C;">保存失败</span>
                                <el-button link type="primary" @click="saveConfig(cfg)">重试</el-button>
                            </template>
                            <template v-else>
                                <el-icon color="#67C23A"><CircleCheck /></el-icon> 已保存<template v-if="cfg._savedAt"> {{ cfg._savedAt }}</template>
                            </template>
                        </span>
                        <el-divider direction="vertical" style="height:18px; margin:0 8px;" />
                        <el-button type="danger" plain size="small"
                            @click.stop="deleteConfig(cfg._id)">删除</el-button>
                    </div>
                </template>

                <div class="params-list">
                    <!-- 存款天/月 (1,2)：持续时间 开发中 -->
                    <template v-if="[1, 2].includes(Number(activeTab))">
                        <div class="param-row">
                            <div class="param-row-label">
                                持续时间（分钟）<el-tag size="small" class="dev-tag">开发中</el-tag>
                            </div>
                            <el-input-number v-model="cfg.durationMin" controls-position="right"
                                style="width:160px;" disabled />
                        </div>
                    </template>

                    <!-- 提款天/月 (3,4)：持续时间 active -->
                    <template v-if="[3, 4].includes(Number(activeTab))">
                        <div class="param-row">
                            <div class="param-row-label">持续时间（分钟）</div>
                            <el-input-number v-model="cfg.durationMin" :min="1" :step="5"
                                controls-position="right" style="width:160px;" @change="queueSaveCfg(cfg)" />
                        </div>
                    </template>


                    <!-- 存提款 (1,2,3,4)：持续时间值、金额 开发中 -->
                    <template v-if="[1, 2, 3, 4].includes(Number(activeTab))">
                        <div class="param-row">
                            <div class="param-row-label">
                                持续时间值<el-tag size="small" class="dev-tag">开发中</el-tag>
                            </div>
                            <el-input-number disabled style="width:160px;" />
                        </div>
                        <div class="param-row">
                            <div class="param-row-label">
                                金额（上限/下限）<el-tag size="small" class="dev-tag">开发中</el-tag>
                            </div>
                            <el-input disabled placeholder="由表格平均值直出" style="width:200px;" />
                        </div>
                    </template>

                    <!-- 提款天/月 (3,4)：连续告警倍数 active -->
                    <template v-if="[3, 4].includes(Number(activeTab))">
                        <div class="param-row">
                            <div class="param-row-label">连续告警倍数（上限）</div>
                            <el-input-number v-model="cfg.multiUpper" :min="1" :step="0.05" :precision="2"
                                controls-position="right" style="width:160px;" @change="queueSaveCfg(cfg)" />
                        </div>
                        <div class="param-row">
                            <div class="param-row-label">连续告警倍数（下限）</div>
                            <el-input-number v-model="cfg.multiLower" :min="0" :max="1" :step="0.05" :precision="2"
                                controls-position="right" style="width:160px;" @change="queueSaveCfg(cfg)" />
                        </div>
                    </template>

                    <!-- 24h存提/投存比 (5,6,7) -->
                    <template v-if="[5, 6, 7].includes(Number(activeTab))">
                        <div class="param-row">
                            <div class="param-row-label">比例</div>
                            <el-input-number v-model="cfg.ratioLimit" :min="0" :step="0.001" :precision="3"
                                controls-position="right" style="width:160px;" @change="queueSaveCfg(cfg)" />
                        </div>
                        <div class="param-row">
                            <div class="param-row-label">连续告警倍数</div>
                            <el-input-number v-model="cfg.ratioMulti" :min="0" :step="0.001" :precision="3"
                                controls-position="right" style="width:160px;" @change="queueSaveCfg(cfg)" />
                        </div>
                        <div class="param-row">
                            <div class="param-row-label">告警窗口（分钟）</div>
                            <el-input-number v-model="cfg.alertWindow" :min="1" :step="5"
                                controls-position="right" style="width:160px;" @change="queueSaveCfg(cfg)" />
                        </div>
                    </template>

                    <!-- 游戏盈利 (8)：对象 / 告警阈值X / 连续告警阈值Y -->
                    <template v-if="Number(activeTab) === 8">
                        <div class="param-row">
                            <div class="param-row-label">
                                对象
                                <el-tooltip placement="top">
                                    <template #content>该配置适用的对象（与告警记录的 target 一致，大小写不敏感）；检查时各对象自动匹配各自配置</template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;margin-left:3px;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-select
                                v-model="cfg.target"
                                filterable allow-create default-first-option :reserve-keyword="false"
                                placeholder="选择对象（COLORGAME / SM）" style="width:300px;"
                                @change="queueSaveCfg(cfg)">
                                <el-option v-for="t in GAME_TARGET_OPTIONS" :key="t" :label="t" :value="t" />
                            </el-select>
                        </div>
                        <div class="param-row">
                            <div class="param-row-label">
                                告警阈值 X (%)
                                <el-tooltip placement="top">
                                    <template #content>条件1：当前RTP偏差值 &lt; X% → 触发</template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;margin-left:3px;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input-number v-model="cfg.xThreshold" :precision="1" :step="1"
                                controls-position="right" style="width:160px;" @change="queueSaveCfg(cfg)" />
                        </div>
                        <div class="param-row">
                            <div class="param-row-label">
                                连续告警阈值 Y (%)
                                <el-tooltip placement="top">
                                    <template #content>条件3：上一GGR − 当日GGR ≥ |上一GGR| × Y% → 触发</template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;margin-left:3px;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input-number v-model="cfg.yThreshold" :min="0" :precision="1" :step="1"
                                controls-position="right" style="width:160px;" @change="queueSaveCfg(cfg)" />
                        </div>
                        <div class="param-row">
                            <div class="param-row-label">
                                检查间隔（分钟）
                                <el-tooltip placement="top">
                                    <template #content>当前告警与上一条告警的时间差 ≥ 此值时，视为普通告警，不检查连续告警逻辑，连续告警结果显示 -</template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;margin-left:3px;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input-number v-model="cfg.alertInterval" :min="1" :step="5"
                                controls-position="right" style="width:160px;" @change="queueSaveCfg(cfg)" />
                        </div>
                    </template>

                    <!-- 存提差环比 (9)：检查间隔 X + 下降阈值 Y -->
                    <template v-if="Number(activeTab) === 9">
                        <div class="param-row">
                            <div class="param-row-label">
                                检查间隔 X（分钟）
                                <el-tooltip placement="top">
                                    <template #content>每隔 X 分钟检查一次存提差变化</template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;margin-left:3px;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input-number v-model="cfg.alertInterval" :min="1" :step="5"
                                controls-position="right" style="width:160px;" @change="queueSaveCfg(cfg)" />
                        </div>
                        <div class="param-row">
                            <div class="param-row-label">
                                下降阈值 Y
                                <el-tooltip placement="top">
                                    <template #content>Last存提差 − 当前存提差 ≥ Y 时告警结果为 TRUE</template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;margin-left:3px;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input-number v-model="cfg.yThreshold" :min="0" :step="1" :precision="0"
                                controls-position="right" style="width:160px;" @change="queueSaveCfg(cfg)" />
                        </div>
                    </template>

                    <!-- 存提差同比 (10) -->
                    <template v-if="Number(activeTab) === 10">
                        <div class="param-row">
                            <div class="param-row-label">
                                提款阈值 X
                                <el-tooltip placement="top">
                                    <template #content>日累计提款数值 ≥ X 时，条件1为 TRUE</template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;margin-left:3px;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input-number v-model="cfg.xThreshold" :min="0" :step="1000" :precision="0"
                                controls-position="right" style="width:160px;" @change="queueSaveCfg(cfg)" />
                        </div>
                        <div class="param-row">
                            <div class="param-row-label">日累计存提差比较</div>
                            <div style="font-size:13px;color:#909399;line-height:1.8;">
                                存提差金额 &lt; 以下任意两个历史值时，条件2为 TRUE：<br/>
                                · 昨日同时间累计存提差<br/>
                                · 上周同天同时间累计存提差<br/>
                                · 上月同天同时间累计存提差
                            </div>
                        </div>
                        <div class="param-row">
                            <div class="param-row-label">
                                检查间隔 X（分钟）
                                <el-tooltip placement="top">
                                    <template #content>每隔 X 分钟重新检查全部条件，全部为 TRUE 时告警结果为 TRUE</template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;margin-left:3px;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input-number v-model="cfg.alertInterval" :min="1" :step="5"
                                controls-position="right" style="width:160px;" @change="queueSaveCfg(cfg)" />
                        </div>
                    </template>

                    <!-- 优惠同比 (11)：优惠类型 + 起步判断额 + 前7/30天普通倍数 + 连续告警间隔/连续倍数（镜像风控优惠监控配置） -->
                    <template v-if="Number(activeTab) === 11">
                        <div class="param-row">
                            <div class="param-row-label">
                                优惠类型
                                <el-tooltip placement="top">
                                    <template #content>该配置适用的优惠类型，可多选（与告警里的优惠类型一致，大小写不敏感）；检查时各优惠类型自动匹配各自配置</template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;margin-left:3px;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-select
                                :model-value="cfgPromoNames(cfg)"
                                multiple filterable allow-create default-first-option :reserve-keyword="false"
                                placeholder="选择优惠类型（可多选）" style="width:300px;"
                                @update:model-value="v => { cfg.promoName = v.join(','); queueSaveCfg(cfg) }">
                                <el-option v-for="t in REWARD_TYPE_OPTIONS" :key="t" :label="t" :value="t" />
                            </el-select>
                        </div>
                        <div class="param-row">
                            <div class="param-row-label">
                                日累计优惠起步判断额
                                <el-tooltip placement="top">
                                    <template #content>今日累计优惠 ≥ 此值后才开始判断是否告警（条件1）</template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;margin-left:3px;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input-number v-model="cfg.startThreshold" :min="0" :step="1" :precision="0"
                                controls-position="right" style="width:160px;" @change="queueSaveCfg(cfg)" />
                        </div>
                        <div class="param-row">
                            <div class="param-row-label">
                                普通告警 ≥前7天平均 × 倍数
                                <el-tooltip placement="top">
                                    <template #content>普通告警：今日累计优惠 ≥ 前7天平均日累计优惠 × 此倍数（条件2之一，倍数 ≥1）</template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;margin-left:3px;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input-number v-model="cfg.mult7" :min="1" :step="0.1" :precision="2"
                                controls-position="right" style="width:160px;" @change="onYoyMultChange(cfg)" />
                        </div>
                        <div class="param-row">
                            <div class="param-row-label">
                                普通告警 ≥前30天平均 × 倍数
                                <el-tooltip placement="top">
                                    <template #content>普通告警：今日累计优惠 ≥ 前30天平均日累计优惠 × 此倍数（条件2之二，倍数 ≥1）</template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;margin-left:3px;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input-number v-model="cfg.mult30" :min="1" :step="0.1" :precision="2"
                                controls-position="right" style="width:160px;" @change="onYoyMultChange(cfg)" />
                        </div>
                        <div class="param-row">
                            <div class="param-row-label">
                                连续告警间隔（分钟）
                                <el-tooltip placement="top">
                                    <template #content>触发普通告警后，需至少间隔 N 分钟（X 分钟后再查），才允许再次触发连续告警</template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;margin-left:3px;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input-number v-model="cfg.alertInterval" :min="1" :step="5"
                                controls-position="right" style="width:160px;" @change="queueSaveCfg(cfg)" />
                        </div>
                        <div class="param-row">
                            <div class="param-row-label">
                                连续告警 ≥前7天平均 × 倍数
                                <el-tooltip placement="top">
                                    <template #content>连续告警：恶化到 今日累计 ≥ 前7天平均 × 此倍数；须大于普通告警的前7天倍数</template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;margin-left:3px;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input-number v-model="cfg.mult7Cont" :min="1" :step="0.1" :precision="2"
                                controls-position="right" style="width:160px;" @change="onYoyMultContChange(cfg)" />
                        </div>
                        <div class="param-row">
                            <div class="param-row-label">
                                连续告警 ≥前30天平均 × 倍数
                                <el-tooltip placement="top">
                                    <template #content>连续告警：恶化到 今日累计 ≥ 前30天平均 × 此倍数；须大于普通告警的前30天倍数</template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;margin-left:3px;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input-number v-model="cfg.mult30Cont" :min="1" :step="0.1" :precision="2"
                                controls-position="right" style="width:160px;" @change="onYoyMultContChange(cfg)" />
                        </div>
                    </template>

                    <!-- 优惠环比 (12)：优惠名称 + 环比间隔 + 上时段倍数 -->
                    <template v-if="Number(activeTab) === 12">
                        <div class="param-row">
                            <div class="param-row-label">
                                优惠名称
                                <el-tooltip placement="top">
                                    <template #content>该配置适用的优惠类型，可多选（与告警里的优惠类型一致，大小写不敏感）；检查时各优惠类型自动匹配各自配置</template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;margin-left:3px;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-select
                                :model-value="cfgPromoNames(cfg)"
                                multiple filterable allow-create default-first-option :reserve-keyword="false"
                                placeholder="选择优惠类型（可多选）" style="width:300px;"
                                @update:model-value="v => { cfg.promoName = v.join(','); queueSaveCfg(cfg) }">
                                <el-option v-for="t in REWARD_TYPE_OPTIONS" :key="t" :label="t" :value="t" />
                            </el-select>
                        </div>
                        <div class="param-row">
                            <div class="param-row-label">
                                环比间隔时间（分钟）
                                <el-tooltip placement="top">
                                    <template #content>每 N 分钟计算该时段的优惠领取增长额（对比窗口大小）</template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;margin-left:3px;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input-number v-model="cfg.alertInterval" :min="1" :step="5"
                                controls-position="right" style="width:160px;" @change="queueSaveCfg(cfg)" />
                        </div>
                        <div class="param-row">
                            <div class="param-row-label">
                                普通告警 ≥上时段 × 倍数 (B)
                                <el-tooltip placement="top">
                                    <template #content>普通告警：本时段增长 ≥ 上时段增长 × 此倍数 时告警（倍数 ≥1）</template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;margin-left:3px;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input-number v-model="cfg.multLast" :min="1" :step="0.1" :precision="2"
                                controls-position="right" style="width:160px;" @change="onMultLastChange(cfg)" />
                        </div>
                        <div class="param-row">
                            <div class="param-row-label">
                                连续告警 ≥上时段（连续）× 倍数 (C)
                                <el-tooltip placement="top">
                                    <template #content>连续告警：触发后同周期内 本时段增长 ≥ 上时段增长 × 此倍数 时再告警；须大于普通告警倍数(B)</template>
                                    <el-icon size="13" color="#c0c4cc" style="cursor:help;margin-left:3px;"><InfoFilled /></el-icon>
                                </el-tooltip>
                            </div>
                            <el-input-number v-model="cfg.multLastCont" :min="1" :step="0.1" :precision="2"
                                controls-position="right" style="width:160px;" @change="onMultLastContChange(cfg)" />
                        </div>
                    </template>

                    <!-- 所有类型：配置生效时间 开发中 -->
                    <div class="param-row">
                        <div class="param-row-label">
                            配置生效时间<el-tag size="small" class="dev-tag">开发中</el-tag>
                        </div>
                        <el-input disabled placeholder="YYYY/MM/DD" style="width:160px;" />
                    </div>
                </div>
            </el-collapse-item>
        </el-collapse>
        </div><!-- /tab-body -->
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { ElNotification, ElMessageBox } from 'element-plus'
import { Plus, Edit, Check, Close, InfoFilled, Loading, CircleCheck, CircleClose } from '@element-plus/icons-vue'
import { REWARD_TYPE_OPTIONS } from '../logic/alertTypes.js'

// 配置的「优惠类型」存为逗号分隔字符串，支持多选；下拉绑定用数组
const cfgPromoNames = c => String(c?.promoName ?? '').split(/[,，]/).map(s => s.trim()).filter(Boolean)

// 游戏盈利「对象」可选项（可手动输入新对象）
const GAME_TARGET_OPTIONS = ['COLORGAME', 'SM']

const API = 'http://localhost:3000/api'
const activeTab = ref('1')
const activeCol = ref([])
const configs = ref([])
const isLoading = ref(false)

// prettier-ignore
const typeNames = [
    { id: 1, label: '存款（天）' }, { id: 2, label: '存款（月）' },
    { id: 3, label: '提款（天）' }, { id: 4, label: '提款（月）' },
    { id: 5, label: '24h 存提' },  { id: 6, label: '投/存比' },
    { id: 7, label: '投/存+惠比' }, { id: 8, label: '游戏盈利' },
    { id: 9, label: '存提差环比' },
    { id: 10, label: '存提差同比' },
    { id: 11, label: '优惠同比' },
    { id: 12, label: '优惠环比' },
]

const GROUP_HINTS = {
    1: '存款（天）— 检测普通告警（上升/下降）',
    2: '存款（月）— 检测普通告警（上升/下降）',
    3: '提款（天）— 检测普通 + 连续告警（持续倍数）',
    4: '提款（月）— 检测普通 + 连续告警（持续倍数）',
    5: '24h 存提额 — 检测比值阈值 + 连续增量',
    6: '投/存比 — 检测比值阈值 + 连续增量',
    7: '投/存+惠比 — 检测比值阈值 + 连续增量',
    8: '游戏盈利 — 检测各对象（COLORGAME / SM …）普通告警（C1 AND C2）与连续告警（C1 AND C2 AND C3）',
    9: '存提差环比 — 每 X 分钟检查，Last存提差 − 当前存提差 ≥ Y 时触发',
    10: '存提差同比 — 日累计提款 ≥ X 且存提差 < 任意两个历史值时触发',
    11: '优惠同比 — 普通告警：今日累计 ≥ 前7天/前30天平均×倍数；连续告警：间隔后恶化到 ≥ 前7天/前30天平均×连续倍数；每个优惠类型可独立配置',
    12: '优惠环比 — 普通告警：本时段增长 ≥ 上时段×B；连续告警：同周期内 ≥ 上时段×C（C>B）；每个优惠类型可独立配置',
}
const currentGroupHint = computed(() => GROUP_HINTS[Number(activeTab.value)] || '')


const onTabChange = () => { loadConfigs() }

const loadConfigs = async () => {
    isLoading.value = true
    try {
        const res = await axios.get(`${API}/configs/${activeTab.value}`)
        configs.value = res.data.map(c => ({
            ...c,
            xThreshold:     c.xThreshold    ?? 2500,
            yThreshold:     c.yThreshold    ?? 10,
            alertInterval:  c.alertInterval ?? 60,
            startThreshold: c.startThreshold ?? 0,
            mult7:          c.mult7          ?? 1.2,
            mult30:         c.mult30         ?? 1.2,
            mult7Cont:      c.mult7Cont      ?? 1.5,
            mult30Cont:     c.mult30Cont     ?? 1.5,
            multLast:       c.multLast       ?? 1.2,
            multLastCont:   c.multLastCont   ?? 1.5,
            promoName:      c.promoName      ?? '',
            target:         c.target         ?? '',
            _isEditingName: false,
            _tempName:      c.name,
            _saveState:     'idle',
            _savedAt:       null,
        }))
        activeCol.value = configs.value.length > 0 ? [configs.value[0]._id] : []
    } finally {
        isLoading.value = false
    }
}

const _saveTimers = new Map()
const queueSaveCfg = (cfg) => {
    cfg._saveState = 'saving'
    clearTimeout(_saveTimers.get(cfg._id))
    _saveTimers.set(cfg._id, setTimeout(() => saveConfig(cfg), 700))
}

// 优惠环比：连续告警倍数(C) 必须大于普通告警倍数(B)（镜像风控优惠监控配置校验）
const warnIfContNotGreater = (cfg) => {
    if (Number(cfg.multLastCont) <= Number(cfg.multLast)) {
        ElNotification.warning({
            message: '连续告警阈值需大于普通告警的阈值（C 须 > B）',
            position: 'bottom-right', duration: 4000,
        })
        return false
    }
    return true
}
const onMultLastChange = (cfg) => { warnIfContNotGreater(cfg); queueSaveCfg(cfg) }
const onMultLastContChange = (cfg) => { warnIfContNotGreater(cfg); queueSaveCfg(cfg) }

// 优惠同比：连续告警倍数(mult7Cont/mult30Cont) 必须大于对应的普通告警倍数(mult7/mult30)
const warnIfYoyContNotGreater = (cfg) => {
    if (Number(cfg.mult7Cont) <= Number(cfg.mult7) || Number(cfg.mult30Cont) <= Number(cfg.mult30)) {
        ElNotification.warning({
            message: '连续告警阈值需大于普通告警的阈值（连续倍数须 > 普通倍数）',
            position: 'bottom-right', duration: 4000,
        })
        return false
    }
    return true
}
const onYoyMultChange = (cfg) => { warnIfYoyContNotGreater(cfg); queueSaveCfg(cfg) }
const onYoyMultContChange = (cfg) => { warnIfYoyContNotGreater(cfg); queueSaveCfg(cfg) }

onMounted(() => onTabChange(activeTab.value))

const startEditName  = (cfg) => { cfg._tempName = cfg.name; cfg._isEditingName = true }
const cancelEditName = (cfg) => { cfg._isEditingName = false }
const confirmEditName = (cfg) => {
    if (!cfg._tempName?.trim()) {
        ElNotification.warning({ message: '配置名称不能为空', position: 'bottom-right' })
        return
    }
    cfg.name = cfg._tempName
    cfg._isEditingName = false
    saveConfig(cfg)
}

const addConfig = () => {
    ElMessageBox.prompt('请输入配置名称', '新增配置', {
        confirmButtonText: '确定', cancelButtonText: '取消', inputPlaceholder: '例：默认配置'
    }).then(async ({ value }) => {
        if (!value?.trim()) return
        const tid = Number(activeTab.value)
        const res = await axios.post(`${API}/configs`,
            tid === 8 ? { typeId: tid, name: value, target: '', xThreshold: 2500, yThreshold: 10, alertInterval: 60 }
          : tid === 9 ? { typeId: tid, name: value, alertInterval: 60, yThreshold: 0 }
          : tid === 10 ? { typeId: tid, name: value, xThreshold: 0, alertInterval: 60 }
          : tid === 11 ? { typeId: tid, name: value, promoName: '', startThreshold: 0, mult7: 1.2, mult30: 1.2, mult7Cont: 1.5, mult30Cont: 1.5, alertInterval: 30 }
          : tid === 12 ? { typeId: tid, name: value, alertInterval: 30, multLast: 1.2, multLastCont: 1.5, promoName: '' }
          : { typeId: tid, name: value, durationMin: 30, multiUpper: 1.15, multiLower: 0.85, ratioLimit: 1.5, ratioMulti: 0.5, alertWindow: 30 }
        )
        const newCfg = { ...res.data, _isEditingName: false, _tempName: res.data.name, _saveState: 'idle', _savedAt: null }
        configs.value.push(newCfg)
        activeCol.value = [...activeCol.value, newCfg._id]
        ElNotification.success({ message: '配置创建成功', position: 'bottom-right' })
    }).catch(() => {})
}

const saveConfig = async (cfg) => {
    cfg._saveState = 'saving'
    try {
        // Build payload explicitly to avoid reactive proxy spread issues
        const payload = {
            _id:          cfg._id,
            typeId:       cfg.typeId,
            name:         cfg.name,
            durationMin:  cfg.durationMin,
            multiUpper:   cfg.multiUpper,
            multiLower:   cfg.multiLower,
            ratioLimit:   cfg.ratioLimit,
            ratioMulti:   cfg.ratioMulti,
            alertWindow:  cfg.alertWindow,
            ggrThreshold: cfg.ggrThreshold,
            xThreshold:    cfg.xThreshold    ?? 2500,
            yThreshold:    cfg.yThreshold    ?? 10,
            alertInterval: cfg.alertInterval ?? 60,
            // 优惠同比(11) / 优惠环比(12) 倍数（此前漏传，编辑后不落库）
            startThreshold: cfg.startThreshold ?? 0,
            mult7:          cfg.mult7          ?? 1.2,
            mult30:         cfg.mult30         ?? 1.2,
            multLast:       cfg.multLast       ?? 1.2,
            multLastCont:   cfg.multLastCont   ?? 1.5,
            promoName:      cfg.promoName      ?? '',
            target:         cfg.target         ?? '',
        }
        await axios.post(`${API}/configs`, payload)
        cfg._saveState = 'idle'
        cfg._savedAt = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
        cfg._saveState = 'error'
    }
}

const deleteConfig = (id) => {
    ElMessageBox.confirm('确定删除此配置？', '删除确认', {
        type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
    }).then(async () => {
        const { data } = await axios.delete(`${API}/configs/${id}`)
        configs.value = configs.value.filter(c => c._id !== id)
        activeCol.value = activeCol.value.filter(id2 => id2 !== id)
        if (data.affectedWithData > 0) {
            ElNotification.warning({
                title: '配置已删除',
                message: `${data.affectedWithData} 个有数据的列表已自动清除关联配置，请重新选择配置。`,
                duration: 6000, position: 'bottom-right',
            })
        } else {
            ElNotification.info({ message: '配置已删除', position: 'bottom-right' })
        }
    }).catch(() => {})
}
</script>

<style scoped>
.config-page { display: flex; flex-direction: column; }

/* ── 页头 ─────────────────────────────────────────────────────────────────── */
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 18px;
}
.page-title  { margin: 0 0 3px; font-size: 20px; font-weight: 700; color: var(--qa-heading-color); }
.page-subtitle { margin: 0; font-size: 13px; color: var(--qa-subtext-color); }

/* ── 类型选择：一条轻工具条 ──────────────────────────────────────────────── */
.type-selector-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    margin-bottom: 16px;
    background: #fff;
    border: 1px solid #ebeef5;
    border-radius: 10px;
    box-shadow: var(--qa-shadow-xs);
    flex-wrap: wrap;
}
.type-selector-label {
    font-size: 13px;
    color: #4e5969;
    white-space: nowrap;
    font-weight: 600;
}
.type-selector-hint {
    font-size: 12px;
    color: #5a7fb8;
    background: #f2f6fc;
    border: 1px solid #e1ebf7;
    padding: 4px 12px;
    border-radius: 999px;
    white-space: nowrap;
}
.add-cfg-btn { margin-left: auto; }

/* 容器不再是一张大白卡，配置卡各自独立浮在页面底色上 */
.tab-body { background: transparent; border: none; padding: 0; }

/* ── 配置卡（折叠项 → 独立卡片）────────────────────────────────────────────── */
.config-collapse {
    border: none;
    --el-collapse-border-color: transparent;
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.config-collapse :deep(.el-collapse-item) {
    background: #fff;
    border: 1px solid #ebeef5;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: var(--qa-shadow-xs);
    transition: box-shadow 0.2s ease, border-color 0.2s ease;
}
.config-collapse :deep(.el-collapse-item:hover) { box-shadow: var(--qa-shadow-sm); }
.config-collapse :deep(.el-collapse-item__header) {
    padding: 0 18px;
    height: 56px;
    background: #fff;
    border-bottom: 1px solid transparent;
    font-size: 14px;
}
.config-collapse :deep(.el-collapse-item.is-active .el-collapse-item__header) {
    border-bottom-color: #f0f2f5;
}
.config-collapse :deep(.el-collapse-item__content) { padding: 20px 22px 14px; }

.collapse-header { display: flex; align-items: center; gap: 8px; width: 100%; padding-right: 16px; }
.cfg-name {
    font-size: 14px; font-weight: 700; color: #1d2129;
    display: inline-flex; align-items: center; gap: 8px;
}
.cfg-name::before {
    content: ''; width: 7px; height: 7px; border-radius: 50%;
    background: #409EFF; flex-shrink: 0;
}
.edit-name-btn { opacity: 0; transition: opacity 0.2s; }
.collapse-header:hover .edit-name-btn { opacity: 1; }

/* ── 参数表单 ─────────────────────────────────────────────────────────────── */
.params-list { display: flex; flex-direction: column; max-width: 720px; }
.param-row {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 13px 0;
    border-bottom: 1px solid #f5f6f8;
}
.param-row:last-child { border-bottom: none; }
.param-row-label {
    width: 210px;
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 500;
    color: #4e5969;
    line-height: 1.4;
    display: flex;
    align-items: center;
    gap: 6px;
}
/* 「开发中」字段整体淡化，让真正可配置的项更突出 */
.param-row:has(.dev-tag) { opacity: 0.5; }
.dev-tag {
    --el-tag-bg-color: #f4f4f5;
    --el-tag-border-color: #dcdfe6;
    --el-tag-text-color: #a8abb2;
    font-size: 10px;
}

/* ── 游戏盈利配置面板 ──────────────────────────────────────────────────────── */
.gp-cfg-panel {
    background: #fff;
    border: 1px solid #ebeef5;
    border-radius: 12px;
    padding: 4px 18px;
    max-width: 520px;
    box-shadow: var(--qa-shadow-xs);
}
</style>
