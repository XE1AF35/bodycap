// The theme as a choice of two, matching the toggle in the header.
import { setTheme, useTheme, type Theme } from '@/ui/theme'

const THEMES: readonly (readonly [Theme, string])[] = [
  ['dark', 'Dark'],
  ['light', 'Light'],
]

export function ThemeSection() {
  const theme = useTheme()
  return (
    <section
      aria-labelledby="theme-title"
      className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <h2 id="theme-title" className="text-base font-semibold">
        Theme
      </h2>
      <fieldset className="flex flex-wrap gap-4">
        <legend className="sr-only">Theme</legend>
        {THEMES.map(([choice, label]) => (
          <div key={choice} className="flex items-center gap-2">
            <input
              id={`theme-${choice}`}
              type="radio"
              name="theme"
              className="size-4 accent-primary"
              checked={theme === choice}
              onChange={() => {
                setTheme(choice)
              }}
            />
            <label htmlFor={`theme-${choice}`}>{label}</label>
          </div>
        ))}
      </fieldset>
      <p className="text-sm text-muted-foreground">
        The theme is kept on this device only, and isn't part of backups.
      </p>
    </section>
  )
}
