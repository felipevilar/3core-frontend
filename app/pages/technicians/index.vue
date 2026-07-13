<script setup lang="ts">
import type { Paginated, TechnicianListItem, Uf } from '~/types'

definePageMeta({ permission: 'tecnicos.ver' })

const { $api } = useNuxtApp()
const { can } = usePermissions()
const toast = useToast()

const canGerenciar = can('tecnicos.gerenciar')

// ---- Opções dos selects ----
type Opt<T> = { label: string, value: T }

const { data: ufs } = await useAsyncData('ufs', () => $api<Uf[]>('/cities/ufs'))
const ufOptions = computed<Opt<string>[]>(() =>
  (ufs.value ?? []).map(u => ({ label: `${u.uf} — ${u.ufNome}`, value: u.uf }))
)

const statusOptions: Opt<string>[] = [
  { label: 'Todos', value: 'todos' },
  { label: 'Ativo', value: 'ativo' },
  { label: 'Inativo', value: 'inativo' }
]

// ---- Estado dos filtros (rascunho — só vai ao backend no "Filtrar") ----
const draft = reactive({
  search: '',
  uf: [] as Opt<string>[],
  status: 'todos',
  cidadeAtendida: ''
})

// Parâmetros efetivamente aplicados (mudam só no Filtrar / troca de página).
const page = ref(1)
const pageSize = ref(50)
const applied = ref<Record<string, unknown>>({})

function buildParams(): Record<string, unknown> {
  const p: Record<string, unknown> = {}
  if (draft.search.trim()) p.search = draft.search.trim()
  if (draft.uf.length) p.uf = draft.uf.map(u => u.value)
  if (draft.status !== 'todos') p.status = draft.status
  if (draft.cidadeAtendida.trim()) p.cidadeAtendida = draft.cidadeAtendida.trim()
  return p
}

// useAsyncData observa só `page`; mudanças de pageSize/filtros são tratadas
// explicitamente abaixo para garantir exatamente um refetch por ação.
const { data, pending, refresh } = await useAsyncData(
  'technicians-list',
  () => $api<Paginated<TechnicianListItem>>('/technicians', {
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
  draft.uf = []
  draft.status = 'todos'
  draft.cidadeAtendida = ''
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
const rangeLabel = computed(() => {
  if (!total.value) return '0 técnicos'
  const ini = (page.value - 1) * pageSize.value + 1
  const fim = Math.min(page.value * pageSize.value, total.value)
  return `${ini}–${fim} de ${total.value}`
})

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
        <template #right>
          <UButton
            v-if="canGerenciar"
            label="Novo técnico"
            icon="i-lucide-plus"
            to="/technicians/novo"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UPageCard
        title="Técnicos"
        description="Consulte os técnicos cadastrados, filtre e gerencie a ficha completa."
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
            placeholder="Buscar por nome ou e-mail"
            class="w-full"
            @keydown.enter="filtrar"
          />

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <USelectMenu
              v-model="draft.uf"
              :items="ufOptions"
              multiple
              placeholder="UF"
              icon="i-lucide-map"
            />
            <USelect
              v-model="draft.status"
              :items="statusOptions"
              icon="i-lucide-activity"
            />
            <UInput
              v-model="draft.cidadeAtendida"
              icon="i-lucide-route"
              placeholder="Cidade atendida"
              @keydown.enter="filtrar"
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
        <div class="flex items-center justify-between gap-3 px-4 sm:px-6 py-2 border-b border-default bg-elevated/30 text-xs text-muted">
          <span>{{ rangeLabel }}</span>
        </div>

        <div v-if="pending" class="py-10 flex justify-center">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
        </div>

        <ul v-else role="list" class="divide-y divide-default">
          <li
            v-for="t in items"
            :key="t.id"
            class="flex items-center justify-between gap-3 py-3 px-4 sm:px-6 hover:bg-elevated/30 transition-colors"
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
              label="Ver"
              icon="i-lucide-eye"
              color="neutral"
              variant="subtle"
              size="sm"
              class="shrink-0"
              :to="`/technicians/${t.id}`"
            />
          </li>

          <li v-if="!items.length" class="py-10 text-center text-sm text-muted">
            Nenhum técnico encontrado com os filtros atuais.
          </li>
        </ul>

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
