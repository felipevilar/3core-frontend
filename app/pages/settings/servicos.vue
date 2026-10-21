<script setup lang="ts">
import type { Servico, ServicoPayload } from '~/types'

definePageMeta({ permission: 'servicos.ver' })

const { $api } = useNuxtApp()
const { can } = usePermissions()
const toast = useToast()
const { confirm } = useConfirm()
const { brl } = useChamadoDisplay()

const podeGerenciar = can('servicos.gerenciar')

const { data: servicos, refresh, pending } = await useAsyncData(
  'settings-servicos',
  () => $api<Servico[]>('/servicos', { params: { incluirInativos: 'true' } }),
  { default: () => [] as Servico[] }
)

function mensagemErro(e: unknown, fallback: string) {
  const err = e as { data?: { message?: string | string[] } }
  const msg = Array.isArray(err?.data?.message) ? err.data.message[0] : err?.data?.message
  return msg ?? fallback
}

// ---- Modal criar/editar ----
const open = ref(false)
const salvando = ref(false)
const editandoId = ref<number | null>(null)
const erro = ref('')
const form = reactive({
  nome: '',
  descricao: '',
  duracaoPadraoMin: undefined as number | undefined,
  valorSugeridoCliente: undefined as number | undefined,
  ativo: true
})

function abrir(sv?: Servico) {
  editandoId.value = sv?.id ?? null
  form.nome = sv?.nome ?? ''
  form.descricao = sv?.descricao ?? ''
  form.duracaoPadraoMin = sv?.duracaoPadraoMin ?? undefined
  form.valorSugeridoCliente = sv?.valorSugeridoCliente != null ? Number(sv.valorSugeridoCliente) : undefined
  form.ativo = sv?.ativo ?? true
  erro.value = ''
  open.value = true
}

async function salvar() {
  if (form.nome.trim().length < 2) {
    erro.value = 'Informe um nome com ao menos 2 caracteres'
    return
  }
  if (form.duracaoPadraoMin != null && (form.duracaoPadraoMin < 5 || form.duracaoPadraoMin > 1440)) {
    erro.value = 'Duração deve estar entre 5 e 1440 minutos'
    return
  }
  erro.value = ''
  salvando.value = true
  try {
    // Valor em string canônica ("350.00"); a API também aceita formato BR.
    const payload: ServicoPayload = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      duracaoPadraoMin: form.duracaoPadraoMin || null,
      valorSugeridoCliente: form.valorSugeridoCliente != null ? form.valorSugeridoCliente.toFixed(2) : null,
      ativo: form.ativo
    }
    if (editandoId.value) {
      await $api(`/servicos/${editandoId.value}`, { method: 'PATCH', body: payload })
      toast.add({ title: 'Serviço atualizado', icon: 'i-lucide-check', color: 'success' })
    } else {
      // Na criação, campos null não são aceitos — omitimos.
      const body: ServicoPayload = { nome: payload.nome, ativo: payload.ativo }
      if (payload.descricao) body.descricao = payload.descricao
      if (payload.duracaoPadraoMin) body.duracaoPadraoMin = payload.duracaoPadraoMin
      if (payload.valorSugeridoCliente) body.valorSugeridoCliente = payload.valorSugeridoCliente
      await $api('/servicos', { method: 'POST', body })
      toast.add({ title: 'Serviço criado', icon: 'i-lucide-check', color: 'success' })
    }
    open.value = false
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: mensagemErro(e, 'Erro ao salvar serviço'), icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    salvando.value = false
  }
}

async function alternarAtivo(sv: Servico) {
  try {
    await $api(`/servicos/${sv.id}`, { method: 'PATCH', body: { ativo: !sv.ativo } })
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: mensagemErro(e, 'Erro ao atualizar'), icon: 'i-lucide-alert-circle', color: 'error' })
  }
}

const removendo = ref<number | null>(null)
async function remover(sv: Servico) {
  const ok = await confirm({
    title: 'Excluir serviço',
    message: `Excluir "${sv.nome}"? Chamados já vinculados mantêm o título; se houver vínculo, prefira desativar.`,
    confirmLabel: 'Excluir',
    confirmColor: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  removendo.value = sv.id
  try {
    await $api(`/servicos/${sv.id}`, { method: 'DELETE' })
    toast.add({ title: 'Serviço excluído', icon: 'i-lucide-check', color: 'success' })
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: mensagemErro(e, 'Erro ao excluir serviço'), icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    removendo.value = null
  }
}
</script>

<template>
  <UPageCard
    title="Catálogo de serviços"
    description="Serviços padronizam o título do chamado, a duração prevista da visita e o valor sugerido ao cliente."
    variant="subtle"
    :ui="{ container: 'p-0 sm:p-0', header: 'p-4 sm:p-6 w-full' }"
  >
    <template #header>
      <div class="w-full flex items-start justify-between gap-3 p-4 sm:p-6 border-b border-default">
        <div>
          <p class="text-highlighted font-semibold">
            Catálogo de serviços
          </p>
          <p class="text-muted text-sm">
            Serviços padronizam o título do chamado, a duração prevista e o valor sugerido ao cliente.
          </p>
        </div>
        <UButton
          v-if="podeGerenciar"
          label="Novo serviço"
          icon="i-lucide-plus"
          size="sm"
          @click="abrir()"
        />
      </div>
    </template>

    <UProgress v-if="pending" animation="carousel" size="xs" />
    <p v-if="!pending && !servicos.length" class="p-6 text-sm text-muted">
      Nenhum serviço cadastrado.
    </p>
    <ul v-else class="divide-y divide-default">
      <li
        v-for="sv in servicos"
        :key="sv.id"
        class="flex flex-wrap items-start justify-between gap-3 p-4 sm:px-6 text-sm"
        :class="{ 'opacity-60': !sv.ativo }"
      >
        <div class="min-w-0">
          <p class="text-highlighted font-medium flex items-center gap-2">
            <UIcon name="i-lucide-wrench" class="size-4 shrink-0" />
            {{ sv.nome }}
            <UBadge
              v-if="!sv.ativo"
              color="neutral"
              variant="subtle"
              size="sm"
            >
              inativo
            </UBadge>
          </p>
          <p v-if="sv.descricao" class="text-muted text-xs whitespace-pre-line">
            {{ sv.descricao }}
          </p>
          <p class="text-xs text-muted mt-1 flex flex-wrap gap-x-3">
            <span v-if="sv.duracaoPadraoMin"><UIcon name="i-lucide-timer" class="size-3 inline-block" /> {{ sv.duracaoPadraoMin }} min</span>
            <span v-if="sv.valorSugeridoCliente"><UIcon name="i-lucide-circle-dollar-sign" class="size-3 inline-block" /> {{ brl(sv.valorSugeridoCliente) }} sugerido</span>
          </p>
        </div>
        <div v-if="podeGerenciar" class="flex items-center gap-1 shrink-0">
          <USwitch :model-value="sv.ativo" size="sm" @update:model-value="alternarAtivo(sv)" />
          <UButton
            icon="i-lucide-pencil"
            size="xs"
            color="neutral"
            variant="ghost"
            aria-label="Editar"
            @click="abrir(sv)"
          />
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            color="error"
            variant="ghost"
            aria-label="Excluir"
            :loading="removendo === sv.id"
            @click="remover(sv)"
          />
        </div>
      </li>
    </ul>
  </UPageCard>

  <UModal v-model:open="open" :title="editandoId ? 'Editar serviço' : 'Novo serviço'">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Nome" required :error="erro || undefined">
          <UInput v-model="form.nome" class="w-full" placeholder="Ex.: Instalação de roteador" />
        </UFormField>
        <UFormField label="Descrição">
          <UTextarea v-model="form.descricao" class="w-full" :rows="2" />
        </UFormField>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Duração padrão (min)" help="5 a 1440">
            <UInput
              v-model.number="form.duracaoPadraoMin"
              type="number"
              min="5"
              max="1440"
              step="5"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Valor sugerido ao cliente">
            <CurrencyInput v-model="form.valorSugeridoCliente" class="w-full" />
          </UFormField>
        </div>
        <USwitch v-model="form.ativo" label="Ativo" />
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            @click="open = false"
          />
          <UButton
            :label="editandoId ? 'Salvar' : 'Criar'"
            icon="i-lucide-check"
            :loading="salvando"
            @click="salvar"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
