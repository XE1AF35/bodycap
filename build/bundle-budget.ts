// Size budgets for the built app, so it can't slowly grow heavier unnoticed. A first visit downloads
// every script index.html loads or preloads, so those share one budget. Chunks loaded later, such as
// a page or the gear catalogue, each have their own. Sizes are gzipped, as the site is served.

/** Today's first load (about 185 kB) plus room to grow, in gzipped bytes */
export const FIRST_LOAD_BUDGET = 200_000

/** For any one chunk loaded later, in gzipped bytes */
export const LAZY_CHUNK_BUDGET = 40_000

export interface ScriptSize {
  /** Relative to the build folder, such as assets/index-abc.js */
  readonly file: string
  readonly gzipped: number
}

const SCRIPT = /<script\b[^>]*\bsrc="([^"]+)"/g
const PRELOAD = /<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"/g

/** The scripts index.html loads or preloads, relative to the build folder */
export function firstLoadScripts(html: string, base: string): string[] {
  const sources = [...html.matchAll(SCRIPT), ...html.matchAll(PRELOAD)].map(([, src]) => src ?? '')
  return sources.map((src) => (src.startsWith(base) ? src.slice(base.length) : src))
}

const kB = (bytes: number) => String(Math.round(bytes / 100) / 10)

/** What's over budget, or nothing */
export function budgetProblems({
  firstLoad,
  lazy,
}: {
  readonly firstLoad: readonly ScriptSize[]
  readonly lazy: readonly ScriptSize[]
}): string[] {
  const problems: string[] = []
  const total = firstLoad.reduce((sum, { gzipped }) => sum + gzipped, 0)
  if (total > FIRST_LOAD_BUDGET) {
    problems.push(
      `First-load scripts are ${kB(total)} kB gzipped, over the ${kB(FIRST_LOAD_BUDGET)} kB budget.`,
    )
  }
  for (const { file, gzipped } of lazy) {
    if (gzipped > LAZY_CHUNK_BUDGET) {
      problems.push(
        `${file} is ${kB(gzipped)} kB gzipped, over the ${kB(LAZY_CHUNK_BUDGET)} kB budget for a chunk loaded later.`,
      )
    }
  }
  return problems
}
