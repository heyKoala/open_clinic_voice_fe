import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import { apiErrorMessage, sourceMeta, type Appointment } from '../../lib/appointments'
import {
  REMINDER_RESULT_TEXT, getAppointmentCalls, getCallSettings, markReviewSent,
  type PatientCall, type PatientCallSettings,
} from '../../lib/patientCalls'
import { Button } from '../ui/Button'
import { toast } from '../shadcn/toast'
import { RecordCallDialog } from './RecordCallDialog'

type Tone = 'done' | 'now' | 'later' | 'off' | 'bad'

const DOT: Record<Tone, string> = {
  done: 'bg-emerald-500 ring-emerald-100',
  now: 'bg-amber-400 ring-amber-100',
  later: 'bg-white ring-slate-200 border border-slate-300',
  off: 'bg-slate-300 ring-slate-100',
  bad: 'bg-rose-500 ring-rose-100',
}

const when = (iso: string) => format(new Date(iso), 'EEE d MMM, h:mm a')

/** A call step: what is planned, what happened, or why it isn't needed. */
function callStep(call: PatientCall | undefined, notPlanned: string): { tone: Tone; text: string } {
  if (!call) return { tone: 'off', text: notPlanned }
  if (call.status === 'skipped') return { tone: 'off', text: 'Not needed' }
  if (call.status === 'calling') return { tone: 'now', text: 'The AI is calling now…' }
  if (call.status === 'no_answer') return { tone: 'bad', text: `Not answered after ${call.attempts} tries${call.resolved_at ? ' · desk followed up' : ''}` }
  if (call.status === 'scheduled') {
    const due = new Date(call.due_at) <= new Date()
    return { tone: due ? 'now' : 'later', text: due ? `Due now${call.attempts ? ` · tried ${call.attempts}×` : ''}` : `Planned for ${when(call.due_at)}` }
  }
  if (call.kind === 'reminder') {
    return { tone: call.result === 'confirmed' ? 'done' : 'bad', text: `${REMINDER_RESULT_TEXT[call.result] ?? 'Done'}${call.last_attempt_at ? ` · ${when(call.last_attempt_at)}` : ''}` }
  }
  return { tone: 'done', text: `Rated ${call.rating}/5${call.comment ? ` · "${call.comment}"` : ''}` }
}

const VISIT: Record<string, { tone: Tone; text: string }> = {
  scheduled: { tone: 'later', text: 'Upcoming' },
  needs_reschedule: { tone: 'now', text: 'Needs a new time' },
  checked_in: { tone: 'now', text: 'Checked in' },
  completed: { tone: 'done', text: 'Visited' },
  no_show: { tone: 'bad', text: "Didn't come" },
  cancelled: { tone: 'off', text: 'Cancelled' },
}

/** The patient's journey for one appointment: booked → reminder → visit → feedback → Google review. */
export function AppointmentJourney({ appointment, onChanged, readOnly = false }: {
  appointment: Appointment
  onChanged: () => void
  readOnly?: boolean
}) {
  const [calls, setCalls] = useState<PatientCall[] | null>(null)
  const [settings, setSettings] = useState<PatientCallSettings | null>(null)
  const [logging, setLogging] = useState<PatientCall | null>(null)

  const load = useCallback(() => {
    getAppointmentCalls(appointment.id).then(setCalls).catch(() => setCalls([]))
    getCallSettings().then(setSettings).catch(() => setSettings(null))
  }, [appointment.id])
  useEffect(load, [load])

  if (calls === null) return <p className="text-xs text-slate-400">Loading the patient's journey…</p>

  const reminder = calls.find((c) => c.kind === 'reminder')
  const feedback = calls.find((c) => c.kind === 'feedback')
  const minRating = settings?.review_min_rating ?? 4
  const visit = VISIT[appointment.status] ?? VISIT.scheduled
  const visited = appointment.status === 'completed'

  let review: { tone: Tone; text: string } = { tone: 'off', text: 'After a good rating' }
  if (feedback?.rating != null) {
    if (feedback.rating < minRating) review = { tone: 'off', text: `Not asked (rated below ${minRating})${feedback.resolved_at ? ' · desk followed up' : ''}` }
    else if (feedback.review_sent_at) review = { tone: 'done', text: `Link sent ${when(feedback.review_sent_at)}` }
    else review = { tone: 'now', text: settings?.review_url ? 'To send' : 'To send · add the review link in Settings' }
  }

  const sendReview = async () => {
    if (!feedback || !settings?.review_url) return
    try {
      await navigator.clipboard.writeText(settings.review_url).catch(() => undefined)
      await markReviewSent(feedback.id)
      toast.add({ title: 'Review link copied and marked sent.', type: 'success' })
      load(); onChanged()
    } catch (err) {
      toast.add({ title: apiErrorMessage(err, 'Could not update.'), type: 'error' })
    }
  }

  const logButton = (call: PatientCall | undefined) =>
    !readOnly && call && (call.status === 'scheduled' || (call.status === 'no_answer' && !call.resolved_at)) ? (
      <Button size="xs" variant="outline" onClick={() => setLogging(call)}>Log call</Button>
    ) : null

  const steps: { label: string; tone: Tone; text: string; action?: ReactNode }[] = [
    { label: 'Booked', tone: 'done', text: `By ${sourceMeta(appointment.source).label}` },
    { label: 'Reminder call', ...callStep(reminder, 'No reminder call for this visit'), action: logButton(reminder) },
    { label: 'Visit', ...visit },
    { label: 'Feedback call', ...callStep(feedback, visited ? 'Planned shortly' : 'After the visit'), action: logButton(feedback) },
    {
      label: 'Google review', ...review,
      action: !readOnly && review.tone === 'now' && settings?.review_url
        ? <Button size="xs" variant="outline" onClick={() => void sendReview()}>Copy link & mark sent</Button> : null,
    },
  ]

  return (
    <section aria-label="Patient journey">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Patient journey</p>
      <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-slate-200">
        {steps.map((s) => (
          <li key={s.label} className="relative flex items-start gap-3 pl-0">
            <span className={`relative z-10 mt-1 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ${DOT[s.tone]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">{s.label}</p>
              <p className={`text-xs ${s.tone === 'bad' ? 'text-rose-600' : s.tone === 'now' ? 'text-amber-700' : 'text-slate-500'}`}>{s.text}</p>
            </div>
            {s.action}
          </li>
        ))}
      </ol>
      <RecordCallDialog
        call={logging}
        reviewMinRating={minRating}
        onClose={() => setLogging(null)}
        onSaved={() => { load(); onChanged() }}
      />
    </section>
  )
}
