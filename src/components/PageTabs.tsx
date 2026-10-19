import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

export type PageTab = { id: string; label: string; icon: LucideIcon; content: ReactNode }

/**
 * A page made of tabs. The open tab lives in the URL (?tab=phone) so it can be linked to; the first tab
 * is the default and has no ?tab. Tabs load on first visit and then stay mounted, so switching tabs
 * doesn't lose unsaved edits.
 */
export function PageTabs({ title, description, tabs }: { title: string; description: string; tabs: PageTab[] }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const active = tabs.some((tab) => tab.id === requested) ? (requested as string) : tabs[0].id

  const [visited, setVisited] = useState<string[]>([active])
  useEffect(() => {
    setVisited((current) => (current.includes(active) ? current : [...current, active]))
  }, [active])

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <div role="tablist" className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active === id}
              onClick={() => setSearchParams(id === tabs[0].id ? {} : { tab: id })}
              className={`flex h-9 !min-h-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors ${active === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {tabs.map(({ id, content }) => visited.includes(id) && (
        <div key={id} hidden={active !== id}>
          {content}
        </div>
      ))}
    </div>
  )
}
