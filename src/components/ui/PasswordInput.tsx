import { useState } from 'react'
import { Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'

type Rule = { label: string; test: (v: string) => boolean }

const RULES: Rule[] = [
  { label: 'At least 10 characters', test: (v) => v.length >= 10 },
  { label: 'One uppercase letter (A–Z)', test: (v) => /[A-Z]/.test(v) },
  { label: 'One number (0–9)', test: (v) => /[0-9]/.test(v) },
  { label: 'One special character (!@#$…)', test: (v) => /[^A-Za-z0-9]/.test(v) },
]

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  showRules?: boolean
  required?: boolean
}

export function PasswordInput({ value, onChange, placeholder = 'Password', className = '', showRules = false, required }: Props) {
  const [show, setShow] = useState(false)

  const inputClass = `rounded-xl border border-slate-300 px-3 py-2 pr-10 w-full focus:outline-none focus:ring-2 focus:ring-slate-400 ${className}`

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          className={inputClass}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {showRules && value.length > 0 && (
        <ul className="grid gap-1">
          {RULES.map((rule) => {
            const ok = rule.test(value)
            return (
              <li key={rule.label} className={`flex items-center gap-2 text-xs ${ok ? 'text-emerald-700' : 'text-slate-500'}`}>
                {ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                )}
                {rule.label}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Returns an error string if any rule fails, empty string if all pass */
export function validatePassword(value: string): string {
  for (const rule of RULES) {
    if (!rule.test(value)) return `Password must include: ${rule.label.toLowerCase()}.`
  }
  return ''
}
