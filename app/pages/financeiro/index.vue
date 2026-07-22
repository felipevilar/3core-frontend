<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type {
  FinanceiroOverview,
  OverviewRow,
  ClientePaymentStatus,
  DateRangeYmd
} from '~/types'

definePageMeta({ permission: 'financeiro.ver' })

const { $api } = useNuxtApp()
const { paymentMeta, clientePaymentMeta, brl } = useChamadoDisplay()
const { can } = usePermissions()
const toast = useToast()

const podeGerenciar = can('financeiro.gerenciar')

// ---- Filtro global de período: default = mês vigente (America/Sao_Paulo) ----
function hojeYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}
function primeiroDiaDoMes(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`
}
const hoje = hojeYmd()
const periodo = ref<DateRangeYmd>({ de: primeiroDiaDoMes(hoje), ate: hoje })

const { data, pending, refresh } = await useAsyncData(
  'financeiro-overview',
  () =>
    $api<FinanceiroOverview>('/financeiro/overview', {
      params: { de: periodo.value.de, ate: periodo.value.ate }
    }),
  { watch: [periodo] }
)

const kpis = computed(() => data.value?.kpis)
const rows = computed<OverviewRow[]>(() => data.value?.rows ?? [])

// ---- Filtros rápidos na tabela (client-side sobre o período carregado) ----
const busca = ref('')
const filtroClienteStatus = ref<ClientePaymentStatus | 'todos'>('todos')
// Só os estados aplicáveis a chamados fechados (sem 'nao_aplicavel').
const filtroTecnicoStatus = ref<'pendente' | 'aprovado' | 'pago' | 'todos'>('todos')
const filtroTecnico = ref<number | 'todos'>('todos')

// Técnicos presentes no período (para o select de "por técnico").
const tecnicosDoPeriodo = computed(() => {
  const map = new Map<number, string>()
  for (const r of rows.value) {
    if (r.tecnicoUserId != null) {
      map.set(r.tecnicoUserId, r.tecnicoNome ?? `Técnico #${r.tecnicoUserId}`)
    }
  }
  return [...map.entries()].map(([value, label]) => ({ value, label }))
})
const tecnicoFilterItems = computed(() => [
  { value: 'todos' as const, label: 'Todos os técnicos' },
  ...tecnicosDoPeriodo.value
])
const clienteStatusItems = [
  { value: 'todos' as const, label: 'Cliente: todos' },
  { value: 'pendente' as const, label: 'Cliente: a receber' },
  { value: 'pago' as const, label: 'Cliente: recebido' }
]
const tecnicoStatusItems = [
  { value: 'todos' as const, label: 'Técnico: todos' },
  { value: 'pendente' as const, label: 'Técnico: pendente' },
  { value: 'aprovado' as const, label: 'Técnico: aprovado' },
  { value: 'pago' as const, label: 'Técnico: pago' }
]

const filtered = computed<OverviewRow[]>(() => {
  const termo = busca.value.trim().toLowerCase()
  return rows.value.filter((r) => {
    if (filtroCliente(r)) return false
    if (filtroTecnicoPg(r)) return false
    if (filtroTecnico.value !== 'todos' && r.tecnicoUserId !== filtroTecnico.value)
      return false
    if (termo) {
      const alvo = `${r.codigo} ${r.titulo} ${r.cliente ?? ''} ${r.tecnicoNome ?? ''}`.toLowerCase()
      if (!alvo.includes(termo)) return false
    }
    return true
  })
})
function filtroCliente(r: OverviewRow): boolean {
  return filtroClienteStatus.value !== 'todos' && r.clientePaymentStatus !== filtroClienteStatus.value
}
function filtroTecnicoPg(r: OverviewRow): boolean {
  return filtroTecnicoStatus.value !== 'todos' && r.paymentStatus !== filtroTecnicoStatus.value
}

// Totais da seleção visível (reagem aos filtros rápidos).
const totaisFiltrados = computed(() => {
  let fat = 0
  let repasse = 0
  for (const r of filtered.value) {
    fat += Number(r.valorClienteTotal)
    repasse += Number(r.custoTecnicoTotal)
  }
  return { fat, repasse, margem: fat - repasse, qtd: filtered.value.length }
})

function limparFiltros() {
  busca.value = ''
  filtroClienteStatus.value = 'todos'
  filtroTecnicoStatus.value = 'todos'
  filtroTecnico.value = 'todos'
}

// ---- KPIs (cards) ----
const kpiCards = computed(() => {
  const k = kpis.value
  return [
    {
      label: 'Faturamento Total',
      hint: 'Receita dos atendimentos realizados no período',
      value: k?.faturamentoTotal,
      icon: 'i-lucide-circle-dollar-sign',
      color: 'text-highlighted'
    },
    {
      label: 'Lucro Bruto',
      hint: 'Faturamento menos repasses aos técnicos',
      value: k?.lucroBruto,
      icon: 'i-lucide-trending-up',
      color: 'text-primary'
    },
    {
      label: 'Pendente a Receber',
      hint: 'Atendimentos ainda não pagos pelo cliente',
      value: k?.pendenteReceber,
      icon: 'i-lucide-clock',
      color: 'text-warning'
    },
    {
      label: 'Pendente a Pagar',
      hint: 'Repasses ainda não pagos aos técnicos',
      value: k?.pendentePagar,
      icon: 'i-lucide-hand-coins',
      color: 'text-warning'
    },
    {
      label: 'Saldo Já Realizado',
      hint: 'O que já entrou (cliente) menos o que já saiu (técnico)',
      value: k?.saldoRealizado,
      icon: 'i-lucide-wallet',
      color: 'text-info'
    }
  ]
})

// ---- Ações de pagamento (financeiro.gerenciar) ----
const salvando = ref<number | null>(null)
async function patchPagamento(row: OverviewRow, body: Record<string, unknown>, sucesso: string) {
  salvando.value = row.id
  try {
    await $api(`/chamados/${row.id}/pagamento`, { method: 'PATCH', body })
    toast.add({ title: sucesso, icon: 'i-lucide-check', color: 'success' })
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string | string[] } }
    const msg = Array.isArray(err?.data?.message) ? err.data.message[0] : err?.data?.message
    toast.add({ title: msg ?? 'Erro ao atualizar', icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    salvando.value = null
  }
}
const marcarClienteRecebido = (r: OverviewRow) =>
  patchPagamento(r, { clientePaymentStatus: 'pago' }, 'Recebimento do cliente registrado')
const marcarClientePendente = (r: OverviewRow) =>
  patchPagamento(r, { clientePaymentStatus: 'pendente' }, 'Recebimento revertido')
const aprovarTecnico = (r: OverviewRow) =>
  patchPagamento(r, { paymentStatus: 'aprovado' }, 'Repasse aprovado')
const pagarTecnico = (r: OverviewRow) =>
  patchPagamento(r, { paymentStatus: 'pago' }, 'Repasse marcado como pago')

// ---- Formatação ----
function dataCurta(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}
// Dinheiro em pt-BR SEM símbolo (para o Excel reconhecer como número no CSV).
function numeroBr(value: string | number): string {
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}
const periodoLabel = computed(() => {
  const p = data.value?.periodo
  if (!p) return ''
  return `${dataCurta(p.de)} a ${dataCurta(p.ate)}`
})
function sufixoArquivo(): string {
  const p = data.value?.periodo
  return p ? `${p.de}_a_${p.ate}` : 'periodo'
}

// ---- Exportação: geral (visão atual da tabela) ----
function exportarGeral() {
  const headers = [
    'Data',
    'Chamado',
    'Cliente',
    'Serviço',
    'Cidade',
    'Técnico',
    'Valor Total',
    'Valor do Técnico',
    'Margem',
    'Status Cliente',
    'Status Técnico',
    'Competência'
  ]
  const linhas = filtered.value.map(r => [
    dataCurta(r.finalizadoEm),
    r.codigo,
    r.cliente ?? '',
    r.titulo,
    r.cidade ?? '',
    r.tecnicoNome ?? '',
    numeroBr(r.valorClienteTotal),
    numeroBr(r.custoTecnicoTotal),
    numeroBr(r.margem),
    clientePaymentMeta(r.clientePaymentStatus).label,
    paymentMeta(r.paymentStatus).label,
    r.paymentPeriodo ?? ''
  ])
  // Linha de totais ao final para conferência do financeiro.
  linhas.push([
    'TOTAIS',
    '',
    '',
    `${totaisFiltrados.value.qtd} atendimento(s)`,
    '',
    '',
    numeroBr(totaisFiltrados.value.fat),
    numeroBr(totaisFiltrados.value.repasse),
    numeroBr(totaisFiltrados.value.margem),
    '',
    '',
    ''
  ])
  downloadCsv(`financeiro_geral_${sufixoArquivo()}`, headers, linhas)
}

// ---- Exportação: fechamento por técnico (planilha limpa p/ enviar ao técnico) ----
const fecharTecOpen = ref(false)
const tecExport = ref<number | 'todos'>('todos')

function linhasDoTecnico(tecnicoUserId: number): OverviewRow[] {
  // Usa TODO o período (não os filtros rápidos): o fechamento é do técnico.
  return rows.value
    .filter(r => r.tecnicoUserId === tecnicoUserId)
    .sort((a, b) => (a.finalizadoEm ?? '').localeCompare(b.finalizadoEm ?? ''))
}

function exportarFechamentoTecnico(tecnicoUserId: number, nome: string) {
  const doTec = linhasDoTecnico(tecnicoUserId)
  if (!doTec.length) return
  const headers = [
    'Data',
    'Chamado',
    'Cliente',
    'Serviço',
    'Cidade',
    'Valor a Receber',
    'Status',
    'Competência'
  ]
  const linhas = doTec.map(r => [
    dataCurta(r.finalizadoEm),
    r.codigo,
    r.cliente ?? '',
    r.titulo,
    r.cidade ?? '',
    numeroBr(r.custoTecnicoTotal),
    paymentMeta(r.paymentStatus).label,
    r.paymentPeriodo ?? ''
  ])
  const total = doTec.reduce((acc, r) => acc + Number(r.custoTecnicoTotal), 0)
  const pago = doTec
    .filter(r => r.paymentStatus === 'pago')
    .reduce((acc, r) => acc + Number(r.custoTecnicoTotal), 0)
  linhas.push(['', '', '', '', 'TOTAL', numeroBr(total), '', ''])
  linhas.push(['', '', '', '', 'JÁ PAGO', numeroBr(pago), '', ''])
  linhas.push(['', '', '', '', 'A RECEBER', numeroBr(total - pago), '', ''])

  const slug = nome.normalize('NFD').replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '')
  downloadCsv(`fechamento_${slug}_${sufixoArquivo()}`, headers, linhas)
}

function exportarFechamento() {
  if (tecExport.value === 'todos') {
    // Itera sobre todos: um arquivo por técnico do período.
    if (!tecnicosDoPeriodo.value.length) {
      toast.add({ title: 'Nenhum técnico no período', icon: 'i-lucide-info', color: 'warning' })
      return
    }
    for (const t of tecnicosDoPeriodo.value) {
      exportarFechamentoTecnico(t.value, t.label)
    }
    toast.add({
      title: `${tecnicosDoPeriodo.value.length} planilha(s) geradas`,
      icon: 'i-lucide-check',
      color: 'success'
    })
  } else {
    const t = tecnicosDoPeriodo.value.find(x => x.value === tecExport.value)
    if (t) exportarFechamentoTecnico(t.value, t.label)
  }
  fecharTecOpen.value = false
}

// ---- Colunas da tabela (desktop) ----
const columns: TableColumn<OverviewRow>[] = [
  { id: 'data', header: 'Data' },
  { accessorKey: 'codigo', header: 'Chamado' },
  { accessorKey: 'cliente', header: 'Cliente' },
  { accessorKey: 'tecnicoNome', header: 'Técnico' },
  { id: 'valorTotal', header: 'Valor Total' },
  { id: 'valorTecnico', header: 'Valor Técnico' },
  { id: 'statusCliente', header: 'Cliente' },
  { id: 'statusTecnico', header: 'Técnico' },
  { id: 'acoes', header: '' }
]
</script>

<template>
  <UDashboardPanel id="financeiro">
    <template #header>
      <UDashboardNavbar title="Financeiro">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              label="Exportar Geral"
              icon="i-lucide-download"
              color="neutral"
              variant="subtle"
              :disabled="!filtered.length"
              @click="exportarGeral"
            />
            <UButton
              label="Fechamento por Técnico"
              icon="i-lucide-file-spreadsheet"
              color="neutral"
              variant="subtle"
              :disabled="!tecnicosDoPeriodo.length"
              @click="fecharTecOpen = true"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Cabeçalho + filtro global de período -->
      <UPageCard
        title="Controle Financeiro"
        description="Lucros, pendências, recebimentos e comissionamento dos atendimentos fechados no período."
        variant="naked"
        orientation="horizontal"
        class="mb-4"
      >
        <div class="flex items-center gap-2 lg:ms-auto">
          <DateRangePicker
            v-model="periodo"
            label=""
            placeholder="Período"
            color="var(--color-brand-blue-light)"
          />
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="subtle"
            :loading="pending"
            @click="() => refresh()"
          />
        </div>
      </UPageCard>

      <!-- KPIs -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-4">
        <UPageCard v-for="c in kpiCards" :key="c.label" variant="subtle">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="text-muted text-xs">
                {{ c.label }}
              </p>
              <p class="text-2xl font-semibold truncate" :class="c.color">
                <span v-if="pending" class="text-dimmed">—</span>
                <span v-else>{{ brl(c.value) }}</span>
              </p>
            </div>
            <UIcon :name="c.icon" class="size-5 shrink-0 text-dimmed" />
          </div>
          <p class="text-dimmed text-[11px] leading-tight mt-1">
            {{ c.hint }}
          </p>
        </UPageCard>
      </div>

      <!-- Tabela de controle de atendimentos -->
      <UPageCard variant="subtle" :ui="{ container: 'p-0 sm:p-0 gap-y-0' }">
        <!-- Filtros rápidos -->
        <div class="p-4 sm:px-6 border-b border-default space-y-3">
          <div class="flex flex-col lg:flex-row lg:items-center gap-3">
            <UInput
              v-model="busca"
              icon="i-lucide-search"
              placeholder="Buscar por chamado, cliente, serviço ou técnico"
              class="w-full lg:max-w-xs"
            />
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
              <USelect
                v-model="filtroTecnico"
                :items="tecnicoFilterItems"
                icon="i-lucide-hard-hat"
              />
              <USelect
                v-model="filtroClienteStatus"
                :items="clienteStatusItems"
                icon="i-lucide-building-2"
              />
              <USelect
                v-model="filtroTecnicoStatus"
                :items="tecnicoStatusItems"
                icon="i-lucide-wallet"
              />
            </div>
            <UButton
              label="Limpar"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              @click="limparFiltros"
            />
          </div>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span>{{ periodoLabel }}</span>
            <span class="text-dimmed">•</span>
            <span>{{ totaisFiltrados.qtd }} atendimento(s)</span>
            <span class="text-dimmed">•</span>
            <span>Faturamento <strong class="text-highlighted">{{ brl(totaisFiltrados.fat) }}</strong></span>
            <span class="text-dimmed">•</span>
            <span>Repasse <strong class="text-highlighted">{{ brl(totaisFiltrados.repasse) }}</strong></span>
            <span class="text-dimmed">•</span>
            <span>Margem <strong class="text-primary">{{ brl(totaisFiltrados.margem) }}</strong></span>
          </div>
        </div>

        <div v-if="pending" class="py-10 flex justify-center">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
        </div>

        <template v-else>
          <!-- Desktop: tabela -->
          <UTable
            :data="filtered"
            :columns="columns"
            class="hidden lg:block"
            :ui="{
              base: 'min-w-full',
              thead: '[&>tr]:bg-elevated/30',
              th: 'py-2 text-xs font-medium text-muted uppercase tracking-wide',
              td: 'py-3 align-top border-b border-default',
              tr: 'hover:bg-elevated/30 transition-colors'
            }"
          >
            <template #data-cell="{ row }">
              <span class="text-sm text-highlighted whitespace-nowrap">{{ dataCurta(row.original.finalizadoEm) }}</span>
            </template>

            <template #codigo-cell="{ row }">
              <NuxtLink :to="`/chamados/${row.original.id}`" class="min-w-0 max-w-xs block group">
                <p class="text-highlighted font-medium truncate group-hover:text-primary transition-colors">
                  <span class="text-muted text-xs font-mono">{{ row.original.codigo }}</span>
                  {{ row.original.titulo }}
                </p>
                <p v-if="row.original.cidade" class="text-muted text-xs truncate">{{ row.original.cidade }}</p>
              </NuxtLink>
            </template>

            <template #cliente-cell="{ row }">
              <span class="text-sm text-highlighted truncate">{{ row.original.cliente ?? '—' }}</span>
            </template>

            <template #tecnicoNome-cell="{ row }">
              <span v-if="row.original.tecnicoNome" class="text-sm text-highlighted inline-flex items-center gap-1">
                <UIcon name="i-lucide-hard-hat" class="size-3.5" /> {{ row.original.tecnicoNome }}
              </span>
              <span v-else class="text-dimmed text-sm">—</span>
            </template>

            <template #valorTotal-cell="{ row }">
              <span class="text-sm text-highlighted font-medium">{{ brl(row.original.valorClienteTotal) }}</span>
            </template>

            <template #valorTecnico-cell="{ row }">
              <div class="text-sm">
                <p class="text-highlighted">
                  {{ brl(row.original.custoTecnicoTotal) }}
                </p>
                <p class="text-dimmed text-xs">
                  margem {{ brl(row.original.margem) }}
                </p>
              </div>
            </template>

            <template #statusCliente-cell="{ row }">
              <UBadge :color="clientePaymentMeta(row.original.clientePaymentStatus).color" variant="subtle" size="sm">
                {{ clientePaymentMeta(row.original.clientePaymentStatus).label }}
              </UBadge>
            </template>

            <template #statusTecnico-cell="{ row }">
              <UBadge :color="paymentMeta(row.original.paymentStatus).color" variant="subtle" size="sm">
                {{ paymentMeta(row.original.paymentStatus).label }}
              </UBadge>
            </template>

            <template #acoes-cell="{ row }">
              <div v-if="podeGerenciar" class="flex items-center justify-end gap-1">
                <UButton
                  v-if="row.original.clientePaymentStatus === 'pendente'"
                  label="Receber"
                  icon="i-lucide-check"
                  size="xs"
                  color="success"
                  variant="subtle"
                  :loading="salvando === row.original.id"
                  @click="marcarClienteRecebido(row.original)"
                />
                <UButton
                  v-else
                  icon="i-lucide-rotate-ccw"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  title="Reverter recebimento do cliente"
                  :loading="salvando === row.original.id"
                  @click="marcarClientePendente(row.original)"
                />
                <UButton
                  v-if="row.original.paymentStatus === 'pendente'"
                  label="Aprovar"
                  size="xs"
                  color="info"
                  variant="subtle"
                  :loading="salvando === row.original.id"
                  @click="aprovarTecnico(row.original)"
                />
                <UButton
                  v-else-if="row.original.paymentStatus === 'aprovado'"
                  label="Pagar"
                  size="xs"
                  color="primary"
                  variant="subtle"
                  :loading="salvando === row.original.id"
                  @click="pagarTecnico(row.original)"
                />
                <UButton
                  icon="i-lucide-eye"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :to="`/chamados/${row.original.id}`"
                />
              </div>
              <UButton
                v-else
                icon="i-lucide-eye"
                size="xs"
                color="neutral"
                variant="ghost"
                :to="`/chamados/${row.original.id}`"
              />
            </template>

            <template #empty>
              <span class="text-sm text-muted">Nenhum atendimento fechado no período com esses filtros.</span>
            </template>
          </UTable>

          <!-- Mobile: cards -->
          <ul role="list" class="divide-y divide-default lg:hidden">
            <li
              v-for="r in filtered"
              :key="r.id"
              class="flex flex-col gap-2 py-3 px-4 sm:px-6"
            >
              <div class="flex items-start justify-between gap-2">
                <NuxtLink :to="`/chamados/${r.id}`" class="min-w-0">
                  <p class="text-highlighted font-medium truncate">
                    <span class="text-muted text-xs font-mono">{{ r.codigo }}</span>
                    {{ r.titulo }}
                  </p>
                  <p class="text-muted text-sm truncate">{{ r.cliente ?? '—' }}</p>
                  <p v-if="r.tecnicoNome" class="text-muted text-xs truncate inline-flex items-center gap-1">
                    <UIcon name="i-lucide-hard-hat" class="size-3" /> {{ r.tecnicoNome }}
                  </p>
                </NuxtLink>
                <div class="text-right shrink-0">
                  <p class="text-highlighted font-semibold">
                    {{ brl(r.valorClienteTotal) }}
                  </p>
                  <p class="text-dimmed text-xs">
                    téc. {{ brl(r.custoTecnicoTotal) }}
                  </p>
                  <p class="text-dimmed text-[10px]">
                    {{ dataCurta(r.finalizadoEm) }}
                  </p>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <UBadge :color="clientePaymentMeta(r.clientePaymentStatus).color" variant="subtle" size="sm">
                  Cliente: {{ clientePaymentMeta(r.clientePaymentStatus).label }}
                </UBadge>
                <UBadge :color="paymentMeta(r.paymentStatus).color" variant="subtle" size="sm">
                  Técnico: {{ paymentMeta(r.paymentStatus).label }}
                </UBadge>
              </div>
              <div v-if="podeGerenciar" class="flex flex-wrap gap-2">
                <UButton
                  v-if="r.clientePaymentStatus === 'pendente'"
                  label="Marcar recebido"
                  icon="i-lucide-check"
                  size="xs"
                  color="success"
                  variant="subtle"
                  :loading="salvando === r.id"
                  @click="marcarClienteRecebido(r)"
                />
                <UButton
                  v-if="r.paymentStatus === 'pendente'"
                  label="Aprovar repasse"
                  size="xs"
                  color="info"
                  variant="subtle"
                  :loading="salvando === r.id"
                  @click="aprovarTecnico(r)"
                />
                <UButton
                  v-else-if="r.paymentStatus === 'aprovado'"
                  label="Pagar repasse"
                  size="xs"
                  color="primary"
                  variant="subtle"
                  :loading="salvando === r.id"
                  @click="pagarTecnico(r)"
                />
              </div>
            </li>
            <li v-if="!filtered.length" class="py-10 text-center text-sm text-muted">
              Nenhum atendimento fechado no período com esses filtros.
            </li>
          </ul>
        </template>
      </UPageCard>
    </template>
  </UDashboardPanel>

  <!-- Modal: fechamento por técnico. Fica FORA do UDashboardPanel: como filho
       direto ele cairia no slot default do painel e ocultaria header/body. -->
  <UModal v-model:open="fecharTecOpen" title="Exportar fechamento por técnico">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Gera uma planilha limpa com os atendimentos do técnico no período
          ({{ periodoLabel }}), o status de cada serviço e o total a receber —
          pronta para enviar a ele.
        </p>
        <UFormField label="Técnico">
          <USelect
            v-model="tecExport"
            :items="[{ value: 'todos', label: 'Todos (um arquivo por técnico)' }, ...tecnicosDoPeriodo]"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          @click="fecharTecOpen = false"
        />
        <UButton label="Exportar" icon="i-lucide-download" @click="exportarFechamento" />
      </div>
    </template>
  </UModal>
</template>
