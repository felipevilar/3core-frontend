export function useLandingConfig(type: 'area' | 'tool') {
  const { apiBase } = useRuntimeConfig().public
  const { $api } = useNuxtApp()
  const base = `${apiBase}/landing-config`

  // Leitura é pública (endpoint @Public na API).
  const { data: groups, refresh, status } = useFetch<{
    id: number
    name: string
    active: boolean
    order: number
    items: { id: number; label: string; active: boolean; order: number }[]
  }[]>(`${base}/groups/${type}`)

  // Mutações passam pelo $api (com Bearer) — exigem 'landing.gerenciar'.
  async function updateGroup(id: number, body: Record<string, unknown>) {
    await $api(`/landing-config/groups/${id}`, { method: 'PATCH', body })
    await refresh()
  }

  async function deleteGroup(id: number) {
    await $api(`/landing-config/groups/${id}`, { method: 'DELETE' })
    await refresh()
  }

  async function createGroup(name: string) {
    await $api(`/landing-config/groups`, { method: 'POST', body: { type, name } })
    await refresh()
  }

  async function updateItem(id: number, body: Record<string, unknown>) {
    await $api(`/landing-config/items/${id}`, { method: 'PATCH', body })
    await refresh()
  }

  async function deleteItem(id: number) {
    await $api(`/landing-config/items/${id}`, { method: 'DELETE' })
    await refresh()
  }

  async function createItem(groupId: number, label: string) {
    await $api(`/landing-config/groups/${groupId}/items`, { method: 'POST', body: { label } })
    await refresh()
  }

  return { groups, status, updateGroup, deleteGroup, createGroup, updateItem, deleteItem, createItem }
}
