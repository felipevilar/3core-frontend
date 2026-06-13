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

  return { can, canAny, canAll }
}
