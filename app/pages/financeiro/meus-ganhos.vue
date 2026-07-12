<script setup lang="ts">
import type { MeusGanhos } from '~/types'

definePageMeta({ permission: 'financeiro.ver_proprio' })

const { $api } = useNuxtApp()
const { paymentMeta, brl } = useChamadoDisplay()

const { data, pending } = await useAsyncData('meus-ganhos', () =>
  $api<MeusGanhos>('/financeiro/meus-ganhos')
)

const totalGeral = computed(() =>
  (data.value?.resumo ?? []).reduce((acc, r) => acc + Number(r.totalCusto), 0)
)
const totalPago = computed(() =>
  (data.value?.resumo ?? []).reduce((acc, r) => acc + Number(r.totalPago), 0)
)
</script>

<template>
  <UDashboardPanel id="meus-ganhos">
    <template #header>
      <UDashboardNavbar title="Meus Ganhos">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UPageCard
        title="Meus ganhos"
        description="Seus atendimentos fechados e quanto você tem a receber por competência."
        variant="naked"
        orientation="horizontal"
        class="mb-4"
      />

      <div v-if="pending" class="py-10 flex justify-center">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
      </div>

      <template v-else>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <UPageCard variant="subtle">
            <p class="text-muted text-xs">Total (todas as competências)</p>
            <p class="text-highlighted text-2xl font-semibold">{{ brl(totalGeral) }}</p>
          </UPageCard>
          <UPageCard variant="subtle">
            <p class="text-muted text-xs">Já pago</p>
            <p class="text-success text-2xl font-semibold">{{ brl(totalPago) }}</p>
          </UPageCard>
        </div>

        <!-- Resumo por competência -->
        <UPageCard title="Por competência" variant="subtle" class="mb-4" :ui="{ container: 'p-0 sm:p-0 gap-y-0' }">
          <ul role="list" class="divide-y divide-default">
            <li
              v-for="r in data?.resumo ?? []"
              :key="r.periodo"
              class="flex items-center justify-between gap-3 py-3 px-4 sm:px-6"
            >
              <p class="text-highlighted font-medium">{{ r.periodo }}</p>
              <div class="text-right">
                <p class="text-highlighted font-semibold">{{ brl(r.totalCusto) }}</p>
                <p class="text-xs text-muted">{{ r.qtdChamados }} chamado(s) • pago {{ brl(r.totalPago) }}</p>
              </div>
            </li>
            <li v-if="!data?.resumo?.length" class="py-8 text-center text-sm text-muted">
              Você ainda não tem ganhos registrados.
            </li>
          </ul>
        </UPageCard>

        <!-- Detalhe por chamado -->
        <UPageCard title="Chamados" variant="subtle" :ui="{ container: 'p-0 sm:p-0 gap-y-0' }">
          <ul role="list" class="divide-y divide-default">
            <li
              v-for="c in data?.chamados ?? []"
              :key="c.id"
              class="flex items-center justify-between gap-3 py-3 px-4 sm:px-6"
            >
              <div class="min-w-0">
                <p class="text-highlighted font-medium truncate flex items-center gap-2">
                  <span class="text-muted text-xs font-mono">{{ c.codigo }}</span>
                  {{ c.titulo }}
                </p>
                <p class="text-muted text-sm truncate">{{ c.cliente }} • {{ c.periodo }}</p>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <UBadge :color="paymentMeta(c.paymentStatus).color" variant="subtle" size="sm">
                  {{ paymentMeta(c.paymentStatus).label }}
                </UBadge>
                <span class="text-highlighted font-semibold">{{ brl(c.custoTecnicoTotal) }}</span>
              </div>
            </li>
            <li v-if="!data?.chamados?.length" class="py-8 text-center text-sm text-muted">
              Nenhum chamado fechado.
            </li>
          </ul>
        </UPageCard>
      </template>
    </template>
  </UDashboardPanel>
</template>
