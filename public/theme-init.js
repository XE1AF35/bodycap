// Applies a saved light theme before the page first paints, so it never flashes dark first. Dark
// is the default, set on <html> in index.html. This is a file, not an inline script, so the
// Content Security Policy can refuse inline scripts. The key matches THEME_KEY in src/ui/theme.ts.
try {
  if (localStorage.getItem('bodycap:theme') === 'light') {
    document.documentElement.classList.remove('dark')
  }
} catch {
  // Storage can be blocked, for example in some private windows. Dark stays.
}
