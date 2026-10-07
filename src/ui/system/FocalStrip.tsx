// A lens's focal lengths as a bar on the shared scale, and the scale's labels underneath. Gaps are
// shaded in every row, so they line up as a column. The words beside each strip say the same, so
// the drawing is hidden from screen readers. Sizes are attributes, as the security policy allows
// no inline styles.
import type { FocalRange } from '@/core/system-map'
import type { FocalScale } from '@/ui/system/focal-scale'

const percent = (value: number) => `${value.toFixed(2)}%`

function Gaps({
  scale,
  gaps,
}: {
  readonly scale: FocalScale
  readonly gaps: readonly FocalRange[]
}) {
  return gaps.map(({ min, max }) => (
    <rect
      key={min}
      x={percent(scale.at(min))}
      width={percent(scale.at(max) - scale.at(min))}
      y="0"
      height="100%"
      className="fill-muted"
    />
  ))
}

export function LensBar({
  scale,
  range,
  gaps,
  adapted,
}: {
  readonly scale: FocalScale
  readonly range: FocalRange
  readonly gaps: readonly FocalRange[]
  /** Through an adapter, drawn as an outline */
  readonly adapted: boolean
}) {
  const start = scale.at(range.min)
  const end = scale.at(range.max)
  const look = adapted ? 'fill-card stroke-foreground' : 'fill-foreground'
  return (
    <svg aria-hidden="true" focusable="false" className="h-4 w-full overflow-visible">
      <Gaps scale={scale} gaps={gaps} />
      {/* A prime is a point, drawn as a dot that's round at any width */}
      {range.min === range.max ? (
        <circle cx={percent(start)} cy="8" r="4" strokeWidth="1.5" className={look} />
      ) : (
        <rect
          x={percent(start)}
          width={percent(end - start)}
          y="4"
          height="8"
          rx="4"
          strokeWidth="1.5"
          className={look}
        />
      )}
    </svg>
  )
}

export function FocalAxis({
  scale,
  gaps,
}: {
  readonly scale: FocalScale
  readonly gaps: readonly FocalRange[]
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="h-6 w-full overflow-visible text-muted-foreground"
    >
      <Gaps scale={scale} gaps={gaps} />
      {scale.ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={percent(scale.at(tick))}
            x2={percent(scale.at(tick))}
            y1="0"
            y2="5"
            className="stroke-current"
          />
          <text
            x={percent(scale.at(tick))}
            y="18"
            textAnchor="middle"
            className="fill-current font-mono text-xs"
          >
            {tick}
          </text>
        </g>
      ))}
    </svg>
  )
}
