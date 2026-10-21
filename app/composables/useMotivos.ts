import type { Motivo, MotivoTipo } from '~/types'

/**
 * Catálogo de motivos classificados (cancelamento/recusa/reabertura/pausa),
 * em cache por tipo. Falhas (ex.: sem permissão) devolvem lista vazia — o
 * select simplesmente não aparece e o texto livre continua valendo.
 */
export function useMotivos() {
  const { $api } = useNuxtApp()
  const cache = useState<Partial<Record<MotivoTipo, Motivo[]>>>('motivos-cache', () => ({}))

  async function carregar(tipo: MotivoTipo, force = false): Promise<Motivo[]> {
    if (!force && cache.value[tipo]) return cache.value[tipo]!
    try {
      const rows = await $api<Motivo[]>('/configuracoes/motivos', { params: { tipo } })
      cache.value = { ...cache.value, [tipo]: rows }
      return rows
    } catch {
      return []
    }
  }

  // Itens para USelect — `0` é o sentinela "sem classificação".
  function items(lista: Motivo[]) {
    return [
      { label: 'Sem classificação', value: 0 },
      ...lista.filter(m => m.ativo).map(m => ({ label: m.nome, value: m.id }))
    ]
  }

  return { carregar, items, cache }
}
