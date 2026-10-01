import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../shadcn/dialog'
import { Input } from '../shadcn/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../shadcn/select'
import { Button } from '../shadcn/button'
import { PhoneInput } from '../ui/PhoneInput'
import { api } from '../../lib/api'
import { useUIStore } from '../../store/uistore'

interface PatientFormDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (patientId: number) => void
  patient?: any
}

export function PatientFormDialog({ isOpen, onOpenChange, onSuccess, patient }: PatientFormDialogProps) {
  const { addToast } = useUIStore()
  const [phoneDialCode, setPhoneDialCode] = useState('+91')
  const [patientError, setPatientError] = useState('')
  const [newPatientDraft, setNewPatientDraft] = useState({
    full_name: '',
    phone_number: '',
    preferred_language: 'English',
    date_of_birth: '',
    gender: 'unspecified',
    blood_group: 'unknown',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    allergies: '',
    medications: '',
    illnesses: '',
    surgeries: ''
  })
  
  React.useEffect(() => {
    if (patient && isOpen) {
      setNewPatientDraft({
        full_name: patient.full_name || '',
        phone_number: patient.phone ? patient.phone.replace('+91', '') : '',
        preferred_language: patient.preferred_language || 'English',
        date_of_birth: patient.date_of_birth || '',
        gender: patient.gender || 'unspecified',
        blood_group: patient.blood_group || 'unknown',
        emergency_contact_name: patient.emergency_contact_name || '',
        emergency_contact_phone: patient.emergency_contact_phone || '',
        allergies: '', medications: '', illnesses: '', surgeries: ''
      })
      if (patient.phone && patient.phone.startsWith('+91')) {
        setPhoneDialCode('+91')
      }
    }
  }, [patient, isOpen])

  const createPatient = async (e: React.FormEvent) => {
    e.preventDefault()
    setPatientError('')
    if (!newPatientDraft.full_name.trim() || !newPatientDraft.phone_number.trim()) {
      setPatientError('Please fill in all required fields.')
      return
    }

    try {
      const fullPhone = `${phoneDialCode}${newPatientDraft.phone_number}`
      const payload = {
        full_name: newPatientDraft.full_name,
        phone: fullPhone,
        preferred_language: newPatientDraft.preferred_language || 'en',
        date_of_birth: newPatientDraft.date_of_birth || null,
        gender: newPatientDraft.gender,
        blood_group: newPatientDraft.blood_group,
        emergency_contact_name: newPatientDraft.emergency_contact_name,
        emergency_contact_phone: newPatientDraft.emergency_contact_phone
      }

      const res = patient ? await api.put(`/patients/${patient.id}/`, payload) : await api.post('/patients/', payload)
      const patientId = res.data.id

      // Save structured health records if filled
      const records = []
      if (newPatientDraft.allergies.trim()) {
        records.push(api.post('/clinical/health-records/', { patient: patientId, category: 'allergy', name: 'Reported Allergies', details: newPatientDraft.allergies }))
      }
      if (newPatientDraft.medications.trim()) {
        records.push(api.post('/clinical/health-records/', { patient: patientId, category: 'medication', name: 'Current Medications', details: newPatientDraft.medications }))
      }
      if (newPatientDraft.illnesses.trim()) {
        records.push(api.post('/clinical/health-records/', { patient: patientId, category: 'condition', name: 'Past Illnesses', details: newPatientDraft.illnesses }))
      }
      if (newPatientDraft.surgeries.trim()) {
        records.push(api.post('/clinical/health-records/', { patient: patientId, category: 'procedure', name: 'Past Surgeries', details: newPatientDraft.surgeries }))
      }

      if (records.length > 0) {
        await Promise.all(records)
      }

      addToast('Patient and clinical intake saved successfully', 'success')
      
      onOpenChange(false)
      setNewPatientDraft({ 
        full_name: '', phone_number: '', preferred_language: 'English', date_of_birth: '', 
        gender: 'unspecified', blood_group: 'unknown', emergency_contact_name: '', emergency_contact_phone: '', 
        allergies: '', medications: '', illnesses: '', surgeries: '' 
      })
      
      onSuccess(patientId)

    } catch (err: any) {
      console.error(err)
      setPatientError(err.response?.data?.error || 'Failed to create patient.')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add new patient</DialogTitle>
        </DialogHeader>
        <form className="space-y-6 mt-2" onSubmit={createPatient}>
          
          {/* Section 1: Basic Info */}
          <div>
            <h3 className="text-md font-semibold text-slate-900 border-b pb-2 mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Full Name *</label>
                <Input 
                  placeholder="e.g. Priya Sharma" 
                  value={newPatientDraft.full_name} 
                  onChange={(e) => setNewPatientDraft((curr) => ({ ...curr, full_name: e.target.value }))} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Phone Number *</label>
                <PhoneInput
                  dialCode={phoneDialCode}
                  number={newPatientDraft.phone_number}
                  onDialCodeChange={setPhoneDialCode}
                  onNumberChange={(n: string) => setNewPatientDraft((curr) => ({ ...curr, phone_number: n }))}
                  placeholder="98765 43210"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Date of Birth</label>
                <Input type="date" value={newPatientDraft.date_of_birth} onChange={(e) => setNewPatientDraft(curr => ({...curr, date_of_birth: e.target.value}))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Gender</label>
                <Select value={newPatientDraft.gender} onValueChange={(val) => setNewPatientDraft((curr) => ({ ...curr, gender: val || "unspecified" }))}>
                  <SelectTrigger><SelectValue placeholder="Select Gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unspecified">Unspecified</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Preferred Language</label>
                <Select value={newPatientDraft.preferred_language} onValueChange={(val) => setNewPatientDraft((curr) => ({ ...curr, preferred_language: val || "" }))}>
                  <SelectTrigger><SelectValue placeholder="Preferred Language" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Hindi">Hindi</SelectItem>
                    <SelectItem value="Kannada">Kannada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Section 2: Additional Details */}
          <div>
            <h3 className="text-md font-semibold text-slate-900 border-b pb-2 mb-4">Additional Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Blood Group</label>
                <Select value={newPatientDraft.blood_group} onValueChange={(val) => setNewPatientDraft((curr) => ({ ...curr, blood_group: val || "unknown" }))}>
                  <SelectTrigger><SelectValue placeholder="Select Blood Group" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Unknown</SelectItem>
                    <SelectItem value="A+">A+</SelectItem><SelectItem value="A-">A-</SelectItem>
                    <SelectItem value="B+">B+</SelectItem><SelectItem value="B-">B-</SelectItem>
                    <SelectItem value="O+">O+</SelectItem><SelectItem value="O-">O-</SelectItem>
                    <SelectItem value="AB+">AB+</SelectItem><SelectItem value="AB-">AB-</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Emergency Contact Name</label>
                <Input placeholder="e.g. Rahul Sharma" value={newPatientDraft.emergency_contact_name} onChange={e => setNewPatientDraft(curr => ({...curr, emergency_contact_name: e.target.value}))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Emergency Contact Phone</label>
                <Input placeholder="98765 43210" value={newPatientDraft.emergency_contact_phone} onChange={e => setNewPatientDraft(curr => ({...curr, emergency_contact_phone: e.target.value}))} />
              </div>
            </div>
          </div>

          {/* Section 3: Clinical Intake */}
          <div>
            <h3 className="text-md font-semibold text-slate-900 border-b pb-2 mb-4">Clinical Intake</h3>
            <p className="text-xs text-slate-500 mb-4">Reason for visit will be captured when booking an appointment.</p>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Allergies (Foods, Drugs, etc.)</label>
                <textarea className="flex min-h-[60px] w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900" placeholder="List any known allergies..." value={newPatientDraft.allergies} onChange={e => setNewPatientDraft(curr => ({...curr, allergies: e.target.value}))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Current Medications & Dosages</label>
                <textarea className="flex min-h-[60px] w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900" placeholder="List medications..." value={newPatientDraft.medications} onChange={e => setNewPatientDraft(curr => ({...curr, medications: e.target.value}))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Past Illnesses or Medical Conditions</label>
                <textarea className="flex min-h-[60px] w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900" placeholder="List chronic or past illnesses..." value={newPatientDraft.illnesses} onChange={e => setNewPatientDraft(curr => ({...curr, illnesses: e.target.value}))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Past Surgeries or Procedures</label>
                <textarea className="flex min-h-[60px] w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900" placeholder="List major surgeries..." value={newPatientDraft.surgeries} onChange={e => setNewPatientDraft(curr => ({...curr, surgeries: e.target.value}))} />
              </div>
            </div>
          </div>
          
          {patientError && <p className="text-sm text-red-600 font-medium">{patientError}</p>}
          
          <div className="pt-4 pb-2 sticky bottom-0 bg-white border-t mt-6">
            <Button variant="default" type="submit" className="w-full justify-center bg-slate-900 text-white shadow-sm hover:bg-slate-800">
              Create patient
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
