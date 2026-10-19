import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Plus, Search } from 'lucide-react'
import { searchPatients, type PatientOption } from '../../lib/appointments'

/** Pick a patient by searching name or phone on the server (the directory can be far larger than one page). */
export function PatientPicker({ value, onChange, onAddNew }: {
  value: PatientOption | null
  onChange: (patient: PatientOption) => void
  onAddNew: () => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<PatientOption[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    const t = setTimeout(() => {
      searchPatients(search.trim())
        .then((rows) => { if (!cancelled) setResults(rows) })
        .catch(() => { if (!cancelled) setResults([]) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [open, search])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full !min-h-0 items-center justify-between rounded-xl border border-slate-300 bg-white px-3 text-left text-sm"
      >
        <span className={value ? 'text-slate-900' : 'text-slate-500'}>
          {value ? `${value.full_name}${value.phone ? ` · ${value.phone}` : ''}` : 'Search patient by name or phone…'}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="relative border-b border-slate-100 p-2">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              type="text"
              placeholder="Type a name or phone number"
              className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 text-sm outline-none focus:border-slate-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loading && results.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-slate-500">Searching…</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-slate-500">No matching patients.</p>
            ) : results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p); setOpen(false); setSearch('') }}
                className={`flex w-full !min-h-0 items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ${value?.id === p.id ? 'bg-slate-50 font-medium' : ''}`}
              >
                <span className="text-slate-900">{p.full_name}</span>
                {p.phone && <span className="text-xs text-slate-500">{p.phone}</span>}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100 p-2">
            <button
              type="button"
              onClick={() => { onAddNew(); setOpen(false); setSearch('') }}
              className="flex w-full !min-h-0 items-center justify-center gap-2 rounded-lg bg-slate-50 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" /> New patient
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
