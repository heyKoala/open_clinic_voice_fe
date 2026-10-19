import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Bot, PhoneCall, Star } from 'lucide-react'
import { apiErrorMessage } from '../../lib/appointments'
import { callWithAI, recordCall, type FeedbackOutcome, type PatientCall, type ReminderOutcome } from '../../lib/patientCalls'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../shadcn/dialog'
import { Button } from '../ui/Button'
import { toast } from '../shadcn/toast'

const REMINDER_CHOICES: { value: ReminderOutcome; label: string; hint: string }[] = [
  { value: 'confirmed', label: 'Will come', hint: 'Nothing else to do.' },
  { value: 'reschedule', label: 'Wants another time', hint: 'Goes on the Reschedule list to find a new slot.' },
  { value: 'cancel', label: 'Wants to cancel', hint: 'Cancels the appointment and frees the slot.' },
  { value: 'no_answer', label: "Didn't answer", hint: 'Tried again later, then left for the desk.' },
]

/**
 * Log what came of a reminder or feedback call. The front desk makes these calls until the AI places them;
 * the outcome drives what happens next (cancel, reschedule, review link, or a call-back).
 */
export function RecordCallDialog({ call, reviewMinRating = 4, onClose, onSaved }: {
  call: PatientCall | null
  reviewMinRating?: number
  onClose: () => void
  onSaved: (call: PatientCall) => void
}) {
  const [outcome, setOutcome] = useState<ReminderOutcome | FeedbackOutcome | ''>('')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmAI, setConfirmAI] = useState(false)

  useEffect(() => {
    setOutcome(''); setRating(0); setComment(''); setError(''); setConfirmAI(false)
  }, [call])

  if (!call) return null
  const isReminder = call.kind === 'reminder'
  const when = new Date(call.appointment_starts_at)
  const ready = isReminder ? !!outcome : outcome === 'no_answer' || (outcome === 'rated' && rating > 0)

  const save = async () => {
    if (!outcome) return
    setBusy(true); setError('')
    try {
      const saved = await recordCall(call.id, outcome, outcome === 'rated' ? { rating, comment } : { comment })
      const name = call.patient_name || 'the patient'
      toast.add({
        type: 'success',
        title: outcome === 'no_answer'
          ? (saved.status === 'scheduled' ? `No answer. We'll try ${name} again at ${format(new Date(saved.due_at), 'h:mm a')}.` : `No answer from ${name}. Left for a call-back.`)
          : outcome === 'cancel' ? `Appointment cancelled for ${name}.`
            : outcome === 'reschedule' ? `${name} added to the Reschedule list.`
              : outcome === 'rated' ? `Feedback saved: ${rating}/5.` : `${name} confirmed.`,
      })
      onSaved(saved)
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the call.'))
    } finally {
      setBusy(false)
    }
  }

  const aiCall = async () => {
    setBusy(true); setError('')
    try {
      const placed = await callWithAI(call.id)
      toast.add({ title: `The AI is calling ${call.patient_name || 'the patient'} now. The outcome appears here when the call ends.`, type: 'success' })
      onSaved(placed)
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'The AI could not place the call.'))
      setConfirmAI(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isReminder ? 'Reminder call' : 'Feedback call'}: {call.patient_name}</DialogTitle>
          <DialogDescription>
            {isReminder
              ? `Remind them of their appointment with Dr. ${call.doctor_name} on ${format(when, 'EEE d MMM')} at ${format(when, 'h:mm a')}, and ask if they will come.`
              : `Ask how their visit with Dr. ${call.doctor_name} on ${format(when, 'd MMM')} went, and for a rating from 1 to 5.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <a href={`tel:${call.patient_phone}`} className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-100">
            <PhoneCall className="h-4 w-4 text-cyan-700" /> {call.patient_phone || 'No phone number'}
            {call.attempts > 0 && <span className="ml-auto text-xs font-normal text-slate-500">Tried {call.attempts}×</span>}
          </a>

          {/* Or let the AI make this call now; its outcome is saved from the call itself. */}
          {confirmAI ? (
            <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
              <p className="text-sm text-slate-800">The AI will phone <strong>{call.patient_phone}</strong> now from the hospital's number. Go ahead?</p>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => setConfirmAI(false)}>Not now</Button>
                <Button size="sm" variant="default" disabled={busy} onClick={() => void aiCall()}>{busy ? 'Calling…' : 'Yes, call now'}</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="w-full" onClick={() => setConfirmAI(true)}>
              <Bot /> Let the AI make this call now
            </Button>
          )}
          <p className="text-center text-xs text-slate-400">or call yourself and log what happened:</p>

          {isReminder ? (
            <div className="space-y-2" role="radiogroup" aria-label="What happened">
              {REMINDER_CHOICES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={outcome === c.value}
                  onClick={() => setOutcome(c.value)}
                  className={`w-full !min-h-0 rounded-xl border px-4 py-2.5 text-left ${outcome === c.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <span className="block text-sm font-medium">{c.label}</span>
                  <span className={`block text-xs ${outcome === c.value ? 'text-slate-300' : 'text-slate-500'}`}>{c.hint}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-medium text-slate-700">Their rating</p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${n} out of 5`}
                      onClick={() => { setOutcome('rated'); setRating(n) }}
                      className="!min-h-0 rounded-md p-1 hover:bg-amber-50"
                    >
                      <Star className={`h-7 w-7 ${outcome === 'rated' && n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                    </button>
                  ))}
                  {outcome === 'rated' && rating > 0 && (
                    <span className="ml-2 text-xs text-slate-500">
                      {rating >= reviewMinRating ? 'Happy: they will be asked for a Google review.' : 'Unhappy: the desk will follow up.'}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setOutcome('no_answer'); setRating(0) }}
                className={`w-full !min-h-0 rounded-xl border px-4 py-2.5 text-left text-sm font-medium ${outcome === 'no_answer' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 hover:border-slate-300'}`}
              >
                Didn't answer
              </button>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="call-note">Note (optional)</label>
            <textarea
              id="call-note"
              className="min-h-[70px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={isReminder ? 'e.g. Prefers an evening slot' : 'What they said about the visit'}
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button variant="default" disabled={!ready || busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
