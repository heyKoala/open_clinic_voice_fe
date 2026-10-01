import { useInView } from './LandingHooks'

const steps = [
  {
    number: '01',
    title: 'Patient Calls',
    description:
      "Our AI receptionist answers in the patient's native language, books the appointment, and triages symptoms — no hold music, no missed calls.",
  },
  {
    number: '02',
    title: 'Smart Queue',
    description:
      'Patients check in and track their live token status via WhatsApp, reducing front-desk crowding and staff burden.',
  },
  {
    number: '03',
    title: 'Doctor Reviews',
    description:
      'The doctor reviews the AI-generated clinical summary directly in their workspace before the patient walks in — zero typing required.',
  },
]

export function HowItWorks() {
  const { ref, inView } = useInView()

  return (
    <section id="how-it-works" className="relative overflow-hidden bg-white py-24 font-jakarta">
      {/* Faint dot grid texture */}
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-60" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            How It Works
          </p>
          <h2 className="text-4xl font-extrabold tracking-[-0.02em] text-[#030D39] sm:text-5xl">
            From first call to clinic visit<span className="text-[#34E0FF]">.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-slate-600">
            An effortless, automated journey that keeps your team focused on care — not admin.
          </p>
        </div>

        {/* Step timeline */}
        <div
          ref={ref}
          className={`grid gap-12 lg:grid-cols-3 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {steps.map((step, i) => (
            <div key={i} className="relative">
              {/* Connector line between steps */}
              {i < steps.length - 1 && (
                <div className="absolute left-[50%] top-10 hidden h-px w-full bg-gradient-to-r from-[#34E0FF]/30 to-transparent lg:block" />
              )}

              <div className="relative z-10 flex flex-col items-center text-center">
                {/* Number badge */}
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-[#34E0FF]/30 bg-[#34E0FF]/8 text-2xl font-extrabold text-[#030D39] shadow-[0_0_24px_rgba(52,224,255,0.12)]">
                  {step.number}
                </div>

                <h3 className="mb-3 text-2xl font-bold text-[#030D39]">{step.title}</h3>
                <p className="text-[15px] leading-relaxed text-slate-600">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
