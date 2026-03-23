import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_box0/agents')({
  component: AgentsPage,
})

function AgentsPage() {
  return (
    <>
      <div className="page-header">
        <h2>Agents</h2>
      </div>
      <div className="empty-state">
        <p>Agent list and actions will use GET workspace-scoped /agents.</p>
      </div>
    </>
  )
}
