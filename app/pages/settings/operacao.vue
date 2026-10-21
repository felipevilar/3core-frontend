<script setup lang="ts">
import type { AppConfig } from '~/types'

definePageMeta({ permission: 'configuracoes.ver' })

const { $api } = useNuxtApp()
const { can } = usePermissions()
const toast = useToast()

const podeGerenciar = can('configuracoes.gerenciar')

const { data: config, error, refresh } = await useAsyncData(
  'app-config',
  () => $api<AppConfig>('/configuracoes')
)

const form = reactive({
  ratObrigatoria: false,
  assinaturaObrigatoria: false,
  geolocalizacaoObrigatoria: false,
  avaliacaoHabilitada: true,
  expiraAtivo: false,
  solicitacaoExpiraHoras: 24,
  permitirAgendarNoPassado: true
})

function preencher(c: AppConfig | null) {
  if (!c) return
  form.ratObrigatoria = c.ratObrigatoria
  form.assinaturaObrigatoria = c.assinaturaObrigatoria
  form.geolocalizacaoObrigatoria = c.geolocalizacaoObrigatoria
  form.avaliacaoHabilitada = c.avaliacaoHabilitada
  form.expiraAtivo = c.solicitacaoExpiraHoras != null
  form.solicitacaoExpiraHoras = c.solicitacaoExpiraHoras ?? 24
  form.permitirAgendarNoPassado = c.permitirAgendarNoPassado
}
watch(config, c => preencher(c ?? null), { immediate: true })

const horasValidas = computed(() =>
  !form.expiraAtivo
  || (Number.isInteger(form.solicitacaoExpiraHoras)
    && form.solicitacaoExpiraHoras >= 1
    && form.solicitacaoExpiraHoras <= 720)
)

const salvando = ref(false)
async function salvar() {
  if (!podeGerenciar || !horasValidas.value) return
  salvando.value = true
  try {
    await $api('/configuracoes', {
      method: 'PATCH',
      body: {
        ratObrigatoria: form.ratObrigatoria,
        assinaturaObrigatoria: form.assinaturaObrigatoria,
        geolocalizacaoObrigatoria: form.geolocalizacaoObrigatoria,
        avaliacaoHabilitada: form.avaliacaoHabilitada,
        solicitacaoExpiraHoras: form.expiraAtivo ? form.solicitacaoExpiraHoras : null,
        permitirAgendarNoPassado: form.permitirAgendarNoPassado
      }
    })
    toast.add({ title: 'Configurações salvas', icon: 'i-lucide-check', color: 'success' })
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string | string[] } }
    const msg = Array.isArray(err?.data?.message) ? err.data.message[0] : err?.data?.message
    toast.add({ title: msg ?? 'Erro ao salvar', icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <div v-if="error" class="py-16 text-center text-sm text-muted">
    Não foi possível carregar as configurações.
  </div>

  <template v-else>
    <UPageCard
      title="Finalização do atendimento"
      description="Exigências para o técnico concluir uma visita."
      variant="subtle"
    >
      <div class="flex flex-col gap-4">
        <USwitch
          v-model="form.ratObrigatoria"
          :disabled="!podeGerenciar"
          label="RAT obrigatória"
          description="Só permite finalizar com ao menos uma RAT anexada."
        />
        <USwitch
          v-model="form.assinaturaObrigatoria"
          :disabled="!podeGerenciar"
          label="Assinatura do cliente obrigatória"
          description="O técnico precisa coletar a assinatura no dispositivo ao finalizar."
        />
        <USwitch
          v-model="form.avaliacaoHabilitada"
          :disabled="!podeGerenciar"
          label="Avaliação do cliente"
          description="Exibe a avaliação (1 a 5 estrelas) na finalização."
        />
      </div>
    </UPageCard>

    <UPageCard
      title="Campo e geolocalização"
      description="Controle das ações 'a caminho', 'chegada' e 'finalizar'."
      variant="subtle"
    >
      <USwitch
        v-model="form.geolocalizacaoObrigatoria"
        :disabled="!podeGerenciar"
        label="Geolocalização obrigatória"
        description="Bloqueia as ações de campo quando o dispositivo não informa a posição."
      />
    </UPageCard>

    <UPageCard
      title="Solicitações e agenda"
      description="Prazo de aceite das solicitações e regras de agendamento."
      variant="subtle"
    >
      <div class="flex flex-col gap-4">
        <USwitch
          v-model="form.expiraAtivo"
          :disabled="!podeGerenciar"
          label="Solicitação expira"
          description="Se o técnico não aceitar no prazo, a solicitação expira e o chamado volta para 'Aberto'."
        />
        <UFormField
          v-if="form.expiraAtivo"
          label="Prazo para aceite (horas)"
          :error="horasValidas ? undefined : 'Informe um inteiro entre 1 e 720'"
          class="max-w-xs"
        >
          <UInput
            v-model.number="form.solicitacaoExpiraHoras"
            type="number"
            min="1"
            max="720"
            step="1"
            :disabled="!podeGerenciar"
            class="w-full"
          />
        </UFormField>
        <USwitch
          v-model="form.permitirAgendarNoPassado"
          :disabled="!podeGerenciar"
          label="Permitir agendar no passado"
          description="Desligado, bloqueia atribuições/visitas com data anterior a agora."
        />
      </div>

      <template #footer>
        <div class="flex items-center justify-between gap-3 w-full">
          <p class="text-xs text-muted">
            <template v-if="config?.updatedAt">
              Atualizado em {{ new Date(config.updatedAt).toLocaleString('pt-BR') }}
            </template>
            <template v-if="!podeGerenciar">
              Somente leitura — você não tem permissão para alterar.
            </template>
          </p>
          <UButton
            v-if="podeGerenciar"
            label="Salvar"
            icon="i-lucide-check"
            :disabled="!horasValidas"
            :loading="salvando"
            @click="salvar"
          />
        </div>
      </template>
    </UPageCard>
  </template>
</template>
