import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { useUIStore } from '../store/uistore'
import { Button } from '../components/ui/Button'
import { EditMemberDialog } from '../components/EditMemberDialog'
import { MoreHorizontal, Shield, Mail, User as UserIcon, UserPlus, Trash2, CheckCircle2, Pencil } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup
} from '../components/shadcn/dropdown-menu'

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

export default function TeamSettings({ team, invites, loading, load, user, reloadUser }: any) {
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'doctor' | 'receptionist'>('doctor')
  const { addToast } = useUIStore()
  const [isInviting, setIsInviting] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const handleSendInvite = async (e: FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return
    setIsInviting(true)
    try {
      await api.post('/accounts/invites/', { email: inviteEmail, role: inviteRole })
      setInviteEmail('')
      addToast('Invitation sent.', 'success')
      await load()
    } catch {
      addToast('Could not send invitation. Check seat limits and email availability.', 'error')
    } finally {
      setIsInviting(false)
    }
  }

  const toggleMember = async (member: any) => {
    const isActive = member.membership_status === 'active' || member.is_active !== false;
    const endpoint = isActive ? `/auth/users/${member.id}/deactivate/` : `/auth/users/${member.id}/reactivate/`
    try {
      await api.post(endpoint)
      addToast(`${member.full_name} updated.`, 'success')
      await load()
    } catch {
      addToast('Could not update the team member.', 'error')
    }
  }

  const toggleAdmin = async (member: any) => {
    try {
      await api.post(`/auth/users/${member.id}/toggle-admin/`)
      await load()
    } catch (e) {
      addToast('Failed to toggle admin rights.', 'error')
    }
  }

  const toggleDoctor = async (member: any) => {
    try {
      await api.post(`/auth/users/${member.id}/toggle-doctor/`)
      await load()
      if (member.id === user.id && reloadUser) {
        await reloadUser()
      }
    } catch (e) {
      addToast('Failed to toggle doctor rights.', 'error')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">Team Settings</h1>
        <p className="text-slate-500">Manage and view your coworkers and guests.</p>
      </div>

      {/* Invite Bar */}
      <form onSubmit={handleSendInvite} className="flex flex-col md:flex-row gap-4 items-center bg-white p-3 pr-3 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex-1 w-full flex items-center pl-3">
          <Mail className="h-4 w-4 text-slate-400 mr-2" />
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Add emails to invite..."
            className="w-full bg-transparent border-none focus:ring-0 text-slate-900 placeholder-slate-400 text-sm py-2"
            required
          />
        </div>
        <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
        <div className="flex w-full md:w-auto items-center gap-2 pl-2 md:pl-0">
          <select
            value={inviteRole}
            onChange={(e: any) => setInviteRole(e.target.value)}
            className="bg-transparent border-none text-sm text-slate-600 focus:ring-0 font-medium cursor-pointer py-2 pl-2 pr-6"
          >
            <option value="doctor">Doctor</option>
            <option value="receptionist">Receptionist</option>
          </select>
          <Button
            type="submit"
            disabled={isInviting || !inviteEmail}
            className="bg-slate-950 hover:bg-slate-800 text-white shadow-sm rounded-lg whitespace-nowrap px-6 py-2 transition-all w-full md:w-auto"
          >
            {isInviting ? 'Inviting...' : 'Invite'}
          </Button>
        </div>
      </form>

      <div className="space-y-6">
        {/* Invites Table */}
        {invites && invites.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 px-1">
              <Mail className="h-4 w-4 text-slate-400" /> Pending Invitations
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium hidden sm:table-cell">Invited At</th>
                    <th className="px-5 py-3 font-medium">Role</th>
                    <th className="px-5 py-3 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invites.map((invite: any) => (
                    <tr key={invite.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-slate-700">{invite.email}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 hidden sm:table-cell">
                        {formatDate(invite.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="capitalize text-slate-600">{invite.role.replace('_', ' ')}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${invite.status === 'Accepted' ? 'bg-emerald-100 text-emerald-800' : invite.status === 'Pending' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'}`}>
                          {invite.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Team Members Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <UserIcon className="h-4 w-4 text-slate-400" /> Active Members
            </div>
            {loading && <span className="text-xs text-slate-400 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div> Refreshing...</span>}
          </div>
          
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3 font-medium">Member</th>
                  <th className="px-5 py-3 font-medium hidden sm:table-cell">Contact</th>
                  <th className="px-5 py-3 font-medium">Permissions</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(team?.members || []).map((member: any) => {
                  const isActive = member.membership_status === 'active' || member.is_active !== false;
                  return (
                    <tr key={member.id} className={`group hover:bg-slate-50/50 transition-colors ${!isActive ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-100 to-indigo-100 flex items-center justify-center text-cyan-800 font-semibold text-xs border border-cyan-200/50">
                            {member.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900 flex items-center gap-1.5">
                              {member.full_name}
                              {member.id === user.id && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">(You)</span>}
                            </span>
                            <span className="text-xs text-slate-500 capitalize md:hidden">{member.role.replace('_', ' ')}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <span className="text-slate-500 text-sm">{member.email}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 capitalize">
                            {member.role.replace('_', ' ')}
                          </span>
                          {member.is_clinic_admin && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                              <Shield className="w-3 h-3" /> Admin
                            </span>
                          )}
                          {member.is_doctor && member.role !== 'doctor' && (
                            <span className="inline-flex rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">
                              Doctor
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                          <span className="text-slate-600 text-sm capitalize">{isActive ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 rounded-lg">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-white rounded-xl shadow-lg border border-slate-100 p-1">
                            <DropdownMenuGroup>
                              <DropdownMenuLabel className="text-xs font-semibold text-slate-400 px-2 py-1.5 uppercase tracking-wider">Actions</DropdownMenuLabel>

                              <DropdownMenuItem onClick={() => setEditingId(member.id)} className="text-sm px-2 py-2 cursor-pointer hover:bg-slate-50 rounded-lg flex items-center gap-2">
                                <Pencil className="h-4 w-4 text-slate-400" /> Edit details
                              </DropdownMenuItem>

                              {member.role !== 'clinic_admin' && (
                                <DropdownMenuItem onClick={() => void toggleMember(member)} className="text-sm px-2 py-2 cursor-pointer hover:bg-slate-50 rounded-lg flex items-center gap-2">
                                  {isActive ? (
                                    <><Trash2 className="h-4 w-4 text-red-500" /> <span className="text-red-600 font-medium">Deactivate</span></>
                                  ) : (
                                    <><CheckCircle2 className="h-4 w-4 text-emerald-500" /> <span className="text-emerald-700 font-medium">Activate</span></>
                                  )}
                                </DropdownMenuItem>
                              )}

                              {member.role === 'doctor' && isActive && (
                                <>
                                  <DropdownMenuSeparator className="bg-slate-100 mx-1" />
                                  <DropdownMenuItem onClick={() => void toggleAdmin(member)} className="text-sm px-2 py-2 cursor-pointer hover:bg-slate-50 rounded-lg flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-slate-400" /> {member.is_clinic_admin ? 'Revoke Admin' : 'Make Admin'}
                                  </DropdownMenuItem>
                                </>
                              )}
                              
                              {member.role === 'clinic_admin' && isActive && (
                                <>
                                  <DropdownMenuSeparator className="bg-slate-100 mx-1" />
                                  <DropdownMenuItem onClick={() => void toggleDoctor(member)} className="text-sm px-2 py-2 cursor-pointer hover:bg-slate-50 rounded-lg flex items-center gap-2">
                                    <UserPlus className="h-4 w-4 text-slate-400" /> {member.is_doctor ? 'Revoke Doctor' : 'Make Doctor'}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <EditMemberDialog
        memberId={editingId}
        onClose={() => setEditingId(null)}
        onSaved={async () => {
          await load()
          if (editingId === user.id && reloadUser) await reloadUser()
        }}
      />
    </div>
  )
}
