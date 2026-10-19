import { useEffect, useState, type ReactNode } from 'react'
import { apiErrorMessage } from '../../lib/appointments'
import { getCallSettings, saveCallSettings, type PatientCallSettings } from '../../lib/patientCalls'
import { Button } from '../ui/Button'
import { toast } from '../shadcn/toast'

const input = 'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm'

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{hint}</p>
      </div>
      {children}
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-800">
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

const hhmm = (t: string) => t.slice(0, 5)

/** When reminder and feedback calls are made, and when a happy patient is asked for a Google review. */
export function PatientCallSettingsForm() {
  const [form, setForm] = useState<PatientCallSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    getCallSettings().then(setForm).catch(() => toast.add({ title: 'Could not load the call settings.', type: 'error' }))
  }, [])

  if (!form) return <p className="text-sm text-slate-500">Loading…</p>
  const set = <K extends keyof PatientCallSettings>(key: K, value: PatientCallSettings[K]) => setForm({ ...form, [key]: value })

  const save = async () => {
    setBusy(true); setErrors({})
    try {
      const { ai_calls_problem: _readOnly, ...values } = form
      setForm(await saveCallSettings({
        ...values,
        reminder_time: hhmm(form.reminder_time), feedback_time: hhmm(form.feedback_time),
        call_window_start: hhmm(form.call_window_start), call_window_end: hhmm(form.call_window_end),
      }))
      toast.add({ title: 'Call settings saved. Calls not made yet use the new times.', type: 'success' })
    } catch (err) {
      const data = (err as { response?: { data?: Record<string, string[]> } }).response?.data
      if (data && typeof data === 'object') setErrors(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)])))
      toast.add({ title: apiErrorMessage(err, 'Could not save.'), type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const err = (key: string) => errors[key] && <span className="mt-1 block text-xs text-red-600">{errors[key]}</span>

  return (
    <div className="max-w-3xl space-y-6">
      <Section title="AI calls" hint="Let the AI receptionist make the reminder and feedback calls itself, from the hospital's number.">
        <Toggle checked={form.ai_calls_enabled} onChange={(v) => set('ai_calls_enabled', v)} label="The AI makes these calls automatically" />
        {form.ai_calls_problem ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            AI calls can't be placed from this server yet: {form.ai_calls_problem}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Calling hours from">
            <input type="time" className={input} value={hhmm(form.call_window_start)} onChange={(e) => set('call_window_start', e.target.value)} />
          </Field>
          <Field label="Until">
            <input type="time" className={input} value={hhmm(form.call_window_end)} onChange={(e) => set('call_window_end', e.target.value)} />
            {err('call_window_end')}
          </Field>
        </div>
        <p className="text-xs text-slate-500">
          When this is off, the calls stay on the Dashboard for the desk, which can still let the AI make any one of them.
          The AI saves each call's outcome itself; unanswered calls are tried again, then left for the desk.
        </p>
      </Section>

      <Section title="Reminder call" hint="Each patient is called the day before their appointment to confirm they will come.">
        <Toggle checked={form.reminder_enabled} onChange={(v) => set('reminder_enabled', v)} label="Call patients the day before" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Call at" hint="On the day before the visit">
            <input type="time" className={input} value={hhmm(form.reminder_time)} onChange={(e) => set('reminder_time', e.target.value)} />
          </Field>
          <Field label="Tries if not answered">
            <input type="number" min={1} max={5} className={input} value={form.reminder_attempts}
              onChange={(e) => set('reminder_attempts', Number(e.target.value))} />
            {err('reminder_attempts')}
          </Field>
          <Field label="Try again after (minutes)">
            <input type="number" min={15} max={1440} step={15} className={input} value={form.retry_after_minutes}
              onChange={(e) => set('retry_after_minutes', Number(e.target.value))} />
            {err('retry_after_minutes')}
          </Field>
        </div>
        <p className="text-xs text-slate-500">After the last try, the patient appears on the Dashboard for the desk to call.</p>
      </Section>

      <Section title="Feedback call" hint="After a visit, the patient is asked how it went and for a rating from 1 to 5.">
        <Toggle checked={form.feedback_enabled} onChange={(v) => set('feedback_enabled', v)} label="Call patients after their visit" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Call at" hint="On the day after the visit">
            <input type="time" className={input} value={hhmm(form.feedback_time)} onChange={(e) => set('feedback_time', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Google review" hint="Patients who rate their visit well are sent your Google review link. Others are left for the desk to call back.">
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <Field label="Google review link" hint="From your Google Business Profile: Ask for reviews → copy link.">
            <input type="url" className={input} value={form.review_url} placeholder="https://g.page/r/…/review"
              onChange={(e) => set('review_url', e.target.value)} />
            {err('review_url')}
          </Field>
          <Field label="Ask when rated at least">
            <select className={input} value={form.review_min_rating} onChange={(e) => set('review_min_rating', Number(e.target.value))}>
              {[3, 4, 5].map((n) => <option key={n} value={n}>{n} out of 5</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <div className="flex justify-end">
        <Button variant="default" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save call settings'}</Button>
      </div>
    </div>
  )
}
