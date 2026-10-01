import { Activity, Calendar, Phone, Mail } from 'lucide-react'
import { Card } from '../ui/Card'

interface PatientBasicInfoProps {
  patient: {
    gender: string
    date_of_birth: string | null
    phone: string
    email: string
  }
}

export function PatientBasicInfo({ patient }: PatientBasicInfoProps) {
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <Card className="p-5 border-slate-200 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 mb-5">Basic Informational</h3>
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="mt-0.5"><Activity className="h-4 w-4 text-slate-400" /></div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Gender</p>
            <p className="text-sm font-semibold text-slate-900 mt-0.5 capitalize">{patient.gender.replace('_', ' ') || 'Unspecified'}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="mt-0.5"><Calendar className="h-4 w-4 text-slate-400" /></div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Birthday</p>
            <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatDate(patient.date_of_birth)}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="mt-0.5"><Phone className="h-4 w-4 text-slate-400" /></div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Phone Number</p>
            <p className="text-sm font-semibold text-slate-900 mt-0.5">{patient.phone}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="mt-0.5"><Mail className="h-4 w-4 text-slate-400" /></div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Email</p>
            <p className="text-sm font-semibold text-slate-900 mt-0.5">{patient.email || '—'}</p>
          </div>
        </div>
      </div>
    </Card>
  )
}
