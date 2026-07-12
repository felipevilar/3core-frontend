<script setup lang="ts">
import type { PayoutRow } from '~/types'

definePageMeta({ permission: 'financeiro.ver' })

const { $api } = useNuxtApp()
const { brl } = useChamadoDisplay()

// Competência default: mês atual (America/Sao_Paulo).
const periodoAtual = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit'
}).format(new Date()).slice(0, 7)

const periodo = ref(periodoAtual)

const { data: rows, pending, refresh } = await useAsyncData(
  'payout',
  () => $api<PayoutRow[]>('/financeiro/payout', { params: { periodo: periodo.value } }),
  { watch: [periodo] }
)

const totalGeral = computed(() =>
  (rows.value ?? []).reduce((acc, r) => acc + Number(r.totalCusto), 0)
)
const totalPago = computed(() =>
  (rows.value ?? []).reduce((acc, r) => acc + Number(r.totalPago), 0)
)
const totalPendente = computed(() =>
  (rows.value ?? []).reduce((acc, r) => acc + Number(r.totalPendente) + Number(r.totalAprovado), 0)
)
</script>

<template>
  <UDashboardPanel id="financeiro">
    <template #header>
      <UDashboardNavbar title="Financeiro">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UPageCard
        title="Folha de pagamento"
        description="Quanto pagar a cada técnico no período. Considera chamados fechados."
        variant="naked"
        orientation="horizontal"
        class="mb-4"
      >
        <div class="flex items-center gap-2 lg:ms-auto">
          <UInput v-model="periodo" type="month" class="w-44" />
          <UButton icon="i-lucide-refresh-cw" color="neutral" variant="subtle" @click="() => refresh()" />
        </div>
      </UPageCard>

      <!-- Resumo -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <UPageCard variant="subtle">
          <p class="text-muted text-xs">Total do período</p>
          <p class="text-highlighted text-2xl font-semibold">{{ brl(totalGeral) }}</p>
        </UPageCard>
        <UPageCard variant="subtle">
          <p class="text-muted text-xs">A pagar (pendente + aprovado)</p>
          <p class="text-warning text-2xl font-semibold">{{ brl(totalPendente) }}</p>
        </UPageCard>
        <UPageCard variant="subtle">
          <p class="text-muted text-xs">Pago</p>
          <p class="text-success text-2xl font-semibold">{{ brl(totalPago) }}</p>
        </UPageCard>
      </div>

      <UPageCard variant="subtle" :ui="{ container: 'p-0 sm:p-0 gap-y-0' }">
        <div v-if="pending" class="py-10 flex justify-center">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
        </div>
        <ul v-else role="list" class="divide-y divide-default">
          <li
            v-for="r in rows ?? []"
            :key="`${r.tecnicoUserId}-${r.periodo}`"
            class="flex items-center justify-between gap-3 py-3 px-4 sm:px-6"
          >
            <div class="min-w-0">
              <p class="text-highlighted font-medium truncate">{{ r.tecnicoNome ?? '(técnico removido)' }}</p>
              <p class="text-muted text-sm">
                {{ r.qtdChamados }} chamado(s) • competência {{ r.periodo }}
              </p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-highlighted font-semibold">{{ brl(r.totalCusto) }}</p>
              <p class="text-xs text-muted">
                <span class="text-warning">pend. {{ brl(r.totalPendente) }}</span> ·
                <span class="text-info">aprov. {{ brl(r.totalAprovado) }}</span> ·
                <span class="text-success">pago {{ brl(r.totalPago) }}</span>
              </p>
            </div>
          </li>
          <li v-if="!rows?.length" class="py-10 text-center text-sm text-muted">
            Nenhum chamado fechado neste período.
          </li>
        </ul>
      </UPageCard>
    </template>
  </UDashboardPanel>
</template>
