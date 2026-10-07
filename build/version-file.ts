// Writes version.json beside the app: its version and the database schema it opens. A tab running
// an older version reads it when an update is waiting, to suggest a backup before an upgrade.
// It's left out of the precache, so it always comes from the network.
import type { Plugin } from 'vite'

export function versionFile(app: string, schema: number): Plugin {
  return {
    name: 'bodycap:version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: `${JSON.stringify({ app, schema })}\n`,
      })
    },
  }
}
