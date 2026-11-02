import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, PhoneIncoming, PhoneOutgoing, Search } from 'lucide-react'
import { format } from 'date-fns'
import { formatPhone } from '../../lib/phone'
import {
  OUTCOMES, SENTIMENTS, callerSilent, formatDuration, getCallLogs, languageLabel, outcomeMeta, outcomeText, sentimentMeta,
  type CallKind, type CallLog, type CallLogQuery, type Paginated, type ReportFilters,
} from '../../lib/analytics'

const PAGE_SIZES = [10, 20, 50]
const EXPORT_LIMIT = 1000

/** The caller's sentiment as a coloured chip ("—" when not rated). */
export function SentimentBadge({ value }: { value?: string | null }) {
  const meta = sentimentMeta(value)
  if (!meta) return <span className="text-slate-400">—</span>
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  )
}

/** Marks a call made with the app's Test call button (left out of the analytics). */
/** Who the call was with when no patient record matches: the number, so the desk can still call back. */
export function CallerNumber({ phone, isTest }: { phone?: string; isTest: boolean }) {
  if (isTest) return <span className="font-normal text-slate-400">Staff test</span>
  const pretty = formatPhone(phone)
  if (!pretty) return <span className="font-normal text-slate-400">Number withheld</span>
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className="font-medium text-slate-900">{pretty}</span>
      <span className="text-[11px] font-normal text-slate-400">Not a registered patient</span>
    </span>
  )
}

export function TestCallBadge() {
  return (
    <span className="rounded border border-dashed border-violet-300 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
      Test call
    </span>
  )
}

/** Every call matching the filters, searchable and paged; a row opens the call at `${detailPath}/<id>`. */
export function CallLogsTable({ filters, detailPath, outcome, onOutcomeChange, showExport = true, sentiment: sentimentProp, onSentimentChange }: {
  filters: ReportFilters
  detailPath: string
  outcome: string
  onOutcomeChange: (outcome: string) => void
  /** CSV of the listed calls (Reports has its own Excel download instead). */
  showExport?: boolean
  /** Pass both to control the sentiment filter from outside (e.g. Reports' sentiment panel). */
  sentiment?: CallLogQuery['sentiment']
  onSentimentChange?: (sentiment: CallLogQuery['sentiment']) => void
}) {
  const [ownSentiment, setOwnSentiment] = useState<CallLogQuery['sentiment']>('')
  const sentiment = sentimentProp ?? ownSentiment
  const setSentiment = onSentimentChange ?? setOwnSentiment
  const navigate = useNavigate()
  const [data, setData] = useState<Paginated<CallLog> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<CallKind>('all')
  const [exporting, setExporting] = useState(false)

  // Typing waits 400 ms before searching.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  // Any change to what is shown starts again at page 1.
  const queryKey = JSON.stringify([filters, search, outcome, kind, sentiment, pageSize])
  const lastKey = useRef(queryKey)
  useEffect(() => {
    if (lastKey.current !== queryKey) {
      lastKey.current = queryKey
      setPage(1)
    }
  }, [queryKey])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    getCallLogs(filters, { page, pageSize, search, outcome, kind, sentiment })
      .then((res) => { if (!cancelled) setData(res) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filters, page, pageSize, search, outcome, kind, sentiment])

  const pages = data ? Math.max(1, Math.ceil(data.count / pageSize)) : 1

  const exportCsv = async () => {
    setExporting(true)
    try {
      const rows: CallLog[] = []
      for (let p = 1; rows.length < EXPORT_LIMIT; p++) {
        const res = await getCallLogs(filters, { page: p, pageSize: 100, search, outcome, kind, sentiment })
        rows.push(...res.results)
        if (!res.next) break
      }
      const quote = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
      const csv = [
        ['Date', 'Time', 'Patient', 'Direction', 'Language', 'Duration (s)', 'Outcome', 'Sentiment', 'Summary', 'Test call'].join(','),
        ...rows.map((l) => {
          const d = new Date(l.occurred_at)
          return [format(d, 'yyyy-MM-dd'), format(d, 'HH:mm:ss'), l.patient_name || 'Unknown', l.direction,
            languageLabel(l.language), l.duration_seconds, outcomeText(l.outcome), sentimentMeta(l.sentiment)?.label ?? '',
            l.summary || '', l.is_test ? 'Yes' : 'No'].map(quote).join(',')
        }),
      ].join('\n')
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
      link.download = `call_logs_${filters.start}_to_${filters.end}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
        <h3 className="text-base font-semibold text-slate-900">
          Call logs
          {data && <span className="ml-2 text-sm font-normal text-slate-500">({data.count.toLocaleString()} calls)</span>}
        </h3>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search transcript or outcome…"
              className="h-9 w-64 rounded-lg border border-slate-200 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <select
            aria-label="Outcome"
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
            value={outcome}
            onChange={(e) => onOutcomeChange(e.target.value)}
          >
            <option value="">All outcomes</option>
            {OUTCOMES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <select
            aria-label="Sentiment"
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
            value={sentiment}
            onChange={(e) => setSentiment(e.target.value as CallLogQuery['sentiment'])}
          >
            <option value="">All sentiments</option>
            {SENTIMENTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            <option value="none">Not rated</option>
          </select>
          <select
            aria-label="Calls"
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
            value={kind}
            onChange={(e) => setKind(e.target.value as CallKind)}
          >
            <option value="all">All calls</option>
            <option value="patients">Patient calls</option>
            <option value="tests">Test calls</option>
          </select>
          {showExport && (
            <button
              type="button"
              onClick={() => void exportCsv()}
              disabled={exporting || !data?.count}
              className="flex h-9 !min-h-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> {exporting ? 'Exporting…' : 'Export'}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Patient</th>
              <th className="px-4 py-3 font-semibold">Direction</th>
              <th className="px-4 py-3 font-semibold">Language</th>
              <th className="px-4 py-3 text-right font-semibold">Duration</th>
              <th className="px-4 py-3 font-semibold">Outcome</th>
              <th className="px-4 py-3 font-semibold">Sentiment</th>
              <th className="px-4 py-3 font-semibold">Doctor</th>
              <th className="px-4 py-3 font-semibold">Summary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !data ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">Loading calls…</td></tr>
            ) : error ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-red-600">Calls could not be loaded.</td></tr>
            ) : !data?.results.length ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">No calls match these filters.</td></tr>
            ) : (
              data.results.map((log) => {
                const meta = outcomeMeta(log.outcome)
                const Icon = log.direction === 'inbound' ? PhoneIncoming : PhoneOutgoing
                return (
                  <tr
                    key={log.id}
                    tabIndex={0}
                    onClick={() => navigate(`${detailPath}/${log.id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`${detailPath}/${log.id}`) }}
                    className={`cursor-pointer transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none ${loading ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3 text-slate-700">{format(new Date(log.occurred_at), 'd MMM yyyy, h:mm a')}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <span className="inline-flex items-center gap-2">
                        {log.patient_name || <CallerNumber phone={log.phone} isTest={!!log.is_test} />}
                        {log.is_test && <TestCallBadge />}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize text-slate-600">
                        <Icon className="h-3.5 w-3.5 text-slate-400" /> {log.direction}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{languageLabel(log.language)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">{log.duration_seconds ? formatDuration(log.duration_seconds) : '—'}</td>
                    <td className="px-4 py-3">
                      {outcomeText(log.outcome)
                        ? <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${meta.badge}`}>{outcomeText(log.outcome)}</span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3"><SentimentBadge value={callerSilent(log) ? '' : log.sentiment} /></td>
                    <td className="px-4 py-3 text-slate-600">{log.doctor_name ? `Dr. ${log.doctor_name}` : '—'}</td>
                    <td className="max-w-[320px] truncate px-4 py-3 text-slate-500">{(!callerSilent(log) && log.summary) || '—'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {data && data.count > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
          <label className="flex items-center gap-2">
            Rows
            <select className="h-8 rounded-md border border-slate-200 bg-white px-2" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <span>Page {page} of {pages}</span>
            <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="flex h-8 w-8 !min-h-0 items-center justify-center rounded-md border border-slate-200 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}
              className="flex h-8 w-8 !min-h-0 items-center justify-center rounded-md border border-slate-200 disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
