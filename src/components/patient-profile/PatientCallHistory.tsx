import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { PhoneIncoming, PhoneOutgoing } from 'lucide-react'
import { api } from '../../lib/api'
import { formatDuration, outcomeText, type CallLog, type Paginated } from '../../lib/analytics'
import { SentimentBadge, TestCallBadge } from '../analytics/CallLogsTable'

/**
 * Every call with this patient: calls they made to the AI receptionist and calls the AI made to them.
 * Matched by phone number, so calls filed under the patient's record at another centre are included.
 */
export function PatientCallHistory({ patientId, phone, detailPath }: {
  patientId: number
  phone?: string
  /** A call opens at `${detailPath}/<id>`; omit to show the list without links. */
  detailPath?: string
}) {
  const [calls, setCalls] = useState<CallLog[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setCalls(null); setError('')
    const params: Record<string, string | number> = { ordering: '-occurred_at', page_size: 50 }
    if (phone && phone.replace(/\D/g, '').length >= 7) params.phone = phone
    else params.patient = patientId
    api.get<Paginated<CallLog>>('/ai/call-logs/', { params })
      .then((r) => { if (!cancelled) setCalls(r.data.results ?? []) })
      .catch(() => { if (!cancelled) { setCalls([]); setError('Call history could not be loaded.') } })
    return () => { cancelled = true }
  }, [patientId, phone])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Call history</h3>
          <p className="text-xs text-slate-500">Calls this patient made to the AI receptionist, and calls the AI made to them.</p>
        </div>
        {calls && <span className="text-xs text-slate-500">{calls.length} call{calls.length === 1 ? '' : 's'}</span>}
      </div>

      {error && <p className="px-6 py-3 text-sm text-red-700">{error}</p>}
      {calls === null ? (
        <p className="px-6 py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : calls.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-slate-500">No calls with this patient yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">When</th>
                <th className="px-4 py-3 text-left font-semibold">Call</th>
                <th className="px-4 py-3 text-left font-semibold">What happened</th>
                <th className="px-4 py-3 text-left font-semibold">Length</th>
                <th className="px-4 py-3 text-left font-semibold">Caller mood</th>
                {detailPath && <th className="px-4 py-3 text-right font-semibold">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calls.map((c) => {
                const incoming = c.direction !== 'outbound'
                const when = new Date(c.occurred_at)
                return (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="px-6 py-3 whitespace-nowrap">
                      <p className="font-medium text-slate-900">{format(when, 'd MMM yyyy')}</p>
                      <p className="text-xs text-slate-500">{format(when, 'h:mm a')}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-slate-700">
                        {incoming ? <PhoneIncoming className="h-4 w-4 text-emerald-600" /> : <PhoneOutgoing className="h-4 w-4 text-sky-600" />}
                        {incoming ? 'Patient called' : 'AI called patient'}
                      </span>
                      {c.is_test && <span className="ml-2"><TestCallBadge /></span>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-900">{outcomeText(c.outcome) || <span className="text-slate-400">—</span>}</p>
                      {c.summary && <p className="max-w-md truncate text-xs text-slate-500" title={c.summary}>{c.summary}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{c.duration_seconds ? formatDuration(c.duration_seconds) : '—'}</td>
                    <td className="px-4 py-3"><SentimentBadge value={c.sentiment} /></td>
                    {detailPath && (
                      <td className="px-4 py-3 text-right">
                        <Link to={`${detailPath}/${c.id}`} className="text-sm font-medium text-cyan-700 hover:underline">Open</Link>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
