import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { BrowserRouter, Link, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'

import { api } from './lib/api'
import { PasswordInput, validatePassword } from './components/ui/PasswordInput'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import PatientDrawer from './components/PatientDrawer'
import MobileNavigation from './components/MobileNavigation'
import PwaInstallPrompt from './components/PwaInstallPrompt'
import Dashboard from './pages/Dashboard'
import LiveQueue from './pages/LiveQueue'
import Patients from './pages/Patients'
import CallLogs from './pages/CallLogs'
import CalendarView from './pages/CalendarView'
import Settings from './pages/Settings'
import Placeholder from './pages/Placeholder'
import WorkspaceRouter from './pages/Workspace'
import OnboardingPage from './pages/Onboarding'
import { useUIStore } from './store/uistore'

function getApiErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object') {
    return fallback
  }

  const maybeResponse = (error as { response?: { data?: unknown } }).response
  const data = maybeResponse?.data

  if (typeof data === 'string' && data.trim()) {
    return data
  }

  if (!data || typeof data !== 'object') {
    return fallback
  }

  const payload = data as Record<string, unknown>

  if (typeof payload.detail === 'string' && payload.detail.trim()) {
    return payload.detail
  }

  const messages = Object.entries(payload).flatMap(([field, value]) => {
    if (Array.isArray(value)) {
      return value
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        .map((entry) => `${field}: ${entry}`)
    }

    if (typeof value === 'string' && value.trim()) {
      return [`${field}: ${value}`]
    }

    return []
  })

  return messages.length > 0 ? messages.join(' ') : fallback
}

type ReportTemplateDto = {
  id: number
  name: string
  description: string
  report_type_display: string
  format_display: string
  allowed_roles_display: string[]
  retention_days: number
  is_active: boolean
  created_at?: string
}

type ReportExecutionDto = {
  id: number
  template_name: string
  report_type_display: string
  template_format: string
  status: string
  status_display: string
  is_downloadable: boolean
  download_count: number
  created_at: string
  completed_at?: string | null
  error_message?: string
  signed_download_url?: string | null
}

type ReportDefinitionsDto = {
  report_types: Array<{ value: string; label: string; allowed_roles: string[] }>
  allowed_roles: Array<{ value: string; label: string }>
}

import { LandingPage } from './components/landing/LandingPage'

function GetStartedPage() {
  return (
    <AuthShell title="Get Started" subtitle="Choose how you'd like to continue with ManageOPD.">
      <div className="space-y-3">
        <Link to="/login" className="flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800">Sign in to your account</Link>
        <Link to="/signup" className="flex w-full items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">Create a new clinic</Link>
      </div>
    </AuthShell>
  )
}

function SignupPage() {
  const nav = useNavigate()
  const [clinicName, setClinicName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isAlsoDoctor, setIsAlsoDoctor] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    const pwdError = validatePassword(password)
    if (pwdError) { setError(pwdError); return }
    try {
      await api.post('/auth/signup/', {
        clinic_name: clinicName,
        full_name: fullName,
        email,
        password,
        is_also_doctor: isAlsoDoctor,
      })
      nav('/verify-email')
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, 'Signup failed. Please check your details and try again.'))
    }
  }

  return (
    <AuthShell title="Create your clinic" subtitle="Set up in under 5 minutes. No credit card required.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Clinic name</label>
          <input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none transition-colors" placeholder="e.g. Sunrise Polyclinic" value={clinicName} onChange={(e) => setClinicName(e.target.value)} required />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Your full name</label>
          <input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none transition-colors" placeholder="e.g. Dr. Arjun Sharma" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
          <input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none transition-colors" placeholder="you@clinic.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
          <PasswordInput value={password} onChange={setPassword} placeholder="Create a strong password" showRules required />
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 cursor-pointer hover:bg-slate-50 transition-colors">
          <input 
            type="checkbox" 
            className="h-5 w-5 rounded border-slate-300 text-slate-900 focus:ring-slate-900" 
            checked={isAlsoDoctor}
            onChange={(e) => setIsAlsoDoctor(e.target.checked)}
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-900">I am also a doctor here</span>
            <span className="text-xs text-slate-500">Enable this to access the Doctor dashboard and take appointments.</span>
          </div>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2" type="submit">Create account</button>
      </form>

      <p className="text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-slate-900 underline-offset-2 hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  )
}

export function _ReportsPage() {
  const [templates, setTemplates] = useState<ReportTemplateDto[]>([])
  const [executions, setExecutions] = useState<ReportExecutionDto[]>([])
  const [definitions, setDefinitions] = useState<ReportDefinitionsDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyTemplateId, setBusyTemplateId] = useState<number | null>(null)
  const [busyExecutionId, setBusyExecutionId] = useState<number | null>(null)

  const loadReports = async () => {
    setLoading(true)
    setError('')
    try {
      const [templateResponse, executionResponse, definitionsResponse] = await Promise.all([
        api.get('/reports/templates/'),
        api.get('/reports/executions/'),
        api.get('/reports/templates/definitions/'),
      ])
      setTemplates(templateResponse.data ?? [])
      setExecutions(executionResponse.data ?? [])
      setDefinitions(definitionsResponse.data ?? null)
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, 'Could not load reports.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadReports()
  }, [])

  const requestExport = async (templateId: number) => {
    setBusyTemplateId(templateId)
    setError('')
    try {
      await api.post('/reports/executions/', { template: templateId, parameters: {} })
      await loadReports()
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, 'Could not queue the export job.'))
    } finally {
      setBusyTemplateId(null)
    }
  }

  const openSignedDownload = async (executionId: number) => {
    setBusyExecutionId(executionId)
    setError('')
    try {
      const response = await api.post(`/reports/executions/${executionId}/signed-download/`)
      const downloadUrl = response.data?.download_url as string | undefined
      if (downloadUrl) {
        window.location.assign(downloadUrl)
      }
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, 'Could not create a signed download link.'))
    } finally {
      setBusyExecutionId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-[240px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 md:min-h-[80vh]">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">ManageOPD Console</p>
          <nav className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
            <Link to="/app">Dashboard</Link>
            <a>Patients</a>
            <a>Doctors</a>
            <a>Appointments</a>
            <a>Queue</a>
            <Link to="/app/reports" className="text-slate-900">Reports</Link>
            <a>Settings</a>
          </nav>
        </aside>
        <main className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Secure reporting</p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Exports and downloads</h1>
              <p className="mt-1 text-sm text-slate-600">Request report jobs, then download them through signed URLs that expire automatically.</p>
            </div>
            <button type="button" onClick={() => void loadReports()} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              Refresh
            </button>
          </div>

          {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

          {definitions && (
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-lg font-semibold text-slate-900">Report types and permissions</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {definitions.report_types.map((reportType) => (
                  <article key={reportType.value} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="font-semibold text-slate-900">{reportType.label}</p>
                    <p className="mt-1 text-sm text-slate-600">Allowed roles: {reportType.allowed_roles.join(', ')}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Available templates</h2>
            <div className="mt-3 grid gap-3">
              {loading && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Loading templates...</div>}
              {!loading && templates.length === 0 && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No report templates are available for your role.</div>}
              {templates.map((template) => (
                <article key={template.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{template.name}</p>
                      <p className="text-sm text-slate-600">{template.report_type_display} · {template.format_display} · Retention {template.retention_days} days</p>
                      <p className="mt-1 text-sm text-slate-500">Roles: {template.allowed_roles_display.join(', ')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void requestExport(template.id)}
                      disabled={busyTemplateId === template.id}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {busyTemplateId === template.id ? 'Queuing...' : 'Request export'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">Recent executions</h2>
            <div className="mt-3 grid gap-3">
              {executions.map((execution) => (
                <article key={execution.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{execution.template_name}</p>
                      <p className="text-sm text-slate-600">{execution.report_type_display} · {execution.status_display} · {execution.download_count} downloads</p>
                      {execution.error_message && <p className="mt-1 text-sm text-rose-600">{execution.error_message}</p>}
                    </div>
                    {execution.is_downloadable ? (
                      <button
                        type="button"
                        onClick={() => void openSignedDownload(execution.id)}
                        disabled={busyExecutionId === execution.id}
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                      >
                        {busyExecutionId === execution.id ? 'Preparing link...' : 'Download'}
                      </button>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Not ready yet</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

function LoginPage() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      const response = await api.post('/auth/login/', { email, password })
      if (!response.data.is_verified) {
        nav('/verify-email')
        return
      }
      nav('/app')
    } catch {
      setError('Invalid credentials or temporary lockout.')
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your ManageOPD account to continue.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
          <input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none transition-colors" placeholder="you@clinic.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <Link to="/forgot-password" className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors">
              Forgot password?
            </Link>
          </div>
          <input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none transition-colors" placeholder="Enter your password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2" type="submit">Sign in</button>
      </form>

      <p className="text-center text-sm text-slate-500">
        Don't have an account?{' '}
        <Link to="/signup" className="font-semibold text-slate-900 underline-offset-2 hover:underline">Create one</Link>
      </p>
    </AuthShell>
  )
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setStatusMessage('')
    try {
      const response = await api.post('/auth/forgot-password/', { email })
      setStatusMessage(response.data?.detail ?? 'If that email exists, a reset link has been sent.')
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, 'Could not send reset link. Please try again.'))
    }
  }

  return (
    <AuthShell title="Forgot password" subtitle="Enter your account email and we'll send you a reset link.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
          <input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none transition-colors" placeholder="you@clinic.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {statusMessage && <p className="text-sm text-emerald-700">{statusMessage}</p>}
        <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2" type="submit">Send reset link</button>
      </form>
      <p className="text-center text-sm text-slate-500">
        Remember your password?{' '}
        <Link to="/login" className="font-semibold text-slate-900 underline-offset-2 hover:underline">Back to sign in</Link>
      </p>
    </AuthShell>
  )
}

function ResetPasswordPage() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const token = params.get('token')

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setStatusMessage('')

    if (!token) {
      setError('Missing reset token. Please use the reset link from your email.')
      return
    }

    const pwdError = validatePassword(password)
    if (pwdError) { setError(pwdError); return }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      const response = await api.post('/auth/reset-password/', { token, password })
      setStatusMessage(response.data?.detail ?? 'Password reset successful. Redirecting to login...')
      setTimeout(() => nav('/login'), 1200)
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError, 'Could not reset password. The link may be invalid or expired.'))
    }
  }

  return (
    <AuthShell title="Reset password" subtitle="Choose a new password for your account.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
          <PasswordInput value={password} onChange={setPassword} placeholder="Enter your new password" showRules required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
          <PasswordInput value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter your new password" required />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {statusMessage && <p className="text-sm text-emerald-700">{statusMessage}</p>}
        <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2" type="submit">Reset password</button>
      </form>
      <p className="text-center text-sm text-slate-500">
        <Link to="/login" className="font-semibold text-slate-900 underline-offset-2 hover:underline">Back to sign in</Link>
      </p>
    </AuthShell>
  )
}

function VerifyEmailPage() {
  const [params] = useSearchParams()
  const [statusMessage, setStatusMessage] = useState('Please verify your email using the link sent to your inbox.')
  const [isSuccess, setIsSuccess] = useState(false)

  const token = params.get('token')

  const nav = useNavigate()

  const verify = async () => {
    if (!token) {
      return
    }
    try {
      await api.post('/auth/verify-email/', { token })
      setStatusMessage('Email verified. Redirecting to login...')
      setIsSuccess(true)
      nav('/login')
    } catch {
      setStatusMessage('Verification failed. The link may be expired or invalid.')
    }
  }

  return (
    <AuthShell title="Verify your email" subtitle="We sent a verification link to your inbox.">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{statusMessage}</p>
        {token && !isSuccess && <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2" onClick={verify}>Verify now</button>}
        {isSuccess && <Link to="/login" className="inline-flex w-full justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">Continue to Sign in</Link>}
      </div>
    </AuthShell>
  )
}

function InviteAcceptPage() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [preview, setPreview] = useState<{ clinic_name: string; role: string } | null>(null)
  const [error, setError] = useState('')

  const token = params.get('token')

  useEffect(() => {
    const fetchPreview = async () => {
      if (!token) {
        return
      }
      try {
        const response = await api.get(`/auth/invites/preview/${encodeURIComponent(token)}/`)
        setPreview(response.data)
      } catch {
        setError('Invalid or expired invitation link.')
      }
    }
    void fetchPreview()
  }, [token])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) {
      return
    }
    try {
      await api.post(`/auth/invites/accept/${encodeURIComponent(token)}/`, { full_name: fullName, password })
      nav('/app')
    } catch {
      setError('Could not accept invitation.')
    }
  }

  return (
    <AuthShell title="Accept invitation" subtitle="You've been invited to join a clinic on ManageOPD.">
      {preview && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Clinic</span>
            <span className="text-sm font-semibold text-slate-900">{preview.clinic_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Your role</span>
            <span className="text-sm font-semibold text-slate-900 capitalize">{preview.role.replace('_', ' ')}</span>
          </div>
        </div>
      )}
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Your full name</label>
          <input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none transition-colors" placeholder="e.g. Dr. Priya Mehta" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Choose a password</label>
          <input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none transition-colors" placeholder="Create a strong password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2" type="submit">Accept and continue</button>
      </form>
    </AuthShell>
  )
}

function ConsolePage() {
  const activeTab = useUIStore((state) => state.activeTab)
  const page = activeTab === 'dashboard' ? <Dashboard /> : activeTab === 'livequeue' ? <LiveQueue /> : activeTab === 'patients' || activeTab === 'doctors' ? <Patients /> : activeTab === 'calllogs' ? <CallLogs /> : activeTab === 'calendar' ? <CalendarView /> : activeTab === 'settings' ? <Settings /> : <Placeholder title={activeTab === 'leads' ? 'Leads' : 'Follow-ups'} />
  return <div className="flex h-dvh overflow-hidden bg-slate-50 text-slate-900"><Sidebar /><div className="flex min-w-0 flex-1 flex-col"><Header /><main id="main-content" className="flex-1 overflow-y-auto p-4 pb-24 md:p-6"><div className="mx-auto max-w-7xl">{page}</div></main></div><PatientDrawer /><MobileNavigation /><PwaInstallPrompt /></div>
}

function AuthShell({ title, children, subtitle }: { title: string; children: ReactNode; subtitle?: string }) {
  return (
    <div className="flex min-h-screen font-jakarta">
      {/* Left branding panel — hidden on mobile */}
      <div className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-slate-900 p-10 lg:flex xl:p-14">
        {/* Animated gradient orbs */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[#34E0FF]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl" />

        {/* Top: Logo */}
        <div>
          <Link to="/" className="flex items-center gap-3 relative z-10 hover:opacity-90 transition-opacity">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm overflow-hidden">
              <img src="/manageopd_icon.png" alt="ManageOPD" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white">ManageOPD</span>
          </Link>
        </div>

        {/* Middle: Tagline and features */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
              One Platform,<br />Every Patient Touchpoint
            </h2>
            <p className="max-w-sm text-[15px] leading-relaxed text-slate-400">
              AI-powered receptionist, smart queue management, clinical summaries, and patient follow-ups — all connected so your team can focus on care.
            </p>
          </div>

          <div className="space-y-4">
            {[
              'AI Voice Receptionist & Call Triage',
              'Smart OPD Queue Management',
              'Auto Clinical Summaries',
              'ABHA & DPDP Compliant',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#34E0FF]/15">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34E0FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-slate-300">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col bg-white">
        {/* Mobile header */}
        <div className="flex items-center justify-between px-6 py-4 lg:hidden">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 overflow-hidden">
              <img src="/manageopd_icon.png" alt="ManageOPD" className="w-full h-full object-cover" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-slate-900">ManageOPD</span>
          </Link>
        </div>

        {/* Form area */}
        <div className="flex flex-1 items-center justify-center px-6 py-10 lg:px-12">
          <div className="w-full max-w-md space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">{title}</h1>
              {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/get-started" element={<GetStartedPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/invite-accept" element={<InviteAcceptPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/app/*" element={<WorkspaceRouter />} />
        <Route path="/app/legacy" element={<ConsolePage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
