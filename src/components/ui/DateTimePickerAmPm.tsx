import { AmPmTimePicker } from './AmPmTimePicker'

interface Props {
  value: string // Format: "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void
  min?: string // Format: "YYYY-MM-DDTHH:mm"
  className?: string
  required?: boolean
}

export function DateTimePickerAmPm({ value, onChange, min, className = '', required }: Props) {
  // Split value into date and time
  const [datePart, timePart] = value ? value.split('T') : ['', '']

  const handleDateChange = (newDate: string) => {
    if (!newDate) {
      onChange('')
      return
    }
    const newTime = timePart || '09:00'
    onChange(`${newDate}T${newTime}`)
  }

  const handleTimeChange = (newTime: string) => {
    if (!datePart) return
    onChange(`${datePart}T${newTime}`)
  }

  const minDate = min ? min.split('T')[0] : undefined

  return (
    <div className={`flex flex-col sm:flex-row gap-2 ${className}`}>
      <input
        type="date"
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        value={datePart}
        onChange={(e) => handleDateChange(e.target.value)}
        min={minDate}
        required={required}
      />
      {datePart && (
        <AmPmTimePicker
          value={timePart}
          onChange={handleTimeChange}
        />
      )}
    </div>
  )
}
