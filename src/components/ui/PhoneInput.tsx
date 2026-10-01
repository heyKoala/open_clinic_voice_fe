import { type ChangeEvent } from 'react'

// Common country codes used across India / worldwide
export const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+1', flag: '🇺🇸', name: 'USA / Canada' },
  { code: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+974', flag: '🇶🇦', name: 'Qatar' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+60', flag: '🇲🇾', name: 'Malaysia' },
  { code: '+64', flag: '🇳🇿', name: 'New Zealand' },
  { code: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+81', flag: '🇯🇵', name: 'Japan' },
  { code: '+86', flag: '🇨🇳', name: 'China' },
]

interface Props {
  dialCode: string
  number: string
  onDialCodeChange: (code: string) => void
  onNumberChange: (num: string) => void
  placeholder?: string
  required?: boolean
  className?: string
}

export function PhoneInput({ dialCode, number, onDialCodeChange, onNumberChange, placeholder = '98765 43210', required, className = '' }: Props) {
  return (
    <div className={`flex rounded-xl border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-slate-400 ${className}`}>
      <select
        className="border-r border-slate-300 bg-slate-50 px-2 py-2 text-sm font-medium text-slate-700 focus:outline-none shrink-0"
        value={dialCode}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onDialCodeChange(e.target.value)}
        aria-label="Country dial code"
      >
        {COUNTRY_CODES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.code}
          </option>
        ))}
      </select>
      <input
        type="tel"
        className="flex-1 px-3 py-2 text-sm focus:outline-none bg-white"
        placeholder={placeholder}
        value={number}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onNumberChange(e.target.value)}
        required={required}
        pattern="[0-9 \-()]{6,15}"
        title="Enter a valid phone number (digits, spaces, dashes)"
      />
    </div>
  )
}
