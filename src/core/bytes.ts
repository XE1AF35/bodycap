// Storage sizes in words people know. Counted in thousands (1 kB is 1,000 bytes), as storage makers
// and browsers count them.
import { LOCALE } from './locale'

const formatter = (unit: string) =>
  new Intl.NumberFormat(LOCALE, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  })

// Largest first. Gigabytes are the top unit, since no browser gives a site terabytes.
const UNITS = [
  [1e9, formatter('gigabyte')],
  [1e6, formatter('megabyte')],
  [1e3, formatter('kilobyte')],
] as const

const bytesFormatter = formatter('byte')

/** Such as 2.4 MB */
export function formatBytes(bytes: number): string {
  for (const [size, format] of UNITS) {
    if (bytes >= size) return format.format(bytes / size)
  }
  return bytesFormatter.format(bytes)
}
