// A text field that suggests matches as you type, on Base UI's Autocomplete. The text stays free, so
// anything can be typed; picking a suggestion hands the whole item to `onPick`. Filtering and order
// are the caller's: `items` is shown as given. Keyboard use follows the WAI-ARIA combobox pattern:
// Down opens and moves, Enter picks, Escape closes and keeps the text, and focus stays in the field.
import * as React from 'react'
import { Autocomplete as AutocompletePrimitive } from '@base-ui/react/autocomplete'
import { cn } from '@/ui/lib/utils'

interface AutocompleteProps<Item> extends Omit<
  React.ComponentProps<'input'>,
  'value' | 'defaultValue' | 'onChange'
> {
  readonly value: string
  readonly onValueChange: (value: string) => void
  /** The suggestions, already filtered and in order */
  readonly items: readonly Item[]
  readonly itemKey: (item: Item) => string
  /** What a picked item puts in the field */
  readonly itemText: (item: Item) => string
  readonly renderItem: (item: Item) => React.ReactNode
  readonly onPick: (item: Item) => void
  /** Announced to screen readers while suggestions show, such as "5 models found" */
  readonly status: string
  /** Shown when nothing matches */
  readonly empty: string
}

function Autocomplete<Item>({
  value,
  onValueChange,
  items,
  itemKey,
  itemText,
  renderItem,
  onPick,
  status,
  empty,
  className,
  ...inputProps
}: AutocompleteProps<Item>) {
  return (
    <AutocompletePrimitive.Root
      items={items}
      filteredItems={items}
      itemToStringValue={itemText}
      value={value}
      onValueChange={(text) => {
        onValueChange(text)
      }}
    >
      <AutocompletePrimitive.Input
        data-slot="autocomplete-input"
        className={cn(
          'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
          className,
        )}
        {...inputProps}
      />
      {status === '' ? null : (
        <AutocompletePrimitive.Portal>
          <AutocompletePrimitive.Positioner
            sideOffset={4}
            className="z-50 w-(--anchor-width) outline-none"
          >
            <AutocompletePrimitive.Popup
              data-slot="autocomplete-popup"
              className="max-h-[min(var(--available-height),20rem)] overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
            >
              {/* With no matches, Empty is the one that speaks */}
              <AutocompletePrimitive.Status className="sr-only">
                {items.length > 0 ? status : ''}
              </AutocompletePrimitive.Status>
              <AutocompletePrimitive.Empty className="px-2 py-1.5 text-sm text-muted-foreground empty:hidden">
                {empty}
              </AutocompletePrimitive.Empty>
              <AutocompletePrimitive.List>
                {(item: Item) => (
                  <AutocompletePrimitive.Item
                    key={itemKey(item)}
                    value={item}
                    onClick={() => {
                      onPick(item)
                    }}
                    className="flex cursor-default flex-col gap-0.5 rounded-md px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  >
                    {renderItem(item)}
                  </AutocompletePrimitive.Item>
                )}
              </AutocompletePrimitive.List>
            </AutocompletePrimitive.Popup>
          </AutocompletePrimitive.Positioner>
        </AutocompletePrimitive.Portal>
      )}
    </AutocompletePrimitive.Root>
  )
}

export { Autocomplete }
