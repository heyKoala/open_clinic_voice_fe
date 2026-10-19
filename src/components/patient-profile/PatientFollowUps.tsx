import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { api } from '../../lib/api'

type FollowUp = {
  id: number
  scheduled_for: string
  method: string
  status: string
  notes: string
  outcome: string
  doctor_name?: string
}

const METHOD: Record<string, string> = { phone: 'Call', whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email' }

/** Follow-ups a doctor asked for after this patient's visits (recorded on the Visits page). */
export function PatientFollowUps({ patientId }: { patientId: number }) {
  const [items, setItems] = useState<FollowUp[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setItems(null)
    api.get('/followups/followups/', { params: { patient: patientId, ordering: '-scheduled_for', page_size: 20 } })
      .then((r) => { if (!cancelled) setItems(Array.isArray(r.data) ? r.data : (r.data?.results ?? [])) })
      .catch(() => { if (!cancelled) setItems([]) })
    return () => { cancelled = true }
  }, [patientId])

  if (!items || items.length === 0) return null
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-6 py-4">
        <h3 className="text-sm font-bold text-slate-900">Follow-ups</h3>
        <p className="text-xs text-slate-500">What the doctor asked the desk to do after a visit.</p>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-sm">
            <div>
              <p className="font-medium text-slate-900">{format(new Date(f.scheduled_for), 'EEE d MMM yyyy, h:mm a')} · {METHOD[f.method] ?? f.method}{f.doctor_name ? ` · Dr. ${f.doctor_name}` : ''}</p>
              {f.notes && <p className="text-xs text-slate-500">{f.notes}</p>}
              {f.outcome && <p className="text-xs text-emerald-700">Outcome: {f.outcome}</p>}
            </div>
            <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
              f.status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : f.status === 'failed' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              {f.status === 'completed' ? 'Done' : f.status === 'failed' ? 'Could not reach' : 'Pending'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
