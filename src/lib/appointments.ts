import { CalendarClock, CircleCheck, CircleX, RefreshCw, UserCheck, UserX, type LucideIcon } from 'lucide-react'
import { api } from './api'

export type AppointmentStatus = 'scheduled' | 'checked_in' | 'completed' | 'cancelled' | 'no_show' | 'needs_reschedule'

export type Appointment = {
  id: number
  patient: number
  patient_name?: string
  patient_phone?: string
  doctor: number
  doctor_name?: string
  clinic?: number
  clinic_name?: string
  doctor_notes?: string
  starts_at: string
  ends_at: string
  reason: string
  status: AppointmentStatus
  priority?: string
  source: string
}

export type Doctor = {
  id: number
  full_name: string
  specialty?: string
  consultation_minutes?: number
  available_from?: string | null
  available_to?: string | null
  lunch_from?: string | null
  lunch_to?: string | null
  working_days?: number[] | null
}

export type PatientOption = { id: number; full_name: string; phone?: string }

export const STATUS_META: Record<AppointmentStatus, { label: string; icon: LucideIcon; badge: string }> = {
  scheduled: { label: 'Scheduled', icon: CalendarClock, badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  checked_in: { label: 'Checked in', icon: UserCheck, badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  completed: { label: 'Completed', icon: CircleCheck, badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  needs_reschedule: { label: 'Needs reschedule', icon: RefreshCw, badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  no_show: { label: 'No show', icon: UserX, badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  cancelled: { label: 'Cancelled', icon: CircleX, badge: 'bg-slate-100 text-slate-600 border-slate-200' },
}

export const statusMeta = (status: string) => STATUS_META[status as AppointmentStatus] ?? STATUS_META.scheduled

/** Who made the booking: `phone` is the AI receptionist's booking tool, the rest are staff. */
export const SOURCES = [
  { value: 'phone', label: 'AI agent', badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'whatsapp', label: 'WhatsApp', badge: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'front_desk', label: 'Front desk', badge: 'bg-slate-50 text-slate-700 border-slate-200' },
  { value: 'walk_in', label: 'Walk-in', badge: 'bg-sky-50 text-sky-700 border-sky-200' },
] as const

export function sourceMeta(source: string) {
  return SOURCES.find((s) => s.value === source) ?? { value: source, label: 'Front desk', badge: 'bg-slate-50 text-slate-700 border-slate-200' }
}

/** Statuses that still hold the doctor's time and can be moved or cancelled. */
export const isOpen = (status: string) => status === 'scheduled' || status === 'needs_reschedule'

/** The API's validation message ("This time slot overlaps…"), or a fallback. */
export function apiErrorMessage(err: unknown, fallback: string) {
  const data = (err as { response?: { data?: unknown } })?.response?.data
  if (!data || typeof data !== 'object') return fallback
  const record = data as Record<string, unknown>
  const first = (v: unknown): string | undefined => (Array.isArray(v) ? first(v[0]) : typeof v === 'string' ? v : undefined)
  return first(record.non_field_errors) ?? first(record.detail) ?? first(Object.values(record)[0]) ?? fallback
}

const pad = (n: number) => String(n).padStart(2, '0')

/** yyyy-MM-dd and HH:mm in the browser's local time, for <input type="date"> and <input type="time">. */
export function toDateTimeInputs(date: Date) {
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  }
}

export const fromDateTimeInputs = (date: string, time: string) => new Date(`${date}T${time}:00`)

/** "09:00:00" → "9:00 am" */
export function formatClock(value?: string | null) {
  if (!value) return ''
  const [h, m] = value.split(':').map(Number)
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'am' : 'pm'}`
}

const unwrap = <T,>(data: unknown): T[] =>
  Array.isArray(data) ? (data as T[]) : Array.isArray((data as { results?: unknown })?.results) ? (data as { results: T[] }).results : []

export const listDoctors = () => api.get('/doctors/', { params: { page_size: 100 } }).then((r) => unwrap<Doctor>(r.data))

export const searchPatients = (search: string) =>
  api.get('/patients/', { params: { page_size: 20, ...(search ? { search } : {}) } }).then((r) => unwrap<PatientOption>(r.data))
