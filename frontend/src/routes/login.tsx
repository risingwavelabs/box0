import { createFileRoute, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import {
  apiGet,
  getStoredApiKey,
  setStoredApiKey,
  validateApiKey,
} from '~/lib/box0-api'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [key, setKey] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const existing = getStoredApiKey()
    if (!existing) return
    apiGet('/workspaces')
      .then(() => {
        navigate({ to: '/tasks' })
      })
      .catch(() => {})
  }, [navigate])

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlKey = params.get('key')
    if (!urlKey) return
    window.history.replaceState({}, '', window.location.pathname)
    validateApiKey(urlKey).then((ok) => {
      if (ok) {
        setStoredApiKey(urlKey)
        navigate({ to: '/tasks' })
      }
    })
  }, [navigate])

  const onSubmit = async () => {
    const trimmed = key.trim()
    if (!trimmed) return
    setError(null)
    const ok = await validateApiKey(trimmed)
    if (!ok) {
      setError('Invalid API key')
      return
    }
    setStoredApiKey(trimmed)
    navigate({ to: '/tasks' })
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <h1>Box0</h1>
        <p>Enter your API key to access the dashboard.</p>
        {error ? (
          <div className="login-error" style={{ display: 'block' }}>
            {error}
          </div>
        ) : (
          <div className="login-error" />
        )}
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void onSubmit()}
          placeholder="API key"
          autoComplete="off"
        />
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={() => void onSubmit()}
        >
          Sign in
        </button>
      </div>
    </div>
  )
}
