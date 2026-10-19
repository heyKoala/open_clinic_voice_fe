/** A stored number in any shape ("+919632214132", "96322 14132") -> "+91 96322 14132"; '' if unusable. */
export function formatPhone(value: string | null | undefined) {
  const digits = (value ?? '').replace(/\D/g, '')
  if (digits.length < 10) return ''
  return formatPhoneNumber(digits.length === 10 ? `91${digits}` : digits)
}

/** "918031805277" -> "+91 80 3180 5277" (other countries: "+<digits>"). */
export function formatPhoneNumber(digits: string) {
  if (/^91\d{10}$/.test(digits)) return `+91 ${digits.slice(2, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`
  return `+${digits}`
}
