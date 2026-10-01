import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useUIStore } from '../store/uistore'
import { api } from '../lib/api'
import { useEffect, useState } from 'react'

export default function Patients() {
  const { setSelectedPatientId, setSelectedPatient } = useUIStore()
  const [patients, setPatients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true)
        const response = await api.get('/patients/', {
          params: { page_size: 100 } // adjust as needed
        })
        // Assuming paginated response: { results: [...], count, ... }
        const data = response.data.results ?? response.data
        setPatients(Array.isArray(data) ? data : [])
        setError(null)
      } catch (err: any) {
        console.error('Failed to fetch patients', err)
        setError('Failed to load patients')
      } finally {
        setLoading(false)
      }
    }

    fetchPatients()
  }, [])

  const handleSelect = (patient: any) => {
    setSelectedPatientId(patient.id)
    setSelectedPatient(patient)
  }

  if (loading) return <div className="flex h-[200px] items-center justify-center">Loading...</div>
  if (error) return <div className="p-4 text-red-600">{error}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Patients</h1>
          <p className="text-sm text-slate-500">Click a patient for full history.</p>
        </div>
        <Button variant="default" onClick={() => alert('New patient form not implemented yet')}>
          New patient
        </Button>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              {[['Patient', 'ABHA', 'Conditions', 'Last visit', 'Next', 'LTV', 'Dues']].map(([h]) => (
                <th key={h} className="px-5 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patients.map((p) => {
              const dob = p.date_of_birth ? new Date(p.date_of_birth) : null
              const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null
              const genderLabel = p.gender === 'male' ? 'M' : p.gender === 'female' ? 'F' : 'O'
              const ageGender = age !== null ? `${age}${genderLabel}` : 'N/A'
              // const abha = p.abha_number ?? '—'
              const conditions = p.notes ?? '—'
              // Placeholder for last visit, next appointment, LTV, dues
              return (
                <tr
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-5 py-3">
                    <p className="font-bold">{p.full_name}</p>
                    <p className="text-xs text-slate-500">{ageGender}</p>
                  </td>
                  {/*<td className="px-5 py-3 text-slate-600">{abha}</td>*/}
                  <td className="px-5 py-3">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                      {conditions}
                    </span>
                  </td>
                  <td className="px-5 py-3">—</td>
                  <td className="px-5 py-3">—</td>
                  <td className="px-5 py-3 font-bold">—</td>
                  <td className="px-5 py-3 font-semibold text-amber-600">—</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
