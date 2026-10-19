import { api } from './api'

export type IntegrationProvider = 'wati' | 'pms' | 'razorpay'
export type IntegrationStatus = 'not_connected' | 'untested' | 'connected' | 'error'

export type Integration = {
  provider: IntegrationProvider
  label: string
  configured: boolean
  status: IntegrationStatus
  settings: Record<string, string>
  /** The credential is never sent back: only whether there is one and its last 4 characters. */
  has_secret: boolean
  secret_hint: string
  last_checked_at: string | null
  last_error: string
  /** WATI and Razorpay: the address to paste into their Webhooks page, and when an event last came through it. */
  webhook_url?: string
  last_message_at?: string | null
  /** Razorpay only: the secret to enter with the webhook, so we can tell its events are real. */
  webhook_secret?: string
}

export type CheckResult = { ok: boolean; message: string; templates: string[]; integration: Integration | null }

export const listIntegrations = () => api.get<Integration[]>('/clinics/integrations/').then((r) => r.data)

/** A blank secret keeps the one already saved. */
export const saveIntegration = (provider: IntegrationProvider, settings: Record<string, string>, secret: string) =>
  api.put<Integration>(`/clinics/integrations/${provider}/`, { settings, ...(secret ? { secret } : {}) }).then((r) => r.data)

/** With no draft, checks what is saved (and records the result); with a draft, checks it without saving. */
export const checkIntegration = (provider: IntegrationProvider, draft?: { settings: Record<string, string>; secret: string }) =>
  api.post<CheckResult>(`/clinics/integrations/${provider}/test/`, draft ? { settings: draft.settings, ...(draft.secret ? { secret: draft.secret } : {}) } : {})
    .then((r) => r.data)

export const disconnectIntegration = (provider: IntegrationProvider) => api.delete(`/clinics/integrations/${provider}/`)

export const STATUS_PILL: Record<IntegrationStatus, { label: string; className: string }> = {
  not_connected: { label: 'Not connected', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  untested: { label: 'Saved, not tested', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  connected: { label: 'Connected', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  error: { label: 'Connection failed', className: 'bg-red-50 text-red-700 ring-red-200' },
}
