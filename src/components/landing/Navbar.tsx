import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ]

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 font-jakarta transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm'
          : 'bg-white border-b border-slate-100'
      }`}
    >
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-xl font-extrabold tracking-tight text-[#030D39] leading-none flex items-center">
            ManageOPD
          </span>
          <span className="hidden sm:inline-flex items-center justify-center rounded-full bg-[#34E0FF]/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#030D39]">
            AI Receptionist
          </span>
        </div>

        {/* Desktop links */}
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-500 md:flex h-full">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="transition-colors hover:text-[#030D39] inline-flex items-center h-full pt-1"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-[#030D39] transition-all hover:bg-[#030D39] hover:text-white hover:border-transparent"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center justify-center rounded-xl bg-[#34E0FF] px-5 py-2.5 text-sm font-bold text-[#030D39] shadow-cyan-glow transition-all hover:shadow-cyan-glow-hover hover:scale-[1.02]"
          >
            Start Free Trial
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-slate-100 bg-white px-4 pb-4 pt-2 md:hidden">
          <div className="grid gap-1 text-sm">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-3 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                {link.label}
              </a>
            ))}
            <div className="my-2 h-px bg-slate-100" />
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="rounded-xl px-3 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              onClick={() => setMobileOpen(false)}
              className="rounded-xl bg-[#34E0FF] px-3 py-2.5 text-center font-bold text-[#030D39]"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
