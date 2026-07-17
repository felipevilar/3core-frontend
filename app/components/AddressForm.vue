<script setup lang="ts">
const props = defineProps<{
  cityInitialLabel?: string
}>()

const cep = defineModel<string>('cep', { default: '' })
const logradouro = defineModel<string>('logradouro', { default: '' })
const numero = defineModel<string>('numero', { default: '' })
const complemento = defineModel<string>('complemento', { default: '' })
const bairro = defineModel<string>('bairro', { default: '' })
const cityCode = defineModel<number | null>('cityCode', { default: null })

const cepLoading = ref(false)

async function buscarCep() {
  const cepLimpo = cep.value.replace(/\D/g, '')
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
      if (data.logradouro) logradouro.value = data.logradouro
      if (data.bairro) bairro.value = data.bairro
      if (data.ibge) cityCode.value = Number(data.ibge)
    }
  } catch {
    // CEP não localizado — preenchimento manual.
  } finally {
    cepLoading.value = false
  }
}
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-6 gap-4">
    <UFormField label="CEP" class="sm:col-span-2">
      <UInput
        v-model="cep"
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
      <UInput v-model="logradouro" class="w-full" />
    </UFormField>
    <UFormField label="Número" class="sm:col-span-1">
      <UInput v-model="numero" class="w-full" />
    </UFormField>
    <UFormField label="Complemento" class="sm:col-span-3">
      <UInput v-model="complemento" class="w-full" />
    </UFormField>
    <UFormField label="Bairro" class="sm:col-span-3">
      <UInput v-model="bairro" class="w-full" />
    </UFormField>
    <UFormField label="Cidade" class="sm:col-span-3" help="Busque pelo nome e selecione o município">
      <CityAutocomplete
        v-model="cityCode"
        :initial-label="cityInitialLabel ?? ''"
        placeholder="Ex.: Manaus"
      />
    </UFormField>
  </div>
</template>
