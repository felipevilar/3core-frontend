<script setup lang="ts">
import type { Client } from '~/types'

definePageMeta({ permission: 'clientes.ver' })

const route = useRoute()
const { $api } = useNuxtApp()
const { can } = usePermissions()
const toast = useToast()

const canEdit = can('clientes.editar')
const canDelete = can('clientes.excluir')

const { data: cliente, error } = await useAsyncData(
  `client-${route.params.id}`,
  () => $api<Client>(`/clients/${route.params.id}`)
)

function documento(c: Client) {
  if (c.tipo === 'pj') return c.cnpj ?? '—'
  return c.cpf ?? '—'
}

function enderecoCompleto(c: Client) {
  const cidadeUf = c.city ? `${c.city.nome} • ${c.city.uf}` : null
  const linha1 = [c.logradouro, c.numero].filter(Boolean).join(', ')
  const linha2 = [c.bairro, cidadeUf].filter(Boolean).join(' • ')
  return [linha1, c.complemento, linha2, c.cep ? `CEP ${c.cep}` : null]
    .filter(Boolean)
    .join('\n')
}

// ---- Exclusão ----
const deleteOpen = ref(false)
const deleting = ref(false)

async function confirmRemove() {
  deleting.value = true
  try {
    await $api(`/clients/${route.params.id}`, { method: 'DELETE' })
    toast.add({ title: 'Cliente excluído', icon: 'i-lucide-check', color: 'success' })
    await navigateTo('/clientes')
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message ?? 'Erro ao excluir cliente', icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="cliente-detalhe">
    <template #header>
      <UDashboardNavbar :title="cliente?.nomeFantasia || cliente?.nome || 'Cliente'">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            to="/clientes"
            aria-label="Voltar para clientes"
          />
        </template>
        <template #right>
          <UButton
            v-if="cliente && canEdit"
            label="Editar"
            icon="i-lucide-pencil"
            color="neutral"
            variant="subtle"
            :to="`/clientes/${cliente.id}/editar`"
          />
          <UButton
            v-if="cliente && canDelete"
            label="Excluir"
            icon="i-lucide-trash-2"
            color="error"
            variant="subtle"
            @click="deleteOpen = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="error" class="py-16 text-center text-sm text-muted">
        Cliente não encontrado.
      </div>

      <template v-else-if="cliente">
        <!-- Cabeçalho -->
        <div class="flex items-center gap-4 mb-6">
          <UAvatar
            :icon="cliente.tipo === 'pj' ? 'i-lucide-building-2' : 'i-lucide-user'"
            size="xl"
          />
          <div>
            <h1 class="text-xl font-semibold text-highlighted flex items-center gap-2">
              {{ cliente.nomeFantasia || cliente.nome }}
              <UBadge :color="cliente.tipo === 'pj' ? 'primary' : 'neutral'" variant="subtle" size="sm">
                {{ cliente.tipo === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física' }}
              </UBadge>
              <UBadge v-if="!cliente.ativo" color="neutral" variant="subtle" size="sm">
                inativo
              </UBadge>
            </h1>
            <p v-if="cliente.nomeFantasia && cliente.tipo === 'pj'" class="text-muted text-sm">
              {{ cliente.nome }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- Identificação -->
          <UPageCard title="Identificação" variant="subtle">
            <dl class="space-y-3 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-muted">{{ cliente.tipo === 'pj' ? 'Razão social' : 'Nome' }}</dt>
                <dd class="text-highlighted text-right">{{ cliente.nome }}</dd>
              </div>
              <div v-if="cliente.tipo === 'pj'" class="flex justify-between gap-3">
                <dt class="text-muted">Nome fantasia</dt>
                <dd class="text-highlighted text-right">{{ cliente.nomeFantasia || '—' }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">{{ cliente.tipo === 'pj' ? 'CNPJ' : 'CPF' }}</dt>
                <dd class="text-highlighted text-right">{{ documento(cliente) }}</dd>
              </div>
            </dl>
          </UPageCard>

          <!-- Contato -->
          <UPageCard title="Contato" variant="subtle">
            <dl class="space-y-3 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-muted">E-mail</dt>
                <dd class="text-highlighted text-right">{{ cliente.email || '—' }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Telefone</dt>
                <dd class="text-highlighted text-right">{{ cliente.telefone || '—' }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Pessoa de contato</dt>
                <dd class="text-highlighted text-right">{{ cliente.contatoNome || '—' }}</dd>
              </div>
            </dl>
          </UPageCard>

          <!-- Endereço -->
          <UPageCard title="Endereço" variant="subtle">
            <p class="text-sm text-highlighted whitespace-pre-line">
              {{ enderecoCompleto(cliente) || '—' }}
            </p>
          </UPageCard>

          <!-- Observações -->
          <UPageCard v-if="cliente.observacoes" title="Observações" variant="subtle">
            <p class="text-sm text-highlighted whitespace-pre-line">
              {{ cliente.observacoes }}
            </p>
          </UPageCard>
        </div>
      </template>
    </template>
  </UDashboardPanel>

  <UModal
    v-model:open="deleteOpen"
    title="Excluir cliente"
    :description="`Tem certeza que deseja excluir ${cliente?.nomeFantasia || cliente?.nome}? Esta ação não pode ser desfeita.`"
  >
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton label="Cancelar" color="neutral" variant="subtle" @click="deleteOpen = false" />
        <UButton label="Excluir" color="error" icon="i-lucide-trash-2" :loading="deleting" @click="confirmRemove" />
      </div>
    </template>
  </UModal>
</template>
