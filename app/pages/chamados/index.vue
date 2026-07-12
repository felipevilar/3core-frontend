<script setup lang="ts">
import type { Chamado, ChamadoStatus } from '~/types'

definePageMeta({ permission: 'atendimentos.ver' })

const { $api } = useNuxtApp()
const { can } = usePermissions()
const { statusMeta, prioridadeMeta, brl } = useChamadoDisplay()

const canCriar = can('atendimentos.criar')
const podeFin = can('financeiro.ver')

const { data: chamados, pending } = await useAsyncData('chamados', () =>
  $api<Chamado[]>('/chamados')
)

const q = ref('')
const status = ref<'todos' | ChamadoStatus>('todos')

const statusItems = [
  { label: 'Todos', value: 'todos' },
  { label: 'Aberto', value: 'aberto' },
  { label: 'Atribuído', value: 'atribuido' },
  { label: 'A caminho', value: 'a_caminho' },
  { label: 'Em atendimento', value: 'em_atendimento' },
  { label: 'Finalizado', value: 'finalizado' },
  { label: 'Fechado', value: 'fechado' },
  { label: 'Cancelado', value: 'cancelado' }
]

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  return (chamados.value ?? []).filter((c) => {
    const matchTerm = !term
      || c.titulo.toLowerCase().includes(term)
      || c.codigo.toLowerCase().includes(term)
      || (c.client?.nome ?? '').toLowerCase().includes(term)
    const matchStatus = status.value === 'todos' || c.status === status.value
    return matchTerm && matchStatus
  })
})

const hasFilters = computed(() => !!q.value || status.value !== 'todos')
function limpar() {
  q.value = ''
  status.value = 'todos'
}
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

      <UPageCard variant="subtle" :ui="{ container: 'p-0 sm:p-0 gap-y-0', wrapper: 'items-stretch', header: 'p-4 mb-0 border-b border-default' }">
        <template #header>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <UInput
              v-model="q"
              icon="i-lucide-search"
              placeholder="Buscar por código, título ou cliente"
              class="w-full sm:flex-1"
            />
            <USelect v-model="status" :items="statusItems" class="w-full sm:w-48" />
            <UButton
              v-if="hasFilters"
              label="Limpar"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              class="shrink-0"
              @click="limpar"
            />
          </div>
        </template>

        <div v-if="pending" class="py-10 flex justify-center">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
        </div>

        <ul v-else role="list" class="divide-y divide-default">
          <li
            v-for="c in filtered"
            :key="c.id"
            class="flex items-center justify-between gap-3 py-3 px-4 sm:px-6"
          >
            <div class="min-w-0">
              <p class="text-highlighted font-medium truncate flex items-center gap-2">
                <span class="text-muted text-xs font-mono">{{ c.codigo }}</span>
                {{ c.titulo }}
                <UBadge :color="prioridadeMeta(c.prioridade).color" variant="subtle" size="sm">
                  {{ prioridadeMeta(c.prioridade).label }}
                </UBadge>
              </p>
              <p class="text-muted text-sm truncate">
                {{ c.client?.nome ?? '—' }}
                <span v-if="c.city"> • {{ c.city.nome }}/{{ c.city.uf }}</span>
                <span v-if="c.tecnicoNome"> • {{ c.tecnicoNome }}</span>
              </p>
            </div>

            <div class="flex items-center gap-3 shrink-0">
              <span v-if="podeFin && Number(c.custoTecnicoTotal) > 0" class="text-xs text-muted hidden sm:block">
                {{ brl(c.custoTecnicoTotal) }}
              </span>
              <UBadge :color="statusMeta(c.status).color" variant="subtle">
                {{ statusMeta(c.status).label }}
              </UBadge>
              <UButton
                label="Ver"
                icon="i-lucide-eye"
                color="neutral"
                variant="subtle"
                size="sm"
                :to="`/chamados/${c.id}`"
              />
            </div>
          </li>

          <li v-if="!filtered.length" class="py-10 text-center text-sm text-muted">
            Nenhum chamado encontrado.
          </li>
        </ul>
      </UPageCard>
    </template>
  </UDashboardPanel>
</template>
