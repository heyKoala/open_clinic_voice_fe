import { useState } from 'react'
import { LogOut, User as UserIcon } from 'lucide-react'
import { api } from '../lib/api'
import { roleLabel } from '../lib/utils'
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
  /** "dark" for the navy sidebar. */
  tone?: 'light' | 'dark'
}

export default function AccountMenu({ userName, userEmail, userRole, align = 'right', hasMultiRole, currentView, onSwitchView, textClassName, tone = 'light' }: AccountMenuProps) {
  const dark = tone === 'dark'
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
        <DropdownMenuTrigger className={`flex w-full items-center gap-3 px-4 py-3 text-sm transition outline-hidden ${dark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${dark ? 'bg-white text-[#0b1437]' : 'bg-slate-900 text-white'}`}>
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <div className={`min-w-0 flex-1 text-left ${textClassName || ''}`}>
            <p className={`truncate text-sm font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>{userName}</p>
            <p className={`truncate text-xs capitalize ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{userRole ? roleLabel(userRole) : 'Account'}</p>
          </div>
          <LogOut aria-hidden="true" className={`h-4 w-4 shrink-0 text-slate-400 ${textClassName || ''}`} />
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
                onSwitchView(currentView === 'clinic_admin' ? 'receptionist' : 'clinic_admin')
                navigate('/app/dashboard')
              }}
            >
              <span>Switch to {currentView === 'clinic_admin' ? 'Reception desk' : 'Admin console'}</span>
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

