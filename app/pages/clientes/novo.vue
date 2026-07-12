<script setup lang="ts">
import type { Client, ClientPayload } from '~/types'

definePageMeta({ permission: 'clientes.criar' })

const { $api } = useNuxtApp()
const toast = useToast()

const submitting = ref(false)

async function criar(payload: ClientPayload) {
  submitting.value = true
  try {
    const created = await $api<Client>('/clients', { method: 'POST', body: payload })
    toast.add({ title: 'Cliente criado', icon: 'i-lucide-check', color: 'success' })
    await navigateTo(`/clientes/${created.id}`)
  } catch (e: unknown) {
    const err = e as { data?: { message?: string | string[] } }
    const msg = Array.isArray(err?.data?.message) ? err.data.message[0] : err?.data?.message
    toast.add({ title: msg ?? 'Erro ao criar cliente', icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="cliente-novo">
    <template #header>
      <UDashboardNavbar title="Novo cliente">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            to="/clientes"
            aria-label="Voltar para clientes"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="w-full lg:max-w-3xl mx-auto">
        <ClientsClientForm
          submit-label="Criar cliente"
          :submitting="submitting"
          @submit="criar"
          @cancel="navigateTo('/clientes')"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
