<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type {
  Chamado,
  ChamadoStatus,
  DateRangeYmd,
  Paginated,
  TechnicianListItem
} from '~/types'

definePageMeta({ permission: 'atendimentos.ver' })

const { $api } = useNuxtApp()
const { can } = usePermissions()
const { statusMeta, prioridadeMeta, paymentMeta, brl } = useChamadoDisplay()

const canCriar = can('atendimentos.criar')
const podeFin = can('financeiro.ver')
const podeGerenciar = can('atendimentos.gerenciar')
const podeVerTecnicos = can('tecnicos.ver')

// ---- Opções dos multi-selects ----
type Opt<T> = { label: string, value: T }
const statusOptions: Opt<ChamadoStatus>[] = [
  { label: 'Aberto', value: 'aberto' },
  { label: 'Solicitado', value: 'solicitado' },
  { label: 'Atribuído', value: 'atribuido' },
  { label: 'A caminho', value: 'a_caminho' },
  { label: 'Em atendimento', value: 'em_atendimento' },
  { label: 'Finalizado', value: 'finalizado' },
  { label: 'Fechado', value: 'fechado' },
  { label: 'Cancelado', value: 'cancelado' }
]
const prioridadeOptions: Opt<string>[] = [
  { label: 'Urgente', value: 'urgente' },
  { label: 'Alta', value: 'alta' },
  { label: 'Média', value: 'media' },
  { label: 'Baixa', value: 'baixa' }
]

// Técnicos p/ o multi-select (só faz sentido para gerentes que veem todos).
// /technicians é paginado ({items,...}); pedimos um lote grande e usamos .items.
const { data: tecnicos } = await useAsyncData(
  'tecnicos-filtro',
  () => (podeGerenciar && podeVerTecnicos
    ? $api<Paginated<TechnicianListItem>>('/technicians', { params: { pageSize: 200 } }).then(r => r.items)
    : Promise.resolve([] as TechnicianListItem[])),
  { default: () => [] as TechnicianListItem[] }
)
const tecnicoOptions = computed<Opt<number>[]>(() =>
  (tecnicos.value ?? []).map(t => ({ label: t.name, value: t.userId }))
)
const mostrarFiltroTecnico = computed(() => podeGerenciar && tecnicoOptions.value.length > 0)

// ---- Estado dos filtros (rascunho — só vai ao backend no "Filtrar") ----
const draft = reactive({
  search: '',
  status: [] as Opt<ChamadoStatus>[],
  prioridade: [] as Opt<string>[],
  tecnicos: [] as Opt<number>[],
  criado: { de: '', ate: '' } as DateRangeYmd,
  agendado: { de: '', ate: '' } as DateRangeYmd,
  finalizado: { de: '', ate: '' } as DateRangeYmd
})

// Parâmetros efetivamente aplicados (mudam só no Filtrar / troca de página).
const page = ref(1)
const pageSize = ref(50)
const applied = ref<Record<string, unknown>>({})

function buildParams(): Record<string, unknown> {
  const p: Record<string, unknown> = {}
  if (draft.search.trim()) p.search = draft.search.trim()
  if (draft.status.length) p.status = draft.status.map(s => s.value)
  if (draft.prioridade.length) p.prioridade = draft.prioridade.map(s => s.value)
  if (mostrarFiltroTecnico.value && draft.tecnicos.length)
    p.tecnicoUserIds = draft.tecnicos.map(t => t.value)
  if (draft.criado.de) p.criadoDe = draft.criado.de
  if (draft.criado.ate) p.criadoAte = draft.criado.ate
  if (draft.agendado.de) p.agendadoDe = draft.agendado.de
  if (draft.agendado.ate) p.agendadoAte = draft.agendado.ate
  if (draft.finalizado.de) p.finalizadoDe = draft.finalizado.de
  if (draft.finalizado.ate) p.finalizadoAte = draft.finalizado.ate
  return p
}

// useAsyncData observa só `page`; mudanças de pageSize/filtros são tratadas
// explicitamente abaixo para garantir exatamente um refetch por ação.
const { data, pending, refresh } = await useAsyncData(
  'chamados-list',
  () => $api<Paginated<Chamado>>('/chamados', {
    params: { ...applied.value, page: page.value, pageSize: pageSize.value }
  }),
  { watch: [page] }
)

// Trocar o tamanho da página volta para a página 1 (evita encalhar numa
// página vazia além do total). Se já estiver na 1, refaz a busca diretamente.
watch(pageSize, () => {
  if (page.value !== 1) page.value = 1
  else refresh()
})

// Aplica os filtros do rascunho e volta à página 1.
function filtrar() {
  applied.value = buildParams()
  if (page.value === 1) refresh()
  else page.value = 1 // o watch de page dispara o refresh
}

function limpar() {
  draft.search = ''
  draft.status = []
  draft.prioridade = []
  draft.tecnicos = []
  draft.criado = { de: '', ate: '' }
  draft.agendado = { de: '', ate: '' }
  draft.finalizado = { de: '', ate: '' }
  applied.value = {}
  if (page.value === 1) refresh()
  else page.value = 1
}

const pageSizeItems = [
  { label: '50 / página', value: 50 },
  { label: '100 / página', value: 100 },
  { label: '200 / página', value: 200 }
]

const items = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const totalCusto = computed(() =>
  items.value.reduce((acc, c) => acc + Number(c.custoTecnicoTotal || 0), 0)
)
const rangeLabel = computed(() => {
  if (!total.value) return '0 chamados'
  const ini = (page.value - 1) * pageSize.value + 1
  const fim = Math.min(page.value * pageSize.value, total.value)
  return `${ini}–${fim} de ${total.value}`
})

function dataCurta(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function dataHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Colunas da tabela (desktop). Sem cabeçalhos ordenáveis de propósito: a
// ordenação e a paginação são feitas no servidor (createdAt DESC), então
// ordenar só a página visível enganaria o usuário. As células são renderizadas
// via slots #<id>-cell no template, reaproveitando os helpers de exibição.
const columns: TableColumn<Chamado>[] = [
  { accessorKey: 'codigo', header: 'Chamado' },
  { accessorKey: 'client', header: 'Cliente' },
  { accessorKey: 'tecnicoNome', header: 'Técnico' },
  { id: 'datas', header: 'Datas' },
  ...(podeFin ? [{ id: 'custo', header: 'Custo técnico' } as TableColumn<Chamado>] : []),
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'paymentStatus', header: 'Pagamento' },
  { id: 'actions', header: '' }
]
</script>

<template>
  <UDashboardPanel id="chamados">
    <template #header>
      <UDashboardNavbar title="Atendimentos">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            v-if="canCriar"
            label="Novo chamado"
            icon="i-lucide-plus"
            to="/chamados/novo"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UPageCard
        title="Atendimentos"
        description="Chamados de clientes: acompanhe o ciclo, atribua técnicos e gerencie o financeiro."
        variant="naked"
        orientation="horizontal"
        class="mb-4"
      />

      <!-- Filtros -->
      <UPageCard variant="subtle" class="mb-4">
        <div class="space-y-3">
          <UInput
            v-model="draft.search"
            icon="i-lucide-search"
            placeholder="Buscar por código, título ou cliente"
            class="w-full"
            @keydown.enter="filtrar"
          />

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <USelectMenu
              v-model="draft.status"
              :items="statusOptions"
              multiple
              placeholder="Status"
              icon="i-lucide-activity"
            />
            <USelectMenu
              v-model="draft.prioridade"
              :items="prioridadeOptions"
              multiple
              placeholder="Prioridade"
              icon="i-lucide-flag"
            />
            <USelectMenu
              v-if="mostrarFiltroTecnico"
              v-model="draft.tecnicos"
              :items="tecnicoOptions"
              multiple
              placeholder="Técnicos"
              icon="i-lucide-hard-hat"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <DateRangePicker
              v-model="draft.criado"
              label="Criado"
              placeholder="Qualquer data"
              color="var(--color-brand-blue-light)"
            />
            <DateRangePicker
              v-model="draft.agendado"
              label="Agendado"
              placeholder="Qualquer data"
              color="var(--color-brand-orange)"
            />
            <DateRangePicker
              v-model="draft.finalizado"
              label="Finalizado"
              placeholder="Qualquer data"
              color="var(--color-green-500)"
            />
          </div>

          <div class="flex items-center justify-end gap-2">
            <UButton
              label="Limpar"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              @click="limpar"
            />
            <UButton
              label="Filtrar"
              icon="i-lucide-filter"
              :loading="pending"
              @click="filtrar"
            />
          </div>
        </div>
      </UPageCard>

      <!-- Lista -->
      <UPageCard variant="subtle" :ui="{ container: 'p-0 sm:p-0 gap-y-0' }">
        <div class="flex items-center justify-end gap-3 px-4 sm:px-6 py-2 border-b border-default bg-elevated/30 text-xs text-muted">
          <span>{{ rangeLabel }}</span>
        </div>

        <div v-if="pending" class="py-10 flex justify-center">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
        </div>

        <template v-else>
          <!-- Desktop: tabela (mais densa e escaneável em telas largas) -->
          <UTable
            :data="items"
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
            <template #codigo-cell="{ row }">
              <div class="min-w-0 max-w-xs">
                <p class="text-highlighted font-medium truncate flex items-center gap-2">
                  <span class="text-muted text-xs font-mono">{{ row.original.codigo }}</span>
                  {{ row.original.titulo }}
                </p>
                <UBadge
                  :color="prioridadeMeta(row.original.prioridade).color"
                  variant="subtle"
                  size="sm"
                  class="mt-1"
                >
                  {{ prioridadeMeta(row.original.prioridade).label }}
                </UBadge>
              </div>
            </template>

            <template #client-cell="{ row }">
              <div class="min-w-0 max-w-56">
                <p class="text-highlighted text-sm truncate">
                  <UIcon name="i-lucide-building-2" class="size-3.5 inline-block -mt-0.5" />
                  {{ row.original.client?.nome ?? '—' }}
                </p>
                <p v-if="row.original.city" class="text-muted text-xs truncate">
                  {{ row.original.city.nome }}/{{ row.original.city.uf }}
                </p>
              </div>
            </template>

            <template #tecnicoNome-cell="{ row }">
              <span v-if="row.original.tecnicoNome" class="text-sm text-highlighted inline-flex items-center gap-1">
                <UIcon name="i-lucide-hard-hat" class="size-3.5" /> {{ row.original.tecnicoNome }}
              </span>
              <span v-else class="text-dimmed text-sm">—</span>
            </template>

            <template #datas-cell="{ row }">
              <div class="text-xs flex flex-col gap-0.5">
                <span class="text-brand-blue-light inline-flex items-center gap-1">
                  <UIcon name="i-lucide-calendar-plus" class="size-3" /> {{ dataHora(row.original.createdAt) }}
                </span>
                <span v-if="row.original.agendadoPara" class="text-brand-orange inline-flex items-center gap-1">
                  <UIcon name="i-lucide-calendar-clock" class="size-3" /> {{ dataHora(row.original.agendadoPara) }}
                </span>
                <span v-if="row.original.finalizadoEm" class="text-green-500 inline-flex items-center gap-1">
                  <UIcon name="i-lucide-calendar-check" class="size-3" /> {{ dataHora(row.original.finalizadoEm) }}
                </span>
              </div>
            </template>

            <template #custo-cell="{ row }">
              <span v-if="Number(row.original.custoTecnicoTotal) > 0" class="text-highlighted text-sm font-medium">
                {{ brl(row.original.custoTecnicoTotal) }}
              </span>
              <span v-else class="text-dimmed text-sm">—</span>
            </template>

            <template #status-cell="{ row }">
              <div class="flex flex-col items-start gap-1">
                <UBadge :color="statusMeta(row.original.status).color" variant="subtle">
                  {{ statusMeta(row.original.status).label }}
                </UBadge>
              </div>
            </template>

            <template #paymentStatus-cell="{ row }">
              <UBadge
                v-if="row.original.status === 'fechado' && row.original.paymentStatus !== 'nao_aplicavel'"
                :color="paymentMeta(row.original.paymentStatus).color"
                variant="subtle"
                size="sm"
              >
                {{ paymentMeta(row.original.paymentStatus).label }}
              </UBadge>
              <span v-else class="text-dimmed text-sm">—</span>
            </template>

            <template #actions-cell="{ row }">
              <UButton
                label="Ver"
                icon="i-lucide-eye"
                color="success"
                variant="subtle"
                size="sm"
                :to="`/chamados/${row.original.id}`"
              />
            </template>

            <template #empty>
              <span class="text-sm text-muted">Nenhum chamado encontrado com os filtros atuais.</span>
            </template>
          </UTable>

          <!-- Mobile/tablet: cards (mantêm a flexibilidade de campos condicionais).
               @container: o layout interno responde à LARGURA DO CARD, não do
               viewport — o painel é mais estreito que a tela por causa da sidebar,
               então usar breakpoints de viewport (sm:) estouraria a coluna de ações. -->
          <ul role="list" class="divide-y divide-default lg:hidden @container">
            <li
              v-for="c in items"
              :key="c.id"
              class="flex flex-col gap-3 py-3 px-4 sm:px-6 hover:bg-elevated/30 transition-colors"
            >
              <div class="min-w-0">
                <p class="text-highlighted font-medium truncate flex items-center gap-2">
                  <span class="text-muted text-xs font-mono">{{ c.codigo }}</span>
                  <UBadge :color="prioridadeMeta(c.prioridade).color" variant="subtle" size="sm">
                    {{ prioridadeMeta(c.prioridade).label }}
                  </UBadge>
                </p>
                <p class="text-highlighted text-md font-extrabold truncate my-1">
                  {{ c.titulo }}
                </p>
                <p class="text-muted text-sm truncate flex items-center gap-1">
                  <UIcon name="i-lucide-building-2" class="size-3.5 inline-block " />
                  {{ c.client?.nome ?? '—' }}
                </p>
                <p class="text-muted text-sm truncate gap-1 flex items-center">
                  <UIcon name="i-lucide-map-pin" class="size-3.5 inline-block" />
                  <span v-if="c.city">{{ c.city.nome }}/{{ c.city.uf }}</span>
                </p>
                <p v-if="c.tecnicoNome" class="text-muted text-sm truncate gap-1 flex items-center">
                  <UIcon name="i-lucide-hard-hat" class="size-3.5 inline-block" />
                  <span>{{ c.tecnicoNome }}</span>
                </p>
                <hr class="my-2">
                <p class="text-xs mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span class="text-brand-blue-light inline-flex items-center gap-1">
                    <UIcon name="i-lucide-calendar-plus" class="size-3" /> Criado {{ dataHora(c.createdAt) }}
                  </span>
                  <span v-if="c.agendadoPara" class="text-brand-orange inline-flex items-center gap-1">
                    <UIcon name="i-lucide-calendar-clock" class="size-3" /> Agendado {{ dataHora(c.agendadoPara) }}
                  </span>
                  <span v-if="c.finalizadoEm" class="text-green-500 inline-flex items-center gap-1">
                    <UIcon name="i-lucide-calendar-check" class="size-3" /> Finalizado {{ dataHora(c.finalizadoEm) }}
                  </span>
                </p>
              </div>

              <div class="flex flex-col items-stretch gap-2 shrink-0">
                <div v-if="Number(c.custoTecnicoTotal) > 0" class="text-right hidden @sm:block">
                  <p class="text-highlighted text-sm font-medium">
                    {{ brl(c.custoTecnicoTotal) }}
                  </p>
                  <p class="text-dimmed text-[10px] uppercase tracking-wide">
                    custo técnico
                  </p>
                </div>
                <UBadge
                  v-if="c.status === 'fechado' && c.paymentStatus !== 'nao_aplicavel'"
                  :color="paymentMeta(c.paymentStatus).color"
                  variant="subtle"
                  class="justify-center py-2"
                  icon="i-lucide-credit-card"
                >
                  {{ paymentMeta(c.paymentStatus).label }}
                </UBadge>
                <UBadge
                  :color="statusMeta(c.status).color"
                  icon="i-lucide-clipboard"
                  variant="outline"
                  class="justify-center py-2"
                >
                  {{ statusMeta(c.status).label }}
                </UBadge>
                <UButton
                  label="Ver"
                  icon="i-lucide-eye"
                  color="success"
                  variant="solid"
                  size="sm"
                  block
                  :to="`/chamados/${c.id}`"
                />
              </div>
            </li>

            <li v-if="!items.length" class="py-10 text-center text-sm text-muted">
              Nenhum chamado encontrado com os filtros atuais.
            </li>
          </ul>
        </template>

        <!-- Paginação -->
        <div class="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t border-default">
          <USelect v-model="pageSize" :items="pageSizeItems" class="w-40" />
          <UPagination
            v-model:page="page"
            :total="total"
            :items-per-page="pageSize"
            :sibling-count="1"
            show-edges
          />
        </div>
      </UPageCard>
    </template>
  </UDashboardPanel>
</template>
