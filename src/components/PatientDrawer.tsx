import { useUIStore } from '../store/uistore'
import { Button } from "./ui/Button"; import { Card } from "./ui/Card";
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from './shadcn/sheet'

export default function PatientDrawer() {
  const { selectedPatient, setSelectedPatientId, setSelectedPatient } = useUIStore()
  const [patientData, setPatientData] = useState<any>(null)
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Fetch patient details when selectedPatient changes
  useEffect(() => {
    if (!selectedPatient) {
      setPatientData(null)
      return
    }
    // If we already have data for this ID, we can skip fetching (optional)
    // For simplicity, we always fetch when selectedPatient changes
    const fetchPatient = async () => {
      try {
        const res = await api.get(`/patients/${selectedPatient.id}/`)
        setPatientData(res.data)
        setNotes(res.data.notes || '')
      } catch (err: any) {
        console.error('Failed to fetch patient', err)
      }
    }
    fetchPatient()
  }, [selectedPatient]) // only depend on selectedPatient

  if (!selectedPatient) return null

  const closeDrawer = () => {
    setSelectedPatientId(null)
    setSelectedPatient(null)
  }

  const saveNotes = async () => {
    if (!patientData) return
    setIsSaving(true)
    try {
      await api.patch(`/patients/${selectedPatient.id}/`, { notes })
      setPatientData({ ...patientData, notes })
      useUIStore.getState().addToast('Patient notes saved successfully', 'success')
    } catch (err) {
      useUIStore.getState().addToast('Failed to save notes', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const patient = patientData ?? selectedPatient

  return (
    <Sheet open={!!selectedPatient} onOpenChange={(open) => { if (!open) closeDrawer() }}>
      <SheetContent side="right" className="w-full max-w-lg sm:max-w-lg overflow-y-auto p-0 flex flex-col">
        <SheetHeader className="border-b border-slate-100 px-6 py-4">
          <SheetTitle className="text-xl font-bold">{patient.full_name}</SheetTitle>
          <SheetDescription className="text-sm text-slate-500">
            {patient.date_of_birth ? (
              `${calculateAge(patient.date_of_birth)} ${
                patient.gender === 'male' ? 'M' : patient.gender === 'female' ? 'F' : 'O'
              }`
            ) : 'Age unknown'}
            • {patient.preferred_language}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-6 pb-6">

        <div className="flex flex-wrap gap-2 py-4">
          <Button variant="default">Book appointment</Button>
          <Button>Initiate AI call</Button>
          <Button>Edit</Button>
        </div>

        <div className="grid grid-cols-3 gap-3 pb-6">
          {[['Visits', '--'], ['Doctors', '--'], ['Last visit', '--']].map(
            ([label, value]) => (
              <Card key={label} className="p-3 text-center">
                <span className="text-[10px] font-semibold uppercase text-slate-400">{label}</span>
                <p className="pt-1 text-lg font-bold">{value}</p>
              </Card>
            )
          )}
        </div>

        <div className="space-y-6">
          <div className="border-t pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Medical History & Notes
            </h3>
            <textarea
              className="w-full min-h-[100px] rounded-xl border border-slate-300 p-3 text-sm focus:border-slate-400 focus:ring-0"
              placeholder="e.g. Diagnosed with Type 2 Diabetes, prescribed Metformin 500mg..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="default" onClick={saveNotes} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Notes'}
              </Button>
            </div>
          </div>
          {/* Placeholder for timelines */}
          <div className="border-t pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Appointments
            </h3>
            <div className="space-y-2">
              {/* Example entry */}
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 h-2 w-2 rounded-full bg-blue-500" />
                <div>
                  <p className="text-sm font-medium">Doctor</p>
                  <p className="text-xs text-slate-500">Date • Time</p>
                </div>
                <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-800">
                  Status
                </span>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Follow-ups
            </h3>
            <div className="space-y-2">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 h-2 w-2 rounded-full bg-green-500" />
                <div>
                  <p className="text-sm font-medium">Follow-up description</p>
                  <p className="text-xs text-slate-500">Due date</p>
                </div>
                <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-800">
                  Status
                </span>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Calls
            </h3>
            <div className="space-y-2">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 h-2 w-2 rounded-full bg-purple-500" />
                <div>
                  <p className="text-sm font-medium">Call type</p>
                  <p className="text-xs text-slate-500">Duration</p>
                </div>
                <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-800">
                  Outcome
                </span>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Billing
            </h3>
            <div className="space-y-2">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 h-2 w-2" />
                <div>
                  <p className="text-sm font-medium">Invoice • Description</p>
                  <p className="text-xs text-slate-500">Amount</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Helper to calculate age from date string (YYYY-MM-DD)
function calculateAge(dateString: string): number {
  const today = new Date()
  const birth = new Date(dateString)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

