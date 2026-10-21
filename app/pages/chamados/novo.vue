<script setup lang="ts">
import type { Chamado, Client, ClientLocal, CreateChamadoPayload, Servico } from '~/types'

definePageMeta({ permission: 'atendimentos.criar' })

const { $api } = useNuxtApp()
const toast = useToast()
const { can } = usePermissions()
const podeGerenciar = can('atendimentos.gerenciar')

const { data: clients } = await useAsyncData('clients-for-chamado', () =>
  $api<Client[]>('/clients')
)

const clientItems = computed(() =>
  (clients.value ?? [])
    .filter(c => c.ativo)
    .map(c => ({ label: c.nomeFantasia || c.nome, value: c.id }))
)

// Serviços do catálogo: preenchem o título (se vazio) e mostram a duração padrão.
const { data: servicos } = await useAsyncData(
  'servicos-novo-chamado',
  () => (can('servicos.ver')
    ? $api<Servico[]>('/servicos').catch(() => [] as Servico[])
    : Promise.resolve([] as Servico[])),
  { default: () => [] as Servico[] }
)
const servicoItems = computed(() => [
  { label: 'Sem serviço do catálogo', value: 0 },
  ...(servicos.value ?? []).map(sv => ({ label: sv.nome, value: sv.id }))
])

const state = reactive({
  clientId: undefined as number | undefined,
  servicoId: 0,
  cityCode: null as number | null,
  titulo: '',
  descricao: '',
  chamadoInterno: '',
  chamadoExterno: '',
  prioridade: 'media' as CreateChamadoPayload['prioridade'],
  agendadoPara: '' as string,
  // Endereço do atendimento (opcional).
  cep: '',
  logradouro: '',
  numero: '',
  bairro: '',
  complemento: '',
  pontoReferencia: '',
  // Local do cliente + contato no local (opcionais).
  localId: null as number | null,
  latitude: '',
  longitude: '',
  contatoLocalNome: '',
  contatoLocalTelefone: '',
  codigoCheckin: '',
  codigoCheckout: ''
})

// Locais (sites) do cliente selecionado.
const locais = ref<ClientLocal[]>([])
const locaisLoading = ref(false)
const localItems = computed(() => [
  { label: 'Endereço avulso (sem local)', value: 0 },
  ...locais.value.filter(l => l.ativo).map(l => ({ label: l.nome, value: l.id }))
])
async function carregarLocais(clientId: number | undefined) {
  locais.value = []
  state.localId = null
  if (!clientId || !can('clientes.ver')) return
  locaisLoading.value = true
  try {
    locais.value = await $api<ClientLocal[]>(`/clients/${clientId}/locais`)
  } catch {
    locais.value = []
  } finally {
    locaisLoading.value = false
  }
}

// Ao escolher um local, preenche endereço, cidade, coordenadas e contato.
function aplicarLocal(localId: number) {
  state.localId = localId || null
  const l = locais.value.find(x => x.id === localId)
  if (!l) return
  state.cep = l.cep ?? ''
  state.logradouro = l.logradouro ?? ''
  state.numero = l.numero ?? ''
  state.bairro = l.bairro ?? ''
  state.complemento = l.complemento ?? ''
  state.pontoReferencia = l.pontoReferencia ?? ''
  state.latitude = l.latitude != null ? String(l.latitude) : ''
  state.longitude = l.longitude != null ? String(l.longitude) : ''
  state.contatoLocalNome = l.contatoNome ?? ''
  state.contatoLocalTelefone = l.contatoTelefone ?? ''
  state.codigoCheckin = l.codigoCheckin ?? ''
  state.codigoCheckout = l.codigoCheckout ?? ''
  if (l.cityCode) setCidade(l.cityCode, l.city ? `${l.city.nome} / ${l.city.uf}` : '')
  mostrarEndereco.value = true
}

// Seção de endereço recolhida por padrão (é opcional).
const mostrarEndereco = ref(true)
const cepLoading = ref(false)

// Rótulo + chave de remontagem do CityAutocomplete. Sempre que preenchemos a
// cidade programaticamente (cliente ou CEP), atualizamos o rótulo e a chave
// para o campo refletir a seleção — mas o usuário pode trocar livremente.
const cityLabel = ref('')
const cityKey = ref(0)
function setCidade(code: number | null, label: string) {
  state.cityCode = code
  cityLabel.value = label
  cityKey.value++
}

const clienteSelecionado = computed(() =>
  (clients.value ?? []).find(c => c.id === state.clientId) ?? null
)

// Ao trocar de cliente, sugere a cidade do cliente (editável) e carrega os locais.
watch(() => state.clientId, (clientId) => {
  const city = clienteSelecionado.value?.city
  setCidade(
    clienteSelecionado.value?.cityCode ?? null,
    city ? `${city.nome} / ${city.uf}` : ''
  )
  carregarLocais(clientId)
})

async function buscarCep() {
  const cep = state.cep.replace(/\D/g, '')
  if (cep.length !== 8) return
  cepLoading.value = true
  try {
    const data = await $fetch<{
      logradouro?: string
      bairro?: string
      localidade?: string
      uf?: string
      ibge?: string
      erro?: boolean
    }>(`https://viacep.com.br/ws/${cep}/json/`)
    if (!data.erro) {
      state.logradouro = data.logradouro ?? state.logradouro
      state.bairro = data.bairro ?? state.bairro
      // Preenche a cidade do atendimento com o município do CEP.
      if (data.ibge) {
        setCidade(
          Number(data.ibge),
          data.localidade && data.uf ? `${data.localidade} / ${data.uf}` : ''
        )
      }
    }
  } catch {
    // CEP não encontrado — usuário preenche manualmente.
  } finally {
    cepLoading.value = false
  }
}

const servicoSelecionado = computed(() =>
  (servicos.value ?? []).find(sv => sv.id === state.servicoId) ?? null
)
// Ao escolher o serviço, sugere o título (só se ainda vazio ou igual ao serviço anterior).
watch(() => state.servicoId, (_novo, antigo) => {
  const anterior = (servicos.value ?? []).find(sv => sv.id === antigo)
  if (servicoSelecionado.value && (!state.titulo.trim() || state.titulo === anterior?.nome)) {
    state.titulo = servicoSelecionado.value.nome
  }
})

const prioridadeItems = [
  { label: 'Baixa', value: 'baixa' },
  { label: 'Média', value: 'media' },
  { label: 'Alta', value: 'alta' },
  { label: 'Urgente', value: 'urgente' }
]

const submitting = ref(false)
const errors = reactive<{ clientId?: string, titulo?: string, cityCode?: string }>({})

const clean = (v: string) => {
  const t = v.trim()
  return t.length ? t : null
}

async function salvar() {
  errors.clientId = state.clientId ? undefined : 'Selecione o cliente'
  errors.titulo = state.titulo.trim().length >= 2 || state.servicoId ? undefined : 'Informe o título ou escolha um serviço'
  errors.cityCode = state.cityCode ? undefined : 'Selecione a cidade do atendimento'
  if (errors.clientId || errors.titulo || errors.cityCode) return

  submitting.value = true
  try {
    const payload: CreateChamadoPayload = {
      clientId: state.clientId!,
      cityCode: state.cityCode!,
      titulo: state.titulo.trim() || undefined,
      servicoId: state.servicoId || undefined,
      descricao: clean(state.descricao),
      chamadoInterno: clean(state.chamadoInterno),
      chamadoExterno: clean(state.chamadoExterno),
      prioridade: state.prioridade,
      cep: clean(state.cep),
      logradouro: clean(state.logradouro),
      numero: clean(state.numero),
      bairro: clean(state.bairro),
      complemento: clean(state.complemento),
      pontoReferencia: clean(state.pontoReferencia),
      localId: state.localId ?? undefined,
      latitude: state.latitude === '' ? undefined : Number(state.latitude),
      longitude: state.longitude === '' ? undefined : Number(state.longitude),
      contatoLocalNome: clean(state.contatoLocalNome),
      contatoLocalTelefone: clean(state.contatoLocalTelefone),
      codigoCheckin: podeGerenciar ? clean(state.codigoCheckin) : undefined,
      codigoCheckout: podeGerenciar ? clean(state.codigoCheckout) : undefined,
      agendadoPara: state.agendadoPara ? new Date(state.agendadoPara).toISOString() : null
    }
    const created = await $api<Chamado>('/chamados', { method: 'POST', body: payload })
    toast.add({ title: 'Chamado criado', icon: 'i-lucide-check', color: 'success' })
    await navigateTo(`/chamados/${created.id}`)
  } catch (e: unknown) {
    const err = e as { data?: { message?: string | string[] } }
    const msg = Array.isArray(err?.data?.message) ? err.data.message[0] : err?.data?.message
    toast.add({ title: msg ?? 'Erro ao criar chamado', icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="chamado-novo">
    <template #header>
      <UDashboardNavbar title="Novo chamado">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            to="/chamados"
            aria-label="Voltar"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="w-full lg:max-w-2xl mx-auto">
        <form class="space-y-4" @submit.prevent="salvar">
          <UFormField label="Cliente" required :error="errors.clientId">
            <USelect
              v-model="state.clientId"
              :items="clientItems"
              placeholder="Selecione o cliente"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="servicos.length"
            label="Serviço do catálogo"
            :help="servicoSelecionado?.duracaoPadraoMin ? `Duração padrão: ${servicoSelecionado.duracaoPadraoMin} min` : 'Opcional — padroniza o título e a duração prevista'"
          >
            <USelect v-model="state.servicoId" :items="servicoItems" class="w-full" />
          </UFormField>

          <UFormField label="Título" :required="!state.servicoId" :error="errors.titulo">
            <UInput v-model="state.titulo" class="w-full" placeholder="Ex.: Instalação de equipamento" />
          </UFormField>

          <UFormField label="Descrição">
            <UTextarea
              v-model="state.descricao"
              class="w-full"
              :rows="4"
              placeholder="Detalhes do atendimento"
            />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Chamado interno">
              <UInput v-model="state.chamadoInterno" class="w-full" placeholder="Ex.: 12345" />
            </UFormField>
            <UFormField label="Chamado externo">
              <UInput v-model="state.chamadoExterno" class="w-full" placeholder="Ex.: INC-00987" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Prioridade">
              <USelect v-model="state.prioridade" :items="prioridadeItems" class="w-full" />
            </UFormField>
            <UFormField label="Agendado para" help="Opcional">
              <UInput v-model="state.agendadoPara" type="datetime-local" class="w-full" />
            </UFormField>
          </div>

          <!-- Endereço do atendimento (opcional, recolhido por padrão) -->
          <div class="border border-default rounded-lg">
            <button
              type="button"
              class="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm text-highlighted"
              @click="mostrarEndereco = !mostrarEndereco"
            >
              <span class="flex items-center gap-2">
                <UIcon name="i-lucide-map-pin" class="size-4" />
                Endereço do atendimento
                <span class="text-muted text-xs">(opcional)</span>
              </span>
              <UIcon
                :name="mostrarEndereco ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="size-4 text-muted"
              />
            </button>

            <div v-if="mostrarEndereco" class="p-4 pt-0 space-y-4">
              <UFormField
                v-if="state.clientId && (locais.length || locaisLoading)"
                label="Local do cliente"
                help="Escolha um local cadastrado para preencher o endereço e o contato"
              >
                <USelect
                  :model-value="state.localId ?? 0"
                  :items="localItems"
                  :loading="locaisLoading"
                  class="w-full"
                  @update:model-value="aplicarLocal"
                />
              </UFormField>

              <UFormField label="CEP" help="Preencha para buscar o endereço automaticamente">
                <div class="flex gap-2">
                  <UInput
                    v-model="state.cep"
                    class="flex-1"
                    placeholder="00000-000"
                    inputmode="numeric"
                    @keydown.enter.prevent="buscarCep"
                  />
                  <UButton
                    label="Buscar"
                    icon="i-lucide-search"
                    color="neutral"
                    variant="subtle"
                    :loading="cepLoading"
                    @click="buscarCep"
                  />
                </div>
              </UFormField>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <UFormField label="Logradouro" class="sm:col-span-2">
                  <UInput v-model="state.logradouro" class="w-full" placeholder="Rua, avenida…" />
                </UFormField>
                <UFormField label="Número">
                  <UInput v-model="state.numero" class="w-full" />
                </UFormField>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <UFormField label="Bairro">
                  <UInput v-model="state.bairro" class="w-full" />
                </UFormField>
                <UFormField label="Complemento">
                  <UInput v-model="state.complemento" class="w-full" placeholder="Bloco, sala, apto…" />
                </UFormField>
              </div>

              <UFormField
                label="Cidade do atendimento"
                required
                :error="errors.cityCode"
              >
                <CityAutocomplete
                  :key="cityKey"
                  v-model="state.cityCode"
                  :initial-label="cityLabel"
                  placeholder="Buscar cidade"
                />
              </UFormField>

              <UFormField label="Ponto de referência">
                <UInput v-model="state.pontoReferencia" class="w-full" placeholder="Ex.: próximo ao mercado central" />
              </UFormField>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <UFormField label="Latitude" help="Opcional — valida o check-in do técnico">
                  <UInput
                    v-model="state.latitude"
                    type="number"
                    step="any"
                    class="w-full"
                    placeholder="-3.119"
                  />
                </UFormField>
                <UFormField label="Longitude">
                  <UInput
                    v-model="state.longitude"
                    type="number"
                    step="any"
                    class="w-full"
                    placeholder="-60.021"
                  />
                </UFormField>
              </div>
            </div>
          </div>

          <!-- Contato no local -->
          <div class="border border-default rounded-lg p-4 space-y-4">
            <p class="text-sm text-highlighted flex items-center gap-2">
              <UIcon name="i-lucide-contact" class="size-4" />
              Contato no local
              <span class="text-muted text-xs">(opcional)</span>
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="Nome">
                <UInput v-model="state.contatoLocalNome" class="w-full" placeholder="Quem recebe o técnico" />
              </UFormField>
              <UFormField label="Telefone">
                <UInput v-model="state.contatoLocalTelefone" class="w-full" placeholder="(00) 00000-0000" />
              </UFormField>
            </div>
            <div v-if="podeGerenciar" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="Código de check-in" help="Vazio = não exige">
                <UInput v-model="state.codigoCheckin" class="w-full" />
              </UFormField>
              <UFormField label="Código de check-out" help="Vazio = não exige">
                <UInput v-model="state.codigoCheckout" class="w-full" />
              </UFormField>
            </div>
          </div>

          <p class="text-xs text-muted">
            O técnico é atribuído depois, na ficha do chamado.
          </p>

          <div class="flex justify-end gap-2 border-t border-default pt-4">
            <UButton
              label="Cancelar"
              color="neutral"
              variant="subtle"
              @click="navigateTo('/chamados')"
            />
            <UButton
              type="submit"
              label="Criar chamado"
              icon="i-lucide-check"
              :loading="submitting"
            />
          </div>
        </form>
      </div>
    </template>
  </UDashboardPanel>
</template>
