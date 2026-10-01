import { useState } from 'react'
import { Activity } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../shadcn/input'
import { Label } from '../shadcn/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../shadcn/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../shadcn/dialog'
import { api } from '../../lib/api'
import { useUIStore } from '../../store/uistore'

interface HealthRecord {
  id: number
  category: string
  name: string
  details: string
  start_date: string | null
  recorded_at: string
}

interface PatientClinicalHistoryProps {
  patientId: number
  healthRecords: HealthRecord[]
  onRefresh: () => void
}

export function PatientClinicalHistory({ patientId, healthRecords, onRefresh }: PatientClinicalHistoryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<HealthRecord | null>(null)
  
  const [category, setCategory] = useState('')
  const [name, setName] = useState('')
  const [details, setDetails] = useState('')
  const [startDate, setStartDate] = useState('')

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const handleSave = async () => {
    if (!category || !name) {
      useUIStore.getState().addToast('Category and Record Name are required.', 'error')
      return
    }

    setIsSaving(true)
    try {
      await api.post('/clinical/health-records/', {
        patient: patientId,
        category,
        name,
        details,
        start_date: startDate || null
      })
      useUIStore.getState().addToast('Clinical record added successfully.', 'success')
      setIsOpen(false)
      setCategory('')
      setName('')
      setDetails('')
      setStartDate('')
      onRefresh()
    } catch (err) {
      console.error(err)
      useUIStore.getState().addToast('Failed to add clinical record.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Clinical History</h3>
          <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => setIsOpen(true)}>Add Record</Button>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50/50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
            <tr>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Record Name</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {healthRecords.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-slate-500">No clinical history recorded yet.</td>
              </tr>
            ) : (
              healthRecords.map(record => (
                <tr 
                  key={record.id} 
                  className="hover:bg-slate-50 transition-colors cursor-pointer group"
                  onClick={() => setSelectedRecord(record)}
                >
                  <td className="px-5 py-3 text-slate-900 font-medium capitalize flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-blue-500" />
                    {record.category}
                  </td>
                  <td className="px-5 py-3 text-slate-700 font-medium">{record.name}</td>
                  <td className="px-5 py-3 text-slate-500 text-xs">{formatDate(record.start_date || record.recorded_at)}</td>
                  <td className="px-5 py-3 text-slate-600">
                    <div className="flex items-center justify-between gap-4">
                      <span className="truncate max-w-[200px]">{record.details || '—'}</span>
                      <span className="text-xs font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">View Details</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Clinical Record</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={category} onValueChange={(val) => setCategory(val || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allergy">Allergy</SelectItem>
                  <SelectItem value="medication">Medication</SelectItem>
                  <SelectItem value="condition">Condition</SelectItem>
                  <SelectItem value="procedure">Procedure</SelectItem>
                  <SelectItem value="immunization">Immunization</SelectItem>
                  <SelectItem value="vital">Vitals</SelectItem>
                  <SelectItem value="lab_result">Lab Result</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Record Name *</Label>
              <Input 
                placeholder="e.g. Penicillin, Type 2 Diabetes" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Details / Notes</Label>
              <Input 
                placeholder="Dosage, severity, outcome..." 
                value={details} 
                onChange={(e) => setDetails(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Onset Date</Label>
              <Input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              {selectedRecord?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Category</Label>
                <div className="font-semibold text-slate-900 capitalize mt-0.5">
                  {selectedRecord?.category.replace('_', ' ')}
                </div>
              </div>
              <div>
                <Label className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Date Recorded</Label>
                <div className="font-semibold text-slate-900 mt-0.5">
                  {formatDate(selectedRecord?.start_date || selectedRecord?.recorded_at)}
                </div>
              </div>
            </div>
            <div>
              <Label className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Full Details & Notes</Label>
              <div className="text-sm mt-1.5 p-3 bg-slate-50 border border-slate-100 rounded-lg text-slate-700 whitespace-pre-wrap leading-relaxed">
                {selectedRecord?.details || 'No additional details provided.'}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSelectedRecord(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
