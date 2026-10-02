import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bot, Building2, CalendarOff, Phone, PhoneCall, type LucideIcon } from 'lucide-react'
import { ClinicDetailsForm } from '../components/settings/ClinicDetailsForm'
import { ClinicHolidays } from '../components/settings/ClinicHolidays'
import { PhoneNumberPanel } from '../components/PhoneNumberPanel'
import AgentSettings from './AgentSettings'

type TabId = 'clinic' | 'holidays' | 'phone' | 'ai'

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'clinic', label: 'Clinic details', icon: Building2 },
  { id: 'holidays', label: 'Holidays', icon: CalendarOff },
  { id: 'phone', label: 'Phone number', icon: Phone },
  { id: 'ai', label: 'AI receptionist', icon: Bot },
]

/** Admin settings in one place. The open tab lives in the URL (?tab=ai) so it can be linked to. */
export default function ClinicSettings({ onClinicSaved }: { onClinicSaved?: () => Promise<void> | void }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const active: TabId = TABS.some((tab) => tab.id === requested) ? (requested as TabId) : 'clinic'

  // Tabs load on first visit and then stay mounted, so switching tabs doesn't lose unsaved edits.
  const [visited, setVisited] = useState<TabId[]>([active])
  useEffect(() => {
    setVisited((current) => (current.includes(active) ? current : [...current, active]))
  }, [active])

  const panel = (id: TabId) => visited.includes(id)

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h2>
        <p className="mt-1 text-sm text-slate-500">Your clinic's details, holidays, phone number and AI receptionist.</p>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <div role="tablist" className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active === id}
              onClick={() => setSearchParams(id === 'clinic' ? {} : { tab: id })}
              className={`flex h-9 !min-h-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors ${active === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {panel('clinic') && (
        <div hidden={active !== 'clinic'}>
          <ClinicDetailsForm onSaved={onClinicSaved} />
        </div>
      )}

      {panel('holidays') && (
        <div hidden={active !== 'holidays'}>
          <ClinicHolidays />
        </div>
      )}

      {panel('phone') && (
        <div hidden={active !== 'phone'} className="space-y-6">
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
            <div>
              <h3 className="text-base font-semibold text-slate-900">AI receptionist phone number</h3>
              <p className="mt-1 text-sm text-slate-500">
                Patients call this number to reach your AI receptionist. It belongs to the main clinic and is shared by all of its centres.
              </p>
            </div>
            <PhoneNumberPanel />
          </section>
          <p className="text-sm text-slate-500">
            The front desk number shown to patients is separate.{' '}
            <button type="button" className="!min-h-0 font-semibold text-slate-900 underline-offset-2 hover:underline" onClick={() => setSearchParams({})}>
              Edit it under Clinic details
            </button>
            .
          </p>
        </div>
      )}

      {panel('ai') && (
        <div hidden={active !== 'ai'} className="space-y-4">
          <AgentSettings />
          <Link to="/app/call-agent" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 underline-offset-2 hover:underline">
            <PhoneCall className="h-4 w-4" /> Try it with a test call
          </Link>
        </div>
      )}
    </div>
  )
}
