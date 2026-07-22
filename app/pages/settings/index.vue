<script setup lang="ts">
const { user, updateProfile, uploadAvatar } = useAuth()
const toast = useToast()

const fileRef = ref<HTMLInputElement>()
const bio = ref(user.value?.bio ?? '')
const savingBio = ref(false)
const uploadingAvatar = ref(false)

watch(() => user.value?.bio, (val) => {
  bio.value = val ?? ''
})

async function onSubmit() {
  savingBio.value = true
  try {
    await updateProfile(bio.value)
    toast.add({ title: 'Perfil atualizado', icon: 'i-lucide-check', color: 'success' })
  } catch {
    toast.add({ title: 'Erro ao salvar', icon: 'i-lucide-x', color: 'error' })
  } finally {
    savingBio.value = false
  }
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  const file = input.files[0]!
  uploadingAvatar.value = true
  try {
    await uploadAvatar(file)
    toast.add({ title: 'Avatar atualizado', icon: 'i-lucide-check', color: 'success' })
  } catch {
    toast.add({ title: 'Erro ao enviar avatar', icon: 'i-lucide-x', color: 'error' })
  } finally {
    uploadingAvatar.value = false
    input.value = ''
  }
}
</script>

<template>
  <div>
    <UPageCard
      title="Perfil"
      description="Gerencie as informações do seu perfil."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        label="Salvar alterações"
        color="neutral"
        :loading="savingBio"
        class="w-fit lg:ms-auto"
        @click="onSubmit"
      />
    </UPageCard>

    <UPageCard variant="subtle">
      <UFormField
        label="Nome"
        description="O nome não pode ser alterado por aqui."
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <UInput :model-value="user?.name" disabled />
      </UFormField>

      <USeparator />

      <UFormField
        label="E-mail"
        description="O e-mail não pode ser alterado por aqui."
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <UInput :model-value="user?.email" disabled type="email" />
      </UFormField>

      <USeparator />

      <UFormField
        label="Papel"
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <UBadge :label="user?.role?.name ?? '—'" variant="subtle" color="neutral" />
      </UFormField>

      <USeparator />

      <UFormField
        label="Avatar"
        description="JPG ou PNG. Máximo 2MB."
        class="flex max-sm:flex-col justify-between sm:items-center gap-4"
      >
        <div class="flex flex-wrap items-center gap-3">
          <UAvatar
            :src="user?.avatarUrl ?? undefined"
            :alt="user?.name"
            class="size-20 text-2xl"
          />
          <UButton
            label="Trocar avatar"
            color="neutral"
            variant="outline"
            :loading="uploadingAvatar"
            @click="fileRef?.click()"
          />
          <input
            ref="fileRef"
            type="file"
            class="hidden"
            accept="image/jpeg,image/png,image/webp"
            @change="onFileChange"
          >
        </div>
      </UFormField>

      <USeparator />

      <UFormField
        label="Bio"
        description="Breve descrição sobre você (máximo 500 caracteres)."
        class="flex max-sm:flex-col justify-between items-start gap-4"
        :ui="{ container: 'w-full' }"
      >
        <UTextarea
          v-model="bio"
          :rows="5"
          :maxlength="500"
          autoresize
          class="w-full"
        />
      </UFormField>
    </UPageCard>
  </div>
</template>
