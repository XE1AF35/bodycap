// The Content Security Policy and referrer policy for the built app, as meta tags, since GitHub Pages
// can't send headers. Development builds go without, because Vite's dev server needs inline scripts.
// A meta tag can't set frame-ancestors, so framing can't be blocked: a known limit.
import type { Plugin } from 'vite'

export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  // No hashes needed yet: the Base UI parts Bodycap uses add no <style> elements
  "style-src 'self'",
  // blob: is for photos, which arrive in M3
  "img-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "require-trusted-types-for 'script'",
  // The one policy allowed, which approves the service worker's URL (src/ui/pwa/worker-policy.ts)
  'trusted-types bodycap-sw',
].join('; ')

export function securityMeta(): Plugin {
  return {
    name: 'bodycap:security-meta',
    apply: 'build',
    transformIndexHtml: () => [
      // First in <head>, so the policy is in force before anything loads
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
      {
        tag: 'meta',
        attrs: { name: 'referrer', content: 'no-referrer' },
        injectTo: 'head-prepend',
      },
    ],
  }
}
