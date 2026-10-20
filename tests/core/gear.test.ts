// Gear validation: which fields apply to which items, turning form input into clean gear, and messages.
import { describe, expect, it } from 'vitest'
import {
  applicableFields,
  emptyGearInput,
  toGearInput,
  validateGear,
  type GearFields,
  type GearInput,
} from '@/core/gear'

const TODAY = '2026-10-05'

/** A valid lens to start from, with the fields under test overridden */
const input = (overrides: Partial<GearInput> = {}): GearInput => ({
  ...emptyGearInput(),
  category: 'lens',
  brand: 'Sony',
  model: 'FE 24-70mm F2.8 GM II',
  ...overrides,
})

const nzd = (amount: string) => ({ amount, currency: 'NZD' })

describe('emptyGearInput', () => {
  it('starts as an owned item with NZD amounts and nothing else filled in', () => {
    const empty = emptyGearInput()
    expect(empty.status).toBe('owned')
    expect(empty.category).toBe('')
    expect(empty.brand).toBe('')
    expect(empty.adapterAutofocus).toBe(false)
    expect(empty.purchasePrice).toEqual({ amount: '', currency: 'NZD' })
    expect(empty.salePrice).toEqual({ amount: '', currency: 'NZD' })
    expect([empty.focalLengthMin, empty.focalLengthMax, empty.maxAperture]).toEqual(['', '', ''])
  })

  it('can start every amount in another currency', () => {
    const empty = emptyGearInput('USD')
    expect([empty.purchasePrice, empty.insuredValue, empty.salePrice]).toEqual([
      { amount: '', currency: 'USD' },
      { amount: '', currency: 'USD' },
      { amount: '', currency: 'USD' },
    ])
  })
})

describe('applicableFields', () => {
  it.each([
    ['mount', 'camera-body', 'owned', true],
    ['mount', 'lens', 'owned', true],
    ['mount', 'bag', 'owned', false],
    ['mount', 'mount-adapter', 'owned', false],
    ['sensorFormat', 'camera-body', 'owned', true],
    ['sensorFormat', 'lens', 'owned', false],
    ['lensCoverage', 'lens', 'owned', true],
    ['lensCoverage', 'camera-body', 'owned', false],
    ['adapterFrom', 'mount-adapter', 'owned', true],
    ['adapterTo', 'lens', 'owned', false],
    ['adapterAutofocus', 'mount-adapter', 'owned', true],
    ['saleDate', 'lens', 'sold', true],
    ['salePrice', 'lens', 'owned', false],
    ['lostDate', 'lens', 'lost', true],
    ['lostDate', 'lens', 'sold', false],
    ['serialNumber', 'lens', 'owned', true],
    ['serialNumber', 'lens', 'wishlist', false],
    ['purchaseDate', 'lens', 'wishlist', false],
    ['warrantyExpiry', 'lens', 'wishlist', false],
    ['insuredValue', 'lens', 'wishlist', false],
    ['ownEstimate', 'lens', 'owned', true],
    ['ownEstimate', 'bag', 'lent-out', true],
    ['ownEstimate', 'lens', 'in-repair', true],
    ['ownEstimate', 'lens', 'sold', false],
    ['ownEstimate', 'lens', 'lost', false],
    ['ownEstimate', 'lens', 'wishlist', false],
    ['ownEstimateDate', 'lens', 'owned', true],
    ['ownEstimateDate', 'lens', 'sold', false],
    ['purchasePrice', 'lens', 'wishlist', true],
    ['notes', 'other', 'lost', true],
    ['focalLengthMin', 'lens', 'owned', true],
    ['maxApertureTele', 'lens', 'wishlist', true],
    ['focalLengthMax', 'camera-body', 'owned', false],
    ['maxAperture', 'mount-adapter', 'owned', false],
    ['weight', 'bag', 'owned', true],
    ['weight', 'lens', 'wishlist', true],
    ['weight', 'other', 'sold', true],
    ['filterThread', 'lens', 'owned', true],
    ['filterThread', 'filter', 'wishlist', true],
    ['filterThread', 'camera-body', 'owned', false],
    ['catalogueId', 'camera-body', 'owned', true],
    ['catalogueId', 'lens', 'wishlist', true],
    ['catalogueId', 'tripod', 'owned', false],
  ] as const)('%s applies to a %s that is %s: %s', (field, category, status, applies) => {
    expect(applicableFields(category, status).has(field)).toBe(applies)
  })
})

describe('validateGear', () => {
  it("checks a lens's optics with the optics rules, keeping them as numbers", () => {
    expect(
      validateGear(
        input({ focalLengthMin: '24', focalLengthMax: '70 mm', maxAperture: 'f/2.8' }),
        TODAY,
      ),
    ).toMatchObject({
      ok: true,
      value: { focalLengthMin: 24, focalLengthMax: 70, maxAperture: 2.8 },
    })
    expect(
      validateGear(input({ focalLengthMin: '70', focalLengthMax: '24', brand: '' }), TODAY),
    ).toEqual({
      ok: false,
      error: {
        brand: 'Enter the brand.',
        focalLengthMax: "The longest focal length can't be shorter than the shortest.",
      },
    })
  })

  it('drops optics left over from choosing lens before another category', () => {
    const result = validateGear(
      input({ category: 'camera-body', focalLengthMin: '35', maxAperture: 'abc' }),
      TODAY,
    )
    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.value).not.toHaveProperty('focalLengthMin')
  })

  it('turns a minimal item into clean fields', () => {
    expect(
      validateGear(input({ brand: '  Sony ', model: 'FE  24-70mm F2.8 GM II' }), TODAY),
    ).toEqual({
      ok: true,
      value: { category: 'lens', brand: 'Sony', model: 'FE 24-70mm F2.8 GM II', status: 'owned' },
    })
  })

  it('keeps every field that applies, cleaned and parsed', () => {
    const result = validateGear(
      input({
        category: 'camera-body',
        brand: 'Nikon',
        model: 'Z6 III',
        nickname: ' Main body ',
        serialNumber: '3001234',
        mount: 'nikon-z',
        sensorFormat: 'full-frame',
        purchaseDate: '2025-07-01',
        purchasePrice: nzd('3,899'),
        whereBought: 'Photo Warehouse',
        condition: 'excellent',
        currentLocation: 'Studio shelf',
        warrantyExpiry: '2027-07-01',
        insuredValue: nzd('$3500'),
        notes: 'Firmware 1.10\r\nSpare battery in bag  ',
      }),
      TODAY,
    )
    expect(result).toEqual({
      ok: true,
      value: {
        category: 'camera-body',
        brand: 'Nikon',
        model: 'Z6 III',
        nickname: 'Main body',
        serialNumber: '3001234',
        mount: 'nikon-z',
        sensorFormat: 'full-frame',
        purchaseDate: '2025-07-01',
        purchasePrice: { amountMinor: 389900, currency: 'NZD' },
        whereBought: 'Photo Warehouse',
        condition: 'excellent',
        status: 'owned',
        currentLocation: 'Studio shelf',
        warrantyExpiry: '2027-07-01',
        insuredValue: { amountMinor: 350000, currency: 'NZD' },
        notes: 'Firmware 1.10\nSpare battery in bag',
      },
    })
  })

  it.each([
    [{ category: '' }, 'category', 'Choose a category.'],
    [{ category: 'spaceship' }, 'category', 'Choose a category.'],
    [{ status: 'stolen' }, 'status', 'Choose a status.'],
    [{ brand: '   ' }, 'brand', 'Enter the brand.'],
    [{ model: '' }, 'model', 'Enter the model.'],
    [{ brand: 'x'.repeat(81) }, 'brand', 'Keep the brand to 80 characters or fewer.'],
    [{ model: 'x'.repeat(121) }, 'model', 'Keep the model to 120 characters or fewer.'],
    [{ nickname: 'x'.repeat(81) }, 'nickname', 'Keep the nickname to 80 characters or fewer.'],
    [
      { serialNumber: 'x'.repeat(65) },
      'serialNumber',
      'Keep the serial number to 64 characters or fewer.',
    ],
    [
      { whereBought: 'x'.repeat(121) },
      'whereBought',
      'Keep where you bought it to 120 characters or fewer.',
    ],
    [
      { currentLocation: 'x'.repeat(121) },
      'currentLocation',
      'Keep the location to 120 characters or fewer.',
    ],
    [{ notes: 'x'.repeat(5001) }, 'notes', 'Keep the notes to 5,000 characters or fewer.'],
    [{ condition: 'mint' }, 'condition', 'Choose a condition from the list.'],
    [{ mount: 'pentax-q' }, 'mount', 'Choose a mount from the list.'],
    [{ lensCoverage: 'half-frame' }, 'lensCoverage', 'Choose a sensor format from the list.'],
    [
      { category: 'camera-body', sensorFormat: 'half-frame' },
      'sensorFormat',
      'Choose a sensor format from the list.',
    ],
    [
      { category: 'mount-adapter', adapterFrom: 'nope' },
      'adapterFrom',
      'Choose a mount from the list.',
    ],
    [
      { category: 'mount-adapter', adapterFrom: 'canon-ef', adapterTo: 'canon-ef' },
      'adapterTo',
      'An adapter joins two different mounts.',
    ],
    [{ purchaseDate: '2026-02-30' }, 'purchaseDate', 'Enter a real date.'],
    [{ purchaseDate: '2026-10-06' }, 'purchaseDate', "The purchase date can't be in the future."],
    [
      { purchaseDate: '2026-01-01', warrantyExpiry: '2025-12-31' },
      'warrantyExpiry',
      "The warranty can't end before the purchase date.",
    ],
    [
      { purchasePrice: nzd('12.345') },
      'purchasePrice',
      'NZD amounts can have at most 2 decimal places.',
    ],
    [{ purchasePrice: { amount: '100', currency: 'XYZ' } }, 'purchasePrice', 'Choose a currency.'],
    [{ insuredValue: nzd('-1') }, 'insuredValue', "Amounts can't be negative."],
    [{ weight: '1.2 kg' }, 'weight', 'Enter the weight in whole grams, such as 658.'],
    [{ weight: '1,20' }, 'weight', 'Enter the weight in whole grams, such as 658.'],
    [{ weight: '0' }, 'weight', 'Enter a weight from 1 to 50,000 g.'],
    [{ weight: '50,001 g' }, 'weight', 'Enter a weight from 1 to 50,000 g.'],
    [
      { filterThread: 'M77' },
      'filterThread',
      'Enter the filter thread in millimetres, such as 77.',
    ],
    [
      { filterThread: '40.25' },
      'filterThread',
      'Enter the filter thread in millimetres, such as 77.',
    ],
    [{ filterThread: '9.5' }, 'filterThread', 'Enter a filter thread from 10 to 200 mm.'],
    [{ filterThread: '201' }, 'filterThread', 'Enter a filter thread from 10 to 200 mm.'],
  ])('reports %j on %s: %s', (overrides, field, message) => {
    expect(validateGear(input(overrides), TODAY)).toEqual({
      ok: false,
      error: { [field]: message },
    })
  })

  it.each([
    ['658', 658],
    ['658 g', 658],
    ['658g', 658],
    ['1200G', 1200],
    ['1,200', 1200],
    [' 50,000 ', 50000],
    ['1', 1],
  ])('reads a weight typed as %j as %i g', (weight, grams) => {
    expect(validateGear(input({ category: 'bag', weight }), TODAY)).toMatchObject({
      ok: true,
      value: { weight: grams },
    })
  })

  it.each([
    ['77', 'lens', 77],
    ['77mm', 'lens', 77],
    [' 40.5 MM ', 'lens', 40.5],
    ['82 mm', 'filter', 82],
  ])('reads a filter thread typed as %j on a %s as %d mm', (filterThread, category, mm) => {
    expect(validateGear(input({ category, filterThread }), TODAY)).toMatchObject({
      ok: true,
      value: { filterThread: mm },
    })
  })

  it('keeps the catalogue model a body or lens was filled from', () => {
    expect(
      validateGear(input({ catalogueId: ' sony-fe-24-70mm-f2-8-gm-ii ' }), TODAY),
    ).toMatchObject({ ok: true, value: { catalogueId: 'sony-fe-24-70mm-f2-8-gm-ii' } })
  })

  // The ID is never shown, so there's nothing to tell anyone: a broken one just isn't kept
  it.each(['Sony a7 IV', 'sony--a7', '-a7', 'a7-', `a${'-b'.repeat(40)}`])(
    'drops a catalogue ID that is not well formed, without a message: %j',
    (catalogueId) => {
      const result = validateGear(input({ catalogueId }), TODAY)
      expect(result).toMatchObject({ ok: true })
      expect(result.ok && result.value).not.toHaveProperty('catalogueId')
    },
  )

  it('reports every problem at once', () => {
    const result = validateGear(input({ brand: '', model: '', purchaseDate: '2027-01-01' }), TODAY)
    expect(result).toEqual({
      ok: false,
      error: {
        brand: 'Enter the brand.',
        model: 'Enter the model.',
        purchaseDate: "The purchase date can't be in the future.",
      },
    })
  })

  it('accepts a purchase made today and a warranty that runs past today', () => {
    const result = validateGear(input({ purchaseDate: TODAY, warrantyExpiry: '2028-10-05' }), TODAY)
    expect(result.ok).toBe(true)
  })

  describe('for a sold item', () => {
    it('needs the sale date and price', () => {
      expect(validateGear(input({ status: 'sold' }), TODAY)).toEqual({
        ok: false,
        error: { saleDate: 'Enter the date it was sold.', salePrice: 'Enter what it sold for.' },
      })
    })

    it.each([
      [{ saleDate: '2026-02-30', salePrice: nzd('900') }, 'saleDate', 'Enter a real date.'],
      [
        { saleDate: '2026-10-06', salePrice: nzd('900') },
        'saleDate',
        "The sale date can't be in the future.",
      ],
      [
        { purchaseDate: '2026-05-01', saleDate: '2026-04-30', salePrice: nzd('900') },
        'saleDate',
        "The sale date can't be before the purchase date.",
      ],
      [
        { saleDate: '2026-09-01', salePrice: nzd('nine hundred') },
        'salePrice',
        'Enter the amount in numbers, for example 1,299.50.',
      ],
    ])('reports %j on %s: %s', (overrides, field, message) => {
      expect(validateGear(input({ status: 'sold', ...overrides }), TODAY)).toEqual({
        ok: false,
        error: { [field]: message },
      })
    })

    it('keeps the sale details', () => {
      const result = validateGear(
        input({
          status: 'sold',
          saleDate: '2026-09-01',
          salePrice: { amount: '900', currency: 'AUD' },
        }),
        TODAY,
      )
      expect(result).toMatchObject({
        ok: true,
        value: { saleDate: '2026-09-01', salePrice: { amountMinor: 90000, currency: 'AUD' } },
      })
    })
  })

  describe('for a lost item', () => {
    it.each([
      [{}, 'lostDate', 'Enter the date it was lost.'],
      [{ lostDate: '2026-02-30' }, 'lostDate', 'Enter a real date.'],
      [{ lostDate: '2026-10-06' }, 'lostDate', "The date it was lost can't be in the future."],
      [
        { purchaseDate: '2026-05-01', lostDate: '2026-04-30' },
        'lostDate',
        "It can't have been lost before the purchase date.",
      ],
    ])('reports %j on %s: %s', (overrides, field, message) => {
      expect(validateGear(input({ status: 'lost', ...overrides }), TODAY)).toEqual({
        ok: false,
        error: { [field]: message },
      })
    })

    it('keeps the date it was lost', () => {
      const result = validateGear(input({ status: 'lost', lostDate: '2026-09-01' }), TODAY)
      expect(result).toMatchObject({ ok: true, value: { lostDate: '2026-09-01' } })
    })
  })

  describe('drops leftovers from fields that no longer apply', () => {
    it('drops sale and loss details once the status changes back to owned', () => {
      const result = validateGear(
        input({ saleDate: 'nonsense', salePrice: nzd('-5'), lostDate: '2026-09-01' }),
        TODAY,
      )
      expect(result).toEqual({
        ok: true,
        value: { category: 'lens', brand: 'Sony', model: 'FE 24-70mm F2.8 GM II', status: 'owned' },
      })
    })

    it('drops mount and sensor details from a category that has none', () => {
      const result = validateGear(
        input({ category: 'bag', mount: 'canon-ef', sensorFormat: 'full-frame', adapterFrom: 'x' }),
        TODAY,
      )
      expect(result).toEqual({
        ok: true,
        value: { category: 'bag', brand: 'Sony', model: 'FE 24-70mm F2.8 GM II', status: 'owned' },
      })
    })

    it('keeps only the expected price and shop for a wishlist item', () => {
      const result = validateGear(
        input({
          status: 'wishlist',
          serialNumber: '123',
          purchaseDate: '2026-01-01',
          purchasePrice: nzd('2999'),
          whereBought: 'Wellington Camera Store',
          warrantyExpiry: '2028-01-01',
          insuredValue: nzd('3000'),
        }),
        TODAY,
      )
      expect(result).toEqual({
        ok: true,
        value: {
          category: 'lens',
          brand: 'Sony',
          model: 'FE 24-70mm F2.8 GM II',
          status: 'wishlist',
          purchasePrice: { amountMinor: 299900, currency: 'NZD' },
          whereBought: 'Wellington Camera Store',
        },
      })
    })
  })

  it("keeps an adapter's mounts and records whether it keeps autofocus", () => {
    const adapter = input({ category: 'mount-adapter', brand: 'Nikon', model: 'FTZ II' })
    expect(
      validateGear({ ...adapter, adapterFrom: 'nikon-f', adapterTo: 'nikon-z' }, TODAY),
    ).toMatchObject({
      ok: true,
      value: { adapterFrom: 'nikon-f', adapterTo: 'nikon-z', adapterAutofocus: false },
    })
    expect(validateGear({ ...adapter, adapterAutofocus: true }, TODAY)).toMatchObject({
      ok: true,
      value: { adapterAutofocus: true },
    })
  })
})

describe('validateGear for your own estimate', () => {
  it('keeps the amount in the purchase currency, with the date it was set', () => {
    expect(
      validateGear(
        input({
          purchasePrice: { amount: '1500', currency: 'USD' },
          ownEstimate: { amount: '1,200', currency: 'USD' },
          ownEstimateDate: '2026-10-01',
        }),
        TODAY,
      ),
    ).toMatchObject({
      ok: true,
      value: {
        ownEstimate: { amountMinor: 120000, currency: 'USD' },
        ownEstimateDate: '2026-10-01',
      },
    })
  })

  it('can be given for an item with no purchase price', () => {
    expect(
      validateGear(input({ ownEstimate: nzd('80'), ownEstimateDate: '2026-10-01' }), TODAY),
    ).toMatchObject({ ok: true, value: { ownEstimate: { amountMinor: 8000, currency: 'NZD' } } })
  })

  it.each<[Partial<GearInput>, keyof GearInput, string]>([
    [{ ownEstimate: nzd('-1') }, 'ownEstimate', "Amounts can't be negative."],
    [
      { ownEstimate: nzd('lots') },
      'ownEstimate',
      'Enter the amount in numbers, for example 1,299.50.',
    ],
    [
      { purchasePrice: nzd('900'), ownEstimate: { amount: '800', currency: 'USD' } },
      'ownEstimate',
      'Give your own estimate in the purchase currency.',
    ],
    [{ ownEstimateDate: '' }, 'ownEstimateDate', 'Enter the date you set your own estimate.'],
    [{ ownEstimateDate: '2026-02-30' }, 'ownEstimateDate', 'Enter a real date.'],
    [
      { ownEstimateDate: '2026-10-06' },
      'ownEstimateDate',
      "The date of your own estimate can't be in the future.",
    ],
  ])('reports %o on %s', (overrides, field, message) => {
    const result = validateGear(
      input({ ownEstimate: nzd('500'), ownEstimateDate: '2026-10-01', ...overrides }),
      TODAY,
    )
    expect(result).toEqual({ ok: false, error: { [field]: message } })
  })

  it('drops a date with no amount, and both once the item is no longer held', () => {
    const clean = { category: 'lens', brand: 'Sony', model: 'FE 24-70mm F2.8 GM II' }
    expect(validateGear(input({ ownEstimateDate: '2026-10-01' }), TODAY)).toEqual({
      ok: true,
      value: { ...clean, status: 'owned' },
    })
    expect(
      validateGear(
        input({ status: 'lost', lostDate: '2026-10-01', ownEstimate: nzd('-1') }),
        TODAY,
      ),
    ).toEqual({ ok: true, value: { ...clean, status: 'lost', lostDate: '2026-10-01' } })
  })
})

describe('toGearInput', () => {
  const body: GearFields = {
    category: 'camera-body',
    brand: 'Nikon',
    model: 'Z6 III',
    nickname: 'Main body',
    serialNumber: '3001234',
    mount: 'nikon-z',
    sensorFormat: 'full-frame',
    weight: 760,
    catalogueId: 'nikon-z6-iii',
    purchaseDate: '2025-07-01',
    purchasePrice: { amountMinor: 389900, currency: 'NZD' },
    whereBought: 'Photo Warehouse',
    condition: 'excellent',
    status: 'owned',
    currentLocation: 'Studio shelf',
    warrantyExpiry: '2027-07-01',
    insuredValue: { amountMinor: 350000, currency: 'NZD' },
    notes: 'Firmware 1.10\nSpare battery in bag',
  }

  it('fills the form from a saved item, with blank amounts in the default currency', () => {
    const form = toGearInput(body)
    expect(form.purchasePrice).toEqual({ amount: '3899.00', currency: 'NZD' })
    expect(form.salePrice).toEqual({ amount: '', currency: 'NZD' })
    expect(form.lensCoverage).toBe('')
    expect(toGearInput(body, 'AUD').salePrice).toEqual({ amount: '', currency: 'AUD' })
  })

  const fixtures: [string, GearFields][] = [
    ['an owned body with everything filled in', body],
    [
      'a lens sold in another currency',
      {
        category: 'lens',
        brand: 'Sigma',
        model: '35mm F1.4 DG DN Art',
        mount: 'l-mount',
        lensCoverage: 'full-frame',
        focalLengthMin: 35,
        focalLengthMax: 35,
        maxAperture: 1.4,
        filterThread: 67,
        purchaseDate: '2023-03-10',
        purchasePrice: { amountMinor: 159900, currency: 'USD' },
        status: 'sold',
        saleDate: '2026-08-20',
        salePrice: { amountMinor: 95000, currency: 'NZD' },
      },
    ],
    [
      'a lost adapter',
      {
        category: 'mount-adapter',
        brand: 'Nikon',
        model: 'FTZ II',
        adapterFrom: 'nikon-f',
        adapterTo: 'nikon-z',
        adapterAutofocus: true,
        status: 'lost',
        lostDate: '2026-01-15',
      },
    ],
    [
      'a variable-aperture zoom on the wishlist',
      {
        category: 'lens',
        brand: 'Fujifilm',
        model: 'XF 70-300mm F4-5.6 R LM OIS WR',
        mount: 'fujifilm-x',
        focalLengthMin: 70,
        focalLengthMax: 300,
        maxAperture: 4,
        maxApertureTele: 5.6,
        weight: 1150,
        purchasePrice: { amountMinor: 129900, currency: 'NZD' },
        status: 'wishlist',
      },
    ],
    [
      'a filter priced in yen',
      {
        category: 'filter',
        brand: 'Kenko',
        model: 'PRO1D Protector 40.5mm',
        filterThread: 40.5,
        purchasePrice: { amountMinor: 4500, currency: 'JPY' },
        status: 'owned',
      },
    ],
    [
      'a bag with your own estimate in another currency and no purchase price',
      {
        category: 'bag',
        brand: 'Peak Design',
        model: 'Everyday Backpack 20L',
        status: 'owned',
        ownEstimate: { amountMinor: 18000, currency: 'AUD' },
        ownEstimateDate: '2026-09-30',
      },
    ],
    [
      'a body with your own estimate',
      {
        ...body,
        ownEstimate: { amountMinor: 300000, currency: 'NZD' },
        ownEstimateDate: '2026-10-05',
      },
    ],
  ]

  it.each(fixtures)('round-trips %s through the form unchanged', (_name, fields) => {
    expect(validateGear(toGearInput(fields), TODAY)).toEqual({ ok: true, value: fields })
  })
})
