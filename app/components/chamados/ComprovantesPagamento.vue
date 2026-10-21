<script setup lang="ts">
import type { ChamadoComprovante } from '~/types'

/**
 * Comprovantes do repasse ao técnico de um chamado fechado. Lista, abre (URL
 * assinada), anexa e remove — reutilizado no financeiro e na página do chamado.
 */
const props = defineProps<{
  chamadoId: number
  podeGerenciar: boolean
  compact?: boolean
}>()
const emit = defineEmits<{ changed: [] }>()

const { $api } = useNuxtApp()
const toast = useToast()
const { confirm } = useConfirm()

const { data: comprovantes, refresh, pending } = useAsyncData(
  () => `chamado-${props.chamadoId}-comprovantes`,
  () => $api<ChamadoComprovante[]>(`/chamados/${props.chamadoId}/comprovantes`),
  { watch: [() => props.chamadoId] }
)

const input = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const removendo = ref<number | null>(null)

function escolherArquivo() {
  input.value?.click()
}

async function onSelecionado(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const { signedUrl, path } = await $api<{ signedUrl: string, path: string }>(
      `/chamados/${props.chamadoId}/comprovantes/upload-url`,
      { method: 'POST', body: { fileName: file.name } }
    )
    const put = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    })
    if (!put.ok) throw new Error(`upload falhou (${put.status})`)
    await $api(`/chamados/${props.chamadoId}/comprovantes`, {
      method: 'POST',
      body: {
        storagePath: path,
        fileName: file.name,
        mimeType: file.type || null,
        sizeBytes: file.size
      }
    })
    toast.add({ title: 'Comprovante anexado', icon: 'i-lucide-check', color: 'success' })
    await refresh()
    emit('changed')
  } catch (e: unknown) {
    const err = e as { data?: { message?: string }, message?: string }
    toast.add({
      title: err?.data?.message ?? err?.message ?? 'Erro ao anexar comprovante',
      icon: 'i-lucide-alert-circle',
      color: 'error'
    })
  } finally {
    uploading.value = false
    if (input.value) input.value.value = ''
  }
}

async function abrir(id: number) {
  try {
    const { signedUrl } = await $api<{ signedUrl: string }>(
      `/chamados/${props.chamadoId}/comprovantes/${id}/download-url`
    )
    window.open(signedUrl, '_blank', 'noopener')
  } catch {
    toast.add({ title: 'Erro ao abrir o comprovante', icon: 'i-lucide-alert-circle', color: 'error' })
  }
}

async function remover(c: ChamadoComprovante) {
  const ok = await confirm({
    title: 'Remover comprovante',
    message: `Remover "${c.fileName}"? Esta ação não pode ser desfeita.`,
    confirmLabel: 'Remover',
    confirmColor: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  removendo.value = c.id
  try {
    await $api(`/chamados/${props.chamadoId}/comprovantes/${c.id}`, { method: 'DELETE' })
    toast.add({ title: 'Comprovante removido', icon: 'i-lucide-check', color: 'success' })
    await refresh()
    emit('changed')
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({
      title: err?.data?.message ?? 'Erro ao remover',
      icon: 'i-lucide-alert-circle',
      color: 'error'
    })
  } finally {
    removendo.value = null
  }
}

defineExpose({ escolherArquivo, refresh })
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs font-semibold uppercase text-muted">
        Comprovantes de pagamento
        <span v-if="comprovantes?.length" class="text-dimmed">({{ comprovantes.length }})</span>
      </p>
      <UButton
        v-if="podeGerenciar"
        label="Anexar"
        icon="i-lucide-upload"
        size="xs"
        variant="subtle"
        :loading="uploading"
        @click="escolherArquivo"
      />
    </div>
    <input
      ref="input"
      type="file"
      class="hidden"
      accept="application/pdf,image/jpeg,image/png,image/webp"
      @change="onSelecionado"
    >
    <div v-if="pending" class="py-2 flex justify-center">
      <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin text-muted" />
    </div>
    <ul v-else-if="comprovantes?.length" class="divide-y divide-default text-sm">
      <li
        v-for="c in comprovantes"
        :key="c.id"
        class="flex items-center justify-between gap-2 py-1.5"
      >
        <button
          type="button"
          class="text-highlighted truncate flex items-center gap-2 hover:text-primary text-left min-w-0"
          @click="abrir(c.id)"
        >
          <UIcon name="i-lucide-receipt" class="size-4 shrink-0" />
          <span class="truncate">{{ c.fileName }}</span>
        </button>
        <span class="flex items-center gap-2 shrink-0">
          <span class="text-muted text-xs">{{ new Date(c.createdAt).toLocaleDateString('pt-BR') }}</span>
          <UButton
            v-if="podeGerenciar"
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="xs"
            :loading="removendo === c.id"
            aria-label="Remover comprovante"
            @click="remover(c)"
          />
        </span>
      </li>
    </ul>
    <p v-else class="text-xs text-muted" :class="{ 'py-1': !compact }">
      Nenhum comprovante anexado.
    </p>
  </div>
</template>
