<script setup lang="ts">
import type { ChamadoPrioridade, Client, SlaPolitica, SlaPoliticaPayload } from '~/types'

definePageMeta({ permission: 'configuracoes.ver' })

const { $api } = useNuxtApp()
const { can } = usePermissions()
const toast = useToast()
const { confirm } = useConfirm()
const { prioridadeMeta } = useChamadoDisplay()

const podeGerenciar = can('configuracoes.gerenciar')

const { data: politicas, refresh, pending } = await useAsyncData(
  'settings-sla',
  () => $api<SlaPolitica[]>('/configuracoes/sla'),
  { default: () => [] as SlaPolitica[] }
)

// Clientes para o select (opcional — quem não tem clientes.ver vê só "Todos").
const { data: clientes } = await useAsyncData(
  'settings-sla-clientes',
  () => (can('clientes.ver') ? $api<Client[]>('/clients').catch(() => [] as Client[]) : Promise.resolve([] as Client[])),
  { default: () => [] as Client[] }
)
const clienteItems = computed(() => [
  { label: 'Todos os clientes', value: 0 },
  ...(clientes.value ?? []).map(c => ({ label: c.nomeFantasia || c.nome, value: c.id }))
])
const nomeCliente = (id: number | null) => {
  if (!id) return 'Todos os clientes'
  const c = (clientes.value ?? []).find(x => x.id === id)
  return c ? (c.nomeFantasia || c.nome) : `Cliente #${id}`
}

const PRIORIDADE_TODAS = 'todas'
const prioridadeItems = [
  { label: 'Todas as prioridades', value: PRIORIDADE_TODAS },
  { label: 'Urgente', value: 'urgente' },
  { label: 'Alta', value: 'alta' },
  { label: 'Média', value: 'media' },
  { label: 'Baixa', value: 'baixa' }
]

function mensagemErro(e: unknown, fallback: string) {
  const err = e as { data?: { message?: string | string[] } }
  const msg = Array.isArray(err?.data?.message) ? err.data.message[0] : err?.data?.message
  return msg ?? fallback
}

// ---- Modal ----
const open = ref(false)
const salvando = ref(false)
const editandoId = ref<number | null>(null)
const erro = ref('')
const form = reactive({
  nome: '',
  clientId: 0,
  prioridade: PRIORIDADE_TODAS as string,
  horasPrimeiraVisita: undefined as number | undefined,
  horasConclusao: undefined as number | undefined,
  ativo: true
})

function abrir(p?: SlaPolitica) {
  editandoId.value = p?.id ?? null
  form.nome = p?.nome ?? ''
  form.clientId = p?.clientId ?? 0
  form.prioridade = p?.prioridade ?? PRIORIDADE_TODAS
  form.horasPrimeiraVisita = p?.horasPrimeiraVisita ?? undefined
  form.horasConclusao = p?.horasConclusao ?? undefined
  form.ativo = p?.ativo ?? true
  erro.value = ''
  open.value = true
}

const horaValida = (h: number | undefined) => h == null || (Number.isInteger(h) && h >= 1 && h <= 8760)

async function salvar() {
  if (form.nome.trim().length < 2) {
    erro.value = 'Informe um nome com ao menos 2 caracteres'
    return
  }
  if (!form.horasPrimeiraVisita && !form.horasConclusao) {
    erro.value = 'Informe ao menos um prazo (1ª visita ou conclusão)'
    return
  }
  if (!horaValida(form.horasPrimeiraVisita) || !horaValida(form.horasConclusao)) {
    erro.value = 'Prazos devem ser inteiros entre 1 e 8760 horas'
    return
  }
  erro.value = ''
  salvando.value = true
  try {
    const payload: SlaPoliticaPayload = {
      nome: form.nome.trim(),
      clientId: form.clientId || null,
      prioridade: form.prioridade === PRIORIDADE_TODAS ? null : (form.prioridade as ChamadoPrioridade),
      horasPrimeiraVisita: form.horasPrimeiraVisita || null,
      horasConclusao: form.horasConclusao || null,
      ativo: form.ativo
    }
    if (editandoId.value) {
      await $api(`/configuracoes/sla/${editandoId.value}`, { method: 'PATCH', body: payload })
      toast.add({ title: 'Política atualizada', icon: 'i-lucide-check', color: 'success' })
    } else {
      await $api('/configuracoes/sla', { method: 'POST', body: payload })
      toast.add({ title: 'Política criada', icon: 'i-lucide-check', color: 'success' })
    }
    open.value = false
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: mensagemErro(e, 'Erro ao salvar política'), icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    salvando.value = false
  }
}

async function alternarAtivo(p: SlaPolitica) {
  try {
    await $api(`/configuracoes/sla/${p.id}`, { method: 'PATCH', body: { ativo: !p.ativo } })
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: mensagemErro(e, 'Erro ao atualizar'), icon: 'i-lucide-alert-circle', color: 'error' })
  }
}

const removendo = ref<number | null>(null)
async function remover(p: SlaPolitica) {
  const ok = await confirm({
    title: 'Excluir política de SLA',
    message: `Excluir "${p.nome}"? Chamados já abertos mantêm os prazos calculados.`,
    confirmLabel: 'Excluir',
    confirmColor: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  removendo.value = p.id
  try {
    await $api(`/configuracoes/sla/${p.id}`, { method: 'DELETE' })
    toast.add({ title: 'Política excluída', icon: 'i-lucide-check', color: 'success' })
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: mensagemErro(e, 'Erro ao excluir'), icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    removendo.value = null
  }
}
</script>

<template>
  <UPageCard
    variant="subtle"
    :ui="{ container: 'p-0 sm:p-0', header: 'w-full' }"
  >
    <template #header>
      <div class="w-full flex items-start justify-between gap-3 p-4 sm:p-6 border-b border-default">
        <div>
          <p class="text-highlighted font-semibold">
            Políticas de SLA
          </p>
          <p class="text-muted text-sm">
            Prazos (em horas, a partir da abertura) para a 1ª visita e para a conclusão. A política mais específica
            (cliente + prioridade) prevalece sobre as gerais.
          </p>
        </div>
        <UButton
          v-if="podeGerenciar"
          label="Nova política"
          icon="i-lucide-plus"
          size="sm"
          @click="abrir()"
        />
      </div>
    </template>

    <UProgress v-if="pending" animation="carousel" size="xs" />
    <p v-if="!pending && !politicas.length" class="p-6 text-sm text-muted">
      Nenhuma política cadastrada — chamados não têm prazo de SLA.
    </p>
    <ul v-else class="divide-y divide-default">
      <li
        v-for="p in politicas"
        :key="p.id"
        class="flex flex-wrap items-start justify-between gap-3 p-4 sm:px-6 text-sm"
        :class="{ 'opacity-60': !p.ativo }"
      >
        <div class="min-w-0 space-y-1">
          <p class="text-highlighted font-medium flex items-center gap-2 flex-wrap">
            <UIcon name="i-lucide-timer" class="size-4 shrink-0" />
            {{ p.nome }}
            <UBadge
              v-if="!p.ativo"
              color="neutral"
              variant="subtle"
              size="sm"
            >
              inativa
            </UBadge>
            <UBadge
              v-if="p.prioridade"
              :color="prioridadeMeta(p.prioridade).color"
              variant="subtle"
              size="sm"
            >
              {{ prioridadeMeta(p.prioridade).label }}
            </UBadge>
          </p>
          <p class="text-xs text-muted">
            <UIcon name="i-lucide-building-2" class="size-3 inline-block" /> {{ nomeCliente(p.clientId) }}
          </p>
          <p class="text-xs text-muted flex flex-wrap gap-x-3">
            <span v-if="p.horasPrimeiraVisita">1ª visita em {{ p.horasPrimeiraVisita }} h</span>
            <span v-if="p.horasConclusao">Conclusão em {{ p.horasConclusao }} h</span>
          </p>
        </div>
        <div v-if="podeGerenciar" class="flex items-center gap-1 shrink-0">
          <USwitch :model-value="p.ativo" size="sm" @update:model-value="alternarAtivo(p)" />
          <UButton
            icon="i-lucide-pencil"
            size="xs"
            color="neutral"
            variant="ghost"
            aria-label="Editar"
            @click="abrir(p)"
          />
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            color="error"
            variant="ghost"
            aria-label="Excluir"
            :loading="removendo === p.id"
            @click="remover(p)"
          />
        </div>
      </li>
    </ul>
  </UPageCard>

  <UModal v-model:open="open" :title="editandoId ? 'Editar política de SLA' : 'Nova política de SLA'">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Nome" required :error="erro || undefined">
          <UInput v-model="form.nome" class="w-full" placeholder="Ex.: Padrão urgente" />
        </UFormField>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Cliente" help="Opcional">
            <USelect v-model="form.clientId" :items="clienteItems" class="w-full" />
          </UFormField>
          <UFormField label="Prioridade" help="Opcional">
            <USelect v-model="form.prioridade" :items="prioridadeItems" class="w-full" />
          </UFormField>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Prazo 1ª visita (horas)" help="1 a 8760">
            <UInput
              v-model.number="form.horasPrimeiraVisita"
              type="number"
              min="1"
              max="8760"
              step="1"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Prazo conclusão (horas)" help="1 a 8760">
            <UInput
              v-model.number="form.horasConclusao"
              type="number"
              min="1"
              max="8760"
              step="1"
              class="w-full"
            />
          </UFormField>
        </div>
        <USwitch v-model="form.ativo" label="Ativa" />
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
