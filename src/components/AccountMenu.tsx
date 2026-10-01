import { useState } from 'react'
import { LogOut, User as UserIcon } from 'lucide-react'
import { api } from '../lib/api'
import { useUIStore } from '../store/uistore'
import { useNavigate } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from './shadcn/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './shadcn/alert-dialog'

interface AccountMenuProps {
  userName: string
  userEmail: string
  userRole?: string
  align?: 'left' | 'right' | 'top'
  hasMultiRole?: boolean
  currentView?: string
  onSwitchView?: (view: string) => void
  textClassName?: string
}

export default function AccountMenu({ userName, userEmail, userRole, align = 'right', hasMultiRole, currentView, onSwitchView, textClassName }: AccountMenuProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout/')
    } catch {
      // Ignore logout failures and still clear the browser session.
    }
    useUIStore.getState().reset()
    window.location.assign('/login')
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-3 px-4 py-3 text-sm transition hover:bg-slate-50 outline-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <div className={`min-w-0 flex-1 text-left ${textClassName || ''}`}>
            <p className="truncate text-sm font-semibold text-slate-900">{userName}</p>
            <p className="truncate text-xs text-slate-500">{userRole ? userRole.replace('_', ' ') : 'Account'}</p>
          </div>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align={align === 'left' ? 'start' : align === 'right' ? 'end' : 'center'}
          side={align === 'top' ? 'top' : 'bottom'}
          className="w-56"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="truncate font-medium text-slate-900 leading-none">{userName}</p>
                <p className="truncate text-sm text-slate-500 leading-none mt-1">{userEmail}</p>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/app/profile')}>
            <UserIcon className="mr-2 h-4 w-4" />
            <span>Profile settings</span>
          </DropdownMenuItem>

          {hasMultiRole && onSwitchView && (
            <DropdownMenuItem
              className="cursor-pointer text-emerald-700 focus:text-emerald-700 focus:bg-emerald-50"
              onClick={() => {
                onSwitchView(currentView === 'clinic_admin' ? 'doctor' : 'clinic_admin')
                navigate('/app/dashboard')
              }}
            >
              <span>Switch to {currentView === 'clinic_admin' ? 'Doctor Workspace' : 'Admin Console'}</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50"
            onClick={(e) => {
              e.preventDefault() // prevent closing immediately if needed, or let it close
              setShowConfirm(true)
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out? Unsaved work may be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirm(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleLogout()} className="bg-rose-600 hover:bg-rose-700">
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

