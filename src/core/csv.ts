// Gear as a CSV file for spreadsheets. Every cell is quoted, a cell a spreadsheet would run as a
// formula gets a leading apostrophe (OWASP's advice on CSV injection), and the file starts with a
// byte order mark so Excel reads it as UTF-8.
import type { IsoDate } from './dates'
import { CATEGORY_LABELS, CONDITION_LABELS, STATUS_LABELS, type Gear } from './gear'
import { toAmountInput, type Money } from './money'
import { MOUNT_LABELS, SENSOR_FORMAT_LABELS } from './mounts'

const BOM = '\uFEFF'

// What a formula can start with: OWASP's list, plus the full-width forms some spreadsheets also run
const FORMULA_START = /^[=+\-@\t\r\uFF1D\uFF0B\uFF0D\uFF20]/u

function cell(text: string): string {
  const safe = FORMULA_START.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

/** Rows of text as a CSV file, with CRLF line endings as RFC 4180 has them */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return BOM + rows.map((row) => `${row.map(cell).join(',')}\r\n`).join('')
}

const text = (value: string | number | undefined) => (value === undefined ? '' : String(value))
const amount = (money: Money | undefined) => (money === undefined ? '' : toAmountInput(money))
const label = <K extends string>(labels: Record<K, string>, value: K | undefined) =>
  value === undefined ? '' : labels[value]

// Amounts are plain numbers with their currency beside them, so a spreadsheet can add them up
const GEAR_COLUMNS: readonly (readonly [string, (item: Gear) => string])[] = [
  ['Category', (item) => CATEGORY_LABELS[item.category]],
  ['Brand', (item) => item.brand],
  ['Model', (item) => item.model],
  ['Nickname', (item) => text(item.nickname)],
  ['Serial number', (item) => text(item.serialNumber)],
  ['Status', (item) => STATUS_LABELS[item.status]],
  ['Condition', (item) => label(CONDITION_LABELS, item.condition)],
  ['Mount', (item) => label(MOUNT_LABELS, item.mount)],
  ['Sensor format', (item) => label(SENSOR_FORMAT_LABELS, item.sensorFormat)],
  ['Lens coverage', (item) => label(SENSOR_FORMAT_LABELS, item.lensCoverage)],
  ['Adapter lens side', (item) => label(MOUNT_LABELS, item.adapterFrom)],
  ['Adapter camera side', (item) => label(MOUNT_LABELS, item.adapterTo)],
  [
    'Adapter autofocus',
    (item) => (item.adapterAutofocus === undefined ? '' : item.adapterAutofocus ? 'Yes' : 'No'),
  ],
  ['Shortest focal length (mm)', (item) => text(item.focalLengthMin)],
  ['Longest focal length (mm)', (item) => text(item.focalLengthMax)],
  ['Widest aperture', (item) => text(item.maxAperture)],
  ['Widest aperture at the long end', (item) => text(item.maxApertureTele)],
  ['Filter thread (mm)', (item) => text(item.filterThread)],
  ['Weight (g)', (item) => text(item.weight)],
  ['Purchase date', (item) => text(item.purchaseDate)],
  ['Purchase price', (item) => amount(item.purchasePrice)],
  ['Purchase currency', (item) => text(item.purchasePrice?.currency)],
  ['Where bought', (item) => text(item.whereBought)],
  ['Location', (item) => text(item.currentLocation)],
  ['Warranty ends', (item) => text(item.warrantyExpiry)],
  ['Insured value', (item) => amount(item.insuredValue)],
  ['Insured value currency', (item) => text(item.insuredValue?.currency)],
  ['Sale date', (item) => text(item.saleDate)],
  ['Sale price', (item) => amount(item.salePrice)],
  ['Sale currency', (item) => text(item.salePrice?.currency)],
  ['Date lost', (item) => text(item.lostDate)],
  ['Notes', (item) => text(item.notes)],
  ['Added', (item) => item.createdAt],
  ['Last changed', (item) => item.updatedAt],
  ['ID', (item) => item.id],
  ['Catalogue ID', (item) => text(item.catalogueId)],
  ['Own estimate', (item) => amount(item.ownEstimate)],
  ['Own estimate currency', (item) => text(item.ownEstimate?.currency)],
  ['Own estimate set', (item) => text(item.ownEstimateDate)],
]

/** Every field of every item, one row each in the order given, under a header row */
export function gearCsv(gear: readonly Gear[]): string {
  return toCsv([
    GEAR_COLUMNS.map(([header]) => header),
    ...gear.map((item) => GEAR_COLUMNS.map(([, value]) => value(item))),
  ])
}

/** Such as bodycap-gear-2026-10-09.csv */
export function csvFileName(madeOn: IsoDate): string {
  return `bodycap-gear-${madeOn}.csv`
}
