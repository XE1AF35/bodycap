// Tidies what people type before it's stored, so the same words always look and match the same.
// NFC joins a letter and a separate accent into one character, as most keyboards type it.
import { LOCALE } from './locale'

/** One line of text: whitespace runs become single spaces, and invisible control characters go. */
export function cleanLine(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\p{Cc}/gu, (char) => (/\s/u.test(char) ? ' ' : ''))
    .replace(/\s+/gu, ' ')
    .trim()
}

/** Text that keeps its line breaks and tabs, such as notes. Windows and old Mac line endings become \n. */
export function cleanMultiline(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/\p{Cc}/gu, (char) => (char === '\n' || char === '\t' ? char : ''))
    .trim()
}

const graphemes = new Intl.Segmenter(LOCALE, { granularity: 'grapheme' })

/** Characters as people see them, so a family emoji or an accented letter counts once. */
export function characterCount(text: string): number {
  return Array.from(graphemes.segment(text)).length
}

/**
 * Lower case with accents removed, so searches ignore both. NFKD also turns full-width and other
 * compatibility forms into plain letters and digits.
 */
export function fold(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
}
