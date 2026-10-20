// The add and edit form. It shows only the fields that fit the category and status, checks
// everything with validateGear on save, and asks before leaving with unsaved changes.
import { Link, useBlocker, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { fillFromCatalogue, keepCatalogueLink, type LinkedModel } from '@/core/catalogue/fill'
import type { CatalogueEntry } from '@/core/catalogue/schema'
import { isOneOf } from '@/core/choice'
import { formatDate, toIsoDate } from '@/core/dates'
import {
  applicableFields,
  CATEGORIES,
  CATEGORY_LABELS,
  CONDITIONS,
  CONDITION_LABELS,
  STATUSES,
  STATUS_LABELS,
  validateGear,
  type Gear,
  type GearFields,
  type GearInput,
  type Status,
} from '@/core/gear'
import { canChangeStatus } from '@/core/lifecycle'
import { MOUNTS, MOUNT_LABELS, SENSOR_FORMATS, SENSOR_FORMAT_LABELS } from '@/core/mounts'
import { findSerialClashes } from '@/core/serials'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/components/ui/alert-dialog'
import { Button } from '@/ui/components/ui/button'
import { ErrorSummary, type Problem } from '@/ui/gear/form/ErrorSummary'
import { ModelField } from '@/ui/gear/form/ModelField'
import {
  CheckboxField,
  DateField,
  MoneyField,
  NotesField,
  SelectField,
  TextField,
} from '@/ui/gear/form/fields'
import { catalogueFilled, FIELD_LABELS, gearName } from '@/ui/gear/labels'
import { saveProblem } from '@/ui/gear/save-problem'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'

type Field = keyof GearInput
type FormErrors = Partial<Record<Field, string | undefined>>

const fieldId = (field: Field) => `gear-${field}`

// The order fields appear in, so the error summary lists problems from top to bottom
const ORDER: readonly Field[] = [
  'category',
  'brand',
  'model',
  'nickname',
  'serialNumber',
  'mount',
  'sensorFormat',
  'lensCoverage',
  'focalLengthMin',
  'focalLengthMax',
  'maxAperture',
  'maxApertureTele',
  'filterThread',
  'adapterFrom',
  'adapterTo',
  'adapterAutofocus',
  'weight',
  'purchaseDate',
  'purchasePrice',
  'whereBought',
  'condition',
  'ownEstimate',
  'status',
  'currentLocation',
  'saleDate',
  'salePrice',
  'lostDate',
  'warrantyExpiry',
  'insuredValue',
  'notes',
]

// What picking a known model can fill in, so their messages go with it
const FILLED_BY_CATALOGUE: readonly Field[] = [
  'category',
  'brand',
  'model',
  'mount',
  'sensorFormat',
  'lensCoverage',
  'focalLengthMin',
  'focalLengthMax',
  'maxAperture',
  'maxApertureTele',
  'filterThread',
  'weight',
]

const choices = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => [value, labels[value]] as const)

const MOUNT_CHOICES = choices(MOUNTS, MOUNT_LABELS)
const FORMAT_CHOICES = choices(SENSOR_FORMATS, SENSOR_FORMAT_LABELS)

/** The currency of the first amount entered, which becomes the next form's default */
function usedCurrency({ purchasePrice, insuredValue, salePrice }: GearFields) {
  return (purchasePrice ?? insuredValue ?? salePrice)?.currency
}

// Lending and returning also record the loan, so once an item is saved they're done with the
// buttons on its page, never by picking a status here
const viaStatusButtons = (from: Status, to: Status) =>
  to === 'lent-out' || (from === 'lent-out' && to === 'owned')

interface GearFormProps {
  readonly initial: GearInput
  /** What's saved now, when editing: the status list only offers changes from here */
  readonly saved?: Pick<Gear, 'id' | 'status'>
  readonly onSave: (fields: GearFields) => Promise<Gear>
  /** Where Cancel goes */
  readonly cancel: ReactNode
}

export function GearForm({ initial, saved, onSave, cancel }: GearFormProps) {
  const { repositories, storage } = useServices()
  const navigate = useNavigate()
  // Taken once, so the parent can rebuild its initial value on every render
  const [start] = useState(initial)
  const [input, setInput] = useState(initial)
  const [errors, setErrors] = useState<FormErrors>({})
  const [failedSaves, setFailedSaves] = useState(0)
  const [problem, setProblem] = useState<string>()
  const [saving, setSaving] = useState(false)
  // The last model picked, and what was said about it, shown until the model is changed
  const [picked, setPicked] = useState<{ readonly model: string; readonly message: string }>()
  // The name and mount the item is linked to a catalogue model under: as saved, or as last picked
  const [linked, setLinked] = useState<LinkedModel | undefined>(() =>
    initial.catalogueId === ''
      ? undefined
      : { brand: initial.brand, model: initial.model, mount: initial.mount },
  )
  const savedRef = useRef(false)
  const summaryRef = useRef<HTMLDivElement>(null)

  const dirty = JSON.stringify(input) !== JSON.stringify(start)
  const blocker = useBlocker({
    shouldBlockFn: () => dirty && !savedRef.current,
    enableBeforeUnload: () => dirty && !savedRef.current,
    withResolver: true,
  })

  useEffect(() => {
    if (failedSaves > 0) summaryRef.current?.focus()
  }, [failedSaves])

  const allGear = useLive(useMemo(() => repositories.gear.list(), [repositories]))

  const category = isOneOf(CATEGORIES, input.category) ? input.category : 'other'
  const status = isOneOf(STATUSES, input.status) ? input.status : 'owned'
  const applies = applicableFields(category, status)

  const statusChoices = STATUSES.filter(
    (choice: Status) =>
      saved === undefined ||
      choice === saved.status ||
      (canChangeStatus(saved.status, choice) && !viaStatusButtons(saved.status, choice)),
  ).map((choice) => [choice, STATUS_LABELS[choice]] as const)

  const clashes =
    allGear.status === 'ready' && applies.has('serialNumber')
      ? findSerialClashes(
          { brand: input.brand, serialNumber: input.serialNumber },
          allGear.value,
          saved?.id,
        ).flatMap((id) => allGear.value.filter((item) => item.id === id))
      : []

  function set<K extends Field>(field: K, value: GearInput[K]) {
    setInput((previous) => ({ ...previous, [field]: value }))
    // A field's message goes once it's changed, and the rest wait for the next save
    setErrors((previous) =>
      previous[field] === undefined ? previous : { ...previous, [field]: undefined },
    )
  }

  function pick(entry: CatalogueEntry) {
    setInput((previous) => fillFromCatalogue(previous, entry))
    setErrors((previous) => ({
      ...previous,
      ...Object.fromEntries(FILLED_BY_CATALOGUE.map((field) => [field, undefined])),
    }))
    setPicked({ model: entry.model, message: catalogueFilled(entry) })
    setLinked({ brand: entry.brand, model: entry.model, mount: entry.mount })
  }

  const props = (field: Field) => ({
    id: fieldId(field),
    label: FIELD_LABELS[field],
    error: errors[field],
  })

  const text = (
    field: Exclude<Field, 'adapterAutofocus' | `${string}Price` | 'insuredValue' | 'ownEstimate'>,
  ) => ({
    ...props(field),
    value: input[field],
    onChange: (value: string) => {
      set(field, value)
    },
  })

  const money = (field: 'purchasePrice' | 'insuredValue' | 'salePrice') => ({
    ...props(field),
    value: input[field],
    onChange: (value: GearInput[typeof field]) => {
      set(field, value)
    },
  })

  const filterThread = applies.has('filterThread') && (
    <TextField
      {...text('filterThread')}
      kind="number"
      hint={
        category === 'lens'
          ? 'In millimetres, such as 77. Leave it blank if it takes no screw-in filters.'
          : 'In millimetres, such as 77.'
      }
    />
  )

  const problems: Problem[] = ORDER.flatMap((field) => {
    const message = errors[field]
    return message === undefined ? [] : [{ id: fieldId(field), message }]
  })

  // The own estimate is always in the purchase currency, and dated when it or that currency changes
  const ownEstimate = { ...input.ownEstimate, currency: input.purchasePrice.currency }
  const estimateChanged =
    ownEstimate.amount.trim() !== start.ownEstimate.amount.trim() ||
    ownEstimate.currency !== start.ownEstimate.currency
  const estimateSetOn =
    !estimateChanged && input.ownEstimateDate !== '' ? formatDate(input.ownEstimateDate) : undefined

  async function submit() {
    const today = toIsoDate(new Date())
    const checked = {
      ...keepCatalogueLink(input, linked),
      ownEstimate,
      ownEstimateDate: estimateChanged ? today : input.ownEstimateDate,
    }
    const result = validateGear(checked, today)
    if (!result.ok) {
      setErrors(result.error)
      setFailedSaves((count) => count + 1)
      return
    }
    setSaving(true)
    setProblem(undefined)
    try {
      const item = await onSave(result.value)
      savedRef.current = true
      const currency = usedCurrency(result.value)
      if (currency !== undefined) void repositories.settings.setLastUsedCurrency(currency)
      // Firefox asks the person, so this waits for a save they chose to make
      void storage.requestPersistence()
      await navigate({ to: '/gear/$gearId', params: { gearId: item.id } })
    } catch (error) {
      setProblem(saveProblem(error))
      setSaving(false)
    }
  }

  return (
    <form
      noValidate
      className="grid max-w-2xl gap-8"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <ErrorSummary problems={failedSaves > 0 ? problems : []} ref={summaryRef} />

      <fieldset className="grid gap-4">
        <legend className="label-engraved mb-4 w-full border-b border-border pb-2">Basics</legend>
        <SelectField
          {...props('category')}
          required
          value={input.category}
          emptyLabel="Choose a category"
          choices={choices(CATEGORIES, CATEGORY_LABELS)}
          onChange={(value) => {
            set('category', value)
          }}
        />
        <TextField {...text('brand')} required />
        <ModelField
          {...text('model')}
          required
          category={input.category}
          onPick={pick}
          filled={picked?.model === input.model ? picked.message : undefined}
        />
        {/* A filter is mostly its size, so it's asked for straight after the name */}
        {category === 'filter' && filterThread}
        {applies.has('nickname') && (
          <TextField {...text('nickname')} hint="A name you know it by, such as Main body." />
        )}
        {applies.has('serialNumber') && (
          <TextField
            {...text('serialNumber')}
            kind="code"
            hint="Often on the bottom of a body, or near the mount on a lens."
            describedById={clashes.length > 0 ? 'gear-serialNumber-warning' : undefined}
          >
            {clashes.length > 0 && (
              <p id="gear-serialNumber-warning" className="text-sm">
                Another {input.brand.trim()} item has this serial number:{' '}
                {clashes.map((item, index) => (
                  <span key={item.id}>
                    {index > 0 && ', '}
                    <Link
                      to="/gear/$gearId"
                      params={{ gearId: item.id }}
                      className="underline underline-offset-4"
                    >
                      {gearName(item)}
                    </Link>
                  </span>
                ))}
                . Check it isn't the same item entered twice.
              </p>
            )}
          </TextField>
        )}
        {applies.has('mount') && (
          <SelectField {...text('mount')} emptyLabel="Not set" choices={MOUNT_CHOICES} />
        )}
        {applies.has('sensorFormat') && (
          <SelectField {...text('sensorFormat')} emptyLabel="Not set" choices={FORMAT_CHOICES} />
        )}
        {applies.has('lensCoverage') && (
          <SelectField
            {...text('lensCoverage')}
            hint="The sensor size the lens is made for."
            emptyLabel="Not set"
            choices={FORMAT_CHOICES}
          />
        )}
        {applies.has('focalLengthMin') && (
          <fieldset className="grid gap-1.5">
            <legend className="mb-3 text-sm font-medium">Focal length and aperture</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                {...text('focalLengthMin')}
                kind="number"
                hint="In millimetres. For a prime, its only focal length."
              />
              <TextField
                {...text('focalLengthMax')}
                kind="number"
                hint="For a zoom, such as 70 for a 24-70mm."
              />
              <TextField
                {...text('maxAperture')}
                kind="number"
                hint="As an f-number, such as 2.8."
              />
              <TextField
                {...text('maxApertureTele')}
                kind="number"
                hint="Only if it's slower at the long end, such as 5.6."
              />
            </div>
          </fieldset>
        )}
        {category === 'lens' && filterThread}
        {applies.has('adapterFrom') && (
          <SelectField
            {...text('adapterFrom')}
            hint="The mount of the lenses it takes."
            emptyLabel="Not set"
            choices={MOUNT_CHOICES}
          />
        )}
        {applies.has('adapterTo') && (
          <SelectField
            {...text('adapterTo')}
            hint="The mount of the camera it fits."
            emptyLabel="Not set"
            choices={MOUNT_CHOICES}
          />
        )}
        {applies.has('adapterAutofocus') && (
          <CheckboxField
            id={fieldId('adapterAutofocus')}
            label="Autofocus works through it"
            checked={input.adapterAutofocus}
            onChange={(checked) => {
              set('adapterAutofocus', checked)
            }}
          />
        )}
        <TextField
          {...text('weight')}
          kind="number"
          hint={
            category === 'camera-body'
              ? 'In grams, with its battery and card, such as 658.'
              : 'In grams, such as 658.'
          }
        />
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="label-engraved mb-4 w-full border-b border-border pb-2">Purchase</legend>
        {applies.has('purchaseDate') && <DateField {...text('purchaseDate')} />}
        <MoneyField
          {...money('purchasePrice')}
          hint={status === 'wishlist' ? 'What you expect to pay.' : 'What you paid, including GST.'}
        />
        <TextField {...text('whereBought')} />
        <SelectField
          {...text('condition')}
          emptyLabel="Not set"
          choices={choices(CONDITIONS, CONDITION_LABELS)}
        />
        {applies.has('ownEstimate') && (
          <TextField
            {...props('ownEstimate')}
            error={errors.ownEstimate ?? errors.ownEstimateDate}
            kind="number"
            value={input.ownEstimate.amount}
            onChange={(amount) => {
              set('ownEstimate', { ...input.ownEstimate, amount })
            }}
            hint={[
              `What you think it's worth now, in ${ownEstimate.currency}. Leave it blank to use Bodycap's.`,
              estimateSetOn === undefined ? '' : ` Set on ${estimateSetOn}.`,
            ].join('')}
          />
        )}
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="label-engraved mb-4 w-full border-b border-border pb-2">
          Status and location
        </legend>
        <SelectField
          {...text('status')}
          hint={
            saved === undefined
              ? undefined
              : "To lend it or mark it returned, use the buttons on the item's page."
          }
          choices={statusChoices}
        />
        <TextField {...text('currentLocation')} hint="Where it's kept, or who has it." />
        {applies.has('saleDate') && <DateField {...text('saleDate')} />}
        {applies.has('salePrice') && <MoneyField {...money('salePrice')} />}
        {applies.has('lostDate') && <DateField {...text('lostDate')} />}
      </fieldset>

      {applies.has('warrantyExpiry') && (
        <fieldset className="grid gap-4">
          <legend className="label-engraved mb-4 w-full border-b border-border pb-2">
            Warranty and insurance
          </legend>
          <DateField {...text('warrantyExpiry')} />
          <MoneyField {...money('insuredValue')} hint="What it's insured for, if it has cover." />
        </fieldset>
      )}

      <fieldset className="grid gap-4">
        <legend className="label-engraved mb-4 w-full border-b border-border pb-2">Notes</legend>
        <NotesField {...text('notes')} />
      </fieldset>

      {problem !== undefined && (
        <p role="alert" className="font-medium text-destructive">
          {problem}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <Button type="submit" disabled={saving}>
          Save
        </Button>
        {cancel}
      </div>

      <AlertDialog
        open={blocker.status === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              Your changes haven't been saved, and they'll be lost if you leave.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                blocker.proceed?.()
              }}
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
