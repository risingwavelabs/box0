import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/_box0/machines/$machineId')({
  component: MachineDetailPage,
})

function MachineDetailPage() {
  const { machineId } = Route.useParams()
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Link
          to="/machines"
          style={{
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: 13,
          }}
        >
          &larr; Machines
        </Link>
      </div>
      <div className="page-header">
        <h2>{decodeURIComponent(machineId)}</h2>
      </div>
      <div className="card">
        <div className="card-header">Agents on this machine</div>
        <div className="card-body">
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Detail view to match the reference HTML app.
          </p>
        </div>
      </div>
    </>
  )
}
