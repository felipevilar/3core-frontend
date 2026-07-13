<script setup lang="ts">
import type { TechnicianDetail, TechnicianPayload } from '~/types'

definePageMeta({ permission: 'tecnicos.gerenciar' })

const route = useRoute()
const { $api } = useNuxtApp()
const toast = useToast()

const { data: ficha, error } = await useAsyncData(
  `technician-edit-${route.params.id}`,
  () => $api<TechnicianDetail>(`/technicians/${route.params.id}`)
)

const submitting = ref(false)

async function salvar(payload: TechnicianPayload) {
  submitting.value = true
  try {
    await $api(`/technicians/${route.params.id}`, { method: 'PATCH', body: payload })
    toast.add({ title: 'Técnico atualizado', icon: 'i-lucide-check', color: 'success' })
    await navigateTo(`/technicians/${route.params.id}`)
  } catch (e: unknown) {
    const err = e as { data?: { message?: string | string[] } }
    const msg = Array.isArray(err?.data?.message) ? err.data.message[0] : err?.data?.message
    toast.add({ title: msg ?? 'Erro ao atualizar técnico', icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="tecnico-editar">
    <template #header>
      <UDashboardNavbar :title="ficha ? `Editar: ${ficha.user.name}` : 'Editar técnico'">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            :to="`/technicians/${route.params.id}`"
            aria-label="Voltar"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="error" class="py-16 text-center text-sm text-muted">
        Técnico não encontrado.
      </div>

      <div v-else-if="ficha" class="w-full lg:max-w-3xl mx-auto">
        <TechniciansTechnicianForm
          :initial="ficha"
          submit-label="Salvar alterações"
          :submitting="submitting"
          @submit="salvar"
          @cancel="navigateTo(`/technicians/${route.params.id}`)"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
