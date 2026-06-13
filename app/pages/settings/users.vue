<script setup lang="ts">
import type { ManagedUser, Role } from '~/types'

definePageMeta({ permission: 'usuarios.ver' })

const { $api } = useNuxtApp()
const { can } = usePermissions()
const toast = useToast()

const canManage = can('usuarios.gerenciar')

const { data: users, refresh } = await useAsyncData('users', () => $api<ManagedUser[]>('/users'))
const { data: roles } = await useAsyncData('roles-for-users', () =>
  can('roles.ver') ? $api<Role[]>('/roles') : Promise.resolve([] as Role[])
)

const roleItems = computed(() =>
  (roles.value ?? []).map(r => ({ label: r.name, value: r.id }))
)

const q = ref('')
const filtered = computed(() =>
  (users.value ?? []).filter(u =>
    u.name.toLowerCase().includes(q.value.toLowerCase())
    || u.email.toLowerCase().includes(q.value.toLowerCase())
  )
)

async function changeRole(user: ManagedUser, roleId: number) {
  try {
    await $api(`/users/${user.id}`, { method: 'PATCH', body: { roleId } })
    toast.add({ title: 'Papel atualizado', icon: 'i-lucide-check', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Erro ao atualizar papel', icon: 'i-lucide-alert-circle', color: 'error' })
  }
}

async function toggleActive(user: ManagedUser, isActive: boolean) {
  try {
    await $api(`/users/${user.id}`, { method: 'PATCH', body: { isActive } })
    toast.add({ title: isActive ? 'Usuário ativado' : 'Usuário desativado', icon: 'i-lucide-check', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Erro ao atualizar usuário', icon: 'i-lucide-alert-circle', color: 'error' })
  }
}
</script>

<template>
  <div>
    <UPageCard
      title="Usuários"
      description="Gerencie os usuários, seus papéis e o status de acesso."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    />

    <UPageCard variant="subtle" :ui="{ container: 'p-0 sm:p-0 gap-y-0', wrapper: 'items-stretch', header: 'p-4 mb-0 border-b border-default' }">
      <template #header>
        <UInput
          v-model="q"
          icon="i-lucide-search"
          placeholder="Buscar usuários"
          class="w-full"
        />
      </template>

      <ul role="list" class="divide-y divide-default">
        <li
          v-for="user in filtered"
          :key="user.id"
          class="flex items-center justify-between gap-3 py-3 px-4 sm:px-6"
        >
          <div class="flex items-center gap-3 min-w-0">
            <UAvatar :alt="user.name" size="md" />
            <div class="text-sm min-w-0">
              <p class="text-highlighted font-medium truncate">
                {{ user.name }}
                <UBadge v-if="!user.isActive" color="neutral" variant="subtle" size="sm" class="ml-1">
                  inativo
                </UBadge>
              </p>
              <p class="text-muted truncate">
                {{ user.email }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <USelect
              :model-value="user.role?.id"
              :items="roleItems"
              :disabled="!canManage || !roleItems.length"
              color="neutral"
              class="min-w-40"
              @update:model-value="(v: number) => changeRole(user, v)"
            />
            <USwitch
              :model-value="user.isActive"
              :disabled="!canManage"
              @update:model-value="(v: boolean) => toggleActive(user, v)"
            />
          </div>
        </li>
        <li v-if="!filtered.length" class="py-8 text-center text-sm text-muted">
          Nenhum usuário encontrado.
        </li>
      </ul>
    </UPageCard>
  </div>
</template>
