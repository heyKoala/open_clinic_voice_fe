import { useState } from 'react'
import { Mail, Phone, Video, Edit, Activity } from 'lucide-react'
import { Button } from '../ui/Button'
import { PatientFormDialog } from './PatientFormDialog'

interface PatientProfileHeaderProps {
  patient: {
    id: number
    full_name: string
    created_at?: string
    email?: string
    phone?: string
    date_of_birth?: string | null
    gender?: string
    preferred_language?: string
  }
  onRefresh?: () => Promise<void>
  canEdit?: boolean
}

export function PatientProfileHeader({ patient, onRefresh, canEdit = true }: PatientProfileHeaderProps) {
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const [isEditing, setIsEditing] = useState(false)

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-slate-200 flex shrink-0 items-center justify-center overflow-hidden border-2 border-white shadow-md">
          <span className="text-2xl font-bold text-slate-500">
            {patient.full_name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{patient.full_name}</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-green-100 text-green-700 border border-green-200">Member</span>
          </div>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Joined Since: {formatDate(patient.created_at)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a href={patient.email ? `mailto:${patient.email}` : '#'} onClick={(e) => !patient.email && e.preventDefault()}>
          <Button variant="secondary" size="icon" className="h-9 w-9 rounded-lg opacity-80 hover:opacity-100" disabled={!patient.email}>
            <Mail className="h-4 w-4 text-slate-600" />
          </Button>
        </a>
        <a href={patient.phone ? `tel:${patient.phone}` : '#'} onClick={(e) => !patient.phone && e.preventDefault()}>
          <Button variant="secondary" size="icon" className="h-9 w-9 rounded-lg opacity-80 hover:opacity-100" disabled={!patient.phone}>
            <Phone className="h-4 w-4 text-slate-600" />
          </Button>
        </a>
        <Button variant="secondary" size="icon" className="h-9 w-9 rounded-lg opacity-50 cursor-not-allowed" title="Coming Soon">
          <Video className="h-4 w-4 text-slate-600" />
        </Button>
        
        {canEdit && (
          <>
            <Button variant="secondary" size="icon" className="h-9 w-9 rounded-lg ml-2" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 text-slate-600" />
            </Button>
            <PatientFormDialog 
              isOpen={isEditing} 
              onOpenChange={setIsEditing} 
              patient={patient} 
              onSuccess={async () => {
                if (onRefresh) await onRefresh()
              }} 
            />
          </>
        )}
      </div>
    </div>
  )
}
