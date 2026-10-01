import { useState, useEffect, useRef } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { api } from '../lib/api'
import { useQueueWebSocket } from '../lib/useWebSocket'
import { LayoutGrid, Calendar as CalendarIcon, Activity, CheckCircle2, Clock, Users } from 'lucide-react'
import { CalendarView } from '../components/CalendarView'
import { Views } from 'react-big-calendar'
import { useRealtimeEvents } from '../hooks/useRealtimeEvents'
import { format } from 'date-fns'
import { LiveClock } from '../components/LiveClock'

type AppointmentDto = {
  id: number
  patient_name: string
  doctor_name: string
  starts_at: string
  ends_at: string
  status: string
  reason: string
}

type DoctorDto = {
  id: number
  full_name: string
  specialty?: string
}

function DoctorCalendarCard({ doctor }: { doctor: DoctorDto }) {
  const { status: wsStatus } = useQueueWebSocket(doctor.id)

  const titleNode = (
    <div className="flex items-center gap-2">
      <span className="text-lg font-bold text-slate-900">Dr. {doctor.full_name}</span>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
        wsStatus === 'connected' ? 'bg-green-100 text-green-700 border border-green-200' :
        wsStatus === 'connecting' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-red-100 text-red-700 border border-red-200'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${
          wsStatus === 'connected' ? 'bg-green-500' :
          wsStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
        }`} />
        {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting' : 'Offline'}
      </span>
    </div>
  )

  return (
    <Card className="flex flex-col p-4 shadow-lg bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
      <CalendarView
        user={{ role: 'receptionist' }}
        doctorIdProp={doctor.id}
        hideDoctorSelect={true}
        defaultView={Views.DAY}
        heightClass="h-[560px]"
        showBookButton={false}
        hideSidebar={true}
        customTitle={titleNode}
        customSubtitle={doctor.specialty || 'General Practice'}
      />
    </Card>
  )
}

export default function ReceptionistDashboard() {
  const [doctors, setDoctors] = useState<DoctorDto[]>([])
  const [appointments, setAppointments] = useState<AppointmentDto[]>([])
  const [layoutMode, setLayoutMode] = useState<'grid' | 'tabbed'>('grid')
  const [activeTabDoctorId, setActiveTabDoctorId] = useState<number | 'all'>('all')
  const todayRef = useRef(new Date().getDate())

  const loadData = async () => {
    try {
      const [doctorsRes, apptsRes, meRes] = await Promise.all([
        api.get('/doctors/', { params: { page_size: 50 } }),
        api.get('/appointments/', {
          params: {
            starts_at_after: new Date(new Date().setHours(0,0,0,0)).toISOString(),
            starts_at_before: new Date(new Date().setHours(23,59,59,999)).toISOString(),
            page_size: 500
          }
        }),
        api.get('/accounts/me/')
      ])

      const allDoctors = doctorsRes.data.results || doctorsRes.data
      const myId = meRes.data?.id || 1
      
      // Simple logic to divide doctors among receptionists (assumes ~2 receptionists)
      // This splits the doctors array in half based on whether the receptionist's ID is even or odd
      const halfIndex = Math.ceil(allDoctors.length / 2)
      const isEvenId = myId % 2 === 0
      const myDoctors = isEvenId ? allDoctors.slice(halfIndex) : allDoctors.slice(0, halfIndex)

      setDoctors(myDoctors)
      setAppointments(apptsRes.data.results || apptsRes.data)
    } catch (err) {
      console.error('Failed to load dashboard data', err)
    }
  }

  useEffect(() => {
    void loadData()

    // Real-time midnight rollover check
    const interval = setInterval(() => {
      const currentDay = new Date().getDate()
      if (todayRef.current !== currentDay) {
        todayRef.current = currentDay
        void loadData()
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  useRealtimeEvents((payload) => {
    if (payload.type.startsWith('appointment.')) {
      void loadData()
    }
  })

  // Metrics
  const totalBookings = appointments.length
  const completed = appointments.filter(a => a.status === 'completed').length
  const checkedIn = appointments.filter(a => a.status === 'checked_in' || a.status === 'in_progress').length
  const scheduled = appointments.filter(a => a.status === 'scheduled').length

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Reception Desk</h1>
          <p className="text-slate-500">Live clinic overview, daily bookings, and walk-in management.</p>
        </div>
        <LiveClock />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl border-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] bg-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Total Bookings</p>
            <p className="text-2xl font-bold text-slate-900">{totalBookings}</p>
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] bg-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Scheduled</p>
            <p className="text-2xl font-bold text-slate-900">{scheduled}</p>
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] bg-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Checked In</p>
            <p className="text-2xl font-bold text-slate-900">{checkedIn}</p>
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] bg-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Completed</p>
            <p className="text-2xl font-bold text-slate-900">{completed}</p>
          </div>
        </Card>
      </div>

      {/* Today's Timeline Table */}
      <Card className="bg-white border-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900">Today's Timeline</h2>
        </div>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 sticky top-0 shadow-sm z-10">
              <tr>
                <th className="px-5 py-3 font-semibold">Time</th>
                <th className="px-5 py-3 font-semibold">Patient</th>
                <th className="px-5 py-3 font-semibold">Doctor</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appointments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500 bg-white">No bookings found for today.</td>
                </tr>
              ) : (
                [...appointments].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()).map((appt) => (
                  <tr key={appt.id} className="hover:bg-slate-50/50 transition-colors bg-white">
                    <td className="px-5 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {format(new Date(appt.starts_at), 'hh:mm a')} - {format(new Date(appt.ends_at), 'hh:mm a')}
                    </td>
                    <td className="px-5 py-3 text-slate-700 font-bold">{appt.patient_name}</td>
                    <td className="px-5 py-3 text-slate-600">Dr. {appt.doctor_name || 'Unassigned'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        appt.status === 'scheduled' ? 'bg-indigo-50 text-indigo-700' :
                        appt.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                        appt.status === 'cancelled' ? 'bg-rose-50 text-rose-700' :
                        'bg-amber-50 text-amber-700'
                      }`}>
                        {appt.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500 truncate max-w-[200px]">{appt.reason || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="pt-4 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-xl font-bold text-slate-900">Doctor Calendars</h2>
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <Button
              size="sm"
              variant={layoutMode === 'grid' ? 'default' : 'secondary'}
              onClick={() => setLayoutMode('grid')}
              className="gap-1.5 text-xs"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Side-by-Side
            </Button>
            <Button
              size="sm"
              variant={layoutMode === 'tabbed' ? 'default' : 'secondary'}
              onClick={() => setLayoutMode('tabbed')}
              className="gap-1.5 text-xs"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Focused Tab
            </Button>
          </div>
        </div>

      {layoutMode === 'grid' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {doctors.map(doctor => (
            <DoctorCalendarCard key={doctor.id} doctor={doctor} />
          ))}
          {doctors.length === 0 && (
            <div className="col-span-full p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
              Loading doctor calendars...
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <Button
              size="sm"
              variant={activeTabDoctorId === 'all' ? 'default' : 'secondary'}
              onClick={() => setActiveTabDoctorId('all')}
            >
              All Doctors
            </Button>
            {doctors.map(d => (
              <Button
                key={d.id}
                size="sm"
                variant={activeTabDoctorId === d.id ? 'default' : 'secondary'}
                onClick={() => setActiveTabDoctorId(d.id)}
              >
                Dr. {d.full_name}
              </Button>
            ))}
          </div>
          <Card className="p-4 bg-white shadow-lg border border-slate-200/80 rounded-2xl">
            <CalendarView
              user={{ role: 'receptionist' }}
              doctorIdProp={activeTabDoctorId}
              hideDoctorSelect={true}
              defaultView={Views.WEEK}
              heightClass="h-[700px]"
              showBookButton={false}
              hideSidebar={true}
            />
          </Card>
        </div>
      )}
      </div>
    </div>
  )
}
