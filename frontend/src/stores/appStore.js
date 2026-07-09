/**
 * appStore — shared global state via Pinia
 *
 * Centralises QA config and RC env list so every view
 * reads from the same reactive source instead of fetching independently.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || '/api'

export const useAppStore = defineStore('app', () => {
    // ── QA global config ───────────────────────────────────────────────────────
    const qaConfig       = ref({ syncIntervalMin: 1, syncPageSize: 200 })
    const qaConfigLoaded = ref(false)

    async function loadQAConfig(force = false) {
        if (qaConfigLoaded.value && !force) return
        try {
            const { data } = await axios.get(`${API}/qa-config`)
            qaConfig.value       = data
            qaConfigLoaded.value = true
        } catch (e) {
            console.warn('[appStore] loadQAConfig failed:', e.message)
        }
    }

    // ── RC environment list ────────────────────────────────────────────────────
    const rcEnvOptions = ref([])
    const rcEnvsLoaded = ref(false)

    async function loadRcEnvs(force = false) {
        if (rcEnvsLoaded.value && !force) return
        try {
            const { data } = await axios.get(`${API}/qa-config`)
            rcEnvOptions.value = data.rcEnvs || []
            rcEnvsLoaded.value = true
        } catch (e) {
            console.warn('[appStore] loadRcEnvs failed:', e.message)
        }
    }

    /** Call after saving qa-config to force a fresh fetch next time */
    function invalidate() {
        qaConfigLoaded.value = false
        rcEnvsLoaded.value   = false
    }

    return { qaConfig, rcEnvOptions, loadQAConfig, loadRcEnvs, invalidate }
})
