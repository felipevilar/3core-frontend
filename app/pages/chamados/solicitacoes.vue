<script setup lang="ts">
import type { Chamado, Paginated } from '~/types'

definePageMeta({ permission: 'atendimentos.ver_solicitacoes' })

const { $api } = useNuxtApp()
const toast = useToast()
const { prioridadeMeta } = useChamadoDisplay()
const { refresh: refreshCount } = useSolicitacoesCount()

const { data, pending, refresh } = await useAsyncData(
  'solicitacoes-pendentes',
  () => $api<Paginated<Chamado>>('/chamados', {
    params: { solicitacaoPendente: true, pageSize: 200 }
  })
)

const itens = computed(() => data.value?.items ?? [])

// ---- Recusar (modal de motivo) ----
const recusarOpen = ref(false)
const recusarId = ref<number | null>(null)
const recusarMotivo = ref('')

function abrirRecusar(id: number) {
  recusarId.value = id
  recusarMotivo.value = ''
  recusarOpen.value = true
}

async function acao(fn: () => Promise<unknown>, sucesso: string) {
  try {
    await fn()
    toast.add({ title: sucesso, icon: 'i-lucide-check', color: 'success' })
    await refresh()
    await refreshCount()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string | string[] } }
    const msg = Array.isArray(err?.data?.message)
      ? err.data.message[0]
      : err?.data?.message
    toast.add({
      title: msg ?? 'Erro na ação',
      icon: 'i-lucide-alert-circle',
      color: 'error'
    })
  }
}

async function aceitar(id: number) {
  await acao(
    () => $api(`/chamados/${id}/aceitar`, { method: 'POST' }),
    'Solicitação aceita!'
  )
}

async function confirmarRecusa() {
  if (!recusarId.value || recusarMotivo.value.trim().length < 3) return
  const id = recusarId.value
  recusarOpen.value = false
  await acao(
    () => $api(`/chamados/${id}/recusar`, {
      method: 'POST',
      body: { motivo: recusarMotivo.value.trim() }
    }),
    'Solicitação recusada'
  )
}
</script>

<template>
  <UDashboardPanel id="solicitacoes">
    <template #header>
      <UDashboardNavbar title="Solicitações">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UBadge
            v-if="itens.length > 0"
            :label="String(itens.length)"
            color="error"
            variant="solid"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="pending" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-circle" class="animate-spin text-2xl text-muted" />
      </div>

      <div v-else-if="itens.length === 0" class="flex flex-col items-center gap-3 py-16 text-muted">
        <UIcon name="i-lucide-inbox" class="text-4xl" />
        <p class="text-sm">
          Nenhuma solicitação pendente.
        </p>
      </div>

      <div v-else class="flex flex-col gap-3 p-4 sm:p-6">
        <UCard
          v-for="c in itens"
          :key="c.id"
          class="hover:ring-1 hover:ring-primary/30 transition"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-mono text-xs text-muted">{{ c.codigo }}</span>
                <UBadge :color="prioridadeMeta(c.prioridade).color" variant="subtle" size="xs">
                  {{ prioridadeMeta(c.prioridade).label }}
                </UBadge>
              </div>
              <p class="font-medium mt-1 truncate">
                {{ c.titulo }}
              </p>
              <p v-if="c.client" class="text-sm text-muted truncate">
                {{ c.client.nome }}
              </p>
              <div v-if="c.city || c.bairro" class="text-xs text-muted mt-0.5">
                <span v-if="c.bairro">{{ c.bairro }}<span v-if="c.city">, </span></span>
                <span v-if="c.city">{{ c.city.nome }} – {{ c.city.uf }}</span>
              </div>
              <p v-if="c.agendadoPara" class="text-xs text-muted mt-1">
                <UIcon name="i-lucide-calendar" class="inline mr-1" />
                Agendado: {{ new Date(c.agendadoPara).toLocaleString('pt-BR') }}
              </p>
            </div>

            <div class="flex flex-col sm:flex-row gap-2 shrink-0">
              <UButton
                color="success"
                variant="solid"
                icon="i-lucide-check"
                @click="aceitar(c.id)"
              >
                Aceitar
              </UButton>
              <UButton
                color="error"
                variant="outline"
                icon="i-lucide-x"
                @click="abrirRecusar(c.id)"
              >
                Recusar
              </UButton>
            </div>
          </div>

          <template #footer>
            <div class="flex gap-4 text-xs text-muted">
              <NuxtLink :to="`/chamados/${c.id}`" class="hover:text-primary flex items-center gap-1">
                <UIcon name="i-lucide-arrow-right" />
                Ver detalhes
              </NuxtLink>
              <span v-if="c.atribuidoEm">
                Atribuído em {{ new Date(c.atribuidoEm).toLocaleString('pt-BR') }}
              </span>
            </div>
          </template>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modal de recusa -->
  <UModal v-model:open="recusarOpen" title="Recusar solicitação">
    <template #body>
      <p class="text-sm text-muted mb-3">
        Informe o motivo da recusa (mínimo 3 caracteres):
      </p>
      <UTextarea
        v-model="recusarMotivo"
        class="w-full"
        placeholder="Ex.: indisponível neste período..."
        autofocus
        :rows="3"
      />
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="ghost" @click="recusarOpen = false">
          Cancelar
        </UButton>
        <UButton
          color="error"
          :disabled="recusarMotivo.trim().length < 3"
          @click="confirmarRecusa"
        >
          Confirmar recusa
        </UButton>
      </div>
    </template>
  </UModal>
</template>
