import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CalendarOff, Clock, Coffee, ListTodo, Pencil, Search, Timer, UserPlus, Users } from 'lucide-react'
import { api } from '../lib/api'
import { localDateKey } from '../lib/analytics'
import { apiErrorMessage, formatClock, listDoctors, type Doctor } from '../lib/appointments'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/shadcn/dialog'
import { Button } from '../components/ui/Button'
import { toast } from '../components/shadcn/toast'

type DoctorFull = Doctor & { degree?: string; max_patients_per_day?: number | null }

const DAYS = [
  { val: 1, short: 'M', label: 'Monday' },
  { val: 2, short: 'T', label: 'Tuesday' },
  { val: 3, short: 'W', label: 'Wednesday' },
  { val: 4, short: 'T', label: 'Thursday' },
  { val: 5, short: 'F', label: 'Friday' },
  { val: 6, short: 'S', label: 'Saturday' },
  { val: 7, short: 'S', label: 'Sunday' },
]

const TINTS = ['bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-sky-100 text-sky-700', 'bg-rose-100 text-rose-700']
const field = 'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm'
const label = 'mb-1 block text-xs font-medium text-slate-700'

// No working days stored means the server accepts every day.
const workingDays = (d: Doctor) => d.working_days ?? DAYS.map((day) => day.val)

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
const hhmm = (value?: string | null) => (value ? value.slice(0, 5) : '')

/** The clinic's doctors: when each one sees patients, how busy they are today, and their schedule and leave. */
export default function Doctors() {
  const [doctors, setDoctors] = useState<DoctorFull[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [todayLoad, setTodayLoad] = useState<Record<number, number>>({})
  const [editing, setEditing] = useState<DoctorFull | null>(null)
  const [onLeave, setOnLeave] = useState<DoctorFull | null>(null)

  const load = () => {
    setLoading(true)
    const today = localDateKey()
    Promise.all([
      listDoctors(),
      api.get<{ results: { doctor: number; status: string }[] }>('/appointments/', {
        params: {
          starts_at_after: new Date(`${today}T00:00:00`).toISOString(),
          starts_at_before: new Date(`${today}T23:59:59.999`).toISOString(),
          page_size: 5000,
        },
      }),
    ])
      .then(([docs, appts]) => {
        setDoctors(docs as DoctorFull[])
        const counts: Record<number, number> = {}
        for (const a of appts.data.results) if (a.status !== 'cancelled') counts[a.doctor] = (counts[a.doctor] ?? 0) + 1
        setTodayLoad(counts)
      })
      .catch(() => toast.add({ title: 'Doctors could not be loaded.', type: 'error' }))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return doctors
      .filter((d) => !q || d.full_name.toLowerCase().includes(q) || (d.specialty ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [doctors, search])

  const bookedToday = Object.values(todayLoad).reduce((s, n) => s + n, 0)
  const workingToday = doctors.filter((d) => workingDays(d).includes(((new Date().getDay() + 6) % 7) + 1)).length

  return (
    <div className="max-w-[1400px] space-y-6 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Doctors</h1>
          <p className="mt-0.5 text-sm text-slate-500">When each doctor sees patients. The AI agent and the calendar only offer these times.</p>
        </div>
        <Link
          to="/app/settings?tab=team"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800"
        >
          <UserPlus className="h-4 w-4" /> Invite a doctor
        </Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          { label: 'Doctors', value: doctors.length, icon: Users },
          { label: 'Working today', value: workingToday, icon: Clock },
          { label: 'Booked today', value: bookedToday, icon: ListTodo },
        ].map(({ label: l, value, icon: Icon }) => (
          <div key={l} className="p-4">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Icon className="h-3.5 w-3.5" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">{l}</span>
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{loading ? '—' : value}</div>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="Search by name or specialty…"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && doctors.length === 0 ? (
        <p className="text-sm text-slate-500">Loading doctors…</p>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
          {doctors.length ? 'No doctor matches that search.' : 'No doctors yet. Invite one from Settings → Team.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((d) => {
            const booked = todayLoad[d.id] ?? 0
            const max = d.max_patients_per_day ?? null
            const days = workingDays(d)
            return (
              <article key={d.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${TINTS[d.id % TINTS.length]}`}>
                    {initials(d.full_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-slate-900">Dr. {d.full_name}</h3>
                    <p className="truncate text-sm text-slate-500">{[d.degree, d.specialty || 'General practice'].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>

                {/* Today's load against the daily limit */}
                <div className="mt-4">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-slate-500">Today</span>
                    <span className="font-medium tabular-nums text-slate-900">{booked} booked{max ? ` of ${max}` : ''}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${max && booked >= max ? 'bg-rose-500' : 'bg-slate-900'}`}
                      style={{ width: `${max ? Math.min(100, (booked / max) * 100) : booked ? 100 : 0}%` }}
                    />
                  </div>
                </div>

                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <dt className="sr-only">Hours</dt>
                    <dd className="text-slate-700">
                      {d.available_from ? `${formatClock(d.available_from)} – ${formatClock(d.available_to)}` : 'Hours not set'}
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Coffee className="h-4 w-4 text-slate-400" />
                    <dt className="sr-only">Lunch</dt>
                    <dd className="text-slate-700">{d.lunch_from ? `Lunch ${formatClock(d.lunch_from)} – ${formatClock(d.lunch_to)}` : 'No lunch break'}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-slate-400" />
                    <dt className="sr-only">Slot</dt>
                    <dd className="text-slate-700">{d.consultation_minutes ?? 15} min per patient</dd>
                  </div>
                </dl>

                <div className="mt-4 flex gap-1" aria-label="Working days">
                  {DAYS.map((day) => (
                    <span
                      key={day.val}
                      title={`${day.label}${days.includes(day.val) ? '' : ' (off)'}`}
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${days.includes(day.val) ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}
                    >
                      {day.short}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <Button size="sm" variant="default" onClick={() => setEditing(d)}><Pencil /> Edit schedule</Button>
                  <Button size="sm" variant="outline" onClick={() => setOnLeave(d)}><CalendarOff /> Mark leave</Button>
                  <Link to={`/app/appointments?doctor=${d.id}`} className="ml-auto inline-flex h-7 items-center rounded-md px-2 text-[0.8rem] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                    Appointments →
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <EditScheduleDialog doctor={editing} onClose={() => setEditing(null)} onSaved={load} />
      <LeaveDialog doctor={onLeave} onClose={() => setOnLeave(null)} onSaved={load} />
    </div>
  )
}

function EditScheduleDialog({ doctor, onClose, onSaved }: { doctor: DoctorFull | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    full_name: '', degree: '', specialty: '', consultation_minutes: 15, max_patients_per_day: '',
    available_from: '', available_to: '', lunch_from: '', lunch_to: '', working_days: [] as number[],
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!doctor) return
    setError('')
    setForm({
      full_name: doctor.full_name,
      degree: doctor.degree ?? '',
      specialty: doctor.specialty ?? '',
      consultation_minutes: doctor.consultation_minutes ?? 15,
      max_patients_per_day: doctor.max_patients_per_day ? String(doctor.max_patients_per_day) : '',
      available_from: hhmm(doctor.available_from),
      available_to: hhmm(doctor.available_to),
      lunch_from: hhmm(doctor.lunch_from),
      lunch_to: hhmm(doctor.lunch_to),
      working_days: workingDays(doctor),
    })
  }, [doctor])

  if (!doctor) return null

  const set = (key: keyof typeof form, value: unknown) => setForm((f) => ({ ...f, [key]: value }))
  const toggleDay = (val: number) =>
    set('working_days', form.working_days.includes(val) ? form.working_days.filter((d) => d !== val) : [...form.working_days, val].sort())

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (form.working_days.length === 0) {
      setError('Pick at least one working day.')
      return
    }
    if ((form.lunch_from && !form.lunch_to) || (!form.lunch_from && form.lunch_to)) {
      setError('Give both a start and an end for the lunch break, or leave both empty.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.patch(`/doctors/${doctor.id}/`, {
        full_name: form.full_name,
        degree: form.degree,
        specialty: form.specialty,
        consultation_minutes: Number(form.consultation_minutes),
        max_patients_per_day: form.max_patients_per_day ? Number(form.max_patients_per_day) : null,
        available_from: form.available_from || null,
        available_to: form.available_to || null,
        lunch_from: form.lunch_from || null,
        lunch_to: form.lunch_to || null,
        working_days: form.working_days,
      })
      toast.add({ title: `Dr. ${form.full_name}'s schedule saved.`, type: 'success' })
      onSaved()
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'The schedule could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Dr. {doctor.full_name}</DialogTitle>
          <DialogDescription>New bookings, by the AI agent or the front desk, must fit this schedule. Existing ones aren't moved.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={label}>Name</label>
              <input className={field} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} required />
            </div>
            <div>
              <label className={label}>Specialty</label>
              <input className={field} value={form.specialty} onChange={(e) => set('specialty', e.target.value)} placeholder="General practice" />
            </div>
            <div>
              <label className={label}>Degree</label>
              <input className={field} value={form.degree} onChange={(e) => set('degree', e.target.value)} placeholder="MBBS, MD" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Sees patients from</label>
              <input type="time" className={field} value={form.available_from} onChange={(e) => set('available_from', e.target.value)} />
            </div>
            <div>
              <label className={label}>Until</label>
              <input type="time" className={field} value={form.available_to} onChange={(e) => set('available_to', e.target.value)} />
            </div>
            <div>
              <label className={label}>Lunch from</label>
              <input type="time" className={field} value={form.lunch_from} onChange={(e) => set('lunch_from', e.target.value)} />
            </div>
            <div>
              <label className={label}>Lunch until</label>
              <input type="time" className={field} value={form.lunch_to} onChange={(e) => set('lunch_to', e.target.value)} />
            </div>
            <div>
              <label className={label}>Minutes per patient</label>
              <select className={field} value={form.consultation_minutes} onChange={(e) => set('consultation_minutes', Number(e.target.value))}>
                {[5, 10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Most patients a day</label>
              <input type="number" min={1} className={field} value={form.max_patients_per_day} onChange={(e) => set('max_patients_per_day', e.target.value)} placeholder="No limit" />
            </div>
          </div>

          <div>
            <span className={label}>Working days</span>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => {
                const on = form.working_days.includes(day.val)
                return (
                  <button
                    key={day.val}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(day.val)}
                    className={`h-9 !min-h-0 rounded-full px-3 text-xs font-semibold transition-colors ${on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    {day.label.slice(0, 3)}
                  </button>
                )
              })}
            </div>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="default" disabled={saving}>{saving ? 'Saving…' : 'Save schedule'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function LeaveDialog({ doctor, onClose, onSaved }: { doctor: DoctorFull | null; onClose: () => void; onSaved: () => void }) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!doctor) return
    const today = localDateKey()
    setStart(today)
    setEnd(today)
    setReason('')
    setError('')
  }, [doctor])

  if (!doctor) return null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await api.post<{ affected_appointments: number }>(`/doctors/${doctor.id}/mark-absent/`, { start_date: start, end_date: end, reason })
      const moved = res.data.affected_appointments
      toast.add({
        title: moved
          ? `Leave saved. ${moved} appointment${moved === 1 ? '' : 's'} moved after the leave and the patients will be messaged.`
          : 'Leave saved. No appointments needed moving.',
        type: 'success',
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'The leave could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark leave for Dr. {doctor.full_name}</DialogTitle>
          <DialogDescription>No new bookings can be made on these days.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>From</label>
              <input type="date" className={field} value={start} min={localDateKey()} onChange={(e) => setStart(e.target.value)} required />
            </div>
            <div>
              <label className={label}>Until</label>
              <input type="date" className={field} value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className={label}>Reason (optional)</label>
            <input className={field} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Conference, personal leave…" />
          </div>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Appointments already booked on these days are moved to the doctor's next working days at the same time, and each patient is sent a WhatsApp message about the new time.
          </p>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="default" disabled={saving}>{saving ? 'Saving…' : 'Mark leave'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
