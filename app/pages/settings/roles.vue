<script setup lang="ts">
import type { PermissionGroup, Role } from '~/types'

definePageMeta({ permission: 'roles.ver' })

const { $api } = useNuxtApp()
const { can } = usePermissions()
const toast = useToast()
const { confirm } = useConfirm()

const canManage = can('roles.gerenciar')

const { data: roles, refresh } = await useAsyncData('roles', () => $api<Role[]>('/roles'))
const { data: permissionGroups } = await useAsyncData('permission-groups', () =>
  $api<PermissionGroup[]>('/permissions')
)

// Permissões que o super_admin não pode perder (piso espelhado no backend):
// sem elas ninguém reconcede acesso pela UI. Ficam travadas marcadas.
const SUPER_ADMIN_REQUIRED_KEYS = ['roles.ver', 'roles.gerenciar']

// ---- Editor (criar/editar) ----
const open = ref(false)
const editingId = ref<number | null>(null)
// `lockName`: papéis de sistema (ex.: tecnico, super_admin) têm o nome travado,
// mas as permissões continuam editáveis.
const lockName = ref(false)
// `lockedKeys`: permissões que não podem ser desmarcadas (super_admin).
const lockedKeys = ref<Set<string>>(new Set())
const form = reactive({
  name: '',
  description: '',
  permissionKeys: new Set<string>()
})

function openCreate() {
  editingId.value = null
  lockName.value = false
  lockedKeys.value = new Set()
  form.name = ''
  form.description = ''
  form.permissionKeys = new Set()
  open.value = true
}

function openEdit(role: Role) {
  editingId.value = role.id
  lockName.value = role.isSystem
  // super_admin: mantém o piso de permissões travado marcado.
  lockedKeys.value = role.name === 'super_admin'
    ? new Set(SUPER_ADMIN_REQUIRED_KEYS)
    : new Set()
  form.name = role.name
  form.description = role.description ?? ''
  form.permissionKeys = new Set(role.permissions.map(p => p.key))
  open.value = true
}

function togglePermission(key: string, checked: boolean | 'indeterminate') {
  // Permissões travadas (piso do super_admin) não podem ser desmarcadas.
  if (lockedKeys.value.has(key)) return
  if (checked === true) form.permissionKeys.add(key)
  else form.permissionKeys.delete(key)
  // força reatividade do Set
  form.permissionKeys = new Set(form.permissionKeys)
}

async function save() {
  const body = {
    name: form.name,
    description: form.description || undefined,
    permissionKeys: [...form.permissionKeys]
  }
  try {
    if (editingId.value) {
      await $api(`/roles/${editingId.value}`, { method: 'PATCH', body })
    } else {
      await $api('/roles', { method: 'POST', body })
    }
    toast.add({ title: 'Papel salvo', icon: 'i-lucide-check', color: 'success' })
    open.value = false
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message ?? 'Erro ao salvar papel', icon: 'i-lucide-alert-circle', color: 'error' })
  }
}

async function remove(role: Role) {
  const ok = await confirm({
    title: 'Excluir papel',
    message: `Excluir o papel "${role.name}"? Esta ação não pode ser desfeita.`,
    confirmLabel: 'Excluir',
    confirmColor: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  try {
    await $api(`/roles/${role.id}`, { method: 'DELETE' })
    toast.add({ title: 'Papel excluído', icon: 'i-lucide-check', color: 'success' })
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message ?? 'Erro ao excluir papel', icon: 'i-lucide-alert-circle', color: 'error' })
  }
}
</script>

<template>
  <div>
    <UPageCard
      title="Papéis"
      description="Crie papéis customizados e defina o que cada um pode ver e acessar."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        v-if="canManage"
        label="Novo papel"
        icon="i-lucide-plus"
        class="w-fit lg:ms-auto"
        @click="openCreate"
      />
    </UPageCard>

    <UPageCard variant="subtle" :ui="{ container: 'p-0 sm:p-0 gap-y-0' }">
      <ul role="list" class="divide-y divide-default">
        <li
          v-for="role in roles ?? []"
          :key="role.id"
          class="flex items-center justify-between gap-3 py-3 px-4 sm:px-6"
        >
          <div class="min-w-0">
            <p class="text-highlighted font-medium truncate flex items-center gap-2">
              {{ role.name }}
              <UBadge v-if="role.isSystem" color="neutral" variant="subtle" size="sm">
                sistema
              </UBadge>
            </p>
            <p class="text-muted text-sm truncate">
              {{ role.description || `${role.permissions.length} permissões` }}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <UButton
              :label="canManage ? 'Editar' : 'Ver'"
              color="neutral"
              variant="subtle"
              size="sm"
              @click="openEdit(role)"
            />
            <UButton
              v-if="canManage && !role.isSystem"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              @click="remove(role)"
            />
          </div>
        </li>
      </ul>
    </UPageCard>

    <UModal
      v-model:open="open"
      :title="editingId ? 'Editar papel' : 'Novo papel'"
      :description="!canManage ? 'Somente leitura' : lockName ? 'Papel de sistema — nome fixo, permissões editáveis' : 'Defina o nome e as permissões deste papel'"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField label="Nome" name="name">
            <UInput
              v-model="form.name"
              :disabled="!canManage || lockName"
              class="w-full"
              placeholder="ex.: supervisor"
            />
          </UFormField>
          <UFormField label="Descrição" name="description">
            <UInput
              v-model="form.description"
              :disabled="!canManage"
              class="w-full"
              placeholder="Opcional"
            />
          </UFormField>

          <div>
            <p class="text-sm font-medium mb-2">
              Permissões
            </p>
            <div class="space-y-4 max-h-80 overflow-y-auto pr-1">
              <div v-for="group in permissionGroups ?? []" :key="group.feature">
                <p class="text-xs font-semibold uppercase text-muted mb-1">
                  {{ group.label }}
                </p>
                <div class="space-y-1.5 pl-1">
                  <UCheckbox
                    v-for="perm in group.permissions"
                    :key="perm.key"
                    :model-value="form.permissionKeys.has(perm.key)"
                    :label="perm.label"
                    :disabled="!canManage || lockedKeys.has(perm.key)"
                    @update:model-value="(v: boolean | 'indeterminate') => togglePermission(perm.key, v)"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <UButton
              label="Fechar"
              color="neutral"
              variant="subtle"
              @click="() => { open = false }"
            />
            <UButton
              v-if="canManage"
              label="Salvar"
              color="primary"
              @click="save"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
