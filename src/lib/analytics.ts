import { api } from './api'

// ─── API shapes ──────────────────────────────────────────────────────────────

export type AIAnalytics = {
  period_days: number
  summary: {
    total_calls: number
    inbound_calls: number
    outbound_calls: number
    avg_duration_seconds: number
    booking_conversion_rate: number
    calls_with_booking: number
    calls_cancelled: number
    calls_info_only: number
    calls_rescheduled: number
    calls_needs_callback: number
    calls_unanswered: number
    calls_other: number
    patients_reached: number
    total_duration_seconds: number
    /** Test calls in the period, which the numbers above leave out. */
    test_calls: number
  }
  language_breakdown: Record<string, number>
  /** How callers felt; not_rated = no sentiment yet. */
  sentiment_breakdown: Record<Sentiment | 'not_rated', number>
  calls_by_day: { date: string; total: number; converted: number }[]
}

export type Sentiment = 'positive' | 'neutral' | 'negative'

export const SENTIMENTS: { key: Sentiment; label: string; color: string; badge: string }[] = [
  { key: 'positive', label: 'Positive', color: '#22c55e', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'neutral', label: 'Neutral', color: '#94a3b8', badge: 'bg-slate-50 text-slate-600 border-slate-200' },
  { key: 'negative', label: 'Negative', color: '#ef4444', badge: 'bg-red-50 text-red-700 border-red-200' },
]

export const sentimentMeta = (value?: string | null) => SENTIMENTS.find((s) => s.key === value)

export type DoctorAnalytics = {
  period_days: number
  doctors: {
    doctor_id: number
    doctor_name: string
    specialty?: string
    degree?: string
    total_appointments: number
    completed_appointments: number
    avg_wait_seconds: number
    return_rate: number
    appointments_by_day: { date: string; total: number }[]
  }[]
}

export type CallLog = {
  id: number
  patient: number | null
  patient_name: string | null
  /** The number the call was with (caller for inbound, patient for outbound); '' if unknown. */
  phone?: string
  direction: 'inbound' | 'outbound'
  agent_name: string
  language: string
  duration_seconds: number
  outcome: string
  occurred_at: string
  transcript: string
  recording_url?: string | null
  summary?: string
  /** How the caller felt ('' = not rated yet). */
  sentiment?: Sentiment | ''
  /** Made with the app's Test call button by staff, not by a patient. */
  is_test?: boolean
  /** The doctor of the appointment booked or cancelled in the call, if any. */
  doctor?: number | null
  doctor_name?: string | null
}

export type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] }

// ─── Filters ─────────────────────────────────────────────────────────────────

export const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
] as const

export type DatePreset = (typeof DATE_PRESETS)[number]['value'] | 'custom'

/** Dates are yyyy-MM-dd in the browser's local timezone, the clinic's day. */
export type ReportFilters = {
  preset: DatePreset
  start: string
  end: string
  direction: '' | 'inbound' | 'outbound'
  language: string
  /** A doctor's id: only calls that booked or cancelled with them, and only their performance. */
  doctor: string
}

export function localDateKey(date: Date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function rangeForPreset(preset: Exclude<DatePreset, 'custom'>): { start: string; end: string } {
  const today = new Date()
  const daysAgo = (n: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() - n)
    return localDateKey(d)
  }
  switch (preset) {
    case 'today': return { start: daysAgo(0), end: daysAgo(0) }
    case 'yesterday': return { start: daysAgo(1), end: daysAgo(1) }
    case '7d': return { start: daysAgo(6), end: daysAgo(0) }
    case '30d': return { start: daysAgo(29), end: daysAgo(0) }
    case 'month': return { start: localDateKey(new Date(today.getFullYear(), today.getMonth(), 1)), end: daysAgo(0) }
  }
}

/** Query params for the analytics endpoints (local dates; the server reads them in the clinic's timezone). */
function analyticsParams(f: ReportFilters) {
  return {
    start: f.start,
    end: f.end,
    ...(f.direction ? { direction: f.direction } : {}),
    ...(f.language ? { language: f.language } : {}),
    ...(f.doctor ? { doctor: f.doctor } : {}),
  }
}

/** Query params for the call log list, which filters on exact timestamps. */
function callLogParams(f: ReportFilters) {
  return {
    occurred_at_after: new Date(`${f.start}T00:00:00`).toISOString(),
    occurred_at_before: new Date(`${f.end}T23:59:59.999`).toISOString(),
    ...(f.direction ? { direction: f.direction } : {}),
    ...(f.language ? { language: f.language } : {}),
    ...(f.doctor ? { doctor: f.doctor } : {}),
  }
}

// ─── Requests ────────────────────────────────────────────────────────────────

export const getAIAnalytics = (f: ReportFilters) =>
  api.get<AIAnalytics>('/reports/ai-analytics/', { params: analyticsParams(f) }).then((r) => r.data)

export const getDoctorAnalytics = (f: ReportFilters) =>
  api.get<DoctorAnalytics>('/reports/doctor-analytics/', { params: analyticsParams(f) }).then((r) => r.data)

/** Which calls to list: everything, only patients' calls, or only the app's test calls. */
export type CallKind = 'all' | 'patients' | 'tests'

export type CallLogQuery = {
  page: number
  pageSize: number
  search?: string
  outcome?: string
  kind?: CallKind
  /** A sentiment, or 'none' for calls not rated yet. */
  sentiment?: Sentiment | 'none' | ''
}

export const getCallLogs = (f: ReportFilters, q: CallLogQuery) =>
  api.get<Paginated<CallLog>>('/ai/call-logs/', {
    params: {
      ...callLogParams(f),
      page: q.page,
      page_size: q.pageSize,
      ordering: '-occurred_at',
      ...(q.search ? { search: q.search } : {}),
      ...(q.outcome ? { outcome: q.outcome } : {}),
      ...(q.kind === 'patients' ? { is_test: false } : q.kind === 'tests' ? { is_test: true } : {}),
      ...(q.sentiment ? { sentiment: q.sentiment } : {}),
    },
  }).then((r) => r.data)

export const getCallLog = (id: number | string) => api.get<CallLog>(`/ai/call-logs/${id}/`).then((r) => r.data)

/** Download the Reports page as an Excel workbook (summary, daily calls, outcomes, languages, doctors, call logs). */
export async function downloadReport(f: ReportFilters) {
  const res = await api.get<Blob>('/reports/ai-analytics/export/', { params: analyticsParams(f), responseType: 'blob' })
  const named = /filename="([^"]+)"/.exec(String(res.headers['content-disposition'] ?? ''))
  const link = document.createElement('a')
  link.href = URL.createObjectURL(res.data)
  link.download = named?.[1] ?? `call-report_${f.start}_to_${f.end}.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

// ─── Display helpers ─────────────────────────────────────────────────────────

/**
 * What a call came to. The backend tags each call from what the AI's tools did (booked, cancelled,
 * rescheduled) or from the transcript (information only, needs callback); these keywords group the
 * stored values and the server counts them the same way. A call with nothing worth tagging has none.
 */
export const OUTCOMES = [
  { key: 'booked', label: 'Appointment booked', color: '#06B6D4', badge: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
  { key: 'cancel', label: 'Cancelled', color: '#f59e0b', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  { key: 'resched', label: 'Rescheduled', color: '#0ea5e9', badge: 'bg-sky-50 text-sky-800 border-sky-200' },
  { key: 'info', label: 'Information only', color: '#8b5cf6', badge: 'bg-violet-50 text-violet-800 border-violet-200' },
  { key: 'callback', label: 'Needs callback', color: '#f43f5e', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
] as const

export const OTHER_OUTCOME = { key: '', label: 'Other', color: '#94a3b8', badge: 'bg-slate-50 text-slate-700 border-slate-200' }

export function outcomeMeta(outcome: string) {
  const o = (outcome ?? '').toLowerCase()
  return OUTCOMES.find((item) => o.includes(item.key)) ?? OTHER_OUTCOME
}

/** The tag's label; "In progress" while the call is on; '' for a call with nothing worth tagging. */
export function outcomeText(outcome: string) {
  const meta = outcomeMeta(outcome)
  if (meta.key) return meta.label
  if ((outcome ?? '').toLowerCase() === 'in_progress') return 'In progress'
  return ''
}

const LANGUAGES: Record<string, string> = {
  en: 'English', hi: 'Hindi', kn: 'Kannada', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam',
  mr: 'Marathi', bn: 'Bengali', gu: 'Gujarati', pa: 'Punjabi', ar: 'Arabic',
}

export const languageLabel = (code: string) => LANGUAGES[code] ?? LANGUAGES[code.split('-')[0]] ?? code.toUpperCase()

export const LANGUAGE_OPTIONS = Object.entries(LANGUAGES).map(([value, label]) => ({ value, label }))

export function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h) return `${h}h ${m}m`
  return s ? `${m}m ${s}s` : `${m}m`
}
