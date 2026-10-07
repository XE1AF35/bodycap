// The header: the app's name, the main navigation, and the theme toggle. On phones the navigation
// and the toggle fold behind a Menu button, a plain disclosure rather than a menu widget, since it
// holds links. Everything is in the same order in the page as on screen, so Tab follows the eye.
import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/ui/components/ui/button'
import { ThemeToggle } from '@/ui/components/ThemeToggle'
import { cn } from '@/ui/lib/utils'

const PANEL_ID = 'site-nav'

const PAGES = [
  // Exact, or the dashboard at / would count as current on every page
  { to: '/', label: 'Dashboard', exact: true },
  { to: '/gear', label: 'Gear', exact: false },
  { to: '/kits', label: 'Kits', exact: false },
  { to: '/settings', label: 'Settings', exact: false },
] as const

/** The body cap from the app icon, with its red index dot, beside the name */
function Wordmark() {
  return (
    <span className="mr-auto inline-flex items-center gap-2 text-lg font-semibold tracking-tight sm:mr-4">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-7 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="10.5" />
        <circle cx="12" cy="12" r="5.5" />
        <circle cx="12" cy="4.25" r="1.6" className="fill-signal" stroke="none" />
      </svg>
      Bodycap
    </span>
  )
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
        <Wordmark />
        <Button
          variant="outline"
          className="sm:hidden"
          aria-expanded={menuOpen}
          aria-controls={PANEL_ID}
          onClick={() => {
            setMenuOpen((open) => !open)
          }}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          Menu
        </Button>
        <div
          id={PANEL_ID}
          className={cn(
            'w-full flex-col items-start gap-2 sm:flex sm:w-auto sm:flex-1 sm:flex-row sm:items-center',
            menuOpen ? 'flex' : 'hidden',
          )}
        >
          <nav aria-label="Main" className="w-full sm:w-auto">
            <ul className="flex flex-col gap-1 sm:flex-row">
              {PAGES.map(({ to, label, exact }) => (
                <li key={to}>
                  <Link
                    to={to}
                    activeOptions={{ exact }}
                    onClick={() => {
                      setMenuOpen(false)
                    }}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground"
                  >
                    {({ isActive }) => (
                      <>
                        {/* Always there, so the label doesn't shift when it lights up */}
                        <span
                          className={cn('size-1.5 shrink-0 rounded-full', isActive && 'bg-signal')}
                        />
                        {label}
                      </>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="sm:ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
