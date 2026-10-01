import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Calendar, dateFnsLocalizer, type View, Views, type Event } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enIN } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { api } from '../lib/api'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { useQueueWebSocket } from '../lib/useWebSocket'
import { useUIStore } from '../store/uistore'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './shadcn/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './shadcn/alert-dialog'
import { toast } from './shadcn/toast'
import { PatientFormDialog } from './patient-profile/PatientFormDialog'

export type AppointmentDto = {
  id: number
  patient: number
  patient_name?: string
  doctor: number
  doctor_name?: string
  starts_at: string
  ends_at: string
  reason: string
  status: 'scheduled' | 'checked_in' | 'completed' | 'cancelled' | 'no_show' | 'needs_reschedule'
  source: string
}

type DoctorDto = {
  id: number
  full_name: string
}

const locales = {
  'en-IN': enIN,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

const DnDCalendar = (withDragAndDrop as any).default ? (withDragAndDrop as any).default(Calendar) : withDragAndDrop(Calendar)

const statusColorMap: Record<string, string> = {
  scheduled: '!bg-indigo-50 text-indigo-700 border-transparent border-l-[4px] !border-l-indigo-500',
  checked_in: '!bg-emerald-50 text-emerald-700 border-transparent border-l-[4px] !border-l-emerald-500',
  in_progress: '!bg-amber-50 text-amber-700 border-transparent border-l-[4px] !border-l-amber-500',
  completed: '!bg-emerald-50 text-emerald-700 border-transparent border-l-[4px] !border-l-emerald-500',
  no_show: '!bg-rose-50 text-rose-700 border-transparent border-l-[4px] !border-l-rose-500',
  cancelled: '!bg-slate-50 text-slate-700 border-transparent border-l-[4px] !border-l-slate-500',
  needs_reschedule: '!bg-red-50 text-red-700 border-transparent border-l-[4px] !border-l-red-500 border-dashed'
}

type CalendarEvent = Event & {
  resource: AppointmentDto
}

const CustomToolbar = (toolbar: any) => {
  const goToBack = () => toolbar.onNavigate('PREV')
  const goToNext = () => toolbar.onNavigate('NEXT')
  const goToCurrent = () => toolbar.onNavigate('TODAY')

  return (
    <div className="flex flex-col gap-3 mb-4">
      {/* Date above */}
      <div className="text-center font-semibold text-lg text-slate-800">
        {toolbar.label}
      </div>

      {/* Navigation and View switches on the same line */}
      <div className="flex items-center justify-between w-full">
        {/* Navigation */}
        <div className="flex items-center rounded-md shadow-sm">
          <button type="button" onClick={goToCurrent} className="relative inline-flex items-center rounded-l-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-10">Today</button>
          <button type="button" onClick={goToBack} className="relative -ml-px inline-flex items-center bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-10">Back</button>
          <button type="button" onClick={goToNext} className="relative -ml-px inline-flex items-center rounded-r-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-10">Next</button>
        </div>

        {/* View Switches */}
        <div className="flex items-center rounded-md shadow-sm">
          {Array.isArray(toolbar.views) ? toolbar.views.map((name: string, index: number) => (
            <button
              key={name}
              type="button"
              onClick={() => toolbar.onView(name)}
              className={`relative -ml-px inline-flex items-center bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-10 ${toolbar.view === name ? 'bg-slate-100 text-slate-900 z-10' : 'text-slate-600'} ${index === 0 ? 'rounded-l-md ml-0' : ''} ${index === toolbar.views.length - 1 ? 'rounded-r-md' : ''}`}
            >
              {name.charAt(0).toUpperCase() + name.slice(1)}
            </button>
          )) : Object.keys(toolbar.views).map((name: string, index: number, arr: string[]) => (
            <button
              key={name}
              type="button"
              onClick={() => toolbar.onView(name)}
              className={`relative -ml-px inline-flex items-center bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-10 ${toolbar.view === name ? 'bg-slate-100 text-slate-900 z-10' : 'text-slate-600'} ${index === 0 ? 'rounded-l-md ml-0' : ''} ${index === arr.length - 1 ? 'rounded-r-md' : ''}`}
            >
              {name.charAt(0).toUpperCase() + name.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const PatientCombobox = ({ patientsList, value, onChange, onAddNew }: { patientsList: any[], value: string, onChange: (val: string) => void, onAddNew: () => void }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = patientsList.filter(p => p.full_name.toLowerCase().includes(search.toLowerCase()))
  const selectedPatient = patientsList.find(p => p.id.toString() === value)
  
  return (
    <div className="relative" ref={containerRef}>
      <div 
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white cursor-pointer flex justify-between items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedPatient ? "text-slate-900" : "text-slate-500"}>
          {selectedPatient ? selectedPatient.full_name : "Search or Select Patient..."}
        </span>
        <span className="text-slate-400 text-[10px]">▼</span>
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] overflow-hidden">
          <div className="bg-slate-50 p-2 border-b border-slate-100">
            <input 
              autoFocus
              type="text"
              placeholder="Type to search..."
              className="w-full text-sm outline-none px-2 py-1.5 rounded-lg border border-slate-200 focus:border-indigo-300"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length > 0 ? filtered.map(p => (
              <div 
                key={p.id}
                className={`px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer ${value === p.id.toString() ? 'bg-indigo-50 text-indigo-700 font-medium' : ''}`}
                onClick={() => { onChange(p.id.toString()); setIsOpen(false); setSearch('') }}
              >
                {p.full_name}
              </div>
            )) : (
              <div className="px-3 py-4 text-sm text-center text-slate-500">No matching patients.</div>
            )}
          </div>
          <div className="bg-white p-2 border-t border-slate-100">
            <button 
              type="button"
              className="w-full rounded-lg bg-indigo-50 text-sm text-indigo-600 font-medium hover:bg-indigo-100 py-2 transition-colors flex items-center justify-center gap-2"
              onClick={() => { onAddNew(); setIsOpen(false); setSearch('') }}
            >
              + Create New Patient
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function CalendarView({
  showBookButton = false,
  user,
  doctorIdProp,
  hideDoctorSelect = false,
  defaultView = Views.AGENDA,
  heightClass = "h-[700px]",
  hideHeader = false,
  hideSidebar = false,
  hideMiniCalendar = false,
  customTitle,
  customSubtitle,
  fillHeight = false
}: {
  showBookButton?: boolean,
  user?: { role: string, doctor_profile_id?: number | null },
  doctorIdProp?: string | number,
  hideDoctorSelect?: boolean,
  defaultView?: View,
  heightClass?: string,
  hideHeader?: boolean,
  hideSidebar?: boolean,
  hideMiniCalendar?: boolean,
  customTitle?: React.ReactNode,
  customSubtitle?: React.ReactNode,
  /** Fill the parent's height: the page stays still and only the calendar grid scrolls. */
  fillHeight?: boolean
}) {
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<AppointmentDto[]>([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<View>(defaultView)
  const [date, setDate] = useState(new Date())
  const { refreshTick } = useUIStore()

  const [doctors, setDoctors] = useState<DoctorDto[]>([])
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(
    doctorIdProp !== undefined ? String(doctorIdProp) : 'all'
  )

  useEffect(() => {
    if (doctorIdProp !== undefined) {
      setSelectedDoctorId(String(doctorIdProp))
    }
  }, [doctorIdProp])

  const isDoctor = user?.role === 'doctor'

  const [activeDoctorProfile, setActiveDoctorProfile] = useState<any>(null)

  useEffect(() => {
    const docId = isDoctor ? user?.doctor_profile_id : selectedDoctorId !== 'all' ? selectedDoctorId : null
    if (docId) {
      api.get(`/doctors/${docId}/`).then(res => {
        setActiveDoctorProfile(res.data)
      }).catch(err => console.error("Could not load doctor profile", err))
    } else {
      setActiveDoctorProfile(null)
    }
  }, [isDoctor, user?.doctor_profile_id, selectedDoctorId])

  const dayPropGetter = useCallback(
    (date: Date) => {
      if (activeDoctorProfile && activeDoctorProfile.working_days) {
        const day = date.getDay()
        const isoDay = day === 0 ? 7 : day
        if (!activeDoctorProfile.working_days.includes(isoDay)) {
          return {
            style: {
              background: 'repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 10px, #f8fafc 10px, #f8fafc 20px)',
              opacity: 0.6,
              pointerEvents: 'none' as const
            }
          }
        }
      }
      return {}
    },
    [activeDoctorProfile]
  )

  const activeDoctorWsId = isDoctor ? (user?.doctor_profile_id || null) : (selectedDoctorId !== 'all' ? Number(selectedDoctorId) : null)
  const { lastMessage } = useQueueWebSocket(activeDoctorWsId)

  const [showWalkinModal, setShowWalkinModal] = useState(false)
  const [showNewPatientModal, setShowNewPatientModal] = useState(false)
  const [patientsList, setPatientsList] = useState<{ id: number; full_name: string }[]>([])
  const [walkinForm, setWalkinForm] = useState({
    doctor: '',
    patient: '',
    starts_at: '',
    duration_minutes: 15,
    priority: 'normal',
    reason: 'Walk-in consultation'
  })
  const [suggestedShifts, setSuggestedShifts] = useState<any[] | null>(null)
  const [submittingWalkin, setSubmittingWalkin] = useState(false)

  const [showEditModal, setShowEditModal] = useState(false)
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null)
  const [editForm, setEditForm] = useState({ status: 'scheduled' })
  const [submittingEdit, setSubmittingEdit] = useState(false)

  useEffect(() => {
    if (!isDoctor) {
      api.get('/doctors/', { params: { page_size: 100 } }).then(res => {
        const results = Array.isArray(res.data?.results) ? res.data.results : (Array.isArray(res.data) ? res.data : [])
        setDoctors(results)
      }).catch(err => console.error("Could not load doctors", err))
    }
  }, [isDoctor])

  const fetchAppointments = useCallback(async (currentDate: Date, currentView: View) => {
    setLoading(true)
    try {
      let start = new Date(currentDate)
      let end = new Date(currentDate)

      if (currentView === Views.MONTH || currentView === Views.AGENDA) {
        start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59)
      } else if (currentView === Views.WEEK || currentView === Views.WORK_WEEK) {
        start.setDate(currentDate.getDate() - currentDate.getDay())
        start.setHours(0, 0, 0, 0)
        end = new Date(start)
        end.setDate(start.getDate() + 7)
        end.setHours(23, 59, 59, 999)
      } else {
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
      }

      start.setDate(start.getDate() - 7)
      end.setDate(end.getDate() + 7)

      const params: any = {
        starts_at_after: start.toISOString(),
        starts_at_before: end.toISOString(),
        page_size: 5000
      }

      if (isDoctor && user?.doctor_profile_id) {
        params.doctor = user.doctor_profile_id
      } else if (!isDoctor && selectedDoctorId !== 'all') {
        params.doctor = selectedDoctorId
      }

      const response = await api.get('/appointments/', { params })
      const results = Array.isArray(response.data?.results) ? response.data.results : (Array.isArray(response.data) ? response.data : [])
      setAppointments(results as AppointmentDto[])
    } catch (err) {
      console.error('Failed to load calendar appointments', err)
    } finally {
      setLoading(false)
    }
  }, [isDoctor, selectedDoctorId])

  const [confirmAction, setConfirmAction] = useState<{ type: 'drop' | 'resize'; event: CalendarEvent; start: Date; end: Date } | null>(null)
  const [errorAlert, setErrorAlert] = useState<string | null>(null)

  useEffect(() => {
    void fetchAppointments(date, view)
  }, [fetchAppointments, date, view, refreshTick])

  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === 'appointment.created' || lastMessage.type === 'appointment.shifted') {
        const msg = lastMessage.type === 'appointment.created'
          ? `New walk-in added: ${lastMessage.payload?.patient_name || 'Patient'}`
          : `Appointment shifted: ${lastMessage.payload?.patient_name || 'Patient'}`
        toast.add({ title: msg, type: 'info' })
        void fetchAppointments(date, view)
      }
    }
  }, [lastMessage, fetchAppointments, date, view])

  const handleOpenWalkinModal = async (start: Date) => {
    if (isDoctor) return
    const isoString = format(start, "yyyy-MM-dd'T'HH:mm")
    setWalkinForm(prev => ({
      ...prev,
      doctor: selectedDoctorId !== 'all' ? selectedDoctorId : (doctors[0]?.id.toString() || ''),
      starts_at: isoString
    }))
    setSuggestedShifts(null)
    setShowWalkinModal(true)
    try {
      const res = await api.get('/patients/', { params: { page_size: 100 } })
      const results = Array.isArray(res.data?.results) ? res.data.results : (Array.isArray(res.data) ? res.data : [])
      setPatientsList(results)
      if (results.length > 0 && !walkinForm.patient) {
        setWalkinForm(prev => ({ ...prev, patient: results[0].id.toString() }))
      }
    } catch (err) {
      console.error('Failed to fetch patients for walkin', err)
    }
  }

  const handleCheckConflicts = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!walkinForm.doctor || !walkinForm.patient || !walkinForm.starts_at) {
      setErrorAlert("Please select Doctor, Patient, and Start Time.")
      return
    }
    setSubmittingWalkin(true)
    try {
      const res = await api.post('/appointments/walkin/suggest/', {
        doctor: Number(walkinForm.doctor),
        starts_at: new Date(walkinForm.starts_at).toISOString(),
        duration_minutes: Number(walkinForm.duration_minutes)
      })
      const shifts = res.data.shifts || []
      if (shifts.length === 0) {
        await handleConfirmWalkin([])
      } else {
        setSuggestedShifts(shifts)
      }
    } catch (err: any) {
      setErrorAlert(err.response?.data?.error || "Failed to check schedule conflicts.")
    } finally {
      setSubmittingWalkin(false)
    }
  }

  const handleConfirmWalkin = async (confirmedShifts: any[]) => {
    setSubmittingWalkin(true)
    try {
      await api.post('/appointments/walkin/confirm/', {
        doctor: Number(walkinForm.doctor),
        patient: Number(walkinForm.patient),
        starts_at: new Date(walkinForm.starts_at).toISOString(),
        duration_minutes: Number(walkinForm.duration_minutes),
        reason: walkinForm.reason,
        priority: walkinForm.priority,
        confirmed_shifts: confirmedShifts
      })
      setShowWalkinModal(false)
      setSuggestedShifts(null)
      toast.add({ title: "Walk-in appointment confirmed!", type: 'success' })
      void fetchAppointments(date, view)
    } catch (err: any) {
      setErrorAlert(err.response?.data?.error || "Failed to confirm walk-in appointment.")
    } finally {
      setSubmittingWalkin(false)
    }
  }


  const jumpToNextAppointment = async () => {
    try {
      const now = new Date().toISOString()
      const res = await api.get('/appointments/', {
        params: {
          starts_at_after: now,
          ordering: 'starts_at',
          page_size: 1,
        }
      })
      const nextAppointments = Array.isArray(res.data?.results) ? res.data.results : (Array.isArray(res.data) ? res.data : [])
      if (nextAppointments.length > 0) {
        const nextDate = new Date(nextAppointments[0].starts_at)
        setDate(nextDate)
        setView(Views.DAY)
      } else {
        toast.add({ title: 'No upcoming appointments found.', type: 'info' })
      }
    } catch (err) {
      toast.add({ title: 'Failed to find next appointment.', type: 'error' })
    }
  }

  const rawEvents: CalendarEvent[] = useMemo(() => appointments.map(appt => {
    const start = new Date(appt.starts_at)
    let end = new Date(appt.ends_at)

    // Enforce a minimum 30-minute duration for rendering in Day/Week views
    if (end.getTime() - start.getTime() < 30 * 60 * 1000) {
      end = new Date(start.getTime() + 30 * 60 * 1000)
    }

    return {
      title: appt.patient_name || 'Patient',
      start,
      end,
      resource: appt,
      resourceId: appt.doctor
    }
  }), [appointments])

  const events: CalendarEvent[] = useMemo(() => {
    if (view !== Views.MONTH) {
      return rawEvents
    }
    const grouped = rawEvents.reduce((acc, event) => {
      const dateKey = format(event.start!, 'yyyy-MM-dd')
      if (!acc[dateKey]) {
        acc[dateKey] = []
      }
      acc[dateKey].push(event)
      return acc
    }, {} as Record<string, CalendarEvent[]>)

    return Object.entries(grouped).map(([dateStr, dayEvents]) => {
      const parsedDate = parse(dateStr, 'yyyy-MM-dd', new Date())
      return {
        title: `${dayEvents.length} Appointment${dayEvents.length > 1 ? 's' : ''}`,
        start: parsedDate,
        end: parsedDate,
        resource: { isAggregate: true, date: parsedDate } as any
      }
    })
  }, [rawEvents, view])

  const onEventDrop = (args: any) => {
    const now = new Date()
    if (new Date(args.event.start) < now) {
      toast.add({ title: "Cannot reschedule past appointments.", type: 'error' })
      return
    }
    if (new Date(args.start) < now) {
      toast.add({ title: "Cannot move appointments to a past time.", type: 'error' })
      return
    }
    setConfirmAction({ type: 'drop', event: args.event, start: args.start, end: args.end })
  }

  const onEventResize = (args: any) => {
    const now = new Date()
    if (new Date(args.event.start) < now) {
      toast.add({ title: "Cannot resize past appointments.", type: 'error' })
      return
    }
    if (new Date(args.start) < now) {
      toast.add({ title: "Cannot resize appointments to a past time.", type: 'error' })
      return
    }
    setConfirmAction({ type: 'resize', event: args.event, start: args.start, end: args.end })
  }

  const handleConfirmAction = async () => {
    if (!confirmAction) return
    const { event, start, end } = confirmAction
    setConfirmAction(null)
    try {
      await api.patch(`/appointments/${event.resource.id}/`, {
        starts_at: start.toISOString(),
        ends_at: end.toISOString()
      })
      setAppointments(prev => prev.map(a =>
        a.id === event.resource.id
          ? { ...a, starts_at: start.toISOString(), ends_at: end.toISOString() }
          : a
      ))
    } catch (err: any) {
      if (err.response?.data) {
        const data = err.response.data;
        const msg = data.non_field_errors?.[0] || Object.values(data).flat()[0];
        setErrorAlert(typeof msg === 'string' ? msg : `Could not update: ${JSON.stringify(data)}`);
      } else {
        setErrorAlert("Could not update the appointment. Please check availability and rules.")
      }
    }
  }

  const eventPropGetter = useCallback((event: CalendarEvent) => {
    if (event.resource?.isAggregate) {
      return {
        className: 'border border-blue-500/20 bg-blue-600/90 backdrop-blur text-white shadow-sm rounded-md px-1 py-1 text-center font-semibold text-xs',
      }
    }
    const status = event.resource?.status
    const colorClass = statusColorMap[status] || '!bg-slate-50 text-slate-800 border-transparent border-l-[4px] !border-l-slate-400'
    return {
      className: `rounded-r-xl rounded-l-sm px-2 py-1.5 text-xs font-medium transition-all hover:brightness-95 overflow-hidden shadow-sm ${colorClass}`,
      style: { border: 'none', color: 'inherit' }
    }
  }, [])

  const EventComponent = ({ event }: { event: any }) => {
    if (event.resource?.isAggregate) {
      return (
        <div className="h-full w-full flex items-center justify-center font-medium text-slate-700 p-1 text-[11px] rounded-md transition-colors">
          {event.title}
        </div>
      )
    }
    return (
      <div className="h-full overflow-hidden p-1 text-[11px] leading-tight">
        <div className="font-semibold">{event.title}</div>
        <div className="truncate opacity-90">{event.resource.reason}</div>
        <div className="font-medium opacity-75 mt-0.5">{event.resource.doctor_name}</div>
      </div>
    )
  }

  const [categories] = useState({
    'Consultation': true,
    'Follow-up': true,
    'Routine Checkup': true,
    'Emergency': false
  })
  
  const [priorityFilter] = useState('All')

  const calendarHeight = fillHeight ? 'h-full min-h-0' : heightClass

  return (
    <div className={fillHeight ? 'flex h-full min-h-0 flex-col gap-6' : 'space-y-6'}>
      {!hideHeader && (
        <div className="flex shrink-0 flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              {customTitle || "Calendar"}
            </h2>
            <p className="text-xs text-slate-500">{customSubtitle || "Manage your schedule"}</p>
          </div>
          <div className="flex items-center gap-3">
            {!isDoctor && !hideDoctorSelect && (
              <select
                value={selectedDoctorId}
                onChange={e => setSelectedDoctorId(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white min-w-[150px]"
              >
                <option value="all">All Doctors</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>Dr. {d.full_name}</option>
                ))}
              </select>
            )}
            {!isDoctor && (
              <Button variant="secondary" onClick={() => void handleOpenWalkinModal(new Date())}>
                + Walk-in
              </Button>
            )}
            {!isDoctor && showBookButton && (
              <Button variant="default" onClick={() => navigate(`/app/booking?date=${format(date, 'yyyy-MM-dd')}`)}>
                Book Appointment
              </Button>
            )}
          </div>
        </div>
      )}

      <div className={`flex flex-col lg:flex-row gap-6 ${fillHeight ? 'flex-1 min-h-0' : ''}`}>
        {/* Left Sidebar (Mini Calendar & Filters) */}
        {!hideSidebar && (
        <div className={`lg:w-64 flex-shrink-0 space-y-6 hidden lg:block ${fillHeight ? 'overflow-y-auto' : ''}`}>
          {!hideMiniCalendar && (
          <Card className="p-5 bg-white border-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 text-sm">
                {date.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex gap-1 text-slate-400">
                <button onClick={() => setDate(new Date(date.getFullYear(), date.getMonth() - 1, 1))} className="hover:text-slate-900">&lt;</button>
                <button onClick={() => setDate(new Date(date.getFullYear(), date.getMonth() + 1, 1))} className="hover:text-slate-900">&gt;</button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 text-center text-[10px] font-medium text-slate-400 mb-2">
              <div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div><div>Su</div>
            </div>
            <div className="grid grid-cols-7 text-center text-xs text-slate-700 gap-y-2">
              {Array.from({ length: new Date(date.getFullYear(), date.getMonth(), 1).getDay() === 0 ? 6 : new Date(date.getFullYear(), date.getMonth(), 1).getDay() - 1 }).map((_, i) => (
                <div key={`empty-${i}`}></div>
              ))}
              {Array.from({ length: new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() }).map((_, i) => {
                const day = i + 1;
                const isSelected = date.getDate() === day;
                return (
                  <div key={day} className="flex justify-center">
                    <button 
                      onClick={() => setDate(new Date(date.getFullYear(), date.getMonth(), day))}
                      className={`w-6 h-6 flex items-center justify-center rounded-full ${isSelected ? 'bg-indigo-500 text-white font-bold shadow-sm' : 'hover:bg-slate-100'}`}
                    >
                      {day}
                    </button>
                  </div>
                )
              })}
            </div>
          </Card>
          )}

          {/* Categories */}
          <Card className="p-5 bg-white border-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] rounded-2xl">
            <h3 className="font-semibold text-slate-900 text-sm mb-4">Categories</h3>
            <div className="space-y-3">
              {Object.entries(categories).map(([cat, isChecked], idx) => {
                const colors = ['bg-emerald-500', 'bg-indigo-500', 'bg-purple-500', 'bg-rose-500'];
                const color = colors[idx % colors.length];
                return (
                  <label key={cat} className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-[4px] flex items-center justify-center transition-colors ${isChecked ? color : 'bg-slate-200 group-hover:bg-slate-300'}`}>
                        {isChecked && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-xs font-medium ${isChecked ? 'text-slate-800' : 'text-slate-500'}`}>{cat}</span>
                    </div>
                  </label>
                )
              })}
            </div>
          </Card>

          {/* Prioritize */}
          <Card className="p-5 bg-white border-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] rounded-2xl">
            <h3 className="font-semibold text-slate-900 text-sm mb-4">Prioritize</h3>
            <div className="space-y-3">
              {['All', 'Urgent', 'Routine'].map((p) => (
                <label key={p} className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className={`w-3.5 h-3.5 rounded-full border-[3.5px] transition-colors ${priorityFilter === p ? 'border-indigo-500 bg-white' : 'border-slate-200 bg-transparent group-hover:border-slate-300'}`} />
                    <span className={`text-xs font-medium ${priorityFilter === p ? 'text-slate-800' : 'text-slate-500'}`}>{p}</span>
                  </div>
                </label>
              ))}
            </div>
          </Card>
        </div>
        )}

        {/* Main Calendar */}
        <div className={`flex-1 bg-white rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden ${calendarHeight} relative ${fillHeight ? '' : 'min-h-[500px]'}`}>
        {loading && <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center"><div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" /></div>}
        
        {/* EMPTY STATE */}
        {events.length === 0 && !loading && view === Views.DAY && (
          <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-xl">
            <div className="text-center p-8 max-w-md">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No appointments scheduled</h3>
              <p className="text-sm text-slate-500 mb-6">There are no bookings for the selected date.</p>
              <Button onClick={jumpToNextAppointment} className="bg-slate-900 text-white hover:bg-slate-800">
                Jump to next appointment
              </Button>
            </div>
          </div>
        )}

        <div className={`${fillHeight ? 'h-full' : heightClass} rbc-custom-theme ${fillHeight ? 'rbc-roomy' : ''}`}>
          <DnDCalendar
            key={`calendar-${doctors.length}-${selectedDoctorId}`}
            localizer={localizer}
            events={events}
            resources={!isDoctor && selectedDoctorId === 'all' && view === Views.DAY && doctors.length > 0 ? doctors : undefined}
            resourceIdAccessor="id"
            resourceTitleAccessor={(r: any) => `Dr. ${r.full_name}`}
            onEventDrop={!isDoctor ? onEventDrop : undefined}
            onEventResize={!isDoctor ? onEventResize : undefined}
            resizable={!isDoctor}
            selectable={!isDoctor}
            dayLayoutAlgorithm={'no-overlap'}
            onSelectSlot={(slotInfo: any) => {
              if (!isDoctor && (slotInfo.action === 'click' || slotInfo.action === 'select')) {
                void handleOpenWalkinModal(slotInfo.start)
              }
            }}
            onSelectEvent={(event: CalendarEvent) => {
              if (view === Views.MONTH && event.resource?.isAggregate) {
                setDate(event.resource.date)
                setView(Views.DAY)
              } else if (view !== Views.MONTH && !event.resource?.isAggregate) {
                setEditEvent(event)
                setEditForm({ status: event.resource.status })
                setShowEditModal(true)
              }
            }}
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            defaultView={defaultView}
            step={15}
            timeslots={4}
            min={new Date(0, 0, 0, 7, 0, 0)}
            max={new Date(0, 0, 0, 21, 0, 0)}
            components={{
              event: EventComponent,
              toolbar: CustomToolbar
            }}
            eventPropGetter={eventPropGetter}
            dayPropGetter={dayPropGetter}
            onDrillDown={(date: Date) => {
              setDate(date)
              setView(Views.DAY)
            }}
          />
        </div>
        </div>
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm {confirmAction?.type === 'drop' ? 'Reschedule' : 'Resize'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {confirmAction?.type === 'drop' ? 'move' : 'resize'} the appointment for <strong className="text-slate-900">{confirmAction?.event.title}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmAction()}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!errorAlert} onOpenChange={(open) => { if (!open) setErrorAlert(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Action failed</AlertDialogTitle>
            <AlertDialogDescription>{errorAlert}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorAlert(null)}>Okay</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showWalkinModal && !suggestedShifts} onOpenChange={setShowWalkinModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Book Walk-In Consultation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCheckConflicts} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Doctor</label>
              <select
                value={walkinForm.doctor}
                onChange={e => setWalkinForm({ ...walkinForm, doctor: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                required
              >
                <option value="">Select Doctor</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>Dr. {d.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Patient</label>
              <PatientCombobox 
                patientsList={patientsList}
                value={walkinForm.patient}
                onChange={(val) => setWalkinForm({ ...walkinForm, patient: val })}
                onAddNew={() => setShowNewPatientModal(true)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  value={walkinForm.starts_at}
                  onChange={e => setWalkinForm({ ...walkinForm, starts_at: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Duration (mins)</label>
                <input
                  type="number"
                  value={walkinForm.duration_minutes}
                  onChange={e => setWalkinForm({ ...walkinForm, duration_minutes: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                  min={5}
                  step={5}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={walkinForm.priority}
                onChange={e => setWalkinForm({ ...walkinForm, priority: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Reason</label>
              <input
                type="text"
                value={walkinForm.reason}
                onChange={e => setWalkinForm({ ...walkinForm, reason: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                placeholder="Walk-in consultation"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowWalkinModal(false)}>Cancel</Button>
              <Button variant="default" type="submit" disabled={submittingWalkin}>
                {submittingWalkin ? 'Checking...' : 'Check Availability & Book'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showWalkinModal && !!suggestedShifts} onOpenChange={(open) => {
        if (!open) {
          setShowWalkinModal(false)
          setSuggestedShifts(null)
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <span className="font-semibold text-lg">Schedule Conflict Detected</span>
            </DialogTitle>
            <DialogDescription>
              Booking this walk-in will overlap with existing appointments. The following schedule adjustments are recommended:
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto space-y-2 mb-4 pr-1">
            {suggestedShifts?.map((shift, idx) => (
              <div key={idx} className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 text-xs">
                <div className="font-medium text-slate-900 mb-1">{shift.patient_name}</div>
                <div className="text-slate-600">
                  Old: {format(new Date(shift.old_starts_at), 'hh:mm a')} - {format(new Date(shift.old_ends_at), 'hh:mm a')}
                </div>
                <div className="font-medium text-amber-800">
                  New: {format(new Date(shift.new_starts_at), 'hh:mm a')} - {format(new Date(shift.new_ends_at), 'hh:mm a')}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mb-6">
            Patients will be automatically notified via SMS of their adjusted time slot.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setSuggestedShifts(null)}>Back</Button>
            <Button
              variant="default"
              onClick={() => void handleConfirmWalkin(suggestedShifts || [])}
              disabled={submittingWalkin}
            >
              {submittingWalkin ? 'Confirming...' : 'Confirm Shifts & Book Walk-In'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <p className="text-sm font-medium text-slate-900">{editEvent?.title}</p>
              <p className="text-xs text-slate-500">{editEvent?.resource?.reason}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
              <select
                value={editForm.status}
                onChange={e => setEditForm({ status: e.target.value })}
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
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
              <Button variant="default" onClick={async () => {
                if (!editEvent) return;
                setSubmittingEdit(true)
                try {
                  await api.patch(`/appointments/${editEvent.resource.id}/`, { status: editForm.status })
                  toast.add({ title: 'Appointment status updated!', type: 'success' })
                  setShowEditModal(false)
                  void fetchAppointments(date, view)
                } catch (err) {
                  setErrorAlert('Failed to update appointment status.')
                } finally {
                  setSubmittingEdit(false)
                }
              }} disabled={submittingEdit}>
                {submittingEdit ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PatientFormDialog 
        isOpen={showNewPatientModal} 
        onOpenChange={setShowNewPatientModal} 
        onSuccess={async (id) => {
          try {
            const res = await api.get('/patients/', { params: { page_size: 100 } })
            const results = Array.isArray(res.data?.results) ? res.data.results : (Array.isArray(res.data) ? res.data : [])
            setPatientsList(results)
            setWalkinForm(prev => ({ ...prev, patient: String(id) }))
          } catch (err) {
            console.error('Failed to refresh patients list', err)
          }
        }} 
      />
    </div>
  )
}
