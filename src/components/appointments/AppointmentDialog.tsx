import { useEffect, useState } from 'react'
import { addMinutes, differenceInMinutes, format, isToday } from 'date-fns'
import { CalendarClock, CircleCheck, Pencil, UserCheck, UserX, XCircle } from 'lucide-react'
import { api } from '../../lib/api'
import {
  apiErrorMessage, fromDateTimeInputs, isOpen, sourceMeta, statusMeta, toDateTimeInputs, type Appointment,
} from '../../lib/appointments'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../shadcn/dialog'
import { Button } from '../ui/Button'
import { toast } from '../shadcn/toast'
import { PatientFormDialog } from '../patient-profile/PatientFormDialog'
import { AppointmentJourney } from './AppointmentJourney'

const field = 'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm'

/** One appointment: its details, and check-in, reschedule, cancel and no-show for the front desk. */
export function AppointmentDialog({ appointment, onClose, onChanged, readOnly = false }: {
  appointment: Appointment | null
  onClose: () => void
  /** Called after any change, so the list or calendar behind can reload. */
  onChanged: () => void
  /** Doctors see the details but don't change bookings here. */
  readOnly?: boolean
}) {
  const [mode, setMode] = useState<'view' | 'reschedule' | 'cancel'>('view')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [patientToEdit, setPatientToEdit] = useState<unknown>(null)

  useEffect(() => {
    setMode('view')
    setError('')
    if (appointment) {
      const when = toDateTimeInputs(new Date(appointment.starts_at))
      setDate(when.date)
      setTime(when.time)
    }
  }, [appointment])

  if (!appointment) return null

  const starts = new Date(appointment.starts_at)
  const ends = new Date(appointment.ends_at)
  const status = statusMeta(appointment.status)
  const source = sourceMeta(appointment.source)
  const editable = !readOnly && isOpen(appointment.status)

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true)
    setError('')
    try {
      await action()
      toast.add({ title: done, type: 'success' })
      onChanged()
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'That change could not be saved.'))
    } finally {
      setBusy(false)
    }
  }

  const reschedule = () => {
    const newStart = fromDateTimeInputs(date, time)
    const minutes = Math.max(5, differenceInMinutes(ends, starts))
    return run(() => api.patch(`/appointments/${appointment.id}/`, {
      starts_at: newStart.toISOString(),
      ends_at: addMinutes(newStart, minutes).toISOString(),
      status: 'scheduled',
    }), `Moved to ${format(newStart, 'EEE d MMM, h:mm a')}.`)
  }

  const editPatient = async () => {
    try {
      const res = await api.get(`/patients/${appointment.patient}/`)
      setPatientToEdit(res.data)
    } catch {
      setError("Could not load this patient's details.")
    }
  }

  return (
    <>
      <Dialog open={!!appointment && !patientToEdit} onOpenChange={(open) => { if (!open) onClose() }}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{appointment.patient_name || 'Appointment'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${status.badge}`}>{status.label}</span>
              <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${source.badge}`}>Booked by {source.label}</span>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-slate-50 p-4 text-sm">
              <div>
                <dt className="text-xs text-slate-500">When</dt>
                <dd className="font-medium text-slate-900">{format(starts, 'EEE d MMM yyyy')}</dd>
                <dd className="text-slate-700">{format(starts, 'h:mm a')} – {format(ends, 'h:mm a')}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Doctor</dt>
                <dd className="font-medium text-slate-900">Dr. {appointment.doctor_name || appointment.doctor}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Phone</dt>
                <dd className="text-slate-900">{appointment.patient_phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Reason</dt>
                <dd className="text-slate-900">{appointment.reason || '—'}</dd>
              </div>
              {appointment.doctor_notes && (
                <div className="col-span-2">
                  <dt className="text-xs text-slate-500">Doctor's notes</dt>
                  <dd className="text-slate-900">{appointment.doctor_notes}</dd>
                </div>
              )}
            </dl>

            {mode === 'view' && <AppointmentJourney appointment={appointment} onChanged={onChanged} readOnly={readOnly} />}

            {mode === 'reschedule' && (
              <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-medium text-slate-900">Move to</p>
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" aria-label="New date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
                  <input type="time" aria-label="New time" step={300} className={field} value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setMode('view')}>Back</Button>
                  <Button variant="default" size="sm" disabled={busy || !date || !time} onClick={() => void reschedule()}>
                    {busy ? 'Saving…' : 'Confirm new time'}
                  </Button>
                </div>
              </div>
            )}

            {mode === 'cancel' && (
              <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/50 p-4">
                <p className="text-sm text-slate-800">Cancel this appointment? The slot becomes free for other patients.</p>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setMode('view')}>Keep it</Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={() => void run(() => api.patch(`/appointments/${appointment.id}/`, { status: 'cancelled' }), 'Appointment cancelled.')}
                  >
                    {busy ? 'Cancelling…' : 'Cancel appointment'}
                  </Button>
                </div>
              </div>
            )}

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            {mode === 'view' && !readOnly && (
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {appointment.status === 'scheduled' && isToday(starts) && (
                  <Button
                    variant="default"
                    size="sm"
                    disabled={busy}
                    onClick={() => void run(() => api.post(`/appointments/${appointment.id}/check_in/`), 'Checked in. The patient is in the queue.')}
                  >
                    <UserCheck /> Check in
                  </Button>
                )}
                {(appointment.status === 'checked_in' || (appointment.status === 'scheduled' && isToday(starts))) && (
                  <Button
                    variant={appointment.status === 'checked_in' ? 'default' : 'outline'}
                    size="sm"
                    disabled={busy}
                    onClick={() => void run(() => api.post(`/appointments/${appointment.id}/complete/`), 'Visit completed. The feedback call is planned for tomorrow.')}
                  >
                    <CircleCheck /> Visit completed
                  </Button>
                )}
                {editable && (
                  <Button variant="outline" size="sm" onClick={() => setMode('reschedule')}>
                    <CalendarClock /> Reschedule
                  </Button>
                )}
                {editable && (
                  <Button variant="outline" size="sm" onClick={() => setMode('cancel')}>
                    <XCircle /> Cancel
                  </Button>
                )}
                {appointment.status === 'scheduled' && starts < new Date() && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void run(() => api.patch(`/appointments/${appointment.id}/`, { status: 'no_show' }), 'Marked as no-show.')}
                  >
                    <UserX /> No-show
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => void editPatient()}>
                  <Pencil /> Edit patient
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PatientFormDialog
        isOpen={!!patientToEdit}
        onOpenChange={(open) => { if (!open) setPatientToEdit(null) }}
        patient={patientToEdit}
        onSuccess={() => { setPatientToEdit(null); onChanged() }}
      />
    </>
  )
}
