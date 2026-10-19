import { useState } from 'react'
import { CallLogsTable } from '../components/analytics/CallLogsTable'
import { ReportFiltersBar } from '../components/analytics/ReportFiltersBar'
import { useReportFilters } from '../hooks/useReportFilters'

/** Every AI call for the front desk: filter, search, and open a call for its recording and transcript. */
export default function CallLogs({ detailPath }: { detailPath: string }) {
  const [filters, setFilters] = useReportFilters()
  const [outcome, setOutcome] = useState('')

  return (
    <div className="max-w-[1400px] space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Call logs</h1>
        <p className="mt-0.5 text-sm text-slate-500">Every call the AI receptionist handled, with its recording, summary and transcript.</p>
      </div>
      <ReportFiltersBar filters={filters} onChange={setFilters} />
      <CallLogsTable filters={filters} detailPath={detailPath} outcome={outcome} onOutcomeChange={setOutcome} />
    </div>
  )
}
