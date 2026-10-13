// Size budgets for the built app: which scripts a first visit downloads, and when sizes fail the build.
import { describe, expect, it } from 'vitest'
import {
  FIRST_LOAD_BUDGET,
  LAZY_CHUNK_BUDGET,
  budgetProblems,
  firstLoadScripts,
} from '../../build/bundle-budget'

const HTML = `<!doctype html>
<html>
  <head>
    <script src="/bodycap/theme-init.js"></script>
    <script type="module" crossorigin src="/bodycap/assets/index-abc.js"></script>
    <link rel="modulepreload" crossorigin href="/bodycap/assets/Page-def.js">
    <link rel="modulepreload" crossorigin href="/bodycap/assets/gear-ghi.js">
    <link rel="stylesheet" crossorigin href="/bodycap/assets/index-jkl.css">
    <link rel="manifest" href="/bodycap/manifest.webmanifest">
  </head>
</html>`

describe('firstLoadScripts', () => {
  it('lists every script and preloaded module, relative to the build folder', () => {
    expect(firstLoadScripts(HTML, '/bodycap/')).toEqual([
      'theme-init.js',
      'assets/index-abc.js',
      'assets/Page-def.js',
      'assets/gear-ghi.js',
    ])
  })

  it('leaves out stylesheets, the manifest, and scripts written inline', () => {
    const html = '<script>window.x = 1</script><link rel="stylesheet" href="/a.css">'
    expect(firstLoadScripts(html, '/')).toEqual([])
  })
})

describe('budgetProblems', () => {
  const within = { firstLoad: [{ file: 'assets/index.js', gzipped: 150_000 }], lazy: [] }

  it('finds nothing wrong within the budgets', () => {
    expect(budgetProblems(within)).toEqual([])
  })

  it('counts every first-load script towards one budget', () => {
    const firstLoad = [
      { file: 'assets/index.js', gzipped: FIRST_LOAD_BUDGET - 1000 },
      { file: 'assets/Page.js', gzipped: 2000 },
    ]
    expect(budgetProblems({ firstLoad, lazy: [] })).toEqual([
      `First-load scripts are ${String(FIRST_LOAD_BUDGET / 1000 + 1)} kB gzipped, over the ${String(FIRST_LOAD_BUDGET / 1000)} kB budget.`,
    ])
  })

  it('names each lazy chunk over its budget', () => {
    const lazy = [
      { file: 'assets/small.js', gzipped: 1000 },
      { file: 'assets/big.js', gzipped: LAZY_CHUNK_BUDGET + 500 },
    ]
    expect(budgetProblems({ firstLoad: within.firstLoad, lazy })).toEqual([
      `assets/big.js is 40.5 kB gzipped, over the ${String(LAZY_CHUNK_BUDGET / 1000)} kB budget for a chunk loaded later.`,
    ])
  })
})
