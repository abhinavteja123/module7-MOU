export type AuthUser = {
  id: string
  email: string
  display_name: string
  role?: 'user' | 'super_admin'
  access_level?: 'view' | 'edit'
}

export type ManagedUser = AuthUser & { is_active: boolean; created_at?: string }

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const tokenKey = 'mou_tracker_access_token'
const userKey = 'mou_tracker_user'
export const isLiveMode = Boolean(import.meta.env.VITE_API_URL)

export function getAuthUser(): AuthUser | null {
  const raw = localStorage.getItem(userKey)
  return raw ? JSON.parse(raw) as AuthUser : null
}

export function getAccessToken() { return localStorage.getItem(tokenKey) }

export function clearAuth() { localStorage.removeItem(tokenKey); localStorage.removeItem(userKey) }

export async function login(email: string, password: string) {
  const result = await fetch(`${apiBase}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  if (!result.ok) throw new Error((await result.json().catch(() => null))?.detail || 'Unable to sign in')
  const payload = await result.json() as { access_token: string; user: AuthUser }
  localStorage.setItem(tokenKey, payload.access_token)
  localStorage.setItem(userKey, JSON.stringify(payload.user))
  return payload.user
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${apiBase}${path}`, { ...init, headers })
  if (response.status === 401) clearAuth()
  if (!response.ok) throw new Error((await response.text()) || `API request failed (${response.status})`)
  return response.json() as Promise<T>
}

export async function getLiveCompanies() { return request<{ data: any[] }>('/companies') }
export async function getLiveUsers() { return request<{ data: ManagedUser[] }>('/users') }
export async function createLiveUser(payload: { email: string; display_name: string; password: string; access_level: 'view' | 'edit' }) { return request<{ data: ManagedUser }>('/users', { method: 'POST', body: JSON.stringify(payload) }) }
export async function updateLiveUserAccess(userId: string, access_level: 'view' | 'edit') { return request<{ data: ManagedUser }>(`/users/${userId}/access`, { method: 'PATCH', body: JSON.stringify({ access_level }) }) }
export async function removeLiveUser(userId: string) { return request<{ data: ManagedUser }>(`/users/${userId}`, { method: 'DELETE' }) }
export async function resetLiveUserPassword(userId: string, new_password: string) { return request<{ ok: boolean }>(`/users/${userId}/password`, { method: 'PUT', body: JSON.stringify({ new_password }) }) }
export async function changeOwnPassword(current_password: string, new_password: string) { return request<{ ok: boolean }>('/auth/password', { method: 'PUT', body: JSON.stringify({ current_password, new_password }) }) }
export async function createLiveCompany(payload: Record<string, unknown>) { return request<{ data: any }>('/companies', { method: 'POST', body: JSON.stringify(payload) }) }
export async function updateLiveCompany(companyId: string, payload: Record<string, unknown>) { return request<{ data: any }>(`/companies/${companyId}`, { method: 'PATCH', body: JSON.stringify(payload) }) }
export async function changeLiveStatus(mouId: string, payload: Record<string, unknown>) { return request<{ data: any }>(`/mous/${mouId}/status`, { method: 'POST', body: JSON.stringify(payload) }) }
export async function addLiveActivity(companyId: string, payload: Record<string, unknown>) { return request<{ data: any }>(`/companies/${companyId}/activities`, { method: 'POST', body: JSON.stringify(payload) }) }
export async function getLivePdfUrl(mouId: string) { return request<{ data: { url: string } }>(`/mous/${mouId}/pdf-url`) }
export async function uploadLivePdf(mouId: string, file: File) {
  const form = new FormData(); form.append('file', file)
  const headers = new Headers(); const token = getAccessToken(); if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${apiBase}/mous/${mouId}/pdf`, { method: 'POST', headers, body: form })
  if (!response.ok) throw new Error(await response.text())
  return response.json() as Promise<{ data: { path: string; filename: string } }>
}
