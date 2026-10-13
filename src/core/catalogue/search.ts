// Searching the catalogue as someone types a model name. Pure, so the gear form can call it on every
// keystroke: the names are split into words once, and each search is a scan of a few hundred entries.
import type { Category } from '../gear'
import { LOCALE } from '../locale'
import { characterCount, fold } from '../text'
import type { CatalogueEntry } from './schema'

export interface CatalogueQuery {
  /** The form's category: '' when none is picked yet */
  readonly category: Category | ''
}

export interface CatalogueResults {
  readonly entries: readonly CatalogueEntry[]
  /** How many entries matched in all */
  readonly total: number
}

/** The most suggestions shown at once */
export const MAX_SUGGESTIONS = 10

/** Fewer characters than this, spaces aside, suggest nothing */
const MIN_CHARACTERS = 2

interface IndexedName {
  readonly tokens: readonly string[]
  /** How many of the tokens, from the start, are the brand's */
  readonly brandTokens: number
  readonly alias: boolean
}

interface IndexedEntry {
  readonly entry: CatalogueEntry
  /** "brand model", then "brand alias" for each alias */
  readonly names: readonly IndexedName[]
  /** "brand model", for the length and alphabetical order */
  readonly label: string
}

/** How well a name matched. Each is better true than false, and earlier ones count for more. */
interface Match {
  /** Every token typed matched a whole word, not just the start of one */
  readonly whole: boolean
  /** The model matched, not an alias */
  readonly model: boolean
  /** The words matched in the order typed */
  readonly inOrder: boolean
  readonly brand: boolean
}

const MATCH_ORDER = ['whole', 'model', 'inOrder', 'brand'] as const satisfies (keyof Match)[]

/** Negative when `a` is the better match */
function compareMatches(a: Match, b: Match): number {
  for (const key of MATCH_ORDER) if (a[key] !== b[key]) return a[key] ? -1 : 1
  return 0
}

const NOTHING: CatalogueResults = { entries: [], total: 0 }
const collator = new Intl.Collator(LOCALE)

// Words that say nothing about which model it is, so "Mark IV" and "Mk IV" both come down to "IV",
// and "50mm F1.8" to "50 1.8". An f counts as filler only right before a number.
const FILLER = new Set(['mark', 'mk', 'mm'])
const isNumber = (token: string) => /^\d/.test(token)

/**
 * Words and numbers, split wherever letters meet digits, with decimals kept whole: "a7iv" is
 * a 7 iv, and "24-70 2.8" is 24 70 2.8. Sony's alpha sign is read as an a.
 */
function tokenise(text: string): string[] {
  const tokens =
    fold(text)
      .replaceAll('\u03b1', 'a')
      // Millimetres run into what follows, as in 70mmF2.8
      .replaceAll(/(\d)mm/gu, '$1 ')
      .match(/\p{L}+|\d+(?:\.\d+)?/gu) ?? []
  return tokens.filter(
    (token, i) => !FILLER.has(token) && !(token === 'f' && isNumber(tokens[i + 1] ?? '')),
  )
}

interface Query {
  readonly tokens: readonly string[]
  /** Whether the last token may still be growing, as nothing has been typed after it */
  readonly open: boolean
}

/**
 * Which of the name's tokens each query token matched, each a different one, or nothing if any
 * failed. Words match by prefix. Numbers match exactly, except a last number still being typed, so
 * "24-7" finds 70.
 */
function matchTokens({ tokens, open }: Query, name: readonly string[]): number[] | undefined {
  const used: number[] = []
  const last = tokens.length - 1
  for (const [t, token] of tokens.entries()) {
    const prefix = !isNumber(token) || (open && t === last)
    const index = name.findIndex(
      (word, i) => !used.includes(i) && (prefix ? word.startsWith(token) : word === token),
    )
    if (index === -1) return undefined
    used.push(index)
  }
  return used
}

function matchName(query: Query, name: IndexedName): Match | undefined {
  const used = matchTokens(query, name.tokens)
  if (used === undefined) return undefined
  return {
    whole: used.every((index, t) => name.tokens[index] === query.tokens[t]),
    model: !name.alias,
    inOrder: used.every((index, t) => index > (used[t - 1] ?? -1)),
    brand: used.some((index) => index < name.brandTokens),
  }
}

/** How `name` matched, letting a half-typed filler word at the end, such as "50m", match nothing */
function matchTyping(query: Query, name: IndexedName): Match | undefined {
  const match = matchName(query, name)
  if (match !== undefined) return match
  const typing = query.open ? query.tokens.at(-1) : undefined
  if (typing === undefined || ![...FILLER, 'f'].some((filler) => filler.startsWith(typing))) {
    return undefined
  }
  return matchName({ tokens: query.tokens.slice(0, -1), open: false }, name)
}

/** The best match among an entry's names */
function bestMatch(query: Query, names: readonly IndexedName[]): Match | undefined {
  let best: Match | undefined
  for (const name of names) {
    const match = matchTyping(query, name)
    if (match && (best === undefined || compareMatches(match, best) < 0)) best = match
  }
  return best
}

/**
 * Builds the search once for `entries`, ready for each keystroke. A body or lens category shows
 * that category only, no category shows both, and other categories show nothing. Suggestions come
 * best first: whole words, then the model over an alias, words in the order typed, the brand
 * matched, shorter names, and then alphabetical order.
 */
export function createCatalogueSearch(
  entries: readonly CatalogueEntry[],
): (text: string, query: CatalogueQuery) => CatalogueResults {
  const index: IndexedEntry[] = entries.map((entry) => {
    const brandTokens = tokenise(entry.brand).length
    const name = (text: string, alias: boolean): IndexedName => ({
      tokens: tokenise(`${entry.brand} ${text}`),
      brandTokens,
      alias,
    })
    return {
      entry,
      names: [name(entry.model, false), ...(entry.aliases ?? []).map((alias) => name(alias, true))],
      label: `${entry.brand} ${entry.model}`,
    }
  })

  return (text, { category }) => {
    if (category !== '' && category !== 'camera-body' && category !== 'lens') return NOTHING
    if (characterCount(fold(text).replaceAll(/\s/gu, '')) < MIN_CHARACTERS) return NOTHING
    const query: Query = { tokens: tokenise(text), open: !/\s$/u.test(text) }
    if (query.tokens.length === 0) return NOTHING

    const found = index.flatMap((indexed) => {
      if (category !== '' && indexed.entry.category !== category) return []
      const match = bestMatch(query, indexed.names)
      return match ? [{ ...indexed, match }] : []
    })
    found.sort(
      (a, b) =>
        compareMatches(a.match, b.match) ||
        a.label.length - b.label.length ||
        collator.compare(a.label, b.label),
    )
    return {
      entries: found.slice(0, MAX_SUGGESTIONS).map(({ entry }) => entry),
      total: found.length,
    }
  }
}
