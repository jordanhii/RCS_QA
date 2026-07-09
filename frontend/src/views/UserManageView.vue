<template>
    <div class="user-page">
        <div class="page-header">
            <div>
                <h2 class="page-title">用户管理</h2>
                <p class="page-subtitle">管理登录账号、密码与 Google Authenticator 绑定</p>
            </div>
            <el-button type="primary" @click="openAdd">
                <el-icon style="margin-right:5px;"><Plus /></el-icon> 添加用户
            </el-button>
        </div>

        <div class="section-label">用户列表</div>
        <div class="config-panel">
            <el-table :data="users" v-loading="loading" border size="small" style="width:100%">
                <el-table-column prop="username" label="用户名" min-width="160">
                    <template #default="{ row }">
                        {{ row.username }}
                        <el-tag v-if="row.role === 'admin'" type="warning" size="small" effect="plain" style="margin-left:6px;">管理员</el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="OTP" width="120" align="center">
                    <template #default="{ row }">
                        <el-tag :type="row.otpEnabled ? 'success' : 'info'" size="small">
                            {{ row.otpEnabled ? '已绑定' : '未绑定' }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="创建时间" width="180">
                    <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="140" align="center">
                    <template #default="{ row }">
                        <el-tooltip content="重置密码" placement="top">
                            <el-button link type="primary" @click="openReset(row)"><el-icon :size="17"><Key /></el-icon></el-button>
                        </el-tooltip>
                        <el-tooltip content="重置 OTP" placement="top">
                            <el-button link type="warning" @click="resetOtp(row)"><el-icon :size="17"><Refresh /></el-icon></el-button>
                        </el-tooltip>
                        <el-tooltip content="删除用户" placement="top">
                            <el-button link type="danger" @click="removeUser(row)"><el-icon :size="17"><Delete /></el-icon></el-button>
                        </el-tooltip>
                    </template>
                </el-table-column>
            </el-table>
        </div>

        <!-- 添加用户 -->
        <el-dialog v-model="addVisible" title="添加用户" width="440px" :close-on-click-modal="false">
            <el-form label-width="72px">
                <el-form-item label="用户名">
                    <el-input v-model="addForm.username" placeholder="登录用户名" clearable />
                </el-form-item>
                <el-form-item label="密码">
                    <el-input v-model="addForm.password" type="password" show-password placeholder="8–16 位，含数字、字母、特殊符号" />
                </el-form-item>
                <p class="pw-hint" :class="{ ok: pwOk(addForm.password) }">{{ pwMsg(addForm.password) }}</p>
            </el-form>
            <template #footer>
                <el-button @click="addVisible = false">取消</el-button>
                <el-button type="primary" :loading="busy" :disabled="!addForm.username || !pwOk(addForm.password)" @click="doAdd">创建</el-button>
            </template>
        </el-dialog>

        <!-- 重置密码 -->
        <el-dialog v-model="resetVisible" :title="`重置密码 — ${resetTarget?.username || ''}`" width="440px" :close-on-click-modal="false">
            <el-form label-width="72px">
                <el-form-item label="新密码">
                    <el-input v-model="newPassword" type="password" show-password placeholder="8–16 位，含数字、字母、特殊符号" />
                </el-form-item>
                <p class="pw-hint" :class="{ ok: pwOk(newPassword) }">{{ pwMsg(newPassword) }}</p>
            </el-form>
            <template #footer>
                <el-button @click="resetVisible = false">取消</el-button>
                <el-button type="primary" :loading="busy" :disabled="!pwOk(newPassword)" @click="doReset">确定</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'
import { ElNotification, ElMessageBox } from 'element-plus'
import { Plus, Key, Refresh, Delete } from '@element-plus/icons-vue'

const API = 'http://localhost:3000/api'
const users = ref([])
const loading = ref(false)
const busy = ref(false)

const fmt = (d) => d ? new Date(d).toLocaleString('zh-CN', { hour12: false }) : '—'
const fail = (e) => ElNotification.error({ message: e?.response?.data?.error || '操作失败', position: 'bottom-right' })

// ── 密码策略（与后端一致）─────────────────────────────────────────────────
function pwOk(pw) {
    return typeof pw === 'string' && pw.length >= 8 && pw.length <= 16 &&
        /[0-9]/.test(pw) && /[a-zA-Z]/.test(pw) && /[^0-9a-zA-Z]/.test(pw)
}
function pwMsg(pw) {
    if (!pw) return '8–16 位，需同时含数字、字母、特殊符号'
    if (pw.length < 8 || pw.length > 16) return '长度需 8–16 位'
    if (!/[0-9]/.test(pw)) return '需包含数字'
    if (!/[a-zA-Z]/.test(pw)) return '需包含字母'
    if (!/[^0-9a-zA-Z]/.test(pw)) return '需包含特殊符号'
    return '✓ 密码符合要求'
}

async function load() {
    loading.value = true
    try { users.value = (await axios.get(`${API}/users`)).data } catch (e) { fail(e) } finally { loading.value = false }
}
onMounted(load)

// ── 添加 ─────────────────────────────────────────────────────────────────--
const addVisible = ref(false)
const addForm = reactive({ username: '', password: '' })
function openAdd() { addForm.username = ''; addForm.password = ''; addVisible.value = true }
async function doAdd() {
    busy.value = true
    try {
        await axios.post(`${API}/users`, { username: addForm.username.trim(), password: addForm.password })
        ElNotification.success({ message: '用户已创建', position: 'bottom-right' })
        addVisible.value = false
        await load()
    } catch (e) { fail(e) } finally { busy.value = false }
}

// ── 重置密码 ─────────────────────────────────────────────────────────────--
const resetVisible = ref(false)
const resetTarget = ref(null)
const newPassword = ref('')
function openReset(row) { resetTarget.value = row; newPassword.value = ''; resetVisible.value = true }
async function doReset() {
    busy.value = true
    try {
        await axios.post(`${API}/users/${resetTarget.value.id}/reset-password`, { password: newPassword.value })
        ElNotification.success({ message: '密码已重置', position: 'bottom-right' })
        resetVisible.value = false
    } catch (e) { fail(e) } finally { busy.value = false }
}

// ── 重置 OTP ─────────────────────────────────────────────────────────────--
async function resetOtp(row) {
    try {
        await ElMessageBox.confirm(`重置「${row.username}」的 OTP？该用户下次登录需重新扫码绑定。`, '重置 OTP', { type: 'warning', confirmButtonText: '重置', cancelButtonText: '取消' })
    } catch { return }
    try {
        await axios.post(`${API}/users/${row.id}/reset-otp`)
        ElNotification.success({ message: 'OTP 已重置，该用户下次登录将重新绑定', position: 'bottom-right' })
        await load()
    } catch (e) { fail(e) }
}

// ── 删除 ─────────────────────────────────────────────────────────────────--
async function removeUser(row) {
    try {
        await ElMessageBox.confirm(`确定删除用户「${row.username}」？此操作不可恢复。`, '删除用户', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    } catch { return }
    try {
        await axios.delete(`${API}/users/${row.id}`)
        ElNotification.success({ message: '用户已删除', position: 'bottom-right' })
        await load()
    } catch (e) { fail(e) }
}
</script>

<style scoped>
.user-page { display: flex; flex-direction: column; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
.page-title    { margin: 0 0 3px; font-size: 20px; font-weight: 700; color: var(--qa-heading-color); }
.page-subtitle { margin: 0; font-size: 13px; color: var(--qa-subtext-color); }
.section-label {
    display: flex; align-items: center; gap: 8px;
    font-size: 14px; font-weight: 700; color: var(--qa-heading-color); margin-bottom: 12px;
}
.section-label::before { content: ''; width: 3px; height: 14px; border-radius: 2px; background: #409EFF; }
.config-panel { background: #fff; border: 1px solid #ebeef5; border-radius: 12px; padding: 20px 22px; box-shadow: var(--qa-shadow-xs); }
.pw-hint { margin: 0; font-size: 12px; color: #E6A23C; padding-left: 72px; }
.pw-hint.ok { color: var(--qa-pass); }
</style>
