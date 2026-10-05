/** Whether a value is on a fixed list, narrowing its type so it can be stored as that choice. */
export function isOneOf<T extends string>(choices: readonly T[], value: string): value is T {
  return choices.some((choice) => choice === value)
}
