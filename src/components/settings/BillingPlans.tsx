import { CreditCard, Sparkles } from 'lucide-react'

export type SubscriptionSummary = {
  clinic_name: string
  subscription_status: string
  trial_ends_at: string
  plan: string
  feature_flags: Record<string, boolean>
  limits: Record<string, number>
  usage: Record<string, number>
  plan_options: Array<{ value: string; label: string }>
}

const PLAN_BLURB: Record<string, string> = {
  trial: 'For testing out the platform',
  growth: 'For growing hospitals',
}

const PLAN_FEATURES: Record<string, string[]> = {
  trial: ['14-day full access', 'Basic AI features'],
  growth: ['Unlimited appointments', 'Priority email support', 'Standard AI limits'],
  enterprise: ['Everything in Growth', 'Custom AI models', '24/7 Phone support', 'Advanced analytics'],
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value))
}

/** The clinic's current plan and the plans it can switch to. */
export function BillingPlans({ subscription, onChoosePlan }: {
  subscription: SubscriptionSummary | null
  onChoosePlan: (plan: string) => void
}) {
  return (
    <div className="flex w-full flex-col space-y-6">
      <div className="mb-8">
        <p className="mb-4 text-sm text-slate-500">Switch plans and review current seat usage.</p>
        <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
          <span className="text-sm font-medium text-slate-600">Current Plan:</span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-bold uppercase tracking-wider text-emerald-600">
            {subscription?.plan || 'Unknown'}
          </span>
        </div>
        <p className="ml-2 mt-3 text-xs text-slate-400">Trial ends on {formatDate(subscription?.trial_ends_at)}</p>
      </div>

      <div className="grid flex-1 grid-cols-1 items-stretch gap-8 pb-8 pt-5 md:grid-cols-3">
        {(subscription?.plan_options || []).map((plan) => {
          const isActive = subscription?.plan === plan.value
          return (
            <div
              key={plan.value}
              className={`relative flex w-full flex-col overflow-visible rounded-2xl border-2 p-6 transition-all duration-300 ${
                isActive
                  ? 'border-emerald-400 bg-emerald-50/10 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
              }`}
            >
              {isActive && (
                <div className="absolute -top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-400/50 bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white shadow-lg shadow-emerald-500/30">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white"></span>
                  Current Plan
                </div>
              )}

              <div className="mb-6 mt-2 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                  <CreditCard className="h-6 w-6" />
                </div>
                <h4 className="text-2xl font-bold capitalize text-slate-900">{plan.label}</h4>
                <p className="mt-2 min-h-[40px] text-sm text-slate-500">
                  {PLAN_BLURB[plan.value] ?? 'Higher limits, priority access'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onChoosePlan(plan.value)}
                disabled={isActive}
                className={`mb-6 w-full rounded-xl py-2.5 text-sm font-semibold transition-all ${
                  isActive ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                }`}
              >
                {isActive ? 'Active' : `Get ${plan.label}`}
              </button>

              <div className="mt-auto flex-1 border-t border-slate-100/80 pt-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-900">Includes:</p>
                <ul className="space-y-3">
                  {(PLAN_FEATURES[plan.value] ?? []).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm font-medium text-slate-600">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
