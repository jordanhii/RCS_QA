import { createRouter, createWebHistory } from 'vue-router'
import ConfigView from './views/ConfigView.vue'
import CaptureView from './views/CaptureView.vue'
import QAConfigView from './views/QAConfigView.vue'
import TestView from './views/TestView.vue'
import GameProfitView from './views/GameProfitView.vue'
import NetflowHistView from './views/NetflowHistView.vue'
const routes = [
    { path: '/',               redirect: '/config/alert' },
    { path: '/config',         redirect: '/config/alert' },
    { path: '/config/alert',   component: ConfigView,    name: '告警配置' },
    { path: '/config/capture', component: CaptureView,   name: '接口配置' },
    { path: '/config/qa',      component: QAConfigView,  name: '质检配置' },
    // ⚠️  Static route must come BEFORE /:id — Vue Router matches top-down
    { path: '/test/game-profit', component: GameProfitView, name: '游戏盈利(CG)' },
    { path: '/test/netflow-hist', component: NetflowHistView, name: '存提差同比' },
    { path: '/test/:id',         component: TestView,       name: '告警测试' },
]
export default createRouter({
  history: createWebHistory(),
  routes
})