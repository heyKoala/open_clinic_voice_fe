import { useState, useEffect, type FormEvent } from 'react'
import { api } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/shadcn/input'
import { Label } from '../components/shadcn/label'
import { useUIStore } from '../store/uistore'
import { Link } from 'react-router-dom'

interface MeDto {
  id: number
  email: string
  full_name: string
  role: 'clinic_admin' | 'doctor' | 'receptionist'
  clinic: number | null
  clinic_name: string | null
  doctor_profile_id?: number | null
  age?: number | null
  gender?: string | null
}

interface DoctorDto {
  id: number
  full_name: string
  degree: string
  specialty: string
  consultation_minutes: number
}

interface ProfileSettingsProps {
  user: MeDto
  reloadUser?: () => Promise<void>
}

export default function ProfileSettings({ user, reloadUser }: ProfileSettingsProps) {
  const { addToast } = useUIStore()

  // --- RECEPTIONIST / BASIC USER STATE ---
  const [fullName, setFullName] = useState(user.full_name)
  const [age, setAge] = useState(user.age ? String(user.age) : '')
  const [gender, setGender] = useState(user.gender || 'unspecified')
  const [isUpdatingAccount, setIsUpdatingAccount] = useState(false)

  // --- DOCTOR STATE ---
  const [degree, setDegree] = useState('')
  const [specialty, setSpecialty] = useState('General Practice')
  const [isUpdatingDoctor, setIsUpdatingDoctor] = useState(false)

  useEffect(() => {
    setFullName(user.full_name)
    setAge(user.age ? String(user.age) : '')
    setGender(user.gender || 'unspecified')
  }, [user])

  useEffect(() => {
    if (user.role === 'doctor' && user.doctor_profile_id) {
      const loadDoctorProfile = async () => {
        try {
          const res = await api.get(`/doctors/${user.doctor_profile_id}/`)
          const profile = res.data as DoctorDto
          setDegree(profile.degree || '')
          setSpecialty(profile.specialty || 'General Practice')
        } catch {
          addToast('Could not retrieve doctor profile details.', 'error')
        }
      }
      void loadDoctorProfile()
    }
  }, [user.role, user.doctor_profile_id, addToast])

  const handleUpdateAccount = async (e: FormEvent) => {
    e.preventDefault()
    setIsUpdatingAccount(true)
    try {
      await api.patch('/auth/me/', { 
        full_name: fullName,
        age: age ? parseInt(age, 10) : null,
        gender: gender
      })
      addToast('Profile updated successfully.', 'success')
      if (reloadUser) await reloadUser()
    } catch {
      addToast('Failed to update account details.', 'error')
    } finally {
      setIsUpdatingAccount(false)
    }
  }

  const handleUpdateDoctor = async (e: FormEvent) => {
    e.preventDefault()
    if (!user.doctor_profile_id) return
    setIsUpdatingDoctor(true)
    try {
      // Also update base user stats (age, gender) alongside doctor stats
      await api.patch('/auth/me/', { 
        full_name: fullName,
        age: age ? parseInt(age, 10) : null,
        gender: gender
      })
      await api.patch(`/doctors/${user.doctor_profile_id}/`, {
        degree,
        specialty,
      })
      addToast('Doctor details updated successfully.', 'success')
      if (reloadUser) await reloadUser()
    } catch {
      addToast('Failed to save doctor details.', 'error')
    } finally {
      setIsUpdatingDoctor(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
      
      {user.role === 'clinic_admin' && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-6">
          <div>
            <h3 className="text-base font-semibold text-slate-950">Looking for clinic details?</h3>
            <p className="text-sm text-slate-500">The clinic's name, contact details, holidays, phone number and AI receptionist are under Settings.</p>
          </div>
          <Link to="/app/settings" className="inline-flex items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800">
            Open Settings
          </Link>
        </Card>
      )}

      {/* -----------------------------
          DOCTOR VIEW
      ----------------------------- */}
      {user.role === 'doctor' && (
        <Card className="p-6 space-y-5">
          <div>
            <h3 className="text-xl font-semibold text-slate-950">About Doctor</h3>
            <p className="text-sm text-slate-500">Your professional profile details.</p>
          </div>
          <form onSubmit={handleUpdateDoctor} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="docFullName">Full Name</Label>
              <Input
                id="docFullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="docAge">Age</Label>
                <Input
                  id="docAge"
                  type="number"
                  min="1"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="docGender">Gender</Label>
                <select
                  id="docGender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="unspecified">Prefer not to say</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="degree">Degree(s)</Label>
              <Input
                id="degree"
                type="text"
                value={degree}
                onChange={(e) => setDegree(e.target.value)}
                placeholder="e.g. MBBS, MD"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="specialty">Specialty</Label>
              <Input
                id="specialty"
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="e.g. General Practice, Pediatrics"
                required
              />
            </div>

            <div className="pt-2">
              <Button type="submit" variant="default" disabled={isUpdatingDoctor}>
                {isUpdatingDoctor ? 'Saving...' : 'Update Doctor Profile'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* -----------------------------
          RECEPTIONIST / ADMIN VIEW
      ----------------------------- */}
      {user.role !== 'doctor' && (
        <Card className="p-6 space-y-5">
          <div>
            <h3 className="text-xl font-semibold text-slate-950">About Me</h3>
            <p className="text-sm text-slate-500">Your personal profile information.</p>
          </div>
          <form onSubmit={handleUpdateAccount} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="recFullName">Full Name</Label>
              <Input
                id="recFullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="recAge">Age</Label>
              <Input
                id="recAge"
                type="number"
                min="1"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="recGender">Gender</Label>
              <select
                id="recGender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="unspecified">Prefer not to say</option>
              </select>
            </div>

            <div className="pt-2">
              <Button type="submit" variant="default" disabled={isUpdatingAccount}>
                {isUpdatingAccount ? 'Saving...' : 'Update Profile'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      </div>

    </div>
  )
}
