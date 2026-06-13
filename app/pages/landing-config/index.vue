<script setup lang="ts">
const toast = useToast()
const { groups, status, updateGroup, deleteGroup, createGroup, updateItem, deleteItem, createItem } = useLandingConfig('area')

const newGroupName = ref('')
const newItemLabel = reactive<Record<number, string>>({})

async function handleCreateGroup() {
  const name = newGroupName.value.trim()
  if (!name) return
  await createGroup(name)
  newGroupName.value = ''
  toast.add({ title: 'Grupo criado', color: 'success' })
}

async function handleDeleteGroup(id: number) {
  await deleteGroup(id)
  toast.add({ title: 'Grupo removido', color: 'neutral' })
}

async function handleToggleGroup(id: number, active: boolean) {
  await updateGroup(id, { active: !active })
}

async function handleCreateItem(groupId: number) {
  const label = newItemLabel[groupId]?.trim()
  if (!label) return
  await createItem(groupId, label)
  newItemLabel[groupId] = ''
  toast.add({ title: 'Item adicionado', color: 'success' })
}

async function handleDeleteItem(id: number) {
  await deleteItem(id)
  toast.add({ title: 'Item removido', color: 'neutral' })
}

async function handleToggleItem(id: number, active: boolean) {
  await updateItem(id, { active: !active })
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-lg font-semibold text-highlighted">
          Áreas de Atuação
        </h2>
        <p class="text-sm text-muted mt-0.5">
          Grupos e opções exibidos no formulário de cadastro de técnicos.
        </p>
      </div>
    </div>

    <div
      v-if="status === 'pending'"
      class="flex items-center justify-center py-16 text-muted"
    >
      <UIcon name="i-lucide-loader-circle" class="animate-spin w-6 h-6 mr-2" />
      Carregando...
    </div>

    <div v-else class="space-y-4">
      <UCard
        v-for="group in groups"
        :key="group.id"
        :ui="{ body: 'p-0' }"
      >
        <template #header>
          <div class="flex items-center justify-between gap-3 px-4 py-3">
            <span
              class="font-semibold text-sm"
              :class="group.active ? 'text-highlighted' : 'text-muted line-through'"
            >{{ group.name }}</span>
            <div class="flex items-center gap-2">
              <UToggle
                :model-value="group.active"
                size="xs"
                @update:model-value="handleToggleGroup(group.id, group.active)"
              />
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                color="error"
                variant="ghost"
                @click="handleDeleteGroup(group.id)"
              />
            </div>
          </div>
        </template>

        <ul class="divide-y divide-default">
          <li
            v-for="item in group.items"
            :key="item.id"
            class="flex items-center justify-between gap-3 px-4 py-2.5"
          >
            <span
              class="text-sm"
              :class="item.active ? 'text-default' : 'text-muted line-through'"
            >{{ item.label }}</span>
            <div class="flex items-center gap-2 shrink-0">
              <UToggle
                :model-value="item.active"
                size="xs"
                @update:model-value="handleToggleItem(item.id, item.active)"
              />
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                color="error"
                variant="ghost"
                @click="handleDeleteItem(item.id)"
              />
            </div>
          </li>
        </ul>

        <div class="flex gap-2 px-4 py-3 border-t border-default">
          <UInput
            v-model="newItemLabel[group.id]"
            size="sm"
            placeholder="Novo item..."
            class="flex-1"
            @keydown.enter="handleCreateItem(group.id)"
          />
          <UButton
            icon="i-lucide-plus"
            size="sm"
            @click="handleCreateItem(group.id)"
          >
            Adicionar
          </UButton>
        </div>
      </UCard>

      <UCard :ui="{ body: 'p-4' }">
        <div class="flex gap-2">
          <UInput
            v-model="newGroupName"
            placeholder="Nome do novo grupo..."
            class="flex-1"
            @keydown.enter="handleCreateGroup"
          />
          <UButton
            icon="i-lucide-plus"
            @click="handleCreateGroup"
          >
            Novo Grupo
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>
