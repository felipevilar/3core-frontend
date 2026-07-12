<script setup lang="ts">
// Diálogo de confirmação global. Montar UMA vez (no layout). O estado é
// controlado pelo composable useConfirm(); telas chamam `await confirm(...)`.
const { state, _settle } = useConfirm()

const open = computed({
  get: () => state.value.open,
  // Fechar por fora (ESC / clique no backdrop) conta como cancelar.
  set: (v: boolean) => {
    if (!v) _settle(false)
  }
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="state.title"
    :description="state.message"
  >
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          :label="state.cancelLabel ?? 'Cancelar'"
          color="neutral"
          variant="subtle"
          @click="_settle(false)"
        />
        <UButton
          :label="state.confirmLabel ?? 'Confirmar'"
          :color="state.confirmColor ?? 'primary'"
          :icon="state.icon"
          @click="_settle(true)"
        />
      </div>
    </template>
  </UModal>
</template>
