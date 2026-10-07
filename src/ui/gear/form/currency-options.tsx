// Every currency as select options, in groups.
import { NativeSelectOptGroup, NativeSelectOption } from '@/ui/components/ui/native-select'
import { CURRENCY_GROUPS, currencyName } from '@/ui/gear/form/currencies'

// Built once: every amount field shares these few hundred options, and React skips an element it
// has already rendered, so typing elsewhere in the form doesn't rebuild them
export const CURRENCY_OPTIONS = CURRENCY_GROUPS.map((group) => (
  <NativeSelectOptGroup key={group.label} label={group.label}>
    {group.codes.map((code) => (
      <NativeSelectOption key={code} value={code}>
        {currencyName(code)}
      </NativeSelectOption>
    ))}
  </NativeSelectOptGroup>
))
