<script setup lang="ts">
import type { Client, ClientPayload, ClientType } from '~/types'

const props = defineProps<{
  initial?: Client | null
  submitting?: boolean
  submitLabel?: string
}>()

const emit = defineEmits<{
  submit: [payload: ClientPayload]
  cancel: []
}>()

const tipoItems = [
  { label: 'Pessoa Jurídica', value: 'pj' as ClientType },
  { label: 'Pessoa Física', value: 'pf' as ClientType }
]

// Estado interno com strings não-nulas (UInput exige string | undefined).
interface FormState {
  tipo: ClientType
  ativo: boolean
  nome: string
  nomeFantasia: string
  cnpj: string
  cpf: string
  email: string
  telefone: string
  contatoNome: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  observacoes: string
}

const state = reactive<FormState>({
  tipo: props.initial?.tipo ?? 'pj',
  ativo: props.initial?.ativo ?? true,
  nome: props.initial?.nome ?? '',
  nomeFantasia: props.initial?.nomeFantasia ?? '',
  cnpj: props.initial?.cnpj ?? '',
  cpf: props.initial?.cpf ?? '',
  email: props.initial?.email ?? '',
  telefone: props.initial?.telefone ?? '',
  contatoNome: props.initial?.contatoNome ?? '',
  cep: props.initial?.cep ?? '',
  logradouro: props.initial?.logradouro ?? '',
  numero: props.initial?.numero ?? '',
  complemento: props.initial?.complemento ?? '',
  bairro: props.initial?.bairro ?? '',
  observacoes: props.initial?.observacoes ?? ''
})

// Cidade por código IBGE (via CityAutocomplete).
const cityCode = ref<number | null>(props.initial?.cityCode ?? null)
const cityLabel = computed(() =>
  props.initial?.city ? `${props.initial.city.nome} / ${props.initial.city.uf}` : ''
)

const isPJ = computed(() => state.tipo === 'pj')

const errors = reactive<{ nome?: string }>({})


function onSubmit() {
  errors.nome = state.nome.trim().length >= 2 ? undefined : 'Informe o nome (mín. 2 caracteres)'
  if (errors.nome) return

  // Envia strings vazias como null; e-mail vazio não vai (evita validação IsEmail).
  const clean = (v: string): string | null => {
    const t = v.trim()
    return t.length ? t : null
  }
  const payload: ClientPayload = {
    tipo: state.tipo,
    nome: state.nome.trim(),
    nomeFantasia: isPJ.value ? clean(state.nomeFantasia) : null,
    cnpj: isPJ.value ? clean(state.cnpj) : null,
    cpf: isPJ.value ? null : clean(state.cpf),
    email: clean(state.email),
    telefone: clean(state.telefone),
    contatoNome: clean(state.contatoNome),
    cep: clean(state.cep),
    logradouro: clean(state.logradouro),
    numero: clean(state.numero),
    complemento: clean(state.complemento),
    bairro: clean(state.bairro),
    cityCode: cityCode.value,
    observacoes: clean(state.observacoes),
    ativo: state.ativo
  }
  // e-mail vazio: omite do corpo para não bater no @IsEmail.
  if (!payload.email) delete payload.email
  emit('submit', payload)
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="onSubmit">
    <!-- Tipo -->
    <div class="flex flex-wrap items-center gap-4">
      <URadioGroup
        v-model="state.tipo"
        :items="tipoItems"
        orientation="horizontal"
      />
      <USwitch v-model="state.ativo" label="Cliente ativo" class="ms-auto" />
    </div>

    <!-- Identificação -->
    <section class="space-y-4">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
        Identificação
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UFormField :label="isPJ ? 'Razão social' : 'Nome completo'" required :error="errors.nome">
          <UInput v-model="state.nome" class="w-full" :placeholder="isPJ ? 'Ex.: Acme Ltda.' : 'Ex.: João da Silva'" />
        </UFormField>
        <UFormField v-if="isPJ" label="Nome fantasia">
          <UInput v-model="state.nomeFantasia" class="w-full" placeholder="Ex.: Acme" />
        </UFormField>
        <UFormField v-if="isPJ" label="CNPJ">
          <UInput v-model="state.cnpj" class="w-full" placeholder="00.000.000/0000-00" />
        </UFormField>
        <UFormField v-else label="CPF">
          <UInput v-model="state.cpf" class="w-full" placeholder="000.000.000-00" />
        </UFormField>
      </div>
    </section>

    <!-- Contato -->
    <section class="space-y-4">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
        Contato
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UFormField label="E-mail">
          <UInput v-model="state.email" type="email" class="w-full" placeholder="contato@exemplo.com" />
        </UFormField>
        <UFormField label="Telefone">
          <UInput v-model="state.telefone" class="w-full" placeholder="(00) 00000-0000" />
        </UFormField>
        <UFormField label="Pessoa de contato" class="sm:col-span-2">
          <UInput v-model="state.contatoNome" class="w-full" placeholder="Nome do responsável" />
        </UFormField>
      </div>
    </section>

    <!-- Endereço -->
    <section class="space-y-4">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
        Endereço
      </h3>
      <AddressForm
        v-model:cep="state.cep"
        v-model:logradouro="state.logradouro"
        v-model:numero="state.numero"
        v-model:complemento="state.complemento"
        v-model:bairro="state.bairro"
        v-model:city-code="cityCode"
        :city-initial-label="cityLabel"
      />
    </section>

    <!-- Observações -->
    <section class="space-y-4">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
        Observações
      </h3>
      <UTextarea v-model="state.observacoes" class="w-full" :rows="3" placeholder="Anotações internas sobre o cliente" />
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
