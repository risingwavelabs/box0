import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/_box0/tasks/$taskId')({
  component: TaskDetailPage,
})

function TaskDetailPage() {
  const { taskId } = Route.useParams()
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Link
          to="/tasks"
          style={{
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: 13,
          }}
        >
          &larr; Tasks
        </Link>
      </div>
      <div className="page-header">
        <h2>Task</h2>
      </div>
      <div className="card">
        <div className="card-body">
          <dl className="detail-grid">
            <dt>ID</dt>
            <dd style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{taskId}</dd>
          </dl>
        </div>
      </div>
    </>
  )
}
