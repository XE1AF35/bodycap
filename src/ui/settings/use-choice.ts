// A setting picked from a list, shown as soon as it's picked rather than once storage says it's
// saved, so the select never flicks back. Whenever the saved value changes, it's shown as saved.
import { useState } from 'react'

export function useChoice(saved: string, save: (value: string) => Promise<void>) {
  const [shown, setShown] = useState(saved)
  const [last, setLast] = useState(saved)
  const [problem, setProblem] = useState<string>()
  // React's way to reset state when a prop changes, without an effect and a second render
  if (last !== saved) {
    setLast(saved)
    setShown(saved)
  }

  return {
    shown,
    problem,
    choose: (value: string) => {
      setShown(value)
      setProblem(undefined)
      save(value).catch(() => {
        setShown(saved)
        setProblem("That couldn't be saved. Try again.")
      })
    },
  }
}
