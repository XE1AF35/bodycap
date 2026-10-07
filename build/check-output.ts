// Checks the built app before it can be published: the web app manifest and its icons, the service
// worker, version.json, and the security meta tags. Anything missing fails the build, rather than an install.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { z } from 'zod'

const iconSchema = z.object({
  src: z.string(),
  sizes: z.string(),
  type: z.string(),
  purpose: z.string().optional(),
})

const manifestSchema = (base: string) =>
  z.object({
    name: z.literal('Bodycap'),
    short_name: z.string().min(1),
    // The app's identity and reach both follow the base path, so a move keeps them together
    id: z.literal(base),
    start_url: z.literal(base),
    scope: z.literal(base),
    display: z.literal('standalone'),
    theme_color: z.string().min(1),
    background_color: z.string().min(1),
    icons: z.array(iconSchema),
  })

// What installing needs: a 192 and a 512 for most platforms, and a maskable 512 for Android
const REQUIRED_ICONS = [
  ['192x192', 'any'],
  ['512x512', 'any'],
  ['512x512', 'maskable'],
] as const

/** What's wrong with the built app in outDir, or nothing */
export function outputProblems(outDir: string, base: string, schema: number): string[] {
  const problems: string[] = []
  const file = (name: string) => join(outDir, name)

  if (!existsSync(file('sw.js'))) {
    problems.push('There is no service worker (sw.js).')
  } else if (readFileSync(file('sw.js'), 'utf8').includes('version.json')) {
    problems.push('The service worker precaches version.json, so updates would read a stale one.')
  }

  // Older tabs read it to tell whether an update upgrades the database
  const version = existsSync(file('version.json'))
    ? z
        .object({ schema: z.literal(schema) })
        .safeParse(JSON.parse(readFileSync(file('version.json'), 'utf8')))
    : undefined
  if (!version?.success) problems.push(`version.json doesn't give the schema as ${String(schema)}.`)

  const html = existsSync(file('index.html')) ? readFileSync(file('index.html'), 'utf8') : ''
  const needed: [string, string][] = [
    ['http-equiv="Content-Security-Policy"', 'the Content Security Policy'],
    ['name="referrer" content="no-referrer"', 'the referrer policy'],
    ['rel="manifest"', 'the link to the manifest'],
    ['theme-init.js', 'the theme script'],
  ]
  for (const [text, what] of needed) {
    if (!html.includes(text)) problems.push(`index.html is missing ${what}.`)
  }

  if (!existsSync(file('manifest.webmanifest'))) {
    problems.push('There is no manifest.webmanifest.')
    return problems
  }
  const parsed = manifestSchema(base).safeParse(
    JSON.parse(readFileSync(file('manifest.webmanifest'), 'utf8')),
  )
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      problems.push(`The manifest's ${issue.path.join('.') || 'contents'}: ${issue.message}`)
    }
    return problems
  }
  const { icons } = parsed.data
  for (const [sizes, purpose] of REQUIRED_ICONS) {
    const found = icons.some((icon) => icon.sizes === sizes && (icon.purpose ?? 'any') === purpose)
    if (!found) problems.push(`The manifest has no ${purpose} icon at ${sizes}.`)
  }
  for (const { src } of icons) {
    if (!existsSync(file(src))) problems.push(`The manifest's icon ${src} isn't in the build.`)
  }
  return problems
}

export function checkOutput(outDir: string, base: string, schema: number): Plugin {
  return {
    name: 'bodycap:check-output',
    apply: 'build',
    // After vite-plugin-pwa has written the service worker and manifest
    closeBundle: {
      order: 'post',
      sequential: true,
      handler() {
        const problems = outputProblems(outDir, base, schema)
        if (problems.length > 0) {
          throw new Error(`The build isn't ready to publish:\n- ${problems.join('\n- ')}`)
        }
      },
    },
  }
}
