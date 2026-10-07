// Settings: backup and restore, the currency new amounts start in, storage, the theme, and About.
import { Page } from '@/ui/components/Page'
import { AboutSection } from '@/ui/settings/AboutSection'
import { BackupSection } from '@/ui/settings/BackupSection'
import { CurrencySection } from '@/ui/settings/CurrencySection'
import { RestoreSection } from '@/ui/settings/RestoreSection'
import { StorageSection } from '@/ui/settings/StorageSection'
import { ThemeSection } from '@/ui/settings/ThemeSection'

export function SettingsPage() {
  return (
    <Page title="Settings">
      <div className="grid max-w-3xl gap-6">
        <BackupSection />
        <RestoreSection />
        <CurrencySection />
        <StorageSection />
        <ThemeSection />
        <AboutSection />
      </div>
    </Page>
  )
}
