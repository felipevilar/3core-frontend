<script setup lang="ts">
import type { CityRef } from '~/types'

const props = defineProps<{
  modelValue: number | null
  // Rótulo inicial (ex.: cidade já selecionada ao editar).
  initialLabel?: string | null
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [code: number | null]
}>()

const { $api } = useNuxtApp()

const query = ref(props.initialLabel ?? '')
const suggestions = ref<CityRef[]>([])
const open = ref(false)
const activeIndex = ref(-1)
let timer: ReturnType<typeof setTimeout> | null = null

watch(() => props.initialLabel, (v) => {
  if (v && !query.value) query.value = v
})

async function onInput() {
  if (timer) clearTimeout(timer)
  // Digitar invalida a seleção anterior.
  emit('update:modelValue', null)
  const term = query.value.trim()
  if (term.length < 2) {
    suggestions.value = []
    open.value = false
    return
  }
  timer = setTimeout(async () => {
    try {
      suggestions.value = await $api<CityRef[]>('/cities/search', { params: { q: term } })
      open.value = suggestions.value.length > 0
      activeIndex.value = -1
    } catch {
      suggestions.value = []
    }
  }, 250)
}

function select(city: CityRef) {
  query.value = `${city.nome} / ${city.uf}`
  emit('update:modelValue', city.code)
  open.value = false
  suggestions.value = []
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, suggestions.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    const s = suggestions.value[activeIndex.value]
    if (s) {
      e.preventDefault()
      select(s)
    }
  } else if (e.key === 'Escape') {
    open.value = false
  }
}

function onBlur() {
  // Atraso para permitir o clique na sugestão.
  setTimeout(() => { open.value = false }, 150)
}

function clear() {
  query.value = ''
  emit('update:modelValue', null)
  suggestions.value = []
  open.value = false
}
</script>

<template>
  <div class="relative">
    <UInput
      v-model="query"
      icon="i-lucide-map-pin"
      :placeholder="placeholder ?? 'Digite a cidade'"
      :disabled="disabled"
      autocomplete="off"
      class="w-full"
      @input="onInput"
      @keydown="onKeydown"
      @blur="onBlur"
    >
      <template v-if="query" #trailing>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="link"
          size="xs"
          aria-label="Limpar cidade"
          @click="clear"
        />
      </template>
    </UInput>

    <ul
      v-if="open"
      class="absolute z-50 left-0 right-0 mt-1 bg-default border border-default rounded-lg shadow-lg max-h-56 overflow-y-auto"
    >
      <li
        v-for="(s, i) in suggestions"
        :key="s.code"
        class="px-3 py-2 text-sm cursor-pointer"
        :class="i === activeIndex ? 'bg-elevated' : 'hover:bg-elevated/50'"
        @mousedown.prevent="select(s)"
      >
        {{ s.nome }} <span class="text-muted">/ {{ s.uf }}</span>
      </li>
    </ul>
  </div>
</template>
