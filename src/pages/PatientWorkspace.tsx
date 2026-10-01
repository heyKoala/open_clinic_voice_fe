// @ts-nocheck
import { useRef, useState, useEffect } from 'react'
import { Search, Edit, Filter, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Input } from '../components/shadcn/input'
import { api } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/shadcn/select'

// Sub-components
import { PatientProfileHeader } from '../components/patient-profile/PatientProfileHeader'
import { PatientBasicInfo } from '../components/patient-profile/PatientBasicInfo'
import { PatientAppointmentTimeline } from '../components/patient-profile/PatientAppointmentTimeline'
import { PatientClinicalHistory } from '../components/patient-profile/PatientClinicalHistory'
import { PatientDocuments } from '../components/patient-profile/PatientDocuments'
import { PatientFormDialog } from '../components/patient-profile/PatientFormDialog'

// Types
type Patient = {
  id: number
  full_name: string
  date_of_birth: string | null
  gender: string
  phone: string
  email: string
  preferred_language: string
  created_at?: string
}

export default function PatientWorkspace({ canEdit = true }: { canEdit?: boolean }) {
  const [search, setSearch] = useState('')
  
  // Pagination & Filtering state
  const [page, setPage] = useState(1)
  
  const [ordering, setOrdering] = useState('-created_at')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [patients, setPatients] = useState<any[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 20
  const [loadingList, setLoadingList] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null)
  const [patient, setPatient] = useState<any>(null)
  const [appointments, setAppointments] = useState<any[]>([])
  const [healthRecords, setHealthRecords] = useState<any[]>([])
  const [attachments, setAttachments] = useState<any[]>([])
  const [filters, setFilters] = useState<any>({})
  const [loadingDetails, setLoadingDetails] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const fetchPatients = async () => {
    setLoadingList(true)
    try {
      const res = await api.get('/patients/', { 
        params: { 
          page, 
          page_size: pageSize,
          search: search || undefined,
          ordering: ordering || undefined,
          ...filters
        } 
      })
      const data = res.data.results || res.data
      setPatients(Array.isArray(data) ? data : [])
      if (res.data.count) {
        setTotalPages(Math.max(1, Math.ceil(res.data.count / pageSize)))
      } else {
        setTotalPages(1)
      }
    } catch (err) {
      console.error("Failed to fetch patients", err)
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    void fetchPatients()
  }, [page, search, ordering, filters])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setIsAddModalOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSearchChange = (val: string) => {
    setSearch(val)
    setPage(1)
  }

  const applyFilters = (newFilters: any) => {
    setFilters(newFilters)
    setPage(1)
    setIsFilterOpen(false)
  }

  const clearFilters = () => {
    setFilters({})
    setPage(1)
    setIsFilterOpen(false)
  }
  const handlePatientCreated = (patientId: number) => {
    setPage(1)
    void fetchPatients()
    setSelectedPatientId(patientId)
  }
  
  const fetchDetails = async () => {
    if (!selectedPatientId) return
    setLoadingDetails(true)
    try {
      const [ptRes, apptRes, hrRes, attRes] = await Promise.all([
        api.get(`/patients/${selectedPatientId}/`),
        api.get('/appointments/', { params: { patient: selectedPatientId } }),
        api.get('/clinical/health-records/', { params: { patient: selectedPatientId } }),
        api.get('/clinical/attachments/', { params: { patient: selectedPatientId } })
      ])
      setPatient(ptRes.data)
      setAppointments(apptRes.data.results || apptRes.data)
      setHealthRecords(hrRes.data.results || hrRes.data)
      setAttachments(attRes.data.results || attRes.data)
    } catch (err) {
      console.error("Failed to fetch patient details", err)
    } finally {
      setLoadingDetails(false)
    }
  }

  useEffect(() => {
    void fetchDetails()
  }, [selectedPatientId])

  const filteredPatients = patients

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="flex h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)] gap-6 overflow-hidden -mb-4 md:-mb-6 lg:-mb-8">
      
      {/* LEFT PANE: Patient Directory */}
      <div className="w-80 shrink-0 flex flex-col gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Patient Directory</h2>
            
            {canEdit && (
              <>
                <Button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex items-center justify-center rounded-md text-xs font-medium bg-slate-900 text-white shadow-sm hover:bg-slate-800 h-7 px-3"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Patient
                </Button>
                <PatientFormDialog 
                  isOpen={isAddModalOpen} 
                  onOpenChange={setIsAddModalOpen} 
                  onSuccess={handlePatientCreated} 
                />
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`p-1.5 rounded-lg border transition-colors ${isFilterOpen ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
              title="Toggle Filters"
            >
              <Filter className="h-4 w-4 text-slate-600" />
            </button>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                type="text" 
                placeholder="Search..." 
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8 h-8 w-36 bg-white text-xs border-slate-200"
              />
            </div>
          </div>
        </div>

        {isFilterOpen && (
          <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-3 shadow-sm relative">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Filters</span>
              <button onClick={clearFilters} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Clear All</button>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Gender</label>
              <select 
                className="w-full text-xs p-1.5 border border-slate-200 rounded-lg"
                value={filters.gender}
                onChange={e => applyFilters({...filters, gender: e.target.value})}
              >
                <option value="">Any</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Date of Birth</label>
              <div className="flex gap-2">
                <input 
                  type="date" 
                  className="w-full text-xs p-1.5 border border-slate-200 rounded-lg" 
                  value={filters.date_of_birth_after}
                  onChange={e => applyFilters({...filters, date_of_birth_after: e.target.value})}
                  title="From"
                />
                <input 
                  type="date" 
                  className="w-full text-xs p-1.5 border border-slate-200 rounded-lg" 
                  value={filters.date_of_birth_before}
                  onChange={e => applyFilters({...filters, date_of_birth_before: e.target.value})}
                  title="To"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Registered</label>
              <div className="flex gap-2">
                <input 
                  type="date" 
                  className="w-full text-xs p-1.5 border border-slate-200 rounded-lg" 
                  value={filters.created_at_after}
                  onChange={e => applyFilters({...filters, created_at_after: e.target.value})}
                  title="From"
                />
                <input 
                  type="date" 
                  className="w-full text-xs p-1.5 border border-slate-200 rounded-lg" 
                  value={filters.created_at_before}
                  onChange={e => applyFilters({...filters, created_at_before: e.target.value})}
                  title="To"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Disease Type</label>
              <input 
                type="text" 
                placeholder="e.g. Diabetes, Hypertension..."
                className="w-full text-xs p-1.5 border border-slate-200 rounded-lg" 
                value={filters.disease}
                onChange={e => applyFilters({...filters, disease: e.target.value})}
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Last Visit Date</label>
              <div className="flex gap-2">
                <input 
                  type="date" 
                  className="w-full text-xs p-1.5 border border-slate-200 rounded-lg" 
                  value={filters.last_visit_after}
                  onChange={e => applyFilters({...filters, last_visit_after: e.target.value})}
                  title="From"
                />
                <input 
                  type="date" 
                  className="w-full text-xs p-1.5 border border-slate-200 rounded-lg" 
                  value={filters.last_visit_before}
                  onChange={e => applyFilters({...filters, last_visit_before: e.target.value})}
                  title="To"
                />
              </div>
            </div>
            
          </div>
        )}

        <div className="flex items-center gap-2">
          <select 
            className="w-full bg-white text-xs border border-slate-200 rounded-lg p-2 text-slate-700 outline-none focus:border-blue-300 transition-colors"
            value={ordering}
            onChange={(e) => { setOrdering(e.target.value); setPage(1); }}
          >
            <option value="-created_at">Newest First</option>
            <option value="created_at">Oldest First</option>
            <option value="full_name">Name (A-Z)</option>
            <option value="-full_name">Name (Z-A)</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
          {loadingList ? (
            <p className="text-sm text-slate-500 text-center py-4">Loading directory...</p>
          ) : filteredPatients.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No patients found.</p>
          ) : (
            filteredPatients.map((pt: any) => (
              <button
                key={pt.id}
                onClick={() => setSelectedPatientId(pt.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  selectedPatientId === pt.id 
                    ? 'bg-blue-50/50 border-blue-200 shadow-sm ring-1 ring-blue-500/10' 
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-200 flex flex-shrink-0 items-center justify-center overflow-hidden border border-white shadow-sm">
                      <span className="text-sm font-bold text-slate-500">
                        {pt.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${selectedPatientId === pt.id ? 'text-blue-900' : 'text-slate-900'}`}>
                        {pt.full_name}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Register: {formatDate(pt.created_at)}</p>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="text-slate-400">
                      <Edit className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 mt-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-slate-500">
              Page {page} of {totalPages}
            </span>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* RIGHT PANE: Patient Details */}
      <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin">
        {!selectedPatientId ? (
          <div className="flex h-full items-center justify-center bg-slate-50/50 border border-slate-200 rounded-2xl border-dashed">
            <p className="text-slate-500 font-medium">Select a patient from the directory to view details.</p>
          </div>
        ) : loadingDetails || !patient ? (
          <div className="flex h-full items-center justify-center bg-slate-50/50 border border-slate-200 rounded-2xl">
            <p className="text-slate-500 font-medium">Loading patient profile...</p>
          </div>
        ) : (
          <div className="space-y-6 pb-6 pr-4">
            <PatientProfileHeader patient={patient} canEdit={canEdit} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PatientBasicInfo patient={patient} />
              <PatientAppointmentTimeline appointments={appointments} />
            </div>
            <PatientClinicalHistory 
              patientId={patient.id} 
              healthRecords={healthRecords} 
              onRefresh={fetchDetails} 
            />
            <PatientDocuments 
              patientId={patient.id} 
              attachments={attachments} 
              onRefresh={fetchDetails} 
            />
          </div>
        )}
      </div>
      
    </div>
  )
}
