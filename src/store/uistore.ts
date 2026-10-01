import { create } from 'zustand'
import { toast } from '../components/shadcn/toast'

export type ConsoleTab = 'dashboard' | 'leads' | 'followups' | 'calllogs' | 'livequeue' | 'patients' | 'doctors' | 'calendar' | 'settings'
export type UserRole = 'clinic_admin' | 'doctor' | 'receptionist'

export type Toast = {
  id: string
  message: string
  type?: 'success' | 'info' | 'warning' | 'error'
}

type UIState = {
  activeTab: ConsoleTab
  isSidebarOpen: boolean
  selectedPatientId: string | number | null
  selectedPatient: any | null
  selectedDoctor: string
  selectedLocation: string
  userRole: UserRole
  toasts: Toast[]
  refreshTick: number
}

type UIActions = {
  setActiveTab: (activeTab: ConsoleTab) => void
  toggleSidebar: () => void
  setSelectedPatientId: (selectedPatientId: string | number | null) => void
  setSelectedPatient: (selectedPatient: any | null) => void
  setSelectedDoctor: (selectedDoctor: string) => void
  setSelectedLocation: (selectedLocation: string) => void
  setUserRole: (userRole: UserRole) => void
  addToast: (message: string, type?: Toast['type']) => void
  removeToast: (id: string) => void
  triggerRefresh: () => void
  reset: () => void
}

const initialState: UIState = {
  activeTab: 'dashboard',
  isSidebarOpen: false,
  selectedPatientId: null,
  selectedPatient: null,
  selectedDoctor: 'Dr. Rao',
  selectedLocation: 'Sunrise Polyclinic',
  userRole: 'receptionist',
  toasts: [],
  refreshTick: 0,
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  ...initialState,
  setActiveTab: (activeTab) => set({ activeTab, isSidebarOpen: false }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSelectedPatientId: (selectedPatientId) => set({ selectedPatientId }),
  setSelectedPatient: (selectedPatient) => set({ selectedPatient }),
  setSelectedDoctor: (selectedDoctor) => set({ selectedDoctor }),
  setSelectedLocation: (selectedLocation) => set({ selectedLocation }),
  setUserRole: (userRole) => set({ userRole }),
  addToast: (message, type = 'info') => {
    toast.add({ title: message, type })
  },
  removeToast: (_id) => {
    // Unsupported in this delegated setup natively without keeping IDs, but rarely used directly.
  },
  triggerRefresh: () => set((state) => ({ refreshTick: state.refreshTick + 1 })),
  reset: () => set(initialState)
}))
