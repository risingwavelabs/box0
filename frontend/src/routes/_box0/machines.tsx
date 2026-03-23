import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_box0/machines')({
  component: MachinesPage,
})

function MachinesPage() {
  return (
    <>
      <div className="page-header">
        <h2>Machines</h2>
      </div>
      <div className="empty-state">
        <p>Machine table will use GET /machines.</p>
      </div>
    </>
  )
}
