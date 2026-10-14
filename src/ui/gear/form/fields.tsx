// The gear form's fields. Each has a visible label, and its hint and error are tied to the control
// with aria-describedby, so a screen reader reads them with it.
import type { ReactNode } from 'react'
import type { MoneyInput } from '@/core/gear'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/ui/components/ui/native-select'
import { Textarea } from '@/ui/components/ui/textarea'
import { CURRENCY_OPTIONS } from '@/ui/gear/form/currency-options'
import { aria, describedBy, type FieldProps } from '@/ui/gear/form/field-aria'

export function Messages({ id, hint, error }: Pick<FieldProps, 'id' | 'hint' | 'error'>) {
  return (
    <>
      {hint !== undefined && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={`${id}-error`} className="text-sm font-medium text-destructive">
          {/* The space sits outside the hidden span, or the two words run together */}
          <span className="sr-only">Error:</span> {error}
        </p>
      )}
    </>
  )
}

export function FieldLabel({ id, label, required }: Pick<FieldProps, 'id' | 'label' | 'required'>) {
  return (
    <Label htmlFor={id}>
      {label}
      {/* The control says it's required to screen readers itself, with aria-required */}
      {required === true && (
        <span aria-hidden="true" className="font-normal text-muted-foreground">
          (required)
        </span>
      )}
    </Label>
  )
}

interface TextFieldProps extends FieldProps {
  readonly value: string
  readonly onChange: (value: string) => void
  /**
   * What's typed: words, a code such as a serial number (in the data font), or a short number (in
   * the data font, with a decimal keypad on phones)
   */
  readonly kind?: 'text' | 'code' | 'number'
  /** The id of something else that describes the field, such as a warning */
  readonly describedById?: string | undefined
  readonly children?: ReactNode
}

const KIND_CLASSES: Record<NonNullable<TextFieldProps['kind']>, string | undefined> = {
  text: undefined,
  code: 'font-mono',
  number: 'w-32 font-mono tabular-nums',
}

export function TextField(props: TextFieldProps) {
  const { value, onChange, kind = 'text', describedById, children, ...field } = props
  return (
    <div className="grid gap-1.5">
      <FieldLabel {...field} />
      <Messages {...field} />
      <Input
        id={field.id}
        value={value}
        className={KIND_CLASSES[kind]}
        inputMode={kind === 'number' ? 'decimal' : undefined}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        {...aria(field, describedById)}
      />
      {children}
    </div>
  )
}

export function DateField({ value, onChange, ...field }: TextFieldProps) {
  return (
    <div className="grid gap-1.5">
      <FieldLabel {...field} />
      <Messages {...field} />
      <Input
        id={field.id}
        type="date"
        value={value}
        className="w-fit"
        onChange={(event) => {
          onChange(event.target.value)
        }}
        {...aria(field)}
      />
    </div>
  )
}

interface SelectFieldProps<T extends string> extends FieldProps {
  readonly value: string
  readonly choices: readonly (readonly [T, string])[]
  /** The first, empty choice, such as "Not set". Left out when a choice is always made. */
  readonly emptyLabel?: string
  readonly onChange: (value: string) => void
}

export function SelectField<T extends string>(props: SelectFieldProps<T>) {
  const { value, choices, emptyLabel, onChange, ...field } = props
  return (
    <div className="grid gap-1.5">
      <FieldLabel {...field} />
      <Messages {...field} />
      <NativeSelect
        id={field.id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        {...aria(field)}
      >
        {emptyLabel !== undefined && <NativeSelectOption value="">{emptyLabel}</NativeSelectOption>}
        {choices.map(([choice, text]) => (
          <NativeSelectOption key={choice} value={choice}>
            {text}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}

interface MoneyFieldProps extends FieldProps {
  readonly value: MoneyInput
  readonly onChange: (value: MoneyInput) => void
}

/** An amount and its currency, grouped under the field's name */
export function MoneyField({ value, onChange, ...field }: MoneyFieldProps) {
  const { id, label, hint, error } = field
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <Messages {...field} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={id} className="font-normal">
            Amount
          </Label>
          {/* A text field, not type="number", so "1,299.50" can be typed as people write it */}
          <Input
            id={id}
            inputMode="decimal"
            value={value.amount}
            className="w-36 font-mono tabular-nums"
            onChange={(event) => {
              onChange({ ...value, amount: event.target.value })
            }}
            {...aria(field)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-currency`} className="font-normal">
            Currency
          </Label>
          <NativeSelect
            id={`${id}-currency`}
            value={value.currency}
            onChange={(event) => {
              onChange({ ...value, currency: event.target.value })
            }}
            aria-describedby={describedBy(id, hint, error)}
          >
            {CURRENCY_OPTIONS}
          </NativeSelect>
        </div>
      </div>
    </fieldset>
  )
}

interface CheckboxFieldProps extends Omit<FieldProps, 'required' | 'error'> {
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
}

export function CheckboxField({ id, label, hint, checked, onChange }: CheckboxFieldProps) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          className="size-4 accent-primary"
          onChange={(event) => {
            onChange(event.target.checked)
          }}
          aria-describedby={describedBy(id, hint)}
        />
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
      </div>
      <Messages id={id} hint={hint} />
    </div>
  )
}

export function NotesField({ value, onChange, ...field }: TextFieldProps) {
  return (
    <div className="grid gap-1.5">
      <FieldLabel {...field} />
      <Messages {...field} />
      <Textarea
        id={field.id}
        value={value}
        rows={5}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        {...aria(field)}
      />
    </div>
  )
}
