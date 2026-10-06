// The service worker's Trusted Types policy, and the prompt that offers a new version.
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createUpdateOffer } from '@/ui/pwa/update-offer'
import { approveWorkerUrl, WORKER_POLICY } from '@/ui/pwa/worker-policy'
import { renderApp, testServices } from './support'

const WORKER = '/bodycap/sw.js'

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
      updates.offer(install)
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
      updates.offer(install)
    })
    await user.click(screen.getByRole('button', { name: 'Later' }))
    expect(screen.queryByRole('complementary', { name: 'Update' })).not.toBeInTheDocument()
    expect(install).not.toHaveBeenCalled()
  })
})
