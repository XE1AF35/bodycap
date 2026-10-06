// The gear list's search, filters, and sort as they appear in the address
// (#/gear?q=sony&status=owned), so a filtered list survives a reload and can be bookmarked.
// Values that make no sense are dropped rather than shown as an error, since addresses get edited
// by hand and go stale.
import { z } from 'zod'
import { CATEGORIES, STATUSES } from '@/core/gear'
import { MOUNTS } from '@/core/mounts'
import { SORT_KEYS } from '@/core/search'

export const gearSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  category: z.enum(CATEGORIES).optional().catch(undefined),
  status: z.enum(STATUSES).optional().catch(undefined),
  mount: z.enum(MOUNTS).optional().catch(undefined),
  sort: z.enum(SORT_KEYS).optional().catch(undefined),
  desc: z.boolean().optional().catch(undefined),
})

export type GearSearch = z.output<typeof gearSearchSchema>
