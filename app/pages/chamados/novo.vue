<script setup lang="ts">
import type { Chamado, Client, CreateChamadoPayload } from '~/types'

definePageMeta({ permission: 'atendimentos.criar' })

const { $api } = useNuxtApp()
const toast = useToast()

const { data: clients } = await useAsyncData('clients-for-chamado', () =>
  $api<Client[]>('/clients')
)

const clientItems = computed(() =>
  (clients.value ?? [])
    .filter(c => c.ativo)
    .map(c => ({ label: c.nomeFantasia || c.nome, value: c.id }))
)

const state = reactive({
  clientId: undefined as number | undefined,
  cityCode: null as number | null,
  titulo: '',
  descricao: '',
  prioridade: 'media' as CreateChamadoPayload['prioridade'],
  agendadoPara: '' as string,
  // Endereço do atendimento (opcional).
  cep: '',
  logradouro: '',
  numero: '',
  bairro: '',
  complemento: '',
  pontoReferencia: ''
})

// Seção de endereço recolhida por padrão (é opcional).
const mostrarEndereco = ref(false)
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

// Ao trocar de cliente, sugere a cidade do cliente (editável).
watch(() => state.clientId, () => {
  const city = clienteSelecionado.value?.city
  setCidade(
    clienteSelecionado.value?.cityCode ?? null,
    city ? `${city.nome} / ${city.uf}` : ''
  )
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
  errors.titulo = state.titulo.trim().length >= 2 ? undefined : 'Informe o título'
  errors.cityCode = state.cityCode ? undefined : 'Selecione a cidade do atendimento'
  if (errors.clientId || errors.titulo || errors.cityCode) return

  submitting.value = true
  try {
    const payload: CreateChamadoPayload = {
      clientId: state.clientId!,
      cityCode: state.cityCode!,
      titulo: state.titulo.trim(),
      descricao: clean(state.descricao),
      prioridade: state.prioridade,
      cep: clean(state.cep),
      logradouro: clean(state.logradouro),
      numero: clean(state.numero),
      bairro: clean(state.bairro),
      complemento: clean(state.complemento),
      pontoReferencia: clean(state.pontoReferencia),
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

          <UFormField label="Título" required :error="errors.titulo">
            <UInput v-model="state.titulo" class="w-full" placeholder="Ex.: Instalação de equipamento" />
          </UFormField>

          <UFormField label="Descrição">
            <UTextarea v-model="state.descricao" class="w-full" :rows="4" placeholder="Detalhes do atendimento" />
          </UFormField>

          <UFormField
            label="Cidade do atendimento"
            required
            :error="errors.cityCode"
            help="Local onde o serviço será realizado — pode ser diferente da cidade do cliente."
          >
            <CityAutocomplete
              :key="cityKey"
              v-model="state.cityCode"
              :initial-label="cityLabel"
              placeholder="Buscar cidade"
            />
          </UFormField>

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

              <UFormField label="Ponto de referência">
                <UInput v-model="state.pontoReferencia" class="w-full" placeholder="Ex.: próximo ao mercado central" />
              </UFormField>
            </div>
          </div>

          <p class="text-xs text-muted">
            O técnico é atribuído depois, na ficha do chamado.
          </p>

          <div class="flex justify-end gap-2 border-t border-default pt-4">
            <UButton label="Cancelar" color="neutral" variant="subtle" @click="navigateTo('/chamados')" />
            <UButton type="submit" label="Criar chamado" icon="i-lucide-check" :loading="submitting" />
          </div>
        </form>
      </div>
    </template>
  </UDashboardPanel>
</template>
