// The service worker's Trusted Types policy, the prompt that offers a new version and suggests a
// backup when it upgrades the database, and the Install button.
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAIN_ID } from '@/ui/components/SkipLink'
import { createInstallOffer } from '@/ui/pwa/install-offer'
import { changesStorage } from '@/ui/pwa/schema-check'
import { createUpdateOffer } from '@/ui/pwa/update-offer'
import { approveWorkerUrl, WORKER_POLICY } from '@/ui/pwa/worker-policy'
import { renderApp, stubDownloads, testServices } from './support'

const WORKER = '/bodycap/sw.js'

afterEach(() => {
  vi.restoreAllMocks()
})

/** A stand-in for the browser's trustedTypes that records the policy it's given */
function fakeTrustedTypes() {
  const created: { name: string; rule: (input: string) => string }[] = []
  return {
    created,
    factory: {
      createPolicy: (name: string, options: { createScriptURL: (input: string) => string }) => {
        created.push({ name, rule: options.createScriptURL })
        return {
          createScriptURL: (input: string) => ({ approved: options.createScriptURL(input) }),
        }
      },
    },
  }
}

describe('approveWorkerUrl', () => {
  it('passes the URL straight through where the browser has no Trusted Types', () => {
    expect(approveWorkerUrl(WORKER, undefined)).toBe(WORKER)
  })

  it('approves the worker URL through a policy named in the Content Security Policy', () => {
    const trustedTypes = fakeTrustedTypes()
    expect(approveWorkerUrl(WORKER, trustedTypes.factory)).toEqual({ approved: WORKER })
    expect(trustedTypes.created.map(({ name }) => name)).toEqual([WORKER_POLICY])
    expect(WORKER_POLICY).toBe('bodycap-sw')
  })

  it.each(['https://attacker.example/sw.js', '/bodycap/other.js', '/bodycap/sw.js?x=1'])(
    'refuses any other script URL, such as %s',
    (url) => {
      const trustedTypes = fakeTrustedTypes()
      approveWorkerUrl(WORKER, trustedTypes.factory)
      const [policy] = trustedTypes.created
      expect(() => policy?.rule(url)).toThrow(TypeError)
    },
  )
})

describe('update prompt', () => {
  async function renderWithOffer() {
    const updates = createUpdateOffer()
    renderApp('/', { ...testServices(), updates })
    await screen.findByRole('heading', { level: 1, name: 'Welcome to Bodycap' })
    return { updates, user: userEvent.setup() }
  }

  it('says nothing until a new version is waiting', async () => {
    await renderWithOffer()
    expect(screen.queryByText(/A new version of Bodycap is ready/)).not.toBeInTheDocument()
  })

  it('offers a new version, and installs it only when asked', async () => {
    const { updates, user } = await renderWithOffer()
    const install = vi.fn()
    act(() => {
      updates.offer({ install, changesStorage: false })
    })
    const prompt = screen.getByRole('complementary', { name: 'Update' })
    expect(prompt).toHaveTextContent('A new version of Bodycap is ready.')
    expect(install).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Reload' }))
    expect(install).toHaveBeenCalledOnce()
  })

  it('goes away for now when the person chooses Later', async () => {
    const { updates, user } = await renderWithOffer()
    const install = vi.fn()
    act(() => {
      updates.offer({ install, changesStorage: false })
    })
    await user.click(screen.getByRole('button', { name: 'Later' }))
    expect(screen.queryByRole('complementary', { name: 'Update' })).not.toBeInTheDocument()
    expect(install).not.toHaveBeenCalled()
  })

  it('suggests a backup first when the new version upgrades the database', async () => {
    const saved = stubDownloads()
    const { updates, user } = await renderWithOffer()
    const install = vi.fn()
    act(() => {
      updates.offer({ install, changesStorage: true })
    })
    const prompt = screen.getByRole('complementary', { name: 'Update' })
    expect(prompt).toHaveTextContent(
      'A new version of Bodycap is ready. It changes how your gear is stored, so back up first, just in case.',
    )
    await user.click(within(prompt).getByRole('button', { name: 'Back up first' }))
    expect(await within(prompt).findByText(/^Backup saved as/)).toBeInTheDocument()
    expect(saved).toHaveLength(1)
    expect(install).not.toHaveBeenCalled()
  })

  it('says nothing about backing up when the database stays as it is', async () => {
    const { updates } = await renderWithOffer()
    act(() => {
      updates.offer({ install: vi.fn(), changesStorage: false })
    })
    const prompt = screen.getByRole('complementary', { name: 'Update' })
    expect(within(prompt).queryByRole('button', { name: 'Back up first' })).not.toBeInTheDocument()
  })
})

describe('changesStorage', () => {
  const answer =
    (body: string, status = 200) =>
    () =>
      Promise.resolve(
        new Response(body, { status, headers: { 'Content-Type': 'application/json' } }),
      )

  it.each<[string, () => Promise<Response>, boolean]>([
    ['says yes for a newer schema', answer('{"app":"0.3.0","schema":3}'), true],
    ['says no for the same schema', answer('{"app":"0.2.1","schema":2}'), false],
    ['says no for an older schema', answer('{"app":"0.1.0","schema":1}'), false],
    ['says no for a file without a schema', answer('{"app":"0.3.0"}'), false],
    ['says no for a file that is not JSON', answer('<!doctype html>'), false],
    ['says no for a missing file', answer('Not found', 404), false],
    ['says no without a network', () => Promise.reject(new TypeError('Failed to fetch')), false],
  ])('%s', async (_name, fetchFile, expected) => {
    expect(await changesStorage(fetchFile, 2)).toBe(expected)
  })
})

describe('install button', () => {
  /** A stand-in for Chromium's beforeinstallprompt event */
  function installPrompt() {
    const prompt = vi.fn(() => Promise.resolve())
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt })
    return { event, prompt }
  }

  async function renderWithInstall() {
    const browser = new EventTarget()
    renderApp('/', { ...testServices(), install: createInstallOffer(browser) })
    await screen.findByRole('heading', { level: 1, name: 'Welcome to Bodycap' })
    return { browser, user: userEvent.setup() }
  }

  it('is not there until the browser says Bodycap can be installed', async () => {
    const { browser } = await renderWithInstall()
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument()
    // Not an install prompt, so nothing to offer
    act(() => {
      browser.dispatchEvent(new Event('beforeinstallprompt'))
    })
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument()
  })

  it("installs through the browser's own prompt, once", async () => {
    const { browser, user } = await renderWithInstall()
    const { event, prompt } = installPrompt()
    act(() => {
      browser.dispatchEvent(event)
    })
    // The browser's own install bar stays away, so the offer comes from the button
    expect(event.defaultPrevented).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Install app' }))
    expect(prompt).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument()
    expect(document.getElementById(MAIN_ID)).toHaveFocus()
  })

  it('goes once Bodycap is installed', async () => {
    const { browser } = await renderWithInstall()
    act(() => {
      browser.dispatchEvent(installPrompt().event)
    })
    expect(screen.getByRole('button', { name: 'Install app' })).toBeInTheDocument()
    act(() => {
      browser.dispatchEvent(new Event('appinstalled'))
    })
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument()
  })
})
