import { useEffect, useState } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, parseISO, startOfDay, startOfMonth } from 'date-fns'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { useUIStore } from '../../store/uistore'
import { Button } from '../ui/Button'

type Holiday = { date: string; reason: string }

const HOLIDAY_REASON = 'Admin marked holiday'

/** Dates the centre is closed. Marking one cancels that day's appointments and notifies patients. */
export function ClinicHolidays() {
  const { addToast } = useUIStore()
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState<Date | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get('/clinics/holidays/')
      .then((res) => setHolidays(Array.isArray(res.data) ? res.data : res.data?.results ?? []))
      .catch(() => addToast('Could not load the holidays.', 'error'))
  }, [addToast])

  const today = startOfDay(new Date())
  const upcoming = holidays.filter((h) => parseISO(h.date) >= today).sort((a, b) => a.date.localeCompare(b.date))

  const markHoliday = async () => {
    if (!selected) return
    const date = format(selected, 'yyyy-MM-dd')
    setBusy(true)
    try {
      await api.post('/clinics/holidays/', { date, reason: HOLIDAY_REASON })
      setHolidays([...holidays, { date, reason: HOLIDAY_REASON }])
      setSelected(null)
      addToast(`${format(selected, 'd MMM yyyy')} marked as a holiday. Appointments on that day were cancelled and patients notified.`, 'success')
    } catch {
      addToast('Could not mark the holiday.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const removeHoliday = async (date: string) => {
    try {
      await api.delete(`/clinics/holidays/${date}/`)
      setHolidays(holidays.filter((h) => h.date !== date))
      addToast(`Removed the holiday on ${format(parseISO(date), 'd MMM yyyy')}.`, 'success')
    } catch {
      addToast('Could not remove the holiday.', 'error')
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-900">Mark a holiday</h3>
        <p className="mt-1 text-sm text-slate-500">Pick a date the centre is closed. Bookings stop for that day.</p>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">{format(month, 'MMMM yyyy')}</span>
          <div className="flex gap-1">
            <button type="button" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))} className="flex h-8 w-8 !min-h-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))} className="flex h-8 w-8 !min-h-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((name, i) => (
            <span key={i} className="pb-1 text-[11px] font-medium text-slate-400">{name}</span>
          ))}
          {Array.from({ length: month.getDay() }).map((_, i) => <span key={`blank-${i}`} />)}
          {eachDayOfInterval({ start: month, end: endOfMonth(month) }).map((day) => {
            const isHoliday = holidays.some((h) => h.date === format(day, 'yyyy-MM-dd'))
            const isPast = day < today
            const isSelected = !!selected && isSameDay(day, selected)
            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={isPast || isHoliday}
                aria-pressed={isSelected}
                onClick={() => setSelected(day)}
                className={`mx-auto flex h-9 w-9 !min-h-0 items-center justify-center rounded-full text-sm transition-colors ${
                  isSelected
                    ? 'bg-slate-900 font-semibold text-white'
                    : isHoliday
                      ? 'bg-rose-100 font-semibold text-rose-700'
                      : isPast
                        ? 'text-slate-300'
                        : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>

        {selected && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-slate-900">Close on {format(selected, 'EEEE, d MMMM yyyy')}?</p>
            <p className="mt-1 text-xs text-amber-800">Every appointment on this date will be cancelled and the patients notified.</p>
            <div className="mt-3 flex gap-2">
              <Button type="button" variant="default" className="px-3" disabled={busy} onClick={() => void markHoliday()}>
                {busy ? 'Marking…' : 'Mark as holiday'}
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setSelected(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-900">Upcoming holidays</h3>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No holidays marked.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {upcoming.map((holiday) => (
              <li key={holiday.date} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm font-medium text-slate-900">{format(parseISO(holiday.date), 'EEEE, d MMMM yyyy')}</span>
                <button
                  type="button"
                  aria-label={`Remove holiday on ${holiday.date}`}
                  title="Remove holiday"
                  onClick={() => void removeHoliday(holiday.date)}
                  className="flex h-8 w-8 !min-h-0 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
