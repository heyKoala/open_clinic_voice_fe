import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { addDays, format, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { api } from '../lib/api'
import { localDateKey } from '../lib/analytics'
import {
  SOURCES, STATUS_META, apiErrorMessage, listDoctors, sourceMeta, statusMeta,
  type Appointment, type Doctor,
} from '../lib/appointments'
import { AppointmentDialog } from '../components/appointments/AppointmentDialog'
import { BookAppointmentDialog } from '../components/appointments/BookAppointmentDialog'
import { Button } from '../components/ui/Button'
import { toast } from '../components/shadcn/toast'
import { useRealtimeEvents } from '../hooks/useRealtimeEvents'

type Range = 'today' | 'tomorrow' | 'next7' | 'past7' | 'custom'

const RANGES: { value: Exclude<Range, 'custom'>; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'next7', label: 'Next 7 days' },
  { value: 'past7', label: 'Past 7 days' },
]

function datesFor(range: Exclude<Range, 'custom'>) {
  const today = new Date()
  const key = (offset: number) => localDateKey(addDays(today, offset))
  switch (range) {
    case 'today': return { from: key(0), to: key(0) }
    case 'tomorrow': return { from: key(1), to: key(1) }
    case 'next7': return { from: key(0), to: key(6) }
    case 'past7': return { from: key(-7), to: key(-1) }
  }
}

const PAGE_SIZE = 20
const control = 'h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700'

/** Every booking, whoever made it (AI agent, WhatsApp, front desk, walk-in), with check-in, reschedule and cancel. */
export default function Appointments() {
  // ?doctor=<id> (from the Doctors page) opens on that doctor's coming week.
  const [searchParams] = useSearchParams()
  const linkedDoctor = searchParams.get('doctor') ?? ''
  const initialRange: Exclude<Range, 'custom'> = linkedDoctor ? 'next7' : 'today'
  const [range, setRange] = useState<Range>(initialRange)
  const [from, setFrom] = useState(datesFor(initialRange).from)
  const [to, setTo] = useState(datesFor(initialRange).to)
  const [doctor, setDoctor] = useState(linkedDoctor)
  const [status, setStatus] = useState('')
  // ?source=<channel> (from the dashboard's bookings-by-channel box) opens on that channel.
  const [source, setSource] = useState(searchParams.get('source') ?? '')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [rows, setRows] = useState<Appointment[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const [opened, setOpened] = useState<Appointment | null>(null)
  const [booking, setBooking] = useState(false)
  const [checkingIn, setCheckingIn] = useState<number | null>(null)

  useEffect(() => { listDoctors().then(setDoctors).catch(() => setDoctors([])) }, [])

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  // A new filter starts again at page 1.
  useEffect(() => { setPage(1) }, [from, to, doctor, status, source, search])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    api.get<{ count: number; results: Appointment[] }>('/appointments/', {
      params: {
        starts_at_after: new Date(`${from}T00:00:00`).toISOString(),
        starts_at_before: new Date(`${to}T23:59:59.999`).toISOString(),
        ordering: range === 'past7' ? '-starts_at' : 'starts_at',
        page,
        page_size: PAGE_SIZE,
        ...(doctor ? { doctor } : {}),
        ...(status ? { status } : {}),
        ...(source ? { source } : {}),
        ...(search ? { search } : {}),
      },
    })
      .then((res) => { if (!cancelled) { setRows(res.data.results); setCount(res.data.count) } })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [from, to, doctor, status, source, search, page, range, reloadKey])

  const reload = () => setReloadKey((k) => k + 1)

  useRealtimeEvents((payload) => {
    if (payload.type.startsWith('appointment.')) reload()
  })

  const pickRange = (next: Exclude<Range, 'custom'>) => {
    const d = datesFor(next)
    setRange(next)
    setFrom(d.from)
    setTo(d.to)
  }

  const checkIn = async (appt: Appointment) => {
    setCheckingIn(appt.id)
    try {
      await api.post(`/appointments/${appt.id}/check_in/`)
      toast.add({ title: `${appt.patient_name || 'Patient'} checked in.`, type: 'success' })
      reload()
    } catch (err) {
      toast.add({ title: apiErrorMessage(err, 'Could not check in.'), type: 'error' })
    } finally {
      setCheckingIn(null)
    }
  }

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div className="max-w-[1400px] space-y-6 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Appointments</h1>
          <p className="mt-0.5 text-sm text-slate-500">Every booking, whether the AI agent, WhatsApp or the front desk made it.</p>
        </div>
        <Button variant="default" className="h-10 rounded-full px-5" onClick={() => setBooking(true)}>
          <Plus /> Book appointment
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => pickRange(r.value)}
              className={`h-8 !min-h-0 rounded-lg px-3 text-xs font-semibold transition-colors ${range === r.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <input type="date" aria-label="From" className={control} value={from} max={to}
            onChange={(e) => { if (e.target.value) { setRange('custom'); setFrom(e.target.value) } }} />
          <span>to</span>
          <input type="date" aria-label="To" className={control} value={to} min={from}
            onChange={(e) => { if (e.target.value) { setRange('custom'); setTo(e.target.value) } }} />
        </div>
        <select aria-label="Doctor" className={control} value={doctor} onChange={(e) => setDoctor(e.target.value)}>
          <option value="">All doctors</option>
          {doctors.map((d) => <option key={d.id} value={d.id}>Dr. {d.full_name}</option>)}
        </select>
        <select aria-label="Status" className={control} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
        </select>
        <select aria-label="Booked by" className={control} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Booked by anyone</option>
          {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="search" placeholder="Search patient, doctor or reason…" className={`${control} w-64 pl-9`}
            value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
      </div>

      {/* List */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">
            {count.toLocaleString()} appointment{count === 1 ? '' : 's'}
            <span className="ml-2 font-normal text-slate-500">
              {from === to ? format(new Date(`${from}T00:00:00`), 'EEE d MMM yyyy') : `${format(new Date(`${from}T00:00:00`), 'd MMM')} – ${format(new Date(`${to}T00:00:00`), 'd MMM yyyy')}`}
            </span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Patient</th>
                <th className="px-4 py-3 font-semibold">Doctor</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">Booked by</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Loading appointments…</td></tr>
              ) : error ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-red-600">Appointments could not be loaded.</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No appointments match these filters.</td></tr>
              ) : rows.map((appt) => {
                const starts = new Date(appt.starts_at)
                const st = statusMeta(appt.status)
                const src = sourceMeta(appt.source)
                return (
                  <tr
                    key={appt.id}
                    tabIndex={0}
                    onClick={() => setOpened(appt)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setOpened(appt) }}
                    className={`cursor-pointer transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none ${loading ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{format(starts, 'h:mm a')}</p>
                      <p className="text-xs text-slate-500">{format(starts, 'EEE d MMM')}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{appt.patient_name || `Patient #${appt.patient}`}</p>
                      {appt.patient_phone && <p className="text-xs text-slate-500">{appt.patient_phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      Dr. {appt.doctor_name || appt.doctor}
                      {appt.clinic_name && <span className="block text-xs text-slate-400">{appt.clinic_name}</span>}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-slate-500">{appt.reason || '—'}</td>
                    <td className="px-4 py-3"><span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${src.badge}`}>{src.label}</span></td>
                    <td className="px-4 py-3"><span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${st.badge}`}>{st.label}</span></td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {appt.status === 'scheduled' && isToday(starts) ? (
                        <Button size="sm" variant="default" disabled={checkingIn === appt.id} onClick={() => void checkIn(appt)}>
                          {checkingIn === appt.id ? 'Checking in…' : 'Check in'}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setOpened(appt)}>Open</Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {count > PAGE_SIZE && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
            <span>Page {page} of {pages}</span>
            <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="flex h-8 w-8 !min-h-0 items-center justify-center rounded-md border border-slate-200 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}
              className="flex h-8 w-8 !min-h-0 items-center justify-center rounded-md border border-slate-200 disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>

      <AppointmentDialog appointment={opened} onClose={() => setOpened(null)} onChanged={reload} />
      <BookAppointmentDialog
        open={booking}
        onOpenChange={setBooking}
        doctorId={doctor || undefined}
        onBooked={(appt) => {
          toast.add({ title: `Booked ${appt.patient_name || 'patient'} for ${format(new Date(appt.starts_at), 'EEE d MMM, h:mm a')}.`, type: 'success' })
          reload()
        }}
      />
    </div>
  )
}
