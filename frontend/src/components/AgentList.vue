<script setup lang="ts">
import { type Agent, type CronJob } from '../api'

const props = defineProps<{
  agents: Agent[]
  cronJobs: CronJob[]
  selected: string
}>()

const emit = defineEmits<{
  select: [agent: Agent]
}>()

function triggers(agent: Agent): string[] {
  const t: string[] = []
  const cron = props.cronJobs.find(c => c.agent === agent.name)
  if (cron) t.push(`every ${cron.schedule}`)
  if (agent.webhook_enabled) t.push('webhook')
  return t
}
</script>

<template>
  <div style="flex:1;overflow-y:auto;padding:8px">
    <div v-if="!agents.length" style="padding:12px;color:var(--muted);font-size:13px">
      No agents. Use <code style="font-family:var(--mono)">b0 add</code> to create one.
    </div>
    <button
      v-for="agent in agents"
      :key="agent.name"
      class="agent-item"
      :class="{ active: selected === agent.name }"
      @click="emit('select', agent)"
    >
      <div class="agent-name">{{ agent.name }}</div>
      <div class="agent-meta">
        <span class="trigger-tag">{{ triggers(agent).join(', ') || 'manual' }}</span>
        <span :class="['dot', agent.status]" />
      </div>
    </button>
  </div>
</template>

<style scoped>
.agent-item {
  display: block; width: 100%; text-align: left; background: transparent;
  border: 1px solid transparent; border-radius: 6px; padding: 8px 10px;
  margin-bottom: 2px; cursor: pointer; color: var(--text); transition: background 0.1s;
}
.agent-item:hover { background: var(--surface-2); opacity: 1; }
.agent-item.active { background: var(--surface-2); border-color: var(--border); }
.agent-name { font-size: 13px; font-weight: 500; margin-bottom: 3px; }
.agent-meta { display: flex; align-items: center; gap: 6px; }
.trigger-tag { font-size: 11px; color: var(--muted); font-family: var(--mono); }
.dot { width: 5px; height: 5px; border-radius: 50%; margin-left: auto; background: var(--muted); }
.dot.active { background: var(--success); }
</style>
