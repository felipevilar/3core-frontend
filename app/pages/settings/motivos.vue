<script setup lang="ts">
import type { Motivo, MotivoPayload, MotivoTipo } from '~/types'

definePageMeta({ permission: 'configuracoes.ver' })

const { $api } = useNuxtApp()
const { can } = usePermissions()
const toast = useToast()
const { confirm } = useConfirm()
const { carregar: recarregarCache } = useMotivos()

const podeGerenciar = can('configuracoes.gerenciar')

const TIPOS: { value: MotivoTipo, label: string, descricao: string }[] = [
  { value: 'cancelamento', label: 'Cancelamento', descricao: 'Cancelar chamado ou visita' },
  { value: 'recusa', label: 'Recusa', descricao: 'Técnico recusa a solicitação' },
  { value: 'reabertura', label: 'Reabertura', descricao: 'Reabrir chamado fechado/cancelado' },
  { value: 'pausa', label: 'Pausa', descricao: 'Pausar o atendimento em campo' }
]
const tipo = ref<MotivoTipo>('cancelamento')
const tipoItems = TIPOS.map(t => ({ label: t.label, value: t.value }))
const tipoAtual = computed(() => TIPOS.find(t => t.value === tipo.value)!)

const { data: motivos, refresh, pending } = await useAsyncData(
  'settings-motivos',
  () => $api<Motivo[]>('/configuracoes/motivos', { params: { tipo: tipo.value, incluirInativos: 'true' } }),
  { default: () => [] as Motivo[], watch: [tipo] }
)

function mensagemErro(e: unknown, fallback: string) {
  const err = e as { data?: { message?: string | string[] } }
  const msg = Array.isArray(err?.data?.message) ? err.data.message[0] : err?.data?.message
  return msg ?? fallback
}

// Após qualquer alteração, recarrega a lista e invalida o cache usado nos modais.
async function depoisDeSalvar() {
  await refresh()
  await recarregarCache(tipo.value, true)
}

// ---- Adicionar inline ----
const novoNome = ref('')
const adicionando = ref(false)
async function adicionar() {
  const nome = novoNome.value.trim()
  if (nome.length < 2) return
  adicionando.value = true
  try {
    const ordem = (motivos.value ?? []).reduce((max, m) => Math.max(max, m.ordem), 0) + 1
    const body: MotivoPayload = { tipo: tipo.value, nome, ordem, ativo: true }
    await $api('/configuracoes/motivos', { method: 'POST', body })
    novoNome.value = ''
    await depoisDeSalvar()
  } catch (e: unknown) {
    toast.add({ title: mensagemErro(e, 'Erro ao criar motivo'), icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    adicionando.value = false
  }
}

// ---- Editar (modal) ----
const open = ref(false)
const salvando = ref(false)
const editando = ref<Motivo | null>(null)
const form = reactive({ nome: '', ordem: 0, ativo: true })
const erro = ref('')
function abrirEditar(m: Motivo) {
  editando.value = m
  form.nome = m.nome
  form.ordem = m.ordem
  form.ativo = m.ativo
  erro.value = ''
  open.value = true
}
async function salvar() {
  if (!editando.value) return
  if (form.nome.trim().length < 2) {
    erro.value = 'Informe um nome com ao menos 2 caracteres'
    return
  }
  salvando.value = true
  try {
    const body: MotivoPayload = { nome: form.nome.trim(), ordem: Number(form.ordem) || 0, ativo: form.ativo }
    await $api(`/configuracoes/motivos/${editando.value.id}`, { method: 'PATCH', body })
    toast.add({ title: 'Motivo atualizado', icon: 'i-lucide-check', color: 'success' })
    open.value = false
    await depoisDeSalvar()
  } catch (e: unknown) {
    toast.add({ title: mensagemErro(e, 'Erro ao salvar motivo'), icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    salvando.value = false
  }
}

async function alternarAtivo(m: Motivo) {
  try {
    await $api(`/configuracoes/motivos/${m.id}`, { method: 'PATCH', body: { ativo: !m.ativo } })
    await depoisDeSalvar()
  } catch (e: unknown) {
    toast.add({ title: mensagemErro(e, 'Erro ao atualizar'), icon: 'i-lucide-alert-circle', color: 'error' })
  }
}

// Reordena trocando `ordem` com o vizinho.
async function mover(m: Motivo, direcao: -1 | 1) {
  const lista = [...(motivos.value ?? [])].sort((a, b) => a.ordem - b.ordem || a.id - b.id)
  const idx = lista.findIndex(x => x.id === m.id)
  const alvo = lista[idx + direcao]
  if (!alvo) return
  try {
    await Promise.all([
      $api(`/configuracoes/motivos/${m.id}`, { method: 'PATCH', body: { ordem: alvo.ordem === m.ordem ? m.ordem + direcao : alvo.ordem } }),
      $api(`/configuracoes/motivos/${alvo.id}`, { method: 'PATCH', body: { ordem: m.ordem } })
    ])
    await depoisDeSalvar()
  } catch (e: unknown) {
    toast.add({ title: mensagemErro(e, 'Erro ao reordenar'), icon: 'i-lucide-alert-circle', color: 'error' })
  }
}

const removendo = ref<number | null>(null)
async function remover(m: Motivo) {
  const ok = await confirm({
    title: 'Excluir motivo',
    message: `Excluir "${m.nome}"? Registros antigos mantêm o texto do motivo. Se já foi usado, prefira desativar.`,
    confirmLabel: 'Excluir',
    confirmColor: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  removendo.value = m.id
  try {
    await $api(`/configuracoes/motivos/${m.id}`, { method: 'DELETE' })
    toast.add({ title: 'Motivo excluído', icon: 'i-lucide-check', color: 'success' })
    await depoisDeSalvar()
  } catch (e: unknown) {
    toast.add({ title: mensagemErro(e, 'Erro ao excluir'), icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    removendo.value = null
  }
}

const ordenados = computed(() =>
  [...(motivos.value ?? [])].sort((a, b) => a.ordem - b.ordem || a.id - b.id)
)
</script>

<template>
  <UPageCard
    variant="subtle"
    :ui="{ container: 'p-0 sm:p-0', header: 'w-full' }"
  >
    <template #header>
      <div class="w-full p-4 sm:p-6 border-b border-default space-y-3">
        <div>
          <p class="text-highlighted font-semibold">
            Catálogo de motivos
          </p>
          <p class="text-muted text-sm">
            Classificações opcionais usadas nos modais de cancelar, recusar, reabrir e pausar — além do texto livre.
          </p>
        </div>
        <UTabs
          v-model="tipo"
          :items="tipoItems"
          :content="false"
          size="sm"
        />
        <p class="text-xs text-muted">
          {{ tipoAtual.descricao }}
        </p>
      </div>
    </template>

    <UProgress v-if="pending" animation="carousel" size="xs" />
    <p v-if="!pending && !ordenados.length" class="p-6 text-sm text-muted">
      Nenhum motivo de {{ tipoAtual.label.toLowerCase() }} cadastrado.
    </p>
    <ul v-else class="divide-y divide-default">
      <li
        v-for="(m, i) in ordenados"
        :key="m.id"
        class="flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 text-sm"
        :class="{ 'opacity-60': !m.ativo }"
      >
        <span class="text-highlighted flex items-center gap-2 min-w-0">
          <span class="text-muted text-xs w-5 text-right shrink-0">{{ m.ordem }}</span>
          <span class="truncate">{{ m.nome }}</span>
          <UBadge
            v-if="!m.ativo"
            color="neutral"
            variant="subtle"
            size="sm"
          >
            inativo
          </UBadge>
        </span>
        <span v-if="podeGerenciar" class="flex items-center gap-0.5 shrink-0">
          <UButton
            icon="i-lucide-chevron-up"
            size="xs"
            color="neutral"
            variant="ghost"
            aria-label="Subir"
            :disabled="i === 0"
            @click="mover(m, -1)"
          />
          <UButton
            icon="i-lucide-chevron-down"
            size="xs"
            color="neutral"
            variant="ghost"
            aria-label="Descer"
            :disabled="i === ordenados.length - 1"
            @click="mover(m, 1)"
          />
          <USwitch
            :model-value="m.ativo"
            size="sm"
            class="mx-1"
            @update:model-value="alternarAtivo(m)"
          />
          <UButton
            icon="i-lucide-pencil"
            size="xs"
            color="neutral"
            variant="ghost"
            aria-label="Editar"
            @click="abrirEditar(m)"
          />
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            color="error"
            variant="ghost"
            aria-label="Excluir"
            :loading="removendo === m.id"
            @click="remover(m)"
          />
        </span>
      </li>
    </ul>

    <template v-if="podeGerenciar" #footer>
      <form class="flex gap-2 w-full" @submit.prevent="adicionar">
        <UInput
          v-model="novoNome"
          class="flex-1"
          :placeholder="`Novo motivo de ${tipoAtual.label.toLowerCase()}…`"
        />
        <UButton
          type="submit"
          label="Adicionar"
          icon="i-lucide-plus"
          :disabled="novoNome.trim().length < 2"
          :loading="adicionando"
        />
      </form>
    </template>
  </UPageCard>

  <UModal v-model:open="open" title="Editar motivo">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Nome" required :error="erro || undefined">
          <UInput v-model="form.nome" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-2 gap-4 items-end">
          <UFormField label="Ordem">
            <UInput
              v-model.number="form.ordem"
              type="number"
              step="1"
              class="w-full"
            />
          </UFormField>
          <USwitch v-model="form.ativo" label="Ativo" class="mb-2" />
        </div>
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            @click="open = false"
          />
          <UButton
            label="Salvar"
            icon="i-lucide-check"
            :loading="salvando"
            @click="salvar"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
