<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'public' })

useHead({ title: 'Entrar — 3CORE' })

const { login } = useAuth()
const { resolveLandingRoute } = usePermissions()
const route = useRoute()

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo de 8 caracteres')
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({ email: undefined, password: undefined })
const loading = ref(false)
const errorMsg = ref('')

async function onSubmit(event: FormSubmitEvent<Schema>) {
  errorMsg.value = ''
  loading.value = true
  try {
    await login(event.data.email, event.data.password)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : resolveLandingRoute()
    await navigateTo(redirect)
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    errorMsg.value = err?.data?.message ?? 'Não foi possível entrar. Verifique suas credenciais.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-muted/30 p-4">
    <UPageCard class="w-full max-w-sm">
      <div class="text-center mb-6">
        <h1 class="text-xl font-bold">
          Acessar o painel
        </h1>
        <p class="text-sm text-muted mt-1">
          Entre com seu e-mail e senha
        </p>
      </div>

      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="E-mail" name="email">
          <UInput
            v-model="state.email"
            type="email"
            placeholder="voce@empresa.com"
            autocomplete="email"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Senha" name="password">
          <UInput
            v-model="state.password"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            class="w-full"
          />
        </UFormField>

        <UAlert
          v-if="errorMsg"
          color="error"
          variant="subtle"
          :title="errorMsg"
          icon="i-lucide-alert-circle"
        />

        <UButton
          type="submit"
          block
          :loading="loading"
          label="Entrar"
        />
      </UForm>

      <p class="text-center text-sm text-muted mt-6">
        Quer ser um técnico parceiro?
        <ULink to="/" class="text-primary font-medium">Cadastre-se</ULink>
      </p>
    </UPageCard>
  </div>
</template>
