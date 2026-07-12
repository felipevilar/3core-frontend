<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const schema = z.object({
  name: z.string().min(2, 'Muito curto'),
  email: z.string().email('E-mail inválido')
})
const open = ref(false)

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  name: '',
  email: ''
})

const toast = useToast()
async function onSubmit(event: FormSubmitEvent<Schema>) {
  toast.add({ title: 'Sucesso', description: `Novo cliente ${event.data.name} adicionado`, color: 'success' })
  open.value = false
}
</script>

<template>
  <UModal v-model:open="open" title="Novo cliente" description="Adicionar um novo cliente ao banco de dados">
    <UButton label="Novo cliente" icon="i-lucide-plus" />

    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Nome" placeholder="João da Silva" name="name">
          <UInput v-model="state.name" class="w-full" />
        </UFormField>
        <UFormField label="E-mail" placeholder="joao.silva@exemplo.com" name="email">
          <UInput v-model="state.email" class="w-full" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            @click="open = false"
          />
          <UButton
            label="Criar"
            color="primary"
            variant="solid"
            type="submit"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
