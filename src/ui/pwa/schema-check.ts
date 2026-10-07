// Whether the version waiting to take over upgrades the database, read from the version.json the
// build writes beside it. The file isn't precached, so it comes from the network, not this version.
import { z } from 'zod'

const versionFile = z.object({ schema: z.int().min(1) })

/**
 * True when the waiting version's schema is newer than this one. Unknown, such as when offline,
 * counts as no: a failed upgrade leaves the data as it was, and the prompt shouldn't nag.
 */
export async function changesStorage(
  fetchFile: () => Promise<Response>,
  current: number,
): Promise<boolean> {
  try {
    const response = await fetchFile()
    if (!response.ok) return false
    const parsed = versionFile.safeParse(await response.json())
    return parsed.success && parsed.data.schema > current
  } catch {
    return false
  }
}
