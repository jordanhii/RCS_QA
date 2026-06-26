<template>
    <div class="login-page">
        <div class="login-card">
            <div class="login-brand">
                <div class="login-logo">QA</div>
                <div>
                    <div class="login-title">RCS QA</div>
                    <div class="login-sub">告警逻辑质检系统</div>
                </div>
            </div>

            <!-- 第①步：用户名 + 密码 -->
            <template v-if="step === 'pwd'">
                <el-form @submit.prevent="doStep1">
                    <el-input v-model="username" placeholder="用户名" size="large" class="login-input" :prefix-icon="User" clearable @keyup.enter="doStep1" />
                    <el-input v-model="password" type="password" placeholder="密码" size="large" class="login-input" :prefix-icon="Lock" show-password @keyup.enter="doStep1" />
                    <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="doStep1">登录</el-button>
                </el-form>
            </template>

            <!-- 第②步：OTP -->
            <template v-else>
                <div class="login-step-label">
                    <el-button link @click="backToPwd" class="login-back"><el-icon><ArrowLeft /></el-icon></el-button>
                    {{ enroll ? '绑定 Google Authenticator' : '输入验证码' }}
                </div>

                <div v-if="enroll" class="otp-enroll">
                    <p class="otp-tip">首次登录：用 <b>Google Authenticator</b> 扫描下方二维码，再输入 App 显示的 6 位验证码完成绑定。</p>
                    <img v-if="qr" :src="qr" alt="OTP QR" class="otp-qr" />
                    <p class="otp-secret">无法扫码？手动输入密钥：<code>{{ secret }}</code></p>
                </div>
                <p v-else class="otp-tip">请输入 <b>Google Authenticator</b> 中显示的 6 位验证码。</p>

                <el-input v-model="code" placeholder="6 位验证码" size="large" class="login-input otp-code"
                    maxlength="6" :prefix-icon="Key" @keyup.enter="doStep2" />
                <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="doStep2">
                    {{ enroll ? '绑定并登录' : '登录' }}
                </el-button>
            </template>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElNotification } from 'element-plus'
import { User, Lock, Key, ArrowLeft } from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/authStore.js'

const router = useRouter()
const auth = useAuthStore()

const step = ref('pwd')     // 'pwd' | 'otp'
const username = ref('')
const password = ref('')
const code = ref('')
const enroll = ref(false)
const qr = ref('')
const secret = ref('')
const loading = ref(false)

const fail = (e) => ElNotification.error({ message: e?.response?.data?.error || '操作失败', position: 'bottom-right' })

async function doStep1() {
    if (!username.value || !password.value) return ElNotification.warning({ message: '请输入用户名和密码', position: 'bottom-right' })
    loading.value = true
    try {
        const data = await auth.loginStep1(username.value.trim(), password.value)
        enroll.value = !!data.enroll
        qr.value = data.qr || ''
        secret.value = data.secret || ''
        code.value = ''
        step.value = 'otp'
    } catch (e) { fail(e) } finally { loading.value = false }
}

async function doStep2() {
    if (!/^\d{6}$/.test(code.value.trim())) return ElNotification.warning({ message: '请输入 6 位验证码', position: 'bottom-right' })
    loading.value = true
    try {
        await auth.loginStep2(code.value.trim())
        ElNotification.success({ message: '登录成功', position: 'bottom-right' })
        router.replace('/')
    } catch (e) { fail(e) } finally { loading.value = false }
}

function backToPwd() { step.value = 'pwd'; code.value = '' }
</script>

<style scoped>
.login-page {
    position: relative;
    min-height: 100vh;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    overflow: hidden;
    background:
        radial-gradient(900px 600px at 12% 18%, rgba(64,169,255,0.18), transparent 60%),
        radial-gradient(800px 600px at 88% 82%, rgba(105,192,255,0.16), transparent 60%),
        linear-gradient(135deg, #eaf1fb 0%, #dde7f5 100%);
}
/* 装饰光斑，避免大白屏单调 */
.login-page::before,
.login-page::after {
    content: ''; position: absolute; border-radius: 50%; filter: blur(8px); pointer-events: none;
}
.login-page::before {
    width: 320px; height: 320px; top: -90px; left: -80px;
    background: radial-gradient(circle, rgba(22,119,255,0.20), transparent 70%);
}
.login-page::after {
    width: 380px; height: 380px; bottom: -120px; right: -100px;
    background: radial-gradient(circle, rgba(9,88,217,0.16), transparent 70%);
}
.login-card {
    position: relative; z-index: 1;
    width: 380px;
    background: rgba(255,255,255,0.96);
    backdrop-filter: blur(6px);
    border: 1px solid rgba(255,255,255,0.7);
    border-radius: 16px;
    box-shadow: 0 18px 50px rgba(30,64,124,0.18), 0 4px 12px rgba(30,64,124,0.08);
    padding: 34px 32px 36px;
    overflow: hidden;
}
/* 顶部主色条 */
.login-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
    background: linear-gradient(90deg, #1677ff, #69c0ff);
}
.login-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 26px; }
.login-logo {
    width: 44px; height: 44px; border-radius: 10px;
    background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%);
    color: #fff; font-weight: 800; font-size: 15px;
    display: flex; align-items: center; justify-content: center;
}
.login-title { font-size: 18px; font-weight: 700; color: var(--qa-heading-color); }
.login-sub   { font-size: 12px; color: var(--qa-subtext-color); margin-top: 2px; }

.login-step-label {
    display: flex; align-items: center; gap: 4px;
    font-size: 15px; font-weight: 600; color: var(--qa-heading-color); margin-bottom: 18px;
}
.login-back { padding: 0; margin-right: 2px; }
.login-input { margin-bottom: 16px; }
.login-btn { width: 100%; margin-top: 4px; }

.otp-enroll { text-align: center; margin-bottom: 8px; }
.otp-tip { font-size: 13px; color: #5e6d82; line-height: 1.7; margin: 0 0 14px; }
.otp-qr { width: 180px; height: 180px; border: 1px solid #ebeef5; border-radius: 10px; padding: 6px; }
.otp-secret { font-size: 12px; color: #909399; margin: 12px 0 16px; word-break: break-all; }
.otp-secret code { background: #f2f6fc; padding: 1px 6px; border-radius: 4px; color: #3a6fcc; }
.otp-code :deep(input) { letter-spacing: 4px; }

.login-footer { margin-top: 18px; font-size: 12px; color: #c0c4cc; }
</style>
