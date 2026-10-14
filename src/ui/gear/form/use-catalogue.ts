// Loads the gear catalogue when the add or edit page opens. The data ships as its own chunk, so
// nothing else waits for it, and it loads once however many forms open. If it can't load, the Model
// field simply suggests nothing, and a later form tries again.
import { useEffect, useState } from 'react'
import {
  createCatalogueSearch,
  type CatalogueQuery,
  type CatalogueResults,
} from '@/core/catalogue/search'

export type CatalogueSearch = (text: string, query: CatalogueQuery) => CatalogueResults | undefined

let loading: Promise<CatalogueSearch> | undefined

function loadCatalogue(): Promise<CatalogueSearch> {
  loading ??= import('@/core/catalogue/data').then(({ CATALOGUE }) =>
    createCatalogueSearch(CATALOGUE.entries),
  )
  loading.catch(() => {
    loading = undefined
  })
  return loading
}

/** The catalogue search, once it has loaded */
export function useCatalogue(): CatalogueSearch | undefined {
  const [search, setSearch] = useState<CatalogueSearch>()
  useEffect(() => {
    let mounted = true
    loadCatalogue().then(
      (loaded) => {
        if (mounted) setSearch(() => loaded)
      },
      () => undefined,
    )
    return () => {
      mounted = false
    }
  }, [])
  return search
}
