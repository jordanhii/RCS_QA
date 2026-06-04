<template>
    <el-container style="height: 100vh;">
        <el-aside width="220px" style="background: linear-gradient(180deg, #1e2d3d 0%, #2d3f52 100%); box-shadow: 2px 0 12px rgba(0,0,0,0.18);">
            <div style="padding: 18px 20px 12px; border-bottom: 1px solid rgba(255,255,255,0.07); margin-bottom: 6px;">
                <div style="color:#fff; font-size:15px; font-weight:700; letter-spacing:0.5px;">⚙ RCS QA</div>
                <div style="color:rgba(255,255,255,0.38); font-size:11px; margin-top:2px;">告警逻辑质检系统</div>
            </div>
            <el-menu active-text-color="#40a9ff" background-color="transparent" text-color="rgba(255,255,255,0.65)" router
                :default-active="$route.path"
                style="border-right:none;"
            >
                <el-sub-menu index="config">
                    <template #title>配置</template>
                    <el-menu-item index="/config/alert">告警配置</el-menu-item>
                    <el-menu-item index="/config/capture">接口配置</el-menu-item>
                    <el-menu-item index="/config/qa">质检配置</el-menu-item>
                </el-sub-menu>
                <el-sub-menu index="tests">
                    <template #title>告警逻辑检查</template>
                    <el-menu-item index="/test/1">前X分钟存款（前X天）</el-menu-item>
                    <el-menu-item index="/test/2">前X分钟存款（前X月）</el-menu-item>
                    <el-menu-item index="/test/3">前X分钟提款（前X天）</el-menu-item>
                    <el-menu-item index="/test/4">前X分钟提款（前X月）</el-menu-item>
                    <el-menu-item index="/test/5">24小时存提款额</el-menu-item>
                    <el-menu-item index="/test/6">投/存比</el-menu-item>
                    <el-menu-item index="/test/7">投/存+惠比</el-menu-item>
                    <el-menu-item index="/test/game-profit">游戏盈利(CG)</el-menu-item>
                    <el-menu-item index="/test/9">存提差环比</el-menu-item>
                    <el-menu-item index="/test/netflow-hist">存提差同比</el-menu-item>
                </el-sub-menu>
            </el-menu>
        </el-aside>
        <el-container style="background:#f0f2f5;">
            <el-main style="padding: 24px 28px;">
                <router-view :key="$route.fullPath"></router-view>
            </el-main>
        </el-container>
    </el-container>
</template>