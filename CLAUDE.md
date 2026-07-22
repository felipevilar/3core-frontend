# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install       # install dependencies
pnpm dev           # dev server at http://localhost:3000
pnpm build         # production build
pnpm preview       # preview production build
pnpm lint          # ESLint
pnpm typecheck     # vue-tsc type check
```

No test suite is configured.

## Environment

Copy `.env.example` to `.env`. The only required variable is:

```
NUXT_PUBLIC_API_BASE=http://localhost:3030   # URL of the backend REST API
```

## Architecture

This is a **Nuxt 4 SPA** using **Nuxt UI v4** for all UI components. It serves as an admin dashboard that communicates with an external REST API. SSR is disabled in development (`ssr: process.env.NODE_ENV !== 'development'`); in production SSR is on, but the app is architecturally a SPA — all auth is client-side. Components that use browser APIs must use the `.client.vue` suffix or guard with `import.meta.client`.

### Auth flow

1. `app/plugins/auth.ts` runs on app boot: creates `$api` (a `$fetch` instance that attaches `Authorization: Bearer <token>` to every request and calls `logout()` on 401), then hydrates the user state from the persisted cookie if present.
2. `app/composables/useAuth.ts` owns all auth state: the `auth_token` cookie (8-hour TTL) and the `auth_user` useState ref.
3. `app/middleware/auth.global.ts` guards all routes — public routes (`/`, `/login`) are always open; all others require a valid token. Routes with `definePageMeta({ permission: '...' })` also require that specific permission key.

### Permission system (RBAC)

Permission keys follow a `resource.action` convention (e.g. `tecnicos.ver`, `usuarios.gerenciar`, `landing.ver`).

- `usePermissions()` exposes `can(key)`, `canAny(keys[])`, `canAll(keys[])` — all read from `useAuth().permissions`.
- `resolveLandingRoute()` walks a priority list to find the first route the user can access; used after login and as middleware fallback to prevent redirect loops.
- The sidebar (`app/layouts/default.vue`) filters nav items at runtime using `can()`, so items/groups the user lacks permissions for are hidden entirely.
- Pages guard themselves with `definePageMeta({ permission: 'key' })`.

### API access pattern

All authenticated API calls go through `$api` (provided by the auth plugin):

```ts
const { $api } = useNuxtApp()
const data = await $api<MyType>('/some-endpoint')
```

Public reads (no token needed) use `useFetch` directly against `apiBase`:

```ts
const { apiBase } = useRuntimeConfig().public
const { data } = useFetch<MyType>(`${apiBase}/some-public-endpoint`)
```

### Page/layout structure

- `app/layouts/default.vue` — authenticated shell: collapsible sidebar, command palette, notifications slideover, confirm dialog.
- `app/layouts/public.vue` — bare layout for unauthenticated pages.
- `app/pages/settings.vue` and `app/pages/landing-config.vue` — act as nested layouts (render `<NuxtPage />` inside a panel with their own sub-nav).

### Key composables

| Composable | Purpose |
|---|---|
| `useAuth` | Auth state, login/logout/fetchMe/updateProfile/uploadAvatar |
| `usePermissions` | `can()` / `canAny()` / `canAll()` / `resolveLandingRoute()` |
| `useDashboard` | Singleton (via `createSharedComposable`); sidebar state; keyboard shortcuts (`g-h`, `g-i`, `g-c`, `g-s`, `n`) |
| `useConfirm` | Promise-based confirm dialog; usage: `if (await confirm({ title, message, confirmColor: 'error' })) { ... }` |
| `useChamadoDisplay` | Pure display helpers: `statusMeta()`, `prioridadeMeta()`, `paymentMeta()`, `brl()` (BRL currency formatter) |
| `useLandingConfig(type)` | CRUD for landing page config groups/items |
| `useSolicitacoesCount` | Shared badge count for pending solicitations; layout calls `refresh()` on mount; page calls it after accept/reject |

### Types

All domain types are in `app/types/index.d.ts`. Key ones:

- `AuthUser` — logged-in user with `role` and `permissions: string[]`
- `Paginated<T>` — `{ items: T[], total, page, pageSize }` — **all list endpoints return this shape**
- `TechnicianListItem` / `TechnicianDetail` — list vs full profile
- `ManagedUser` / `Role` — for the users/permissions admin pages
- `Chamado` / `ChamadoStatus` / `ChamadoPrioridade` / `PaymentStatus`
- `DateRangeYmd` — `{ de: string, ate: string }` for date filters

### Utilities

`app/utils/index.ts` exports:
- `downloadCsv(filename, headers, rows)` — generates BOM UTF-8, semicolon-delimited CSV for Excel pt-BR compatibility. Numeric currency values must be pre-formatted as pt-BR strings (`"1.234,56"`) for Excel to parse them as numbers.

### Styling

Tailwind CSS v4 via Nuxt UI (no `tailwind.config` file). Icons use `i-lucide-*` and `i-simple-icons-*` prefixes from Iconify. Theme: `primary=green`, `neutral=zinc`. ESLint: no comma-dangle, 1tbs brace style.

## Gotchas

**`USelect` with an empty string value crashes.** Reka UI reserves `''` for "clear". Always use sentinel strings like `'todos'`, `'ativo'`, `'inativo'` instead of `''` for "all/default" options.

**`Paginated<T>` envelope must be unwrapped.** All list endpoints return `{ items, total, page, pageSize }`. Using the full object in `v-for` or `.map()` will throw. Always access `.items`.

**Nuxt 4 nested routing convention.** `foo.vue + foo/[id].vue` makes `foo.vue` a parent layout that requires `<NuxtPage />`. For a simple list+detail pattern use `foo/index.vue + foo/[id].vue`. The `settings.vue` and `landing-config.vue` files intentionally use the parent-layout pattern.

**Avatar upload is a two-step signed URL flow.** `POST /auth/me/avatar/upload-url` → signed URL → `PUT` to Supabase Storage → `PATCH /auth/me/avatar`. Not a direct multipart POST.

**Date filtering requires `America/Sao_Paulo` timezone.** Using bare `T00:00:00` without timezone causes a 3-hour offset bug because Postgres sessions default to UTC.

**`CityAutocomplete` v-model is an integer IBGE city code**, not a string or display name.

**`server/api/` is mock fixture data only** (customers, mails, members, notifications) left from the original Nuxt UI template. These are not real backend endpoints.
