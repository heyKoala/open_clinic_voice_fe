import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** A role as shown to people: "clinic_admin" reads as "hospital admin". */
export function roleLabel(role: string) {
  return role.replace('_', ' ').replace('clinic', 'hospital')
}
