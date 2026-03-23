import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_box0/tasks')({
  component: TasksPage,
})

function TasksPage() {
  return (
    <>
      <div className="page-header">
        <h2>Tasks</h2>
      </div>
      <div className="card">
        <div className="card-body">
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Task board and chat will connect to the Box0 API here (same behavior
            as the static dashboard in{' '}
            <code style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
              box0-core/web/index.html
            </code>
            ).
          </p>
        </div>
      </div>
    </>
  )
}
