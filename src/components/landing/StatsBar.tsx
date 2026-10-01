import { useInView } from './LandingHooks'

export function StatsBar() {
  const { ref, inView } = useInView()

  const stats = [
    { value: '1.2M+', label: 'Patients Managed' },
    { value: '45k+', label: 'AI Summaries Generated' },
    { value: '9', label: 'Indian Languages' },
    { value: '0', label: 'Data Breaches' },
  ]

  return (
    <section className="border-y border-slate-200 bg-white font-jakarta">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div
          ref={ref}
          className={`grid grid-cols-2 gap-10 lg:grid-cols-4 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-4xl font-extrabold tracking-tight text-[#030D39] lg:text-5xl">
                {stat.value}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
