import { useEffect, useState, useCallback } from 'react'
import { api } from '../lib/api'
import { useRealtimeEvents } from '../hooks/useRealtimeEvents'

import { PhoneIncoming, TrendingUp, Clock, Users, CheckCircle2, XCircle, Info, PhoneOff } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/shadcn/dialog'

// ─── Types ───────────────────────────────────────────────────────────────────
type DashboardMetrics = {
  appointments: { total: number; today: number; completion_rate: number }
  followups: { total: number; due_today: number; conversion_rate: number }
  queue: { waiting: number; serving: number; average_wait_seconds: number }
}

type AIAnalytics = {
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
    calls_unanswered: number
    calls_other: number
  }
  calls_by_day: { date: string; total: number; converted: number }[]
}

type DoctorAnalytics = {
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

// ─── SVG Line Chart ───────────────────────────────────────────────────────────
function SimpleLineChart({ data }: { data: { date: string; total: number }[] }) {
  if (!data || data.length < 2) return (
    <div className="flex items-center justify-center h-full text-sm text-slate-400">
      Not enough data to display chart
    </div>
  )

  const W = 600, H = 180, PAD = 24
  const maxTotal = Math.max(...data.map(d => d.total), 1)

  const xScale = (i: number) => PAD + (i / (data.length - 1)) * (W - PAD * 2)
  const yScale = (v: number) => H - PAD - (v / maxTotal) * (H - PAD * 2)

  const totalPoints = data.map((d, i) => `${xScale(i)},${yScale(d.total)}`).join(' ')
  const totalFill = `${totalPoints} ${xScale(data.length - 1)},${H - PAD} ${xScale(0)},${H - PAD}`

  const step = Math.max(1, Math.floor(data.length / 6))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      <defs>
        <linearGradient id="grad-total-simple" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0, 0.25, 0.5, 0.75, 1].map(r => (
        <line key={r} x1={PAD} y1={PAD + r * (H - PAD * 2)} x2={W - PAD} y2={PAD + r * (H - PAD * 2)} stroke="#e2e8f0" strokeWidth="1" />
      ))}

      <polygon points={totalFill} fill="url(#grad-total-simple)" />
      <polyline points={totalPoints} fill="none" stroke="#06B6D4" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {data.map((d, i) => (
        <circle key={i} cx={xScale(i)} cy={yScale(d.total)} r="3" fill="#06B6D4" />
      ))}

      {data.map((d, i) => i % step === 0 ? (
        <text key={i} x={xScale(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">
          {new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
        </text>
      ) : null)}
    </svg>
  )
}

// ─── Dual Line Chart ──────────────────────────────────────────────────────────
function LineChart({ data }: { data: { date: string; total: number; converted: number }[] }) {
  if (!data || data.length < 2) return (
    <div className="flex items-center justify-center h-full text-sm text-slate-400">
      Not enough data to display chart
    </div>
  )

  const W = 600, H = 180, PAD = 24
  const maxTotal = Math.max(...data.map(d => d.total), 1)

  const xScale = (i: number) => PAD + (i / (data.length - 1)) * (W - PAD * 2)
  const yScale = (v: number) => H - PAD - (v / maxTotal) * (H - PAD * 2)

  const totalPoints = data.map((d, i) => `${xScale(i)},${yScale(d.total)}`).join(' ')
  const convertedPoints = data.map((d, i) => `${xScale(i)},${yScale(d.converted)}`).join(' ')

  const totalFill = `${totalPoints} ${xScale(data.length - 1)},${H - PAD} ${xScale(0)},${H - PAD}`
  const convertedFill = `${convertedPoints} ${xScale(data.length - 1)},${H - PAD} ${xScale(0)},${H - PAD}`

  // Show every ~5th label
  const step = Math.max(1, Math.floor(data.length / 6))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      <defs>
        <linearGradient id="grad-total" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="grad-converted" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34E0FF" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#34E0FF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(r => (
        <line key={r}
          x1={PAD} y1={PAD + r * (H - PAD * 2)}
          x2={W - PAD} y2={PAD + r * (H - PAD * 2)}
          stroke="#e2e8f0" strokeWidth="1"
        />
      ))}

      {/* Fill areas */}
      <polygon points={totalFill} fill="url(#grad-total)" />
      <polygon points={convertedFill} fill="url(#grad-converted)" />

      {/* Lines */}
      <polyline points={totalPoints} fill="none" stroke="#06B6D4" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={convertedPoints} fill="none" stroke="#34E0FF" strokeWidth="2" strokeDasharray="5,3" strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots */}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={xScale(i)} cy={yScale(d.total)} r="3" fill="#06B6D4" />
          <circle cx={xScale(i)} cy={yScale(d.converted)} r="2.5" fill="#34E0FF" />
        </g>
      ))}

      {/* X-axis labels */}
      {data.map((d, i) => i % step === 0 ? (
        <text key={i} x={xScale(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">
          {new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
        </text>
      ) : null)}
    </svg>
  )
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────
function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) return (
    <div className="flex items-center justify-center h-full text-sm text-slate-400">No call data yet</div>
  )

  const R = 56, CX = 70, CY = 70, STROKE = 18
  const circumference = 2 * Math.PI * R
  let offset = 0

  return (
    <div className="flex items-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140" className="flex-shrink-0">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f5f9" strokeWidth={STROKE} />
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * circumference
          const gap = circumference - dash
          const el = (
            <circle key={i} cx={CX} cy={CY} r={R}
              fill="none" stroke={seg.color} strokeWidth={STROKE}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset + circumference * 0.25}
              strokeLinecap="butt"
              style={{ transform: 'rotate(-90deg)', transformOrigin: `${CX}px ${CY}px` }}
            />
          )
          offset += dash
          return el
        })}
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize="20" fontWeight="700" fill="#030D39">{total}</text>
        <text x={CX} y={CY + 12} textAnchor="middle" fontSize="9" fill="#64748b">Total Calls</text>
      </svg>
      <div className="space-y-2 flex-1 min-w-0">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: seg.color }} />
              <span className="text-xs text-slate-600 truncate">{seg.label}</span>
            </div>
            <span className="text-xs font-semibold text-slate-800 flex-shrink-0">
              {total > 0 ? Math.round(seg.value / total * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KPICard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub: string; color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="rounded-xl p-2.5 flex-shrink-0" style={{ background: color + '18' }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
        <p className="text-xs text-slate-400 mt-1">{sub}</p>
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [ai, setAI] = useState<AIAnalytics | null>(null)
  const [doctorStats, setDoctorStats] = useState<DoctorAnalytics | null>(null)
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null)
  const [days, setDays] = useState(7)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    Promise.all([
      api.get<DashboardMetrics>('/reports/dashboard/'),
      api.get<AIAnalytics>(`/reports/ai-analytics/?days=${days}`),
      api.get<DoctorAnalytics>(`/reports/doctor-analytics/?days=${days}`),
    ]).then(([m, a, d]) => {
      setMetrics(m.data)
      setAI(a.data)
      setDoctorStats(d.data)
    }).catch(() => setError(true))
  }, [days])

  useEffect(() => { load() }, [load])

  useRealtimeEvents((payload) => {
    if (payload.type.startsWith('appointment.') || payload.type.startsWith('queue.')) load()
  })

  if (error) return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">Dashboard could not be loaded.</p>
  if (!metrics || !ai) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#06B6D4] border-t-transparent animate-spin" />
        <p className="text-sm text-slate-500">Loading dashboard…</p>
      </div>
    </div>
  )

  const fmt = (s: number) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`

  const donutSegments = [
    { label: 'Appointment Booked', value: ai.summary.calls_with_booking, color: '#06B6D4' },
    { label: 'Cancelled', value: ai.summary.calls_cancelled, color: '#f59e0b' },
    { label: 'Info Only', value: ai.summary.calls_info_only, color: '#8b5cf6' },
    { label: 'Unanswered', value: ai.summary.calls_unanswered, color: '#ef4444' },
    { label: 'Other', value: ai.summary.calls_other, color: '#94a3b8' },
  ].filter(s => s.value > 0)

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Live AI call analytics & clinic performance</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${days === d
                ? 'bg-[#030D39] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Doctor Analytics Row */}
      {doctorStats && doctorStats.doctors.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-4">Doctor Performance</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {doctorStats.doctors.map(doc => (
              <div 
                key={doc.doctor_id} 
                className="border border-slate-100 bg-slate-50 rounded-xl p-4 flex flex-col gap-3 hover:bg-slate-100 transition-colors cursor-pointer"
                onClick={() => setSelectedDoctorId(doc.doctor_id)}
              >
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-slate-800 text-sm">Dr. {doc.doctor_name}</h3>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                    {doc.total_appointments > 0 ? Math.round((doc.completed_appointments / doc.total_appointments) * 100) : 0}% Completion
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Patients</p>
                    <p className="text-xl font-bold text-slate-700 leading-none mt-1">{doc.total_appointments}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Avg Wait</p>
                    <p className="text-xl font-bold text-slate-700 leading-none mt-1">{Math.ceil(doc.avg_wait_seconds / 60)}<span className="text-sm">m</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Return Rate</p>
                    <p className="text-xl font-bold text-[#06B6D4] leading-none mt-1">{doc.return_rate}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={<PhoneIncoming size={18} />} label="Total Calls" value={ai.summary.total_calls}
          sub={`${ai.summary.inbound_calls} inbound · ${ai.summary.outbound_calls} outbound`} color="#06B6D4" />
        <KPICard icon={<TrendingUp size={18} />} label="Conversion Rate" value={`${ai.summary.booking_conversion_rate}%`}
          sub={`${ai.summary.calls_with_booking} bookings from calls`} color="#22c55e" />
        <KPICard icon={<Clock size={18} />} label="Avg Call Duration" value={fmt(ai.summary.avg_duration_seconds)}
          sub="Per AI-handled call" color="#8b5cf6" />
        <KPICard icon={<Users size={18} />} label="Waiting Now" value={metrics.queue.waiting}
          sub={`${metrics.queue.serving} in consultation`} color="#f59e0b" />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Line Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-800">Call Performance</h2>
              <p className="text-xs text-slate-400 mt-0.5">Last {days} days</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="inline-block w-5 h-0.5 bg-[#06B6D4] rounded" />Total Calls
              </span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="inline-block w-5 h-0.5 bg-[#34E0FF] rounded border-dashed" style={{ borderTop: '2px dashed #34E0FF', background: 'none' }} />Booked
              </span>
            </div>
          </div>
          <div className="h-44">
            <LineChart data={ai.calls_by_day} />
          </div>
        </div>

        {/* Donut Chart */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-1">Call Outcomes</h2>
          <p className="text-xs text-slate-400 mb-4">Last {days} days breakdown</p>
          <DonutChart segments={donutSegments} />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Outcome Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-4">Outcome Breakdown</h2>
          <div className="space-y-3">
            {[
              { label: 'Appointments Booked', val: ai.summary.calls_with_booking, icon: <CheckCircle2 size={14} />, color: '#06B6D4' },
              { label: 'Appointments Cancelled', val: ai.summary.calls_cancelled, icon: <XCircle size={14} />, color: '#f59e0b' },
              { label: 'Information Only', val: ai.summary.calls_info_only, icon: <Info size={14} />, color: '#8b5cf6' },
              { label: 'Unanswered', val: ai.summary.calls_unanswered, icon: <PhoneOff size={14} />, color: '#ef4444' },
            ].map(({ label, val, icon, color }) => {
              const pct = ai.summary.total_calls > 0 ? Math.round(val / ai.summary.total_calls * 100) : 0
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5 font-medium" style={{ color }}>
                      {icon}{label}
                    </span>
                    <span className="text-slate-600 font-semibold">{val} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Clinic Stats */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-4">Clinic Snapshot</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Appointments Today', val: metrics.appointments.today, color: '#06B6D4' },
              { label: 'Completion Rate', val: `${metrics.appointments.completion_rate}%`, color: '#22c55e' },
              { label: 'Follow-ups Due', val: metrics.followups.due_today, color: '#f59e0b' },
              { label: 'Avg Wait Time', val: `${Math.ceil(metrics.queue.average_wait_seconds / 60)} min`, color: '#8b5cf6' },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className="text-xl font-bold" style={{ color }}>{val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Doctor Modal */}
      {selectedDoctorId && doctorStats ? (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setSelectedDoctorId(null) }}>
          <DialogContent className="sm:max-w-[700px]">
            {(() => {
              const doc = doctorStats.doctors.find(d => d.doctor_id === selectedDoctorId)
              if (!doc) return null
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-xl">Dr. {doc.doctor_name}</DialogTitle>
                    <DialogDescription>
                      {doc.degree && doc.specialty ? `${doc.degree} • ${doc.specialty}` : (doc.specialty || doc.degree || 'General Physician')}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-4 space-y-6">
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                        <p className="text-xs text-slate-500 font-medium uppercase mb-1">Total Patients</p>
                        <p className="text-2xl font-bold text-[#06B6D4]">{doc.total_appointments}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                        <p className="text-xs text-slate-500 font-medium uppercase mb-1">Completed</p>
                        <p className="text-2xl font-bold text-emerald-500">{doc.completed_appointments}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                        <p className="text-xs text-slate-500 font-medium uppercase mb-1">Avg Wait</p>
                        <p className="text-2xl font-bold text-amber-500">{Math.ceil(doc.avg_wait_seconds / 60)}<span className="text-sm text-slate-500">m</span></p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                        <p className="text-xs text-slate-500 font-medium uppercase mb-1">Return Rate</p>
                        <p className="text-2xl font-bold text-indigo-500">{doc.return_rate}%</p>
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-2xl border border-slate-200 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-800">Patient Volume</h3>
                        <p className="text-xs text-slate-400">Last {doctorStats.period_days} days</p>
                      </div>
                      <div className="h-56">
                        <SimpleLineChart data={doc.appointments_by_day} />
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}
          </DialogContent>
        </Dialog>
      ) : null}

    </div>
  )
}
