import { useUIStore } from '../store/uistore'
import AccountMenu from './AccountMenu'

export default function Header() {
  const { selectedDoctor, setSelectedDoctor, selectedLocation } = useUIStore()

  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 pl-16 md:pl-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 font-bold">
          S
        </div>
        <div>
          <h2 className="text-sm font-semibold leading-tight">{selectedLocation}</h2>
          <p className="text-xs text-slate-400">Indiranagar, Bengaluru</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 sm:inline">
          9 languages active
        </span>
        <select value={selectedDoctor} onChange={(e) => setSelectedDoctor(e.target.value)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
          <option>Dr. Rao</option>
          <option>Dr. Verma</option>
          <option>Dr. Nair</option>
        </select>
        <AccountMenu userName="Admin" userEmail="admin@clinic.local" align="right" />
      </div>
    </header>
  )
}
