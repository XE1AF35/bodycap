# <img src="public/app-icon.png" width="40" height="40" alt=""> Bodycap

Keep track of your camera gear. Bodycap is a website that works like an app: everything stays in
your own browser, it works offline, and it never needs an account.

**Open it at <https://xe1af35.github.io/bodycap/>**

![The Bodycap dashboard, with a warranty running out, gear counts, a camera on loan, what the gear is worth by category, and backup status](docs/screenshots/dashboard.png)

## What it does

![The gear list, with search, filters by category, status, and mount, and a table of gear](docs/screenshots/gear.png)

- **All your gear**: bodies, lenses, flashes, bags, and anything else, with serial numbers,
  purchase details, condition, location, warranty, insured value, weight, and notes.
- **Model suggestions**: type "a7 iv" or "24-70 2.8" and pick a model to fill in its mount, sensor,
  focal lengths, aperture, and for most lenses the filter thread and weight. It all stays editable,
  and a model it doesn't know can be typed as it is.
- **Statuses**: owned, wishlist, lent out, in repair, sold, or lost, changed with buttons that ask
  only for what each change needs.
- **Kits** for packing, with a checklist, and shared as read-only links that others can add to
  their wishlist.
- **Loans**: who has what, how to reach them, when it's due back, and each item's loan history.
- **Photos**, up to 12 per item, shrunk in your browser.
- **Maintenance**: sensor cleans, firmware updates, and repairs, with their costs and who did them.
- **What fits what**: whether each lens fits each body as it is, crops to APS-C, needs an adapter,
  or doesn't fit, and a system map of the focal lengths you cover and what each adapter unlocks.
- **Search and filters** by category, status, and mount, kept in the address so you can bookmark
  them.
- **A dashboard** of counts, what your gear is worth, what's on loan, and what needs attention, such
  as overdue loans, warranties running out, or a serial number entered twice, with your gear in
  numbers below.
- **Money in any currency**, NZD by default, each amount keeping its own currency and totalled
  without converting between them.
- **A CSV file** for spreadsheets, and a printable **insurance list**.

## Your data stays with you

Your gear is stored in your browser on your device and never sent anywhere. There are no accounts,
analytics, or tracking. GitHub, which hosts the site, sees the usual requests for its pages and
update checks, as any website's host does, but never your gear.

**Back up regularly.** In Settings, Back up now saves everything in one file: a `.json` file, or a
`.zip` once you have photos (a smaller `.json` without them is also offered). Keep it somewhere
other than your device, such as cloud storage or a USB drive. The dashboard reminds you when one is
due, every two weeks unless you choose a week or a month.

Restore takes either kind of file, shows what it holds, and changes nothing until you confirm. It
can replace what's there, or add the backup to it, such as to merge two devices' gear. Adding never
removes anything, and where a record is in both, the newest copy is kept. If a backup without
photos would replace your photos, it says so first.

Backups hold your borrowers' names and contact details. That's other people's personal
information, so keep backup files as safely as your own.

**Photos** are redrawn in your browser before they're saved, which leaves behind everything else in
the original file, such as where it was taken and the camera's serial number. The CSV file and the
insurance list are for reading and printing: they leave out kits, loans, maintenance, and photos,
and can't be restored.

**Shared kit links** say what each item is, never whose: no serial numbers, and nothing about where
or when it was bought, where it's kept, or its warranty or insurance. Prices and notes go in only if
you tick them. The kit travels in the part of the link after the `#`, which browsers never send to
a server, but chat apps may show it, so share a link as you would the kit itself. Opening one adds
nothing until you choose to.

Browsers can delete a site's data:

- clearing browsing data, or this site's data, deletes it
- a device short of space can remove a site's data, unless the browser has promised to keep it
  (Settings shows whether it has, and can ask)
- Safari deletes a site's data after 7 days without a visit, unless it's on the Home Screen

## Installing it as an app

- **Chrome or Edge**: use **Install app** in Bodycap's header.
- **iPhone or iPad**: in Safari, tap Share, then **Add to Home Screen**. This also stops Safari's
  7-day deletion.

When a new version is ready, Bodycap waits for you to choose Reload, so nothing you're typing is
lost, and suggests a backup first if the update changes how your gear is stored. It's made for
current Chrome, Edge, Firefox, and Safari. Some private windows block the storage it needs, and it
says so if that happens.

## The gear catalogue

The model suggestions come from a catalogue built into the app, so they work offline and what you
type never leaves your browser. It holds 144 mirrorless bodies and 325 lenses from ten makers;
DSLRs, third-party lenses, and cine lenses aren't in it yet. Names, mounts, and specifications are
the makers' own. Lens weights and filter threads are the makers' figures as Wikipedia's lens lists give
them, left out where Wikipedia and the maker disagree. Bodies don't have weights yet.

Specifications are facts, so the catalogue is under the same MIT licence as the rest of Bodycap.
Brand and model names belong to their owners, and Bodycap isn't connected with any of them.

## Development

See [docs/development.md](docs/development.md) for setup, commands, tests, and security.

## Licence

[MIT](LICENSE). Copyright 2026 Ha Ly.
