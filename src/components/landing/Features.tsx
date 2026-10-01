import { Bot, Smartphone, Shield, FileText, Stethoscope, LineChart } from 'lucide-react'
import { useInView } from './LandingHooks'

const features = [
  {
    icon: <Bot className="h-5 w-5 text-[#3B82F6]" />,
    step: '01',
    title: 'AI Call Summaries',
    description: 'Automatically transcribe and summarize patient calls in 9 regional languages. Ready for doctor review before the patient walks in.',
  },
  {
    icon: <Smartphone className="h-5 w-5 text-[#3B82F6]" />,
    step: '02',
    title: 'Smart OPD Queue',
    description: 'Patients monitor their token status live via WhatsApp, reducing waiting room crowding by up to 40%.',
  },
  {
    icon: <Shield className="h-5 w-5 text-[#3B82F6]" />,
    step: '03',
    title: 'ABHA & DPDP Compliant',
    description: 'Built for the Indian healthcare ecosystem with deep encryption and strict role-based data isolation.',
  },
  {
    icon: <FileText className="h-5 w-5 text-[#3B82F6]" />,
    step: '04',
    title: 'Automated Clinical Notes',
    description: 'Symptom summaries feed directly into clinical notes, saving doctors hours of manual chart typing per day.',
  },
  {
    icon: <Stethoscope className="h-5 w-5 text-[#3B82F6]" />,
    step: '05',
    title: 'Follow-up Campaigns',
    description: 'Trigger automated post-visit care messages and chronic illness check-ins without receptionist intervention.',
  },
  {
    icon: <LineChart className="h-5 w-5 text-[#3B82F6]" />,
    step: '06',
    title: 'Clinic Analytics',
    description: 'Live dashboards for wait times, conversion rates, and staff performance aggregated across your entire hospital.',
  },
]

// Competitive comparison data
const genericChatbot = [
  'Generic scripted responses',
  'English only',
  'No ABHA integration',
  'Manual handoff to staff',
  'No clinical context',
]
const manageopdAgent = [
  'Contextual AI with medical vocabulary',
  '9 Indian regional languages',
  'Native ABHA & DPDP compliance',
  'Auto-generates clinical summaries',
  'Full EHR-ready output',
]

export function Features() {
  const { ref, inView } = useInView()
  const { ref: compRef, inView: compInView } = useInView()

  return (
    <section id="features" className="bg-slate-50 py-24 font-jakarta">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Platform Capabilities
          </p>
          <h2 className="text-4xl font-extrabold tracking-[-0.02em] text-[#030D39] sm:text-5xl">
            Everything a modern clinic needs<span className="text-[#34E0FF]">.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
            Streamline your front desk and empower your clinical staff — all in one platform.
          </p>
        </div>

        {/* Feature stepped grid */}
        <div
          ref={ref}
          className={`grid gap-0 md:grid-cols-2 lg:grid-cols-3 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {features.map((feature, i) => (
            <div
              key={i}
              className="group border-t border-[#030D39] bg-white p-8 transition-colors hover:bg-slate-50 first:rounded-tl-2xl last:rounded-br-2xl md:[&:nth-child(2)]:rounded-tr-2xl md:[&:nth-child(5)]:rounded-bl-2xl"
            >
              <p className="mb-2 text-xs font-semibold text-slate-400">{feature.step}</p>
              <div className="mb-4 inline-flex rounded-xl bg-blue-50 p-2.5 ring-1 ring-blue-100">
                {feature.icon}
              </div>
              <h3 className="mb-2 text-lg font-bold text-[#030D39]">{feature.title}</h3>
              <p className="text-[15px] leading-relaxed text-slate-600">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Competitive comparison card */}
        <div
          ref={compRef}
          className={`mt-16 overflow-hidden rounded-2xl border border-slate-200 transition-all duration-700 ${compInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="grid md:grid-cols-2">
            {/* Left — generic chatbot (muted) */}
            <div className="p-8">
              <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Generic Chatbot
              </p>
              <ul className="divide-y divide-slate-100">
                {genericChatbot.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 py-3 text-sm text-slate-400">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — ManageOPD (navy surface) */}
            <div className="bg-[#030D39] p-8">
              <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#34E0FF]">
                ManageOPD AI Agent
              </p>
              <ul className="divide-y divide-white/10">
                {manageopdAgent.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 py-3 text-sm text-slate-100">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#34E0FF]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
