import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/_box0/agents/$name')({
  component: AgentDetailPage,
})

function AgentDetailPage() {
  const { name } = Route.useParams()
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Link
          to="/agents"
          style={{
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: 13,
          }}
        >
          &larr; Agents
        </Link>
      </div>
      <div className="page-header">
        <h2>{decodeURIComponent(name)}</h2>
      </div>
      <div className="card">
        <div className="card-header">Conversations</div>
        <div className="card-body">
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Thread list and inbox UI to be ported from the reference dashboard.
          </p>
        </div>
      </div>
    </>
  )
}
