import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { CalendarSync, Check, CheckCircle2, Copy, CreditCard, Loader2, MessageCircle, PhoneCall, Unplug, XCircle } from 'lucide-react'
import { apiErrorMessage } from '../lib/appointments'
import {
  STATUS_PILL, checkIntegration, disconnectIntegration, listIntegrations, saveIntegration,
  type CheckResult, type Integration, type IntegrationProvider,
} from '../lib/integrations'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/shadcn/dialog'
import { Button } from '../components/ui/Button'
import { toast } from '../components/shadcn/toast'

const field = 'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm'
const label = 'mb-1 block text-xs font-medium text-slate-700'

/**
 * Messages we start ourselves need a WATI template. Replies in a patient's booking chat don't,
 * and reminders are phone calls, so only these two remain (both optional).
 */
const WATI_TEMPLATES = [
  { key: 'confirmation_template', label: 'Confirmation for phone & front-desk bookings' },
  { key: 'review_template', label: 'Google review request' },
]

const isLocalAddress = (url = '') => /\/\/(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.)/.test(url)

/** A value to paste into the provider's dashboard, with a copy button. */
function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-800" title={value}>{value}</code>
      <Button type="button" size="sm" variant="outline" onClick={copy}>{copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}</Button>
    </div>
  )
}

/** The webhook address to paste into WATI or Razorpay. */
function WebhookUrl({ url, provider }: { url?: string; provider: string }) {
  if (!url) return null
  return (
    <div>
      <CopyValue value={url} />
      {isLocalAddress(url) && (
        <p className="mt-1.5 text-xs text-amber-700">This is a local address {provider} can't reach. Use the public address once the backend is online.</p>
      )}
    </div>
  )
}

function StatusPill({ integration }: { integration?: Integration }) {
  const pill = STATUS_PILL[integration?.status ?? 'not_connected']
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${pill.className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" /> {pill.label}
    </span>
  )
}

function Card({ icon, tint, title, description, pill, children }: {
  icon: ReactNode; tint: string; title: string; description: string; pill: ReactNode; children?: ReactNode
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${tint}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">{title}</h3>
            {pill}
          </div>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </article>
  )
}

/** Rows of what is saved (no credentials), plus the last check. */
function Details({ integration, rows }: { integration: Integration; rows: [string, string | undefined][] }) {
  const shown = rows.filter(([, v]) => v)
  return (
    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm">
      <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5">
        {shown.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-500">{k}</dt>
            <dd className="truncate text-slate-900">{v}</dd>
          </div>
        ))}
        <dt className="text-slate-500">Key</dt>
        <dd className="font-mono text-slate-900">{integration.secret_hint || '—'}</dd>
      </dl>
      {integration.last_checked_at && (
        <p className="text-xs text-slate-400">Last checked {format(new Date(integration.last_checked_at), 'd MMM yyyy, h:mm a')}</p>
      )}
      {integration.status === 'error' && integration.last_error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{integration.last_error}</p>
      )}
    </div>
  )
}

/** Connect your clinic's own systems: WhatsApp through WATI, and your doctor & appointment system. */
export default function Integrations() {
  const [items, setItems] = useState<Record<string, Integration>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<IntegrationProvider | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState<IntegrationProvider | null>(null)

  const load = () => {
    listIntegrations()
      .then((rows) => setItems(Object.fromEntries(rows.map((r) => [r.provider, r]))))
      .catch((err) => toast.add({ title: apiErrorMessage(err, 'Integrations could not be loaded.'), type: 'error' }))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const test = async (provider: IntegrationProvider) => {
    setBusy(`test-${provider}`)
    try {
      const result = await checkIntegration(provider)
      toast.add({ title: result.message, type: result.ok ? 'success' : 'error' })
      load()
    } catch (err) {
      toast.add({ title: apiErrorMessage(err, 'The check could not run.'), type: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const disconnect = async (provider: IntegrationProvider) => {
    setBusy(`off-${provider}`)
    try {
      await disconnectIntegration(provider)
      toast.add({ title: `${items[provider]?.label ?? 'Integration'} disconnected.`, type: 'success' })
      setConfirmDisconnect(null)
      load()
    } catch (err) {
      toast.add({ title: apiErrorMessage(err, 'Could not disconnect.'), type: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const actions = (provider: IntegrationProvider) => {
    const integration = items[provider]
    return (
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        <Button size="sm" variant="default" onClick={() => setEditing(provider)}>
          {integration?.configured ? 'Edit' : 'Connect'}
        </Button>
        {integration?.configured && (
          <Button size="sm" variant="outline" disabled={busy === `test-${provider}`} onClick={() => void test(provider)}>
            {busy === `test-${provider}` ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Test connection
          </Button>
        )}
        {integration?.configured && (confirmDisconnect === provider ? (
          <span className="ml-auto flex items-center gap-2 text-xs text-slate-600">
            Disconnect?
            <Button size="sm" variant="destructive" disabled={busy === `off-${provider}`} onClick={() => void disconnect(provider)}>Yes</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDisconnect(null)}>No</Button>
          </span>
        ) : (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setConfirmDisconnect(provider)}>
            <Unplug /> Disconnect
          </Button>
        ))}
      </div>
    )
  }

  const wati = items.wati
  const pms = items.pms
  const razorpay = items.razorpay

  return (
    <div className="max-w-6xl space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Integrations</h1>
        <p className="mt-0.5 text-sm text-slate-500">Connect your hospital's own systems. Keys are stored encrypted and never shown again in full.</p>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading…</p> : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card
            icon={<MessageCircle className="h-5 w-5 text-emerald-600" />}
            tint="bg-emerald-50 ring-emerald-100"
            title="WhatsApp (WATI)"
            description="Patients book by chatting with your WATI WhatsApp number. Reminders go out as phone calls, not WhatsApp."
            pill={<StatusPill integration={wati} />}
          >
            {wati?.configured && (
              <Details integration={wati} rows={[
                ['WhatsApp number', wati.settings.whatsapp_number],
                ['API endpoint', wati.settings.api_endpoint],
                ['Last patient message', wati.last_message_at ? format(new Date(wati.last_message_at), 'd MMM yyyy, h:mm a') : 'None received yet'],
                ...WATI_TEMPLATES.map((t) => [t.label, wati.settings[t.key]] as [string, string | undefined]),
              ]} />
            )}
            {actions('wati')}
          </Card>

          <Card
            icon={<CalendarSync className="h-5 w-5 text-indigo-600" />}
            tint="bg-indigo-50 ring-indigo-100"
            title="Doctor & appointment system"
            description="Your hospital's own scheduling system (PMS / HIS). Doctors, their slots and bookings will sync with it."
            pill={<StatusPill integration={pms} />}
          >
            {pms?.configured && (
              <Details integration={pms} rows={[
                ['System', pms.settings.system_name],
                ['Address', pms.settings.base_url],
                ['Key sent as', pms.settings.auth_type === 'header' ? `${pms.settings.header_name} header` : 'Bearer token'],
                ['Doctors', pms.settings.doctors_path],
                ['Appointments', pms.settings.appointments_path],
              ]} />
            )}
            <p className="mt-4 rounded-lg bg-indigo-50/60 px-3 py-2 text-xs text-indigo-900">
              Save and test the connection now. Syncing doctors and bookings with it is the next step to build.
            </p>
            {actions('pms')}
          </Card>

          <Card
            icon={<CreditCard className="h-5 w-5 text-sky-600" />}
            tint="bg-sky-50 ring-sky-100"
            title="Razorpay"
            description="A payment link for the consultation fee goes to the patient after each booking, and the booking shows paid or unpaid."
            pill={<StatusPill integration={razorpay} />}
          >
            {razorpay?.configured && (
              <Details integration={razorpay} rows={[
                ['Mode', razorpay.settings.key_id?.startsWith('rzp_live_') ? 'Live' : 'Test'],
                ['Key ID', razorpay.settings.key_id],
                ['Consultation fee', razorpay.settings.consultation_fee ? `₹${razorpay.settings.consultation_fee}` : undefined],
                ['Link valid for', `${razorpay.settings.link_valid_hours || 24} hours`],
                ['Last payment event', razorpay.last_message_at ? format(new Date(razorpay.last_message_at), 'd MMM yyyy, h:mm a') : 'None received yet'],
              ]} />
            )}
            <p className="mt-4 rounded-lg bg-sky-50/70 px-3 py-2 text-xs text-sky-900">
              Save and test the keys now. Sending the links with bookings is the next step to build.
            </p>
            {actions('razorpay')}
          </Card>

          <Card
            icon={<PhoneCall className="h-5 w-5 text-slate-700" />}
            tint="bg-slate-100 ring-slate-200"
            title="AI phone agent"
            description="The AI receptionist (HeyKoala) and the hospital's phone number."
            pill={<span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200">Managed in AI Agent</span>}
          >
            <Link to="/app/ai-agent?tab=phone" className="mt-auto pt-5 text-sm font-medium text-cyan-700 hover:underline">Open AI Agent →</Link>
          </Card>
        </div>
      )}

      {editing === 'wati' && <WatiDialog integration={wati} onClose={() => setEditing(null)} onSaved={load} />}
      {editing === 'pms' && <PmsDialog integration={pms} onClose={() => setEditing(null)} onSaved={load} />}
      {editing === 'razorpay' && <RazorpayDialog integration={razorpay} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  )
}

/** Save, then check what was saved (so the card shows Connected or the reason it isn't). */
async function saveAndCheck(provider: IntegrationProvider, settings: Record<string, string>, secret: string) {
  await saveIntegration(provider, settings, secret)
  const result = await checkIntegration(provider)
  toast.add({ title: result.ok ? `Saved. ${result.message}` : `Saved, but the check failed: ${result.message}`, type: result.ok ? 'success' : 'error' })
}

function CheckLine({ result }: { result: CheckResult | null }) {
  if (!result) return null
  return (
    <p className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${result.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
      {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      {result.message}
    </p>
  )
}

function useIntegrationForm(integration: Integration | undefined, defaults: Record<string, string>) {
  const [values, setValues] = useState<Record<string, string>>({ ...defaults, ...(integration?.settings ?? {}) })
  const [secret, setSecret] = useState('')
  const [result, setResult] = useState<CheckResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'test' | 'save' | null>(null)
  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }))
  return { values, set, secret, setSecret, result, setResult, error, setError, busy, setBusy }
}

function WatiDialog({ integration, onClose, onSaved }: { integration?: Integration; onClose: () => void; onSaved: () => void }) {
  const f = useIntegrationForm(integration, { api_endpoint: '', whatsapp_number: '' })
  const [templates, setTemplates] = useState<string[]>([])

  const check = async () => {
    f.setBusy('test'); f.setError('')
    try {
      const result = await checkIntegration('wati', { settings: f.values, secret: f.secret })
      f.setResult(result)
      setTemplates(result.templates)
    } catch (err) {
      f.setError(apiErrorMessage(err, 'The check could not run.'))
    } finally { f.setBusy(null) }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    f.setBusy('save'); f.setError('')
    try {
      await saveAndCheck('wati', f.values, f.secret)
      onSaved(); onClose()
    } catch (err) {
      f.setError(apiErrorMessage(err, 'Could not save.'))
    } finally { f.setBusy(null) }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Connect WhatsApp (WATI)</DialogTitle>
          <DialogDescription>In WATI, open <strong>API Docs</strong> and copy the API endpoint and the access token.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="min-w-0 space-y-4">
          <div>
            <label className={label}>API endpoint</label>
            <input className={field} value={f.values.api_endpoint} onChange={(e) => f.set('api_endpoint', e.target.value)}
              placeholder="https://live-mt-server.wati.io/123456" required />
          </div>
          <div>
            <label className={label}>Access token</label>
            <input type="password" autoComplete="off" className={field} value={f.secret} onChange={(e) => f.setSecret(e.target.value)}
              placeholder={integration?.has_secret ? `Saved (${integration.secret_hint}). Leave blank to keep it.` : 'Bearer eyJ…'}
              required={!integration?.has_secret} />
          </div>
          <div>
            <label className={label}>WhatsApp number patients message</label>
            <input className={field} value={f.values.whatsapp_number ?? ''} onChange={(e) => f.set('whatsapp_number', e.target.value)} placeholder="+91 80 1234 5678" required />
          </div>

          <div className="min-w-0 space-y-2 rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-700">Webhook (so patients' messages reach us)</p>
            <p className="text-xs text-slate-500">
              In WATI, open <strong>Webhooks → Add Webhook</strong>, paste this address, set it to Enabled and tick <strong>Message received</strong>.
            </p>
            <WebhookUrl url={integration?.webhook_url} provider="WATI" />
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" disabled={f.busy !== null} onClick={() => void check()}>
              {f.busy === 'test' ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Test connection
            </Button>
            <span className="text-xs text-slate-500">Also loads your approved message templates.</span>
          </div>
          <CheckLine result={f.result} />

          <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-xs font-semibold text-slate-700">Message templates (optional)</legend>
            <p className="text-xs text-slate-500">Replies in a patient's booking chat need no template. These are for messages we send first.</p>
            {WATI_TEMPLATES.map((t) => {
              const options = Array.from(new Set([...templates, ...(f.values[t.key] ? [f.values[t.key]] : [])]))
              return (
                <div key={t.key}>
                  <label className={label}>{t.label}</label>
                  {options.length ? (
                    <select className={field} value={f.values[t.key] ?? ''} onChange={(e) => f.set(t.key, e.target.value)}>
                      <option value="">Not used</option>
                      {options.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  ) : (
                    <input className={field} value={f.values[t.key] ?? ''} onChange={(e) => f.set(t.key, e.target.value)} placeholder="Template name (Test connection lists them)" />
                  )}
                </div>
              )
            })}
          </fieldset>

          {f.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{f.error}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="default" disabled={f.busy !== null}>{f.busy === 'save' ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PmsDialog({ integration, onClose, onSaved }: { integration?: Integration; onClose: () => void; onSaved: () => void }) {
  const f = useIntegrationForm(integration, {
    system_name: '', base_url: '', auth_type: 'bearer', header_name: 'X-API-Key', doctors_path: '', appointments_path: '',
  })

  const check = async () => {
    f.setBusy('test'); f.setError('')
    try {
      f.setResult(await checkIntegration('pms', { settings: f.values, secret: f.secret }))
    } catch (err) {
      f.setError(apiErrorMessage(err, 'The check could not run.'))
    } finally { f.setBusy(null) }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    f.setBusy('save'); f.setError('')
    try {
      await saveAndCheck('pms', f.values, f.secret)
      onSaved(); onClose()
    } catch (err) {
      f.setError(apiErrorMessage(err, 'Could not save.'))
    } finally { f.setBusy(null) }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Connect your doctor & appointment system</DialogTitle>
          <DialogDescription>The API details your PMS / HIS vendor gives you.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>System name</label>
              <input className={field} value={f.values.system_name} onChange={(e) => f.set('system_name', e.target.value)} placeholder="e.g. Practo, KIMS HIS" />
            </div>
            <div>
              <label className={label}>API address</label>
              <input className={field} value={f.values.base_url} onChange={(e) => f.set('base_url', e.target.value)} placeholder="https://his.example.com" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Send the key as</label>
              <select className={field} value={f.values.auth_type} onChange={(e) => f.set('auth_type', e.target.value)}>
                <option value="bearer">Bearer token</option>
                <option value="header">A named header</option>
              </select>
            </div>
            {f.values.auth_type === 'header' && (
              <div>
                <label className={label}>Header name</label>
                <input className={field} value={f.values.header_name} onChange={(e) => f.set('header_name', e.target.value)} placeholder="X-API-Key" required />
              </div>
            )}
          </div>
          <div>
            <label className={label}>API key</label>
            <input type="password" autoComplete="off" className={field} value={f.secret} onChange={(e) => f.setSecret(e.target.value)}
              placeholder={integration?.has_secret ? `Saved (${integration.secret_hint}). Leave blank to keep it.` : 'Key from your vendor'}
              required={!integration?.has_secret} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Doctors endpoint</label>
              <input className={field} value={f.values.doctors_path} onChange={(e) => f.set('doctors_path', e.target.value)} placeholder="/api/doctors" />
            </div>
            <div>
              <label className={label}>Appointments endpoint</label>
              <input className={field} value={f.values.appointments_path} onChange={(e) => f.set('appointments_path', e.target.value)} placeholder="/api/appointments" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" disabled={f.busy !== null} onClick={() => void check()}>
              {f.busy === 'test' ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Test connection
            </Button>
            <span className="text-xs text-slate-500">Calls the doctors endpoint (or the address) with the key.</span>
          </div>
          <CheckLine result={f.result} />

          {f.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{f.error}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="default" disabled={f.busy !== null}>{f.busy === 'save' ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RazorpayDialog({ integration, onClose, onSaved }: { integration?: Integration; onClose: () => void; onSaved: () => void }) {
  const f = useIntegrationForm(integration, { key_id: '', consultation_fee: '', link_valid_hours: '24' })
  const keyId = f.values.key_id ?? ''

  const check = async () => {
    f.setBusy('test'); f.setError('')
    try {
      f.setResult(await checkIntegration('razorpay', { settings: f.values, secret: f.secret }))
    } catch (err) {
      f.setError(apiErrorMessage(err, 'The check could not run.'))
    } finally { f.setBusy(null) }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    f.setBusy('save'); f.setError('')
    try {
      await saveAndCheck('razorpay', f.values, f.secret)
      onSaved(); onClose()
    } catch (err) {
      f.setError(apiErrorMessage(err, 'Could not save.'))
    } finally { f.setBusy(null) }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Connect Razorpay</DialogTitle>
          <DialogDescription>In Razorpay, open <strong>Account & Settings → API Keys</strong> and generate a key. Use test keys until you go live.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="min-w-0 space-y-4">
          <div>
            <label className={label}>Key ID</label>
            <input className={field} value={keyId} onChange={(e) => f.set('key_id', e.target.value)} placeholder="rzp_test_…" required />
            {keyId.startsWith('rzp_live_') && <p className="mt-1 text-xs text-amber-700">Live key: patients will be charged real money.</p>}
          </div>
          <div>
            <label className={label}>Key Secret</label>
            <input type="password" autoComplete="off" className={field} value={f.secret} onChange={(e) => f.setSecret(e.target.value)}
              placeholder={integration?.has_secret ? `Saved (${integration.secret_hint}). Leave blank to keep it.` : 'Shown once when you generate the key'}
              required={!integration?.has_secret} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Consultation fee (₹)</label>
              <input type="number" min={1} step="any" className={field} value={f.values.consultation_fee} onChange={(e) => f.set('consultation_fee', e.target.value)} placeholder="500" required />
            </div>
            <div>
              <label className={label}>Link valid for (hours)</label>
              <input type="number" min={1} max={720} className={field} value={f.values.link_valid_hours} onChange={(e) => f.set('link_valid_hours', e.target.value)} placeholder="24" />
            </div>
          </div>

          <div className="min-w-0 space-y-2 rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-700">Webhook (so we know when a patient pays)</p>
            <p className="text-xs text-slate-500">
              In Razorpay, open <strong>Account & Settings → Webhooks → Add New Webhook</strong>. Paste this address, enter the secret below,
              and tick <strong>payment_link.paid</strong>, <strong>payment_link.expired</strong> and <strong>payment_link.cancelled</strong>.
            </p>
            <WebhookUrl url={integration?.webhook_url} provider="Razorpay" />
            {integration?.webhook_secret && (
              <div>
                <p className="mb-1 text-xs font-medium text-slate-700">Webhook secret</p>
                <CopyValue value={integration.webhook_secret} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" disabled={f.busy !== null} onClick={() => void check()}>
              {f.busy === 'test' ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Test connection
            </Button>
            <span className="text-xs text-slate-500">Checks the keys with Razorpay. Nothing is charged.</span>
          </div>
          <CheckLine result={f.result} />

          {f.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{f.error}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="default" disabled={f.busy !== null}>{f.busy === 'save' ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
