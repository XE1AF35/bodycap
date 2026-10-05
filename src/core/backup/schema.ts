// What a backup in the current format must look like. Files come from outside the app, so
// every field is checked: unknown keys are dropped, text is capped, and IDs, dates, and amounts
// must be real.
import { z } from 'zod'
import { isIsoDate } from '../dates'
import { CATEGORIES, CONDITIONS, STATUSES, type Gear } from '../gear'
import { isCurrencyCode } from '../money'
import { MOUNTS, SENSOR_FORMATS } from '../mounts'
import { BACKUP_APP, FORMAT_VERSION, type Backup } from './format'

// Far above the form's limits, which validateGear applies afterwards. These only stop absurd text
// before any more work is done on it.
const shortText = z.string().max(1_000)
const longText = z.string().max(50_000)

const isoDate = z.string().refine(isIsoDate)
const timestamp = z.iso.datetime()
const currency = z.string().refine(isCurrencyCode)
const money = z.object({ amountMinor: z.int().min(0), currency })

// Listing every Gear key here means a field added to Gear can't be left out of backups by mistake
const gearShape = {
  id: z.uuid(),
  createdAt: timestamp,
  updatedAt: timestamp,
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

export const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  formatVersion: z.literal(FORMAT_VERSION),
  schemaVersion: z.int().min(1),
  appVersion: shortText,
  exportedAt: timestamp,
  counts: z.object({ gear: z.int().min(0) }),
  data: z.object({
    gear: z.array(z.object(gearShape)),
    settings: z.object({ lastUsedCurrency: currency.exactOptional() }),
  }),
}) satisfies z.ZodType<Backup>
