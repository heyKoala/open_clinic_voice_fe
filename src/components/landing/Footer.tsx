import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section className="relative overflow-hidden bg-slate-50 py-24 font-jakarta">
      {/* Faint radial glow on light surface */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#34E0FF]/12 blur-[120px]" />

      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Get Started Today
        </p>
        <h2 className="text-4xl font-extrabold tracking-[-0.02em] text-[#030D39] sm:text-5xl lg:text-6xl">
          Ready to modernize your clinic<span className="text-[#34E0FF]">?</span>
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Join leading Indian healthcare providers using ManageOPD to automate their front desk and empower their doctors.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-[#34E0FF] px-8 py-4 text-base font-bold text-[#030D39] shadow-cyan-glow transition-all hover:shadow-cyan-glow-hover hover:scale-[1.02]"
          >
            Create Free Clinic Account <ArrowRight className="h-5 w-5" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-8 py-4 text-base font-semibold text-[#030D39] transition-all hover:bg-[#030D39] hover:text-white hover:border-transparent hover:-translate-y-0.5"
          >
            See all features
          </a>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          No credit card required · 14-day free trial · Cancel anytime
        </p>
      </div>
    </section>
  )
}

export function Footer() {
  const columns = [
    {
      heading: 'Product',
      links: ['Features', 'Pricing', 'How it works', 'Changelog'],
    },
    {
      heading: 'Company',
      links: ['About', 'Blog', 'Careers', 'Press'],
    },
    {
      heading: 'Support',
      links: ['Help Center', 'Contact Sales', 'DPDP Compliance', 'Security'],
    },
  ]

  return (
    <footer className="bg-[#030D39] font-jakarta">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Top row */}
        <div className="grid gap-12 md:grid-cols-[1fr_auto_auto_auto]">
          {/* Brand */}
          <div>
            <div className="text-2xl font-extrabold tracking-tight text-white">ManageOPD</div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
              The AI-powered receptionist built for Indian clinics. Automate calls, queues, and clinical notes.
            </p>
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-live-pulse rounded-full bg-[#06B6D4] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#06B6D4]" />
              </span>
              <span className="font-medium text-slate-100">Live in 9 Indian Languages</span>
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.heading}>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#70DEFD]">
                {col.heading}
              </p>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-slate-400 transition-colors hover:text-slate-100"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="my-10 h-px bg-white/10" />

        {/* Bottom row */}
        <div className="flex flex-col items-center justify-between gap-4 text-sm text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} ManageOPD Healthcare AI. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-slate-300">Privacy Policy</a>
            <a href="#" className="hover:text-slate-300">Terms of Service</a>
            <a href="#" className="hover:text-slate-300">ABHA Compliance</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
