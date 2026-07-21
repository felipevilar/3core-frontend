/**
 * Rotas candidatas para "pouso" após o login e fallback quando falta permissão,
 * em ordem de prioridade (espelha o menu lateral). `permission: null` significa
 * acessível a qualquer usuário autenticado — garante um destino final e evita
 * loops de redirecionamento.
 */
const LANDING_ROUTES: { path: string, permission: string | null }[] = [
  { path: '/dashboard', permission: 'dashboard.ver' },
  { path: '/technicians', permission: 'tecnicos.ver' },
  { path: '/clientes', permission: 'clientes.ver' },
  { path: '/chamados', permission: 'atendimentos.ver' },
  { path: '/chamados/solicitacoes', permission: 'atendimentos.ver_solicitacoes' },
  { path: '/financeiro', permission: 'financeiro.ver' },
  { path: '/financeiro/meus-ganhos', permission: 'financeiro.ver_proprio' },
  { path: '/landing-config', permission: 'landing.ver' },
  { path: '/settings', permission: null }
]

/**
 * Helpers de verificação de permissão, usados em middleware e templates.
 * Ex.: const { can } = usePermissions(); if (can('clientes.ver')) ...
 */
export function usePermissions() {
  const { permissions } = useAuth()

  function can(key: string): boolean {
    return permissions.value.includes(key)
  }

  function canAny(keys: string[]): boolean {
    return keys.some(k => permissions.value.includes(k))
  }

  function canAll(keys: string[]): boolean {
    return keys.every(k => permissions.value.includes(k))
  }

  // Primeira rota (por prioridade) que o usuário atual pode acessar.
  // `/settings` (Perfil) não exige permissão, então sempre há um destino.
  function resolveLandingRoute(): string {
    const target = LANDING_ROUTES.find(r => !r.permission || can(r.permission))
    return target?.path ?? '/settings'
  }

  return { can, canAny, canAll, resolveLandingRoute }
}
