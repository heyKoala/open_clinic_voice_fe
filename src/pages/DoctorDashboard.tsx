import { useEffect, useState } from 'react'
import { LiveClock } from '../components/LiveClock'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { api } from '../lib/api'
import { X, ChevronRight, FileText, Activity, Sparkles, ChevronLeft, Calendar as CalendarIcon, Users, Clock, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useUIStore } from '../store/uistore'
import { useRealtimeEvents } from '../hooks/useRealtimeEvents'

type DashboardData = {
  metrics: {
    today_total: number
    completed: number
    remaining: number
    next_patient: string | null
    current_token?: {
      id: number
      token_number: number
      status: string
      patient_name: string
    } | null
  }
  appointments: Array<{
    id: number
    patient_id: number
    patient_name: string
    age: number | null
    gender: string
    starts_at: string
    ends_at: string
    reason: string
    status: string
    last_visit: string | null
  }>
}

type SymptomSummary = {
  id: number
  summary_text: string
  status: string
  created_at: string
}

export default function DoctorDashboard({ user }: { user: any }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  
  const [selectedPatient, setSelectedPatient] = useState<DashboardData['appointments'][0] | null>(null)
  const [aiSummaries, setAiSummaries] = useState<SymptomSummary[]>([])
  const [loadingSummaries, setLoadingSummaries] = useState(false)
  const { refreshTick, triggerRefresh } = useUIStore()

  useRealtimeEvents((payload) => {
    if (payload.type.startsWith('appointment.')) {
      triggerRefresh()
    }
  })

  useEffect(() => {
    let active = true
    const fetchDashboard = async () => {
      try {
        const response = await api.get('/doctors/dashboard/', { params: { _t: Date.now() } })
        if (active) setData(response.data)
      } catch (err) {
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void fetchDashboard()
    return () => { active = false }
  }, [refreshTick])

  const openPatientDrawer = async (appt: DashboardData['appointments'][0]) => {
    setSelectedPatient(appt)
    setLoadingSummaries(true)
    setAiSummaries([])
    try {
      const response = await api.get('/clinical/symptom-summaries/', {
        params: { patient: appt.patient_id, page_size: 5 }
      })
      const results = Array.isArray(response.data?.results) ? response.data.results : response.data
      setAiSummaries(Array.isArray(results) ? results : [])
    } catch (err) {
      console.error("Failed to load AI summaries", err)
    } finally {
      setLoadingSummaries(false)
    }
  }

  const markSeen = async (tokenId: number) => {
    try {
      await api.post(`/queue/${tokenId}/mark_seen/`, { notes: '' })
      useUIStore.getState().addToast(`Token marked seen.`, 'success')
      triggerRefresh()
    } catch (err: any) {
      if (err.response?.status === 409) {
        useUIStore.getState().addToast('Token was already marked as seen.', 'info')
        triggerRefresh()
      } else {
        useUIStore.getState().addToast('Could not mark the token as seen.', 'error')
      }
    }
  }

  // Dynamic calendar logic
  const today = new Date()
  const currentMonthName = today.toLocaleString('default', { month: 'long', year: 'numeric' })
  
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const startingDay = firstDayOfMonth.getDay()
  
  const calendarDays = []
  for (let i = 0; i < startingDay; i++) {
    calendarDays.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i)
  }

  if (error) return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">Dashboard metrics could not be loaded.</p>
  if (loading || !data) return <p className="p-4 text-sm text-slate-500">Loading dashboard...</p>

  const metrics = data.metrics

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-12 relative">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        
        {/* Main Left Area */}
        <div className="space-y-6">
          
          {/* Header Row */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Good Morning, Dr. {user.full_name?.split(' ')[0] || user.full_name}
              </h1>
              <p className="text-slate-500 mt-1 text-sm font-medium">Have a great and productive day filled with success</p>
            </div>
            <LiveClock />
          </div>

          {/* Metric Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-5 rounded-[24px] border-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
              <div className="w-12 h-12 rounded-full bg-indigo-100/80 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-indigo-500" />
              </div>
              <p className="text-[13px] font-semibold text-slate-500 mb-1">Today's Patients</p>
              <p className="text-3xl font-bold text-slate-900">{metrics.today_total}</p>
            </Card>
            
            <Card className="p-5 rounded-[24px] border-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
              <div className="w-12 h-12 rounded-full bg-emerald-100/80 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="text-[13px] font-semibold text-slate-500 mb-1">Completed</p>
              <p className="text-3xl font-bold text-slate-900">{metrics.completed}</p>
            </Card>
            
            <Card className="p-5 rounded-[24px] border-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
              <div className="w-12 h-12 rounded-full bg-orange-100/80 flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-orange-500" />
              </div>
              <p className="text-[13px] font-semibold text-slate-500 mb-1">Remaining</p>
              <p className="text-3xl font-bold text-slate-900">{metrics.remaining}</p>
            </Card>
            
            <Card className="p-5 rounded-[24px] border-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
              <div className="w-12 h-12 rounded-full bg-rose-100/80 flex items-center justify-center mb-4">
                <Activity className="w-6 h-6 text-rose-500" />
              </div>
              <p className="text-[13px] font-semibold text-slate-500 mb-1">Next Patient</p>
              <p className="text-xl font-bold text-slate-900 truncate" title={metrics.next_patient || 'None'}>
                {metrics.next_patient || 'None scheduled'}
              </p>
            </Card>
          </div>

          {/* Patients Today (Taking up the rest of the left column) */}
          <Card className="p-6 rounded-[24px] border-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Today's Schedule</h2>
            
            {data.appointments.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-slate-400 text-sm font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No appointments for today.
              </div>
            ) : (
              <div className="space-y-3 max-h-[calc(100vh-380px)] min-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {[...data.appointments].sort((a, b) => {
                  const isACompleted = a.status === 'completed' || a.status === 'cancelled';
                  const isBCompleted = b.status === 'completed' || b.status === 'cancelled';
                  if (isACompleted && !isBCompleted) return 1;
                  if (!isACompleted && isBCompleted) return -1;
                  return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
                }).map((appt) => {
                  const time = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(appt.starts_at))
                  const isPast = new Date(appt.ends_at) < new Date()
                  return (
                    <div 
                      key={appt.id} 
                      className={`flex flex-col sm:flex-row sm:items-center justify-between group cursor-pointer hover:bg-slate-50 p-4 rounded-[20px] transition-colors border border-slate-100 gap-4 ${isPast ? 'opacity-75 bg-slate-50/50' : 'bg-white'}`}
                      onClick={() => void openPatientDrawer(appt)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-20 text-sm font-bold text-slate-700">{time}</div>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 flex shrink-0 items-center justify-center text-indigo-700 font-bold shadow-sm">
                            {appt.patient_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-[15px] font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{appt.patient_name}</h3>
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                {appt.age ? `${appt.age}y` : 'Age N/A'} • {appt.gender || 'U'}
                              </span>
                            </div>
                            <p className="text-[13px] font-medium text-slate-500 truncate max-w-[300px]">
                              {appt.reason || 'No specific reason provided'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 pl-24 sm:pl-0">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-lg">
                          {appt.status.replace('_', ' ')}
                        </span>
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Calendar Widget */}
        <div className="space-y-6">
          <Card className="p-6 rounded-[24px] border-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[15px] font-bold text-slate-900">Calendar</h2>
              <CalendarIcon className="w-4 h-4 text-slate-400" />
            </div>
            
            <div className="flex items-center justify-center gap-4 mb-6">
              <button className="p-1 hover:bg-slate-100 rounded-lg transition-colors"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
              <span className="text-xs font-bold text-slate-900 w-24 text-center">{currentMonthName}</span>
              <button className="p-1 hover:bg-slate-100 rounded-lg transition-colors"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
            </div>

            <div className="grid grid-cols-7 gap-y-4 gap-x-1 text-center">
              {/* Days Header */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{day}</div>
              ))}
              
              {/* Dates */}
              {calendarDays.map((date, idx) => (
                <div key={idx} className="flex justify-center">
                  {date ? (
                    <div className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold cursor-pointer transition-colors ${date === today.getDate() ? 'bg-indigo-500 text-white shadow-md shadow-indigo-200' : 'text-slate-700 hover:bg-slate-100'}`}>
                      {date.toString().padStart(2, '0')}
                    </div>
                  ) : (
                    <div className="w-8 h-8" />
                  )}
                </div>
              ))}
            </div>
          </Card>

          {metrics.current_token && (
            <Card className="p-6 rounded-[24px] border border-emerald-100 bg-emerald-50/50 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[13px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Current Patient
                </h3>
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                  #{metrics.current_token.token_number}
                </div>
              </div>
              <div className="mb-5">
                <p className="text-lg font-bold text-slate-900">{metrics.current_token.patient_name}</p>
                <p className="text-sm font-medium text-slate-500 capitalize">{metrics.current_token.status.replace('_', ' ')}</p>
              </div>
              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-transparent shadow-sm"
                onClick={() => void markSeen(metrics.current_token!.id)}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Seen
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* Slide-out Drawer */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSelectedPatient(null)}
          />
          
          {/* Drawer Panel */}
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selectedPatient.patient_name}</h2>
                <p className="text-sm text-slate-500">
                  {selectedPatient.age ? `${selectedPatient.age} years` : 'Age N/A'} • {selectedPatient.gender || 'Unspecified'}
                </p>
              </div>
              <button 
                onClick={() => setSelectedPatient(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* Visit Details */}
              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider">
                  <Activity className="w-4 h-4 text-slate-500" /> Current Visit
                </h3>
                <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100">
                  <div>
                    <span className="text-xs text-slate-500 block">Reason</span>
                    <p className="text-sm font-medium">{selectedPatient.reason || 'None provided'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Last Visit</span>
                    <p className="text-sm font-medium">
                      {selectedPatient.last_visit 
                        ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(selectedPatient.last_visit))
                        : 'First visit'}
                    </p>
                  </div>
                </div>
              </section>

              {/* AI Findings */}
              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-amber-500" /> AI Clinical Summary
                </h3>
                {loadingSummaries ? (
                  <div className="flex justify-center p-8">
                    <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : aiSummaries.length > 0 ? (
                  <div className="space-y-3">
                    {aiSummaries.map(summary => (
                      <div key={summary.id} className="p-4 rounded-xl border border-amber-100 bg-amber-50/30 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {summary.summary_text}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic p-4 bg-slate-50 rounded-xl border border-slate-100">
                    No recent AI findings recorded for this patient.
                  </p>
                )}
              </section>

            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <Link to="/app/patients">
                <Button variant="secondary" className="w-full justify-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Open Full Chart
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
