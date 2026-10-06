// A pressed or unpressed "Dark theme" button, so screen readers hear the state as well as the name.
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/ui/components/ui/button'
import { setTheme, useTheme } from '@/ui/theme'

export function ThemeToggle() {
  const dark = useTheme() === 'dark'
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-pressed={dark}
      onClick={() => {
        setTheme(dark ? 'light' : 'dark')
      }}
    >
      {dark ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
      <span className="sr-only">Dark theme</span>
    </Button>
  )
}
