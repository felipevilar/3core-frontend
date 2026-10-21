<script setup lang="ts">
import type { TechnicianListItem } from '~/types'

/**
 * Seletor de técnico com busca por digitação (nome, cidade, telefone, e-mail)
 * e identificação visual: avatar, cidade/UF e celular — o e-mail sozinho não
 * basta para o gestor reconhecer o profissional.
 */
const props = withDefaults(
  defineProps<{
    tecnicos: TechnicianListItem[]
    multiple?: boolean
    placeholder?: string
    icon?: string
  }>(),
  { multiple: false, placeholder: 'Buscar técnico por nome, cidade ou telefone', icon: 'i-lucide-hard-hat' }
)
const model = defineModel<number | number[] | undefined>()

interface TecnicoOption {
  label: string
  value: number
  cidade: string
  celular: string
  email: string
  avatar?: { src?: string, alt: string }
  inativo: boolean
  /** Texto normalizado para a busca (sem acento, com telefone só em dígitos). */
  search: string
}

function semAcento(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

const items = computed<TecnicoOption[]>(() =>
  props.tecnicos.map((t) => {
    const cidade = [t.cidadeNome, t.uf].filter(Boolean).join('/')
    const celular = formatarCelular(t.celular)
    return {
      label: t.name,
      value: t.userId,
      cidade,
      celular,
      email: t.email,
      avatar: { src: t.avatarUrl ?? undefined, alt: t.name },
      inativo: !t.isActive,
      search: semAcento(`${t.name} ${cidade} ${t.celular} ${celular} ${t.email}`)
    }
  })
)

const selecionados = computed<TecnicoOption[]>(() => {
  const v = model.value
  if (v === undefined || v === null) return []
  const ids = Array.isArray(v) ? v : [v]
  return items.value.filter(i => ids.includes(i.value))
})

// Filtro local: "sao paulo" encontra "São Paulo", "9298" encontra o telefone.
const termo = ref('')
const filtrados = computed(() => {
  const q = semAcento(termo.value.trim())
  if (!q) return items.value
  const partes = q.split(/\s+/)
  return items.value.filter(i => partes.every(p => i.search.includes(p)))
})

function subtitulo(i: TecnicoOption) {
  return [i.cidade, i.celular].filter(Boolean).join(' • ') || i.email
}
</script>

<template>
  <USelectMenu
    v-model="model"
    v-model:search-term="termo"
    :items="filtrados"
    value-key="value"
    :multiple="multiple"
    ignore-filter
    :icon="icon"
    :placeholder="placeholder"
    :search-input="{ placeholder: 'Digite nome, cidade ou telefone…', icon: 'i-lucide-search' }"
    class="w-full"
  >
    <template #leading>
      <UAvatar
        v-if="!multiple && selecionados[0]"
        :src="selecionados[0].avatar?.src"
        :alt="selecionados[0].label"
        size="2xs"
      />
      <UIcon v-else :name="icon" class="size-4 text-dimmed" />
    </template>

    <template #default>
      <span v-if="!selecionados.length" class="text-dimmed truncate">{{ placeholder }}</span>
      <span v-else-if="multiple" class="truncate">
        {{ selecionados.length === 1 ? selecionados[0]!.label : `${selecionados.length} técnicos` }}
      </span>
      <span v-else class="truncate">
        {{ selecionados[0]!.label }}
        <span class="text-muted text-xs">— {{ subtitulo(selecionados[0]!) }}</span>
      </span>
    </template>

    <template #item="{ item }">
      <div class="flex items-center gap-2 min-w-0 w-full">
        <UAvatar :src="item.avatar?.src" :alt="item.label" size="xs" class="shrink-0" />
        <div class="flex flex-col min-w-0 flex-1">
          <span class="text-sm font-medium text-highlighted truncate">
            {{ item.label }}
            <UBadge v-if="item.inativo" color="neutral" variant="subtle" size="xs" class="ml-1">inativo</UBadge>
          </span>
          <span class="text-xs text-muted truncate">
            <template v-if="item.cidade"><UIcon name="i-lucide-map-pin" class="size-3 inline -mt-0.5" /> {{ item.cidade }}</template>
            <template v-if="item.cidade && item.celular"> • </template>
            <template v-if="item.celular"><UIcon name="i-lucide-phone" class="size-3 inline -mt-0.5" /> {{ item.celular }}</template>
            <template v-if="!item.cidade && !item.celular">{{ item.email }}</template>
          </span>
        </div>
      </div>
    </template>

    <template #empty>
      <span class="text-sm text-muted">Nenhum técnico encontrado para "{{ termo }}"</span>
    </template>
  </USelectMenu>
</template>
