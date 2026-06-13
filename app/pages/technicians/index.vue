<script setup lang="ts">
import type { TechnicianListItem } from '~/types'

definePageMeta({ permission: 'tecnicos.ver' })

const { $api } = useNuxtApp()

const { data: technicians, pending } = await useAsyncData('technicians', () =>
  $api<TechnicianListItem[]>('/technicians')
)

// ---- Filtros (client-side) ----
const q = ref('')
const cidade = ref('')
const cidadeAtendida = ref('')

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  const cid = cidade.value.trim().toLowerCase()
  const cidAt = cidadeAtendida.value.trim().toLowerCase()

  return (technicians.value ?? []).filter((t) => {
    const matchTerm = !term
      || t.name.toLowerCase().includes(term)
      || t.email.toLowerCase().includes(term)
    const matchCidade = !cid || (t.cidade ?? '').toLowerCase().includes(cid)
    const matchCidAt = !cidAt
      || (t.cidadesAtendidas ?? []).some(c => c.cidade.toLowerCase().includes(cidAt))
    return matchTerm && matchCidade && matchCidAt
  })
})

const hasFilters = computed(() => !!(q.value || cidade.value || cidadeAtendida.value))
function limparFiltros() {
  q.value = ''
  cidade.value = ''
  cidadeAtendida.value = ''
}

function cidadeResidencia(t: TechnicianListItem) {
  return [t.cidade, t.estado].filter(Boolean).join(' / ') || '—'
}
</script>

<template>
  <UDashboardPanel id="technicians">
    <template #header>
      <UDashboardNavbar title="Técnicos">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UPageCard
        title="Técnicos"
        description="Consulte os técnicos cadastrados e visualize a ficha completa."
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
              placeholder="Buscar por nome ou e-mail"
              class="w-full sm:flex-1"
            />
            <UInput
              v-model="cidade"
              icon="i-lucide-map-pin"
              placeholder="Cidade de residência"
              class="w-full sm:w-56"
            />
            <UInput
              v-model="cidadeAtendida"
              icon="i-lucide-route"
              placeholder="Cidade atendida"
              class="w-full sm:w-56"
            />
            <UButton
              v-if="hasFilters"
              label="Limpar"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              class="shrink-0"
              @click="limparFiltros"
            />
          </div>
        </template>

        <div v-if="pending" class="py-10 flex justify-center">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
        </div>

        <ul v-else role="list" class="divide-y divide-default">
          <li
            v-for="t in filtered"
            :key="t.id"
            class="flex items-center justify-between gap-3 py-3 px-4 sm:px-6"
          >
            <div class="flex items-center gap-3 min-w-0">
              <UAvatar :alt="t.name" size="md" />
              <div class="text-sm min-w-0">
                <p class="text-highlighted font-medium truncate">
                  {{ t.name }}
                  <UBadge v-if="!t.isActive" color="neutral" variant="subtle" size="sm" class="ml-1">
                    inativo
                  </UBadge>
                </p>
                <p class="text-muted truncate">
                  {{ t.email }}
                </p>
                <p class="text-dimmed text-xs flex items-center gap-1 mt-0.5">
                  <UIcon name="i-lucide-map-pin" class="size-3 shrink-0" />
                  {{ cidadeResidencia(t) }}
                  <span v-if="t.cidadesAtendidas?.length" class="text-dimmed">
                    • atende {{ t.cidadesAtendidas.length }}
                    {{ t.cidadesAtendidas.length === 1 ? 'cidade' : 'cidades' }}
                  </span>
                </p>
              </div>
            </div>

            <UButton
              label="Ver ficha"
              icon="i-lucide-eye"
              color="neutral"
              variant="subtle"
              size="sm"
              class="shrink-0"
              :to="`/technicians/${t.id}`"
            />
          </li>

          <li v-if="!filtered.length" class="py-10 text-center text-sm text-muted">
            Nenhum técnico encontrado.
          </li>
        </ul>
      </UPageCard>
    </template>
  </UDashboardPanel>
</template>
