import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import * as React from 'react'
import {
  apiGet,
  clearStoredAuth,
  getStoredApiKey,
  getStoredWorkspace,
  setStoredWorkspace,
} from '~/lib/box0-api'

type WorkspacesResponse = { workspaces?: { name: string }[] }

export const Route = createFileRoute('/_box0')({
  beforeLoad: () => {
    if (typeof window === 'undefined') return
    if (!getStoredApiKey()) throw redirect({ to: '/login' })
  },
  component: Box0Layout,
})

function Box0Layout() {
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = React.useState<{ name: string }[]>([])
  const [workspace, setWorkspace] = React.useState<string>(() => {
    return getStoredWorkspace() || ''
  })

  React.useEffect(() => {
    apiGet<WorkspacesResponse>('/workspaces')
      .then((data) => {
        const list = data.workspaces || []
        setWorkspaces(list)
        const saved = getStoredWorkspace()
        if (saved && list.some((w) => w.name === saved)) {
          setWorkspace(saved)
        } else if (list[0]) {
          setWorkspace(list[0].name)
          setStoredWorkspace(list[0].name)
        }
      })
      .catch(() => {
        clearStoredAuth()
        navigate({ to: '/login' })
      })
  }, [navigate])

  const onWorkspaceChange = (name: string) => {
    setWorkspace(name)
    setStoredWorkspace(name)
  }

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-logo">
          Box<span>0</span>
        </div>
        <div className="sidebar-nav">
          <Link
            to="/tasks"
            activeOptions={{ exact: false }}
            activeProps={{ className: 'active' }}
            className=""
          >
            <span className="nav-icon">T</span> Tasks
          </Link>
        </div>
        <div
          className="sidebar-nav"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: 8,
          }}
        >
          <Link
            to="/agents"
            activeProps={{ className: 'active' }}
            style={{ fontSize: 13, opacity: 0.7 }}
          >
            <span className="nav-icon">A</span> Agents
          </Link>
          <Link
            to="/machines"
            activeProps={{ className: 'active' }}
            style={{ fontSize: 13, opacity: 0.7 }}
          >
            <span className="nav-icon">M</span> Machines
          </Link>
          <Link
            to="/users"
            activeProps={{ className: 'active' }}
            style={{ fontSize: 13, opacity: 0.7 }}
          >
            <span className="nav-icon">U</span> Users
          </Link>
        </div>
        <div className="sidebar-group">
          <label>Workspace</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select
              value={workspace}
              onChange={(e) => onWorkspaceChange(e.target.value)}
              style={{ flex: 1 }}
            >
              {workspaces.map((w) => (
                <option key={w.name} value={w.name}>
                  {w.name}
                </option>
              ))}
            </select>
            <Link
              to="/workspaces"
              title="Manage workspaces"
              style={{
                color: 'var(--text-sidebar)',
                opacity: 0.5,
                fontSize: 16,
                textDecoration: 'none',
                padding: 2,
              }}
            >
              &#9881;
            </Link>
          </div>
        </div>
        <div className="sidebar-footer">
          <div className="user-name" />
          <button
            type="button"
            onClick={() => {
              clearStoredAuth()
              navigate({ to: '/login' })
            }}
          >
            Sign out
          </button>
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
