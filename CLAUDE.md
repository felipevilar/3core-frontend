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

This is a **Nuxt 4 SPA** (`ssr: false`) using **Nuxt UI v4** for all UI components. It serves as an admin dashboard that communicates with an external REST API.

### Auth flow

1. `app/plugins/auth.ts` runs on app boot: creates `$api` (a `$fetch` instance that attaches `Authorization: Bearer <token>` to every request and redirects to `/login` on 401), then hydrates the user state from the persisted cookie if present.
2. `app/composables/useAuth.ts` owns all auth state: the `auth_token` cookie (8-hour TTL) and the `auth_user` useState ref.
3. `app/middleware/auth.global.ts` guards all routes — public routes (`/`, `/login`) are always open; all others require a valid token. Routes with `definePageMeta({ permission: '...' })` also require that specific permission key.

### Permission system (RBAC)

Permission keys follow a `resource.action` convention (e.g. `tecnicos.ver`, `usuarios.gerenciar`, `landing.ver`).

- `usePermissions()` exposes `can(key)`, `canAny(keys[])`, `canAll(keys[])` — all read from `useAuth().permissions`.
- The sidebar (`app/layouts/default.vue`) filters nav items at runtime using `can()`, so items/groups the user lacks permissions for are hidden entirely.
- Pages guard themselves with `definePageMeta({ permission: 'key' })`.

### API access pattern

All authenticated API calls go through `$api` (provided by the auth plugin):

```ts
const { $api } = useNuxtApp()
const data = await $api<MyType>('/some-endpoint')
```

Public reads (no token needed) use `useFetch` directly against `apiBase` — see `useLandingConfig.ts` as an example.

### Page/layout structure

- `app/layouts/default.vue` — authenticated shell: collapsible sidebar, command palette, notifications slideover.
- `app/layouts/public.vue` — bare layout for unauthenticated pages.
- `app/pages/settings.vue` — acts as a nested layout (renders `<NuxtPage />` inside a panel with its own sub-nav).
- `server/api/` — Nuxt server routes that return mock/fixture data for customers, mail, members, and notifications (not real backend endpoints).

### Key composables

| Composable | Purpose |
|---|---|
| `useAuth` | Auth state, login/logout/fetchMe |
| `usePermissions` | `can()` / `canAny()` / `canAll()` helpers |
| `useDashboard` | Shared sidebar state + keyboard shortcuts (`g-h`, `g-i`, `g-c`, `g-s`, `n`) |
| `useLandingConfig(type)` | CRUD for landing page config groups/items |

### Types

All domain types are in `app/types/index.d.ts`. Key ones:

- `AuthUser` — logged-in user with `role` and `permissions: string[]`
- `TechnicianListItem` / `TechnicianDetail` — list vs full profile for technicians
- `ManagedUser` / `Role` — for the users/permissions admin pages

### Styling

Tailwind CSS v4 via Nuxt UI. ESLint is configured with stylistic rules (no comma-dangle, 1tbs brace style). Icons use `i-lucide-*` and `i-simple-icons-*` prefixes from Iconify.
