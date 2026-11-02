import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ArrowLeft, Bot, FileText, PhoneIncoming, PhoneOutgoing, Sparkles, User } from 'lucide-react'
import { api } from '../lib/api'
import { SentimentBadge, TestCallBadge } from '../components/analytics/CallLogsTable'
import { formatPhone } from '../lib/phone'
import {
  callerSilent, formatDuration, getCallLog, languageLabel, outcomeMeta, outcomeText, type CallLog, type Paginated,
} from '../lib/analytics'

/** Transcript lines come as "AI: …" / "Patient: …" (see the backend's format_transcript). */
function parseTranscript(text: string) {
  return text
    .split('\n')
    .map((line) => {
      const match = line.match(/^\s*(AI|Agent|Assistant|Patient|User|Caller)\s*:\s*(.*)$/i)
      if (!match) return { speaker: 'note' as const, text: line.trim() }
      return { speaker: /^(ai|agent|assistant)$/i.test(match[1]) ? 'ai' as const : 'patient' as const, text: match[2].trim() }
    })
    .filter((turn) => turn.text)
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <div className="mt-1 text-sm font-medium text-slate-900">{children}</div>
    </div>
  )
}

/** One call: who, when and how it ended, the recording, the AI summary and the transcript. */
export default function CallDetail({ backTo }: { backTo: string }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [call, setCall] = useState<CallLog | null>(null)
  const [error, setError] = useState(false)
  const [otherCalls, setOtherCalls] = useState<CallLog[]>([])

  useEffect(() => {
    if (!id) return
    setCall(null)
    setError(false)
    getCallLog(id).then(setCall).catch(() => setError(true))
  }, [id])

  // The patient's other calls, newest first.
  useEffect(() => {
    if (!call?.patient) { setOtherCalls([]); return }
    api.get<Paginated<CallLog>>('/ai/call-logs/', { params: { patient: call.patient, page_size: 6, ordering: '-occurred_at' } })
      .then((res) => setOtherCalls(res.data.results.filter((c) => c.id !== call.id).slice(0, 5)))
      .catch(() => setOtherCalls([]))
  }, [call])

  // Back to the list as it was (filters live in its URL) when we came from it; else to the list itself.
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate(backTo))

  if (error) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={goBack} className="flex !min-h-0 items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Back to calls
        </button>
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">This call could not be loaded.</p>
      </div>
    )
  }

  if (!call) return <p className="text-sm text-slate-500">Loading call…</p>

  const meta = outcomeMeta(call.outcome)
  const turns = parseTranscript(call.transcript || '')
  const DirectionIcon = call.direction === 'inbound' ? PhoneIncoming : PhoneOutgoing
  const silent = callerSilent(call)
  const summary = silent ? '' : call.summary
  const sentiment = silent ? '' : call.sentiment

  return (
    <div className="max-w-5xl space-y-6 pb-6">
      <button type="button" onClick={goBack} className="flex !min-h-0 items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to calls
      </button>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <DirectionIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                {call.patient_name || (call.is_test ? 'Staff test' : formatPhone(call.phone) || 'Number withheld')}
                {call.is_test && <TestCallBadge />}
              </h1>
              <p className="text-sm text-slate-500">{format(new Date(call.occurred_at), "EEEE, d MMMM yyyy 'at' h:mm a")}</p>
              {call.is_test && <p className="mt-1 text-xs text-slate-500">Made with the Test call button. Not counted in Reports or the Front Desk.</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sentiment && <SentimentBadge value={sentiment} />}
            {outcomeText(call.outcome) && <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${meta.badge}`}>{outcomeText(call.outcome)}</span>}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-5 border-t border-slate-100 pt-5 md:grid-cols-4">
          <Fact label="Direction"><span className="capitalize">{call.direction}</span></Fact>
          <Fact label="Duration">{call.duration_seconds ? formatDuration(call.duration_seconds) : '—'}</Fact>
          <Fact label="Language">{languageLabel(call.language)}</Fact>
          <Fact label="Doctor">{call.doctor_name ? `Dr. ${call.doctor_name}` : '—'}</Fact>
        </div>

        {call.recording_url && (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Recording</p>
            <audio controls preload="metadata" className="h-10 w-full" src={call.recording_url}>
              Your browser does not support audio playback.
            </audio>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          {summary && (
            <section className="rounded-2xl border border-cyan-100 bg-cyan-50/40 p-5">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-800">
                <Sparkles className="h-4 w-4" /> AI summary
                {sentiment && (
                  <span className="ml-auto flex items-center gap-2 text-xs font-medium text-slate-500">
                    Caller sentiment <SentimentBadge value={sentiment} />
                  </span>
                )}
              </h2>
              <p className="text-sm leading-relaxed text-slate-700">{summary}</p>
            </section>
          )}
          {silent && (
            <p className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
              The caller didn't speak on this call, so there is no AI summary.
            </p>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white">
            <h2 className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-900">
              <FileText className="h-4 w-4 text-slate-400" /> Transcript
            </h2>
            <div className="space-y-4 bg-slate-50/60 p-5">
              {turns.length === 0 ? (
                <p className="py-8 text-center text-sm italic text-slate-500">No transcript for this call.</p>
              ) : turns.map((turn, i) => turn.speaker === 'note' ? (
                <p key={i} className="text-center text-xs text-slate-400">{turn.text}</p>
              ) : (
                <div key={i} className={`flex gap-2 ${turn.speaker === 'ai' ? '' : 'flex-row-reverse'}`}>
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${turn.speaker === 'ai' ? 'bg-slate-200 text-slate-600' : 'bg-[#030D39] text-white'}`}>
                    {turn.speaker === 'ai' ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                  </div>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${turn.speaker === 'ai' ? 'rounded-tl-sm border border-slate-200 bg-white text-slate-800' : 'rounded-tr-sm bg-[#030D39] text-white'}`}>
                    {turn.text}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Patient</h2>
            {call.patient ? (
              <>
                <p className="font-medium text-slate-900">{call.patient_name}</p>
                <Link to="/app/patients" className="mt-1 inline-block text-sm font-medium text-cyan-700 hover:underline">Open patient directory</Link>
              </>
            ) : (
              <p className="text-sm text-slate-500">The caller wasn't matched to a patient.</p>
            )}
          </section>

          {otherCalls.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Other calls from this patient</h2>
              <ul className="space-y-1">
                {otherCalls.map((c) => (
                  <li key={c.id}>
                    <Link to={`../${c.id}`} relative="path" className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                      <span className="text-slate-700">{format(new Date(c.occurred_at), 'd MMM, h:mm a')}</span>
                      <span className="truncate text-xs text-slate-500">{outcomeText(c.outcome)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
