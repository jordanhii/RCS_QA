/**
 * authStore — 登录态（JWT 存 httpOnly cookie，前端只保存用户信息）
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

const API = 'http://localhost:3000/api'

export const useAuthStore = defineStore('auth', () => {
    const user  = ref(null)     // { id, username, role } | null
    const ready = ref(false)    // 是否已向后端确认过登录态

    const isAuthed = computed(() => !!user.value)
    const isAdmin  = computed(() => user.value?.role === 'admin')

    /** 用 cookie 向后端确认当前登录用户（应用启动 / 刷新时调用一次）*/
    async function fetchMe() {
        try {
            const { data } = await axios.get(`${API}/auth/me`)
            user.value = data.user
        } catch {
            user.value = null
        } finally {
            ready.value = true
        }
    }

    /** 第①步：用户名 + 密码。返回 { step:'otp', enroll, qr?, secret? } */
    async function loginStep1(username, password) {
        const { data } = await axios.post(`${API}/auth/login`, { username, password })
        return data
    }

    /** 第②步：OTP 验证码。成功后写入 user */
    async function loginStep2(code) {
        const { data } = await axios.post(`${API}/auth/login/otp`, { code })
        user.value = data.user
        return data
    }

    async function logout() {
        try { await axios.post(`${API}/auth/logout`) } catch { /* ignore */ }
        user.value = null
    }

    return { user, ready, isAuthed, isAdmin, fetchMe, loginStep1, loginStep2, logout }
})
