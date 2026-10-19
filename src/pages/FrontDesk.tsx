import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { addDays, format, isBefore } from 'date-fns'
import { AlertTriangle, ArrowRight, CheckCircle2, Footprints, MessageCircle, PhoneCall, Plus, UserRound } from 'lucide-react'
import { api } from '../lib/api'
import {
  OUTCOMES, OTHER_OUTCOME, formatDuration, getAIAnalytics, localDateKey, type AIAnalytics, type CallLog, type Paginated,
} from '../lib/analytics'
import { STATUS_META, apiErrorMessage, type Appointment } from '../lib/appointments'
import {
  getCallSettings, getCallsToDo, markReviewSent, resolveCall, type PatientCall, type PatientCallSettings,
} from '../lib/patientCalls'
import { AppointmentDialog } from '../components/appointments/AppointmentDialog'
import { BookAppointmentDialog } from '../components/appointments/BookAppointmentDialog'
import { RecordCallDialog } from '../components/appointments/RecordCallDialog'
import { BreakdownBar } from '../components/analytics/BreakdownBar'
import { Button } from '../components/ui/Button'
import { toast } from '../components/shadcn/toast'
import { useRealtimeEvents } from '../hooks/useRealtimeEvents'
import { formatPhone } from '../lib/phone'

type FollowUp = {
  id: number
  patient: number
  patient_name?: string
  doctor_name?: string
  scheduled_for: string
  method: string
  status: string
  notes: string
}

type Kind = 'checkin' | 'reschedule' | 'callback' | 'followup' | 'reminder' | 'payment' | 'feedback'
type Bucket = 'overdue' | 'today' | 'upcoming'

type Task = {
  id: string
  kind: Kind
  bucket: Bucket
  when: Date
  title: string
  subtitle: string
  demo?: boolean
  action: { label: string; run: () => void | Promise<void> }
}

const KINDS: { kind: Kind | 'all'; label: string }[] = [
  { kind: 'all', label: 'All tasks' },
  { kind: 'checkin', label: 'Check-ins' },
  { kind: 'callback', label: 'Callbacks' },
  { kind: 'followup', label: 'Follow-ups' },
  { kind: 'reschedule', label: 'Reschedule' },
  { kind: 'reminder', label: 'Reminders' },
  { kind: 'feedback', label: 'Feedback' },
]

const KIND_CHIP: Record<Kind, { label: string; className: string }> = {
  checkin: { label: 'Check-in', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  reschedule: { label: 'Reschedule', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  callback: { label: 'Callback', className: 'border-rose-200 bg-rose-50 text-rose-700' },
  followup: { label: 'Follow-up', className: 'border-sky-200 bg-sky-50 text-sky-700' },
  reminder: { label: 'Reminder', className: 'border-violet-200 bg-violet-50 text-violet-700' },
  payment: { label: 'Payment', className: 'border-orange-200 bg-orange-50 text-orange-700' },
  feedback: { label: 'Feedback', className: 'border-pink-200 bg-pink-50 text-pink-700' },
}

const BUCKETS: { key: Bucket | 'done'; label: string; dot: string; hint: string }[] = [
  { key: 'overdue', label: 'Overdue', dot: 'bg-rose-500', hint: 'Before now' },
  { key: 'today', label: 'Today', dot: 'bg-teal-500', hint: 'Later today' },
  { key: 'upcoming', label: 'Upcoming', dot: 'bg-blue-500', hint: 'Next few days' },
  { key: 'done', label: 'Done today', dot: 'bg-emerald-500', hint: 'Checked in or seen' },
]

/** Booking channels; `sources` are the appointment `source` values each covers (seeded ones say "manual"). */
const CHANNELS = [
  { key: 'phone', label: 'AI phone call', icon: PhoneCall, color: '#030D39', sources: ['phone'] },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: '#22c55e', sources: ['whatsapp'] },
  { key: 'front_desk', label: 'Front desk', icon: UserRound, color: '#06B6D4', sources: ['front_desk', 'manual'] },
  { key: 'walk_in', label: 'Walk-in', icon: Footprints, color: '#f59e0b', sources: ['walk_in'] },
]

const dayBounds = (offset: number) => {
  const key = localDateKey(addDays(new Date(), offset))
  return { after: new Date(`${key}T00:00:00`).toISOString(), before: new Date(`${key}T23:59:59.999`).toISOString() }
}

const unwrap = <T,>(data: unknown): T[] =>
  Array.isArray(data) ? (data as T[]) : ((data as { results?: T[] })?.results ?? [])

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/**
 * The front desk's day (modelled on GoKoala's front desk): what needs doing now, from today's check-ins to
 * patients the AI couldn't reach, beside how the AI receptionist's calls are going.
 */
export default function FrontDesk({ userName, callsPath, callDetailPath }: {
  userName: string
  /** Where "Call logs" goes. */
  callsPath: string
  /** A call opens at `${callDetailPath}/<id>`. */
  callDetailPath: string
}) {
  const navigate = useNavigate()
  const [today, setToday] = useState<Appointment[]>([])
  const [tomorrow, setTomorrow] = useState<Appointment[]>([])
  const [patientCalls, setPatientCalls] = useState<PatientCall[]>([])
  const [callSettings, setCallSettings] = useState<PatientCallSettings | null>(null)
  const [logging, setLogging] = useState<PatientCall | null>(null)
  const [toReschedule, setToReschedule] = useState<Appointment[]>([])
  const [followups, setFollowups] = useState<FollowUp[]>([])
  const [missedCalls, setMissedCalls] = useState<CallLog[]>([])
  const [week, setWeek] = useState<AIAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  const [kind, setKind] = useState<Kind | 'all'>('all')
  const [bucket, setBucket] = useState<Bucket | 'done'>('overdue')
  const [opened, setOpened] = useState<Appointment | null>(null)
  const [booking, setBooking] = useState(false)
  const [busyTask, setBusyTask] = useState<string | null>(null)

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const appts = (offset: number, extra: Record<string, string> = {}) => {
      const b = dayBounds(offset)
      return api.get('/appointments/', { params: { starts_at_after: b.after, starts_at_before: b.before, page_size: 1000, ordering: 'starts_at', ...extra } })
        .then((r) => unwrap<Appointment>(r.data))
    }
    const todayKey = localDateKey()
    Promise.allSettled([
      appts(0),
      appts(1, { status: 'scheduled' }),
      getCallsToDo(),
      api.get('/appointments/', { params: { status: 'needs_reschedule', page_size: 100, ordering: 'starts_at' } }).then((r) => unwrap<Appointment>(r.data)),
      api.get('/followups/followups/', {
        params: { scheduled_for_before: dayBounds(3).before, ordering: 'scheduled_for', page_size: 100 },
      }).then((r) => unwrap<FollowUp>(r.data).filter((f) => f.status === 'pending' || f.status === 'scheduled')),
      api.get<Paginated<CallLog>>('/ai/call-logs/', {
        // Staff test calls never need a callback.
        params: { outcome: 'unanswer', is_test: false, occurred_at_after: dayBounds(-1).after, ordering: '-occurred_at', page_size: 50 },
      }).then((r) => r.data.results),
      getAIAnalytics({ preset: '7d', start: localDateKey(addDays(new Date(), -6)), end: todayKey, direction: '', language: '', doctor: '' }),
      getCallSettings(),
    ]).then((results) => {
      if (cancelled) return
      const value = <T,>(i: number, fallback: T): T => (results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<T>).value : fallback)
      setToday(value(0, []))
      setTomorrow(value(1, []))
      setPatientCalls(value(2, []))
      setToReschedule(value(3, []))
      setFollowups(value(4, []))
      setMissedCalls(value(5, []))
      setWeek(value(6, null))
      setCallSettings(value(7, null))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [reloadKey])

  useRealtimeEvents((payload) => {
    if (payload.type.startsWith('appointment.') || payload.type.startsWith('queue.')) reload()
  })

  const runTask = async (id: string, fn: () => Promise<unknown>, done: string) => {
    setBusyTask(id)
    try {
      await fn()
      toast.add({ title: done, type: 'success' })
      reload()
    } catch (err) {
      toast.add({ title: apiErrorMessage(err, 'That could not be done.'), type: 'error' })
    } finally {
      setBusyTask(null)
    }
  }

  const tasks = useMemo<Task[]>(() => {
    const now = new Date()
    const out: Task[] = []

    for (const a of today) {
      if (a.status !== 'scheduled') continue
      const when = new Date(a.starts_at)
      out.push({
        id: `checkin-${a.id}`, kind: 'checkin', when,
        bucket: isBefore(when, now) ? 'overdue' : 'today',
        title: `${isBefore(when, now) ? 'Not checked in' : 'Check in'}: ${a.patient_name ?? 'Patient'}`,
        subtitle: `${format(when, 'h:mm a')} · Dr. ${a.doctor_name ?? a.doctor}${a.reason ? ` · ${a.reason}` : ''}`,
        action: { label: 'Check in', run: () => runTask(`checkin-${a.id}`, () => api.post(`/appointments/${a.id}/check_in/`), `${a.patient_name ?? 'Patient'} checked in.`) },
      })
    }

    for (const a of toReschedule) {
      const when = new Date(a.starts_at)
      out.push({
        id: `resched-${a.id}`, kind: 'reschedule', when,
        bucket: isBefore(when, addDays(now, 1)) ? 'overdue' : 'upcoming',
        title: `Find a new time: ${a.patient_name ?? 'Patient'}`,
        subtitle: `Was ${format(when, 'EEE d MMM, h:mm a')} · Dr. ${a.doctor_name ?? a.doctor}`,
        action: { label: 'Reschedule', run: () => setOpened(a) },
      })
    }

    for (const c of missedCalls) {
      const when = new Date(c.occurred_at)
      out.push({
        id: `callback-${c.id}`, kind: 'callback', when, bucket: 'overdue',
        title: `Call back: ${c.patient_name || formatPhone(c.phone) || 'number withheld'}`,
        subtitle: `The AI call didn't complete · ${format(when, 'EEE h:mm a')}`,
        action: { label: 'Open call', run: () => navigate(`${callDetailPath}/${c.id}`) },
      })
    }

    for (const f of followups) {
      const when = new Date(f.scheduled_for)
      const todayEnd = new Date(dayBounds(0).before)
      out.push({
        id: `followup-${f.id}`, kind: 'followup', when,
        bucket: isBefore(when, now) ? 'overdue' : isBefore(when, todayEnd) ? 'today' : 'upcoming',
        title: `Follow up with ${f.patient_name ?? 'patient'}`,
        subtitle: `${format(when, 'EEE d MMM, h:mm a')} · by ${f.method.replace('_', ' ')}${f.notes ? ` · ${f.notes}` : ''}`,
        action: { label: 'Mark done', run: () => runTask(`followup-${f.id}`, () => api.patch(`/followups/followups/${f.id}/`, { status: 'completed' }), 'Follow-up marked done.') },
      })
    }

    // Reminder calls (the day before) and feedback calls (after the visit) that need the desk now.
    // The desk makes them until the AI places these calls; then only the unanswered and unhappy ones remain.
    const startOfToday = new Date(dayBounds(0).after)
    for (const c of patientCalls) {
      const name = c.patient_name || 'Patient'
      const visit = new Date(c.appointment_starts_at)
      const due = new Date(c.due_at)
      const id = `call-${c.id}`
      const bucket: Bucket = isBefore(due, startOfToday) ? 'overdue' : 'today'
      const kind: Kind = c.kind === 'reminder' ? 'reminder' : 'feedback'
      const log = { label: 'Log call', run: () => setLogging(c) }
      if (c.kind === 'reminder' && c.needs === 'call' && isBefore(visit, now)) continue
      if (c.needs === 'call' || c.needs === 'call_back') {
        const again = c.needs === 'call_back' || c.attempts > 0
        out.push({
          id, kind, bucket, when: due,
          title: c.kind === 'reminder'
            ? `${again ? 'Reminder not answered' : 'Reminder call'}: ${name}`
            : `${again ? 'Feedback call not answered' : 'Feedback call'}: ${name}`,
          subtitle: c.kind === 'reminder'
            ? `For ${format(visit, 'EEE d MMM, h:mm a')} · Dr. ${c.doctor_name} · ${c.patient_phone}${c.attempts ? ` · tried ${c.attempts}×` : ''}`
            : `Saw Dr. ${c.doctor_name} on ${format(visit, 'EEE d MMM')} · ${c.patient_phone}${c.attempts ? ` · tried ${c.attempts}×` : ''}`,
          action: log,
        })
      } else if (c.needs === 'unhappy') {
        out.push({
          id, kind, bucket: 'overdue', when: due,
          title: `Unhappy after visit: ${name} (${c.rating}/5)`,
          subtitle: `Saw Dr. ${c.doctor_name} on ${format(visit, 'EEE d MMM')}${c.comment ? ` · "${c.comment}"` : ''} · call them back`,
          action: { label: 'Mark called back', run: () => runTask(id, () => resolveCall(c.id), `Noted: ${name} was called back.`) },
        })
      } else if (c.needs === 'send_review') {
        out.push({
          id, kind, bucket: 'today', when: due,
          title: `Ask for a Google review: ${name} (${c.rating}/5)`,
          subtitle: `Happy after seeing Dr. ${c.doctor_name} · send them the review link`,
          action: {
            label: 'Copy link & mark sent',
            run: () => runTask(id, async () => {
              if (callSettings?.review_url) await navigator.clipboard.writeText(callSettings.review_url).catch(() => undefined)
              await markReviewSent(c.id)
            }, `Review link copied. Marked sent to ${name}.`),
          },
        })
      }
    }

    return out.sort((x, y) => x.when.getTime() - y.when.getTime())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, tomorrow, patientCalls, callSettings, toReschedule, followups, missedCalls, callDetailPath])

  // Open on the most urgent group that has something in it.
  const [pickedBucket, setPickedBucket] = useState(false)
  useEffect(() => {
    if (loading || pickedBucket) return
    setPickedBucket(true)
    const first = (['overdue', 'today', 'upcoming'] as Bucket[]).find((b) => tasks.some((t) => t.bucket === b))
    if (first) setBucket(first)
  }, [loading, pickedBucket, tasks])

  const doneToday = today.filter((a) => a.status === 'checked_in' || a.status === 'completed')
  const byBucket = (b: Bucket) => tasks.filter((t) => t.bucket === b && (kind === 'all' || t.kind === kind))
  const kindCount = (k: Kind | 'all') => tasks.filter((t) => k === 'all' || t.kind === k).length
  const overdue = tasks.filter((t) => t.bucket === 'overdue').length
  const dueToday = tasks.filter((t) => t.bucket === 'today').length
  const shown = bucket === 'done' ? [] : byBucket(bucket)

  // Right column
  const s = week?.summary
  const outcomeData = s ? [
    { name: 'booked', label: 'Booking', value: s.calls_with_booking, fill: OUTCOMES[0].color },
    { name: 'cancel', label: 'Cancellation', value: s.calls_cancelled, fill: OUTCOMES[1].color },
    { name: 'resched', label: 'Rescheduled', value: s.calls_rescheduled ?? 0, fill: OUTCOMES[2].color },
    { name: 'info', label: 'Information', value: s.calls_info_only, fill: OUTCOMES[3].color },
    { name: 'callback', label: 'Needs callback', value: s.calls_needs_callback ?? 0, fill: OUTCOMES[4].color },
    { name: 'other', label: 'Other', value: (s.calls_other ?? 0) + (s.calls_unanswered ?? 0), fill: OTHER_OUTCOME.color },
  ] : []
  const perDay = useMemo(() => {
    const byDate = new Map((week?.calls_by_day ?? []).map((d) => [d.date, d.total]))
    return Array.from({ length: 7 }, (_, i) => {
      const key = localDateKey(addDays(new Date(), i - 6))
      return { date: key, calls: byDate.get(key) ?? 0 }
    })
  }, [week])
  const statusColors: Record<string, string> = {
    scheduled: '#6366f1', checked_in: '#10b981', completed: '#14b8a6', needs_reschedule: '#f59e0b', no_show: '#f43f5e', cancelled: '#94a3b8',
  }
  const todayByStatus = Object.entries(STATUS_META).map(([status, meta]) => ({
    name: status, label: meta.label, value: today.filter((a) => a.status === status).length, fill: statusColors[status],
  }))
  const aiBookedToday = today.filter((a) => a.source === 'phone').length

  // Today's appointments by the channel they were booked through (cancelled ones left out). Every channel is
  // listed, at 0 too: WhatsApp stays 0 until patients can book there.
  const byChannel = CHANNELS.map((c) => ({
    ...c,
    count: today.filter((a) => a.status !== 'cancelled' && c.sources.includes(a.source)).length,
  }))
  const channelMax = Math.max(1, ...byChannel.map((c) => c.count))

  // Today at a glance (what the admin's old analytics dashboard showed for today).
  const countStatus = (...statuses: string[]) => today.filter((a) => statuses.includes(a.status)).length
  const activeToday = today.length - countStatus('cancelled')
  const seenToday = countStatus('completed')
  const todayEnd = new Date(dayBounds(0).before)
  const followupsDueToday = followups.filter((f) => new Date(f.scheduled_for) <= todayEnd).length
  const glance = [
    { label: 'Appointments today', value: activeToday, sub: `${aiBookedToday} booked by AI` },
    { label: 'Checked in', value: countStatus('checked_in'), sub: 'waiting or with the doctor' },
    { label: 'Seen', value: seenToday, sub: activeToday ? `${Math.round((seenToday / activeToday) * 100)}% of today` : '—' },
    { label: 'Cancelled · no-show', value: countStatus('cancelled', 'no_show'), sub: `${countStatus('cancelled')} cancelled · ${countStatus('no_show')} no-show` },
    { label: 'Follow-ups due', value: followupsDueToday, sub: 'today or overdue' },
  ]

  return (
    <div className="max-w-[1500px] space-y-6 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{greeting()}, {userName.split(' ')[0]}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <Button variant="default" className="h-10 rounded-full px-5" onClick={() => setBooking(true)}>
          <Plus /> Book appointment
        </Button>
      </div>

      {/* Today at a glance */}
      <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
        {glance.map((g) => (
          <div key={g.label} className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{g.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{loading ? '—' : g.value}</p>
            <p className="text-[11px] text-slate-400">{loading ? '' : g.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        {/* Tasks (min-w-0 lets the tab row scroll instead of pushing the call column off screen) */}
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <AlertTriangle className={`h-5 w-5 ${overdue ? 'text-rose-500' : 'text-slate-300'}`} />
            <p className="text-base font-semibold text-slate-900">
              {loading ? 'Loading tasks…' : `${tasks.length} task${tasks.length === 1 ? '' : 's'} need attention`}
            </p>
            <div className="ml-auto flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-md bg-rose-50 px-2 py-1 text-rose-700">{overdue} overdue</span>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">{dueToday} due today</span>
              <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">{doneToday.length} done today</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex gap-1 overflow-x-auto rounded-t-2xl border-b border-slate-100 px-3">
              {KINDS.map(({ kind: k, label }) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`flex shrink-0 !min-h-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${kind === k ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  {label}
                  <span className="rounded-full bg-slate-100 px-1.5 text-[11px] tabular-nums text-slate-600">{kindCount(k)}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)]">
              <nav className="space-y-1 border-b border-slate-100 p-3 md:sticky md:top-0 md:self-start md:rounded-bl-2xl md:border-b-0 md:border-r" aria-label="Workload">
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Workload</p>
                {BUCKETS.map((b) => {
                  const count = b.key === 'done' ? doneToday.length : byBucket(b.key).length
                  return (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => setBucket(b.key)}
                      className={`flex w-full !min-h-0 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${bucket === b.key ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${b.dot}`} />
                      <span className="flex-1">{b.label}</span>
                      <span className="text-xs tabular-nums text-slate-500">{count}</span>
                    </button>
                  )
                })}
              </nav>

              <div className="min-h-[320px] min-w-0 space-y-3 rounded-b-2xl bg-slate-50/50 p-4 md:rounded-bl-none">
                <div className="flex items-baseline justify-between px-1">
                  <h3 className="text-base font-semibold text-slate-900">{BUCKETS.find((b) => b.key === bucket)?.label}</h3>
                  <span className="text-xs text-slate-400">{BUCKETS.find((b) => b.key === bucket)?.hint}</span>
                </div>

                {bucket === 'done' ? (
                  doneToday.length === 0 ? (
                    <p className="py-12 text-center text-sm text-slate-500">Nobody checked in yet today.</p>
                  ) : doneToday.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setOpened(a)}
                      className="flex w-full !min-h-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-slate-300"
                    >
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      <span className="flex-1">
                        <span className="block text-sm font-medium text-slate-900">{a.patient_name}</span>
                        <span className="block text-xs text-slate-500">{format(new Date(a.starts_at), 'h:mm a')} · Dr. {a.doctor_name}</span>
                      </span>
                      <span className="text-xs text-slate-500">{STATUS_META[a.status]?.label}</span>
                    </button>
                  ))
                ) : shown.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-500">{loading ? 'Loading…' : 'Nothing here.'}</p>
                ) : shown.map((t) => {
                  const chip = KIND_CHIP[t.kind]
                  return (
                    <article
                      key={t.id}
                      className={`flex items-center gap-4 rounded-xl border border-l-4 bg-white px-4 py-3 ${t.bucket === 'overdue' ? 'border-slate-200 border-l-rose-400' : 'border-slate-200 border-l-slate-200'}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${chip.className}`}>{chip.label}</span>
                          {t.demo && <span className="rounded border border-dashed border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-400">Demo</span>}
                          {t.bucket === 'overdue' && <span className="text-xs font-medium text-rose-600">Overdue</span>}
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-900">{t.title}</p>
                        <p className="truncate text-xs text-slate-500">{t.subtitle}</p>
                      </div>
                      <Button size="sm" variant="outline" disabled={busyTask === t.id} onClick={() => void t.action.run()}>
                        {busyTask === t.id ? 'Working…' : t.action.label}
                      </Button>
                    </article>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Call activity */}
        <aside className="min-w-0 space-y-4">
          <Panel title="Today's bookings by channel">
            <ul className="space-y-1">
              {byChannel.map(({ key, label, icon: Icon, color, count, sources }) => (
                <li key={key}>
                  <Link
                    to={`/app/appointments?source=${sources[0]}`}
                    title={`Open today's ${label.toLowerCase()} bookings`}
                    className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                  >
                    <Icon className="h-4 w-4 shrink-0" style={{ color }} />
                    <span className="w-28 shrink-0 text-sm text-slate-700">{label}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full rounded-full" style={{ width: `${(count / channelMax) * 100}%`, backgroundColor: color }} />
                    </span>
                    <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">{loading ? '—' : count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel
            title="Call activity · last 7 days"
            action={<Link to={callsPath} className="flex items-center gap-1 text-xs font-medium text-cyan-700 hover:underline">Call logs <ArrowRight className="h-3 w-3" /></Link>}
          >
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Calls handled', value: s ? s.total_calls.toLocaleString() : '—' },
                { label: 'Booked by AI', value: s ? `${s.booking_conversion_rate}%` : '—' },
                { label: 'Avg. call', value: s ? formatDuration(s.avg_duration_seconds) : '—' },
                { label: 'Patients reached', value: s ? s.patients_reached.toLocaleString() : '—' },
              ].map((m) => (
                <div key={m.label}>
                  <p className="text-xs text-slate-500">{m.label}</p>
                  <p className="text-xl font-semibold tabular-nums text-slate-900">{m.value}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Calls per day">
            <div className="h-[110px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perDay} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={(v: string) => format(new Date(`${v}T00:00:00`), 'EEEEE')} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: 10, fontSize: 12 }}
                    labelFormatter={(v) => format(new Date(`${String(v)}T00:00:00`), 'EEE d MMM')} />
                  <Bar dataKey="calls" name="Calls" fill="#030D39" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="What patients called about">
            <BreakdownBar data={outcomeData} emptyLabel="No calls this week" compact />
          </Panel>

          <Panel title="Today's appointments" action={<span className="text-xs text-slate-500">{aiBookedToday} booked by AI</span>}>
            <BreakdownBar data={todayByStatus} emptyLabel="No appointments today" compact />
          </Panel>
        </aside>
      </div>

      <AppointmentDialog appointment={opened} onClose={() => setOpened(null)} onChanged={reload} />
      <RecordCallDialog
        call={logging}
        reviewMinRating={callSettings?.review_min_rating}
        onClose={() => setLogging(null)}
        onSaved={reload}
      />
      <BookAppointmentDialog
        open={booking}
        onOpenChange={setBooking}
        onBooked={(appt) => {
          toast.add({ title: `Booked ${appt.patient_name || 'patient'} for ${format(new Date(appt.starts_at), 'EEE d MMM, h:mm a')}.`, type: 'success' })
          reload()
        }}
      />
    </div>
  )
}
