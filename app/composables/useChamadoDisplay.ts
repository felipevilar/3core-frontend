import type { ChamadoStatus, ChamadoPrioridade, PaymentStatus } from '~/types'

type BadgeColor = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info'

const STATUS_META: Record<ChamadoStatus, { label: string, color: BadgeColor }> = {
  aberto: { label: 'Aberto', color: 'neutral' },
  atribuido: { label: 'Atribuído', color: 'info' },
  a_caminho: { label: 'A caminho', color: 'info' },
  em_atendimento: { label: 'Em atendimento', color: 'warning' },
  finalizado: { label: 'Finalizado', color: 'primary' },
  fechado: { label: 'Fechado', color: 'success' },
  cancelado: { label: 'Cancelado', color: 'error' }
}

const PRIORIDADE_META: Record<ChamadoPrioridade, { label: string, color: BadgeColor }> = {
  baixa: { label: 'Baixa', color: 'neutral' },
  media: { label: 'Média', color: 'info' },
  alta: { label: 'Alta', color: 'warning' },
  urgente: { label: 'Urgente', color: 'error' }
}

const PAYMENT_META: Record<PaymentStatus, { label: string, color: BadgeColor }> = {
  nao_aplicavel: { label: '—', color: 'neutral' },
  pendente: { label: 'Pendente', color: 'warning' },
  aprovado: { label: 'Aprovado', color: 'info' },
  pago: { label: 'Pago', color: 'success' }
}

const EVENT_LABEL: Record<string, string> = {
  criado: 'Chamado criado',
  atribuido: 'Técnico atribuído',
  reatribuido: 'Técnico reatribuído',
  a_caminho: 'Técnico a caminho',
  chegada: 'Chegada confirmada',
  finalizado: 'Finalizado pelo técnico',
  fechado: 'Fechado pelo gestor',
  reaberto: 'Reaberto',
  cancelado: 'Cancelado',
  editado: 'Editado',
  rat_anexado: 'RAT anexada',
  line_item_alterado: 'Item financeiro alterado',
  financeiro_alterado: 'Financeiro alterado',
  pagamento_alterado: 'Pagamento alterado'
}

/** Helpers de exibição de chamados (labels, cores, formatação de dinheiro). */
export function useChamadoDisplay() {
  const statusMeta = (s: ChamadoStatus) => STATUS_META[s] ?? { label: s, color: 'neutral' as BadgeColor }
  const prioridadeMeta = (p: ChamadoPrioridade) => PRIORIDADE_META[p] ?? { label: p, color: 'neutral' as BadgeColor }
  const paymentMeta = (p: PaymentStatus) => PAYMENT_META[p] ?? { label: p, color: 'neutral' as BadgeColor }
  const eventLabel = (t: string) => EVENT_LABEL[t] ?? t

  function brl(value?: string | number | null): string {
    const n = Number(value ?? 0)
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return { statusMeta, prioridadeMeta, paymentMeta, eventLabel, brl }
}
