import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import './assets/styles/theme.css'
import App from './App.vue'
import router from './router'
import { ElNotification } from 'element-plus'
import axios from 'axios'

// ── 鉴权：所有请求带上 httpOnly cookie；401 自动踢回登录页 ──────────────────
axios.defaults.withCredentials = true
axios.interceptors.response.use(
    r => r,
    err => {
        const url = err.config?.url || ''
        if (err.response?.status === 401 && !url.includes('/auth/') && router.currentRoute.value.path !== '/login') {
            router.replace('/login')
        }
        return Promise.reject(err)
    },
)

const app = createApp(App)
app.use(createPinia())
app.use(ElementPlus, { locale: zhCn })
app.use(router)

// 全局设定：所有 toast 从右下角弹出
const _origNotify = ElNotification
const patchedNotify = (options) => {
    if (typeof options === 'string') options = { message: options }
    return _origNotify({ position: 'bottom-right', ...options })
}
;['success', 'warning', 'error', 'info'].forEach(type => {
    patchedNotify[type] = (options) => {
        if (typeof options === 'string') options = { message: options }
        return _origNotify[type]({ position: 'bottom-right', ...options })
    }
})
app.config.globalProperties.$notify = patchedNotify

app.mount('#app')