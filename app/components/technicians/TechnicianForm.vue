<script setup lang="ts">
import type { TechnicianDetail, TechnicianPayload } from '~/types'

const props = defineProps<{
  initial?: TechnicianDetail | null
  submitting?: boolean
  submitLabel?: string
}>()

const emit = defineEmits<{
  submit: [payload: TechnicianPayload]
  cancel: []
}>()

const { $api } = useNuxtApp()

const isCreate = computed(() => !props.initial)

// ---- Grupos de opções (áreas / ferramental) vindos do landing-config ----
interface OptionItem { id: number, label: string, active: boolean }
interface OptionGroup { id: number, name: string, active: boolean, items: OptionItem[] }

const { data: rawAreas } = await useAsyncData('tech-area-groups', () =>
  $api<OptionGroup[]>('/landing-config/groups/area').catch(() => [])
)
const { data: rawTools } = await useAsyncData('tech-tool-groups', () =>
  $api<OptionGroup[]>('/landing-config/groups/tool').catch(() => [])
)

function flattenLabels(groups: OptionGroup[] | null | undefined): string[] {
  return (groups ?? [])
    .filter(g => g.active)
    .flatMap(g => g.items.filter(i => i.active).map(i => i.label))
}

// Opções disponíveis: catálogo + quaisquer valores já selecionados no técnico
// (para que valores personalizados apareçam como selecionados ao editar).
const areaOptions = ref<string[]>([])
const toolOptions = ref<string[]>([])

function mergeOptions(target: Ref<string[]>, base: string[], selected: string[]) {
  target.value = Array.from(new Set([...base, ...selected]))
}

// ---- Estado interno (strings não-nulas p/ UInput) ----
interface FormState {
  nome: string
  email: string
  senha: string
  cpf: string
  rg: string
  celular: string
  isActive: boolean
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  enderecoEncomendas: string
  pretensaoValorHora: string
  custoPorKm: string
  areasAtuacao: string[]
  ferramental: string[]
  possuiEmpresa: boolean
  empresa: { nomeFantasia: string, razaoSocial: string, cnpj: string }
  pix: { chavePix: string, nomeTitularPix: string }
  dadosBancarios: { banco: string, agencia: string, conta: string, tipoConta: string }
}

const i = props.initial
const state = reactive<FormState>({
  nome: i?.user.name ?? '',
  email: i?.user.email ?? '',
  senha: '',
  cpf: i?.cpf ?? '',
  rg: i?.rg ?? '',
  celular: i?.celular ?? '',
  isActive: i?.user.isActive ?? true,
  cep: i?.cep ?? '',
  logradouro: i?.logradouro ?? '',
  numero: i?.numero ?? '',
  complemento: i?.complemento ?? '',
  bairro: i?.bairro ?? '',
  enderecoEncomendas: i?.enderecoEncomendas ?? '',
  pretensaoValorHora: i?.pretensaoValorHora ?? '',
  custoPorKm: i?.custoPorKm ?? '',
  areasAtuacao: [...(i?.areasAtuacao ?? [])],
  ferramental: [...(i?.ferramental ?? [])],
  possuiEmpresa: !!i?.empresa,
  empresa: {
    nomeFantasia: i?.empresa?.nomeFantasia ?? '',
    razaoSocial: i?.empresa?.razaoSocial ?? '',
    cnpj: i?.empresa?.cnpj ?? ''
  },
  pix: {
    chavePix: i?.pagamento?.pix?.chavePix ?? '',
    nomeTitularPix: i?.pagamento?.pix?.nomeTitularPix ?? ''
  },
  dadosBancarios: {
    banco: i?.pagamento?.dadosBancarios?.banco ?? '',
    agencia: i?.pagamento?.dadosBancarios?.agencia ?? '',
    conta: i?.pagamento?.dadosBancarios?.conta ?? '',
    tipoConta: i?.pagamento?.dadosBancarios?.tipoConta ?? 'corrente'
  }
})

// Popula as opções assim que os grupos chegam (mantendo valores já escolhidos).
watchEffect(() => {
  mergeOptions(areaOptions, flattenLabels(rawAreas.value), state.areasAtuacao)
  mergeOptions(toolOptions, flattenLabels(rawTools.value), state.ferramental)
})

const tipoContaItems = [
  { label: 'Conta corrente', value: 'corrente' },
  { label: 'Conta poupança', value: 'poupanca' }
]

// ---- Cidade de residência ----
const residenceCityCode = ref<number | null>(i?.cityCode ?? null)
const residenceCityLabel = computed(() =>
  i?.city ? `${i.city.nome} / ${i.city.uf}` : ''
)

// ---- Cidades atendidas (lista editável) ----
interface ServedRow { cityCode: number | null, custoKm: string, label: string }
const servedCities = reactive<ServedRow[]>(
  (i?.servedCities ?? []).map(a => ({
    cityCode: a.cityCode,
    custoKm: a.custoKm ?? '',
    label: `${a.city.nome} / ${a.city.uf}`
  }))
)

function addCidade() {
  servedCities.push({ cityCode: null, custoKm: '', label: '' })
}
function removerCidade(index: number) {
  servedCities.splice(index, 1)
}

// ---- ViaCEP ----
const cepLoading = ref(false)
async function buscarCep() {
  const cepLimpo = state.cep.replace(/\D/g, '')
  if (cepLimpo.length !== 8) return
  cepLoading.value = true
  try {
    const data = await $fetch<{
      logradouro?: string
      bairro?: string
      ibge?: string
      erro?: boolean
    }>(`https://viacep.com.br/ws/${cepLimpo}/json/`)
    if (!data.erro) {
      if (data.logradouro) state.logradouro = data.logradouro
      if (data.bairro) state.bairro = data.bairro
      // ViaCEP retorna o código IBGE do município — identidade da cidade.
      if (data.ibge) residenceCityCode.value = Number(data.ibge)
    }
  } catch {
    // CEP não localizado — preenchimento manual.
  } finally {
    cepLoading.value = false
  }
}

// ---- Validação + submit ----
const errors = reactive<{ nome?: string, email?: string, senha?: string, cpf?: string }>({})

function clean(v: string): string | null {
  const t = v.trim()
  return t.length ? t : null
}

function onSubmit() {
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  errors.nome = state.nome.trim().length >= 2 ? undefined : 'Informe o nome (mín. 2 caracteres)'
  errors.email = emailRe.test(state.email.trim()) ? undefined : 'Informe um e-mail válido'
  errors.cpf = state.cpf.trim().length ? undefined : 'CPF é obrigatório'
  // Senha obrigatória ao criar; ao editar, só valida se algo foi digitado.
  const senhaInformada = state.senha.length > 0
  errors.senha = (isCreate.value || senhaInformada)
    ? (state.senha.length >= 8 ? undefined : 'A senha deve ter pelo menos 8 caracteres')
    : undefined

  if (errors.nome || errors.email || errors.cpf || errors.senha) return

  const payload: TechnicianPayload = {
    nome: state.nome.trim(),
    email: state.email.trim(),
    cpf: state.cpf.trim(),
    rg: clean(state.rg),
    celular: state.celular.replace(/\D/g, ''),
    isActive: state.isActive,
    endereco: {
      cep: clean(state.cep.replace(/\D/g, '')),
      logradouro: clean(state.logradouro),
      numero: clean(state.numero),
      complemento: clean(state.complemento),
      bairro: clean(state.bairro),
      cityCode: residenceCityCode.value
    },
    enderecoEncomendas: clean(state.enderecoEncomendas),
    pagamento: {
      pix: state.pix.chavePix.trim()
        ? { chavePix: state.pix.chavePix.trim(), nomeTitularPix: state.pix.nomeTitularPix.trim() }
        : null,
      dadosBancarios: (state.dadosBancarios.banco.trim() && state.dadosBancarios.agencia.trim() && state.dadosBancarios.conta.trim())
        ? {
            banco: state.dadosBancarios.banco.trim(),
            agencia: state.dadosBancarios.agencia.trim(),
            conta: state.dadosBancarios.conta.trim(),
            tipoConta: state.dadosBancarios.tipoConta
          }
        : null
    },
    empresa: state.possuiEmpresa
      ? {
          nomeFantasia: state.empresa.nomeFantasia.trim(),
          razaoSocial: state.empresa.razaoSocial.trim(),
          cnpj: state.empresa.cnpj.replace(/\D/g, '')
        }
      : null,
    areasAtuacao: state.areasAtuacao,
    ferramental: state.ferramental,
    pretensaoValorHora: clean(state.pretensaoValorHora),
    custoPorKm: clean(state.custoPorKm),
    cidadesAtendidas: servedCities
      .filter(c => c.cityCode != null)
      .map(c => ({ cityCode: c.cityCode as number, custoKm: clean(c.custoKm) }))
  }

  // Só envia senha quando criando ou quando uma nova senha foi digitada.
  if (isCreate.value || senhaInformada) payload.senha = state.senha

  emit('submit', payload)
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="onSubmit">
    <!-- Dados pessoais -->
    <section class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
          Dados pessoais
        </h3>
        <USwitch v-model="state.isActive" label="Técnico ativo" />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UFormField label="Nome completo" required :error="errors.nome">
          <UInput v-model="state.nome" class="w-full" placeholder="Ex.: João da Silva" />
        </UFormField>
        <UFormField label="E-mail" required :error="errors.email">
          <UInput v-model="state.email" type="email" class="w-full" placeholder="tecnico@exemplo.com" />
        </UFormField>
        <UFormField
          label="Senha"
          :required="isCreate"
          :error="errors.senha"
          :help="isCreate ? 'Mínimo 8 caracteres' : 'Deixe em branco para manter a senha atual'"
        >
          <UInput v-model="state.senha" type="password" class="w-full" placeholder="Mínimo 8 caracteres" autocomplete="new-password" />
        </UFormField>
        <UFormField label="Celular">
          <UInput v-model="state.celular" class="w-full" placeholder="(00) 00000-0000" />
        </UFormField>
        <UFormField label="CPF" required :error="errors.cpf">
          <UInput v-model="state.cpf" class="w-full" placeholder="000.000.000-00" />
        </UFormField>
        <UFormField label="RG">
          <UInput v-model="state.rg" class="w-full" placeholder="00.000.000-0" />
        </UFormField>
      </div>
    </section>

    <!-- Endereço -->
    <section class="space-y-4">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
        Endereço
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-6 gap-4">
        <UFormField label="CEP" class="sm:col-span-2">
          <UInput
            v-model="state.cep"
            class="w-full"
            placeholder="00000-000"
            :loading="cepLoading"
            @blur="buscarCep"
          >
            <template #trailing>
              <UButton
                icon="i-lucide-search"
                color="neutral"
                variant="link"
                size="xs"
                aria-label="Buscar CEP"
                @click="buscarCep"
              />
            </template>
          </UInput>
        </UFormField>
        <UFormField label="Logradouro" class="sm:col-span-3">
          <UInput v-model="state.logradouro" class="w-full" />
        </UFormField>
        <UFormField label="Número" class="sm:col-span-1">
          <UInput v-model="state.numero" class="w-full" />
        </UFormField>
        <UFormField label="Complemento" class="sm:col-span-3">
          <UInput v-model="state.complemento" class="w-full" />
        </UFormField>
        <UFormField label="Bairro" class="sm:col-span-3">
          <UInput v-model="state.bairro" class="w-full" />
        </UFormField>
        <UFormField label="Cidade" class="sm:col-span-3" help="Busque pelo nome e selecione o município">
          <CityAutocomplete
            v-model="residenceCityCode"
            :initial-label="residenceCityLabel"
            placeholder="Ex.: Manaus"
          />
        </UFormField>
        <UFormField label="Endereço para encomendas" class="sm:col-span-3" help="Onde a 3CORE envia equipamentos">
          <UInput v-model="state.enderecoEncomendas" class="w-full" placeholder="Rua, Nº, Bairro, Cidade/UF" />
        </UFormField>
      </div>
    </section>

    <!-- Financeiro -->
    <section class="space-y-4">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
        Financeiro
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UFormField label="Pretensão (valor/hora)">
          <UInput v-model="state.pretensaoValorHora" class="w-full" placeholder="Ex.: 100,00" />
        </UFormField>
        <UFormField label="Custo por km">
          <UInput v-model="state.custoPorKm" class="w-full" placeholder="Ex.: 1,50" />
        </UFormField>
      </div>
    </section>

    <!-- Áreas de atuação + Ferramental -->
    <section class="space-y-4">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
        Áreas de atuação e ferramental
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UFormField label="Áreas de atuação" help="Selecione ou digite para adicionar">
          <USelectMenu
            v-model="state.areasAtuacao"
            :items="areaOptions"
            multiple
            create-item
            placeholder="Selecione as áreas"
            class="w-full"
            @create="(v: string) => { areaOptions.push(v); state.areasAtuacao.push(v) }"
          />
        </UFormField>
        <UFormField label="Ferramental" help="Selecione ou digite para adicionar">
          <USelectMenu
            v-model="state.ferramental"
            :items="toolOptions"
            multiple
            create-item
            placeholder="Selecione o ferramental"
            class="w-full"
            @create="(v: string) => { toolOptions.push(v); state.ferramental.push(v) }"
          />
        </UFormField>
      </div>
    </section>

    <!-- Empresa -->
    <section class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
          Empresa
        </h3>
        <USwitch v-model="state.possuiEmpresa" label="Possui empresa" />
      </div>
      <div v-if="state.possuiEmpresa" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <UFormField label="Nome fantasia">
          <UInput v-model="state.empresa.nomeFantasia" class="w-full" placeholder="Ex.: Tech Solutions" />
        </UFormField>
        <UFormField label="Razão social">
          <UInput v-model="state.empresa.razaoSocial" class="w-full" placeholder="Ex.: João da Silva ME" />
        </UFormField>
        <UFormField label="CNPJ">
          <UInput v-model="state.empresa.cnpj" class="w-full" placeholder="00.000.000/0000-00" />
        </UFormField>
      </div>
    </section>

    <!-- Pagamento -->
    <section class="space-y-4">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
        Pagamento
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UFormField label="Chave PIX">
          <UInput v-model="state.pix.chavePix" class="w-full" placeholder="CPF, CNPJ, e-mail, celular ou aleatória" />
        </UFormField>
        <UFormField label="Nome do titular (PIX)">
          <UInput v-model="state.pix.nomeTitularPix" class="w-full" placeholder="Nome como no PIX" />
        </UFormField>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <UFormField label="Banco">
          <UInput v-model="state.dadosBancarios.banco" class="w-full" placeholder="Ex.: Itaú" />
        </UFormField>
        <UFormField label="Agência">
          <UInput v-model="state.dadosBancarios.agencia" class="w-full" placeholder="0000" />
        </UFormField>
        <UFormField label="Conta">
          <UInput v-model="state.dadosBancarios.conta" class="w-full" placeholder="00000-0" />
        </UFormField>
        <UFormField label="Tipo de conta">
          <USelect v-model="state.dadosBancarios.tipoConta" :items="tipoContaItems" class="w-full" />
        </UFormField>
      </div>
    </section>

    <!-- Cidades atendidas -->
    <section class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
          Cidades atendidas
        </h3>
        <UButton
          label="Adicionar cidade"
          icon="i-lucide-plus"
          color="neutral"
          variant="subtle"
          size="sm"
          @click="addCidade"
        />
      </div>

      <div
        v-for="(row, idx) in servedCities"
        :key="idx"
        class="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end"
      >
        <UFormField label="Cidade" class="sm:col-span-3">
          <CityAutocomplete
            v-model="row.cityCode"
            :initial-label="row.label"
            placeholder="Ex.: Campinas"
          />
        </UFormField>
        <UFormField label="Custo por km" class="sm:col-span-2">
          <UInput v-model="row.custoKm" class="w-full" placeholder="Ex.: 1,50" />
        </UFormField>
        <div class="sm:col-span-1 flex sm:justify-center">
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            aria-label="Remover cidade"
            @click="removerCidade(idx)"
          />
        </div>
      </div>

      <p v-if="!servedCities.length" class="text-sm text-muted">
        Nenhuma cidade atendida adicionada.
      </p>
    </section>

    <div class="flex justify-end gap-2 border-t border-default pt-4">
      <UButton label="Cancelar" color="neutral" variant="subtle" @click="emit('cancel')" />
      <UButton
        type="submit"
        :label="submitLabel ?? 'Salvar'"
        icon="i-lucide-check"
        :loading="submitting"
      />
    </div>
  </form>
</template>
