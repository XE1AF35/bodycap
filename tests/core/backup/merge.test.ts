// Merging a backup into what's here: whichever copy of a record changed last wins, either way,
// nothing here is lost, an item out on two different loans is refused rather than guessed at, and
// each item ends up with one cover photo.
import { describe, expect, it } from 'vitest'
import type { BackupData, BackupList } from '@/core/backup/format'
import { planMerge } from '@/core/backup/merge'
import type { Gear } from '@/core/gear'
import type { Kit } from '@/core/kits'
import type { Loan } from '@/core/loans'
import type { MaintenanceRecord } from '@/core/maintenance'
import type { PhotoInfo } from '@/core/photos'
import type { Shoot } from '@/core/shoots'

const EARLY = '2026-10-01T00:00:00.000Z'
const LATE = '2026-10-05T00:00:00.000Z'

const gear = (id: string, updatedAt = EARLY, model = 'X-T5'): Gear => ({
  id,
  createdAt: EARLY,
  updatedAt,
  category: 'camera-body',
  brand: 'Fujifilm',
  model,
  status: 'owned',
})

const kit = (id: string, updatedAt = EARLY, name = 'Travel'): Kit => ({
  id,
  createdAt: EARLY,
  updatedAt,
  name,
  gearIds: ['g1'],
  checklist: false,
  packedGearIds: [],
})

const loan = (id: string, fields: Partial<Loan> = {}): Loan => ({
  id,
  createdAt: EARLY,
  updatedAt: EARLY,
  gearId: 'g1',
  borrower: 'Aroha',
  dateOut: '2026-10-01',
  ...fields,
})

const record = (id: string, updatedAt = EARLY, type: MaintenanceRecord['type'] = 'repair') => ({
  id,
  createdAt: EARLY,
  updatedAt,
  gearId: 'g1',
  type,
  date: '2026-09-01',
})

const photo = (id: string, fields: Partial<PhotoInfo> = {}): PhotoInfo => ({
  id,
  createdAt: EARLY,
  updatedAt: EARLY,
  gearId: 'g1',
  isCover: false,
  mimeType: 'image/webp',
  width: 1600,
  height: 1200,
  bytes: 250_000,
  thumbnailBytes: 12_000,
  ...fields,
})

const shoot = (id: string, updatedAt = EARLY, name = 'Matakana'): Shoot => ({
  id,
  createdAt: EARLY,
  updatedAt,
  date: '2026-09-13',
  name,
  gearIds: ['g1'],
})

const data = (lists: Partial<BackupData> = {}): BackupData => ({
  gear: [gear('g1')],
  kits: [],
  loans: [],
  maintenance: [],
  photos: [],
  shoots: [],
  settings: {},
  ...lists,
})

const NONE: Record<BackupList, number> = {
  gear: 0,
  kits: 0,
  loans: 0,
  maintenance: 0,
  photos: 0,
  shoots: 0,
}

describe('planMerge', () => {
  it('adds what only the backup has, and leaves what only this browser has alone', () => {
    const here = data({ gear: [gear('g1'), gear('g2')] })
    const incoming = data({ gear: [gear('g1'), gear('g3')] })
    expect(planMerge(here, incoming)).toEqual({
      ok: true,
      value: {
        writes: {
          gear: [gear('g3')],
          kits: [],
          loans: [],
          maintenance: [],
          photos: [],
          shoots: [],
        },
        added: { ...NONE, gear: 1 },
        updated: NONE,
        coverChanges: [],
        settings: {},
      },
    })
  })

  it.each<[string, string, string, boolean]>([
    ['the backup changed it later', EARLY, LATE, true],
    ['this browser changed it later', LATE, EARLY, false],
    ['both changed it at the same moment', LATE, LATE, false],
    // Text would put Z after the dot, but 3:00:00.5 is the later time
    [
      'a time without milliseconds is earlier',
      '2026-10-05T03:00:00.500Z',
      '2026-10-05T03:00:00Z',
      false,
    ],
  ])('keeps the newer copy when %s', (_name, hereAt, backupAt, takesBackup) => {
    const theirs = gear('g1', backupAt, 'X-T5 (backup)')
    const plan = planMerge(data({ gear: [gear('g1', hereAt)] }), data({ gear: [theirs] }))
    expect(plan).toMatchObject({
      ok: true,
      value: {
        writes: { gear: takesBackup ? [theirs] : [] },
        updated: { ...NONE, gear: takesBackup ? 1 : 0 },
      },
    })
  })

  // Whole records win, so a newer copy from an older Bodycap drops the fields it didn't know about
  it("takes a newer copy without a weight over an older one with, as records aren't mixed", () => {
    const withWeight: Gear = { ...gear('g1'), weight: 658, catalogueId: 'sony-a7-iv' }
    const newer = gear('g1', LATE)
    expect(planMerge(data({ gear: [withWeight] }), data({ gear: [newer] }))).toMatchObject({
      ok: true,
      value: { writes: { gear: [newer] } },
    })
  })

  it.each<[BackupList, Partial<BackupData>, Partial<BackupData>]>([
    [
      'kits',
      { kits: [kit('k1', EARLY), kit('k2')] },
      { kits: [kit('k1', LATE, 'Travel light'), kit('k3')] },
    ],
    [
      'loans',
      { loans: [loan('l1'), loan('l2', { returnedOn: '2026-10-02' })] },
      {
        loans: [
          loan('l1', { updatedAt: LATE, returnedOn: '2026-10-04' }),
          loan('l3', { returnedOn: '2026-10-03' }),
        ],
      },
    ],
    [
      'maintenance',
      { maintenance: [record('m1'), record('m2')] },
      { maintenance: [record('m1', LATE, 'sensor-clean'), record('m3')] },
    ],
    [
      'photos',
      { photos: [photo('p1', { isCover: true }), photo('p2')] },
      { photos: [photo('p1', { isCover: true, updatedAt: LATE }), photo('p3')] },
    ],
    [
      'shoots',
      { shoots: [shoot('s1'), shoot('s2')] },
      { shoots: [shoot('s1', LATE, 'Matakana wedding'), shoot('s3')] },
    ],
  ])('merges %s the same way', (list, hereLists, backupLists) => {
    const plan = planMerge(data(hereLists), data(backupLists))
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    const incoming = backupLists[list] ?? []
    expect(plan.value.writes[list]).toEqual(incoming)
    expect(plan.value.added[list]).toBe(1)
    expect(plan.value.updated[list]).toBe(1)
  })

  it('keeps the copy of a shoot here when it changed later than the backup copy', () => {
    const here = data({ shoots: [shoot('s1', LATE, 'Renamed here')] })
    const incoming = data({ shoots: [shoot('s1', EARLY)] })
    expect(planMerge(here, incoming)).toMatchObject({
      ok: true,
      value: { writes: { shoots: [] }, added: NONE, updated: NONE },
    })
  })

  it.each<[string, BackupData['settings'], BackupData['settings'], BackupData['settings']]>([
    [
      'keeps the currency remembered here',
      { lastUsedCurrency: 'NZD' },
      { lastUsedCurrency: 'AUD' },
      { lastUsedCurrency: 'NZD' },
    ],
    [
      "takes the backup's when this browser has none",
      {},
      { lastUsedCurrency: 'AUD' },
      { lastUsedCurrency: 'AUD' },
    ],
    ['has none when neither does', {}, {}, {}],
  ])('%s', (_name, here, incoming, expected) => {
    const plan = planMerge(data({ settings: here }), data({ settings: incoming }))
    expect(plan).toMatchObject({ ok: true, value: { settings: expected } })
  })

  describe('cover photos', () => {
    const MINUTE_LATER = '2026-10-01T00:01:00.000Z'

    it("takes an item's photos from the backup as they are when there are none here", () => {
      const incoming = [photo('b1', { isCover: true }), photo('b2')]
      expect(planMerge(data(), data({ photos: incoming }))).toMatchObject({
        ok: true,
        value: { writes: { photos: incoming }, coverChanges: [] },
      })
    })

    it("keeps the cover here when it's older, adding the backup's cover as a plain photo", () => {
      const here = [photo('h1', { isCover: true })]
      const incoming = [photo('b1', { isCover: true, createdAt: MINUTE_LATER })]
      expect(planMerge(data({ photos: here }), data({ photos: incoming }))).toMatchObject({
        ok: true,
        value: {
          writes: { photos: [{ ...incoming[0], isCover: false }] },
          added: { ...NONE, photos: 1 },
          coverChanges: [],
        },
      })
    })

    it("takes the backup's cover when it's older, changing the one here", () => {
      const here = [photo('h1', { isCover: true, createdAt: MINUTE_LATER })]
      const incoming = [photo('b1', { isCover: true })]
      expect(planMerge(data({ photos: here }), data({ photos: incoming }))).toMatchObject({
        ok: true,
        value: {
          writes: { photos: incoming },
          coverChanges: [{ id: 'h1', isCover: false }],
        },
      })
    })

    it('leaves covers alone when a newer copy of the cover itself comes in', () => {
      const here = [photo('h1', { isCover: true }), photo('h2', { createdAt: MINUTE_LATER })]
      const incoming = [photo('h1', { isCover: true, updatedAt: LATE })]
      expect(planMerge(data({ photos: here }), data({ photos: incoming }))).toMatchObject({
        ok: true,
        value: { writes: { photos: incoming }, coverChanges: [] },
      })
    })
  })

  it('refuses an item out on a different loan in each copy, naming it', () => {
    const here = data({ loans: [loan('l1', { borrower: 'Aroha' })] })
    const incoming = data({ loans: [loan('l2', { borrower: 'Sam' })] })
    expect(planMerge(here, incoming)).toEqual({
      ok: false,
      error:
        "Fujifilm X-T5 is out on a loan here and a different one in the backup, so they can't be merged. Mark one of them as returned, then try again.",
    })
  })

  it('still refuses when the item itself is in neither copy, without naming it', () => {
    const here = data({ gear: [], loans: [loan('l1', { gearId: 'gone' })] })
    const incoming = data({ gear: [], loans: [loan('l2', { gearId: 'gone' })] })
    expect(planMerge(here, incoming)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/^An item is out on a loan here/) as unknown,
    })
  })

  it.each<[string, Loan[], Loan[]]>([
    [
      'the same loan, returned in the newer copy',
      [loan('l1')],
      [loan('l1', { updatedAt: LATE, returnedOn: '2026-10-04' })],
    ],
    [
      'a loan here, and a returned one in the backup',
      [loan('l1')],
      [loan('l2', { returnedOn: '2026-10-02' })],
    ],
  ])('merges loans for one item when only one is still out: %s', (_name, here, incoming) => {
    expect(planMerge(data({ loans: here }), data({ loans: incoming }))).toMatchObject({ ok: true })
  })
})
