// Zod can speed up checks by building code with new Function, which the Content Security Policy and
// Trusted Types forbid (and report even when Zod catches the error). Zod decides as each schema is
// created, so this has to run before any module that defines one: main.tsx imports it first.
import { z } from 'zod'

z.config({ jitless: true })
