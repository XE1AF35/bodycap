// Shared setup for storage tests. Dexie skips live queries when there's no global indexedDB at
// load time (it assumes server rendering), so fake-indexeddb is installed globally before Dexie
// loads. Each test still passes Dexie its own fresh IDBFactory, so tests never share data.
import 'fake-indexeddb/auto'
