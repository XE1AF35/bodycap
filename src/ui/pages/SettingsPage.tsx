// Settings: backup and restore, storage, the theme, and About.
import { Page } from '@/ui/components/Page'
import { AboutSection } from '@/ui/settings/AboutSection'
import { BackupSection } from '@/ui/settings/BackupSection'
import { RestoreSection } from '@/ui/settings/RestoreSection'
import { StorageSection } from '@/ui/settings/StorageSection'
import { ThemeSection } from '@/ui/settings/ThemeSection'

export function SettingsPage() {
  return (
    <Page title="Settings">
      <div className="grid gap-10">
        <BackupSection />
        <RestoreSection />
        <StorageSection />
        <ThemeSection />
        <AboutSection />
      </div>
    </Page>
  )
}
