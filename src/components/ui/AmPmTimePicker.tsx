/**
 * AmPmTimePicker — renders hour / minute / AM/PM selects.
 * value / onChange are in 24-hour "HH:mm" strings (what the backend expects).
 */

interface Props {
  value: string  // "HH:mm" or ""
  onChange: (val: string) => void  // always emits "HH:mm"
  id?: string
}

function to24h(hour: number, minute: number, period: 'AM' | 'PM'): string {
  let h = hour
  if (period === 'AM' && hour === 12) h = 0
  if (period === 'PM' && hour !== 12) h = hour + 12
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function parse24h(val: string): { hour: number; minute: number; period: 'AM' | 'PM' } {
  if (!val || !val.includes(':')) return { hour: 9, minute: 0, period: 'AM' }
  const [hStr, mStr] = val.split(':')
  let h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  const period: 'AM' | 'PM' = h < 12 ? 'AM' : 'PM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return { hour: h, minute: m, period }
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

export function AmPmTimePicker({ value, onChange, id }: Props) {
  const { hour, minute, period } = parse24h(value)

  const update = (h: number, m: number, p: 'AM' | 'PM') => {
    onChange(to24h(h, m, p))
  }

  const selectClass = 'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400'

  return (
    <div className="flex items-center gap-1" id={id}>
      {/* Hour */}
      <select
        className={selectClass}
        value={hour}
        onChange={(e) => update(Number(e.target.value), minute, period)}
        aria-label="Hour"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
        ))}
      </select>

      <span className="text-slate-500 font-bold select-none">:</span>

      {/* Minute */}
      <select
        className={selectClass}
        value={minute}
        onChange={(e) => update(hour, Number(e.target.value), period)}
        aria-label="Minute"
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
        ))}
      </select>

      {/* AM/PM */}
      <select
        className={`${selectClass} font-semibold`}
        value={period}
        onChange={(e) => update(hour, minute, e.target.value as 'AM' | 'PM')}
        aria-label="AM or PM"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  )
}

/** Format a "HH:mm" string to "h:mm AM/PM" for display */
export function formatAmPm(val: string | null | undefined): string {
  if (!val) return '—'
  const { hour, minute, period } = parse24h(val)
  return `${hour}:${String(minute).padStart(2, '0')} ${period}`
}
