import { useEffect, useState, type FormEvent } from 'react'
import { Phone, Search, Check, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react'
import { api } from '../lib/api'
import { formatPhoneNumber } from '../lib/phone'
import { useUIStore } from '../store/uistore'
import { Button } from './ui/Button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './shadcn/dialog'

type OwnedNumber = {
  number: string
  display: string
  status: 'active' | 'purchased' | 'pending'
  city: string
  monthly_rental_rate: string
  last_error: string
  /** false: an existing number linked to the clinic; removing it only disconnects it. */
  bought_here: boolean
}

type PhoneNumberState = {
  phone_number: OwnedNumber | null
  owner_clinic: { id: number; name: string }
  shared_with: string[]
  can_purchase: boolean
}

type AvailableNumber = {
  number: string
  city: string
  region: string
  type: string
  monthly_rental_rate: string | null
  setup_rate: string | null
  requires_compliance: boolean
}

function price(rate: string | null) {
  const value = Number(rate)
  return Number.isFinite(value) && value > 0 ? `$${value.toFixed(2)}/month` : ''
}

function errorMessage(err: any, fallback: string) {
  const data = err?.response?.data
  return data?.detail || data?.number?.[0] || data?.type?.[0] || fallback
}

const STATUS_LABEL: Record<OwnedNumber['status'], { text: string; className: string }> = {
  active: { text: 'Active — calls reach your AI receptionist', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  purchased: { text: 'Bought, not yet connected to the AI receptionist', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  pending: { text: 'Awaiting approval from the telecom provider (KYC)', className: 'bg-amber-50 text-amber-700 border-amber-200' },
}

/**
 * Search for, buy, and manage the clinic's phone number. The number belongs to the main clinic and
 * is shared by all of its centres. Calls `onChange` with the owned number (or null).
 */
export function PhoneNumberPanel({ onChange }: { onChange?: (number: OwnedNumber | null) => void }) {
  const { addToast } = useUIStore()
  const [state, setState] = useState<PhoneNumberState | null>(null)
  const [loadError, setLoadError] = useState('')
  const [city, setCity] = useState('Bangalore')
  const [pattern, setPattern] = useState('')
  const [results, setResults] = useState<AvailableNumber[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [toBuy, setToBuy] = useState<AvailableNumber | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmRelease, setConfirmRelease] = useState(false)

  const apply = (data: PhoneNumberState) => {
    setState(data)
    onChange?.(data.phone_number)
  }

  useEffect(() => {
    api.get('/clinics/phone-number/')
      .then(res => apply(res.data))
      .catch(err => setLoadError(errorMessage(err, 'Could not load the phone number.')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const search = async (e?: FormEvent) => {
    e?.preventDefault()
    setSearching(true)
    try {
      const res = await api.get('/clinics/phone-number/search/', { params: { city: city.trim(), pattern: pattern.trim(), type: 'local' } })
      setResults(res.data.numbers)
    } catch (err) {
      addToast(errorMessage(err, 'Number search failed.'), 'error')
    } finally {
      setSearching(false)
    }
  }

  const buy = async () => {
    if (!toBuy) return
    setBusy(true)
    try {
      const res = await api.post('/clinics/phone-number/', {
        number: toBuy.number, city: toBuy.city, monthly_rental_rate: toBuy.monthly_rental_rate, country_iso: 'IN',
      })
      apply(res.data)
      setResults(null)
      const bought = res.data.phone_number as OwnedNumber
      addToast(bought.status === 'active'
        ? `${formatPhoneNumber(bought.number)} is now your clinic's number.`
        : `${formatPhoneNumber(bought.number)} was bought. ${STATUS_LABEL[bought.status].text}.`,
        bought.status === 'active' ? 'success' : 'warning')
    } catch (err) {
      addToast(errorMessage(err, 'Could not buy the number.'), 'error')
    } finally {
      setBusy(false)
      setToBuy(null)
    }
  }

  const activate = async () => {
    setBusy(true)
    try {
      const res = await api.post('/clinics/phone-number/activate/')
      apply(res.data)
      addToast('The number is connected to your AI receptionist.', 'success')
    } catch (err: any) {
      if (err?.response?.data?.phone_number) apply(err.response.data)
      addToast(errorMessage(err, 'Still could not connect the number. Try again later.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const release = async () => {
    setBusy(true)
    try {
      await api.delete('/clinics/phone-number/')
      const wasBought = state!.phone_number?.bought_here
      apply({ ...state!, phone_number: null })
      addToast(wasBought ? 'The number was released.' : 'The number was disconnected.', 'success')
    } catch (err) {
      addToast(errorMessage(err, 'Could not release the number.'), 'error')
    } finally {
      setBusy(false)
      setConfirmRelease(false)
    }
  }

  if (loadError) {
    return <p className="text-sm text-slate-500 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">{loadError}</p>
  }
  if (!state) {
    return <div className="flex items-center gap-2 text-sm text-slate-500 p-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
  }

  const owned = state.phone_number
  const sharedNote = state.shared_with.length > 1
    ? `Shared by all ${state.shared_with.length} centres: ${state.shared_with.join(', ')}.`
    : 'Any centres you add later will share this number.'

  if (owned) {
    const label = STATUS_LABEL[owned.status]
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white"><Phone className="h-5 w-5" /></div>
            <div>
              <p className="font-mono text-lg font-bold text-slate-900">{formatPhoneNumber(owned.number)}</p>
              <p className="text-xs text-slate-500">{[owned.city, price(owned.monthly_rental_rate)].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${label.className}`}>{label.text}</span>
        </div>
        <p className="text-sm text-slate-500">{sharedNote}</p>
        {owned.last_error && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {owned.last_error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {owned.status !== 'active' && (
            <Button type="button" onClick={() => void activate()} disabled={busy}>
              <RefreshCw className="h-4 w-4 mr-2" /> Connect to AI receptionist
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={() => setConfirmRelease(true)} disabled={busy}>
            {owned.bought_here ? 'Release number' : 'Disconnect number'}
          </Button>
        </div>

        <Dialog open={confirmRelease} onOpenChange={setConfirmRelease}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{owned.bought_here ? 'Release' : 'Disconnect'} {formatPhoneNumber(owned.number)}?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">
              {owned.bought_here
                ? 'Patients calling this number will no longer reach any of your centres, and the number goes back to the provider. You may not be able to get the same number again.'
                : 'The number will no longer be linked to your centres here. It stays on your telecom account and is not released.'}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setConfirmRelease(false)}>Keep it</Button>
              <Button onClick={() => void release()} disabled={busy} className="bg-red-600 hover:bg-red-700">
                {busy ? 'Working…' : owned.bought_here ? 'Release number' : 'Disconnect number'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  if (!state.can_purchase) {
    return <p className="text-sm text-slate-500 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">Buying numbers isn't set up on this server yet.</p>
  }

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-[160px] space-y-1">
          <span className="text-xs font-medium text-slate-600">City</span>
          <input value={city} onChange={e => setCity(e.target.value)} placeholder="Bangalore"
                 className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
        </label>
        <label className="w-40 space-y-1">
          <span className="text-xs font-medium text-slate-600">Starts with (after +91, optional)</span>
          <input value={pattern} onChange={e => setPattern(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 8031"
                 className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900" />
        </label>
        <Button type="submit" disabled={searching}>
          {searching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />} Search
        </Button>
      </form>

      {results !== null && (results.length === 0 ? (
        <p className="text-sm text-slate-500 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">No numbers found. Try another city, or fewer starting digits.</p>
      ) : (
        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
          {results.map(n => (
            <button key={n.number} type="button" onClick={() => setToBuy(n)}
                    className="w-full flex items-center justify-between gap-3 rounded-xl border-2 border-slate-200 p-3 text-left hover:border-emerald-400 transition-colors">
              <div>
                <p className="font-mono text-sm font-bold text-slate-900">{formatPhoneNumber(n.number)}</p>
                <p className="text-xs text-slate-500">{[n.city, n.type].filter(Boolean).join(' · ')}{n.requires_compliance ? ' · needs business KYC' : ''}</p>
              </div>
              <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">{price(n.monthly_rental_rate)}</span>
            </button>
          ))}
        </div>
      ))}

      <p className="text-xs text-slate-500">{sharedNote}</p>

      <Dialog open={!!toBuy} onOpenChange={open => { if (!open) setToBuy(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Buy {toBuy ? formatPhoneNumber(toBuy.number) : ''}?</DialogTitle></DialogHeader>
          {toBuy && (
            <div className="space-y-3 text-sm text-slate-600">
              <p>
                This rents the number from the telecom provider{price(toBuy.monthly_rental_rate) ? ` for ${price(toBuy.monthly_rental_rate)}` : ''}
                {Number(toBuy.setup_rate) > 0 ? ` plus a $${Number(toBuy.setup_rate).toFixed(2)} setup fee` : ''}, charged to your provider account.
              </p>
              <p>Patients calling it will reach your AI receptionist, which can book at every one of your centres.</p>
              {toBuy.requires_compliance && (
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Indian numbers need your business documents (KYC) approved by the provider. Until then the number may stay pending.
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setToBuy(null)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void buy()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              {busy ? 'Buying…' : 'Buy number'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
