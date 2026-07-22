<script setup lang="ts">
import type { ManagedUser } from '~/types'

const { $api } = useNuxtApp()
const toast = useToast()

const { recipients, status, setRecipients } = useLandingAlertRecipients()

const { data: users, status: usersStatus } = await useAsyncData('users-for-alerts', () =>
  $api<ManagedUser[]>('/users')
)

const selectedIds = computed({
  get: () => (recipients.value ?? []).map(r => r.id),
  set: () => {}
})

const saving = ref(false)

const userOptions = computed(() =>
  (users.value ?? []).map(u => ({
    label: u.name,
    value: u.id,
    description: `${u.email} · ${u.role?.name ?? ''}`
  }))
)

const pendingIds = ref<number[]>([])

watch(recipients, (val) => {
  pendingIds.value = (val ?? []).map(r => r.id)
}, { immediate: true })

async function save() {
  saving.value = true
  try {
    await setRecipients(pendingIds.value)
    toast.add({ title: 'Destinatários atualizados', icon: 'i-lucide-check', color: 'success' })
  } catch {
    toast.add({ title: 'Erro ao salvar', icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-lg font-semibold text-highlighted">
          Alertas de Cadastro
        </h2>
        <p class="text-sm text-muted mt-0.5">
          Usuários que receberão um e-mail quando um técnico se cadastrar pela landing page.
        </p>
      </div>
    </div>

    <UCard>
      <div
        v-if="status === 'pending' || usersStatus === 'pending'"
        class="flex items-center justify-center py-12 text-muted"
      >
        <UIcon name="i-lucide-loader-circle" class="animate-spin w-5 h-5 mr-2" />
        Carregando...
      </div>

      <div v-else class="space-y-5">
        <UFormField
          label="Destinatários"
          description="Selecione um ou mais usuários do sistema."
        >
          <USelectMenu
            v-model="pendingIds"
            :items="userOptions"
            value-key="value"
            multiple
            placeholder="Selecione os usuários..."
            class="w-full"
          >
            <template #item="{ item }">
              <div class="flex flex-col min-w-0">
                <span class="text-sm font-medium text-highlighted truncate">{{ item.label }}</span>
                <span class="text-xs text-muted truncate">{{ item.description }}</span>
              </div>
            </template>

            <template #label>
              <span v-if="pendingIds.length === 0" class="text-muted">
                Nenhum usuário selecionado
              </span>
              <span v-else>
                {{ pendingIds.length }} usuário{{ pendingIds.length > 1 ? 's' : '' }} selecionado{{ pendingIds.length > 1 ? 's' : '' }}
              </span>
            </template>
          </USelectMenu>
        </UFormField>

        <div v-if="pendingIds.length" class="flex flex-wrap gap-2">
          <UBadge
            v-for="id in pendingIds"
            :key="id"
            color="neutral"
            variant="subtle"
            class="flex items-center gap-1.5"
          >
            {{ userOptions.find(u => u.value === id)?.label }}
            <UButton
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="ghost"
              class="-mr-1 h-4 w-4"
              @click="pendingIds = pendingIds.filter(i => i !== id)"
            />
          </UBadge>
        </div>

        <div class="flex justify-end pt-2">
          <UButton
            label="Salvar"
            icon="i-lucide-save"
            :loading="saving"
            @click="save"
          />
        </div>
      </div>
    </UCard>
  </div>
</template>
