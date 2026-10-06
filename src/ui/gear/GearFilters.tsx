// Search, filters, and the sort menu above the gear list. Every change goes straight into the
// address, replacing the current history entry so Back still leaves the list.
import { useState } from 'react'
import { CATEGORIES, CATEGORY_LABELS, STATUSES, STATUS_LABELS } from '@/core/gear'
import { MOUNTS, MOUNT_LABELS } from '@/core/mounts'
import { SORT_KEYS, type SortKey } from '@/core/search'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/ui/components/ui/native-select'
import type { GearSearch } from '@/ui/gear/gear-search'
import { SORT_LABELS } from '@/ui/gear/labels'

interface FilterSelectProps<T extends string> {
  readonly id: string
  readonly label: string
  readonly anyLabel: string
  readonly value: T | undefined
  readonly choices: readonly (readonly [T, string])[]
  readonly onChange: (value: T | undefined) => void
}

function FilterSelect<T extends string>(props: FilterSelectProps<T>) {
  const { id, label, anyLabel, value, choices, onChange } = props
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        id={id}
        value={value ?? ''}
        onChange={(event) => {
          onChange(choices.find(([choice]) => choice === event.target.value)?.[0])
        }}
      >
        <NativeSelectOption value="">{anyLabel}</NativeSelectOption>
        {choices.map(([choice, text]) => (
          <NativeSelectOption key={choice} value={choice}>
            {text}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}

const SORT_CHOICES = SORT_KEYS.flatMap((key) =>
  [false, true].map((descending) => ({
    value: descending ? `${key}-desc` : key,
    key,
    descending,
    label: SORT_LABELS[key][descending ? 1 : 0],
  })),
)

interface GearFiltersProps {
  readonly search: GearSearch
  readonly sort: SortKey
  readonly descending: boolean
  readonly onChange: (changes: Partial<GearSearch>) => void
}

export function GearFilters({ search, sort, descending, onChange }: GearFiltersProps) {
  // Kept here as well as in the address, so typing never waits on the router
  const [text, setText] = useState(search.q ?? '')
  const filtering =
    text !== '' ||
    search.category !== undefined ||
    search.status !== undefined ||
    search.mount !== undefined

  return (
    <form
      role="search"
      className="mb-4 flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault()
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="gear-search">Search</Label>
        <Input
          id="gear-search"
          type="search"
          value={text}
          className="w-56"
          onChange={(event) => {
            setText(event.target.value)
            onChange({ q: event.target.value.trim() === '' ? undefined : event.target.value })
          }}
        />
      </div>
      <FilterSelect
        id="gear-category"
        label="Category"
        anyLabel="Any category"
        value={search.category}
        choices={CATEGORIES.map((category) => [category, CATEGORY_LABELS[category]] as const)}
        onChange={(category) => {
          onChange({ category })
        }}
      />
      <FilterSelect
        id="gear-status"
        label="Status"
        anyLabel="Any status"
        value={search.status}
        choices={STATUSES.map((status) => [status, STATUS_LABELS[status]] as const)}
        onChange={(status) => {
          onChange({ status })
        }}
      />
      <FilterSelect
        id="gear-mount"
        label="Mount"
        anyLabel="Any mount"
        value={search.mount}
        choices={MOUNTS.map((mount) => [mount, MOUNT_LABELS[mount]] as const)}
        onChange={(mount) => {
          onChange({ mount })
        }}
      />
      <div className="grid gap-1.5">
        <Label htmlFor="gear-sort">Sort by</Label>
        <NativeSelect
          id="gear-sort"
          value={descending ? `${sort}-desc` : sort}
          onChange={(event) => {
            const choice = SORT_CHOICES.find(({ value }) => value === event.target.value)
            if (choice === undefined) return
            onChange({
              // Name, A to Z is the default, so it's left out of the address
              sort: choice.key === 'name' ? undefined : choice.key,
              desc: choice.descending ? true : undefined,
            })
          }}
        >
          {SORT_CHOICES.map(({ value, label }) => (
            <NativeSelectOption key={value} value={value}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {filtering && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setText('')
            onChange({ q: undefined, category: undefined, status: undefined, mount: undefined })
          }}
        >
          Clear filters
        </Button>
      )}
    </form>
  )
}
