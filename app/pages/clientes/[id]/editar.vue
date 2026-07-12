<script setup lang="ts">
import type { Client, ClientPayload } from '~/types'

definePageMeta({ permission: 'clientes.editar' })

const route = useRoute()
const { $api } = useNuxtApp()
const toast = useToast()

const { data: cliente, error } = await useAsyncData(
  `client-edit-${route.params.id}`,
  () => $api<Client>(`/clients/${route.params.id}`)
)

const submitting = ref(false)

async function salvar(payload: ClientPayload) {
  submitting.value = true
  try {
    await $api(`/clients/${route.params.id}`, { method: 'PATCH', body: payload })
    toast.add({ title: 'Cliente atualizado', icon: 'i-lucide-check', color: 'success' })
    await navigateTo(`/clientes/${route.params.id}`)
  } catch (e: unknown) {
    const err = e as { data?: { message?: string | string[] } }
    const msg = Array.isArray(err?.data?.message) ? err.data.message[0] : err?.data?.message
    toast.add({ title: msg ?? 'Erro ao atualizar cliente', icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="cliente-editar">
    <template #header>
      <UDashboardNavbar :title="cliente ? `Editar: ${cliente.nomeFantasia || cliente.nome}` : 'Editar cliente'">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            :to="`/clientes/${route.params.id}`"
            aria-label="Voltar"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="error" class="py-16 text-center text-sm text-muted">
        Cliente não encontrado.
      </div>

      <div v-else-if="cliente" class="w-full lg:max-w-3xl mx-auto">
        <ClientsClientForm
          :initial="cliente"
          submit-label="Salvar alterações"
          :submitting="submitting"
          @submit="salvar"
          @cancel="navigateTo(`/clientes/${route.params.id}`)"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
