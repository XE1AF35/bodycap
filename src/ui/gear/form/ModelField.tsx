// The Model field, which suggests known camera bodies and lenses as you type. Picking one hands it to
// the form to fill in; anything can still be typed by hand. Until the catalogue loads, or if it
// can't, it suggests nothing.
import { isOneOf } from '@/core/choice'
import type { CatalogueEntry } from '@/core/catalogue/schema'
import { MAX_SUGGESTIONS } from '@/core/catalogue/search'
import { CATEGORIES } from '@/core/gear'
import { Autocomplete } from '@/ui/components/ui/autocomplete'
import { aria, type FieldProps } from '@/ui/gear/form/field-aria'
import { FieldLabel, Messages } from '@/ui/gear/form/fields'
import { useCatalogue } from '@/ui/gear/form/use-catalogue'
import { catalogueDetails, gearName } from '@/ui/gear/labels'

interface ModelFieldProps extends FieldProps {
  readonly value: string
  /** The form's category, which picks what's suggested */
  readonly category: string
  readonly onChange: (value: string) => void
  readonly onPick: (entry: CatalogueEntry) => void
  /** Said once a model is picked, such as what it filled in */
  readonly filled?: string | undefined
}

const plural = (count: number, word: string) => `${String(count)} ${word}${count === 1 ? '' : 's'}`

export function ModelField({
  value,
  category,
  onChange,
  onPick,
  filled,
  ...field
}: ModelFieldProps) {
  const search = useCatalogue()
  const results = search?.(value, { category: isOneOf(CATEGORIES, category) ? category : '' })

  let status = ''
  if (results !== undefined) {
    status =
      results.total <= MAX_SUGGESTIONS
        ? `${plural(results.total, 'model')} found.`
        : `${String(MAX_SUGGESTIONS)} of ${String(results.total)} models shown. Keep typing to narrow them down.`
  }

  return (
    <div className="grid gap-1.5">
      <FieldLabel {...field} />
      <Messages {...field} />
      <Autocomplete
        id={field.id}
        value={value}
        onValueChange={onChange}
        items={results?.entries ?? []}
        itemKey={(entry) => entry.id}
        itemText={(entry) => entry.model}
        renderItem={(entry) => (
          <>
            <span className="font-medium">{gearName(entry)}</span>
            <span className="text-xs text-muted-foreground">{catalogueDetails(entry)}</span>
          </>
        )}
        onPick={onPick}
        status={status}
        empty="No known model matches. Keep typing to add it as it is."
        autoComplete="off"
        {...aria(field)}
      />
      {/* Always present, so screen readers notice when it fills */}
      <p role="status" className="text-sm text-muted-foreground empty:hidden">
        {filled}
      </p>
    </div>
  )
}
