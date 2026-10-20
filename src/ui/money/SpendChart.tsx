// Net spend by year as bars, above a zero line for years that cost money and below it for years
// that sold more than they cost. The table above it has the same figures, so the drawing is
// hidden from screen readers. Sizes are attributes, as the security policy allows no inline styles.
import type { YearSpend } from '@/core/spend'

/** Where the bars are drawn, in pixels, with room under them for the years */
const PLOT_HEIGHT = 128
const LABEL_SPACE = 20

/** More years than this and only every few are labelled, so they don't run together on a phone */
const MAX_LABELS = 8

const percent = (value: number) => `${value.toFixed(2)}%`

export function SpendChart({ years }: { readonly years: readonly YearSpend[] }) {
  const highest = Math.max(0, ...years.map(({ net }) => net))
  const lowest = Math.min(0, ...years.map(({ net }) => net))
  // A year with nothing spent and nothing sold still has a zero line to sit on
  const range = highest - lowest || 1
  const pixels = (amount: number) => (amount / range) * PLOT_HEIGHT
  const zero = pixels(highest)
  const slot = 100 / years.length
  const labelEvery = Math.ceil(years.length / MAX_LABELS)

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      height={PLOT_HEIGHT + LABEL_SPACE}
      className="w-full overflow-visible text-muted-foreground"
    >
      {years.map(({ year, net }, index) => {
        const height = pixels(Math.abs(net))
        return (
          <g key={year}>
            {height > 0 && (
              <rect
                x={percent(slot * (index + 0.2))}
                width={percent(slot * 0.6)}
                y={net >= 0 ? zero - height : zero}
                height={height}
                rx="2"
                strokeWidth="1.5"
                // Outlined below the line, so the two directions differ by more than position
                className={net >= 0 ? 'fill-foreground' : 'fill-card stroke-foreground'}
              />
            )}
            {(index % labelEvery === 0 || index === years.length - 1) && (
              <text
                x={percent(slot * (index + 0.5))}
                y={PLOT_HEIGHT + LABEL_SPACE - 4}
                textAnchor="middle"
                className="fill-current font-mono text-xs"
              >
                {year}
              </text>
            )}
          </g>
        )
      })}
      <line x1="0" x2="100%" y1={zero} y2={zero} className="stroke-current" />
    </svg>
  )
}
