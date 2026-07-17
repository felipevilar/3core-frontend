import type { Paginated, Chamado } from '~/types'

/**
 * Contagem de solicitações pendentes de aceite para o técnico logado.
 * Compartilhado via useState — o layout busca uma vez, a página de
 * solicitações pode chamar refresh() após aceitar/recusar.
 */
export function useSolicitacoesCount() {
  const { $api } = useNuxtApp()
  const { can } = usePermissions()

  const count = useState<number>('solicitacoes-count', () => 0)
  const loading = useState<boolean>('solicitacoes-count-loading', () => false)

  async function refresh() {
    // Só quem responde solicitações (técnico) tem essa contagem.
    if (!can('atendimentos.ver_solicitacoes')) return
    loading.value = true
    try {
      const res = await $api<Paginated<Chamado>>('/chamados', {
        params: { solicitacaoPendente: true, pageSize: 50 }
      })
      count.value = res.total
    } catch {
      // silencia — o badge some mas não quebra a UI
    } finally {
      loading.value = false
    }
  }

  return { count, loading, refresh }
}
