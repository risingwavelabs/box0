const API_KEY = 'b0_api_key'
const WORKSPACE_KEY = 'b0_workspace'

export function getStoredApiKey(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(API_KEY)
}

export function setStoredApiKey(key: string) {
  localStorage.setItem(API_KEY, key)
}

export function clearStoredAuth() {
  localStorage.removeItem(API_KEY)
  localStorage.removeItem(WORKSPACE_KEY)
}

export function getStoredWorkspace(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(WORKSPACE_KEY)
}

export function setStoredWorkspace(name: string) {
  localStorage.setItem(WORKSPACE_KEY, name)
}

export function apiHeaders(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = getStoredApiKey()
  if (key) h['X-API-Key'] = key
  return h
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(path, { headers: apiHeaders() })
  const data = (await res.json()) as { error?: string }
  if (res.status === 401) {
    clearStoredAuth()
    throw new Error('Unauthorized')
  }
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data as T
}

export async function validateApiKey(key: string): Promise<boolean> {
  const res = await fetch('/workspaces', {
    headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
  })
  return res.ok
}
