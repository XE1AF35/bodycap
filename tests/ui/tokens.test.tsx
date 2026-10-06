// Design tokens: every colour pair the interface relies on meets WCAG 2.2 AA contrast in both themes,
// read straight from index.css. axe checks text on real screens, but not the 3:1 that control
// borders, focus rings, and indicators need.
import { describe, expect, it } from 'vitest'
import css from '@/index.css?raw'

type Rgb = readonly [number, number, number]

/** The custom properties declared in one top-level block of index.css, such as :root or .dark */
function tokens(selector: string): ReadonlyMap<string, string> {
  const start = css.indexOf(`\n${selector} {`)
  const end = css.indexOf('\n}', start)
  if (start === -1 || end === -1) throw new Error(`index.css has no ${selector} block`)
  const declarations = css.slice(start, end).matchAll(/--([\w-]+):\s*([^;]+);/g)
  return new Map([...declarations].map(([, name = '', value = '']) => [name, value.trim()]))
}

/** sRGB (0 to 1) for a solid oklch() colour, clipped to the gamut as a browser shows it */
function srgb(value: string): Rgb {
  const match = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(value)
  if (!match) throw new Error(`Not a solid oklch() colour: ${value}`)
  const [lightness, chroma, hue] = match.slice(1).map(Number) as [number, number, number]
  const a = chroma * Math.cos((hue * Math.PI) / 180)
  const b = chroma * Math.sin((hue * Math.PI) / 180)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  const encode = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)
  const [red = 0, green = 0, blue = 0] = linear.map((x) => Math.min(1, Math.max(0, encode(x))))
  return [red, green, blue]
}

function luminance([red, green, blue]: Rgb): number {
  const decode = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * decode(red) + 0.7152 * decode(green) + 0.0722 * decode(blue)
}

function contrast(one: Rgb, other: Rgb): number {
  const [light, dark] = [luminance(one), luminance(other)].sort((x, y) => y - x) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

const TEXT = 4.5
const NON_TEXT = 3

// What's drawn, what it's drawn on, and the minimum WCAG 2.2 AA asks for
const PAIRS = [
  ['foreground', 'background', TEXT],
  ['card-foreground', 'card', TEXT],
  ['popover-foreground', 'popover', TEXT],
  ['foreground', 'muted', TEXT],
  ['muted-foreground', 'background', TEXT],
  ['muted-foreground', 'card', TEXT],
  ['muted-foreground', 'muted', TEXT],
  ['primary-foreground', 'primary', TEXT],
  ['secondary-foreground', 'secondary', TEXT],
  ['accent-foreground', 'accent', TEXT],
  ['destructive', 'background', TEXT],
  ['destructive', 'card', TEXT],
  ['input', 'background', NON_TEXT],
  ['input', 'card', NON_TEXT],
  ['ring', 'background', NON_TEXT],
  ['ring', 'card', NON_TEXT],
  ['ring', 'popover', NON_TEXT],
  ['signal', 'background', NON_TEXT],
  ['signal', 'card', NON_TEXT],
] as const

describe.each([
  [':root', 'light'],
  ['.dark', 'dark'],
])('the %s tokens (%s theme)', (selector) => {
  const theme = tokens(selector)
  const colour = (name: string) => {
    const value = theme.get(name)
    if (value === undefined) throw new Error(`${selector} has no --${name}`)
    return srgb(value)
  }

  it.each(PAIRS)('--%s on --%s reaches %s:1', (drawn, under, minimum) => {
    expect(contrast(colour(drawn), colour(under))).toBeGreaterThanOrEqual(minimum)
  })
})
