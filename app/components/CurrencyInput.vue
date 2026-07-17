<script setup lang="ts">
const props = defineProps<{
  modelValue: number | undefined
  class?: string
  min?: number
}>()

defineEmits<{
  'update:modelValue': [value: number]
}>()
</script>

<template>
  <UInputNumber
    :model-value="props.modelValue"
    :min="props.min ?? 0"
    :step-snapping="false"
    :format-options="{
      style: 'currency',
      currency: 'BRL',
      currencyDisplay: 'symbol',
      currencySign: 'standard'
    }"
    :class="props.class"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>
