/**
 * A 100% stacked bar with a legend that prints every count and share (from hkvoice's Analytics page):
 * easier to read than a donut once there are more than a few parts, and nothing hides behind a hover.
 */
export type BreakdownDatum = { name: string; label: string; value: number; fill: string }

export function BreakdownBar({ data, emptyLabel = 'No calls in this period', onSelect, compact = false }: {
  data: BreakdownDatum[]
  emptyLabel?: string
  /** One legend column, for narrow panels. */
  compact?: boolean
  /** Makes each legend row a button, e.g. to filter the call list by that part. */
  onSelect?: (name: string) => void
}) {
  const shown = data.filter((d) => d.value > 0)
  const total = shown.reduce((sum, d) => sum + d.value, 0)

  if (!total) {
    return <div className="flex h-[140px] items-center justify-center text-sm text-slate-400">{emptyLabel}</div>
  }

  const pct = (v: number) => (v / total) * 100

  return (
    <div className="space-y-4">
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={shown.map((d) => `${d.label}: ${d.value} (${Math.round(pct(d.value))}%)`).join(', ')}
      >
        {shown.map((d) => (
          <div key={d.name} className="h-full" style={{ width: `${pct(d.value)}%`, backgroundColor: d.fill }} title={`${d.label}: ${d.value}`} />
        ))}
      </div>

      <ul className={`grid grid-cols-1 gap-x-6 gap-y-1 text-sm ${compact ? '' : 'sm:grid-cols-2'}`}>
        {shown.map((d) => {
          const row = (
            <>
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.fill }} />
              <span className="truncate text-slate-600">{d.label}</span>
              <span className="ml-auto shrink-0 font-semibold tabular-nums text-slate-900">{d.value}</span>
              <span className="w-9 shrink-0 text-right text-xs tabular-nums text-slate-400">{Math.round(pct(d.value))}%</span>
            </>
          )
          return (
            <li key={d.name}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(d.name)}
                  className="flex w-full !min-h-0 min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-slate-50"
                  title={`Show ${d.label.toLowerCase()} calls`}
                >
                  {row}
                </button>
              ) : (
                <div className="flex min-w-0 items-center gap-2 px-1.5 py-1">{row}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
