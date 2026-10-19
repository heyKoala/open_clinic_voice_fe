import type { ReactNode } from 'react'
import { Building2, CalendarOff, CreditCard, PhoneOutgoing, Users } from 'lucide-react'
import { PageTabs } from '../components/PageTabs'
import { ClinicDetailsForm } from '../components/settings/ClinicDetailsForm'
import { ClinicHolidays } from '../components/settings/ClinicHolidays'
import { PatientCallSettingsForm } from '../components/settings/PatientCallSettingsForm'

/**
 * Admin settings in one place: the clinic itself, its holidays, its team and its plan.
 * The AI receptionist and its phone number live on the AI Agent page.
 */
export default function ClinicSettings({ onClinicSaved, team, billing }: {
  onClinicSaved?: () => Promise<void> | void
  team: ReactNode
  billing: ReactNode
}) {
  return (
    <PageTabs
      title="Settings"
      description="Your hospital's details, holidays, patient calls, team and plan."
      tabs={[
        { id: 'clinic', label: 'Hospital details', icon: Building2, content: <ClinicDetailsForm onSaved={onClinicSaved} /> },
        { id: 'holidays', label: 'Holidays', icon: CalendarOff, content: <ClinicHolidays /> },
        { id: 'calls', label: 'Reminders & feedback', icon: PhoneOutgoing, content: <PatientCallSettingsForm /> },
        { id: 'team', label: 'Team', icon: Users, content: team },
        { id: 'billing', label: 'Billing', icon: CreditCard, content: billing },
      ]}
    />
  )
}
