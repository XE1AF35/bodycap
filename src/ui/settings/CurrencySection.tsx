// The currency new amounts start in, or the one used last. Like the theme, it's kept on this device
// only.
import { useMemo } from 'react'
import { isCurrencyCode } from '@/core/money'
import { Label } from '@/ui/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/ui/components/ui/native-select'
import { CURRENCY_OPTIONS } from '@/ui/gear/form/currency-options'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'
import { useChoice } from '@/ui/settings/use-choice'

export function CurrencySection() {
  const { repositories } = useServices()
  const settings = useLive(useMemo(() => repositories.settings.get(), [repositories]))
  const saved = settings.status === 'ready' ? (settings.value.defaultCurrency ?? '') : ''
  const { shown, problem, choose } = useChoice(saved, (code) =>
    repositories.settings.setDefaultCurrency(isCurrencyCode(code) ? code : undefined),
  )

  return (
    <section
      aria-labelledby="currency-title"
      className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <h2 id="currency-title" className="text-base font-semibold">
        Currency
      </h2>
      <div className="grid gap-1.5">
        <Label htmlFor="default-currency">Start new amounts in</Label>
        <NativeSelect
          id="default-currency"
          value={shown}
          aria-describedby="default-currency-hint"
          onChange={(event) => {
            choose(event.target.value)
          }}
        >
          <NativeSelectOption value="">The currency I used last</NativeSelectOption>
          {CURRENCY_OPTIONS}
        </NativeSelect>
      </div>
      <p id="default-currency-hint" className="text-sm text-muted-foreground">
        Each amount can still be in any currency. This is kept on this device only, and isn't part
        of backups.
      </p>
      {problem !== undefined && (
        <p role="alert" className="font-medium text-destructive">
          {problem}
        </p>
      )}
    </section>
  )
}
