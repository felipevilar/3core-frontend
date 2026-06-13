export function useLandingConfig(type: 'area' | 'tool') {
  const { apiBase } = useRuntimeConfig().public
  const base = `${apiBase}/landing-config`

  const { data: groups, refresh, status } = useFetch<{
    id: number
    name: string
    active: boolean
    order: number
    items: { id: number; label: string; active: boolean; order: number }[]
  }[]>(`${base}/groups/${type}`)

  async function updateGroup(id: number, body: Record<string, unknown>) {
    await $fetch(`${base}/groups/${id}`, { method: 'PATCH', body })
    await refresh()
  }

  async function deleteGroup(id: number) {
    await $fetch(`${base}/groups/${id}`, { method: 'DELETE' })
    await refresh()
  }

  async function createGroup(name: string) {
    await $fetch(`${base}/groups`, { method: 'POST', body: { type, name } })
    await refresh()
  }

  async function updateItem(id: number, body: Record<string, unknown>) {
    await $fetch(`${base}/items/${id}`, { method: 'PATCH', body })
    await refresh()
  }

  async function deleteItem(id: number) {
    await $fetch(`${base}/items/${id}`, { method: 'DELETE' })
    await refresh()
  }

  async function createItem(groupId: number, label: string) {
    await $fetch(`${base}/groups/${groupId}/items`, { method: 'POST', body: { label } })
    await refresh()
  }

  return { groups, status, updateGroup, deleteGroup, createGroup, updateItem, deleteItem, createItem }
}
