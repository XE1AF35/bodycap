// Class name helper for shadcn components. Later Tailwind classes win over earlier ones, so a
// component's caller can override its defaults.
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
