<script setup lang="ts">
import type { Chamado, Client, CreateChamadoPayload } from '~/types'

definePageMeta({ permission: 'atendimentos.criar' })

const { $api } = useNuxtApp()
const toast = useToast()

const { data: clients } = await useAsyncData('clients-for-chamado', () =>
  $api<Client[]>('/clients')
)

const clientItems = computed(() =>
  (clients.value ?? [])
    .filter(c => c.ativo)
    .map(c => ({ label: c.nomeFantasia || c.nome, value: c.id }))
)

const state = reactive({
  clientId: undefined as number | undefined,
  titulo: '',
  descricao: '',
  prioridade: 'media' as CreateChamadoPayload['prioridade'],
  agendadoPara: '' as string
})

const prioridadeItems = [
  { label: 'Baixa', value: 'baixa' },
  { label: 'Média', value: 'media' },
  { label: 'Alta', value: 'alta' },
  { label: 'Urgente', value: 'urgente' }
]

const submitting = ref(false)
const errors = reactive<{ clientId?: string, titulo?: string }>({})

async function salvar() {
  errors.clientId = state.clientId ? undefined : 'Selecione o cliente'
  errors.titulo = state.titulo.trim().length >= 2 ? undefined : 'Informe o título'
  if (errors.clientId || errors.titulo) return

  submitting.value = true
  try {
    const payload: CreateChamadoPayload = {
      clientId: state.clientId!,
      titulo: state.titulo.trim(),
      descricao: state.descricao.trim() || null,
      prioridade: state.prioridade,
      agendadoPara: state.agendadoPara ? new Date(state.agendadoPara).toISOString() : null
    }
    const created = await $api<Chamado>('/chamados', { method: 'POST', body: payload })
    toast.add({ title: 'Chamado criado', icon: 'i-lucide-check', color: 'success' })
    await navigateTo(`/chamados/${created.id}`)
  } catch (e: unknown) {
    const err = e as { data?: { message?: string | string[] } }
    const msg = Array.isArray(err?.data?.message) ? err.data.message[0] : err?.data?.message
    toast.add({ title: msg ?? 'Erro ao criar chamado', icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="chamado-novo">
    <template #header>
      <UDashboardNavbar title="Novo chamado">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            to="/chamados"
            aria-label="Voltar"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="w-full lg:max-w-2xl mx-auto">
        <form class="space-y-4" @submit.prevent="salvar">
          <UFormField label="Cliente" required :error="errors.clientId">
            <USelect
              v-model="state.clientId"
              :items="clientItems"
              placeholder="Selecione o cliente"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Título" required :error="errors.titulo">
            <UInput v-model="state.titulo" class="w-full" placeholder="Ex.: Instalação de equipamento" />
          </UFormField>

          <UFormField label="Descrição">
            <UTextarea v-model="state.descricao" class="w-full" :rows="4" placeholder="Detalhes do atendimento" />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Prioridade">
              <USelect v-model="state.prioridade" :items="prioridadeItems" class="w-full" />
            </UFormField>
            <UFormField label="Agendado para" help="Opcional">
              <UInput v-model="state.agendadoPara" type="datetime-local" class="w-full" />
            </UFormField>
          </div>

          <p class="text-xs text-muted">
            O endereço e a cidade são copiados do cliente ao criar. O técnico é atribuído depois, na ficha do chamado.
          </p>

          <div class="flex justify-end gap-2 border-t border-default pt-4">
            <UButton label="Cancelar" color="neutral" variant="subtle" @click="navigateTo('/chamados')" />
            <UButton type="submit" label="Criar chamado" icon="i-lucide-check" :loading="submitting" />
          </div>
        </form>
      </div>
    </template>
  </UDashboardPanel>
</template>
