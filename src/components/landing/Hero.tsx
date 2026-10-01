import { Link } from 'react-router-dom'
import { ArrowRight, MessageSquare, CheckCircle } from 'lucide-react'
import { useInView } from './LandingHooks'

export function Hero() {
  const { ref, inView } = useInView()

  return (
    <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:px-8 font-jakarta">
      {/* Soft background glow on light canvas */}
      <div className="pointer-events-none absolute left-1/4 top-0 -z-10 h-[500px] w-[600px] -translate-x-1/2 rounded-full bg-[#34E0FF]/10 blur-[140px]" />
      <div className="pointer-events-none absolute right-1/4 top-32 -z-10 h-[350px] w-[400px] rounded-full bg-[#030D39]/5 blur-[100px]" />

      <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        {/* Left — headline + CTAs */}
        <div
          ref={ref}
          className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* Live badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#06B6D4]/30 bg-[#34E0FF]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#030D39]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-live-pulse rounded-full bg-[#06B6D4] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#06B6D4]" />
            </span>
            Live in 9 Indian Languages
          </div>

          {/* Headline */}
          <h1
            className="text-[2.9rem] font-extrabold leading-[1.02] tracking-[-0.03em] text-[#030D39] sm:text-6xl"
          >
            The clinic that never misses a follow-up<span className="text-[#34E0FF]">.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
            ManageOPD automates your OPD queue, generates accurate clinical summaries from patient calls, and handles follow-ups — all fully compliant with ABHA and DPDP standards.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-[#34E0FF] px-6 py-3.5 text-base font-bold text-[#030D39] shadow-cyan-glow transition-all hover:shadow-cyan-glow-hover hover:scale-[1.02]"
            >
              Start Free Trial <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-transparent px-6 py-3.5 text-base font-semibold text-[#030D39] transition-all hover:bg-[#030D39] hover:text-white hover:-translate-y-0.5"
            >
              See how it works
            </a>
          </div>

          {/* Social proof micro-row */}
          <div className="mt-8 flex items-center gap-4 text-sm text-slate-500">
            <div className="flex -space-x-2">
              {['bg-[#34E0FF]', 'bg-[#06B6D4]', 'bg-[#030D39]'].map((c, i) => (
                <div key={i} className={`h-8 w-8 rounded-full border-2 border-white ${c}`} />
              ))}
            </div>
            <span>Trusted by <strong className="text-[#030D39]">500+</strong> Indian clinics</span>
          </div>
        </div>

        {/* Right — Live Call Widget (navy card pattern) */}
        <div className="relative">
          {/* Main navy card */}
          <div
            className="relative z-10 overflow-hidden rounded-2xl border border-white/10 bg-[#030D39] shadow-navy-card"
          >
            {/* Card header */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-live-pulse rounded-full bg-[#06B6D4] opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#06B6D4]" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#70DEFD]">
                  Live Call · Appointment Booking
                </span>
              </div>
              <MessageSquare className="h-4 w-4 text-white/30" />
            </div>

            {/* Chat bubbles */}
            <div className="space-y-3 p-5">
              {/* Patient message */}
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white/[0.06] px-4 py-3">
                <p className="text-sm leading-relaxed text-slate-200">
                  Namaste, Dr. Sharma ke liye kal subah 10 baje appointment chahiye.
                </p>
              </div>

              {/* AI reply */}
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm border border-[#34E0FF]/20 bg-[#34E0FF]/[0.08] px-4 py-3">
                <p className="text-xs font-semibold text-[#70DEFD]">ManageOPD AI</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-100">
                  Bilkul! Dr. Sharma ke saath kal 10:00 AM slot available hai. Kya aapka naam confirm kar sakte hain?
                </p>
              </div>

              {/* Patient reply */}
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white/[0.06] px-4 py-3">
                <p className="text-sm leading-relaxed text-slate-200">
                  Rahul Verma. ABHA ID: 12-3456-7890-1234
                </p>
              </div>
            </div>

            {/* Footer strip */}
            <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
              <span className="text-xs font-medium text-white/40">PICKUP: 0.4s</span>
              <span className="text-xs font-medium text-[#06B6D4]">QUEUE: Live</span>
              <span className="text-xs font-medium text-[#22C55E]">WHATSAPP: Confirmed</span>
            </div>
          </div>

          {/* Floating popup confirmation card */}
          <div className="absolute -bottom-5 -right-4 z-20 w-56 rounded-2xl border border-slate-200 bg-white p-4 shadow-popup-card">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#22C55E]/15">
                <CheckCircle className="h-5 w-5 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#030D39]">Appointment Booked</p>
                <p className="mt-0.5 text-xs text-slate-500">WhatsApp token sent to Rahul V.</p>
                <p className="mt-1 text-[11px] font-medium text-[#06B6D4]">Token #7 · Dr. Sharma</p>
              </div>
            </div>
          </div>

          {/* Underglow */}
          <div className="absolute -bottom-8 left-[12.5%] -z-10 h-8 w-3/4 rounded-full bg-[#030D39]/15 blur-3xl" />
        </div>
      </div>
    </section>
  )
}
