// Reading a backup file someone chose. The size is checked before anything is read, so a huge file
// can't tie the app up.
import { MAX_BACKUP_BYTES, type Backup } from '@/core/backup/format'
import { readBackup } from '@/core/backup/read'
import { err, type Result } from '@/core/result'

/** The parts of a File this needs, so tests can pass a fake */
export type BackupFileSource = Pick<Blob, 'size' | 'text'>

/** The backup in a chosen file, or a plain message about why it can't be restored. */
export async function readBackupFile(file: BackupFileSource): Promise<Result<Backup>> {
  if (file.size > MAX_BACKUP_BYTES) {
    return err('This file is too big to be a Bodycap backup.')
  }
  let text: string
  try {
    text = await file.text()
  } catch {
    return err("This file couldn't be read. Try choosing it again.")
  }
  return readBackup(text)
}
