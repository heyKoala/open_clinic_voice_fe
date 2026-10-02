import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '../../lib/api'
import { useUIStore } from '../../store/uistore'
import { Button } from '../ui/Button'

type ClinicForm = {
  name: string
  clinic_type: string
  address: string
  phone: string
  support_email: string
  website: string
  registration_number: string
  tax_id: string
  description: string
  facilities: string
  holiday_calendar: string
  working_hours_start: string
  working_hours_end: string
}

const CLINIC_FIELDS = [
  'name', 'clinic_type', 'address', 'phone', 'support_email', 'website',
  'registration_number', 'tax_id', 'description', 'facilities', 'holiday_calendar',
] as const
const HOURS_FIELDS = ['working_hours_start', 'working_hours_end'] as const

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400'

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

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

/** DRF answers a 400 with { field: ["message"] }; keep the first message per field. */
function fieldErrors(err: any): Record<string, string> {
  const data = err?.response?.data
  if (err?.response?.status !== 400 || !data || typeof data !== 'object') return {}
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, Array.isArray(value) ? String(value[0]) : String(value)])
  )
}

/**
 * Everything about the centre that is currently selected in the header: name, contact details,
 * opening hours and the facts the AI receptionist tells callers.
 */
export function ClinicDetailsForm({ onSaved }: { onSaved?: () => Promise<void> | void }) {
  const { addToast } = useUIStore()
  const [clinicId, setClinicId] = useState<number | null>(null)
  const [form, setForm] = useState<ClinicForm | null>(null)
  const [saved, setSaved] = useState<ClinicForm | null>(null)
  const [specialties, setSpecialties] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        // The configuration belongs to the active centre, so it tells us which clinic to load.
        const config = (await api.get('/clinics/configuration/')).data
        const clinic = (await api.get(`/clinics/${config.clinic}/`)).data
        if (cancelled) return
        const loaded = {
          ...Object.fromEntries(CLINIC_FIELDS.map((key) => [key, clinic[key] ?? ''])),
          // "09:00:00" -> "09:00" for the time inputs
          working_hours_start: String(config.working_hours_start ?? '').slice(0, 5),
          working_hours_end: String(config.working_hours_end ?? '').slice(0, 5),
        } as ClinicForm
        setClinicId(clinic.id)
        setForm(loaded)
        setSaved(loaded)
      } catch {
        if (!cancelled) setLoadError('Could not load the clinic details.')
      }
      try {
        const res = await api.get('/doctors/', { params: { page_size: 100 } })
        const doctors: any[] = Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : []
        if (!cancelled) setSpecialties(Array.from(new Set(doctors.map((d) => d.specialty).filter(Boolean))))
      } catch {
        // Specialties are informational only.
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>
  if (!form || !saved) return <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>

  const set = (key: keyof ClinicForm, value: string) => {
    setForm({ ...form, [key]: value })
    if (errors[key]) setErrors({ ...errors, [key]: '' })
  }
  const isDirty = JSON.stringify(form) !== JSON.stringify(saved)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (clinicId === null) return
    setSaving(true)
    setErrors({})
    try {
      await api.patch(`/clinics/${clinicId}/`, Object.fromEntries(CLINIC_FIELDS.map((key) => [key, form[key]])))
      await api.patch('/clinics/configuration/', Object.fromEntries(HOURS_FIELDS.map((key) => [key, form[key]])))
      setSaved(form)
      addToast('Clinic details saved.', 'success')
      await onSaved?.()
    } catch (err) {
      const found = fieldErrors(err)
      setErrors(found)
      addToast(Object.values(found)[0] || 'Could not save the clinic details.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const text = (key: keyof ClinicForm, props: { type?: string; placeholder?: string; required?: boolean } = {}) => (
    <input className={inputClass} value={form[key]} onChange={(e) => set(key, e.target.value)} {...props} />
  )
  const area = (key: keyof ClinicForm, placeholder: string) => (
    <textarea className={`${inputClass} min-h-[80px] leading-relaxed`} value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} />
  )

  return (
    <form onSubmit={save} className="space-y-6">
      <Section title="Basics" hint={`You are editing ${saved.name}. To edit another centre, pick it in the Clinic menu at the top of the page.`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Clinic name" error={errors.name} hint="Shown across the app. The AI receptionist greets callers with the main clinic's name.">
            {text('name', { required: true })}
          </Field>
          <Field label="Clinic type" error={errors.clinic_type}>
            <select className={inputClass} value={form.clinic_type} onChange={(e) => set('clinic_type', e.target.value)}>
              <option value="single_doctor">Single doctor practice</option>
              <option value="multi_doctor">Multi-doctor clinic</option>
            </select>
          </Field>
        </div>
        <Field label="Address" error={errors.address}>
          {area('address', 'Building, street, area, city and PIN code')}
        </Field>
      </Section>

      <Section title="Contact" hint="How patients reach the front desk. The AI receptionist's own number is under Phone number.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Front desk phone" error={errors.phone}>{text('phone', { type: 'tel', placeholder: '+91 80 1234 5678' })}</Field>
          <Field label="Support email" error={errors.support_email}>{text('support_email', { type: 'email', placeholder: 'hello@clinic.com' })}</Field>
          <Field label="Website" error={errors.website}>{text('website', { type: 'url', placeholder: 'https://…' })}</Field>
        </div>
      </Section>

      <Section title="Opening hours">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Opens at" error={errors.working_hours_start}>{text('working_hours_start', { type: 'time', required: true })}</Field>
          <Field label="Closes at" error={errors.working_hours_end}>{text('working_hours_end', { type: 'time', required: true })}</Field>
        </div>
      </Section>

      <Section title="Registration">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Registration / licence number" error={errors.registration_number}>{text('registration_number')}</Field>
          <Field label="Tax ID (optional)" error={errors.tax_id}>{text('tax_id')}</Field>
        </div>
      </Section>

      <Section title="What the AI receptionist tells callers" hint="Written in plain sentences. The receptionist uses these, with the address and contact details above, to answer questions about this centre.">
        <Field label="About the clinic" error={errors.description}>
          {area('description', 'We are a multi-specialty clinic focused on…')}
        </Field>
        <Field label="Facilities and amenities" error={errors.facilities}>
          {area('facilities', 'Free basement parking, wheelchair ramp at the entrance, on-site pharmacy…')}
        </Field>
        <Field label="Regular closures" error={errors.holiday_calendar} hint="For one-off dates that should block bookings, use the Holidays tab.">
          {area('holiday_calendar', 'We are closed every Sunday and on public holidays.')}
        </Field>
        <div>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Specialties offered</span>
          <div className="flex flex-wrap gap-2">
            {(specialties.length > 0 ? specialties : ['General Practice']).map((name) => (
              <span key={name} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{name}</span>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">Taken from your doctors' profiles.</p>
        </div>
      </Section>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <p className="text-sm text-slate-500">{isDirty ? 'You have unsaved changes.' : 'All changes saved.'}</p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" disabled={!isDirty || saving} onClick={() => { setForm(saved); setErrors({}) }}>
            Discard
          </Button>
          <Button type="submit" variant="default" className="px-4" disabled={!isDirty || saving}>
            {saving ? 'Saving…' : 'Save clinic details'}
          </Button>
        </div>
      </div>
    </form>
  )
}
