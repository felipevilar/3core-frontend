<script setup lang="ts">
import type { TechnicianDetail, TechnicianListItem } from '~/types'

definePageMeta({ permission: 'tecnicos.ver' })

const { $api } = useNuxtApp()
const toast = useToast()

const { data: technicians, pending } = await useAsyncData('technicians', () =>
  $api<TechnicianListItem[]>('/technicians')
)

// ---- Filtros (client-side; a API também suporta via query) ----
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

// ---- Ficha (slideover, somente leitura) ----
const open = ref(false)
const loadingFicha = ref(false)
const ficha = ref<TechnicianDetail | null>(null)

async function verFicha(t: TechnicianListItem) {
  open.value = true
  loadingFicha.value = true
  ficha.value = null
  try {
    ficha.value = await $api<TechnicianDetail>(`/technicians/${t.id}`)
  } catch {
    toast.add({ title: 'Erro ao carregar a ficha', icon: 'i-lucide-alert-circle', color: 'error' })
    open.value = false
  } finally {
    loadingFicha.value = false
  }
}

function enderecoCompleto(f: TechnicianDetail) {
  const linha1 = [f.logradouro, f.numero].filter(Boolean).join(', ')
  const linha2 = [f.bairro, f.cidade, f.estado].filter(Boolean).join(' • ')
  return [linha1, f.complemento, linha2, f.cep ? `CEP ${f.cep}` : null]
    .filter(Boolean)
    .join('\n')
}

const tipoContaLabel: Record<string, string> = {
  corrente: 'Conta corrente',
  poupanca: 'Conta poupança'
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
        description="Consulte os técnicos cadastrados, filtre por cidade e visualize a ficha completa."
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
              @click="verFicha(t)"
            />
          </li>

          <li v-if="!filtered.length" class="py-10 text-center text-sm text-muted">
            Nenhum técnico encontrado.
          </li>
        </ul>
      </UPageCard>
    </template>
  </UDashboardPanel>

  <USlideover
    v-model:open="open"
    :title="ficha?.user.name ?? 'Ficha do técnico'"
    :description="ficha?.user.email"
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <div v-if="loadingFicha" class="py-10 flex justify-center">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
      </div>

      <div v-else-if="ficha" class="space-y-6 text-sm">
        <UBadge v-if="!ficha.user.isActive" color="neutral" variant="subtle">
          Conta inativa
        </UBadge>

        <!-- Dados pessoais -->
        <section>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
            Dados pessoais
          </h3>
          <dl class="space-y-1.5">
            <div class="flex justify-between gap-3">
              <dt class="text-muted">CPF</dt>
              <dd class="text-highlighted text-right">{{ ficha.cpf || '—' }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted">RG</dt>
              <dd class="text-highlighted text-right">{{ ficha.rg || '—' }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted">Celular</dt>
              <dd class="text-highlighted text-right">{{ ficha.celular || '—' }}</dd>
            </div>
          </dl>
        </section>

        <!-- Endereço -->
        <section>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
            Endereço
          </h3>
          <p class="text-highlighted whitespace-pre-line">
            {{ enderecoCompleto(ficha) || '—' }}
          </p>
          <div v-if="ficha.enderecoEncomendas" class="mt-2">
            <p class="text-muted text-xs">Endereço para encomendas</p>
            <p class="text-highlighted">{{ ficha.enderecoEncomendas }}</p>
          </div>
        </section>

        <!-- Financeiro -->
        <section>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
            Financeiro
          </h3>
          <dl class="space-y-1.5">
            <div class="flex justify-between gap-3">
              <dt class="text-muted">Pretensão (valor/hora)</dt>
              <dd class="text-highlighted text-right">
                {{ ficha.pretensaoValorHora ? `R$ ${ficha.pretensaoValorHora}` : '—' }}
              </dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted">Custo por km</dt>
              <dd class="text-highlighted text-right">
                {{ ficha.custoPorKm ? `R$ ${ficha.custoPorKm}` : '—' }}
              </dd>
            </div>
          </dl>
        </section>

        <!-- Dados de pagamento -->
        <section v-if="ficha.pagamento?.pix || ficha.pagamento?.dadosBancarios">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
            Pagamento
          </h3>
          <div v-if="ficha.pagamento?.pix" class="mb-2">
            <p class="text-muted text-xs">PIX</p>
            <p class="text-highlighted">{{ ficha.pagamento.pix.chavePix }}</p>
            <p class="text-dimmed text-xs">{{ ficha.pagamento.pix.nomeTitularPix }}</p>
          </div>
          <div v-if="ficha.pagamento?.dadosBancarios">
            <p class="text-muted text-xs">Dados bancários</p>
            <p class="text-highlighted">
              {{ ficha.pagamento.dadosBancarios.banco }} •
              Ag. {{ ficha.pagamento.dadosBancarios.agencia }} •
              Cc. {{ ficha.pagamento.dadosBancarios.conta }}
            </p>
            <p class="text-dimmed text-xs">
              {{ tipoContaLabel[ficha.pagamento.dadosBancarios.tipoConta] ?? ficha.pagamento.dadosBancarios.tipoConta }}
            </p>
          </div>
        </section>

        <!-- Empresa -->
        <section v-if="ficha.empresa">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
            Empresa
          </h3>
          <dl class="space-y-1.5">
            <div class="flex justify-between gap-3">
              <dt class="text-muted">Nome fantasia</dt>
              <dd class="text-highlighted text-right">{{ ficha.empresa.nomeFantasia || '—' }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted">Razão social</dt>
              <dd class="text-highlighted text-right">{{ ficha.empresa.razaoSocial || '—' }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted">CNPJ</dt>
              <dd class="text-highlighted text-right">{{ ficha.empresa.cnpj || '—' }}</dd>
            </div>
          </dl>
        </section>

        <!-- Áreas de atuação -->
        <section v-if="ficha.areasAtuacao?.length">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
            Áreas de atuação
          </h3>
          <div class="flex flex-wrap gap-1.5">
            <UBadge
              v-for="area in ficha.areasAtuacao"
              :key="area"
              color="primary"
              variant="subtle"
            >
              {{ area }}
            </UBadge>
          </div>
        </section>

        <!-- Ferramental -->
        <section v-if="ficha.ferramental?.length">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
            Ferramental
          </h3>
          <div class="flex flex-wrap gap-1.5">
            <UBadge
              v-for="tool in ficha.ferramental"
              :key="tool"
              color="neutral"
              variant="subtle"
            >
              {{ tool }}
            </UBadge>
          </div>
        </section>

        <!-- Cidades atendidas -->
        <section v-if="ficha.cidadesAtendidas?.length">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
            Cidades atendidas
          </h3>
          <ul class="space-y-1.5">
            <li
              v-for="(c, i) in ficha.cidadesAtendidas"
              :key="c.cidade + i"
              class="flex items-center justify-between gap-3"
            >
              <span class="text-highlighted">{{ c.cidade }}</span>
              <span class="text-muted text-xs">
                {{ c.custoKm ? `R$ ${c.custoKm}/km` : 'sem custo informado' }}
              </span>
            </li>
          </ul>
        </section>
      </div>
    </template>

    <template #footer>
      <UButton label="Fechar" color="neutral" variant="subtle" @click="open = false" />
    </template>
  </USlideover>
</template>
