import { useState } from 'react'
import { ChevronDown, Star } from 'lucide-react'
import { useInView } from './LandingHooks'

const reviews = [
  {
    quote:
      "ManageOPD's AI receptionist handles 80% of our patient calls. The ABHA compliance and WhatsApp queue integration completely eliminated our front-desk bottleneck.",
    author: 'Dr. Vikram S.',
    role: 'Chief Medical Officer, Apex Health',
    rating: 5,
  },
  {
    quote:
      'The symptom summaries are incredibly accurate. Before the patient even walks in, I have a structured clinical note ready to go — it saves me at least 2 hours daily.',
    author: 'Dr. Meera P.',
    role: 'Senior Pediatrician, Healthify Clinics',
    rating: 5,
  },
]

const faqs = [
  {
    q: 'Is ManageOPD compliant with Indian healthcare data laws?',
    a: 'Yes. ManageOPD is fully compliant with the Digital Personal Data Protection (DPDP) Act and supports ABHA integrations out of the box. All patient data is encrypted at rest and in transit with strict role-based access controls.',
  },
  {
    q: 'Which regional languages are supported?',
    a: 'The AI agent can converse natively in 9 languages: Indian English, Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, and Gujarati — with more in development.',
  },
  {
    q: 'How does the WhatsApp queue work?',
    a: "When a patient checks in, they receive a WhatsApp message with a link to their live token status. They're notified automatically when their turn approaches, eliminating overcrowded waiting rooms.",
  },
  {
    q: 'Can ManageOPD integrate with our existing EHR system?',
    a: 'Yes. We offer API-level integrations with major Indian EHR platforms. Enterprise plans include dedicated integration support and custom EHR connectors.',
  },
]

export function Testimonials() {
  const { ref, inView } = useInView()

  return (
    <section id="testimonials" className="bg-slate-50 py-24 font-jakarta">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Trusted by Doctors
          </p>
          <h2 className="text-4xl font-extrabold tracking-[-0.02em] text-[#030D39] sm:text-5xl">
            What clinicians are saying<span className="text-[#34E0FF]">.</span>
          </h2>
        </div>

        <div
          ref={ref}
          className={`grid gap-8 md:grid-cols-2 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {reviews.map((review, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
            >
              {/* Stars */}
              <div className="mb-4 flex gap-1">
                {Array.from({ length: review.rating }).map((_, si) => (
                  <Star key={si} className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
                ))}
              </div>

              <p className="text-lg font-medium leading-relaxed text-[#030D39]">
                &ldquo;{review.quote}&rdquo;
              </p>

              <div className="mt-6 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#34E0FF]/20 text-sm font-bold text-[#030D39]">
                  {review.author.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#030D39]">{review.author}</p>
                  <p className="text-xs text-slate-500">{review.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust logo bar */}
        <div className="mt-16 text-center">
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Trusted by hospital networks across India
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {['Apex Health', 'MedPlus Clinics', 'CareFirst Hospital', 'Healthify Network'].map((name) => (
              <div
                key={name}
                className="flex h-16 items-center justify-center rounded-xl border border-slate-200 bg-white px-8 text-sm font-semibold text-slate-500 shadow-sm"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function FAQ() {
  const { ref, inView } = useInView()
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="bg-white py-24 font-jakarta">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            FAQ
          </p>
          <h2 className="text-4xl font-extrabold tracking-[-0.02em] text-[#030D39]">
            Common questions<span className="text-[#34E0FF]">.</span>
          </h2>
        </div>

        <div
          ref={ref}
          className={`space-y-3 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <button
                className="flex w-full items-center justify-between p-6 text-left"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <span className="pr-4 text-base font-semibold text-[#030D39]">{faq.q}</span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 transition-transform duration-300 ${openIndex === i ? 'rotate-180 text-[#34E0FF]' : 'text-slate-400'}`}
                />
              </button>
              <div
                className={`px-6 transition-all duration-300 ease-in-out ${openIndex === i ? 'max-h-48 pb-6 opacity-100' : 'max-h-0 opacity-0'}`}
              >
                <p className="text-[15px] leading-relaxed text-slate-600">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
