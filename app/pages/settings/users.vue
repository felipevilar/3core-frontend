<script setup lang="ts">
import type { ManagedUser, Role } from '~/types'

definePageMeta({ permission: 'usuarios.ver' })

const { $api } = useNuxtApp()
const { can } = usePermissions()
const toast = useToast()

const canManage = can('usuarios.gerenciar')
const canCreate = can('usuarios.criar')

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

// ---- Criar usuário ----
const open = ref(false)
const saving = ref(false)
const form = reactive({
  name: '',
  email: '',
  password: '',
  roleId: undefined as number | undefined,
  isActive: true
})

function openCreate() {
  form.name = ''
  form.email = ''
  form.password = ''
  form.roleId = roleItems.value[0]?.value
  form.isActive = true
  open.value = true
}

async function createUser() {
  if (!form.name || !form.email || !form.password || !form.roleId) {
    toast.add({ title: 'Preencha todos os campos', icon: 'i-lucide-alert-circle', color: 'error' })
    return
  }
  saving.value = true
  try {
    await $api('/users', {
      method: 'POST',
      body: {
        name: form.name,
        email: form.email,
        password: form.password,
        roleId: form.roleId,
        isActive: form.isActive
      }
    })
    toast.add({ title: 'Usuário criado', icon: 'i-lucide-check', color: 'success' })
    open.value = false
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message ?? 'Erro ao criar usuário', icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    saving.value = false
  }
}

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
    >
      <UButton
        v-if="canCreate"
        label="Novo usuário"
        icon="i-lucide-plus"
        class="w-fit lg:ms-auto"
        @click="openCreate"
      />
    </UPageCard>

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
            <UAvatar :src="user.avatarUrl ?? undefined" :alt="user.name" size="md" />
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

    <UModal
      v-model:open="open"
      title="Novo usuário"
      description="Crie um usuário do sistema e atribua um papel."
    >
      <template #body>
        <div class="space-y-4">
          <UFormField label="Nome" name="name">
            <UInput v-model="form.name" class="w-full" placeholder="Nome completo" />
          </UFormField>
          <UFormField label="E-mail" name="email">
            <UInput
              v-model="form.email"
              type="email"
              class="w-full"
              placeholder="email@exemplo.com"
            />
          </UFormField>
          <UFormField label="Senha" name="password" hint="Mínimo 8 caracteres">
            <UInput
              v-model="form.password"
              type="password"
              class="w-full"
              placeholder="••••••••"
            />
          </UFormField>
          <UFormField label="Papel" name="roleId">
            <USelect
              v-model="form.roleId"
              :items="roleItems"
              :disabled="!roleItems.length"
              color="neutral"
              class="w-full"
              placeholder="Selecione um papel"
            />
          </UFormField>
          <UFormField name="isActive">
            <USwitch v-model="form.isActive" label="Usuário ativo" />
          </UFormField>

          <div class="flex justify-end gap-2">
            <UButton
              label="Cancelar"
              color="neutral"
              variant="subtle"
              @click="() => { open = false }"
            />
            <UButton
              label="Criar"
              color="primary"
              :loading="saving"
              @click="createUser"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
