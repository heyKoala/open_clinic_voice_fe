import { CalendarDays, LayoutDashboard, ListChecks, Settings, Users } from 'lucide-react'
import { useUIStore, type ConsoleTab, type UserRole } from '../store/uistore'

type Item = { id: ConsoleTab; label: string; icon: typeof LayoutDashboard }
const navigation: Record<UserRole, Item[]> = {
  clinic_admin: [{ id: 'dashboard', label: 'Home', icon: LayoutDashboard }, { id: 'patients', label: 'Patients', icon: Users }, { id: 'livequeue', label: 'Queue', icon: ListChecks }, { id: 'settings', label: 'Settings', icon: Settings }],
  doctor: [{ id: 'dashboard', label: 'Home', icon: LayoutDashboard }, { id: 'calendar', label: 'Schedule', icon: CalendarDays }, { id: 'livequeue', label: 'Queue', icon: ListChecks }, { id: 'patients', label: 'Patients', icon: Users }],
  receptionist: [{ id: 'dashboard', label: 'Home', icon: LayoutDashboard }, { id: 'patients', label: 'Patients', icon: Users }, { id: 'calendar', label: 'Schedule', icon: CalendarDays }, { id: 'livequeue', label: 'Queue', icon: ListChecks }],
}
export default function MobileNavigation() {
  const { activeTab, setActiveTab, userRole } = useUIStore()
  return <nav aria-label="Primary navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden"><div className="mx-auto grid max-w-lg grid-cols-4">{navigation[userRole].map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setActiveTab(id)} aria-current={activeTab === id ? 'page' : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-medium ${activeTab === id ? 'text-emerald-700' : 'text-slate-600'}`}><Icon aria-hidden="true" className="h-5 w-5" /><span>{label}</span></button>)}</div></nav>
}
