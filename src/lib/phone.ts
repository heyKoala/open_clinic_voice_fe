/** "918031805277" -> "+91 80 3180 5277" (other countries: "+<digits>"). */
export function formatPhoneNumber(digits: string) {
  if (/^91\d{10}$/.test(digits)) return `+91 ${digits.slice(2, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`
  return `+${digits}`
}
