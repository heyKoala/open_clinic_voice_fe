import { useEffect, useState, type FormEvent } from 'react'
import { addMinutes } from 'date-fns'
import { api } from '../../lib/api'
import {
  apiErrorMessage, formatClock, fromDateTimeInputs, listDoctors, toDateTimeInputs,
  type Appointment, type Doctor, type PatientOption,
} from '../../lib/appointments'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../shadcn/dialog'
import { Button } from '../ui/Button'
import { PatientFormDialog } from '../patient-profile/PatientFormDialog'
import { PatientPicker } from './PatientPicker'

const DURATIONS = [10, 15, 20, 30, 45, 60]
const field = 'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm'
const label = 'mb-1 block text-xs font-medium text-slate-700'

/** The next quarter hour from now, a sensible default when no slot was clicked. */
function nextQuarterHour() {
  const d = new Date()
  d.setSeconds(0, 0)
  d.setMinutes(Math.ceil((d.getMinutes() + 1) / 15) * 15)
  return d
}

/**
 * Book an appointment into a doctor's calendar. The server applies the doctor's rules (working days and
 * hours, lunch, capacity, absences, overlapping bookings) and its message is shown here when a slot is taken.
 */
export function BookAppointmentDialog({ open, onOpenChange, start, doctorId, patient, onBooked }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-filled time, e.g. the calendar slot that was clicked. */
  start?: Date
  doctorId?: number | string
  patient?: PatientOption | null
  onBooked?: (appointment: Appointment) => void
}) {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [doctor, setDoctor] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState(15)
  const [reason, setReason] = useState('Consultation')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [addingPatient, setAddingPatient] = useState(false)

  useEffect(() => {
    if (open && doctors.length === 0) listDoctors().then(setDoctors).catch(() => setDoctors([]))
  }, [open, doctors.length])

  // Each opening starts from what was clicked.
  useEffect(() => {
    if (!open) return
    const when = toDateTimeInputs(start ?? nextQuarterHour())
    setDate(when.date)
    setTime(when.time)
    setDoctor(doctorId ? String(doctorId) : '')
    setSelectedPatient(patient ?? null)
    setReason('Consultation')
    setError('')
  }, [open, start, doctorId, patient])

  const chosenDoctor = doctors.find((d) => String(d.id) === doctor)

  // A doctor's own slot length is the default duration.
  useEffect(() => {
    if (chosenDoctor?.consultation_minutes) setDuration(chosenDoctor.consultation_minutes)
  }, [chosenDoctor])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!doctor || !selectedPatient || !date || !time) {
      setError('Choose a doctor, a patient and a time.')
      return
    }
    const startsAt = fromDateTimeInputs(date, time)
    setSaving(true)
    setError('')
    try {
      const res = await api.post<Appointment>('/appointments/', {
        doctor: Number(doctor),
        patient: selectedPatient.id,
        starts_at: startsAt.toISOString(),
        ends_at: addMinutes(startsAt, duration).toISOString(),
        reason,
        source: 'front_desk',
      })
      onBooked?.(res.data)
      onOpenChange(false)
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not book this appointment.'))
    } finally {
      setSaving(false)
    }
  }

  const durations = chosenDoctor?.consultation_minutes && !DURATIONS.includes(chosenDoctor.consultation_minutes)
    ? [...DURATIONS, chosenDoctor.consultation_minutes].sort((a, b) => a - b)
    : DURATIONS

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Book appointment</DialogTitle>
            <DialogDescription>The slot is blocked on the doctor's calendar as soon as it's booked.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className={label}>Doctor</label>
              <select className={field} value={doctor} onChange={(e) => setDoctor(e.target.value)} required>
                <option value="">Select doctor</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>Dr. {d.full_name}{d.specialty ? ` · ${d.specialty}` : ''}</option>
                ))}
              </select>
              {chosenDoctor?.available_from && (
                <p className="mt-1 text-xs text-slate-500">
                  Sees patients {formatClock(chosenDoctor.available_from)} – {formatClock(chosenDoctor.available_to)}
                  {chosenDoctor.lunch_from && `, lunch ${formatClock(chosenDoctor.lunch_from)} – ${formatClock(chosenDoctor.lunch_to)}`}
                </p>
              )}
            </div>

            <div>
              <label className={label}>Patient</label>
              <PatientPicker value={selectedPatient} onChange={setSelectedPatient} onAddNew={() => setAddingPatient(true)} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Date</label>
                  <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
                <div>
                  <label className={label}>Time</label>
                  <input type="time" step={300} className={field} value={time} onChange={(e) => setTime(e.target.value)} required />
                </div>
              </div>
              <div>
                <label className={label}>Duration</label>
                <select className={field} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                  {durations.map((m) => <option key={m} value={m}>{m} min</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={label}>Reason</label>
              <input className={field} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for visit" />
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" variant="default" disabled={saving}>{saving ? 'Booking…' : 'Book appointment'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <PatientFormDialog
        isOpen={addingPatient}
        onOpenChange={setAddingPatient}
        onSuccess={async (id) => {
          try {
            const res = await api.get<PatientOption>(`/patients/${id}/`)
            setSelectedPatient({ id: res.data.id, full_name: res.data.full_name, phone: res.data.phone })
          } catch {
            setSelectedPatient({ id, full_name: 'New patient' })
          }
        }}
      />
    </>
  )
}
