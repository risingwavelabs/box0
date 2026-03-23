import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_box0/users')({
  component: UsersPage,
})

function UsersPage() {
  return (
    <>
      <div className="page-header">
        <h2>Users</h2>
      </div>
      <div className="empty-state">
        <p>Admin user list will use GET /users.</p>
      </div>
    </>
  )
}
