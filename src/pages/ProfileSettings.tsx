import { useState, useEffect, type FormEvent } from 'react'
import { api } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/shadcn/input'
import { Label } from '../components/shadcn/label'
import { useUIStore } from '../store/uistore'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Trash2 } from 'lucide-react'

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

interface ClinicDto {
  id: number
  name: string
  address: string
  clinic_type: string
  phone?: string
  support_email?: string
  website?: string
  registration_number?: string
  tax_id?: string
  description?: string
  facilities?: string
  holiday_calendar?: string
}

interface ClinicConfigDto {
  working_hours_start: string
  working_hours_end: string
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

  // --- ADMIN STATE (CLINIC) ---
  const [clinicName, setClinicName] = useState('')
  const [address, setAddress] = useState('')
  const [clinicType, setClinicType] = useState('multi_doctor')
  const [phone, setPhone] = useState('')
  const [supportEmail, setSupportEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [taxId, setTaxId] = useState('')
  const [description, setDescription] = useState('')
  const [facilities, setFacilities] = useState('')
  const [holidayCalendar, setHolidayCalendar] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [clinicSpecialties, setClinicSpecialties] = useState<string[]>([])
  const [isUpdatingClinic, setIsUpdatingClinic] = useState(false)

  // --- HOLIDAY CALENDAR STATE ---
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [markedHolidays, setMarkedHolidays] = useState<{date: string, reason: string}[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

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

  useEffect(() => {
    if (user.role === 'clinic_admin' && user.clinic) {
      const loadClinicDetails = async () => {
        try {
          const [clinicRes, configRes, holidaysRes] = await Promise.all([
            api.get(`/clinics/${user.clinic}/`),
            api.get(`/clinics/configuration/`),
            api.get(`/clinics/holidays/`)
          ])
          const c = clinicRes.data as ClinicDto
          const conf = configRes.data as ClinicConfigDto
          const hols = holidaysRes.data as {date: string, reason: string}[]
          
          setClinicName(c.name || '')
          setAddress(c.address || '')
          setClinicType(c.clinic_type || 'multi_doctor')
          setPhone(c.phone || '')
          setSupportEmail(c.support_email || '')
          setWebsite(c.website || '')
          setRegistrationNumber(c.registration_number || '')
          setTaxId(c.tax_id || '')
          setDescription(c.description || '')
          setFacilities(c.facilities || '')
          setHolidayCalendar(c.holiday_calendar || '')
          if (Array.isArray(hols)) {
            setMarkedHolidays(hols)
          }
          
          // Formats "09:00:00" to "09:00"
          if (conf.working_hours_start) setStartTime(conf.working_hours_start.substring(0, 5))
          if (conf.working_hours_end) setEndTime(conf.working_hours_end.substring(0, 5))

          // Fetch doctors to determine available specialties
          const doctorsRes = await api.get('/doctors/', { params: { page_size: 100 } })
          const docs = Array.isArray(doctorsRes.data?.results) ? doctorsRes.data.results : (Array.isArray(doctorsRes.data) ? doctorsRes.data : [])
          const uniqueSpecialties = Array.from(new Set(docs.map((d: any) => d.specialty).filter(Boolean))) as string[]
          setClinicSpecialties(uniqueSpecialties.length > 0 ? uniqueSpecialties : ['General Practice'])

        } catch {
          addToast('Could not retrieve clinic details.', 'error')
        }
      }
      void loadClinicDetails()
    }
  }, [user.role, user.clinic, addToast])

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

  const handleUpdateClinic = async (e: FormEvent) => {
    e.preventDefault()
    if (!user.clinic) return
    setIsUpdatingClinic(true)
    try {
      await api.patch(`/clinics/${user.clinic}/`, {
        name: clinicName,
        address: address,
        clinic_type: clinicType,
        phone,
        support_email: supportEmail,
        website,
        registration_number: registrationNumber,
        tax_id: taxId,
        description,
        facilities,
        holiday_calendar: holidayCalendar
      })
      await api.patch(`/clinics/configuration/`, {
        working_hours_start: startTime,
        working_hours_end: endTime
      })
      addToast('Clinic details updated successfully.', 'success')
      if (reloadUser) await reloadUser()
    } catch {
      addToast('Failed to save clinic details.', 'error')
    } finally {
      setIsUpdatingClinic(false)
    }
  }

  const handleMarkHoliday = async () => {
    if (!selectedDate) return
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    try {
      await api.post(`/clinics/holidays/`, { date: dateStr, reason: 'Admin marked holiday' })
      addToast(`Marked ${dateStr} as a holiday. Existing appointments on this day have been cancelled and patients notified via WhatsApp.`, 'success')
      setMarkedHolidays([...markedHolidays, { date: dateStr, reason: 'Admin marked holiday' }])
      setSelectedDate(null)
    } catch {
      addToast('Failed to mark holiday.', 'error')
    }
  }

  const handleRemoveHoliday = async (dateStr: string) => {
    try {
      await api.delete(`/clinics/holidays/${dateStr}/`)
      addToast(`Removed holiday on ${dateStr}.`, 'success')
      setMarkedHolidays(markedHolidays.filter(h => h.date !== dateStr))
    } catch {
      addToast('Failed to remove holiday.', 'error')
    }
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
      
      {/* -----------------------------
          CLINIC ADMIN VIEW
      ----------------------------- */}
      {user.role === 'clinic_admin' && (
        <Card className="p-6 space-y-5">
          <div>
            <h3 className="text-xl font-semibold text-slate-950">About Clinic</h3>
            <p className="text-sm text-slate-500">Manage your clinic's primary information.</p>
          </div>
          <form onSubmit={handleUpdateClinic} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="clinicName">Clinic Name</Label>
              <Input
                id="clinicName"
                type="text"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="address">Clinic Address</Label>
              <textarea
                id="address"
                className="w-full min-h-[80px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter the full address..."
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="clinicType">Clinic Type</Label>
              <select
                id="clinicType"
                value={clinicType}
                onChange={(e) => setClinicType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="single_doctor">Single Doctor Practice</option>
                <option value="multi_doctor">Multi-Doctor Clinic</option>
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="startTime">Opening Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="endTime">Closing Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <div className="space-y-1">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567 8900" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input id="supportEmail" type="email" value={supportEmail} onChange={e => setSupportEmail(e.target.value)} placeholder="hello@clinic.com" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="website">Website</Label>
                <Input id="website" type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="regNum">Registration / License No.</Label>
                <Input id="regNum" value={registrationNumber} onChange={e => setRegistrationNumber(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="taxId">Tax ID (Optional)</Label>
                <Input id="taxId" value={taxId} onChange={e => setTaxId(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1 pt-2 border-t border-slate-100">
              <Label htmlFor="desc">Short Clinic Description & Bio</Label>
              <textarea
                id="desc"
                className="w-full min-h-[60px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="We are a modern multi-specialty clinic focused on..."
              />
              <p className="text-[10px] text-slate-500">This bio is fed directly to the AI agent to help it answer general inquiries about your clinic.</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="facilities">Facilities & Amenities</Label>
              <textarea
                id="facilities"
                className="w-full min-h-[60px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                value={facilities}
                onChange={e => setFacilities(e.target.value)}
                placeholder="Free underground parking, wheelchair ramps at entrance, on-site pharmacy..."
              />
              <p className="text-[10px] text-slate-500">List amenities as sentences. The AI agent will use this to answer questions like "Do you have parking?".</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="holidays">Holiday & Closure Calendar</Label>
              <textarea
                id="holidays"
                className="w-full min-h-[60px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                value={holidayCalendar}
                onChange={e => setHolidayCalendar(e.target.value)}
                placeholder="We are closed every Sunday, and will be closed on December 25th and 26th."
              />
            </div>

            <div className="space-y-1 pt-2">
              <Label>Specialties Offered</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {clinicSpecialties.map((spec, idx) => (
                  <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {spec}
                  </span>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">Specialties are automatically determined from your active doctors.</p>
            </div>

            <div className="pt-2">
              <Button type="submit" variant="default" disabled={isUpdatingClinic}>
                {isUpdatingClinic ? 'Saving...' : 'Update Clinic Info'}
              </Button>
            </div>
          </form>
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
          RECEPTIONIST VIEW
      ----------------------------- */}
      {user.role === 'receptionist' && (
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

      {/* -----------------------------
          RIGHT COLUMN: MINI CALENDAR
      ----------------------------- */}
      {user.role === 'clinic_admin' && (
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-950 flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Clinic Holidays
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Click a date to mark it as a holiday. The AI will stop booking on these days.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-slate-700">{format(currentMonth, 'MMMM yyyy')}</h4>
              <div className="flex gap-1">
                <button onClick={prevMonth} className="p-1 rounded hover:bg-slate-100 text-slate-500"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={nextMonth} className="p-1 rounded hover:bg-slate-100 text-slate-500"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <div key={day}>{day}</div>)}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {/* Padding for first day of month */}
              {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                <div key={`pad-${i}`} className="p-2" />
              ))}
              
              {daysInMonth.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const isHoliday = markedHolidays.some(h => h.date === dateStr)
                const isPast = day < new Date(new Date().setHours(0,0,0,0))
                const isSelected = selectedDate && isSameDay(day, selectedDate)

                return (
                  <button
                    key={dateStr}
                    disabled={isPast}
                    onClick={() => {
                      if (!isHoliday) setSelectedDate(day)
                    }}
                    className={`
                      p-2 text-sm rounded-lg aspect-square flex items-center justify-center relative
                      ${isPast ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-slate-100 cursor-pointer text-slate-700'}
                      ${isHoliday ? 'bg-red-50 text-red-600 font-bold border border-red-200 hover:bg-red-100' : ''}
                      ${isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                    `}
                  >
                    {format(day, 'd')}
                    {isHoliday && <div className="absolute bottom-1 w-1 h-1 bg-red-500 rounded-full" />}
                  </button>
                )
              })}
            </div>

            {selectedDate && (
              <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-sm font-medium mb-3">Mark {format(selectedDate, 'MMM d, yyyy')} as a holiday?</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleMarkHoliday} className="flex-1">Confirm</Button>
                  <Button size="sm" variant="outline" onClick={() => setSelectedDate(null)} className="flex-1">Cancel</Button>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 text-center">
                  This will cancel all appointments on this date and notify patients.
                </p>
              </div>
            )}

            {markedHolidays.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-100">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Upcoming Holidays</h4>
                <div className="space-y-2">
                  {markedHolidays.filter(h => new Date(h.date) >= new Date(new Date().setHours(0,0,0,0))).sort((a,b) => a.date.localeCompare(b.date)).map(h => (
                    <div key={h.date} className="flex items-center justify-between p-2 rounded-lg bg-red-50 text-red-800 text-sm">
                      <span className="font-medium">{format(new Date(h.date), 'MMM d, yyyy')}</span>
                      <button onClick={() => handleRemoveHoliday(h.date)} className="p-1 hover:bg-red-100 rounded text-red-600" title="Remove holiday">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

    </div>
  )
}
