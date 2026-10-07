// What a backup in the current format must look like. Files come from outside the app, so
// every field is checked: unknown keys are dropped, text is capped, and IDs, dates, and amounts
// must be real.
import { z } from 'zod'
import { isIsoDate } from '../dates'
import { CATEGORIES, CONDITIONS, STATUSES, type Gear } from '../gear'
import type { Kit } from '../kits'
import type { Loan } from '../loans'
import { MAINTENANCE_TYPES, type MaintenanceRecord } from '../maintenance'
import { isCurrencyCode } from '../money'
import { MOUNTS, SENSOR_FORMATS } from '../mounts'
import { BACKUP_APP, FORMAT_VERSION, type Backup, type BackupList } from './format'

// Far above the form's limits, which validateGear applies afterwards. These only stop absurd text
// before any more work is done on it.
const shortText = z.string().max(1_000)
const longText = z.string().max(50_000)

const isoDate = z.string().refine(isIsoDate)
const timestamp = z.iso.datetime()
const currency = z.string().refine(isCurrencyCode)
const money = z.object({ amountMinor: z.int().min(0), currency })
// The optics rules check the ranges afterwards, with the rest of each item's rules
const number = z.number()

// Every record has these. The ID is what other records point at.
const recordShape = { id: z.uuid(), createdAt: timestamp, updatedAt: timestamp }

// Listing every key of each record here means a field added to one can't be left out of backups by
// mistake: the `satisfies` fails until it's listed. Shared kit links check their items with the
// same rules.
export const gearShape = {
  ...recordShape,
  category: z.enum(CATEGORIES),
  brand: shortText,
  model: shortText,
  nickname: shortText.exactOptional(),
  serialNumber: shortText.exactOptional(),
  mount: z.enum(MOUNTS).exactOptional(),
  sensorFormat: z.enum(SENSOR_FORMATS).exactOptional(),
  lensCoverage: z.enum(SENSOR_FORMATS).exactOptional(),
  adapterFrom: z.enum(MOUNTS).exactOptional(),
  adapterTo: z.enum(MOUNTS).exactOptional(),
  adapterAutofocus: z.boolean().exactOptional(),
  focalLengthMin: number.exactOptional(),
  focalLengthMax: number.exactOptional(),
  maxAperture: number.exactOptional(),
  maxApertureTele: number.exactOptional(),
  purchaseDate: isoDate.exactOptional(),
  purchasePrice: money.exactOptional(),
  whereBought: shortText.exactOptional(),
  condition: z.enum(CONDITIONS).exactOptional(),
  status: z.enum(STATUSES),
  currentLocation: shortText.exactOptional(),
  warrantyExpiry: isoDate.exactOptional(),
  insuredValue: money.exactOptional(),
  saleDate: isoDate.exactOptional(),
  salePrice: money.exactOptional(),
  lostDate: isoDate.exactOptional(),
  notes: longText.exactOptional(),
} satisfies Record<keyof Gear, z.ZodType>

const kitShape = {
  ...recordShape,
  name: shortText,
  description: longText.exactOptional(),
  gearIds: z.array(z.uuid()),
  checklist: z.boolean(),
  packedGearIds: z.array(z.uuid()),
} satisfies Record<keyof Kit, z.ZodType>

const loanShape = {
  ...recordShape,
  gearId: z.uuid(),
  borrower: shortText,
  contact: shortText.exactOptional(),
  dateOut: isoDate,
  dueDate: isoDate.exactOptional(),
  returnedOn: isoDate.exactOptional(),
  notes: longText.exactOptional(),
} satisfies Record<keyof Loan, z.ZodType>

const maintenanceShape = {
  ...recordShape,
  gearId: z.uuid(),
  type: z.enum(MAINTENANCE_TYPES),
  date: isoDate,
  cost: money.exactOptional(),
  provider: shortText.exactOptional(),
  firmwareVersion: shortText.exactOptional(),
  notes: longText.exactOptional(),
} satisfies Record<keyof MaintenanceRecord, z.ZodType>

const count = z.int().min(0)

export const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  formatVersion: z.literal(FORMAT_VERSION),
  schemaVersion: z.int().min(1),
  appVersion: shortText,
  exportedAt: timestamp,
  counts: z.object({
    gear: count,
    kits: count,
    loans: count,
    maintenance: count,
  } satisfies Record<BackupList, z.ZodType>),
  data: z.object({
    gear: z.array(z.object(gearShape)),
    kits: z.array(z.object(kitShape)),
    loans: z.array(z.object(loanShape)),
    maintenance: z.array(z.object(maintenanceShape)),
    settings: z.object({ lastUsedCurrency: currency.exactOptional() }),
  }),
}) satisfies z.ZodType<Backup>
