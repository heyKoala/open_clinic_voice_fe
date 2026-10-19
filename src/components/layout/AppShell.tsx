import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Building2, Menu, PanelLeftClose } from 'lucide-react'
import AccountMenu from '../AccountMenu'
import PatientDrawer from '../PatientDrawer'
import { Toaster } from '../shadcn/toast'

export type NavItem = {
  label: string
  href?: string
  onClick?: () => void
  icon: ReactNode
  /** Group heading shown above the first item of each group (HOME, OPERATIONS…). */
  section?: string
}

type ShellUser = {
  full_name: string
  email: string
  role: string
  clinic_name?: string | null
  is_clinic_admin?: boolean
}

type Clinic = { id: number; name: string; is_active?: boolean }

/**
 * The app's frame (modelled on GoKoala): a dark navy sidebar with the clinic at the top, menu items in
 * labelled groups and the signed-in user at the bottom; the page scrolls on a light background beside it.
 */
export function AppShell({ user, clinics = [], title, nav, children, hasMultiRole, currentView, onSwitchView }: {
  user: ShellUser
  clinics?: Clinic[]
  /** The workspace's name, under the clinic: "Admin console", "Reception desk"… */
  title: string
  nav: NavItem[]
  children: ReactNode
  hasMultiRole?: boolean
  currentView?: string
  onSwitchView?: (view: string) => void
}) {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // The main hospital and its centres (Koramangala, Ballari) share one phone line; staff pick which
  // centre's book they are looking at here. New centres are added by the hospital, not from the app.
  // Default view is every centre at once; picking a centre in the dropdown narrows the lists to it.
  const activeClinicId = localStorage.getItem('active_clinic_id') || (clinics.length > 1 ? 'all' : String(clinics[0]?.id ?? ''))
  const allCentres = activeClinicId === 'all'
  const clinicName = allCentres ? (user.clinic_name || clinics[0]?.name || 'Your hospital') : (clinics.find((c) => String(c.id) === activeClinicId)?.name || user.clinic_name || 'Your hospital')
  const narrow = collapsed ? 'lg:hidden' : ''

  const switchClinic = (id: string) => {
    localStorage.setItem('active_clinic_id', id)
    window.location.reload()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6f7fb] text-slate-900">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#0b1437] text-slate-200 transition-all duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 ${collapsed ? 'lg:w-[76px]' : ''}`}
      >
        {/* Brand + collapse */}
        <div className={`flex h-16 shrink-0 items-center gap-3 px-5 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}>
          {collapsed ? (
            <button type="button" aria-label="Expand menu" title="Expand menu" onClick={() => setCollapsed(false)} className="hidden !min-h-0 lg:block">
              <img src="/gunasheela_mark.png" alt="" className="h-8 w-8 rounded-lg bg-white object-cover" />
            </button>
          ) : null}
          <img src="/gunasheela_mark.png" alt="" className={`h-8 w-8 shrink-0 rounded-lg bg-white object-cover ${collapsed ? 'lg:hidden' : ''}`} />
          <span className={`flex-1 truncate text-base font-bold tracking-tight text-white ${narrow}`} title="Gunasheela Hospital">Gunasheela</span>
          <button
            type="button"
            aria-label="Collapse menu"
            title="Collapse menu"
            onClick={() => setCollapsed(true)}
            className={`hidden !min-h-0 rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:block ${narrow}`}
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Clinic */}
        <div className={`mx-3 mb-2 mt-1 rounded-xl border border-white/10 bg-white/[0.04] p-3 ${collapsed ? 'lg:p-2' : ''}`}>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-slate-200">
              <Building2 className="h-4 w-4" />
            </span>
            <div className={`min-w-0 flex-1 ${narrow}`}>
              <p className="truncate text-sm font-semibold text-white" title={clinicName}>{clinicName}</p>
              <p className="truncate text-xs text-slate-400">{allCentres && clinics.length > 1 ? `${title} · All centres` : title}</p>
            </div>
          </div>
          {clinics.length > 1 && (
            <select
              aria-label="Switch centre"
              value={activeClinicId}
              onChange={(e) => switchClinic(e.target.value)}
              className={`mt-3 h-8 w-full rounded-lg border border-white/10 bg-[#0b1437] px-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 ${narrow}`}
            >
              <option value="all">All centres</option>
              {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3" aria-label="Main">
          {nav.map((item, i) => {
            const isActive = !!item.href && (location.pathname === item.href || location.pathname.startsWith(`${item.href}/`))
            const heading = item.section && item.section !== nav[i - 1]?.section ? item.section : null
            const body = (
              <>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center [&_svg]:!opacity-100 ${isActive ? 'text-cyan-300' : 'text-slate-400 group-hover:text-slate-200'}`}>
                  {item.icon}
                </span>
                <span className={`truncate ${narrow}`}>{item.label}</span>
              </>
            )
            const className = `group flex w-full !min-h-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-[15px] transition-colors ${
              isActive ? 'bg-white/10 font-semibold text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
            } ${collapsed ? 'lg:justify-center lg:px-0' : ''}`
            return (
              <div key={item.label}>
                {heading && (
                  <p className={`px-3 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 ${collapsed ? 'lg:hidden' : ''}`}>
                    {heading}
                  </p>
                )}
                {item.href ? (
                  <Link to={item.href} title={collapsed ? item.label : undefined} onClick={() => setMobileOpen(false)} className={className}>
                    {body}
                  </Link>
                ) : (
                  <button type="button" title={collapsed ? item.label : undefined} onClick={item.onClick} className={className}>
                    {body}
                  </button>
                )}
              </div>
            )
          })}
        </nav>

        {/* Signed-in user */}
        <div className="shrink-0 border-t border-white/10">
          <AccountMenu
            userName={user.full_name}
            userEmail={user.email}
            userRole={user.role}
            align="top"
            tone="dark"
            hasMultiRole={hasMultiRole}
            currentView={currentView}
            onSwitchView={onSwitchView}
            textClassName={narrow}
          />
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Page ─────────────────────────────────────────────── */}
      <div className={`flex h-screen min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out ${collapsed ? 'lg:ml-[76px]' : 'lg:ml-64'}`}>
        <header className="flex h-14 w-full shrink-0 items-center justify-between gap-3 px-4 lg:px-8">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="!min-h-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        {/* Only the page content scrolls. */}
        <main className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-6 md:px-6 lg:px-8">
          {children}
        </main>
        <Toaster />
        <PatientDrawer />
      </div>
    </div>
  )
}
