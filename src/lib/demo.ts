/**
 * Demo data for the parts of the patient journey that run on the client's own systems and aren't wired up
 * yet: WhatsApp reminders and messages (WATI), payment links (Razorpay) and the AI's reminder and feedback
 * calls. Everything here is derived from real appointment ids, so the same booking always shows the same
 * demo status, and is labelled "Demo" wherever it appears. Replace these functions with API calls once
 * those integrations exist.
 */

export const DEMO_CONSULTATION_FEE = 500

/** Razorpay payment link sent after booking: most are paid, some still open, some pay at the desk. */
export type DemoPayment = 'paid' | 'link_sent' | 'pay_at_clinic'

export function demoPayment(appointmentId: number): DemoPayment {
  const r = appointmentId % 4
  return r === 0 ? 'link_sent' : r === 3 ? 'pay_at_clinic' : 'paid'
}

export const PAYMENT_LABEL: Record<DemoPayment, string> = {
  paid: 'Paid',
  link_sent: 'Payment link sent',
  pay_at_clinic: 'Pay at hospital',
}

/** The AI's reminder call (with a WhatsApp reminder) the day before: most patients confirm, a few don't pick up. */
export type DemoReminder = 'confirmed' | 'not_reached'

export const demoReminder = (appointmentId: number): DemoReminder => (appointmentId % 5 === 0 ? 'not_reached' : 'confirmed')

/** The AI's feedback call after a visit: happy patients get the Google review link, unhappy ones need a call from staff. */
export type DemoFeedback = 'positive' | 'negative'

export const demoFeedback = (appointmentId: number): DemoFeedback => (appointmentId % 3 === 0 ? 'negative' : 'positive')
