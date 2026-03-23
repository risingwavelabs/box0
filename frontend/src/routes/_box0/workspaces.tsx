import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_box0/workspaces')({
  component: WorkspacesPage,
})

function WorkspacesPage() {
  return (
    <>
      <div className="page-header">
        <h2>Workspaces</h2>
      </div>
      <div className="empty-state">
        <p>Create workspace and members flows will use /workspaces APIs.</p>
      </div>
    </>
  )
}
