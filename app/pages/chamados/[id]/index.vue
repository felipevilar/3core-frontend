<script setup lang="ts">
import type {
  Chamado,
  ChamadoEvent,
  ChamadoRat,
  TechnicianListItem
} from '~/types'

definePageMeta({ permission: 'atendimentos.ver' })

const route = useRoute()
const { $api } = useNuxtApp()
const { can } = usePermissions()
const { user } = useAuth()
const toast = useToast()
const { statusMeta, prioridadeMeta, paymentMeta, eventLabel, brl } = useChamadoDisplay()

const id = Number(route.params.id)
const podeGerenciar = can('atendimentos.gerenciar')
const podeFin = can('financeiro.ver')
const podeFinGerenciar = can('financeiro.gerenciar')

const { data: chamado, refresh, error } = await useAsyncData(
  `chamado-${id}`,
  () => $api<Chamado>(`/chamados/${id}`)
)
const { data: eventos, refresh: refreshEventos } = await useAsyncData(
  `chamado-${id}-eventos`,
  () => $api<ChamadoEvent[]>(`/chamados/${id}/eventos`)
)
const { data: rats, refresh: refreshRats } = await useAsyncData(
  `chamado-${id}-rats`,
  () => $api<ChamadoRat[]>(`/chamados/${id}/rats`)
)

// É o técnico dono do chamado?
const isDono = computed(() => chamado.value?.tecnicoUserId === user.value?.id)

async function reloadAll() {
  await Promise.all([refresh(), refreshEventos(), refreshRats()])
}

async function acao(fn: () => Promise<unknown>, sucesso: string) {
  try {
    await fn()
    toast.add({ title: sucesso, icon: 'i-lucide-check', color: 'success' })
    await reloadAll()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string | string[] } }
    const msg = Array.isArray(err?.data?.message) ? err.data.message[0] : err?.data?.message
    toast.add({ title: msg ?? 'Erro na ação', icon: 'i-lucide-alert-circle', color: 'error' })
  }
}

// ---- Atribuir técnico ----
const atribuirOpen = ref(false)
const tecnicoSel = ref<number | undefined>()
const chamadaFixa = ref('')
const { data: tecnicos } = await useAsyncData(
  'tecnicos-para-atribuir',
  () => (podeGerenciar ? $api<TechnicianListItem[]>('/technicians') : Promise.resolve([])),
  { default: () => [] as TechnicianListItem[] }
)
const tecnicoItems = computed(() =>
  (tecnicos.value ?? []).map(t => ({ label: `${t.name} (${t.email})`, value: t.userId }))
)
async function confirmarAtribuir() {
  if (!tecnicoSel.value) return
  await acao(
    () => $api(`/chamados/${id}/atribuir`, {
      method: 'POST',
      body: { tecnicoUserId: tecnicoSel.value, chamadaFixa: chamadaFixa.value || undefined }
    }),
    'Técnico atribuído'
  )
  atribuirOpen.value = false
  chamadaFixa.value = ''
}

// ---- Finalizar (técnico) ----
const finalizarOpen = ref(false)
const finForm = reactive({ horasTrabalhadas: 0, kmDeslocamento: 0, observacao: '' })
async function confirmarFinalizar() {
  await acao(
    () => $api(`/chamados/${id}/finalizar`, { method: 'POST', body: { ...finForm } }),
    'Chamado finalizado'
  )
  finalizarOpen.value = false
}

// ---- Motivo (cancelar/reabrir) ----
const motivoOpen = ref(false)
const motivoAcao = ref<'cancelar' | 'reabrir'>('cancelar')
const motivoTexto = ref('')
function abrirMotivo(tipo: 'cancelar' | 'reabrir') {
  motivoAcao.value = tipo
  motivoTexto.value = ''
  motivoOpen.value = true
}
async function confirmarMotivo() {
  if (motivoTexto.value.trim().length < 3) return
  await acao(
    () => $api(`/chamados/${id}/${motivoAcao.value}`, { method: 'POST', body: { motivo: motivoTexto.value.trim() } }),
    motivoAcao.value === 'cancelar' ? 'Chamado cancelado' : 'Chamado reaberto'
  )
  motivoOpen.value = false
}

// ---- Ações simples do técnico ----
const marcarACaminho = () => acao(() => $api(`/chamados/${id}/a-caminho`, { method: 'POST' }), 'A caminho')
const confirmarChegada = () => acao(() => $api(`/chamados/${id}/chegada`, { method: 'POST' }), 'Chegada confirmada')
const fechar = () => acao(() => $api(`/chamados/${id}/fechar`, { method: 'POST' }), 'Chamado fechado')

// ---- Financeiro: line items ----
const lineOpen = ref(false)
const lineForm = reactive({
  natureza: 'custo' as 'custo' | 'receita',
  tipo: 'extra' as 'chamada_fixa' | 'mao_de_obra' | 'deslocamento' | 'extra' | 'ajuste',
  descricao: '',
  quantidade: 1,
  valorUnitario: ''
})
const naturezaItems = [
  { label: 'Custo (paga técnico)', value: 'custo' },
  { label: 'Receita (cobra cliente)', value: 'receita' }
]
const tipoItems = [
  { label: 'Chamada fixa', value: 'chamada_fixa' },
  { label: 'Mão de obra', value: 'mao_de_obra' },
  { label: 'Deslocamento', value: 'deslocamento' },
  { label: 'Extra', value: 'extra' },
  { label: 'Ajuste', value: 'ajuste' }
]
async function addLine() {
  if (!lineForm.valorUnitario) return
  await acao(
    () => $api(`/chamados/${id}/line-items`, {
      method: 'POST',
      body: {
        natureza: lineForm.natureza,
        tipo: lineForm.tipo,
        descricao: lineForm.descricao || undefined,
        quantidade: lineForm.quantidade,
        valorUnitario: lineForm.valorUnitario
      }
    }),
    'Linha adicionada'
  )
  lineOpen.value = false
  lineForm.descricao = ''
  lineForm.valorUnitario = ''
  lineForm.quantidade = 1
}
const removeLine = (itemId: number) =>
  acao(() => $api(`/chamados/${id}/line-items/${itemId}`, { method: 'DELETE' }), 'Linha removida')

// ---- Pagamento ----
const aprovar = () => acao(() => $api(`/chamados/${id}/pagamento`, { method: 'PATCH', body: { paymentStatus: 'aprovado' } }), 'Pagamento aprovado')
const marcarPago = () => acao(() => $api(`/chamados/${id}/pagamento`, { method: 'PATCH', body: { paymentStatus: 'pago' } }), 'Marcado como pago')

const custoItems = computed(() => (chamado.value?.lineItems ?? []).filter(i => i.natureza === 'custo'))
const receitaItems = computed(() => (chamado.value?.lineItems ?? []).filter(i => i.natureza === 'receita'))

// Endereço do atendimento formatado em linhas (só as partes preenchidas).
const enderecoLinhas = computed<string[]>(() => {
  const c = chamado.value
  if (!c) return []
  const linhas: string[] = []
  const l1 = [c.logradouro, c.numero].filter(Boolean).join(', ')
  if (l1) linhas.push(c.complemento ? `${l1} — ${c.complemento}` : l1)
  else if (c.complemento) linhas.push(c.complemento)
  const l2 = [c.bairro, c.city ? `${c.city.nome}/${c.city.uf}` : null].filter(Boolean).join(' • ')
  if (l2) linhas.push(l2)
  if (c.cep) linhas.push(`CEP ${c.cep}`)
  return linhas
})

// ---- RAT: upload (dono ou gestor) + download via signed URL ----
const podeAnexarRat = computed(() =>
  chamado.value
  && !['fechado', 'cancelado'].includes(chamado.value.status)
  && (isDono.value || podeGerenciar)
)
const ratInput = ref<HTMLInputElement | null>(null)
const uploadingRat = ref(false)

function escolherArquivoRat() {
  ratInput.value?.click()
}

async function onRatSelecionado(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadingRat.value = true
  try {
    // 1) pede a URL assinada de upload à nossa API
    const { signedUrl, path } = await $api<{ signedUrl: string, path: string, token: string }>(
      `/chamados/${id}/rat/upload-url`,
      { method: 'POST', body: { fileName: file.name } }
    )
    // 2) sobe o arquivo direto ao Storage
    const put = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    })
    if (!put.ok) throw new Error(`upload falhou (${put.status})`)
    // 3) confirma os metadados
    await $api(`/chamados/${id}/rat`, {
      method: 'POST',
      body: { storagePath: path, fileName: file.name, mimeType: file.type || null, sizeBytes: file.size }
    })
    toast.add({ title: 'RAT anexada', icon: 'i-lucide-check', color: 'success' })
    await refreshRats()
    await refreshEventos()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string }, message?: string }
    toast.add({ title: err?.data?.message ?? err?.message ?? 'Erro ao anexar RAT', icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    uploadingRat.value = false
    if (ratInput.value) ratInput.value.value = ''
  }
}

async function abrirRat(ratId: number) {
  try {
    const { signedUrl } = await $api<{ signedUrl: string }>(`/chamados/${id}/rat/${ratId}/download-url`)
    window.open(signedUrl, '_blank', 'noopener')
  } catch {
    toast.add({ title: 'Erro ao abrir a RAT', icon: 'i-lucide-alert-circle', color: 'error' })
  }
}

const { confirm } = useConfirm()
const removendoRat = ref<number | null>(null)
async function removerRat(ratId: number, fileName: string) {
  const ok = await confirm({
    title: 'Remover RAT',
    message: `Remover a RAT "${fileName}"? Esta ação não pode ser desfeita.`,
    confirmLabel: 'Remover',
    confirmColor: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  removendoRat.value = ratId
  try {
    await $api(`/chamados/${id}/rat/${ratId}`, { method: 'DELETE' })
    toast.add({ title: 'RAT removida', icon: 'i-lucide-check', color: 'success' })
    await refreshRats()
    await refreshEventos()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message ?? 'Erro ao remover a RAT', icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    removendoRat.value = null
  }
}
</script>

<template>
  <UDashboardPanel id="chamado-detalhe">
    <template #header>
      <UDashboardNavbar :title="chamado ? `${chamado.codigo}` : 'Chamado'">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            to="/chamados"
            aria-label="Voltar"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="error" class="py-16 text-center text-sm text-muted">
        Chamado não encontrado.
      </div>

      <div v-else-if="chamado" class="space-y-4">
        <!-- Cabeçalho -->
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 class="text-xl font-semibold text-highlighted flex items-center gap-2">
              {{ chamado.titulo }}
              <UBadge :color="statusMeta(chamado.status).color" variant="subtle">
                {{ statusMeta(chamado.status).label }}
              </UBadge>
              <UBadge :color="prioridadeMeta(chamado.prioridade).color" variant="subtle" size="sm">
                {{ prioridadeMeta(chamado.prioridade).label }}
              </UBadge>
            </h1>
            <p class="text-muted text-sm mt-1">
              {{ chamado.client?.nome }}
              <span v-if="chamado.city"> • {{ chamado.city.nome }}/{{ chamado.city.uf }}</span>
            </p>
          </div>

          <!-- Ações contextuais -->
          <div class="flex flex-wrap items-center gap-2">
            <!-- Técnico (dono) -->
            <UButton
              v-if="isDono && chamado.status === 'atribuido'"
              label="A caminho"
              icon="i-lucide-navigation"
              size="sm"
              color="info"
              variant="subtle"
              @click="marcarACaminho"
            />
            <UButton
              v-if="isDono && ['atribuido', 'a_caminho'].includes(chamado.status)"
              label="Confirmar chegada"
              icon="i-lucide-map-pin"
              size="sm"
              color="info"
              variant="subtle"
              @click="confirmarChegada"
            />
            <UButton
              v-if="isDono && chamado.status === 'em_atendimento'"
              label="Finalizar"
              icon="i-lucide-check-check"
              size="sm"
              color="primary"
              @click="finalizarOpen = true"
            />
            <!-- Gestor -->
            <UButton
              v-if="podeGerenciar && ['aberto', 'atribuido', 'a_caminho', 'em_atendimento'].includes(chamado.status)"
              :label="chamado.tecnicoUserId ? 'Reatribuir' : 'Atribuir técnico'"
              icon="i-lucide-user-plus"
              size="sm"
              variant="subtle"
              @click="atribuirOpen = true"
            />
            <UButton
              v-if="podeGerenciar && chamado.status === 'finalizado'"
              label="Confirmar e fechar"
              icon="i-lucide-lock"
              size="sm"
              color="success"
              @click="fechar"
            />
            <UButton
              v-if="podeGerenciar && ['finalizado', 'fechado', 'cancelado'].includes(chamado.status)"
              label="Reabrir"
              icon="i-lucide-rotate-ccw"
              size="sm"
              color="warning"
              variant="subtle"
              @click="abrirMotivo('reabrir')"
            />
            <UButton
              v-if="podeGerenciar && !['fechado', 'cancelado'].includes(chamado.status)"
              label="Cancelar"
              icon="i-lucide-x-circle"
              size="sm"
              color="error"
              variant="subtle"
              @click="abrirMotivo('cancelar')"
            />
          </div>
        </div>

        <div v-if="chamado.avisoSemRat && chamado.status === 'finalizado'" class="text-xs text-warning flex items-center gap-1">
          <UIcon name="i-lucide-triangle-alert" class="size-4" /> Finalizado sem RAT anexada.
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <!-- Coluna principal -->
          <div class="lg:col-span-2 space-y-4">
            <!-- Detalhes -->
            <UPageCard title="Detalhes" variant="subtle">
              <dl class="space-y-3 text-sm">
                <div v-if="chamado.descricao">
                  <dt class="text-muted text-xs mb-0.5">
                    Descrição
                  </dt>
                  <dd class="text-highlighted whitespace-pre-line">
                    {{ chamado.descricao }}
                  </dd>
                </div>
                <div class="flex justify-between gap-3">
                  <dt class="text-muted">
                    Técnico
                  </dt>
                  <dd class="text-highlighted text-right">
                    {{ chamado.tecnicoNome ?? '— não atribuído' }}
                  </dd>
                </div>
                <div v-if="chamado.agendadoPara" class="flex justify-between gap-3">
                  <dt class="text-muted">
                    Agendado para
                  </dt>
                  <dd class="text-highlighted text-right">
                    {{ new Date(chamado.agendadoPara).toLocaleString('pt-BR') }}
                  </dd>
                </div>
                <div v-if="chamado.horasTrabalhadas" class="flex justify-between gap-3">
                  <dt class="text-muted">
                    Execução
                  </dt>
                  <dd class="text-highlighted text-right">
                    {{ chamado.horasTrabalhadas }}h • {{ chamado.kmDeslocamento }} km
                  </dd>
                </div>
                <div v-if="enderecoLinhas.length" class="pt-1">
                  <dt class="text-muted text-xs mb-0.5">
                    Endereço do atendimento
                  </dt>
                  <dd class="text-highlighted">
                    <p v-for="(linha, i) in enderecoLinhas" :key="i">{{ linha }}</p>
                    <p v-if="chamado.pontoReferencia" class="text-muted text-xs mt-0.5">
                      Referência: {{ chamado.pontoReferencia }}
                    </p>
                  </dd>
                </div>
              </dl>
            </UPageCard>

            <!-- Financeiro -->
            <UPageCard
              v-if="podeFin || chamado.lineItems"
              variant="subtle"
              :ui="{ container: 'p-0 sm:p-0', header: 'w-full' }"
            >
              <template #header>
                <div class="w-full flex items-center justify-between gap-3 p-4 border-b border-default">
                  <div>
                    <p class="text-highlighted font-medium">
                      Financeiro
                    </p>
                    <p class="text-muted text-xs">
                      Custo (técnico): {{ brl(chamado.custoTecnicoTotal) }}
                      <template v-if="podeFin">
                        • Receita: {{ brl(chamado.valorClienteTotal) }} • Margem: {{ brl(chamado.margem) }}
                      </template>
                    </p>
                  </div>
                  <UButton
                    v-if="podeFinGerenciar && !chamado.valoresCongeladosEm"
                    label="Adicionar linha"
                    icon="i-lucide-plus"
                    size="xs"
                    variant="subtle"
                    @click="lineOpen = true"
                  />
                </div>
              </template>

              <div class="p-4 space-y-3">
                <div>
                  <p class="text-xs font-semibold uppercase text-muted mb-1">
                    Custos (técnico)
                  </p>
                  <ul class="divide-y divide-default">
                    <li v-for="i in custoItems" :key="i.id" class="flex items-center justify-between gap-2 py-1.5 text-sm">
                      <span class="text-highlighted truncate">
                        {{ i.descricao || i.tipo }}
                        <span class="text-muted text-xs">({{ i.quantidade }} × {{ brl(i.valorUnitario) }})</span>
                      </span>
                      <span class="flex items-center gap-2 shrink-0">
                        <span class="text-highlighted">{{ brl(i.valorTotal) }}</span>
                        <UButton
                          v-if="podeFinGerenciar && i.origem === 'manual' && !chamado.valoresCongeladosEm"
                          icon="i-lucide-trash-2"
                          color="error"
                          variant="ghost"
                          size="xs"
                          @click="removeLine(i.id)"
                        />
                      </span>
                    </li>
                    <li v-if="!custoItems.length" class="py-1.5 text-xs text-muted">
                      Sem custos lançados.
                    </li>
                  </ul>
                </div>

                <div v-if="podeFin">
                  <p class="text-xs font-semibold uppercase text-muted mb-1">
                    Receita (cliente)
                  </p>
                  <ul class="divide-y divide-default">
                    <li v-for="i in receitaItems" :key="i.id" class="flex items-center justify-between gap-2 py-1.5 text-sm">
                      <span class="text-highlighted truncate">{{ i.descricao || i.tipo }}</span>
                      <span class="flex items-center gap-2 shrink-0">
                        <span class="text-highlighted">{{ brl(i.valorTotal) }}</span>
                        <UButton
                          v-if="podeFinGerenciar && !chamado.valoresCongeladosEm"
                          icon="i-lucide-trash-2"
                          color="error"
                          variant="ghost"
                          size="xs"
                          @click="removeLine(i.id)"
                        />
                      </span>
                    </li>
                    <li v-if="!receitaItems.length" class="py-1.5 text-xs text-muted">
                      Sem receita lançada.
                    </li>
                  </ul>
                </div>

                <!-- Pagamento -->
                <div v-if="chamado.status === 'fechado'" class="flex items-center justify-between border-t border-default pt-3">
                  <div class="text-sm">
                    <span class="text-muted">Pagamento:</span>
                    <UBadge :color="paymentMeta(chamado.paymentStatus).color" variant="subtle" class="ml-1">
                      {{ paymentMeta(chamado.paymentStatus).label }}
                    </UBadge>
                    <span v-if="chamado.paymentPeriodo" class="text-muted text-xs ml-2">competência {{ chamado.paymentPeriodo }}</span>
                  </div>
                  <div v-if="podeFinGerenciar" class="flex gap-2">
                    <UButton
                      v-if="chamado.paymentStatus === 'pendente'"
                      label="Aprovar"
                      size="xs"
                      color="info"
                      variant="subtle"
                      @click="aprovar"
                    />
                    <UButton
                      v-if="chamado.paymentStatus === 'aprovado'"
                      label="Marcar pago"
                      size="xs"
                      color="success"
                      variant="subtle"
                      @click="marcarPago"
                    />
                  </div>
                </div>
              </div>
            </UPageCard>

            <!-- RAT -->
            <UPageCard variant="subtle" :ui="{ container: 'p-0 sm:p-0', header: 'w-full' }">
              <template #header>
                <div class="w-full flex items-center justify-between gap-3 p-4 border-b border-default">
                  <p class="text-highlighted font-medium">
                    RAT (Relatório de Atendimento)
                  </p>
                  <UButton
                    v-if="podeAnexarRat"
                    label="Anexar"
                    icon="i-lucide-upload"
                    size="xs"
                    variant="subtle"
                    :loading="uploadingRat"
                    @click="escolherArquivoRat"
                  />
                </div>
              </template>
              <div class="p-4">
                <input
                  ref="ratInput"
                  type="file"
                  class="hidden"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  @change="onRatSelecionado"
                >
                <ul v-if="rats?.length" class="divide-y divide-default text-sm">
                  <li v-for="r in rats" :key="r.id" class="flex items-center justify-between gap-2 py-2">
                    <button
                      type="button"
                      class="text-highlighted truncate flex items-center gap-2 hover:text-primary text-left min-w-0"
                      @click="abrirRat(r.id)"
                    >
                      <UIcon name="i-lucide-file-text" class="size-4 shrink-0" />
                      <span class="truncate">{{ r.fileName }}</span>
                    </button>
                    <span class="flex items-center gap-2 shrink-0">
                      <span class="text-muted text-xs">{{ new Date(r.createdAt).toLocaleDateString('pt-BR') }}</span>
                      <UButton
                        v-if="podeAnexarRat"
                        icon="i-lucide-trash-2"
                        color="error"
                        variant="ghost"
                        size="xs"
                        :loading="removendoRat === r.id"
                        aria-label="Remover RAT"
                        @click="removerRat(r.id, r.fileName)"
                      />
                    </span>
                  </li>
                </ul>
                <p v-else class="text-sm text-muted">
                  Nenhuma RAT anexada.
                </p>
              </div>
            </UPageCard>
          </div>

          <!-- Timeline -->
          <div>
            <UPageCard title="Histórico" variant="subtle">
              <ol class="space-y-3">
                <li v-for="e in eventos ?? []" :key="e.id" class="flex gap-3 text-sm">
                  <UIcon name="i-lucide-circle-dot" class="size-4 mt-0.5 text-muted shrink-0" />
                  <div class="min-w-0">
                    <p class="text-highlighted">
                      {{ eventLabel(e.tipo) }}
                    </p>
                    <p v-if="e.nota" class="text-muted text-xs">
                      {{ e.nota }}
                    </p>
                    <p class="text-dimmed text-xs">
                      {{ e.atorEmail }} • {{ new Date(e.createdAt).toLocaleString('pt-BR') }}
                    </p>
                  </div>
                </li>
                <li v-if="!eventos?.length" class="text-xs text-muted">
                  Sem eventos.
                </li>
              </ol>
            </UPageCard>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modal: atribuir -->
  <UModal v-model:open="atribuirOpen" title="Atribuir técnico">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Técnico">
          <USelect
            v-model="tecnicoSel"
            :items="tecnicoItems"
            placeholder="Selecione"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Chamada fixa (custo)" help="Opcional — valor fixo do atendimento">
          <UInput v-model="chamadaFixa" placeholder="0,00" class="w-full" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            @click="atribuirOpen = false"
          />
          <UButton label="Atribuir" :disabled="!tecnicoSel" @click="confirmarAtribuir" />
        </div>
      </div>
    </template>
  </UModal>

  <!-- Modal: finalizar -->
  <UModal v-model:open="finalizarOpen" title="Finalizar atendimento">
    <template #body>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Horas trabalhadas">
            <UInput
              v-model.number="finForm.horasTrabalhadas"
              type="number"
              min="0"
              step="0.5"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Km de deslocamento">
            <UInput
              v-model.number="finForm.kmDeslocamento"
              type="number"
              min="0"
              step="1"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Observação">
          <UTextarea v-model="finForm.observacao" class="w-full" :rows="2" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            @click="finalizarOpen = false"
          />
          <UButton label="Finalizar" color="primary" @click="confirmarFinalizar" />
        </div>
      </div>
    </template>
  </UModal>

  <!-- Modal: motivo (cancelar/reabrir) -->
  <UModal v-model:open="motivoOpen" :title="motivoAcao === 'cancelar' ? 'Cancelar chamado' : 'Reabrir chamado'">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Motivo" required>
          <UTextarea
            v-model="motivoTexto"
            class="w-full"
            :rows="3"
            placeholder="Descreva o motivo"
          />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Voltar"
            color="neutral"
            variant="subtle"
            @click="motivoOpen = false"
          />
          <UButton
            :label="motivoAcao === 'cancelar' ? 'Cancelar chamado' : 'Reabrir'"
            :color="motivoAcao === 'cancelar' ? 'error' : 'warning'"
            :disabled="motivoTexto.trim().length < 3"
            @click="confirmarMotivo"
          />
        </div>
      </div>
    </template>
  </UModal>

  <!-- Modal: line item -->
  <UModal v-model:open="lineOpen" title="Adicionar linha financeira">
    <template #body>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Natureza">
            <USelect v-model="lineForm.natureza" :items="naturezaItems" class="w-full" />
          </UFormField>
          <UFormField label="Tipo">
            <USelect v-model="lineForm.tipo" :items="tipoItems" class="w-full" />
          </UFormField>
        </div>
        <UFormField label="Descrição">
          <UInput v-model="lineForm.descricao" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Quantidade">
            <UInput
              v-model.number="lineForm.quantidade"
              type="number"
              min="0"
              step="0.5"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Valor unitário (R$)">
            <UInput v-model="lineForm.valorUnitario" placeholder="0,00" class="w-full" />
          </UFormField>
        </div>
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            @click="lineOpen = false"
          />
          <UButton label="Adicionar" :disabled="!lineForm.valorUnitario" @click="addLine" />
        </div>
      </div>
    </template>
  </UModal>
</template>
