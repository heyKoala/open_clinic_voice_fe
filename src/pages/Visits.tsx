import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { addDays, format, isBefore, startOfDay, endOfDay } from 'date-fns'
import { CalendarPlus, CheckCircle2, CircleCheck, Loader2, UserCheck, UserX } from 'lucide-react'
import { api } from '../lib/api'
import { STATUS_META, apiErrorMessage, type Appointment } from '../lib/appointments'
import { AppointmentDialog } from '../components/appointments/AppointmentDialog'
import { Button } from '../components/ui/Button'
import { DateTimePickerAmPm } from '../components/ui/DateTimePickerAmPm'
import { toast } from '../components/shadcn/toast'
import { useRealtimeEvents } from '../hooks/useRealtimeEvents'

/**
 * The front desk's day sheet: today's visits in order, moved along with Check in → Visit completed
 * (or No-show), and the follow-ups a doctor asked for. Completing a visit plans the feedback call;
 * a follow-up ("review in two weeks", "call with the report") is recorded in the same step.
 */

type FollowUp = {
  id: number
  patient: number
  patient_name?: string
  doctor: number | null
  doctor_name?: string
  appointment: number | null
  scheduled_for: string
  method: 'phone' | 'whatsapp' | 'sms' | 'email'
  status: 'pending' | 'scheduled' | 'completed' | 'failed' | string
  notes: string
  outcome: string
}

const METHODS: { value: FollowUp['method']; label: string }[] = [
  { value: 'phone', label: 'Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
]

type FollowUpDraft = { wanted: boolean; scheduled_for: string; method: FollowUp['method']; notes: string }
const emptyDraft = (): FollowUpDraft => ({
  wanted: false, scheduled_for: format(addDays(new Date(), 14), "yyyy-MM-dd'T'10:00"), method: 'phone', notes: '',
})

function unwrap<T>(data: any): T[] {
  return Array.isArray(data) ? data : (data?.results ?? [])
}

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm'

export default function Visits() {
  const [today, setToday] = useState<Appointment[]>([])
  const [followups, setFollowups] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [opened, setOpened] = useState<Appointment | null>(null)
  /** The visit being completed (or, for an already completed one, getting a follow-up). */
  const [completing, setCompleting] = useState<{ appointment: Appointment; onlyFollowUp: boolean } | null>(null)
  const [outcomes, setOutcomes] = useState<Record<number, string>>({})

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    const now = new Date()
    Promise.allSettled([
      api.get('/appointments/', {
        params: { starts_at_after: startOfDay(now).toISOString(), starts_at_before: endOfDay(now).toISOString(), page_size: 500, ordering: 'starts_at' },
      }).then((r) => unwrap<Appointment>(r.data)),
      api.get('/followups/followups/', {
        params: { ordering: 'scheduled_for', page_size: 200, is_active: true },
      }).then((r) => unwrap<FollowUp>(r.data).filter((f) => f.status === 'pending' || f.status === 'scheduled')),
    ]).then(([a, f]) => {
      if (cancelled) return
      setToday(a.status === 'fulfilled' ? a.value : [])
      setFollowups(f.status === 'fulfilled' ? f.value : [])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [reloadKey])

  useRealtimeEvents((payload) => {
    if (payload.type.startsWith('appointment.') || payload.type.startsWith('queue.')) reload()
  })

  const run = async (id: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(id)
    try {
      await fn()
      toast.add({ title: done, type: 'success' })
      reload()
    } catch (err) {
      toast.add({ title: apiErrorMessage(err, 'That could not be done.'), type: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const seen = today.filter((a) => a.status === 'completed').length
  const waiting = today.filter((a) => a.status === 'checked_in').length
  const stillToCome = today.filter((a) => a.status === 'scheduled').length

  const grouped = useMemo(() => {
    const now = new Date()
    const todayEnd = endOfDay(now)
    const weekEnd = endOfDay(addDays(now, 7))
    const by = { overdue: [] as FollowUp[], today: [] as FollowUp[], upcoming: [] as FollowUp[], later: [] as FollowUp[] }
    for (const f of followups) {
      const when = new Date(f.scheduled_for)
      if (isBefore(when, startOfDay(now))) by.overdue.push(f)
      else if (isBefore(when, todayEnd)) by.today.push(f)
      else if (isBefore(when, weekEnd)) by.upcoming.push(f)
      else by.later.push(f)
    }
    return by
  }, [followups])

  return (
    <div className="max-w-[1200px] space-y-6 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Visits</h1>
          <p className="mt-0.5 text-sm text-slate-500">{format(new Date(), 'EEEE, d MMMM yyyy')} · check patients in, mark their visit completed, record any follow-up the doctor asked for.</p>
        </div>
        <div className="flex gap-2 text-xs font-medium">
          <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">{stillToCome} to come</span>
          <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">{waiting} with the doctor</span>
          <span className="rounded-md bg-teal-50 px-2 py-1 text-teal-700">{seen} seen</span>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Today's visits</h2>
          <p className="text-xs text-slate-500">Completing a visit plans the feedback call for tomorrow.</p>
        </div>
        {loading ? (
          <p className="flex items-center gap-2 px-5 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
        ) : today.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No appointments today.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {today.map((a) => {
              const when = new Date(a.starts_at)
              const meta = STATUS_META[a.status as keyof typeof STATUS_META] ?? STATUS_META.scheduled
              const past = isBefore(when, new Date())
              const id = `appt-${a.id}`
              return (
                <li key={a.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
                  <div className="w-20 shrink-0 text-sm font-semibold tabular-nums text-slate-900">{format(when, 'h:mm a')}</div>
                  <div className="min-w-0 flex-1">
                    <button type="button" className="text-left text-sm font-semibold text-slate-900 hover:underline" onClick={() => setOpened(a)}>
                      {a.patient_name ?? 'Patient'}
                    </button>
                    <p className="truncate text-xs text-slate-500">Dr. {a.doctor_name ?? a.doctor}{a.reason ? ` · ${a.reason}` : ''}</p>
                  </div>
                  <span className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium ${meta.badge}`}>{meta.label}</span>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {a.status === 'scheduled' && (
                      <Button size="sm" variant="default" disabled={busy === id}
                        onClick={() => void run(id, () => api.post(`/appointments/${a.id}/check_in/`), `${a.patient_name ?? 'Patient'} checked in.`)}>
                        <UserCheck /> Check in
                      </Button>
                    )}
                    {(a.status === 'scheduled' || a.status === 'checked_in') && (
                      <Button size="sm" variant={a.status === 'checked_in' ? 'default' : 'outline'} disabled={busy === id}
                        onClick={() => setCompleting({ appointment: a, onlyFollowUp: false })}>
                        <CircleCheck /> Visit completed
                      </Button>
                    )}
                    {a.status === 'scheduled' && past && (
                      <Button size="sm" variant="ghost" disabled={busy === id}
                        onClick={() => void run(id, () => api.patch(`/appointments/${a.id}/`, { status: 'no_show' }), 'Marked as no-show.')}>
                        <UserX /> No-show
                      </Button>
                    )}
                    {a.status === 'completed' && (
                      <>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500"><CheckCircle2 className="h-3.5 w-3.5 text-teal-600" /> Feedback call planned</span>
                        <Button size="sm" variant="ghost" onClick={() => setCompleting({ appointment: a, onlyFollowUp: true })}>
                          <CalendarPlus /> Add follow-up
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Follow-ups</h2>
          <p className="text-xs text-slate-500">What a doctor asked the desk to do after a visit: a review booking, a call with a report, a check on the patient.</p>
        </div>
        {loading ? null : followups.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No follow-ups due. They are recorded when a visit is completed.</p>
        ) : (
          (['overdue', 'today', 'upcoming', 'later'] as const).map((key) => grouped[key].length === 0 ? null : (
            <div key={key}>
              <p className={`px-5 pt-4 text-[11px] font-semibold uppercase tracking-wider ${key === 'overdue' ? 'text-rose-600' : 'text-slate-500'}`}>
                {key === 'overdue' ? 'Overdue' : key === 'today' ? 'Today' : key === 'upcoming' ? 'This week' : 'Later'}
              </p>
              <ul className="divide-y divide-slate-100">
                {grouped[key].map((f) => {
                  const id = `fu-${f.id}`
                  return (
                    <li key={f.id} className="flex flex-col gap-3 px-5 py-3 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{f.patient_name ?? `Patient #${f.patient}`}</p>
                        <p className="text-xs text-slate-500">
                          {format(new Date(f.scheduled_for), 'EEE d MMM, h:mm a')} · {METHODS.find((m) => m.value === f.method)?.label ?? f.method}
                          {f.doctor_name ? ` · Dr. ${f.doctor_name}` : ''}{f.notes ? ` · ${f.notes}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          className="w-64 rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
                          placeholder="What came of it (optional)"
                          value={outcomes[f.id] ?? ''}
                          onChange={(e) => setOutcomes({ ...outcomes, [f.id]: e.target.value })}
                        />
                        <Button size="sm" variant="default" disabled={busy === id}
                          onClick={() => void run(id, () => api.patch(`/followups/followups/${f.id}/`, { status: 'completed', outcome: outcomes[f.id] ?? '' }), 'Follow-up marked done.')}>
                          <CheckCircle2 /> Mark done
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        )}
      </section>

      {opened && <AppointmentDialog appointment={opened} onClose={() => setOpened(null)} onChanged={reload} />}
      {completing && (
        <CompleteVisitDialog
          appointment={completing.appointment}
          onlyFollowUp={completing.onlyFollowUp}
          onClose={() => setCompleting(null)}
          onDone={() => { setCompleting(null); reload() }}
        />
      )}
    </div>
  )
}

/** Marks the visit completed and, if the doctor asked for one, records the follow-up in the same step. */
function CompleteVisitDialog({ appointment, onlyFollowUp, onClose, onDone }: {
  appointment: Appointment
  onlyFollowUp: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [draft, setDraft] = useState<FollowUpDraft>(() => ({ ...emptyDraft(), wanted: onlyFollowUp }))
  const [saving, setSaving] = useState(false)
  const name = appointment.patient_name ?? 'the patient'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (!onlyFollowUp) await api.post(`/appointments/${appointment.id}/complete/`)
      if (draft.wanted) {
        await api.post('/followups/followups/', {
          patient: appointment.patient, doctor: appointment.doctor, appointment: appointment.id,
          scheduled_for: draft.scheduled_for, method: draft.method, notes: draft.notes.trim(),
        })
      }
      toast.add({
        title: onlyFollowUp ? 'Follow-up recorded.'
          : draft.wanted ? `${name}'s visit completed. Feedback call planned for tomorrow; follow-up recorded.`
            : `${name}'s visit completed. The feedback call is planned for tomorrow.`,
        type: 'success',
      })
      onDone()
    } catch (err) {
      toast.add({ title: apiErrorMessage(err, 'That could not be saved.'), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <form className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div>
          <h3 className="text-base font-semibold text-slate-900">{onlyFollowUp ? `Follow-up for ${name}` : `Complete ${name}'s visit`}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {onlyFollowUp ? 'What did the doctor ask the desk to do, and when?' : 'This plans the feedback call for tomorrow. If the doctor asked for a follow-up, record it here.'}
          </p>
        </div>

        {!onlyFollowUp && (
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={draft.wanted} onChange={(e) => setDraft({ ...draft, wanted: e.target.checked })} />
            <span>
              <span className="block text-sm font-medium text-slate-900">The doctor asked for a follow-up</span>
              <span className="block text-xs text-slate-500">A review visit, a call with the report, a check on the patient.</span>
            </span>
          </label>
        )}

        {draft.wanted && (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">When</span>
              <DateTimePickerAmPm value={draft.scheduled_for} onChange={(v) => setDraft({ ...draft, scheduled_for: v })} required />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">How</span>
              <select className={inputClass} value={draft.method} onChange={(e) => setDraft({ ...draft, method: e.target.value as FollowUp['method'] })}>
                {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">What for</span>
              <textarea className={`${inputClass} min-h-[72px]`} placeholder="e.g. Review after 2 weeks with the scan report" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="default" disabled={saving || (onlyFollowUp && !draft.scheduled_for)}>
            {saving ? 'Saving…' : onlyFollowUp ? 'Save follow-up' : 'Visit completed'}
          </Button>
        </div>
      </form>
    </div>
  )
}
