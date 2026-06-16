<template>
    <el-container style="height: 100vh;">
        <el-aside width="220px" style="background: linear-gradient(180deg, #1a2535 0%, #243447 100%); box-shadow: 2px 0 16px rgba(0,0,0,0.22); display:flex; flex-direction:column;">

            <!-- Logo 区 -->
            <div class="sidebar-logo">
                <div class="sidebar-logo-icon">QA</div>
                <div>
                    <div class="sidebar-logo-title">RCS QA</div>
                    <div class="sidebar-logo-sub">告警逻辑质检系统</div>
                </div>
            </div>

            <!-- 菜单 -->
            <el-menu
                active-text-color="#40a9ff"
                background-color="transparent"
                text-color="rgba(255,255,255,0.65)"
                router
                :default-active="$route.path"
                style="border-right:none; flex:1; overflow-y:auto;"
            >
                <!-- 配置 -->
                <el-sub-menu index="config">
                    <template #title>
                        <el-icon><Setting /></el-icon>
                        <span>配置</span>
                    </template>
                    <el-menu-item index="/config/alert">
                        <el-icon><Warning /></el-icon>
                        <span>告警配置</span>
                    </el-menu-item>
                    <el-menu-item index="/config/capture">
                        <el-icon><Monitor /></el-icon>
                        <span>接口配置</span>
                    </el-menu-item>
                    <el-menu-item index="/config/qa">
                        <el-icon><Tools /></el-icon>
                        <span>质检配置</span>
                    </el-menu-item>
                </el-sub-menu>

                <!-- 告警逻辑检查 -->
                <el-sub-menu index="tests">
                    <template #title>
                        <el-icon><DataAnalysis /></el-icon>
                        <span>告警逻辑检查</span>
                    </template>

                    <div class="menu-group-label">存提款</div>
                    <el-menu-item index="/test/1">
                        <el-icon><Top /></el-icon>
                        <span>存款（天）</span>
                    </el-menu-item>
                    <el-menu-item index="/test/2">
                        <el-icon><Top /></el-icon>
                        <span>存款（月）</span>
                    </el-menu-item>
                    <el-menu-item index="/test/3">
                        <el-icon><Bottom /></el-icon>
                        <span>提款（天）</span>
                    </el-menu-item>
                    <el-menu-item index="/test/4">
                        <el-icon><Bottom /></el-icon>
                        <span>提款（月）</span>
                    </el-menu-item>
                    <el-menu-item index="/test/5">
                        <el-icon><DataLine /></el-icon>
                        <span>24h 存提款额</span>
                    </el-menu-item>

                    <div class="menu-group-label">投/存比</div>
                    <el-menu-item index="/test/6">
                        <el-icon><Histogram /></el-icon>
                        <span>投/存比</span>
                    </el-menu-item>
                    <el-menu-item index="/test/7">
                        <el-icon><Histogram /></el-icon>
                        <span>投/存+惠比</span>
                    </el-menu-item>

                    <div class="menu-group-label">优惠</div>
                    <el-menu-item index="/test/promo-yoy">
                        <el-icon><Histogram /></el-icon>
                        <span>优惠同比</span>
                    </el-menu-item>
                    <el-menu-item index="/test/promo-mom">
                        <el-icon><Histogram /></el-icon>
                        <span>优惠环比</span>
                    </el-menu-item>

                    <div class="menu-group-label">特殊告警</div>
                    <el-menu-item index="/test/game-profit">
                        <el-icon><Trophy /></el-icon>
                        <span>游戏盈利 (CG)</span>
                    </el-menu-item>
                    <el-menu-item index="/test/9">
                        <el-icon><Odometer /></el-icon>
                        <span>存提差环比</span>
                    </el-menu-item>
                    <el-menu-item index="/test/netflow-hist">
                        <el-icon><Rank /></el-icon>
                        <span>存提差同比</span>
                    </el-menu-item>
                </el-sub-menu>
            </el-menu>

            <!-- 底部版本号 -->
            <div class="sidebar-footer">v 1.1</div>
        </el-aside>

        <el-container style="background:#f0f2f5; overflow:hidden;">
            <el-main style="padding: 24px 28px; overflow-y:auto;">
                <router-view :key="$route.fullPath"></router-view>
            </el-main>
        </el-container>
    </el-container>
</template>

<script setup>
import {
    Setting, Warning, Monitor, Tools,
    DataAnalysis, DataLine, Histogram, Trophy,
    Top, Bottom, Odometer, Rank,
} from '@element-plus/icons-vue'
</script>

<style scoped>
/* ── Logo 区 ──────────────────────────────────────────────────────────────── */
.sidebar-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 18px 16px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    margin-bottom: 4px;
    flex-shrink: 0;
}
.sidebar-logo-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
    color: #fff;
    letter-spacing: 0.5px;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(22,119,255,0.4);
}
.sidebar-logo-title {
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.5px;
    line-height: 1.2;
}
.sidebar-logo-sub {
    color: rgba(255,255,255,0.35);
    font-size: 10px;
    margin-top: 1px;
}

/* ── 分组标签 ─────────────────────────────────────────────────────────────── */
.menu-group-label {
    padding: 10px 20px 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: rgba(255,255,255,0.25);
    pointer-events: none;
}

/* ── 底部版本 ─────────────────────────────────────────────────────────────── */
.sidebar-footer {
    padding: 10px 20px;
    font-size: 10px;
    color: rgba(255,255,255,0.2);
    text-align: right;
    flex-shrink: 0;
    border-top: 1px solid rgba(255,255,255,0.05);
}

/* ── 菜单激活态优化 ───────────────────────────────────────────────────────── */
:deep(.el-menu-item.is-active) {
    background: rgba(64, 169, 255, 0.12) !important;
    border-radius: 6px;
    margin: 0 8px;
    width: calc(100% - 16px);
}
:deep(.el-menu-item.is-active::before) {
    content: '';
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 6px;
    width: 3px;
    background: #40a9ff;
    border-radius: 0 3px 3px 0;
}
:deep(.el-menu-item:hover) {
    background: rgba(255,255,255,0.06) !important;
    border-radius: 6px;
    margin: 0 8px;
    width: calc(100% - 16px);
}
:deep(.el-sub-menu__title:hover) {
    background: rgba(255,255,255,0.06) !important;
}
:deep(.el-menu--inline) {
    background: rgba(0,0,0,0.15) !important;
}
:deep(.el-menu-item) {
    height: 38px;
    line-height: 38px;
    font-size: 12.5px;
    position: relative;
}
:deep(.el-sub-menu__title) {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.8) !important;
}
</style>
