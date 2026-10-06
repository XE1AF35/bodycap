// The Trusted Types policy for the service worker. The Content Security Policy makes the browser
// refuse a plain string as a script URL, so registering needs a URL this policy approves, and it
// approves exactly one: Bodycap's own service worker.

/** Named in the Content Security Policy too (trusted-types bodycap-sw), so change both together */
export const WORKER_POLICY = 'bodycap-sw'

/** The part of the browser's trustedTypes used here, so tests can pass a stand-in */
export interface ScriptUrlPolicyFactory<Approved> {
  createPolicy(
    name: string,
    options: { createScriptURL: (input: string) => string },
  ): { createScriptURL: (input: string) => Approved }
}

/**
 * The worker's URL, approved by the policy where the browser has Trusted Types, or as it is where
 * the browser doesn't. The policy throws for any other URL, so nothing else can be registered.
 */
export function approveWorkerUrl<Approved>(
  workerUrl: string,
  trustedTypes: ScriptUrlPolicyFactory<Approved> | undefined,
): string | Approved {
  if (trustedTypes === undefined) return workerUrl
  const policy = trustedTypes.createPolicy(WORKER_POLICY, {
    createScriptURL: (input) => {
      if (input !== workerUrl) {
        throw new TypeError(`Bodycap only registers its own service worker, not ${input}`)
      }
      return input
    },
  })
  return policy.createScriptURL(workerUrl)
}
