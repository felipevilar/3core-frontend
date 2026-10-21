import type { Notificacao } from '~/types'

/**
 * Notificações in-app do usuário logado (GET /notificacoes). Estado
 * compartilhado via useState: o layout faz polling da contagem (60 s) e o
 * slideover carrega a lista sob demanda.
 */
export function useNotificacoes() {
  const { $api } = useNuxtApp()
  const { isAuthenticated } = useAuth()

  const count = useState<number>('notificacoes-count', () => 0)
  const items = useState<Notificacao[]>('notificacoes-items', () => [])
  const loading = useState<boolean>('notificacoes-loading', () => false)

  async function refreshCount() {
    if (!isAuthenticated.value) return
    try {
      const r = await $api<{ count: number }>('/notificacoes/count')
      count.value = r.count ?? 0
    } catch {
      // silencia — o badge apenas não atualiza
    }
  }

  async function carregar(limit = 50) {
    if (!isAuthenticated.value) return
    loading.value = true
    try {
      items.value = await $api<Notificacao[]>('/notificacoes', { params: { limit } })
      count.value = items.value.filter(n => !n.lidaEm).length
    } catch {
      items.value = []
    } finally {
      loading.value = false
    }
  }

  async function marcarLida(id: number) {
    const n = items.value.find(x => x.id === id)
    if (!n || n.lidaEm) return
    try {
      await $api(`/notificacoes/${id}/lida`, { method: 'PATCH' })
      n.lidaEm = new Date().toISOString()
      count.value = Math.max(0, count.value - 1)
    } catch {
      // mantém como não lida
    }
  }

  async function marcarTodas() {
    try {
      await $api('/notificacoes/lidas', { method: 'PATCH' })
      const agora = new Date().toISOString()
      items.value.forEach((n) => {
        if (!n.lidaEm) n.lidaEm = agora
      })
      count.value = 0
    } catch {
      // ignora
    }
  }

  return { count, items, loading, refreshCount, carregar, marcarLida, marcarTodas }
}
