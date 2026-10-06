// The header: the app's name, the main navigation, and the theme toggle. On phones the navigation
// folds behind a Menu button, a plain disclosure rather than a menu widget, since it holds links.
import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/ui/components/ui/button'
import { ThemeToggle } from '@/ui/components/ThemeToggle'
import { cn } from '@/ui/lib/utils'

const NAV_ID = 'site-nav'

const PAGES = [
  // Exact, or the dashboard at / would count as current on every page
  { to: '/', label: 'Dashboard', exact: true },
  { to: '/gear', label: 'Gear', exact: false },
  { to: '/settings', label: 'Settings', exact: false },
] as const

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
        <span className="mr-auto text-lg font-semibold">Bodycap</span>
        <Button
          variant="outline"
          className="sm:hidden"
          aria-expanded={menuOpen}
          aria-controls={NAV_ID}
          onClick={() => {
            setMenuOpen((open) => !open)
          }}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          Menu
        </Button>
        <ThemeToggle />
        <nav
          id={NAV_ID}
          aria-label="Main"
          className={cn('w-full sm:order-first sm:w-auto sm:block', menuOpen ? 'block' : 'hidden')}
        >
          <ul className="flex flex-col gap-1 sm:flex-row">
            {PAGES.map(({ to, label, exact }) => (
              <li key={to}>
                <Link
                  to={to}
                  activeOptions={{ exact }}
                  onClick={() => {
                    setMenuOpen(false)
                  }}
                  className="block rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-[current=page]:bg-muted aria-[current=page]:font-medium aria-[current=page]:text-foreground"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
