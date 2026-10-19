import { RotateCcw } from 'lucide-react'
import { DATE_PRESETS, LANGUAGE_OPTIONS, localDateKey, rangeForPreset, type ReportFilters } from '../../lib/analytics'

const selectClass =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10'

/** Date range (presets or custom), call direction, language and, when `doctors` is given, doctor. */
export function ReportFiltersBar({ filters, onChange, defaultPreset = '7d', doctors }: {
  filters: ReportFilters
  onChange: (next: ReportFilters) => void
  defaultPreset?: Exclude<ReportFilters['preset'], 'custom'>
  doctors?: { id: number; full_name: string }[]
}) {
  const today = localDateKey()
  const isDefault = filters.preset === defaultPreset && !filters.direction && !filters.language && !filters.doctor

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange({ ...filters, preset: p.value, ...rangeForPreset(p.value) })}
            className={`h-8 !min-h-0 rounded-lg px-3 text-xs font-semibold transition-colors ${filters.preset === p.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-500">
        <input
          type="date"
          aria-label="From"
          className={selectClass}
          value={filters.start}
          max={filters.end || today}
          onChange={(e) => e.target.value && onChange({ ...filters, preset: 'custom', start: e.target.value })}
        />
        <span>to</span>
        <input
          type="date"
          aria-label="To"
          className={selectClass}
          value={filters.end}
          min={filters.start}
          max={today}
          onChange={(e) => e.target.value && onChange({ ...filters, preset: 'custom', end: e.target.value })}
        />
      </div>

      <select
        aria-label="Direction"
        className={selectClass}
        value={filters.direction}
        onChange={(e) => onChange({ ...filters, direction: e.target.value as ReportFilters['direction'] })}
      >
        <option value="">All directions</option>
        <option value="inbound">Inbound</option>
        <option value="outbound">Outbound</option>
      </select>

      <select
        aria-label="Language"
        className={selectClass}
        value={filters.language}
        onChange={(e) => onChange({ ...filters, language: e.target.value })}
      >
        <option value="">All languages</option>
        {LANGUAGE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
      </select>

      {doctors && (
        <select
          aria-label="Doctor"
          className={selectClass}
          value={filters.doctor}
          onChange={(e) => onChange({ ...filters, doctor: e.target.value })}
        >
          <option value="">All doctors</option>
          {doctors.map((d) => <option key={d.id} value={d.id}>Dr. {d.full_name}</option>)}
        </select>
      )}

      {!isDefault && (
        <button
          type="button"
          onClick={() => onChange({ preset: defaultPreset, ...rangeForPreset(defaultPreset), direction: '', language: '', doctor: '' })}
          className="ml-auto flex h-9 !min-h-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      )}
    </div>
  )
}
