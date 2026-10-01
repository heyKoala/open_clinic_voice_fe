// @ts-nocheck
import { useEffect, useMemo, useState, useRef, type FormEvent, type ReactNode } from 'react'
import { Link, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { 
  ArrowRight, Edit2, RefreshCw, Sparkles, LayoutDashboard,
  Users, CalendarDays, ClipboardList, CreditCard, 
  FileBarChart, Settings as SettingsIcon, Sliders, PhoneCall, ListTodo
} from 'lucide-react'

import { api } from '../lib/api'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/shadcn/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/shadcn/select'
import { Label } from '../components/shadcn/label'
import { AmPmTimePicker, formatAmPm } from '../components/ui/AmPmTimePicker'
import { PhoneInput } from '../components/ui/PhoneInput'
import { DateTimePickerAmPm } from '../components/ui/DateTimePickerAmPm'
import AccountMenu from '../components/AccountMenu'
import { CalendarView } from '../components/CalendarView'
import Settings from './Settings'
import DoctorDashboard from './DoctorDashboard'
import ReceptionistDashboard from './ReceptionistDashboard'
import Dashboard from './Dashboard'
import Patients from './Patients'
import CallLogs from './CallLogs'
import TeamSettings from './TeamSettings'
import ProfileSettings from './ProfileSettings'
import PatientDrawer from '../components/PatientDrawer'
import PatientWorkspace from './PatientWorkspace'
import { PatientFormDialog } from '../components/patient-profile/PatientFormDialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/shadcn/dialog'
import { useQueueWebSocket } from '../lib/useWebSocket'
import { Toaster } from '../components/shadcn/toast'
import { useRealtimeEvents } from '../hooks/useRealtimeEvents'
import { useUIStore } from '../store/uistore'
import { playnotificationsound } from '../components/sounds/soundsmanager';
import AgentSettings from './AgentSettings';
import CallAgent from './CallAgent';
import { Plus } from 'lucide-react';
import { CreateBranchModal } from '../components/CreateBranchModal';

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

function WorkspaceShell({
  user,
  clinics,
  title,
  nav,
  children,
  hasMultiRole,
  currentView,
  onSwitchView,
}: {
  user: MeDto
  clinics?: any[]
  title: string
  nav: Array<{ label: string; href?: string; onClick?: () => void; icon: ReactNode }>
  children: ReactNode
  hasMultiRole?: boolean
  currentView?: string
  onSwitchView?: (view: string) => void
}) {
  const location = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isDesktopExpanded, setIsDesktopExpanded] = useState(true)
  const [isCreateBranchOpen, setIsCreateBranchOpen] = useState(false)

  return (
    <div className="h-screen overflow-hidden bg-slate-50 text-slate-900 flex">
      {/* Fixed Hamburger Toggle Button - Mobile Only */}
      <button 
        onClick={() => {
          setIsSidebarOpen(!isSidebarOpen)
          setIsDesktopExpanded(!isDesktopExpanded)
        }}
        className="lg:hidden fixed top-3 left-4 z-50 p-2 text-slate-500 hover:text-slate-900 bg-white rounded-lg hover:bg-slate-100 transition-colors shadow-sm border border-slate-200"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out transform overflow-hidden ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 ${isDesktopExpanded ? 'w-64' : 'w-64 lg:w-[68px]'}`}
      >
          {/* Branding header — add padding-left to clear the hamburger button on mobile */}
          <div 
            onClick={() => {
              setIsSidebarOpen(!isSidebarOpen)
              setIsDesktopExpanded(!isDesktopExpanded)
            }}
            className="flex items-center gap-3 border-b border-slate-100 pl-16 lg:pl-[18px] pr-4 h-[60px] shrink-0 cursor-pointer hover:bg-slate-50 transition-colors"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 overflow-hidden">
              <img src="/manageopd_icon.png" alt="ManageOPD" className="w-full h-full object-cover" />
            </div>
            <div className={`overflow-hidden whitespace-nowrap transition-opacity duration-300 ${!isDesktopExpanded ? 'lg:opacity-0' : 'opacity-100'}`}>
              <p className="text-sm font-bold leading-none text-slate-900 truncate">ManageOPD</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate">
                {title}
              </p>
            </div>
          </div>

          {/* Nav links — grow to fill space */}
          <nav className="flex-1 space-y-1 overflow-y-auto p-3 overflow-x-hidden">
            {nav.map((item) => {
              const isActive = item.href ? location.pathname === item.href : false
              const content = (
                <>
                  <span className={`shrink-0 flex items-center justify-center h-5 w-5 ${isActive ? 'text-slate-700' : 'text-slate-400'}`}>
                    {item.icon}
                  </span>
                  <span className={`whitespace-nowrap transition-opacity duration-300 ${!isDesktopExpanded ? 'lg:opacity-0' : 'opacity-100'}`}>
                    {item.label}
                  </span>
                </>
              )
              return item.href ? (
                <Link
                  key={item.label}
                  to={item.href}
                  className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${isActive
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                >
                  {content}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  {content}
                </button>
              )
            })}
          </nav>

          {/* User profile strip — full width, pinned to bottom */}
          <div className="border-t border-slate-100 shrink-0 w-64">
            <AccountMenu
              userName={user.full_name}
              userEmail={user.email}
              userRole={user.role}
              align="top"
              hasMultiRole={hasMultiRole}
              currentView={currentView}
              onSwitchView={onSwitchView}
              textClassName={`whitespace-nowrap transition-opacity duration-300 ${!isDesktopExpanded ? 'lg:opacity-0' : 'opacity-100'}`}
            />
          </div>
        </aside>

        {/* Overlay for mobile when sidebar is open */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/20 z-30 lg:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* ── Main content ─────────────────────────────────────── */}
        <div className={`flex-1 flex flex-col h-screen min-w-0 transition-all duration-300 ease-in-out ml-0 ${isDesktopExpanded ? 'lg:ml-64' : 'lg:ml-[68px]'}`}>
          
          {/* Top Header */}
          <header className="h-[60px] w-full shrink-0 bg-white border-b border-slate-200 flex items-center justify-end px-4 lg:px-8">
            {clinics && clinics.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-500">Clinic:</span>
                  <select
                    className="text-sm border-slate-200 rounded-lg text-slate-900 bg-slate-50 px-3 py-1.5 focus:ring-brand-cyan focus:border-brand-cyan"
                    value={localStorage.getItem('active_clinic_id') || clinics.find(c => c.is_active)?.id || ''}
                    onChange={(e) => {
                      localStorage.setItem('active_clinic_id', e.target.value)
                      window.location.reload()
                    }}
                  >
                    {clinics.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <button 
                  onClick={() => setIsCreateBranchOpen(true)}
                  className="text-sm font-medium text-white bg-brand-navy hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add Center
                </button>
              </div>
            )}
            <CreateBranchModal 
              isOpen={isCreateBranchOpen} 
              onClose={() => setIsCreateBranchOpen(false)} 
            />
          </header>

          {/* Header stays fixed; only page content scrolls. */}
          <main className="flex-1 min-h-0 overflow-y-auto space-y-6 p-4 md:p-6 lg:p-8 lg:pt-6">
            {children}
          </main>
          <Toaster />
          <PatientDrawer />
        </div>
    </div>
  )
}


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
  const [dashboardStats, setDashboardStats] = useState<any>(null)
  const [invites, setInvites] = useState<InviteDto[]>([])
  const [, setPatients] = useState<PatientDto[]>([])
  const [subscription, setSubscription] = useState<SubscriptionSummaryDto | null>(null)
  const [reports, setReports] = useState<{ templates: ReportTemplateDto[]; executions: ReportExecutionDto[] }>({ templates: [], executions: [] })
  const [clinicConfig, setClinicConfig] = useState<Record<string, unknown> | null>(null)
  const [isEditingConfig, setIsEditingConfig] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'doctor' | 'receptionist'>('doctor')
  const [upgradePlan, setUpgradePlan] = useState('growth')
  const { addToast } = useUIStore()

  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [teamRes, dashboardRes, subscriptionRes, configRes, templatesRes, executionsRes, invitesRes, patientsRes] = await Promise.all([
        api.get('/accounts/access/'),
        api.get('/accounts/dashboard/'),
        api.get('/subscriptions/summary/'),
        api.get('/clinics/configuration/'),
        api.get('/reports/templates/'),
        api.get('/reports/executions/'),
        api.get('/accounts/invites/'),
        api.get('/patients/', { params: { page_size: 50 } }),
      ])
      setTeam(teamRes.data as TeamSummaryDto)
      setDashboardStats(dashboardRes.data)
      setInvites(unwrapList<InviteDto>(invitesRes.data))
      setPatients(unwrapList<PatientDto>(patientsRes.data))
      setSubscription(subscriptionRes.data as SubscriptionSummaryDto)
      setClinicConfig((configRes.data ?? null) as Record<string, unknown> | null)
      setReports({ templates: unwrapList<ReportTemplateDto>(templatesRes.data), executions: unwrapList<ReportExecutionDto>(executionsRes.data) })
    } catch {
      addToast('Could not load admin data.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useRealtimeEvents((payload) => {
    if (payload.type.startsWith('appointment.')) {
      void load()
    }
  })

  const updateConfigValue = (key: string, value: unknown) => {
    setClinicConfig(prev => prev ? { ...prev, [key]: value } : prev)
  }

  const saveConfig = async (e: FormEvent) => {
    e.preventDefault()
    if (!clinicConfig) return
    try {
      await api.patch('/clinics/configuration/', clinicConfig)
      addToast('Configuration saved successfully.', 'success')
      setIsEditingConfig(false)
      await load()
    } catch (err: any) {
      addToast('Failed to update settings.', 'error')
    }
  }



  const sendInvite = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await api.post('/accounts/invites/', { email: inviteEmail, role: inviteRole })
      setInviteEmail('')
      addToast('Invitation sent.', 'success')
      await load()
    } catch {
      addToast('Could not send invitation. Check seat limits and email availability.', 'error')
    }
  }

  const updatePlan = async (plan: string) => {
    try {
      const response = await api.post('/subscriptions/upgrade/', { plan })
      
      if (response.data?.requires_action) {
        const options = {
          key: response.data.key_id,
          amount: response.data.amount,
          currency: response.data.currency,
          name: "ManageOPD",
          description: `Upgrade to ${plan} plan`,
          order_id: response.data.razorpay_order_id,
          handler: async function (paymentResponse: any) {
            try {
              await api.post('/subscriptions/verify/', {
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_signature: paymentResponse.razorpay_signature
              })
              setUpgradePlan(plan)
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

      setUpgradePlan(plan)
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

  const toggleMember = async (member: MeDto) => {
    const isActive = member.membership_status === 'active' || member.is_active !== false;
    const endpoint = isActive ? `/auth/users/${member.id}/deactivate/` : `/auth/users/${member.id}/reactivate/`
    try {
      await api.post(endpoint)
      addToast(`${member.full_name} updated.`, 'success')
      await load()
    } catch {
      addToast('Could not update the team member.', 'error')
    }
  }

  return (
    <WorkspaceShell
      user={user}
      clinics={clinics}
      title="Admin Console"
      nav={[
        { label: 'Dashboard', href: '/app/dashboard', icon: <LayoutDashboard className="h-4 w-4 opacity-70" /> },
        { label: 'Access', href: '/app/access', icon: <Users className="h-4 w-4 opacity-70" /> },
        { label: 'Calendar', href: '/app/calendar', icon: <CalendarDays className="h-4 w-4 opacity-70" /> },
        { label: 'Patients', href: '/app/patients', icon: <ClipboardList className="h-4 w-4 opacity-70" /> },
        { label: 'Billing and upgrade', href: '/app/billing', icon: <CreditCard className="h-4 w-4 opacity-70" /> },
        { label: 'Reports', href: '/app/reports', icon: <FileBarChart className="h-4 w-4 opacity-70" /> },
        { label: 'Configuration', href: '/app/configuration', icon: <Sliders className="h-4 w-4 opacity-70" /> },
        { label: 'AI Settings', href: '/app/ai-settings', icon: <SettingsIcon className="h-4 w-4 opacity-70" /> },
        { label: 'Call Logs', href: '/app/call-logs', icon: <PhoneCall className="h-4 w-4 opacity-70" /> },
        { label: 'Test AI Call', href: '/app/call-agent', icon: <PhoneCall className="h-4 w-4 opacity-70" /> },
      ]}
      hasMultiRole={hasMultiRole}
      currentView={currentView}
      onSwitchView={onSwitchView}
    >
      <Routes>
        <Route path="/" element={<Navigate to="dashboard" replace />} />
        <Route path="ai-settings" element={<AgentSettings />} />
        <Route path="call-agent" element={<CallAgent />} />
        <Route path="call-logs" element={<CallLogs />} />

        <Route path="dashboard" element={<Dashboard />} />
        <Route path="access" element={<TeamSettings team={team} invites={invites} loading={loading} load={load} user={user} reloadUser={reloadUser} />} />

        <Route path="calendar" element={
          <div className="w-full h-full">
            <CalendarView showBookButton={false} user={user} fillHeight />
          </div>
        } />

        <Route path="patients" element={<PatientWorkspace canEdit={false} />} />

        <Route path="billing" element={
          <div className="w-full h-full flex flex-col space-y-6">
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-slate-950">Billing and upgrade</h3>
              <p className="text-sm text-slate-500 mb-4">Switch plans and review current seat usage.</p>
              
              <div className="inline-flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-sm font-medium text-slate-600">Current Plan:</span>
                <span className="text-sm font-bold text-emerald-600 uppercase tracking-wider px-3 py-1 bg-emerald-50 rounded-full border border-emerald-200">
                  {subscription?.plan || 'Unknown'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-3 ml-2">Trial ends on {formatDate(subscription?.trial_ends_at)}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch flex-1 pt-5 pb-8">
              {(subscription?.plan_options || []).map((plan) => {
                const isActive = subscription?.plan === plan.value;
                return (
                  <div 
                    key={plan.value} 
                    className={`rounded-2xl overflow-visible relative w-full p-6 flex flex-col transition-all duration-300 border-2 ${
                      isActive 
                        ? 'border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)] bg-emerald-50/10' 
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-md bg-white'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-white text-[11px] font-bold px-4 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-500/30 border border-emerald-400/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                        Current Plan
                      </div>
                    )}
                    
                    <div className="mb-6 mt-2 text-center">
                      <div className="mx-auto w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-600">
                        <CreditCard className="w-6 h-6" />
                      </div>
                      <h4 className="text-2xl font-bold text-slate-900 capitalize">{plan.label}</h4>
                      <p className="text-sm text-slate-500 mt-2 min-h-[40px]">
                        {plan.value === 'trial' ? 'For testing out the platform' : plan.value === 'growth' ? 'For growing clinics' : 'Higher limits, priority access'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void updatePlan(plan.value)}
                      disabled={isActive}
                      className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all mb-6 ${
                        isActive 
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                      }`}
                    >
                      {isActive ? 'Active' : `Get ${plan.label}`}
                    </button>
                    
                    <div className="mt-auto pt-5 border-t border-slate-100/80 flex-1">
                      <p className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">Includes:</p>
                      <ul className="space-y-3">
                        {plan.value === 'trial' && (
                          <>
                            <li className="flex items-start gap-2 text-sm font-medium text-slate-600">
                              <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              14-day full access
                            </li>
                            <li className="flex items-start gap-2 text-sm font-medium text-slate-600">
                              <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              Basic AI features
                            </li>
                          </>
                        )}
                        {plan.value === 'growth' && (
                          <>
                            <li className="flex items-start gap-2 text-sm font-medium text-slate-600">
                              <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              Unlimited appointments
                            </li>
                            <li className="flex items-start gap-2 text-sm font-medium text-slate-600">
                              <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              Priority email support
                            </li>
                            <li className="flex items-start gap-2 text-sm font-medium text-slate-600">
                              <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              Standard AI limits
                            </li>
                          </>
                        )}
                        {plan.value === 'enterprise' && (
                          <>
                            <li className="flex items-start gap-2 text-sm font-medium text-slate-600">
                              <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              Everything in Growth
                            </li>
                            <li className="flex items-start gap-2 text-sm font-medium text-slate-600">
                              <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              Custom AI models
                            </li>
                            <li className="flex items-start gap-2 text-sm font-medium text-slate-600">
                              <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              24/7 Phone support
                            </li>
                            <li className="flex items-start gap-2 text-sm font-medium text-slate-600">
                              <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              Advanced analytics
                            </li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        } />

        <Route path="configuration" element={
          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
            <div className="space-y-6">
              <Card className="space-y-4 p-5" id="configuration">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">Clinic configuration</h3>
                    <p className="text-sm text-slate-500">Manage global AI and workflow settings.</p>
                  </div>
                  {!isEditingConfig && (
                    <button type="button" onClick={() => setIsEditingConfig(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                      <Edit2 className="h-4 w-4" /> Edit
                    </button>
                  )}
                </div>

                {clinicConfig ? (
                  isEditingConfig ? (
                    <form onSubmit={saveConfig} className="space-y-6">
                      <div className="grid gap-6 md:grid-cols-2">
                        {/* Toggles */}
                        <div className="space-y-4">
                          <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Features</h4>

                          <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-slate-100 cursor-pointer">
                            <div>
                              <p className="text-sm font-medium text-slate-900">Enable AI Features</p>
                              <p className="text-xs text-slate-500">Core AI functionalities</p>
                            </div>
                            <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600" checked={Boolean(clinicConfig.ai_enabled)} onChange={(e) => updateConfigValue('ai_enabled', e.target.checked)} />
                          </label>

                          <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-slate-100 cursor-pointer">
                            <div>
                              <p className="text-sm font-medium text-slate-900">AI Voice Calling</p>
                              <p className="text-xs text-slate-500">Automated patient outreach</p>
                            </div>
                            <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600" checked={Boolean(clinicConfig.ai_voice_enabled)} onChange={(e) => updateConfigValue('ai_voice_enabled', e.target.checked)} />
                          </label>

                          <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-slate-100 cursor-pointer">
                            <div>
                              <p className="text-sm font-medium text-slate-900">AI Transcripts</p>
                              <p className="text-xs text-slate-500">Consultation speech-to-text</p>
                            </div>
                            <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600" checked={Boolean(clinicConfig.ai_transcription_enabled)} onChange={(e) => updateConfigValue('ai_transcription_enabled', e.target.checked)} />
                          </label>
                        </div>

                        {/* Inputs */}
                        <div className="space-y-4">
                          <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Preferences</h4>

                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-700">AI Default Language</label>
                            <select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={String(clinicConfig.ai_default_language || 'en')} onChange={(e) => updateConfigValue('ai_default_language', e.target.value)}>
                              <option value="en">English</option>
                              <option value="hi">Hindi</option>
                              <option value="es">Spanish</option>
                              <option value="fr">French</option>
                            </select>
                          </div>

                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-700">Consultation Minutes (Default)</label>
                            <input type="number" min="5" max="120" step="5" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={Number(clinicConfig.default_consultation_minutes || 15)} onChange={(e) => updateConfigValue('default_consultation_minutes', parseInt(e.target.value, 10))} />
                          </div>

                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-700">Timezone</label>
                            <select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={String(clinicConfig.timezone || 'UTC')} onChange={(e) => updateConfigValue('timezone', e.target.value)}>
                              <option value="UTC">UTC</option>
                              <option value="Asia/Kolkata">Indian (IST)</option>
                              <option value="America/New_York">Eastern (EST)</option>
                              <option value="Europe/London">London (GMT)</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 justify-end border-t border-slate-100 pt-5">
                        <button type="button" onClick={() => { setIsEditingConfig(false); void load(); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
                        <Button variant="default" type="submit">Save Changes</Button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {Object.entries(clinicConfig || {}).slice(0, 8).map(([key, value]) => {
                        let displayValue = String(value)
                        if (key === 'timezone' && displayValue === 'UTC') displayValue = 'Indian (IST)'
                        return (
                          <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{key.replace(/_/g, ' ')}</p>
                            <p className="mt-1 text-sm font-medium text-slate-900">{displayValue}</p>
                          </div>
                        )
                      })}
                    </div>
                  )
                ) : (
                  <p className="text-sm text-slate-500">Loading configuration...</p>
                )}
              </Card>
            </div>
            <div className="space-y-6">

              <Card className="space-y-4 p-5">
                <h3 className="text-lg font-semibold text-slate-950">Reports snapshot</h3>
                <div className="space-y-3">
                  {(reports?.templates || []).slice(0, 3).map((template) => (
                    <div key={template.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="font-medium text-slate-900">{template.name}</p>
                      <p className="text-sm text-slate-500">{template.report_type_display} · {template.format_display}</p>
                      <p className="text-xs text-slate-500">Roles: {template.allowed_roles_display.join(', ')}</p>
                    </div>
                  ))}
                </div>
                <Link to="/app/reports" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  Open reports <ArrowRight className="h-4 w-4" />
                </Link>
              </Card>
            </div>
          </div>
        } />

        <Route path="ai-settings" element={
          <div className="max-w-6xl">
            <Settings />
          </div>
        } />

        <Route path="profile" element={
          <ProfileSettings user={user} reloadUser={reloadUser} />
        } />
      </Routes>
    </WorkspaceShell>
  )
}

function ReceptionDesk({ user, clinics, hasMultiRole, currentView, onSwitchView, reloadUser }: { user: MeDto; clinics?: any[]; hasMultiRole?: boolean; currentView?: string; onSwitchView?: (v: string) => void; reloadUser?: () => Promise<void> }) {
  const [patients, setPatients] = useState<PatientDto[]>([])
  const [doctors, setDoctors] = useState<DoctorDto[]>([])
  const [appointments, setAppointments] = useState<AppointmentDto[]>([])
  const [queue, setQueue] = useState<QueueTokenDto[]>([])
  const [followups, setFollowups] = useState<FollowUpDto[]>([])
  const [booking, setBooking] = useState({ patient: '', doctor: '', starts_at: '', ends_at: '', reason: 'Consultation' })
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false)
  const [bookingDate, setBookingDate] = useState<string>(localDateKey())
  const [bookingPage, setBookingPage] = useState(1)
  const [bookingTotalPages, setBookingTotalPages] = useState(1)
  const [followupDraft, setFollowupDraft] = useState({ patient: '', doctor: '', scheduled_for: '', method: 'phone', notes: '' })
  const plan = user.clinic_plan || 'trial'
  const { refreshTick, addToast } = useUIStore()

  const loadAppointments = async () => {
    try {
      const starts_at_after = bookingDate ? `${bookingDate}T00:00:00.000Z` : undefined
      const starts_at_before = bookingDate ? `${bookingDate}T23:59:59.999Z` : undefined
      const res = await api.get('/appointments/', {
        params: {
          starts_at_after,
          starts_at_before,
          page: bookingPage,
          page_size: 10,
          _t: Date.now()
        }
      })
      setAppointments(unwrapList<AppointmentDto>(res.data))
      if (res.data?.count) {
        setBookingTotalPages(Math.ceil(res.data.count / 10))
      } else {
        setBookingTotalPages(1)
      }
    } catch (err) {
      console.error('Failed to load appointments', err)
    }
  }

  useEffect(() => {
    void loadAppointments()
  }, [bookingDate, bookingPage, refreshTick])

  const load = async () => {
    try {
      console.log('ReceptionDesk load() started')
      const today = localDateKey()
      const t = Date.now()
      const [patientsRes, doctorsRes, queueRes, followupsRes] = await Promise.all([
        api.get('/patients/', { params: { page_size: 50, _t: t } }),
        api.get('/doctors/', { params: { page_size: 50, _t: t } }),
        api.get('/queue/', { params: { service_date: today, page_size: 50, _t: t } }),
        api.get('/followups/followups/', { params: { page_size: 50, _t: t } }),
      ])
      setPatients(unwrapList<PatientDto>(patientsRes.data))
      setDoctors(unwrapList<DoctorDto>(doctorsRes.data))
      setQueue(unwrapList<QueueTokenDto>(queueRes.data))
      setFollowups(unwrapList<FollowUpDto>(followupsRes.data))
      if (!booking.doctor && unwrapList<DoctorDto>(doctorsRes.data)[0]) {
        setBooking((current) => ({ ...current, doctor: String(unwrapList<DoctorDto>(doctorsRes.data)[0].id) }))
      }
      if (!booking.patient && unwrapList<PatientDto>(patientsRes.data)[0]) {
        setBooking((current) => ({ ...current, patient: String(unwrapList<PatientDto>(patientsRes.data)[0].id) }))
      }
      console.log('ReceptionDesk load() finished successfully', { patients: patientsRes.data, doctors: doctorsRes.data })
    } catch (err) {
      console.error('ReceptionDesk load() failed', err)
      addToast('Could not load reception data.', 'error')
    }
  }

  useEffect(() => {
    void load()
  }, [refreshTick])

  const patientOptions = useMemo(() => (patients || []).map((patient) => ({ value: String(patient.id), label: patient.full_name })), [patients])
  const doctorOptions = useMemo(() => (doctors || []).map((doctor) => ({ value: String(doctor.id), label: `Dr. ${doctor.full_name}` })), [doctors])

  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  const minDateTime = now.toISOString().slice(0, 16)

  const createBooking = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await api.post('/appointments/', {
        patient: Number(booking.patient),
        doctor: Number(booking.doctor),
        starts_at: booking.starts_at ? new Date(booking.starts_at).toISOString() : '',
        ends_at: booking.ends_at ? new Date(booking.ends_at).toISOString() : '',
        reason: booking.reason,
        source: 'front_desk',
      })
      addToast('Appointment booked.', 'success')
      playnotificationsound();
      await load()
      setIsBookingModalOpen(false)
    } catch (error: any) {
      if (error.response?.data?.non_field_errors) {
        addToast(`Booking failed: ${error.response.data.non_field_errors.join(' ')}`, 'error')
      } else {
        addToast('Could not book the appointment.', 'error')
      }
    }
  }

  const cancelAppointment = async (id: number) => {
    try {
      await api.patch(`/appointments/${id}/`, { status: 'cancelled' })
      addToast('Appointment cancelled.', 'info')
      playnotificationsound();
      await load()
    } catch {
      addToast('Could not cancel the appointment.', 'error')
    }
  }

  const checkInAppointment = async (id: number) => {
    try {
      await api.post(`/appointments/${id}/check_in/`)
      addToast('Appointment checked in.', 'success')
      await load()
    } catch (error: any) {
      if (error.response?.data?.detail) {
        addToast(`Check-in failed: ${error.response.data.detail}`, 'error')
      } else {
        addToast('Could not check in the appointment.', 'error')
      }
    }
  }

  const createFollowUp = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await api.post('/followups/followups/', {
        patient: Number(followupDraft.patient),
        doctor: Number(followupDraft.doctor),
        scheduled_for: followupDraft.scheduled_for,
        method: followupDraft.method,
        notes: followupDraft.notes,
      })
      addToast('Follow-up scheduled.', 'success')
      await load()
    } catch (error: any) {
      if (error.response?.data) {
        addToast(`Follow-up failed: ${JSON.stringify(error.response.data)}`, 'error')
      } else {
        addToast('Could not create the follow-up.', 'error')
      }
    }
  }

  const checkInNext = async () => {
    const nextWaiting = queue.find((item) => item.status === 'waiting')
    if (!nextWaiting) {
      addToast('No waiting token found.', 'info')
      return
    }
    try {
      await api.post(`/queue/${nextWaiting.id}/check_in/`)
      addToast(`Token ${nextWaiting.token_number} checked in.`, 'success')
      await load()
    } catch {
      addToast('Could not check in the token.', 'error')
    }
  }

  const callNext = async () => {
    const firstDoctor = doctors[0]
    if (!firstDoctor) {
      addToast('Load doctors before calling the queue.', 'warning')
      return
    }
    try {
      await api.post('/queue/call_next/', { doctor: firstDoctor.id, service_date: new Date().toISOString().slice(0, 10) })
      addToast(`Called next patient for Dr. ${firstDoctor.full_name}.`, 'success')
      await load()
    } catch {
      addToast('Could not call the next token.', 'error')
    }
  }

  const [newPatientDraft, setNewPatientDraft] = useState({ full_name: '', preferred_language: 'English', phone_number: '' })
  const [phoneDialCode, setPhoneDialCode] = useState('+91')
  
  const [isAddingNewPatient, setIsAddingNewPatient] = useState(false)

  const _createPatient = async (event: React.SyntheticEvent, onSuccess?: (patient: PatientDto) => void) => {
    event.preventDefault()
    
    try {
      const res = await api.post('/patients/', { ...newPatientDraft, phone: `${phoneDialCode}${newPatientDraft.phone_number}` })
      addToast('Patient created successfully.', 'success')
      setNewPatientDraft({ full_name: '', preferred_language: 'English', phone_number: '' })
      setPhoneDialCode('+91')
      await load()
      if (onSuccess) {
        onSuccess(res.data)
      }
    } catch (error: any) {
      if (!error.response || error.response.status >= 500) {
        addToast("Sorry, couldn't create patient, try again after sometime.", "error")
      } else if (error.response.status === 400) {
        const data = error.response.data
        if (data?.phone) {
          addToast("Invalid phone number. Please check the format.", "error")
          // } else if (data?.abha_number) {
          //   setPatientError("Invalid ABHA number. Please ensure it is correct.")
        } else if (data?.full_name) {
          addToast("Please provide a valid full name.", "error")
        } else {
          addToast("Please check the provided details and try again.", "error")
        }
      } else {
        addToast("Sorry, couldn't create patient, try again after sometime.", "error")
      }
    }
  }

  return (
    <WorkspaceShell
      user={user}
      clinics={clinics}
      title="Reception Desk"
      nav={[
        { label: 'Dashboard', href: '/app/dashboard', icon: <LayoutDashboard className="h-4 w-4 opacity-70" /> },
        { label: 'Patient directory', href: '/app/patients', icon: <ClipboardList className="h-4 w-4 opacity-70" /> },
        { label: 'Booking', href: '/app/booking', icon: <CalendarDays className="h-4 w-4 opacity-70" /> },
        { label: 'Follow-ups', href: '/app/followups', icon: <FileBarChart className="h-4 w-4 opacity-70" /> },
        ...(plan === 'growth' ? [{ label: 'Call logs', href: '/app/calls', icon: <PhoneCall className="h-4 w-4 opacity-70" /> }] : []),
      ]}
      hasMultiRole={hasMultiRole}
      currentView={currentView}
      onSwitchView={onSwitchView}
    >

      <Routes>
        <Route path="/" element={<Navigate to="dashboard" replace />} />
        
        <Route path="dashboard" element={<ReceptionistDashboard />} />
        
        {plan === 'growth' && (
          <Route path="calls" element={
            <div className="max-w-6xl">
              <CallLogs />
            </div>
          } />
        )}

        <Route path="patients" element={<PatientWorkspace />} />
        <Route path="booking" element={
          <div className="w-full">
            <div className="space-y-6">
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-950">Upcoming Bookings</h3>
                  <div className="flex items-center gap-3">
                    <Input 
                      type="date" 
                      value={bookingDate} 
                      onChange={(e) => {
                        setBookingDate(e.target.value)
                        setBookingPage(1)
                      }} 
                      className="h-9 w-40 text-sm" 
                    />
                    <Button variant="secondary" size="sm" onClick={() => { void load(); void loadAppointments(); }}>Refresh</Button>
                    <Button variant="default" size="sm" onClick={() => setIsBookingModalOpen(true)}>Add Booking</Button>
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 font-medium">Time</th>
                        <th className="px-4 py-3 font-medium">Patient</th>
                        <th className="px-4 py-3 font-medium">Doctor</th>
                        <th className="px-4 py-3 font-medium">Reason</th>
                        <th className="px-4 py-3 font-medium">Booked by</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {appointments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                            No upcoming bookings.
                          </td>
                        </tr>
                      ) : (
                        appointments.map((appt) => {
                          // The patient list is only partly loaded, so the name comes with the appointment.
                          const patient = appt.patient_name || patientOptions.find(p => p.value === String(appt.patient))?.label || `Patient #${appt.patient}`
                          const doctor = doctorOptions.find(d => d.value === String(appt.doctor))?.label || `Doctor #${appt.doctor}`
                          return (
                            <tr key={appt.id}>
                              <td className="px-4 py-3 text-slate-900 font-medium whitespace-nowrap">
                                {new Date(appt.starts_at).toLocaleDateString()} {new Date(appt.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-4 py-3 text-slate-600">{patient}</td>
                              <td className="px-4 py-3 text-slate-600">{doctor}</td>
                              <td className="px-4 py-3 text-slate-500">{appt.reason || '-'}</td>
                              <td className="px-4 py-3">
                                {/* "phone" is set by the AI receptionist's booking tool; everything else is booked by staff. */}
                                {appt.source === 'phone' ? <Badge variant="purple">AI agent</Badge> : <Badge variant="muted">Receptionist</Badge>}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={bookingPage <= 1} 
                      onClick={() => setBookingPage(p => p - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm font-medium text-slate-600">
                      Page {bookingPage} of {bookingTotalPages}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={bookingPage >= bookingTotalPages} 
                      onClick={() => setBookingPage(p => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
            
            <Dialog open={isBookingModalOpen} onOpenChange={setIsBookingModalOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>New Booking</DialogTitle>
                </DialogHeader>
                <form className="space-y-4 pt-4" onSubmit={createBooking}>
                  <PatientFormDialog 
                    isOpen={isAddingNewPatient} 
                    onOpenChange={(open) => {
                      setIsAddingNewPatient(open)
                      if (!open && booking.patient === 'ADD_NEW') {
                        setBooking(current => ({ ...current, patient: '' }))
                      }
                    }} 
                    onSuccess={async (patientId) => {
                      await load() // refresh patient list
                      setBooking(current => ({ ...current, patient: String(patientId) }))
                    }} 
                  />
                  <Select value={booking.patient} onValueChange={(val) => {
                    if (val === 'ADD_NEW') {
                      setIsAddingNewPatient(true)
                      setBooking((current) => ({ ...current, patient: '' }))
                    } else {
                      setBooking((current) => ({ ...current, patient: val }))
                    }
                  }} required>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a patient">
                        {booking.patient === 'ADD_NEW' ? '+ Add New Patient' : patientOptions.find(p => p.value === booking.patient)?.label}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADD_NEW" className="font-semibold text-emerald-600">+ Add New Patient</SelectItem>
                      {patientOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={booking.doctor} onValueChange={(val) => setBooking((current) => ({ ...current, doctor: val || '' }))} required>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a doctor">
                        {doctorOptions.find(d => d.value === booking.doctor)?.label}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {doctorOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Label className="block">
                    <span className="text-sm text-slate-600 font-medium mb-1 block">Start Time</span>
                    <DateTimePickerAmPm min={minDateTime} value={booking.starts_at} onChange={(val) => setBooking((current) => ({ ...current, starts_at: val }))} required />
                  </Label>
                  <Label className="block">
                    <span className="text-sm text-slate-600 font-medium mb-1 block">End Time</span>
                    <DateTimePickerAmPm min={booking.starts_at || minDateTime} value={booking.ends_at} onChange={(val) => setBooking((current) => ({ ...current, ends_at: val }))} required />
                  </Label>
                  <Input className="w-full" value={booking.reason} onChange={(event) => setBooking((current) => ({ ...current, reason: event.target.value }))} placeholder="Reason for visit" />
                  <Button variant="default" type="submit" className="w-full justify-center mt-2" disabled={!booking.patient || !booking.doctor}>Book appointment</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        } />

        <Route path="followups" element={
          <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <div className="space-y-6">
              <Card className="space-y-4 p-5" id="followups-list">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-950">Follow-ups Log</h3>
                  <Button variant="secondary" size="sm" onClick={() => void load()}>Refresh</Button>
                </div>
                <div className="space-y-3">
                  {followups.length === 0 ? (
                    <p className="text-sm text-slate-500">No follow-ups found.</p>
                  ) : (
                    followups.map(f => (
                      <div key={f.id} className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 rounded-xl border border-slate-200 p-4 bg-slate-50">
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900">{f.patient_name || `Patient #${f.patient}`}</p>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              f.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              f.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              f.status === 'failed' ? 'bg-rose-100 text-rose-700' :
                              'bg-slate-200 text-slate-700'
                            }`}>
                              {f.status}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">Dr. {f.doctor_name || f.doctor}</p>
                          {f.notes && <p className="text-sm text-slate-500 italic mt-1 bg-white p-2 rounded-lg border border-slate-100">Note: {f.notes}</p>}
                          {f.outcome && <p className="text-sm font-medium text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-100 mt-1">Outcome: {f.outcome}</p>}
                        </div>
                        <div className="text-left sm:text-right shrink-0">
                          <p className="text-sm font-bold text-slate-900">
                            {new Date(f.scheduled_for).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                          <span className="inline-block px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-semibold uppercase tracking-wider text-slate-600 mt-1">
                            {f.method}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="space-y-4 p-5" id="followups-create">
                <h3 className="text-lg font-semibold text-slate-950">Follow-ups and communication</h3>
                <form className="space-y-3" onSubmit={createFollowUp}>
                  <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={followupDraft.patient} onChange={(event) => setFollowupDraft((current) => ({ ...current, patient: event.target.value }))} required>
                    <option value="" disabled>Select a patient</option>
                    {patientOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={followupDraft.doctor} onChange={(event) => setFollowupDraft((current) => ({ ...current, doctor: event.target.value }))} required>
                    <option value="" disabled>Select a doctor</option>
                    {doctorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <label className="block">
                    <span className="text-sm text-slate-600 font-medium mb-1 block">Scheduled For</span>
                    <DateTimePickerAmPm min={minDateTime} value={followupDraft.scheduled_for} onChange={(val) => setFollowupDraft((current) => ({ ...current, scheduled_for: val }))} required />
                  </label>
                  <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={followupDraft.method} onChange={(event) => setFollowupDraft((current) => ({ ...current, method: event.target.value }))}>
                    <option value="phone">Call</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
                  <textarea className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2" value={followupDraft.notes} onChange={(event) => setFollowupDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Communication notes" />
                  <Button variant="default" type="submit" className="w-full justify-center" disabled={!followupDraft.patient || !followupDraft.doctor}>Create follow-up</Button>
                </form>
              </Card>
            </div>
          </div>
        } />

        <Route path="queue" element={
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
            <div className="space-y-6">
              <Card className="space-y-4 p-5" id="queue">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">Live queue</h3>
                    <p className="text-sm text-slate-500">Check-in and call-next actions hit queue endpoints directly.</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => void load()}>Refresh</Button>
                </div>
                <div className="space-y-3">
                  {(queue || []).filter(t => t.status !== 'completed' && t.status !== 'skipped').slice(0, 6).map((token) => (
                    <div key={token.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-950">Token {token.token_number}</p>
                          <p className="text-sm text-slate-500">{token.status} · {formatDate(token.service_date)}</p>
                        </div>
                        <Button size="sm" variant="secondary" onClick={async () => {
                          try {
                            await api.post(`/queue/${token.id}/check_in/`)
                            addToast(`Token ${token.token_number} checked in.`, 'success')
                            await load()
                          } catch {
                            addToast('Could not check in that token.', 'error')
                          }
                        }}>Check in</Button>
                      </div>
                    </div>
                  ))}
                  {queue.filter(t => t.status !== 'completed' && t.status !== 'skipped').length === 0 && <p className="text-sm text-slate-500">The queue is currently empty.</p>}
                </div>
                <Button variant="secondary" className="w-full justify-center" onClick={() => void checkInNext()}>
                  Check in next waiting
                </Button>
                <Button variant="default" className="w-full justify-center" onClick={() => void callNext()}>
                  Call next
                </Button>
              </Card>

              <Card className="space-y-4 p-5 h-fit">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">Recently Completed</h3>
                    <p className="text-sm text-slate-500">Completed consultations with doctor notes.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {(queue || []).filter(t => t.status === 'completed').slice(0, 5).map((token) => (
                    <div key={token.id} className="rounded-2xl border border-slate-200 bg-white p-4 opacity-75">
                      <div className="flex items-center justify-between gap-3">
                        <div className="w-full">
                          <p className="font-semibold text-slate-500 line-through">Token {token.token_number} - {token.patient_name || 'Patient ' + token.patient}</p>
                          <p className="text-sm text-emerald-600 font-medium">✓ Completed</p>
                          {token.notes && <p className="text-sm text-slate-600 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">{token.notes}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {queue.filter(t => t.status === 'completed').length === 0 && (
                    <p className="text-sm text-slate-500 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                      No recently completed patients.
                    </p>
                  )}
                </div>
              </Card>
            </div>
            <div className="space-y-6">
              <Card className="space-y-4 p-5">
                <h3 className="text-lg font-semibold text-slate-950">Today’s appointments</h3>
                <div className="space-y-3">
                  {(appointments || []).filter(a => a.status === 'scheduled' && isToday(a.starts_at)).slice(0, 6).map((appointment) => (
                    <div key={appointment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-slate-950">{appointment.reason}</p>
                          <p className="text-sm text-slate-500">{formatDateTime(appointment.starts_at)} · {appointment.status}</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          {appointment.status === 'scheduled' && (
                            <Button variant="default" size="sm" onClick={() => void checkInAppointment(appointment.id)}>Check In</Button>
                          )}
                          {appointment.status !== 'cancelled' && (
                            <Button variant="secondary" size="sm" onClick={() => void cancelAppointment(appointment.id)}>Cancel</Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {appointments.length === 0 && <p className="text-sm text-slate-500">No appointments today.</p>}
                </div>
              </Card>

              <Card className="space-y-4 p-5">
                <h3 className="text-lg font-semibold text-slate-950">Recent follow-ups</h3>
                <div className="space-y-3">
                  {(followups || []).slice(0, 5).map((followup) => (
                    <div key={followup.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="font-semibold text-slate-950">{followup.method} · {followup.status}</p>
                      <p className="text-sm text-slate-500">{formatDateTime(followup.scheduled_for)}</p>
                      <p className="mt-2 text-sm text-slate-600">{followup.notes || 'No notes yet.'}</p>
                    </div>
                  ))}
                  {followups.length === 0 && <p className="text-sm text-slate-500">No recent follow-ups.</p>}
                </div>
              </Card>
            </div>
          </div>
        } />

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
      title="Doctor Workspace"
      nav={[
        { label: 'Dashboard', href: '/app/dashboard', icon: <LayoutDashboard className="h-4 w-4 opacity-70" /> },
        { label: 'Calendar', href: '/app/calendar', icon: <CalendarDays className="h-4 w-4 opacity-70" /> },
        { label: 'Personal queue', href: '/app/queue', icon: <ListTodo className="h-4 w-4 opacity-70" /> },
        { label: 'Patient chart', href: '/app/patients', icon: <ClipboardList className="h-4 w-4 opacity-70" /> },
        { label: 'AI summaries', href: '/app/ai', icon: <Sparkles className="h-4 w-4 opacity-70" /> },
        { label: 'Settings', href: '/app/settings', icon: <SettingsIcon className="h-4 w-4 opacity-70" /> },
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
              showBookButton={false}
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

  const hasMultiRole = (user.role === 'clinic_admin' && user.is_doctor) || (user.role === 'doctor' && user.is_clinic_admin)
  const currentView = activeView || user.role

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
    return <DoctorWorkspace {...workspaceProps} />
  }

  return <ReceptionDesk {...workspaceProps} />
}
