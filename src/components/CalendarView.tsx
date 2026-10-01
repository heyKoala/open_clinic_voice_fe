import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Calendar, dateFnsLocalizer, type View, Views, type Event } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import {
  format,
  parse,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  addDays,
  addMonths,
  getDay,
  getDaysInMonth,
  isSameDay,
  isSameMonth,
} from 'date-fns'
import { enIN } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Pencil,
  Plus,
  RefreshCw,
  UserCheck,
  UserX,
  type LucideIcon,
} from 'lucide-react'
import { api } from '../lib/api'
import { Button } from './ui/Button'
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
  specialty?: string
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

// One hue per status: `pill` tints the sidebar filter, `dot` is the marker on each appointment card.
const STATUS_META: Record<string, { label: string; icon: LucideIcon; pill: string; dot: string }> = {
  scheduled: { label: 'Scheduled', icon: CalendarClock, pill: 'bg-indigo-100', dot: 'from-indigo-200 to-indigo-400' },
  checked_in: { label: 'Checked in', icon: UserCheck, pill: 'bg-emerald-100', dot: 'from-emerald-200 to-emerald-400' },
  in_progress: { label: 'In progress', icon: CalendarClock, pill: 'bg-amber-100', dot: 'from-amber-200 to-amber-400' },
  completed: { label: 'Completed', icon: CircleCheck, pill: 'bg-teal-100', dot: 'from-teal-200 to-teal-400' },
  needs_reschedule: { label: 'Needs reschedule', icon: RefreshCw, pill: 'bg-amber-100', dot: 'from-amber-200 to-amber-400' },
  no_show: { label: 'No show', icon: UserX, pill: 'bg-rose-100', dot: 'from-rose-200 to-rose-400' },
  cancelled: { label: 'Cancelled', icon: CircleX, pill: 'bg-slate-200/70', dot: 'from-slate-200 to-slate-400' },
}

const STATUS_FILTERS = ['scheduled', 'checked_in', 'completed', 'needs_reschedule', 'no_show', 'cancelled']

const CALENDAR_VIEWS: View[] = [Views.DAY, Views.WEEK, Views.MONTH, Views.AGENDA]

// Agenda lists this many days from the selected date (react-big-calendar's default length).
const AGENDA_DAYS = 30

const AVATAR_TINTS = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
]

type CalendarEvent = Event & {
  resource: AppointmentDto
}

/** First and last instant shown on screen for a view. */
const visibleRange = (date: Date, view: View): [Date, Date] => {
  if (view === Views.MONTH) return [startOfMonth(date), endOfMonth(date)]
  if (view === Views.WEEK || view === Views.WORK_WEEK) return [startOfWeek(date), endOfWeek(date)]
  if (view === Views.AGENDA) return [startOfDay(date), endOfDay(addDays(date, AGENDA_DAYS))]
  return [startOfDay(date), endOfDay(date)]
}

const rangeLabel = (date: Date, view: View) => {
  if (view === Views.MONTH) return format(date, 'MMMM yyyy')
  if (view === Views.DAY) return format(date, 'EEE, d MMMM yyyy')
  const [from, to] = visibleRange(date, view)
  return isSameMonth(from, to)
    ? `${format(from, 'd')} – ${format(to, 'd MMMM yyyy')}`
    : `${format(from, 'd MMM')} – ${format(to, 'd MMM yyyy')}`
}

const timeRange = (appt: AppointmentDto) =>
  `${format(new Date(appt.starts_at), 'h:mm')} – ${format(new Date(appt.ends_at), 'h:mm a')}`.toLowerCase()

const statusMeta = (status: string) => STATUS_META[status] ?? STATUS_META.scheduled

/** Day/week card. Its layout adapts to the card's height via container queries (see index.css). */
const AppointmentCard = ({ event }: { event: any }) => {
  const appt: AppointmentDto = event.resource
  const subtitle = [appt.reason, event.showDoctor ? appt.doctor_name : null].filter(Boolean).join(' · ')
  return (
    <div className="appt-card" data-status={appt.status} title={`${event.title} · ${timeRange(appt)}`}>
      <div className="appt-title">{event.title}</div>
      {subtitle && <div className="appt-sub">{subtitle}</div>}
      <div className="appt-time">{timeRange(appt)}</div>
      <span className={`appt-dot bg-linear-to-br ${statusMeta(appt.status).dot}`} />
    </div>
  )
}

const MonthCount = ({ event }: { event: any }) => (
  <div className="flex items-center justify-center gap-1.5 truncate rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 transition-colors hover:bg-indigo-100">
    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
    <span className="truncate">{event.title}</span>
  </div>
)

const AgendaAppointment = ({ event }: { event: any }) => {
  const appt: AppointmentDto = event.resource
  const meta = statusMeta(appt.status)
  return (
    <div className="flex items-center gap-3">
      <span className={`h-3 w-3 shrink-0 rounded-full bg-linear-to-br ${meta.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900">{event.title}</div>
        <div className="truncate text-xs text-slate-500">
          {[appt.reason, appt.doctor_name].filter(Boolean).join(' · ')}
        </div>
      </div>
      <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium text-slate-700 sm:inline ${meta.pill}`}>
        {meta.label}
      </span>
    </div>
  )
}

const DoctorHeader = ({ resource }: { resource: DoctorDto }) => {
  const initials = resource.full_name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  return (
    <div className="flex items-center gap-3 px-1 text-left">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${AVATAR_TINTS[resource.id % AVATAR_TINTS.length]}`}>
        {initials}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-900">Dr. {resource.full_name}</span>
        <span className="block truncate text-xs font-normal text-slate-500">{resource.specialty || 'General Practice'}</span>
      </span>
    </div>
  )
}

const WeekDayHeader = ({ date }: { date: Date }) => (
  <span className="flex flex-col items-center gap-1">
    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{format(date, 'EEE')}</span>
    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${isSameDay(date, new Date()) ? 'bg-slate-900 text-white' : 'text-slate-800'}`}>
      {format(date, 'd')}
    </span>
  </span>
)

const CALENDAR_COMPONENTS = {
  event: AppointmentCard,
  resourceHeader: DoctorHeader,
  week: { header: WeekDayHeader },
  month: { event: MonthCount },
  agenda: { event: AgendaAppointment },
}

const CALENDAR_FORMATS = {
  timeGutterFormat: (date: Date) => format(date, 'h a').toLowerCase(),
  dateFormat: 'd',
  agendaDateFormat: (date: Date) => format(date, 'EEE, d MMM'),
}

const roundIconButton = 'flex h-9 w-9 !min-h-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900'

const CalendarToolbar = ({ date, view, onView, onShift, onToday }: {
  date: Date
  view: View
  onView: (view: View) => void
  onShift: (direction: 1 | -1) => void
  onToday: () => void
}) => (
  <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Previous" onClick={() => onShift(-1)} className={roundIconButton}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button type="button" aria-label="Next" onClick={() => onShift(1)} className={roundIconButton}>
        <ChevronRight className="h-4 w-4" />
      </button>
      <h3 className="ml-1 text-base font-semibold text-slate-900 md:text-lg">{rangeLabel(date, view)}</h3>
      {!isSameDay(date, new Date()) && (
        <button type="button" onClick={onToday} className="ml-1 h-8 !min-h-0 rounded-full bg-slate-100 px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200">
          Today
        </button>
      )}
    </div>

    <div className="flex items-center rounded-full border border-slate-200 bg-white p-1">
      {CALENDAR_VIEWS.map(name => (
        <button
          key={name}
          type="button"
          aria-pressed={view === name}
          onClick={() => onView(name)}
          className={`h-9 !min-h-0 rounded-full px-4 text-sm font-medium capitalize transition-colors ${view === name ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
        >
          {name}
        </button>
      ))}
    </div>
  </div>
)

const MiniMonth = ({ selected, onSelect }: { selected: Date; onSelect: (date: Date) => void }) => {
  const [month, setMonth] = useState(() => startOfMonth(selected))

  useEffect(() => {
    setMonth(startOfMonth(selected))
  }, [selected])

  const today = new Date()
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-900">{format(month, 'MMMM yyyy')}</span>
        <div className="flex gap-1">
          <button type="button" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))} className="flex h-7 w-7 !min-h-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))} className="flex h-7 w-7 !min-h-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((name, i) => (
          <span key={i} className="pb-1 text-[11px] font-medium text-slate-400">{name}</span>
        ))}
        {Array.from({ length: getDay(month) }).map((_, i) => <span key={`blank-${i}`} />)}
        {Array.from({ length: getDaysInMonth(month) }).map((_, i) => {
          const day = new Date(month.getFullYear(), month.getMonth(), i + 1)
          const isSelected = isSameDay(day, selected)
          const isToday = isSameDay(day, today)
          return (
            <button
              key={i}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(day)}
              className={`mx-auto flex h-8 w-8 !min-h-0 items-center justify-center rounded-full text-xs transition-colors ${
                isSelected
                  ? 'bg-slate-900 font-semibold text-white'
                  : isToday
                    ? 'font-semibold text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-100'
                    : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {i + 1}
            </button>
          )
        })}
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
  const [patientToEdit, setPatientToEdit] = useState<any>(null)
  const [showPatientEditor, setShowPatientEditor] = useState(false)
  const [loadingPatient, setLoadingPatient] = useState(false)

  const handleEditPatient = async (patientId: number) => {
    setLoadingPatient(true)
    try {
      const res = await api.get(`/patients/${patientId}/`)
      setShowEditModal(false)
      setPatientToEdit(res.data)
      setShowPatientEditor(true)
    } catch (err) {
      console.error('Failed to load patient', err)
      setErrorAlert('Could not load this patient\'s details.')
    } finally {
      setLoadingPatient(false)
    }
  }

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
      // Pad a week either side so neighbouring days are ready when navigating.
      const [from, to] = visibleRange(currentDate, currentView)
      const start = addDays(from, -7)
      const end = addDays(to, 7)

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

  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set())

  const toggleStatus = (status: string) => {
    setHiddenStatuses(prev => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  // Appointments per status within the range currently on screen.
  const statusCounts = useMemo(() => {
    const [from, to] = visibleRange(date, view)
    const counts: Record<string, number> = {}
    for (const appt of appointments) {
      const startsAt = new Date(appt.starts_at)
      if (startsAt >= from && startsAt <= to) counts[appt.status] = (counts[appt.status] ?? 0) + 1
    }
    return counts
  }, [appointments, date, view])

  // Week view mixes every doctor into one column per day, so cards name the doctor there.
  const showDoctorOnCards = !isDoctor && selectedDoctorId === 'all' && view !== Views.DAY

  const rawEvents: CalendarEvent[] = useMemo(() => appointments.filter(appt => !hiddenStatuses.has(appt.status)).map(appt => {
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
      resourceId: appt.doctor,
      showDoctor: showDoctorOnCards
    }
  }), [appointments, hiddenStatuses, showDoctorOnCards])

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

  const eventPropGetter = useCallback((event: CalendarEvent) => ({
    className: event.resource?.isAggregate ? 'appt-count' : 'appt-event',
  }), [])

  const shiftDate = (direction: 1 | -1) => {
    setDate(current =>
      view === Views.MONTH
        ? addMonths(current, direction)
        : addDays(current, direction * (view === Views.WEEK ? 7 : view === Views.AGENDA ? AGENDA_DAYS : 1))
    )
  }

  const showDoctorColumns = !isDoctor && selectedDoctorId === 'all' && view === Views.DAY && doctors.length > 0
  const panel = 'rounded-3xl border border-slate-200/70 bg-white'

  return (
    <div className={fillHeight ? 'flex h-full min-h-0 flex-col' : ''}>
      <div className={`flex flex-col gap-5 lg:flex-row ${fillHeight ? 'min-h-0 flex-1' : ''}`}>
        {/* Left panel: date picker and status filters */}
        {!hideSidebar && (
          <aside className={`${panel} hidden w-72 shrink-0 flex-col p-5 lg:flex ${fillHeight ? 'overflow-y-auto' : ''}`}>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Calendar</h2>
            <p className="mt-1 text-sm text-slate-500">Pick a date and choose which appointments to show.</p>

            {!hideMiniCalendar && (
              <div className="mt-5">
                <MiniMonth selected={date} onSelect={setDate} />
              </div>
            )}

            <div className="mt-6 space-y-2">
              {STATUS_FILTERS.map(status => {
                const meta = STATUS_META[status]
                const Icon = meta.icon
                const isHidden = hiddenStatuses.has(status)
                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={!isHidden}
                    onClick={() => toggleStatus(status)}
                    className={`flex w-full items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4 text-left text-sm font-medium transition ${isHidden ? 'bg-slate-50 text-slate-400' : `${meta.pill} text-slate-800 hover:brightness-95`}`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className={`flex-1 truncate ${isHidden ? 'line-through' : ''}`}>{meta.label}</span>
                    <span className="text-xs tabular-nums opacity-70">{statusCounts[status] ?? 0}</span>
                  </button>
                )
              })}
            </div>

            <div className="mt-auto pt-6">
              <Button variant="default" className="h-11 w-full rounded-full" onClick={jumpToNextAppointment}>
                Next appointment
                <ArrowRight />
              </Button>
            </div>
          </aside>
        )}

        {/* Main panel. Embedded uses (hideSidebar) already sit inside a card, so skip the chrome. */}
        <section className={`flex min-w-0 flex-1 flex-col ${hideSidebar ? '' : `${panel} p-4 md:p-5`}`}>
          {!hideHeader && (
            <div className="mb-4 flex shrink-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                  {customTitle || 'Appointments'}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">{customSubtitle || 'Stay organized and on track with your schedule'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!isDoctor && !hideDoctorSelect && (
                  <select
                    aria-label="Doctor"
                    value={selectedDoctorId}
                    onChange={e => setSelectedDoctorId(e.target.value)}
                    className="h-11 min-w-[150px] rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700"
                  >
                    <option value="all">All Doctors</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>Dr. {d.full_name}</option>
                    ))}
                  </select>
                )}
                {!isDoctor && (
                  <Button
                    variant={showBookButton ? 'outline' : 'default'}
                    className="h-11 rounded-full px-5"
                    onClick={() => void handleOpenWalkinModal(new Date())}
                  >
                    <Plus />
                    Walk-in
                  </Button>
                )}
                {!isDoctor && showBookButton && (
                  <Button variant="default" className="h-11 rounded-full px-5" onClick={() => navigate(`/app/booking?date=${format(date, 'yyyy-MM-dd')}`)}>
                    Book Appointment
                  </Button>
                )}
              </div>
            </div>
          )}

          <CalendarToolbar date={date} view={view} onView={setView} onShift={shiftDate} onToday={() => setDate(new Date())} />

          <div className={`relative mt-4 ${fillHeight ? 'min-h-0 flex-1' : `${heightClass} min-h-[500px]`}`}>
            {loading && (
              <div className="absolute inset-0 z-40 flex items-center justify-center rounded-2xl bg-white/60">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
              </div>
            )}

            {/* Empty day: floats over the grid without blocking slot clicks around it. */}
            {events.length === 0 && !loading && view === Views.DAY && (
              <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-4">
                <div className="pointer-events-auto max-w-xs rounded-3xl border border-slate-200/70 bg-white/95 p-6 text-center shadow-[0_16px_40px_-20px_rgba(15,23,42,0.25)]">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">No appointments scheduled</h3>
                  <p className="mt-1 text-sm text-slate-500">There are no bookings to show for this date.</p>
                  <Button variant="default" className="mt-4 h-10 rounded-full px-4" onClick={jumpToNextAppointment}>
                    Jump to next appointment
                  </Button>
                </div>
              </div>
            )}

            <div className={`rbc-custom-theme absolute inset-0 ${fillHeight ? 'rbc-roomy' : ''}`}>
              <DnDCalendar
                key={`calendar-${doctors.length}-${selectedDoctorId}`}
                localizer={localizer}
                events={events}
                resources={showDoctorColumns ? doctors : undefined}
                resourceIdAccessor="id"
                resourceTitleAccessor={(r: any) => `Dr. ${r.full_name}`}
                onEventDrop={!isDoctor ? onEventDrop : undefined}
                onEventResize={!isDoctor ? onEventResize : undefined}
                draggableAccessor={(event: CalendarEvent) => !event.resource?.isAggregate}
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
                views={CALENDAR_VIEWS}
                date={date}
                onNavigate={setDate}
                defaultView={defaultView}
                step={15}
                timeslots={4}
                length={AGENDA_DAYS}
                min={new Date(0, 0, 0, 7, 0, 0)}
                max={new Date(0, 0, 0, 21, 0, 0)}
                toolbar={false}
                components={CALENDAR_COMPONENTS}
                formats={CALENDAR_FORMATS}
                eventPropGetter={eventPropGetter}
                dayPropGetter={dayPropGetter}
                onDrillDown={(date: Date) => {
                  setDate(date)
                  setView(Views.DAY)
                }}
              />
            </div>
          </div>
        </section>
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
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{editEvent?.title}</p>
                <p className="truncate text-xs text-slate-500">{editEvent?.resource?.reason}</p>
              </div>
              {!isDoctor && editEvent && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={loadingPatient}
                  onClick={() => void handleEditPatient(editEvent.resource.patient)}
                >
                  <Pencil />
                  {loadingPatient ? 'Loading...' : 'Edit patient'}
                </Button>
              )}
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
        isOpen={showPatientEditor}
        onOpenChange={setShowPatientEditor}
        patient={patientToEdit}
        onSuccess={() => {
          // The patient's name is shown on every card, so reload them.
          void fetchAppointments(date, view)
        }}
      />

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
