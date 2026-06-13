/**
 * Guarda de rota global:
 *  - rotas públicas (`/`, `/login`) sempre liberadas;
 *  - sem token → redireciona para /login (guardando o destino em ?redirect);
 *  - rota com `meta.permission` exige a permissão correspondente.
 */
const PUBLIC_ROUTES = new Set(['/', '/login'])

export default defineNuxtRouteMiddleware((to) => {
  if (PUBLIC_ROUTES.has(to.path)) {
    return
  }

  const { isAuthenticated } = useAuth()
  if (!isAuthenticated.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  const required = to.meta.permission as string | undefined
  if (required) {
    const { can } = usePermissions()
    if (!can(required)) {
      // Sem permissão para esta página → volta para o painel inicial.
      return navigateTo('/dashboard')
    }
  }
})
