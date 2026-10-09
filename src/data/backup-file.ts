// Reading a backup file someone chose: a .json backup, or a .zip backup with photos, told apart by
// what's in the file rather than its name. Sizes are checked before anything is read, so a huge
// file can't tie the app up.
import { MAX_BACKUP_BYTES } from '@/core/backup/format'
import { readBackup } from '@/core/backup/read'
import { MAX_ZIP_BACKUP_BYTES, readZipBackup } from '@/core/backup/zip'
import { err, ok, type Result } from '@/core/result'
import { blobPart } from './backup-zip'
import type { RestorableBackup } from './repositories'

/** The parts of a File this needs, so tests can pass a fake */
export type BackupFileSource = Pick<Blob, 'size' | 'slice' | 'text' | 'arrayBuffer'>

const TOO_BIG = 'This file is too big to be a Bodycap backup.'
const UNREADABLE = "This file couldn't be read. Try choosing it again."
const PHOTOS_ELSEWHERE =
  "This backup's photos are in the .zip file it came from. Choose that file to restore it."

/** How every zip file starts: "PK", then the mark of its first entry */
const ZIP_START = [0x50, 0x4b, 0x03, 0x04]

async function startsLikeZip(file: BackupFileSource): Promise<boolean> {
  const start = new Uint8Array(await file.slice(0, ZIP_START.length).arrayBuffer())
  return ZIP_START.every((byte, index) => start[index] === byte)
}

async function readJson(file: BackupFileSource): Promise<Result<RestorableBackup>> {
  if (file.size > MAX_BACKUP_BYTES) return err(TOO_BIG)
  let text: string
  try {
    text = await file.text()
  } catch {
    return err(UNREADABLE)
  }
  const read = readBackup(text)
  if (!read.ok) return read
  // Bodycap's .json backups leave photos out, so this is data.json taken out of a .zip backup
  if (read.value.data.photos.length > 0) return err(PHOTOS_ELSEWHERE)
  return ok({ ...read.value, storedPhotos: [] })
}

async function readZip(file: BackupFileSource): Promise<Result<RestorableBackup>> {
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    return err(UNREADABLE)
  }
  const read = readZipBackup(bytes)
  if (!read.ok) return read
  const { backup, photos } = read.value
  return ok({
    ...backup,
    storedPhotos: photos.map(({ image, thumbnail, ...info }) => ({
      ...info,
      image: new Blob([blobPart(image)], { type: info.mimeType }),
      thumbnail: new Blob([blobPart(thumbnail)], { type: info.mimeType }),
    })),
  })
}

/** The backup in a chosen .json or .zip file, or a plain message about why it can't be restored. */
export async function readBackupFile(file: BackupFileSource): Promise<Result<RestorableBackup>> {
  if (file.size > MAX_ZIP_BACKUP_BYTES) return err(TOO_BIG)
  let zip: boolean
  try {
    zip = await startsLikeZip(file)
  } catch {
    return err(UNREADABLE)
  }
  return zip ? readZip(file) : readJson(file)
}
