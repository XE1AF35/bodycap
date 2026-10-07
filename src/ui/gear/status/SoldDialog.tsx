// Marking an item as sold, with the sale date and price the lifecycle rules ask for.
import { useState } from 'react'
import type { MoneyInput } from '@/core/gear'
import { DEFAULT_CURRENCY } from '@/core/money'
import { DateField, MoneyField } from '@/ui/gear/form/fields'
import { gearName } from '@/ui/gear/labels'
import { useServices } from '@/ui/services'
import { focusFirst, forFields, type ChangeProps } from './change-props'
import { FormDialog } from './FormDialog'
import { saveStatusChange } from './status-change'

const DATE_ID = 'sold-saleDate'
const PRICE_ID = 'sold-salePrice'

// A message goes once its field is changed, so each can be cleared
type SaleErrors = Partial<Record<'saleDate' | 'salePrice', string | undefined>>

export function SoldDialog({ item, today, onDone, onCancel }: ChangeProps) {
  const { repositories } = useServices()
  // A sale is usually in the currency it was bought in
  const blank = (): MoneyInput => ({
    amount: '',
    currency: item.purchasePrice?.currency ?? DEFAULT_CURRENCY,
  })
  const [saleDate, setSaleDate] = useState(today)
  const [salePrice, setSalePrice] = useState(blank)
  const [errors, setErrors] = useState<SaleErrors>({})

  return (
    <FormDialog
      title={`Sell ${gearName(item)}`}
      submit="Mark as sold"
      returnFocus={false}
      onCancel={onCancel}
      onSubmit={async () => {
        const change = { to: 'sold', saleDate, salePrice } as const
        const found = await saveStatusChange(repositories.gear, item, change, today)
        if (found === undefined) {
          onDone('Marked as sold.')
          return
        }
        const mine = forFields(found, ['saleDate', 'salePrice'])
        setErrors(mine)
        focusFirst([DATE_ID, PRICE_ID], { [DATE_ID]: mine.saleDate, [PRICE_ID]: mine.salePrice })
      }}
    >
      <DateField
        id={DATE_ID}
        label="Sale date"
        value={saleDate}
        error={errors.saleDate}
        onChange={(value) => {
          setSaleDate(value)
          setErrors((previous) => ({ ...previous, saleDate: undefined }))
        }}
      />
      <MoneyField
        id={PRICE_ID}
        label="Sale price"
        value={salePrice}
        error={errors.salePrice}
        onChange={(value) => {
          setSalePrice(value)
          setErrors((previous) => ({ ...previous, salePrice: undefined }))
        }}
      />
    </FormDialog>
  )
}
