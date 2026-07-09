import { createRouter, createWebHistory } from 'vue-router'
// 登录页首屏就要用，直接静态引入；其余页面懒加载（用到才下载各自的代码块），
// 减小首屏 JS 体积、加快首次打开与 Render 冷启动后的加载。
import LoginView from './views/LoginView.vue'
const ConfigView      = () => import('./views/ConfigView.vue')
const CaptureView     = () => import('./views/CaptureView.vue')
const QAConfigView    = () => import('./views/QAConfigView.vue')
const TestView        = () => import('./views/TestView.vue')
const GameProfitView  = () => import('./views/GameProfitView.vue')
const NetflowHistView = () => import('./views/NetflowHistView.vue')
const PromoYoyView    = () => import('./views/PromoYoyView.vue')
const PromoMomView    = () => import('./views/PromoMomView.vue')
const UserManageView  = () => import('./views/UserManageView.vue')
import { useAuthStore } from './stores/authStore.js'

const routes = [
    { path: '/login',          component: LoginView,     name: '登录', meta: { public: true } },
    { path: '/',               redirect: '/config/alert' },
    { path: '/config',         redirect: '/config/alert' },
    { path: '/config/alert',   component: ConfigView,    name: '告警配置' },
    { path: '/config/capture', component: CaptureView,   name: '接口配置' },
    { path: '/config/qa',      component: QAConfigView,  name: '质检配置' },
    { path: '/users',          component: UserManageView, name: '用户管理', meta: { admin: true } },
    // ⚠️  Static route must come BEFORE /:id — Vue Router matches top-down
    { path: '/test/game-profit', component: GameProfitView, name: '游戏盈利' },
    { path: '/test/netflow-hist', component: NetflowHistView, name: '存提差同比' },
    { path: '/test/promo-yoy',   component: PromoYoyView,   name: '优惠同比' },
    { path: '/test/promo-mom',   component: PromoMomView,   name: '优惠环比' },
    { path: '/test/:id',         component: TestView,       name: '告警测试' },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

// ── 全局守卫：未登录跳 /login；非管理员挡住 /users ──────────────────────────
router.beforeEach(async (to) => {
    const auth = useAuthStore()
    if (!auth.ready) await auth.fetchMe()

    if (to.meta.public) {
        return auth.isAuthed ? '/' : true   // 已登录别再去登录页
    }
    if (!auth.isAuthed) return '/login'
    if (to.meta.admin && !auth.isAdmin) return '/'
    return true
})

export default router