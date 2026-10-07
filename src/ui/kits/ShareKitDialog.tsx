// Sharing a kit as a link: what goes in it, where links can end up, and copying it. The kit sits
// after the # of the link, so it never reaches a server.
import { Share2 } from 'lucide-react'
import { useState } from 'react'
import type { Gear } from '@/core/gear'
import type { Kit } from '@/core/kits'
import { shareKitLink, type ShareChoices } from '@/core/share'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/components/ui/dialog'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'

const CHOICES: readonly (readonly [keyof ShareChoices, string, string?])[] = [
  ['prices', 'Include prices'],
  ['notes', 'Include notes', "The kit's description, and each item's notes"],
]

/** What's in the dialog, made afresh each time it opens */
function ShareForm({ kit, gear }: { readonly kit: Kit; readonly gear: readonly Gear[] }) {
  const [choices, setChoices] = useState<ShareChoices>({ prices: false, notes: false })
  const [copied, setCopied] = useState('')
  const link = shareKitLink(kit, gear, choices)
  const url = link.ok
    ? `${new URL(import.meta.env.BASE_URL, window.location.origin).href}#/shared/${link.value}`
    : undefined

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied('Link copied.')
    } catch {
      // Such as a browser that only allows copying on a secure connection
      setCopied("The link couldn't be copied. Select it and copy it yourself.")
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Share {kit.name}</DialogTitle>
        <DialogDescription>
          Anyone with the link can see what's in this kit. Links can end up in chat apps and their
          previews, so leave out anything private. Serial numbers and other private details are
          never included.
        </DialogDescription>
      </DialogHeader>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Also include</legend>
        {CHOICES.map(([choice, label, hint]) => (
          <div key={choice} className="grid gap-0.5">
            <div className="flex items-center gap-2">
              <input
                id={`share-${choice}`}
                type="checkbox"
                className="size-4 accent-primary"
                checked={choices[choice]}
                aria-describedby={hint === undefined ? undefined : `share-${choice}-hint`}
                onChange={(event) => {
                  const { checked } = event.target
                  setChoices((previous) => ({ ...previous, [choice]: checked }))
                  setCopied('')
                }}
              />
              <label htmlFor={`share-${choice}`}>{label}</label>
            </div>
            {hint !== undefined && (
              <p id={`share-${choice}-hint`} className="ml-6 text-sm text-muted-foreground">
                {hint}
              </p>
            )}
          </div>
        ))}
      </fieldset>
      {link.ok ? (
        <div className="grid gap-1.5">
          <Label htmlFor="share-link">Link</Label>
          <Input
            id="share-link"
            readOnly
            value={url}
            className="font-mono text-xs"
            onFocus={(event) => {
              event.target.select()
            }}
          />
        </div>
      ) : (
        <p className="text-sm font-medium">{link.error}</p>
      )}
      <p role="status" className="text-sm text-muted-foreground">
        {copied}
      </p>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Done</DialogClose>
        {url !== undefined && (
          <Button
            onClick={() => {
              void copy(url)
            }}
          >
            Copy link
          </Button>
        )}
      </DialogFooter>
    </>
  )
}

export function ShareKitDialog({
  kit,
  gear,
}: {
  readonly kit: Kit
  readonly gear: readonly Gear[]
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        <Share2 aria-hidden="true" />
        Share
      </DialogTrigger>
      <DialogContent>
        <ShareForm kit={kit} gear={gear} />
      </DialogContent>
    </Dialog>
  )
}
