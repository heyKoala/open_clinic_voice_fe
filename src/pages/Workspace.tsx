// @ts-nocheck
import { useEffect, useMemo, useState, useRef, type FormEvent, type ReactNode } from 'react'
import { Link, Routes, Route, Navigate } from 'react-router-dom'
import {
  Sparkles, LayoutDashboard, CalendarDays, ClipboardList,
  FileBarChart, Settings as SettingsIcon, PhoneCall, ListTodo
} from 'lucide-react'

import { api } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { AmPmTimePicker, formatAmPm } from '../components/ui/AmPmTimePicker'
import { DateTimePickerAmPm } from '../components/ui/DateTimePickerAmPm'
import { AppShell } from '../components/layout/AppShell'
import { CalendarView } from '../components/CalendarView'
import DoctorDashboard from './DoctorDashboard'
import CallLogs from './CallLogs'
import CallDetail from './CallDetail'
import Reports from './Reports'
import Appointments from './Appointments'
import Doctors from './Doctors'
import FrontDesk from './FrontDesk'
import Visits from './Visits'
import { Views } from 'react-big-calendar'
import TeamSettings from './TeamSettings'
import ProfileSettings from './ProfileSettings'
import PatientWorkspace from './PatientWorkspace'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/shadcn/dialog'
import { useQueueWebSocket } from '../lib/useWebSocket'
import { useRealtimeEvents } from '../hooks/useRealtimeEvents'
import { useUIStore } from '../store/uistore'
import ClinicSettings from './ClinicSettings';
import AIAgent from './AIAgent';
import Integrations from './Integrations';
import { BillingPlans } from '../components/settings/BillingPlans';
import { Bot, Plug, Stethoscope } from 'lucide-react';

/** yyyy-MM-dd in the browser's local timezone (toISOString() would give the UTC date). */
function localDateKey(date: Date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function isToday(iso: string) {
  return localDateKey(new Date(iso)) === localDateKey()
}

type Role = 'clinic_admin' | 'doctor' | 'receptionist'

type MeDto = {
  id: number
  email: string
  full_name: string
  role: Role
  clinic_name: string | null
  membership_status?: 'active' | 'invited' | 'suspended' | 'archived'
  is_clinic_admin?: boolean
  is_doctor?: boolean
  is_active?: boolean
  doctor_profile_id?: number | null
  clinic_plan?: string
  clinic_is_onboarded?: boolean
}

type TeamSummaryDto = {
  members: MeDto[]
  seat_usage: Array<{
    role: Role
    role_label: string
    active_users: number
    active_invites: number
    limit: number
  }>
  plan: string
  feature_flags: Record<string, boolean>
  clinic_name: string
}

type SubscriptionSummaryDto = {
  clinic_name: string
  subscription_status: string
  trial_ends_at: string
  plan: string
  feature_flags: Record<string, boolean>
  limits: Record<string, number>
  usage: Record<string, number>
  plan_options: Array<{ value: string; label: string }>
}

type AppointmentDto = {
  id: number
  patient: number
  patient_name?: string
  doctor: number
  starts_at: string
  ends_at: string
  reason: string
  status: string
  source: string
}

type QueueTokenDto = {
  id: number
  patient: number
  patient_name?: string
  doctor: number
  service_date: string
  token_number: number
  status: string
  notes?: string | null
  checked_in_at?: string | null
  served_at?: string | null
  is_active: boolean
}

type PatientDto = {
  id: number
  full_name: string
  // abha_number?: string | null
  date_of_birth?: string | null
  gender?: string | null
  preferred_language?: string | null
  notes?: string | null
}

type DoctorDto = {
  id: number
  full_name: string
  specialty: string
  consultation_minutes: number
  max_patients_per_day: number | null
  available_from: string | null
  available_to: string | null
}

type FollowUpDto = {
  id: number
  patient: number
  patient_name?: string
  doctor: number
  doctor_name?: string
  scheduled_for: string
  method: string
  status: string
  notes: string
  outcome?: string
}

type SymptomSummaryDto = {
  id: number
  summary_text: string
  status: string
  confidence: number
  reviewed_by?: string | null
  reviewed_at?: string | null
  encounter?: { patient?: { full_name?: string } | null; doctor?: { full_name?: string } | null } | null
  call_log?: { agent_name?: string; language?: string; direction?: string } | null
}

type CallLogDto = {
  id: number
  patient_name?: string
  direction: string
  agent_name: string
  language: string
  duration_seconds: number
  outcome: string
  occurred_at: string
  transcript: string
}

type ReportTemplateDto = {
  id: number
  name: string
  report_type_display: string
  format_display: string
  allowed_roles_display: string[]
  retention_days: number
}

type ReportExecutionDto = {
  id: number
  template_name: string
  report_type_display: string
  status_display: string
  is_downloadable: boolean
  download_count: number
  signed_download_url?: string | null
}

function unwrapList<T>(payload: unknown): T[] {
  if (!payload || typeof payload !== 'object') {
    return []
  }
  const data = payload as { results?: unknown;[key: string]: unknown }
  if (Array.isArray(data.results)) {
    return data.results as T[]
  }
  return Array.isArray(payload) ? (payload as T[]) : []
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '—'
  }
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatDate(value?: string | null) {
  if (!value) {
    return '—'
  }
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value))
}

function useCurrentUser() {
  const [user, setUser] = useState<MeDto | null>(null)
  const [clinics, setClinics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reloadUser = async () => {
    try {
      const response = await api.get('/auth/me/')
      setUser(response.data as MeDto)
      const clinicsRes = await api.get('/auth/my-clinics/')
      setClinics(clinicsRes.data)
    } catch {
      setUser(null)
      setError('Please login to continue.')
    }
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const response = await api.get('/auth/me/')
        const clinicsRes = await api.get('/auth/my-clinics/')
        if (active) {
          setUser(response.data as MeDto)
          setClinics(clinicsRes.data)
        }
      } catch {
        if (active) {
          setUser(null)
          setError('Please login to continue.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  return { user, clinics, loading, error, reloadUser }
}

// The frame around every workspace (sidebar, header, page): see components/layout/AppShell.
const WorkspaceShell = AppShell


function StatPill({ label, value, to }: { label: string; value: string; to?: string }) {
  const content = (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
    </>
  )

  if (to) {
    return (
      <Link to={to} className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-slate-100 hover:border-slate-300">
        {content}
      </Link>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      {content}
    </div>
  )
}

type InviteDto = {
  id: number
  email: string
  role: string
  status: string
  created_at: string
}

function AdminConsole({ user, clinics, hasMultiRole, currentView, onSwitchView, reloadUser }: { user: MeDto; clinics?: any[]; hasMultiRole?: boolean; currentView?: string; onSwitchView?: (v: string) => void; reloadUser?: () => Promise<void> }) {
  const [team, setTeam] = useState<TeamSummaryDto | null>(null)
  const [invites, setInvites] = useState<InviteDto[]>([])
  const [subscription, setSubscription] = useState<SubscriptionSummaryDto | null>(null)
  const { addToast } = useUIStore()

  const [loading, setLoading] = useState(true)

  // What Settings → Team and Settings → Billing show; every other page loads its own data.
  const load = async () => {
    setLoading(true)
    try {
      const [teamRes, subscriptionRes, invitesRes] = await Promise.all([
        api.get('/accounts/access/'),
        api.get('/subscriptions/summary/'),
        api.get('/accounts/invites/'),
      ])
      setTeam(teamRes.data as TeamSummaryDto)
      setInvites(unwrapList<InviteDto>(invitesRes.data))
      setSubscription(subscriptionRes.data as SubscriptionSummaryDto)
    } catch {
      addToast('Could not load admin data.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const updatePlan = async (plan: string) => {
    try {
      const response = await api.post('/subscriptions/upgrade/', { plan })
      
      if (response.data?.requires_action) {
        const options = {
          key: response.data.key_id,
          amount: response.data.amount,
          currency: response.data.currency,
          name: "Gunasheela Hospital",
          description: `Upgrade to ${plan} plan`,
          order_id: response.data.razorpay_order_id,
          handler: async function (paymentResponse: any) {
            try {
              await api.post('/subscriptions/verify/', {
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_signature: paymentResponse.razorpay_signature
              })
              await load()
              addToast(`Subscription upgraded to ${plan}.`, 'success')
            } catch (err: any) {
              addToast('Payment verification failed.', 'error')
            }
          },
          prefill: {
            name: user.full_name,
            email: user.email
          },
          theme: {
            color: "#10b981"
          }
        };
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          addToast('Payment failed.', 'error')
        });
        rzp.open();
        return;
      }

      await load()
      addToast(`Subscription switched to ${plan}.`, 'success')
    } catch (error: any) {
      if (error.response?.data) {
        addToast(`Could not change plan: ${JSON.stringify(error.response.data)}`, 'error')
      } else {
        addToast(`Could not change plan: ${error.message}`, 'error')
      }
    }
  }

  return (
    <WorkspaceShell
      user={user}
      clinics={clinics}
      title="Admin console"
      nav={[
        { section: 'Home', label: 'Dashboard', href: '/app/dashboard', icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
        { section: 'Operations', label: 'Calendar', href: '/app/calendar', icon: <CalendarDays className="h-[18px] w-[18px]" /> },
        { section: 'Operations', label: 'Appointments', href: '/app/appointments', icon: <ListTodo className="h-[18px] w-[18px]" /> },
        { section: 'Operations', label: 'Doctors', href: '/app/doctors', icon: <Stethoscope className="h-[18px] w-[18px]" /> },
        { section: 'Patients', label: 'Patients', href: '/app/patients', icon: <ClipboardList className="h-[18px] w-[18px]" /> },
        { section: 'Insights', label: 'Reports', href: '/app/reports', icon: <FileBarChart className="h-[18px] w-[18px]" /> },
        { section: 'Setup', label: 'AI Agent', href: '/app/ai-agent', icon: <Bot className="h-[18px] w-[18px]" /> },
        { section: 'Setup', label: 'Integrations', href: '/app/integrations', icon: <Plug className="h-[18px] w-[18px]" /> },
        { section: 'Setup', label: 'Settings', href: '/app/settings', icon: <SettingsIcon className="h-[18px] w-[18px]" /> },
      ]}
      hasMultiRole={hasMultiRole}
      currentView={currentView}
      onSwitchView={onSwitchView}
    >
      <Routes>
        <Route path="/" element={<Navigate to="dashboard" replace />} />
        <Route path="settings" element={
          <ClinicSettings
            onClinicSaved={reloadUser}
            team={<TeamSettings team={team} invites={invites} loading={loading} load={load} user={user} reloadUser={reloadUser} />}
            billing={<BillingPlans subscription={subscription} onChoosePlan={(plan) => void updatePlan(plan)} />}
          />
        } />
        <Route path="ai-agent" element={<AIAgent />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="reports" element={<Reports />} />
        <Route path="reports/calls/:id" element={<CallDetail backTo="/app/reports" />} />
        {/* Old addresses of pages that moved under Settings, AI Agent and Reports. */}
        <Route path="configuration" element={<Navigate to="/app/settings" replace />} />
        <Route path="access" element={<Navigate to="/app/settings?tab=team" replace />} />
        <Route path="billing" element={<Navigate to="/app/settings?tab=billing" replace />} />
        <Route path="ai-settings" element={<Navigate to="/app/ai-agent" replace />} />
        <Route path="call-agent" element={<Navigate to="/app/ai-agent?tab=test" replace />} />
        <Route path="call-logs" element={<Navigate to="/app/reports" replace />} />

        {/* The admin's dashboard is the front desk's day; numbers and trends live under Reports. */}
        <Route path="dashboard" element={<FrontDesk userName={user.full_name} callsPath="/app/reports" callDetailPath="/app/reports/calls" />} />
        <Route path="front-desk" element={<Navigate to="/app/dashboard" replace />} />

        <Route path="calendar" element={
          <div className="w-full h-full">
            <CalendarView user={user} defaultView={Views.DAY} fillHeight />
          </div>
        } />
        <Route path="appointments" element={<Appointments />} />
        <Route path="doctors" element={<Doctors />} />

        <Route path="patients" element={<PatientWorkspace callDetailPath="/app/reports/calls" />} />

        <Route path="profile" element={
          <ProfileSettings user={user} reloadUser={reloadUser} />
        } />
      </Routes>
    </WorkspaceShell>
  )
}

function ReceptionDesk({ user, clinics, hasMultiRole, currentView, onSwitchView, reloadUser }: { user: MeDto; clinics?: any[]; hasMultiRole?: boolean; currentView?: string; onSwitchView?: (v: string) => void; reloadUser?: () => Promise<void> }) {

  // The pages load their own data; nothing is shared at this level any more.

  return (
    <WorkspaceShell
      user={user}
      clinics={clinics}
      title="Reception desk"
      nav={[
        { section: 'Home', label: 'Dashboard', href: '/app/dashboard', icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
        { section: 'Operations', label: 'Calendar', href: '/app/calendar', icon: <CalendarDays className="h-[18px] w-[18px]" /> },
        { section: 'Operations', label: 'Appointments', href: '/app/appointments', icon: <ListTodo className="h-[18px] w-[18px]" /> },
        { section: 'Operations', label: 'Visits', href: '/app/visits', icon: <FileBarChart className="h-[18px] w-[18px]" /> },
        { section: 'Patients', label: 'Patient directory', href: '/app/patients', icon: <ClipboardList className="h-[18px] w-[18px]" /> },
        { section: 'Insights', label: 'Call logs', href: '/app/calls', icon: <PhoneCall className="h-[18px] w-[18px]" /> },
      ]}
      hasMultiRole={hasMultiRole}
      currentView={currentView}
      onSwitchView={onSwitchView}
    >

      <Routes>
        <Route path="/" element={<Navigate to="dashboard" replace />} />
        
        <Route path="dashboard" element={<FrontDesk userName={user.full_name} callsPath="/app/calls" callDetailPath="/app/calls" />} />
        
        <Route path="calls" element={<CallLogs detailPath="/app/calls" />} />
        <Route path="calls/:id" element={<CallDetail backTo="/app/calls" />} />

        <Route path="patients" element={<PatientWorkspace callDetailPath="/app/calls" />} />
        <Route path="calendar" element={
          <div className="w-full h-full">
            <CalendarView user={user} defaultView={Views.DAY} fillHeight />
          </div>
        } />
        <Route path="appointments" element={<Appointments />} />
        {/* The old booking page: bookings are now made on the Calendar and listed under Appointments. */}
        <Route path="booking" element={<Navigate to="/app/appointments" replace />} />

        <Route path="visits" element={<Visits />} />
        <Route path="followups" element={<Navigate to="/app/visits" replace />} />

        <Route path="profile" element={
          <ProfileSettings user={user} reloadUser={reloadUser} />
        } />
      </Routes>
    </WorkspaceShell>
  )
}

function DoctorWorkspace({ user, clinics, hasMultiRole, currentView, onSwitchView, reloadUser }: { user: MeDto; clinics?: any[]; hasMultiRole?: boolean; currentView?: string; onSwitchView?: (v: string) => void; reloadUser?: () => Promise<void> }) {
  const [appointments, setAppointments] = useState<AppointmentDto[]>([])
  const [queue, setQueue] = useState<QueueTokenDto[]>([])
  const [, setPatients] = useState<PatientDto[]>([])
  const [symptoms, setSymptoms] = useState<SymptomSummaryDto[]>([])
  const [_callLogs, setCallLogs] = useState<CallLogDto[]>([])

  const [maxPatients, setMaxPatients] = useState('')
  const [availFrom, setAvailFrom] = useState('')
  const [availTo, setAvailTo] = useState('')
  const [lunchFrom, setLunchFrom] = useState('')
  const [lunchTo, setLunchTo] = useState('')
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5])
  
  const [outOfOfficeStart, setOutOfOfficeStart] = useState('')
  const [outOfOfficeEnd, setOutOfOfficeEnd] = useState('')
  const [outOfOfficeReason, setOutOfOfficeReason] = useState('')
  const [appointmentToMarkSeen, setAppointmentToMarkSeen] = useState<AppointmentDto | null>(null)
  const [markSeenNotes, setMarkSeenNotes] = useState('')
  
  const { addToast, setSelectedPatient, setSelectedPatientId } = useUIStore()

  const { status: wsStatus, lastMessage } = useQueueWebSocket(user.doctor_profile_id ?? null)
  const todayRef = useRef(new Date().getDate())

  const { refreshTick } = useUIStore()

  // The page lists today's appointments, so any queue change (a token issued, called or
  // closed) or appointment event from the shell (refreshTick) triggers a refetch.
  useEffect(() => {
    if (lastMessage && typeof lastMessage.type === 'string' && lastMessage.type.startsWith('queue.')) {
      void load()
    }
  }, [lastMessage])

  useEffect(() => {
    if (refreshTick) void load()
  }, [refreshTick])

  const load = async () => {
    const today = localDateKey()
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999)
    const [appointmentsRes, queueRes, patientsRes, symptomsRes, callsRes] = await Promise.allSettled([
      api.get('/appointments/', { params: {
        starts_at_after: dayStart.toISOString(), starts_at_before: dayEnd.toISOString(),
        ordering: 'starts_at', page_size: 200,
        ...(user.doctor_profile_id ? { doctor: user.doctor_profile_id } : {}),
      } }),
      api.get('/queue/', { params: { service_date: today, page_size: 50, ...(user.doctor_profile_id ? { doctor: user.doctor_profile_id } : {}) } }),
      api.get('/patients/', { params: { page_size: 50 } }),
      api.get('/clinical/symptom-summaries/', { params: { page_size: 50 } }),
      api.get('/ai/call-logs/', { params: { page_size: 50 } }),
    ])
    if (appointmentsRes.status === 'fulfilled') setAppointments(unwrapList<AppointmentDto>(appointmentsRes.value.data))
    if (queueRes.status === 'fulfilled') setQueue(unwrapList<QueueTokenDto>(queueRes.value.data))
    if (patientsRes.status === 'fulfilled') setPatients(unwrapList<PatientDto>(patientsRes.value.data))
    if (symptomsRes.status === 'fulfilled') setSymptoms(unwrapList<SymptomSummaryDto>(symptomsRes.value.data))
    if (callsRes.status === 'fulfilled') setCallLogs(unwrapList<CallLogDto>(callsRes.value.data))

    const anyFailed = [appointmentsRes, queueRes, patientsRes, symptomsRes, callsRes].some(r => r.status === 'rejected')
    if (anyFailed) addToast('Some data could not be loaded. Showing available data.', 'warning')

    if (user.doctor_profile_id) {
      try {
        const profileRes = await api.get(`/doctors/${user.doctor_profile_id}/`)
        const profile = profileRes.data as DoctorDto & { lunch_from?: string, lunch_to?: string, working_days?: number[] }
        setMaxPatients(profile.max_patients_per_day ? String(profile.max_patients_per_day) : '')
        setAvailFrom(profile.available_from ? profile.available_from.substring(0, 5) : '')
        setAvailTo(profile.available_to ? profile.available_to.substring(0, 5) : '')
        setLunchFrom(profile.lunch_from ? profile.lunch_from.substring(0, 5) : '')
        setLunchTo(profile.lunch_to ? profile.lunch_to.substring(0, 5) : '')
        setWorkingDays(profile.working_days || [1, 2, 3, 4, 5])
      } catch {
        // Ignore if profile can't be fetched separately
      }
    }
  }

  useEffect(() => {
    void load()

    // Real-time midnight rollover check
    const interval = setInterval(() => {
      const currentDay = new Date().getDate()
      if (todayRef.current !== currentDay) {
        todayRef.current = currentDay
        void load()
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleMarkAbsent = async (e: FormEvent) => {
    e.preventDefault()
    if (!user.doctor_profile_id) return
    try {
      const res = await api.post(`/doctors/${user.doctor_profile_id}/mark-absent/`, {
        start_date: outOfOfficeStart,
        end_date: outOfOfficeEnd || outOfOfficeStart,
        reason: outOfOfficeReason
      })
      const data = res.data as { affected_appointments: number, messages_sent: number }
      addToast(`Marked absent. ${data.affected_appointments} appointments flagged for reschedule. ${data.messages_sent} messages created.`, 'success')
      setOutOfOfficeStart('')
      setOutOfOfficeEnd('')
      setOutOfOfficeReason('')
      void load()
    } catch (err: any) {
      if (err.response?.data?.error) {
        addToast(`Error: ${err.response.data.error}`, 'error')
      } else {
        addToast('Failed to mark absence.', 'error')
      }
    }
  }

  const markSeen = async (appointment: AppointmentDto, notes: string = '') => {
    try {
      await api.post(`/appointments/${appointment.id}/complete/`, { notes })
      addToast(`Appointment marked seen.`, 'success')
      await load()
    } catch (err: any) {
      if (err.response?.status === 409) {
        addToast('Appointment is already completed or canceled.', 'info')
        await load()
      } else {
        addToast('Could not mark the token as seen.', 'error')
      }
    }
  }

  const reviewSummary = async (summaryId: number, action: 'approve' | 'reject') => {
    try {
      await api.post(`/clinical/symptom-summaries/${summaryId}/${action}/`)
      addToast(`Symptom summary ${action}d.`, 'success')
      await load()
    } catch {
      addToast('Could not update the symptom summary.', 'error')
    }
  }

  const _downloadReport = async (patientId: number, patientName: string) => {
    try {
      const response = await api.get(`/patients/${patientId}/report/`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${patientName.replace(/\s+/g, '_')}_Report.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      addToast(`Report downloaded for ${patientName}.`, 'success')
    } catch {
      addToast(`Could not download report for ${patientName}.`, 'error')
    }
  }

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault()
    if (!user.doctor_profile_id) return
    try {
      await api.patch(`/doctors/${user.doctor_profile_id}/`, {
        max_patients_per_day: maxPatients ? parseInt(maxPatients, 10) : null,
        available_from: availFrom || null,
        available_to: availTo || null,
        lunch_from: lunchFrom || null,
        lunch_to: lunchTo || null,
        working_days: workingDays,
      })
      addToast('Settings saved successfully.', 'success')
      await load()
    } catch {
      addToast('Could not save settings. Please ensure available hours are valid.', 'error')
    }
  }

  return (
    <WorkspaceShell
      user={user}
      clinics={clinics}
      title="Doctor workspace"
      nav={[
        { section: 'Home', label: 'Dashboard', href: '/app/dashboard', icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
        { section: 'My day', label: 'Calendar', href: '/app/calendar', icon: <CalendarDays className="h-[18px] w-[18px]" /> },
        { section: 'My day', label: 'Personal queue', href: '/app/queue', icon: <ListTodo className="h-[18px] w-[18px]" /> },
        { section: 'Patients', label: 'Patient chart', href: '/app/patients', icon: <ClipboardList className="h-[18px] w-[18px]" /> },
        { section: 'Patients', label: 'AI summaries', href: '/app/ai', icon: <Sparkles className="h-[18px] w-[18px]" /> },
        { section: 'Setup', label: 'Settings', href: '/app/settings', icon: <SettingsIcon className="h-[18px] w-[18px]" /> },
      ]}
      hasMultiRole={hasMultiRole}
      currentView={currentView}
      onSwitchView={onSwitchView}
    >

      <Dialog open={!!appointmentToMarkSeen} onOpenChange={(open) => { if (!open) setAppointmentToMarkSeen(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Appointment as Seen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-500">Add optional notes for this patient's visit. These will be visible to the receptionist.</p>
            <textarea 
              className="w-full min-h-[100px] p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900" 
              placeholder="Doctor notes..."
              value={markSeenNotes}
              onChange={(e) => setMarkSeenNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setAppointmentToMarkSeen(null)}>Cancel</Button>
            <Button variant="default" onClick={() => {
              if (appointmentToMarkSeen) {
                void markSeen(appointmentToMarkSeen, markSeenNotes)
                setAppointmentToMarkSeen(null)
                setMarkSeenNotes('')
              }
            }}>Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Routes>
        <Route path="/" element={<Navigate to="dashboard" replace />} />

        <Route path="dashboard" element={<DoctorDashboard user={user} />} />

        <Route path="calendar" element={
          <div className="w-full h-full">
            <CalendarView
              fillHeight
              user={{ ...user, role: 'doctor' }}
              doctorIdProp={user.doctor_profile_id ?? undefined}
              hideDoctorSelect={true}
            />
          </div>
        } />

        <Route path="queue" element={
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start max-w-6xl">
            <Card className="space-y-4 p-5 h-fit" id="queue">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Waiting List</h3>
                  <p className="text-sm text-slate-500">Mark the next patient as seen when their visit is complete.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <div className={`w-2 h-2 rounded-full ${
                      wsStatus === 'connected' ? 'bg-green-500' :
                      wsStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
                    }`} />
                    <span className="text-slate-500 capitalize">{wsStatus}</span>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => void load()}>Refresh</Button>
                </div>
              </div>
              <div className="space-y-3">
                {(appointments || []).filter(a => (a.status === 'scheduled' || a.status === 'checked_in') && isToday(a.starts_at)).map((appt) => (
                  <div key={appt.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{appt.patient_name || 'Patient ' + appt.patient}</p>
                        <p className="text-sm text-amber-600 capitalize">{appt.status.replace('_', ' ')} • {new Date(appt.starts_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                      </div>
                      <Button size="sm" variant="default" onClick={() => { setAppointmentToMarkSeen(appt); setMarkSeenNotes(''); }}>Mark seen</Button>
                    </div>
                  </div>
                ))}
                {(appointments || []).filter(a => (a.status === 'scheduled' || a.status === 'checked_in') && isToday(a.starts_at)).length === 0 && (
                  <p className="text-sm text-slate-500 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                    No patients waiting in your queue.
                  </p>
                )}
              </div>
            </Card>

            <Card className="space-y-4 p-5 h-fit">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Already Seen</h3>
                  <p className="text-sm text-slate-500">Patients you have already consulted today.</p>
                </div>
              </div>
              <div className="space-y-3">
                {(appointments || []).filter(a => a.status === 'completed' && isToday(a.starts_at)).map((appt) => (
                  <div key={appt.id} className="rounded-2xl border border-slate-200 bg-white p-4 opacity-75">
                    <div className="flex items-center justify-between gap-3">
                      <div className="w-full">
                        <p className="font-semibold text-slate-500 line-through">{appt.patient_name || 'Patient ' + appt.patient}</p>
                        <p className="text-sm text-emerald-600 font-medium">✓ Completed • {new Date(appt.starts_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                        {appt.doctor_notes && <p className="text-sm text-slate-600 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">{appt.doctor_notes}</p>}
                      </div>
                    </div>
                  </div>
                ))}
                {(appointments || []).filter(a => a.status === 'completed' && isToday(a.starts_at)).length === 0 && (
                  <p className="text-sm text-slate-500 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                    No patients seen yet today.
                  </p>
                )}
              </div>
            </Card>
          </div>
        } />

        <Route path="patients" element={<PatientWorkspace />} />

        <Route path="ai" element={
          <div className="max-w-4xl">
            <Card className="space-y-4 p-5" id="ai">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">AI symptom summaries and history</h3>
                <p className="text-sm text-slate-500">Review generated summaries and the related call history.</p>
              </div>
              <div className="space-y-3">
                {symptoms.slice(0, 5).map((summary) => (
                  <div key={summary.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-slate-950">{summary.encounter?.patient?.full_name ?? 'Unknown patient'}</p>
                    <p className="mt-1 text-sm text-slate-600">{summary.summary_text}</p>
                    <p className="mt-2 text-xs text-slate-500">Status: {summary.status} · Confidence: {Math.round(summary.confidence * 100)}%</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {summary.status === 'pending' && (
                        <>
                          <Button size="sm" variant="default" onClick={() => void reviewSummary(summary.id, 'approve')}>Approve</Button>
                          <Button size="sm" variant="secondary" onClick={() => void reviewSummary(summary.id, 'reject')}>Reject</Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        } />

        <Route path="settings" element={
          <div className="max-w-[1200px] grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <Card className="space-y-4 p-5" id="settings">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Availability settings</h3>
                <p className="text-sm text-slate-500">Configure your working hours and daily patient capacity.</p>
              </div>
              <form onSubmit={saveSettings} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Max patients per day</label>
                  <input type="number" min="1" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={maxPatients} onChange={(e) => setMaxPatients(e.target.value)} placeholder="e.g. 20 (leave blank for unlimited)" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Available from</label>
                    <AmPmTimePicker value={availFrom} onChange={setAvailFrom} />
                    <p className="mt-1 text-xs text-slate-400">Current: {formatAmPm(availFrom) || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Available to</label>
                    <AmPmTimePicker value={availTo} onChange={setAvailTo} />
                    <p className="mt-1 text-xs text-slate-400">Current: {formatAmPm(availTo) || 'Not set'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Lunch from</label>
                    <AmPmTimePicker value={lunchFrom} onChange={setLunchFrom} />
                    <p className="mt-1 text-xs text-slate-400">Current: {formatAmPm(lunchFrom) || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Lunch to</label>
                    <AmPmTimePicker value={lunchTo} onChange={setLunchTo} />
                    <p className="mt-1 text-xs text-slate-400">Current: {formatAmPm(lunchTo) || 'Not set'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Working Days</label>
                  <div className="flex gap-2 flex-wrap mb-2">
                    <button
                      type="button"
                      onClick={() => setWorkingDays([1, 2, 3, 4, 5])}
                      className="rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 btn-transition"
                    >
                      Weekdays
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkingDays([6, 7])}
                      className="rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 btn-transition"
                    >
                      Weekends
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkingDays([1, 2, 3, 4, 5, 6, 7])}
                      className="rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 btn-transition"
                    >
                      Every Day
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    {[
                      { label: 'Monday', val: 1 },
                      { label: 'Tuesday', val: 2 },
                      { label: 'Wednesday', val: 3 },
                      { label: 'Thursday', val: 4 },
                      { label: 'Friday', val: 5 },
                      { label: 'Saturday', val: 6 },
                      { label: 'Sunday', val: 7 }
                    ].map(day => {
                      const isChecked = workingDays.includes(day.val)
                      return (
                        <label key={day.val} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setWorkingDays(prev => [...prev, day.val].sort())
                              } else {
                                setWorkingDays(prev => prev.filter(v => v !== day.val))
                              }
                            }}
                          />
                          <span>{day.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <Button variant="default" type="submit">Save settings</Button>
              </form>
            </Card>

            <Card className="space-y-4 p-5" id="absence">
              <div>
                <h3 className="text-lg font-semibold text-red-600">Mark Out of Office / Leave</h3>
                <p className="text-sm text-slate-500">
                  Marking days as out of office will automatically flag conflicting appointments as Needs Reschedule and generate suggested alternative slots for affected patients.
                </p>
              </div>
              <form onSubmit={handleMarkAbsent} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Start Date</label>
                    <input type="date" required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={outOfOfficeStart} onChange={(e) => setOutOfOfficeStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">End Date (optional)</label>
                    <input type="date" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={outOfOfficeEnd} onChange={(e) => setOutOfOfficeEnd(e.target.value)} min={outOfOfficeStart} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Reason (optional)</label>
                  <input type="text" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={outOfOfficeReason} onChange={(e) => setOutOfOfficeReason(e.target.value)} placeholder="e.g. Conference, Sick leave" />
                </div>
                <Button variant="default" type="submit" className="bg-red-600 hover:bg-red-700 text-white border-transparent">Confirm Leave / Out of Office</Button>
              </form>
            </Card>
          </div>
        } />

        <Route path="profile" element={
          <ProfileSettings user={user} reloadUser={reloadUser} />
        } />
      </Routes>
    </WorkspaceShell>
  )
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function WorkspaceRouter() {
  const { user, clinics, loading, error, reloadUser } = useCurrentUser()
  const [activeView, setActiveView] = useState<string | null>(null)
  const { triggerRefresh } = useUIStore()

  useRealtimeEvents((event) => {
    if (event.type === 'appointment.updated' || event.type === 'appointment.created') {
      triggerRefresh()
    }
  }, { notify: true })

  useEffect(() => {
    if (user && !activeView) {
      setActiveView(user.role)
    }
  }, [user, activeView])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        Loading workspace...
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-700">
        <Card className="max-w-md space-y-4 p-6 text-center">
          <p className="text-lg font-semibold text-slate-950">Session required</p>
          <p className="text-sm text-slate-500">{error || 'Please login to view your workspace.'}</p>
          <div className="flex justify-center gap-3">
            <Link to="/login" className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Login</Link>
            <Link to="/" className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Landing page</Link>
          </div>
        </Card>
      </div>
    )
  }

  // Redirect un-onboarded clinic admins to the onboarding wizard
  if (user.role === 'clinic_admin' && !user.clinic_is_onboarded) {
    window.location.href = '/onboarding'
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        Redirecting to setup wizard...
      </div>
    )
  }

  // Admins can look at the hospital the way the front desk sees it (Reception desk) and switch back.
  // Doctors have their own login and workspace; it is never reached by switching from another role.
  const hasMultiRole = user.role === 'clinic_admin'
  const currentView = user.role === 'clinic_admin' && activeView === 'receptionist' ? 'receptionist' : user.role

  const workspaceProps = {
    user,
    clinics,
    hasMultiRole,
    currentView,
    onSwitchView: setActiveView,
    reloadUser
  }

  if (currentView === 'clinic_admin') {
    return <AdminConsole {...workspaceProps} />
  }

  if (currentView === 'doctor') {
    return <DoctorWorkspace {...workspaceProps} hasMultiRole={false} />
  }

  return <ReceptionDesk {...workspaceProps} />
}
