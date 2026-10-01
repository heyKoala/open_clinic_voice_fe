import { Check, Zap } from 'lucide-react'
import { useInView } from './LandingHooks'

const plans = [
  {
    name: 'Starter',
    price: '₹2,999',
    period: '/month',
    description: 'Perfect for independent clinics',
    features: [
      'Up to 500 patients/month',
      'Basic AI call triaging',
      'Live token queue',
      'WhatsApp notifications',
      'Email support',
    ],
    highlight: false,
    cta: 'Get started',
  },
  {
    name: 'Growth',
    price: '₹7,999',
    period: '/month',
    description: 'For busy multi-doctor practices',
    features: [
      'Up to 3,000 patients/month',
      'Advanced AI clinical summaries',
      'Automated WhatsApp follow-ups',
      'Custom AI agent voice',
      'Priority 24/7 support',
    ],
    highlight: true,
    cta: 'Start Free Trial',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large hospital networks',
    features: [
      'Unlimited patients',
      'Dedicated account manager',
      'On-premise deployment options',
      'Custom EHR integrations',
      'SLA guarantees',
    ],
    highlight: false,
    cta: 'Contact sales',
  },
]

export function Pricing() {
  const { ref, inView } = useInView()

  return (
    <section id="pricing" className="bg-slate-50 py-24 font-jakarta">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Pricing
          </p>
          <h2 className="text-4xl font-extrabold tracking-[-0.02em] text-[#030D39] sm:text-5xl">
            Transparent pricing<span className="text-[#34E0FF]">.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-slate-600">
            Scale your clinical operations without breaking the bank. Start free, grow at your pace.
          </p>
        </div>

        <div
          ref={ref}
          className={`grid gap-8 lg:grid-cols-3 lg:items-start transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-3xl p-8 transition-all ${
                plan.highlight
                  ? 'bg-[#030D39] shadow-navy-card lg:-translate-y-4'
                  : 'border border-slate-200 bg-white shadow-sm'
              }`}
            >
              {/* Most popular badge */}
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full border border-[#34E0FF]/30 bg-[#030D39] px-4 py-1 shadow-sm">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#34E0FF]">
                    <Zap className="h-3 w-3 fill-[#34E0FF]" />
                    Most Popular
                  </p>
                </div>
              )}

              <h3
                className={`text-2xl font-bold ${plan.highlight ? 'text-[#34E0FF]' : 'text-[#030D39]'}`}
              >
                {plan.name}
              </h3>
              <p className={`mt-1 text-sm ${plan.highlight ? 'text-slate-400' : 'text-slate-500'}`}>
                {plan.description}
              </p>

              <div className="my-6">
                <span
                  className={`text-5xl font-extrabold tracking-tight ${plan.highlight ? 'text-white' : 'text-[#030D39]'}`}
                >
                  {plan.price}
                </span>
                {plan.period && (
                  <span className={`ml-1 text-base ${plan.highlight ? 'text-slate-400' : 'text-slate-500'}`}>
                    {plan.period}
                  </span>
                )}
              </div>

              <a
                href="/signup"
                className={`mb-8 flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                  plan.highlight
                    ? 'bg-[#34E0FF] text-[#030D39] shadow-cyan-glow hover:shadow-cyan-glow-hover hover:scale-[1.02]'
                    : 'border border-slate-300 bg-white text-[#030D39] hover:bg-[#030D39] hover:text-white hover:border-transparent'
                }`}
              >
                {plan.cta}
              </a>

              <ul className="space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 ${plan.highlight ? 'text-[#34E0FF]' : 'text-[#030D39]'}`}
                    />
                    <span
                      className={`text-sm ${plan.highlight ? 'text-slate-300' : 'text-slate-600'}`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
