// The header: the app's name, the main navigation, an Install button when the browser offers one,
// and the theme toggle. On phones the navigation and the buttons fold behind a Menu button, a plain disclosure rather than a menu widget, since it
// holds links. Everything is in the same order in the page as on screen, so Tab follows the eye.
import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/ui/components/ui/button'
import { ThemeToggle } from '@/ui/components/ThemeToggle'
import { cn } from '@/ui/lib/utils'
import { InstallButton } from '@/ui/pwa/InstallButton'

const PANEL_ID = 'site-nav'

const PAGES = [
  // Exact, or the dashboard at / would count as current on every page
  { to: '/', label: 'Dashboard', exact: true },
  { to: '/gear', label: 'Gear', exact: false },
  { to: '/kits', label: 'Kits', exact: false },
  { to: '/shoots', label: 'Shoots', exact: false },
  { to: '/system', label: 'System', exact: false },
  { to: '/settings', label: 'Settings', exact: false },
] as const

/** The hand-drawn app icon beside the name. It's decoration, since the name says the same. */
function Wordmark() {
  return (
    <span className="mr-auto inline-flex items-center gap-2 text-lg font-semibold tracking-tight sm:mr-4">
      <img
        src={`${import.meta.env.BASE_URL}app-icon.png`}
        alt=""
        width={28}
        height={28}
        className="size-7"
      />
      Bodycap
    </span>
  )
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="border-b border-border print:hidden">
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
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <InstallButton />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
