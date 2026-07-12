<script setup lang="ts">
import type { TechnicianListItem, Uf } from '~/types'

definePageMeta({ permission: 'tecnicos.ver' })

const { $api } = useNuxtApp()
const toast = useToast()

const { data: technicians, pending } = await useAsyncData('technicians', () =>
  $api<TechnicianListItem[]>('/technicians')
)
const { data: ufs } = await useAsyncData('ufs', () => $api<Uf[]>('/cities/ufs'))

const ufItems = computed(() => [
  { label: 'Todas as UFs', value: 'todas' },
  ...(ufs.value ?? []).map(u => ({ label: `${u.uf} — ${u.ufNome}`, value: u.uf }))
])

// ---- Filtros (client-side) ----
const q = ref('')
const uf = ref('todas')
const cidadeAtendida = ref('')

function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  const cidAt = norm(cidadeAtendida.value.trim())

  return (technicians.value ?? []).filter((t) => {
    const matchTerm = !term
      || t.name.toLowerCase().includes(term)
      || t.email.toLowerCase().includes(term)
    const matchUf = uf.value === 'todas' || t.uf === uf.value
    const matchCidAt = !cidAt
      || (t.cidadesAtendidas ?? []).some(c => norm(c.nome).includes(cidAt))
    return matchTerm && matchUf && matchCidAt
  })
})

const hasFilters = computed(() => !!(q.value || cidadeAtendida.value) || uf.value !== 'todas')
function limparFiltros() {
  q.value = ''
  uf.value = 'todas'
  cidadeAtendida.value = ''
}

function cidadeResidencia(t: TechnicianListItem) {
  return [t.cidadeNome, t.uf].filter(Boolean).join(' / ') || '—'
}

// Formata "55929819846" → "(55) 92981-9846" / "(92) 3234-5678".
function formatarCelular(raw: string) {
  const d = (raw ?? '').replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return raw
}

async function copiarCelular(t: TechnicianListItem) {
  try {
    await navigator.clipboard.writeText(t.celular)
    toast.add({ title: 'Telefone copiado', description: formatarCelular(t.celular), icon: 'i-lucide-check', color: 'success' })
  } catch {
    toast.add({ title: 'Não foi possível copiar', icon: 'i-lucide-alert-circle', color: 'error' })
  }
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
            <USelect
              v-model="uf"
              :items="ufItems"
              icon="i-lucide-map"
              class="w-full sm:w-44"
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
                <p v-if="t.celular" class="text-muted text-xs flex items-center gap-1 mt-0.5">
                  <UIcon name="i-lucide-phone" class="size-3 shrink-0" />
                  {{ formatarCelular(t.celular) }}
                  <UButton
                    icon="i-lucide-copy"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :ui="{ base: 'p-0.5' }"
                    aria-label="Copiar telefone"
                    @click="copiarCelular(t)"
                  />
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
