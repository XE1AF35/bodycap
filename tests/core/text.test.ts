// Text cleaning for what people type: tidy single-line fields, and notes that keep their line breaks.
import { describe, expect, it } from 'vitest'
import { characterCount, cleanLine, cleanMultiline, fold } from '@/core/text'

describe('cleanLine', () => {
  it.each([
    ['  Canon  ', 'Canon'],
    ['EOS\tR6\nMark II', 'EOS R6 Mark II'],
    ['EOS   R6', 'EOS R6'],
    ['ab\u0000c\u007f', 'abc'],
    // A decomposed é (e plus a combining accent) becomes the single character, so searches match
    ['Cafe\u0301', 'Café'],
    ['   ', ''],
  ])('tidies %j into %j', (text, cleaned) => {
    expect(cleanLine(text)).toBe(cleaned)
  })
})

describe('cleanMultiline', () => {
  it.each([
    ['line 1\r\nline 2\rline 3', 'line 1\nline 2\nline 3'],
    ['  first\n\nsecond  \n', 'first\n\nsecond'],
    ['tab\tkept', 'tab\tkept'],
    ['bell\u0007 gone', 'bell gone'],
    ['Cafe\u0301', 'Café'],
  ])('tidies %j into %j', (text, cleaned) => {
    expect(cleanMultiline(text)).toBe(cleaned)
  })
})

describe('characterCount', () => {
  it.each([
    ['Canon', 5],
    ['', 0],
    ['相机', 2],
    // Each counts once as people see it, not as UTF-16 halves or separate code points
    ['📷', 1],
    ['\u{1F468}\u200D\u{1F469}\u200D\u{1F467}', 1],
    ['e\u0301', 1],
  ])('counts %j as %i characters', (text, count) => {
    expect(characterCount(text)).toBe(count)
  })
})

describe('fold', () => {
  it.each([
    ['Sony A7 IV', 'sony a7 iv'],
    // Precomposed and decomposed accents both drop
    ['Caf\u00e9', 'cafe'],
    ['Cafe\u0301', 'cafe'],
    ['\u00c5ngstr\u00f6m', 'angstrom'],
    // Full-width letters and digits become plain ones
    ['\uff21\uff17\uff13', 'a73'],
    ['', ''],
  ])('folds %j into %j', (text, folded) => {
    expect(fold(text)).toBe(folded)
  })
})
