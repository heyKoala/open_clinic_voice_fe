import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Plus, Calendar as CalendarIcon, Clock, User, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useUIStore } from '../../store/uistore'
import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../shadcn/dialog'
import { Input } from '../shadcn/input'
import { DateTimePickerAmPm } from '../ui/DateTimePickerAmPm'
import { api } from '../../lib/api'

interface Appointment {
  id: number
  starts_at: string
  ends_at: string
  reason: string
  status: string
  doctor_name?: string
  doctor?: any
  doctor_notes?: string
}

interface PatientAppointmentTimelineProps {
  appointments: Appointment[]
  patientId?: number
  /** Lets the booking's time, reason and status be changed from the details dialog. */
  canEdit?: boolean
  onRefresh?: () => void | Promise<void>
}

// "YYYY-MM-DDTHH:mm" in the browser's timezone, the format DateTimePickerAmPm works with.
const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function PatientAppointmentTimeline({ appointments, patientId, canEdit = false, onRefresh }: PatientAppointmentTimelineProps) {
  const [selectedNotesAppt, setSelectedNotesAppt] = useState<Appointment | null>(null)
  const [editForm, setEditForm] = useState({ starts_at: '', reason: '', status: 'scheduled' })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const { userRole, addToast } = useUIStore()

  const openAppointment = (appt: Appointment) => {
    setEditError('')
    setEditForm({ starts_at: toLocalInput(appt.starts_at), reason: appt.reason || '', status: appt.status })
    setSelectedNotesAppt(appt)
  }

  const saveAppointment = async (e: React.FormEvent) => {
    e.preventDefault()
    const appt = selectedNotesAppt
    if (!appt) return
    setEditError('')
    if (!editForm.starts_at) {
      setEditError('Please choose a date and time.')
      return
    }

    // Only send what changed, so fixing the reason on an old visit isn't re-checked against today's schedule.
    const payload: Record<string, string> = {}
    if (editForm.reason !== (appt.reason || '')) payload.reason = editForm.reason
    if (editForm.status !== appt.status) payload.status = editForm.status
    if (editForm.starts_at !== toLocalInput(appt.starts_at)) {
      const start = new Date(editForm.starts_at)
      const duration = new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()
      payload.starts_at = start.toISOString()
      payload.ends_at = new Date(start.getTime() + duration).toISOString()
    }
    if (Object.keys(payload).length === 0) {
      setSelectedNotesAppt(null)
      return
    }

    setSaving(true)
    try {
      await api.patch(`/appointments/${appt.id}/`, payload)
      addToast('Booking updated', 'success')
      setSelectedNotesAppt(null)
      if (onRefresh) await onRefresh()
    } catch (err: any) {
      const data = err.response?.data
      const msg = data && typeof data === 'object' ? data.non_field_errors?.[0] || Object.values(data).flat()[0] : null
      setEditError(typeof msg === 'string' ? msg : 'Failed to update booking.')
    } finally {
      setSaving(false)
    }
  }
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700">Scheduled</span>
      case 'completed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-100 text-green-700">Completed</span>
      case 'checked_in':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700">Checked In</span>
      case 'no_show':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-700">No Show</span>
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">Cancelled</span>
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">{status}</span>
    }
  }

  const sortedAppointments = [...appointments].sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())

  return (
    <Card className="p-0 border-slate-200 shadow-sm h-[320px] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white sticky top-0 z-10 shrink-0">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-slate-500" />
          Bookings History
        </h3>
        
        {/* Hide Add Booking button for clinic_admin since they don't have a booking route */}
        {userRole !== 'clinic_admin' && (
          <Link to="/app/booking" state={{ preselectedPatientId: patientId }}>
            <Button size="sm" className="h-7 text-xs bg-slate-900 text-white hover:bg-slate-800">
              <Plus className="w-3 h-3 mr-1" /> Add Booking
            </Button>
          </Link>
        )}
      </div>
      
      <div className="flex-1 overflow-auto bg-slate-50/30">
        {sortedAppointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <CalendarIcon className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-900">No bookings yet</p>
            <p className="text-xs text-slate-500 mt-1">This patient has no appointment history.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 font-medium">Date & Time</th>
                <th className="px-4 py-3 font-medium">Doctor</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {sortedAppointments.map((appt) => (
                <tr 
                  key={appt.id} 
                  className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                  onClick={() => openAppointment(appt)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">{formatDate(appt.starts_at)}</span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {formatTime(appt.starts_at)} - {formatTime(appt.ends_at)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {appt.doctor_name || 'Assigned Doctor'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="truncate max-w-[150px] inline-block text-slate-600" title={appt.reason || 'Routine Checkup'}>
                      {appt.reason || 'Routine Checkup'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {getStatusBadge(appt.status)}
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={!!selectedNotesAppt} onOpenChange={(open) => { if (!open) setSelectedNotesAppt(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{canEdit ? 'Booking Details' : 'Consultation Notes'}</DialogTitle>
            <DialogDescription>
              {selectedNotesAppt && `From Dr. ${selectedNotesAppt.doctor_name || 'Assigned Doctor'} on ${formatDate(selectedNotesAppt.starts_at)}`}
            </DialogDescription>
          </DialogHeader>
          <form className="py-4 space-y-4" onSubmit={saveAppointment}>
            {canEdit ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Date & Time</label>
                  <DateTimePickerAmPm value={editForm.starts_at} onChange={(v) => setEditForm(curr => ({ ...curr, starts_at: v }))} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Reason</label>
                  <Input placeholder="Routine Checkup" maxLength={255} value={editForm.reason} onChange={(e) => setEditForm(curr => ({ ...curr, reason: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm(curr => ({ ...curr, status: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="checked_in">Checked In</option>
                    <option value="needs_reschedule">Needs Reschedule</option>
                    <option value="completed">Completed</option>
                    <option value="no_show">No Show</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </>
            ) : (
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Reason</p>
                <p className="text-sm text-slate-900">{selectedNotesAppt?.reason || 'Routine Checkup'}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Doctor's Notes</p>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 min-h-[100px] text-sm text-slate-700 whitespace-pre-wrap">
                {selectedNotesAppt?.doctor_notes || <span className="text-slate-400 italic">No notes were recorded for this visit.</span>}
              </div>
            </div>
            {canEdit && (
              <>
                {editError && <p className="text-sm text-red-600 font-medium">{editError}</p>}
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={() => setSelectedNotesAppt(null)}>Cancel</Button>
                  <Button type="submit" variant="default" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</Button>
                </div>
              </>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
