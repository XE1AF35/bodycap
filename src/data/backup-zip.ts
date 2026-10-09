// Writing a .zip backup with fflate's streaming Zip, on the main thread: its async helpers start
// workers from blob URLs, which the CSP and Trusted Types block. Photos are stored as they are,
// since WebP and JPEG are already compressed, and only data.json is deflated.
import { strToU8, Zip, ZipDeflate, ZipPassThrough, type FlateError } from 'fflate'
import { photoEntryNames, ZIP_DATA_NAME } from '@/core/backup/zip'
import type { Photo } from '@/core/photos'

/** Output is gathered into a Blob this often, so a large backup isn't held twice in memory */
const FLUSH_BYTES = 8_000_000

/**
 * The same bytes typed as a Blob takes them. fflate's are always on an ordinary ArrayBuffer, but its
 * types don't say so.
 */
export function blobPart(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return bytes.buffer instanceof ArrayBuffer
    ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    : bytes.slice()
}

/** A .zip backup holding `dataJson` as data.json, then each photo's image and thumbnail */
export async function zipBackup(
  dataJson: string,
  photos: readonly Photo[],
  madeAt: Date,
): Promise<Blob> {
  const parts: Blob[] = []
  let pending: Uint8Array<ArrayBuffer>[] = []
  let pendingBytes = 0
  let failure: FlateError | undefined
  const flush = () => {
    parts.push(new Blob(pending))
    pending = []
    pendingBytes = 0
  }

  const zip = new Zip((error, chunk, final) => {
    if (error !== null) {
      failure = error
      return
    }
    pending.push(blobPart(chunk))
    pendingBytes += chunk.length
    if (final || pendingBytes >= FLUSH_BYTES) flush()
  })
  const add = (entry: ZipPassThrough | ZipDeflate, bytes: Uint8Array) => {
    entry.mtime = madeAt
    zip.add(entry)
    entry.push(bytes, true)
  }

  add(new ZipDeflate(ZIP_DATA_NAME, { level: 6 }), strToU8(dataJson))
  for (const photo of photos) {
    const names = photoEntryNames(photo)
    add(new ZipPassThrough(names.image), new Uint8Array(await photo.image.arrayBuffer()))
    add(new ZipPassThrough(names.thumbnail), new Uint8Array(await photo.thumbnail.arrayBuffer()))
  }
  zip.end()
  if (failure !== undefined) throw failure
  return new Blob(parts, { type: 'application/zip' })
}
