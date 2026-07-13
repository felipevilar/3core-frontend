<script setup lang="ts">
import type { TechnicianDetail, TechnicianPayload } from '~/types'

definePageMeta({ permission: 'tecnicos.gerenciar' })

const { $api } = useNuxtApp()
const toast = useToast()

const submitting = ref(false)

async function criar(payload: TechnicianPayload) {
  submitting.value = true
  try {
    const created = await $api<TechnicianDetail>('/technicians', { method: 'POST', body: payload })
    toast.add({ title: 'Técnico criado', icon: 'i-lucide-check', color: 'success' })
    await navigateTo(`/technicians/${created.id}`)
  } catch (e: unknown) {
    const err = e as { data?: { message?: string | string[] } }
    const msg = Array.isArray(err?.data?.message) ? err.data.message[0] : err?.data?.message
    toast.add({ title: msg ?? 'Erro ao criar técnico', icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="tecnico-novo">
    <template #header>
      <UDashboardNavbar title="Novo técnico">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            to="/technicians"
            aria-label="Voltar para técnicos"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="w-full lg:max-w-3xl mx-auto">
        <TechniciansTechnicianForm
          submit-label="Criar técnico"
          :submitting="submitting"
          @submit="criar"
          @cancel="navigateTo('/technicians')"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
