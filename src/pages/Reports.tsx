import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  CalendarCheck, CalendarX, Clock, Download, Info, Phone, PhoneMissed, RotateCcw, Timer, Users,
} from 'lucide-react'
import { BreakdownBar } from '../components/analytics/BreakdownBar'
import { CallLogsTable } from '../components/analytics/CallLogsTable'
import { ReportFiltersBar } from '../components/analytics/ReportFiltersBar'
import { useReportFilters } from '../hooks/useReportFilters'
import { useRealtimeEvents } from '../hooks/useRealtimeEvents'
import {
  OTHER_OUTCOME, OUTCOMES, SENTIMENTS, downloadReport, formatDuration, getAIAnalytics, getDoctorAnalytics, languageLabel, localDateKey,
  type AIAnalytics, type CallLogQuery, type DoctorAnalytics, type Sentiment,
} from '../lib/analytics'
import { listDoctors, type Doctor } from '../lib/appointments'
import { toast } from '../components/shadcn/toast'

const LANGUAGE_COLORS = ['#030D39', '#06B6D4', '#8b5cf6', '#f59e0b', '#22c55e', '#ec4899', '#64748b']

function Panel({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}>
      <h3 className="mb-4 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  )
}

/** One row per day from start to end (yyyy-MM-dd), zero where there were no calls. */
function fillDays(rows: AIAnalytics['calls_by_day'], start: string, end: string) {
  const byDate = new Map(rows.map((r) => [r.date, r]))
  const out: AIAnalytics['calls_by_day'] = []
  for (const d = new Date(`${start}T00:00:00`); localDateKey(d) <= end; d.setDate(d.getDate() + 1)) {
    const key = localDateKey(d)
    out.push(byDate.get(key) ?? { date: key, total: 0, converted: 0 })
  }
  return out
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />
}

/** AI call analytics, doctor performance and every call, for the chosen period (modelled on hkvoice's Analytics). */
export default function Reports() {
  const [filters, setFilters] = useReportFilters()
  const [ai, setAI] = useState<AIAnalytics | null>(null)
  const [doctors, setDoctors] = useState<DoctorAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [outcome, setOutcome] = useState('')
  const [sentiment, setSentiment] = useState<CallLogQuery['sentiment']>('')
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  // The doctor filter's choices.
  const [doctorList, setDoctorList] = useState<Doctor[]>([])
  useEffect(() => { listDoctors().then(setDoctorList).catch(() => setDoctorList([])) }, [])
  const chosenDoctor = doctorList.find((d) => String(d.id) === filters.doctor)

  const [downloading, setDownloading] = useState(false)
  const download = async () => {
    setDownloading(true)
    try {
      await downloadReport(filters)
    } catch {
      toast.add({ title: 'The report could not be downloaded. Try again.', type: 'error' })
    } finally {
      setDownloading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    Promise.all([getAIAnalytics(filters), getDoctorAnalytics(filters)])
      .then(([a, d]) => { if (!cancelled) { setAI(a); setDoctors(d) } })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filters, reloadKey])

  useRealtimeEvents((payload) => {
    if (payload.type.startsWith('appointment.')) reload()
  })

  const s = ai?.summary
  const metrics = s ? [
    { label: 'Total calls', value: s.total_calls.toLocaleString(), sub: `${s.inbound_calls} in · ${s.outbound_calls} out`, icon: Phone },
    { label: 'Appointments booked', value: s.calls_with_booking.toLocaleString(), sub: `${s.booking_conversion_rate}% of calls`, icon: CalendarCheck },
    { label: 'Cancellations', value: s.calls_cancelled.toLocaleString(), sub: 'by phone', icon: CalendarX },
    { label: 'Information only', value: s.calls_info_only.toLocaleString(), sub: 'no booking change', icon: Info },
    { label: 'Needs callback', value: (s.calls_needs_callback ?? 0).toLocaleString(), sub: 'asked for a person', icon: PhoneMissed },
    { label: 'Avg. call length', value: formatDuration(s.avg_duration_seconds), sub: 'per call', icon: Clock },
    { label: 'Talk time', value: formatDuration(s.total_duration_seconds), sub: 'all calls', icon: Timer },
    { label: 'Patients reached', value: s.patients_reached.toLocaleString(), sub: 'known patients', icon: Users },
  ] : []

  const outcomeData = s ? [
    { name: 'booked', label: OUTCOMES[0].label, value: s.calls_with_booking, fill: OUTCOMES[0].color },
    { name: 'cancel', label: OUTCOMES[1].label, value: s.calls_cancelled, fill: OUTCOMES[1].color },
    { name: 'resched', label: OUTCOMES[2].label, value: s.calls_rescheduled ?? 0, fill: OUTCOMES[2].color },
    { name: 'info', label: OUTCOMES[3].label, value: s.calls_info_only, fill: OUTCOMES[3].color },
    { name: 'callback', label: OUTCOMES[4].label, value: s.calls_needs_callback ?? 0, fill: OUTCOMES[4].color },
    { name: 'other', label: OTHER_OUTCOME.label, value: (s.calls_other ?? 0) + (s.calls_unanswered ?? 0), fill: OTHER_OUTCOME.color },
  ] : []

  const languageData = ai
    ? Object.entries(ai.language_breakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([code, value], i) => ({ name: code, label: languageLabel(code), value, fill: LANGUAGE_COLORS[i % LANGUAGE_COLORS.length] }))
    : []

  const directionData = s ? [
    { name: 'inbound', label: 'Inbound', value: s.inbound_calls, fill: '#030D39' },
    { name: 'outbound', label: 'Outbound', value: s.outbound_calls, fill: '#06B6D4' },
  ] : []

  // The server only returns days that had calls; a quiet day is a real zero, not a gap to draw across.
  const volume = ai ? fillDays(ai.calls_by_day, filters.start, filters.end) : []

  const doctorRows = doctors?.doctors ?? []
  const busiest = Math.max(1, ...doctorRows.map((d) => d.total_appointments))

  // Clicking an outcome in the breakdown narrows the call list below to it.
  const showOutcome = (name: string) => {
    setOutcome(name === 'other' ? '' : name)
    document.getElementById('call-logs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Caller sentiment; clicking one lists those calls below.
  const sentimentData = ai
    ? SENTIMENTS.map((m) => ({ name: m.key, label: m.label, value: ai.sentiment_breakdown[m.key] ?? 0, fill: m.color }))
    : []
  const showSentiment = (name: string) => {
    setSentiment(name as Sentiment)
    document.getElementById('call-logs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="max-w-[1400px] space-y-6 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports</h1>
          <p className="mt-0.5 text-sm text-slate-500">AI call analytics, doctor performance and every call.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reload}
            className="flex h-9 !min-h-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" /> Refresh
          </button>
          <button
            type="button"
            onClick={() => void download()}
            disabled={downloading}
            title="Excel workbook: summary, daily calls, outcomes, languages, doctors and every call, for these filters"
            className="flex h-9 !min-h-0 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <Download className="h-4 w-4" /> {downloading ? 'Preparing…' : 'Download report'}
          </button>
        </div>
      </div>

      <ReportFiltersBar filters={filters} onChange={setFilters} doctors={doctorList} />

      {error && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">Analytics could not be loaded. Try Refresh.</p>}

      {chosenDoctor && (
        <p className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Showing the calls that booked or cancelled an appointment with <strong>Dr. {chosenDoctor.full_name}</strong>, and only their
          performance. Information-only and unanswered calls aren't about a doctor, so they're counted under All doctors.
        </p>
      )}

      {/* Overview */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Overview</h3>
          {!!s?.test_calls && (
            <p className="text-xs text-slate-500">
              {s.test_calls} test call{s.test_calls === 1 ? '' : 's'} left out of these numbers. They're listed under Call logs.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white md:grid-cols-4">
          {loading && !s
            ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2 p-4"><Skeleton className="h-3 w-24" /><Skeleton className="h-7 w-16" /></div>
            ))
            : metrics.map(({ label, value, sub, icon: Icon }) => (
              <div key={label} className={`p-4 ${loading ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
                <div className="text-[11px] tabular-nums text-slate-400">{sub}</div>
              </div>
            ))}
        </div>
      </section>

      {/* Volume + outcomes */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Daily call volume">
          {ai && ai.calls_by_day.length > 0 ? (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volume} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fill-calls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#030D39" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#030D39" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="fill-booked" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickFormatter={(v: string) => new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip
                    labelFormatter={(v) => new Date(String(v)).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="total" name="Calls" stroke="#030D39" strokeWidth={2} fill="url(#fill-calls)" />
                  <Area type="monotone" dataKey="converted" name="Booked" stroke="#06B6D4" strokeWidth={2} fill="url(#fill-booked)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">{loading ? 'Loading…' : 'No calls in this period'}</div>
          )}
        </Panel>

        <Panel title="Call outcomes">
          <BreakdownBar data={outcomeData} onSelect={showOutcome} />
          <p className="mt-4 text-xs text-slate-400">Click an outcome to list those calls below.</p>
        </Panel>
      </div>

      {/* Sentiment, languages, direction */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Caller sentiment">
          <BreakdownBar data={sentimentData} onSelect={showSentiment} compact emptyLabel="No rated calls in this period" />
          {!!ai?.sentiment_breakdown.not_rated && (
            <p className="mt-3 text-xs text-slate-400">{ai.sentiment_breakdown.not_rated} call{ai.sentiment_breakdown.not_rated === 1 ? '' : 's'} not rated.</p>
          )}
        </Panel>
        <Panel title="Languages">
          <BreakdownBar data={languageData} compact />
        </Panel>
        <Panel title="Inbound vs outbound">
          <BreakdownBar data={directionData} compact />
        </Panel>
      </div>

      {/* Doctor performance */}
      <Panel title="Doctor performance">
        {doctorRows.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-sm text-slate-400">{loading ? 'Loading…' : 'No appointments in this period'}</div>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-2 font-semibold">Doctor</th>
                  <th className="px-5 py-2 font-semibold">Appointments</th>
                  <th className="px-5 py-2 text-right font-semibold">Completed</th>
                  <th className="px-5 py-2 text-right font-semibold">Completion</th>
                  <th className="px-5 py-2 text-right font-semibold">Avg. wait</th>
                  <th className="px-5 py-2 text-right font-semibold">Follow-up rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {doctorRows.map((d) => {
                  const completion = d.total_appointments ? Math.round((d.completed_appointments / d.total_appointments) * 100) : 0
                  return (
                    <tr key={d.doctor_id}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">Dr. {d.doctor_name}</p>
                        <p className="text-xs text-slate-500">{d.specialty || 'General practice'}</p>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-[#030D39]" style={{ width: `${(d.total_appointments / busiest) * 100}%` }} />
                          </div>
                          <span className="tabular-nums font-semibold text-slate-900">{d.total_appointments}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-700">{d.completed_appointments}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-700">{completion}%</td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-700">{d.avg_wait_seconds ? formatDuration(d.avg_wait_seconds) : '—'}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-700">{d.return_rate}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div id="call-logs" className="scroll-mt-4">
        <CallLogsTable
          filters={filters}
          detailPath="/app/reports/calls"
          outcome={outcome}
          onOutcomeChange={setOutcome}
          sentiment={sentiment}
          onSentimentChange={setSentiment}
          showExport={false}
        />
      </div>
    </div>
  )
}
