<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  getStoredApiKey, setStoredApiKey, clearStoredApiKey,
  getWorkspaces, listAgents, listCronJobs,
  type Agent, type CronJob,
} from './api'
import AgentList from './components/AgentList.vue'
import AgentDetail from './components/AgentDetail.vue'

const authed = ref(false)
const apiKeyInput = ref('')
const loginError = ref('')
const loginLoading = ref(false)

const workspace = ref('')
const agents = ref<Agent[]>([])
const cronJobs = ref<CronJob[]>([])
const selectedAgent = ref<Agent | null>(null)

async function login() {
  loginLoading.value = true
  loginError.value = ''
  setStoredApiKey(apiKeyInput.value.trim())
  try {
    const workspaces = await getWorkspaces()
    if (!workspaces.length) throw new Error('No workspaces found')
    workspace.value = workspaces[0]
    await loadAgents()
    authed.value = true
  } catch (e: any) {
    clearStoredApiKey()
    loginError.value = e.message
  } finally {
    loginLoading.value = false
  }
}

async function loadAgents() {
  const [a, c] = await Promise.all([listAgents(workspace.value), listCronJobs(workspace.value)])
  agents.value = a
  cronJobs.value = c
  if (selectedAgent.value) {
    selectedAgent.value = a.find(ag => ag.name === selectedAgent.value!.name) ?? null
  }
}

function selectAgent(agent: Agent) { selectedAgent.value = agent }

function logout() {
  clearStoredApiKey()
  authed.value = false
  agents.value = []
  selectedAgent.value = null
  apiKeyInput.value = ''
}

onMounted(async () => {
  if (getStoredApiKey()) {
    try {
      const workspaces = await getWorkspaces()
      if (workspaces.length) {
        workspace.value = workspaces[0]
        await loadAgents()
        authed.value = true
      }
    } catch { clearStoredApiKey() }
  }
})
</script>

<template>
  <div v-if="!authed" class="auth-page">
    <div class="auth-card">
      <h1>Box<span style="color:var(--accent)">0</span></h1>
      <p>Enter your API key to access the dashboard.</p>
      <input v-model="apiKeyInput" type="password" placeholder="API key" @keyup.enter="login" />
      <div v-if="loginError" class="error-msg">{{ loginError }}</div>
      <button style="margin-top:12px;width:100%" :disabled="loginLoading || !apiKeyInput" @click="login">
        {{ loginLoading ? 'Signing in...' : 'Sign in' }}
      </button>
    </div>
  </div>

  <div v-else class="layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <span class="logo">Box<span>0</span></span>
      </div>
      <AgentList
        :agents="agents"
        :cron-jobs="cronJobs"
        :selected="selectedAgent?.name ?? ''"
        @select="selectAgent"
      />
      <div style="margin-top:auto;padding:12px;border-top:1px solid var(--border)">
        <button class="secondary" style="width:100%;font-size:12px" @click="logout">Sign out</button>
      </div>
    </aside>

    <main class="main">
      <AgentDetail v-if="selectedAgent" :agent="selectedAgent" :workspace="workspace" />
      <div v-else style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--muted)">
        Select an agent to get started.
      </div>
    </main>
  </div>
</template>
