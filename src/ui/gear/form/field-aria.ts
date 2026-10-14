// What ties a gear form field's hint and error to its control, so a screen reader reads them with it.

export interface FieldProps {
  readonly id: string
  readonly label: string
  readonly hint?: string | undefined
  readonly error?: string | undefined
  readonly required?: boolean
}

/** The ids of whatever describes the control, or undefined when nothing does */
export function describedBy(id: string, hint?: string, error?: string, extra?: string) {
  const ids = [hint && `${id}-hint`, error && `${id}-error`, extra].filter(
    (part): part is string => typeof part === 'string' && part !== '',
  )
  return ids.length === 0 ? undefined : ids.join(' ')
}

/** The aria attributes every control gets */
export function aria({ id, hint, error, required }: FieldProps, extra?: string) {
  return {
    'aria-invalid': error === undefined ? undefined : true,
    'aria-describedby': describedBy(id, hint, error, extra),
    'aria-required': required === true ? true : undefined,
  }
}
