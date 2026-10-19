import { BookOpen, Bot, Phone, PhoneCall, PhoneOutgoing } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageTabs } from '../components/PageTabs'
import { PhoneNumberPanel } from '../components/PhoneNumberPanel'
import AgentSettings from './AgentSettings'
import CallAgent from './CallAgent'
import CallScripts from './CallScripts'
import Knowledge from './Knowledge'

/** Everything about the AI receptionist in one place: how it talks, its calls to patients, the number, and a test call. */
export default function AIAgent() {
  return (
    <PageTabs
      title="AI Agent"
      description="Set up your AI receptionist, what it says when it calls patients, the number patients call, and try it with a test call."
      tabs={[
        { id: 'settings', label: 'Agent settings', icon: Bot, content: <AgentSettings /> },
        { id: 'scripts', label: 'Call scripts', icon: PhoneOutgoing, content: <CallScripts /> },
        { id: 'knowledge', label: 'Knowledge', icon: BookOpen, content: <Knowledge /> },
        {
          id: 'phone',
          label: 'Phone number',
          icon: Phone,
          content: (
            <div className="space-y-6">
              <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">AI receptionist phone number</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Patients call this number to reach your AI receptionist.
                  </p>
                </div>
                <PhoneNumberPanel />
              </section>
              <p className="text-sm text-slate-500">
                The front desk number shown to patients is separate.{' '}
                <Link to="/app/settings" className="font-semibold text-slate-900 underline-offset-2 hover:underline">
                  Edit it under Settings → Hospital details
                </Link>
                .
              </p>
            </div>
          ),
        },
        { id: 'test', label: 'Test call', icon: PhoneCall, content: <CallAgent /> },
      ]}
    />
  )
}
