import { api } from './api'

/** The hospital's calls about an appointment: the reminder the day before, and the feedback call after the visit. */
export type PatientCallKind = 'reminder' | 'feedback'
export type PatientCallStatus = 'scheduled' | 'calling' | 'done' | 'no_answer' | 'skipped'
export type PatientCallResult = '' | 'confirmed' | 'cancel' | 'reschedule' | 'rated'
/** What the front desk has to do now: make the call, call back after no answer, a low rating, a review link. */
export type PatientCallNeeds = 'call' | 'call_back' | 'unhappy' | 'send_review' | null

export type PatientCall = {
  id: number
  appointment: number
  kind: PatientCallKind
  status: PatientCallStatus
  due_at: string
  attempts: number
  last_attempt_at: string | null
  result: PatientCallResult
  rating: number | null
  comment: string
  review_sent_at: string | null
  resolved_at: string | null
  patient: number
  patient_name: string
  patient_phone: string
  doctor_name: string
  appointment_starts_at: string
  appointment_status: string
  needs: PatientCallNeeds
}

export type PatientCallSettings = {
  reminder_enabled: boolean
  reminder_time: string
  reminder_attempts: number
  retry_after_minutes: number
  feedback_enabled: boolean
  feedback_time: string
  review_url: string
  review_min_rating: number
  /** The AI places the calls itself, within calling hours. */
  ai_calls_enabled: boolean
  call_window_start: string
  call_window_end: string
  /** Why this server can't place AI calls (read-only); empty when it can. */
  ai_calls_problem?: string
  /** What the AI says on these calls (AI Agent → Call scripts); empty means the default. */
  reminder_first_message: string
  reminder_script: string
  feedback_first_message: string
  feedback_script: string
  /** Read-only, for the script editor. */
  script_defaults?: Record<PatientCallKind, { first_message: string; script: string }>
  script_system_parts?: Record<PatientCallKind, string>
  script_placeholders?: Record<string, string>
}

export type ReminderOutcome = 'confirmed' | 'cancel' | 'reschedule' | 'no_answer'
export type FeedbackOutcome = 'rated' | 'no_answer'

const base = '/appointments/patient-calls/'

export const getCallsToDo = () => api.get<PatientCall[]>(base, { params: { todo: 1 } }).then((r) => r.data)
export const getAppointmentCalls = (appointmentId: number) =>
  api.get<PatientCall[]>(base, { params: { appointment: appointmentId } }).then((r) => r.data)

export const recordCall = (id: number, outcome: ReminderOutcome | FeedbackOutcome, extra: { rating?: number; comment?: string } = {}) =>
  api.post<PatientCall>(`${base}${id}/record/`, { outcome, ...extra }).then((r) => r.data)
/** The AI dials this patient now. */
export const callWithAI = (id: number) => api.post<PatientCall>(`${base}${id}/call-now/`).then((r) => r.data)
export const markReviewSent = (id: number) => api.post<PatientCall>(`${base}${id}/review-sent/`).then((r) => r.data)
export const resolveCall = (id: number) => api.post<PatientCall>(`${base}${id}/resolve/`).then((r) => r.data)

export const getCallSettings = () => api.get<PatientCallSettings>(`${base}settings/`).then((r) => r.data)
export const saveCallSettings = (values: Partial<PatientCallSettings>) =>
  api.put<PatientCallSettings>(`${base}settings/`, values).then((r) => r.data)

export const REMINDER_RESULT_TEXT: Record<string, string> = {
  confirmed: 'Confirmed they will come',
  cancel: 'Asked to cancel',
  reschedule: 'Asked to reschedule',
}
