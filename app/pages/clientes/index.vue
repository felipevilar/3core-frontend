<script setup lang="ts">
import type { Client, Uf } from '~/types'

definePageMeta({ permission: 'clientes.ver' })

const { $api } = useNuxtApp()
const { can } = usePermissions()
const toast = useToast()

const canCreate = can('clientes.criar')
const canDelete = can('clientes.excluir')

const { data: clients, pending, refresh } = await useAsyncData('clients', () =>
  $api<Client[]>('/clients')
)
const { data: ufs } = await useAsyncData('ufs', () => $api<Uf[]>('/cities/ufs'))

// ---- Filtros (client-side) ----
const q = ref('')
const tipo = ref<'todos' | 'pj' | 'pf'>('todos')
const uf = ref('todas')

const tipoItems = [
  { label: 'Todos', value: 'todos' },
  { label: 'Pessoa Jurídica', value: 'pj' },
  { label: 'Pessoa Física', value: 'pf' }
]

const ufItems = computed(() => [
  { label: 'Todas as UFs', value: 'todas' },
  ...(ufs.value ?? []).map(u => ({ label: `${u.uf} — ${u.ufNome}`, value: u.uf }))
])

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()

  return (clients.value ?? []).filter((c) => {
    const matchTerm = !term
      || c.nome.toLowerCase().includes(term)
      || (c.nomeFantasia ?? '').toLowerCase().includes(term)
      || (c.email ?? '').toLowerCase().includes(term)
      || (c.cnpj ?? '').includes(term)
      || (c.cpf ?? '').includes(term)
    const matchTipo = tipo.value === 'todos' || c.tipo === tipo.value
    const matchUf = uf.value === 'todas' || c.city?.uf === uf.value
    return matchTerm && matchTipo && matchUf
  })
})

const hasFilters = computed(() => !!q.value || tipo.value !== 'todos' || uf.value !== 'todas')
function limparFiltros() {
  q.value = ''
  uf.value = 'todas'
  tipo.value = 'todos'
}

function documento(c: Client) {
  if (c.tipo === 'pj') return c.cnpj ? `CNPJ ${c.cnpj}` : 'PJ'
  return c.cpf ? `CPF ${c.cpf}` : 'PF'
}

function localizacao(c: Client) {
  return c.city ? `${c.city.nome} / ${c.city.uf}` : ''
}

// ---- Exclusão ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<Client | null>(null)

function askRemove(c: Client) {
  target.value = c
  deleteOpen.value = true
}

async function confirmRemove() {
  if (!target.value) return
  deleting.value = true
  try {
    await $api(`/clients/${target.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'Cliente excluído', icon: 'i-lucide-check', color: 'success' })
    deleteOpen.value = false
    target.value = null
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message ?? 'Erro ao excluir cliente', icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="clientes">
    <template #header>
      <UDashboardNavbar title="Clientes">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            v-if="canCreate"
            label="Novo cliente"
            icon="i-lucide-plus"
            to="/clientes/novo"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UPageCard
        title="Clientes"
        description="Cadastro dos clientes que abrem chamados. Filtre, visualize e gerencie."
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
              placeholder="Buscar por nome, e-mail ou documento"
              class="w-full sm:flex-1"
            />
            <USelect
              v-model="tipo"
              :items="tipoItems"
              class="w-full sm:w-44"
            />
            <USelect
              v-model="uf"
              :items="ufItems"
              icon="i-lucide-map"
              class="w-full sm:w-44"
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
            v-for="c in filtered"
            :key="c.id"
            class="flex items-center justify-between gap-3 py-3 px-4 sm:px-6"
          >
            <div class="flex items-center gap-3 min-w-0">
              <UAvatar
                :icon="c.tipo === 'pj' ? 'i-lucide-building-2' : 'i-lucide-user'"
                size="md"
              />
              <div class="text-sm min-w-0">
                <p class="text-highlighted font-medium truncate flex items-center gap-2">
                  {{ c.nomeFantasia || c.nome }}
                  <UBadge :color="c.tipo === 'pj' ? 'primary' : 'neutral'" variant="subtle" size="sm">
                    {{ c.tipo === 'pj' ? 'PJ' : 'PF' }}
                  </UBadge>
                  <UBadge v-if="!c.ativo" color="neutral" variant="subtle" size="sm">
                    inativo
                  </UBadge>
                </p>
                <p class="text-muted truncate">
                  {{ c.email || documento(c) }}
                </p>
                <p v-if="localizacao(c)" class="text-dimmed text-xs flex items-center gap-1 mt-0.5">
                  <UIcon name="i-lucide-map-pin" class="size-3 shrink-0" />
                  {{ localizacao(c) }}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <UButton
                label="Ver"
                icon="i-lucide-eye"
                color="neutral"
                variant="subtle"
                size="sm"
                :to="`/clientes/${c.id}`"
              />
              <UButton
                v-if="canDelete"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="sm"
                aria-label="Excluir cliente"
                @click="askRemove(c)"
              />
            </div>
          </li>

          <li v-if="!filtered.length" class="py-10 text-center text-sm text-muted">
            Nenhum cliente encontrado.
          </li>
        </ul>
      </UPageCard>
    </template>
  </UDashboardPanel>

  <UModal
    v-model:open="deleteOpen"
    title="Excluir cliente"
    :description="`Tem certeza que deseja excluir ${target?.nomeFantasia || target?.nome}? Esta ação não pode ser desfeita.`"
  >
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton label="Cancelar" color="neutral" variant="subtle" @click="deleteOpen = false" />
        <UButton label="Excluir" color="error" icon="i-lucide-trash-2" :loading="deleting" @click="confirmRemove" />
      </div>
    </template>
  </UModal>
</template>
