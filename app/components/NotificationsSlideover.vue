<script setup lang="ts">
import { formatTimeAgo } from '@vueuse/core'
import type { Notificacao } from '~/types'

const { isNotificationsSlideoverOpen } = useDashboard()
const { items, loading, count, carregar, marcarLida, marcarTodas } = useNotificacoes()

// Carrega a lista sempre que o painel abre (a contagem já vem do polling do layout).
watch(isNotificationsSlideoverOpen, (aberto) => {
  if (aberto) carregar()
})

const ICONE: Record<string, string> = {
  chamado_atribuido: 'i-lucide-user-plus',
  solicitacao: 'i-lucide-inbox',
  comentario: 'i-lucide-message-square',
  sla_violado: 'i-lucide-timer-off',
  finalizado: 'i-lucide-check-check',
  cancelado: 'i-lucide-x-circle'
}
const icone = (tipo: string) => ICONE[tipo] ?? 'i-lucide-bell'

async function abrir(n: Notificacao) {
  await marcarLida(n.id)
  if (n.link) {
    isNotificationsSlideoverOpen.value = false
    await navigateTo(n.link)
  }
}
</script>

<template>
  <USlideover
    v-model:open="isNotificationsSlideoverOpen"
    title="Notificações"
    :description="count ? `${count} não ${count === 1 ? 'lida' : 'lidas'}` : 'Tudo em dia'"
  >
    <template #body>
      <UProgress
        v-if="loading && !items.length"
        animation="carousel"
        size="xs"
        class="mb-3"
      />

      <p v-if="!loading && !items.length" class="py-10 text-center text-sm text-muted">
        <UIcon name="i-lucide-bell-off" class="size-6 mx-auto mb-2 text-dimmed" />
        Nenhuma notificação.
      </p>

      <button
        v-for="n in items"
        :key="n.id"
        type="button"
        class="w-full text-left px-3 py-2.5 rounded-md hover:bg-elevated/50 flex items-start gap-3 relative -mx-3 first:-mt-3 last:-mb-3"
        :class="{ 'opacity-70': n.lidaEm }"
        @click="abrir(n)"
      >
        <UChip color="error" :show="!n.lidaEm" inset>
          <UAvatar :icon="icone(n.tipo)" size="md" />
        </UChip>

        <div class="text-sm flex-1 min-w-0">
          <p class="flex items-center justify-between gap-2">
            <span class="text-highlighted font-medium truncate">{{ n.titulo }}</span>
            <time
              :datetime="n.createdAt"
              class="text-muted text-xs shrink-0"
              v-text="formatTimeAgo(new Date(n.createdAt))"
            />
          </p>
          <p v-if="n.corpo" class="text-dimmed whitespace-pre-line break-words">
            {{ n.corpo }}
          </p>
          <p v-if="n.link" class="text-xs text-primary mt-0.5">
            Abrir
          </p>
        </div>
      </button>
    </template>

    <template #footer>
      <div class="flex justify-between items-center w-full gap-2">
        <UButton
          label="Atualizar"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="ghost"
          size="sm"
          :loading="loading"
          @click="carregar()"
        />
        <UButton
          label="Marcar todas como lidas"
          icon="i-lucide-check-check"
          color="neutral"
          variant="subtle"
          size="sm"
          :disabled="!count"
          @click="marcarTodas"
        />
      </div>
    </template>
  </USlideover>
</template>
