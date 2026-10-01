import { Navbar } from './Navbar'
import { Hero } from './Hero'
import { StatsBar } from './StatsBar'
import { Features } from './Features'
import { HowItWorks } from './HowItWorks'
import { Testimonials, FAQ } from './FAQ'
import { Pricing } from './Pricing'
import { CTASection, Footer } from './Footer'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-jakarta overflow-x-hidden selection:bg-[#34E0FF]/30">
      <Navbar />
      {/* pt clears the fixed 65px navbar */}
      <main className="pt-[65px]">
        <Hero />
        <StatsBar />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Pricing />
        <FAQ />
        <CTASection />
        <Footer />
      </main>
    </div>
  )
}
