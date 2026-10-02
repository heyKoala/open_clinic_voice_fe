import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '../lib/api'
import { useUIStore } from '../store/uistore'
import { Button } from './ui/Button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './shadcn/dialog'

type MemberForm = {
  full_name: string
  age: string
  gender: string
}

type DoctorForm = {
  degree: string
  specialty: string
  consultation_minutes: string
  max_patients_per_day: string
  available_from: string
  available_to: string
  lunch_from: string
  lunch_to: string
  working_days: number[]
}

const TIME_FIELDS = ['available_from', 'available_to', 'lunch_from', 'lunch_to'] as const

const DAYS = [
  { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 }, { label: 'Wed', value: 3 }, { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 }, { label: 'Sun', value: 7 },
]

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500'

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  )
}

/** A 400 answers { field: ["message"], doctor: { field: ["message"] } }; flatten to the first message per field. */
function fieldErrors(err: any): Record<string, string> {
  const data = err?.response?.data
  if (err?.response?.status !== 400 || !data || typeof data !== 'object') return {}
  const { doctor, ...rest } = data
  const all = { ...rest, ...(doctor && typeof doctor === 'object' && !Array.isArray(doctor) ? doctor : {}) }
  return Object.fromEntries(Object.entries(all).map(([key, value]) => [key, Array.isArray(value) ? String(value[0]) : String(value)]))
}

/**
 * Lets an admin edit a team member's personal details and, for a doctor, their professional
 * profile and availability. `memberId` null keeps the dialog closed.
 */
export function EditMemberDialog({ memberId, onClose, onSaved }: {
  memberId: number | null
  onClose: () => void
  onSaved: () => Promise<void> | void
}) {
  const { addToast } = useUIStore()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [form, setForm] = useState<MemberForm | null>(null)
  const [doctor, setDoctor] = useState<DoctorForm | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (memberId === null) return
    let cancelled = false
    setForm(null)
    setDoctor(null)
    setErrors({})
    setLoadError('')
    api.get(`/auth/users/${memberId}/`)
      .then(({ data }) => {
        if (cancelled) return
        setEmail(data.email)
        setRole(String(data.role).replace('_', ' '))
        setForm({ full_name: data.full_name ?? '', age: data.age ? String(data.age) : '', gender: data.gender || 'unspecified' })
        const profile = data.doctor
        setDoctor(profile && {
          degree: profile.degree ?? '',
          specialty: profile.specialty ?? '',
          consultation_minutes: String(profile.consultation_minutes ?? ''),
          max_patients_per_day: profile.max_patients_per_day ? String(profile.max_patients_per_day) : '',
          // "09:00:00" -> "09:00" for the time inputs
          ...Object.fromEntries(TIME_FIELDS.map((key) => [key, String(profile[key] ?? '').slice(0, 5)])),
          working_days: Array.isArray(profile.working_days) ? profile.working_days : [],
        } as DoctorForm)
      })
      .catch(() => { if (!cancelled) setLoadError('Could not load this team member.') })
    return () => { cancelled = true }
  }, [memberId])

  const clearError = (key: string) => { if (errors[key]) setErrors({ ...errors, [key]: '' }) }
  const set = (key: keyof MemberForm, value: string) => { if (form) setForm({ ...form, [key]: value }); clearError(key) }
  const setDoc = (key: keyof DoctorForm, value: string | number[]) => { if (doctor) setDoctor({ ...doctor, [key]: value }); clearError(key) }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (memberId === null || !form) return
    setSaving(true)
    setErrors({})
    try {
      await api.patch(`/auth/users/${memberId}/`, {
        full_name: form.full_name.trim(),
        age: form.age ? parseInt(form.age, 10) : null,
        gender: form.gender,
        ...(doctor && {
          doctor: {
            degree: doctor.degree.trim(),
            specialty: doctor.specialty.trim(),
            consultation_minutes: parseInt(doctor.consultation_minutes, 10),
            max_patients_per_day: doctor.max_patients_per_day ? parseInt(doctor.max_patients_per_day, 10) : null,
            ...Object.fromEntries(TIME_FIELDS.map((key) => [key, doctor[key] || null])),
            working_days: [...doctor.working_days].sort(),
          },
        }),
      })
      addToast(`${form.full_name.trim()} updated.`, 'success')
      await onSaved()
      onClose()
    } catch (err) {
      const found = fieldErrors(err)
      setErrors(found)
      addToast(Object.values(found)[0] || 'Could not save the changes.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const time = (key: (typeof TIME_FIELDS)[number], label: string) => (
    <Field label={label} error={errors[key]}>
      <input type="time" className={inputClass} value={doctor?.[key] ?? ''} onChange={(e) => setDoc(key, e.target.value)} />
    </Field>
  )

  return (
    <Dialog open={memberId !== null} onOpenChange={(open) => { if (!open && !saving) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit team member</DialogTitle>
          <DialogDescription>{email ? `${email} · ${role}` : 'Loading…'}</DialogDescription>
        </DialogHeader>

        {loadError && <p className="text-sm text-red-600">{loadError}</p>}
        {!loadError && !form && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>}

        {form && (
          <form onSubmit={save} className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">Personal details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" error={errors.full_name}>
                  <input className={inputClass} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} required />
                </Field>
                <Field label="Email" hint="The email they sign in with can't be changed here.">
                  <input className={inputClass} value={email} disabled />
                </Field>
                <Field label="Age" error={errors.age}>
                  <input type="number" min="1" max="120" className={inputClass} value={form.age} onChange={(e) => set('age', e.target.value)} />
                </Field>
                <Field label="Gender" error={errors.gender}>
                  <select className={inputClass} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="unspecified">Prefer not to say</option>
                  </select>
                </Field>
              </div>
            </section>

            {doctor && (
              <>
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900">Doctor profile</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Degree(s)" error={errors.degree}>
                      <input className={inputClass} value={doctor.degree} onChange={(e) => setDoc('degree', e.target.value)} placeholder="e.g. MBBS, MD" />
                    </Field>
                    <Field label="Specialty" error={errors.specialty}>
                      <input className={inputClass} value={doctor.specialty} onChange={(e) => setDoc('specialty', e.target.value)} placeholder="e.g. General Practice" required />
                    </Field>
                    <Field label="Consultation length (minutes)" error={errors.consultation_minutes}>
                      <input type="number" min="1" className={inputClass} value={doctor.consultation_minutes} onChange={(e) => setDoc('consultation_minutes', e.target.value)} required />
                    </Field>
                    <Field label="Max patients per day" error={errors.max_patients_per_day} hint="Leave blank for no limit.">
                      <input type="number" min="1" className={inputClass} value={doctor.max_patients_per_day} onChange={(e) => setDoc('max_patients_per_day', e.target.value)} />
                    </Field>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900">Availability</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {time('available_from', 'Available from')}
                    {time('available_to', 'Available to')}
                    {time('lunch_from', 'Lunch from')}
                    {time('lunch_to', 'Lunch to')}
                  </div>
                  <div>
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Working days</span>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map((day) => {
                        const on = doctor.working_days.includes(day.value)
                        return (
                          <button
                            key={day.value}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setDoc('working_days', on ? doctor.working_days.filter((v) => v !== day.value) : [...doctor.working_days, day.value])}
                            className={`!min-h-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-600 hover:text-slate-900'}`}
                          >
                            {day.label}
                          </button>
                        )
                      })}
                    </div>
                    {errors.working_days && <span className="mt-1 block text-xs font-medium text-red-600">{errors.working_days}</span>}
                  </div>
                </section>
              </>
            )}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="submit" variant="default" className="px-4" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
