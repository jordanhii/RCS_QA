import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import './assets/styles/theme.css'
import App from './App.vue'
import router from './router'
import { ElNotification } from 'element-plus'

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